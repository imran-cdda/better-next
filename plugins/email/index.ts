import { type BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  sessionMiddleware,
} from "better-auth/api"
import { z } from "zod"

import { getSchema } from "./schema"
import * as schema from "@/core/db/schema"
import type {
  BulkEmailResult,
  DatabaseEmailLog,
  EmailAdapter,
  EmailLog,
  EmailOptions,
  EmailStats,
  GetEmailLogsQuery,
  InputEmailLog,
  ResendWebhookPayload,
} from "./types"
import {
  arrayToString,
  calculateEmailStats,
  determineContentType,
  generateEmailId,
  parseResendWebhook,
  sanitizeEmailContent,
  validateEmailArray,
} from "./utils"
import { SendEmailRequest } from "./adapters/types"
import { getTableConfig } from "drizzle-orm/pg-core"

const EMAIL_ERROR_CODES = {
  EMAIL_NOT_FOUND: "Email log not found",
  INVALID_EMAIL_ADDRESS: "Invalid email address format",
  SEND_FAILED: "Failed to send email",
  ADAPTER_NOT_FOUND: "Email adapter not found",
  WEBHOOK_VERIFICATION_FAILED: "Webhook signature verification failed",
  INVALID_WEBHOOK_PAYLOAD: "Invalid webhook payload",
  PROVIDER_ERROR: "Email provider error",
  MISSING_CONTENT: "Email content is required (html or text)",
  UNAUTHORIZED_ACCESS: "Unauthorized to access email logs",
  BULK_SEND_FAILED: "Bulk email send operation failed",
} as const

/**
 * Create a standardized API error with additional context
 */
const createValidationError = (
  status:
    | "BAD_REQUEST"
    | "NOT_FOUND"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INTERNAL_SERVER_ERROR",
  message: string,
  code?: string,
  field?: string,
  additionalData?: Record<string, unknown>
) => {
  return new APIError(status, {
    message,
    code,
    field,
    ...additionalData,
  })
}

export const requireAbility = (req: { action: string; subject: string }) =>
  createAuthMiddleware(async (ctx) => {
    const session = ctx.context.session

    if (!session) {
      throw new APIError("UNAUTHORIZED", {
        message: "Authentication required",
      })
    }

    // Attach ability to context so endpoint handlers can do further checks
    ctx.context.ability = req
  })

export const email = <O extends EmailOptions>(options?: O) => {
  // Initialize adapters
  const adapters = new Map<string, EmailAdapter>()

  // Add provided adapters
  if (options?.adapters) {
    for (const adapter of options.adapters) {
      adapters.set(adapter.name, adapter)
    }
  }

  // Get default adapter
  const getDefaultAdapter = (): EmailAdapter => {
    const defaultProvider = options?.defaultProvider || "resend"
    const adapter = adapters.get(defaultProvider)

    if (!adapter) {
      throw createValidationError(
        "INTERNAL_SERVER_ERROR",
        `Email adapter '${defaultProvider}' not found`,
        EMAIL_ERROR_CODES.ADAPTER_NOT_FOUND
      )
    }

    return adapter
  }

  const emailEndpoints = {
    /**
     * ### Endpoint
     *
     * POST `/email/send`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.sendEmail`
     *
     * **client:**
     * `authClient.email.send`
     */
    sendEmail: createAuthEndpoint(
      "/email/send",
      {
        method: "POST",
        body: z
          .object({
            to: z.array(
              z.object({ email: z.email(), name: z.string().optional() })
            ),
            from: z
              .object({
                email: z.email(),
                name: z.string().optional(),
              })
              .optional(),
            subject: z.string().min(1),
            html: z.string().optional(),
            text: z.string().optional(),
            cc: z
              .array(
                z.object({ email: z.email(), name: z.string().optional() })
              )
              .optional(),
            bcc: z
              .array(
                z.object({ email: z.email(), name: z.string().optional() })
              )
              .optional(),
            replyTo: z
              .object({
                email: z.email(),
                name: z.string().optional(),
              })
              .optional(),
            tags: z
              .array(
                z.object({
                  name: z.string(),
                  value: z.string(),
                })
              )
              .optional(),
            attachments: z
              .array(
                z.object({
                  url: z.string().optional(),
                  filename: z.string(),
                  content: z.union([z.string(), z.instanceof(Buffer)]),
                  contentType: z.string().optional(),
                })
              )
              .optional(),
            provider: z.enum(["resend", "sendgrid", "brevo"]).optional(),
          })
          .refine((data) => data.html || data.text, {
            message: "Either html or text content is required",
            path: ["content"],
          }),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        // if (!ctx.context.session) {
        //   throw new APIError("UNAUTHORIZED");
        // }

        try {
          // Validate email addresses
          const toEmails = validateEmailArray(
            ctx.body.to.map((email) => email.email)
          )
          const ccEmails = ctx.body.cc
            ? validateEmailArray(ctx.body.cc.map((email) => email.email))
            : undefined
          const bccEmails = ctx.body.bcc
            ? validateEmailArray(ctx.body.bcc.map((email) => email.email))
            : undefined

          // Use provided from address or default
          const fromAddress = ctx.body.from || options?.fromAddress
          if (!fromAddress) {
            throw createValidationError(
              "BAD_REQUEST",
              "From address is required",
              EMAIL_ERROR_CODES.INVALID_EMAIL_ADDRESS
            )
          }

          const replyTo = ctx.body.replyTo || options?.replyToAddress

          // Get adapter
          const adapter = ctx.body.provider
            ? adapters.get(ctx.body.provider) || getDefaultAdapter()
            : getDefaultAdapter()

          // Prepare email request
          const emailRequest: SendEmailRequest = {
            to: ctx.body.to,
            ...(fromAddress && {
              from:
                typeof fromAddress === "string"
                  ? { email: fromAddress }
                  : fromAddress,
            }),
            subject: ctx.body.subject,
            html: ctx.body.html,
            text: ctx.body.text,
            cc: ctx.body.cc,
            bcc: ctx.body.bcc,
            ...(replyTo && {
              replyTo:
                typeof replyTo === "string" ? { email: replyTo } : replyTo,
            }),
            tags: ctx.body.tags,
            attachments: ctx.body.attachments,
          }

          // Prepare email log data first (before sending)
          const emailLogId = generateEmailId()
          const contentType = determineContentType(ctx.body.html, ctx.body.text)

          const emailLogData: InputEmailLog = {
            fromAddress:
              typeof fromAddress === "string" ? fromAddress : fromAddress.email,
            toAddress: arrayToString(toEmails) || toEmails[0],
            ccAddress: arrayToString(ccEmails),
            bccAddress: arrayToString(bccEmails),
            replyToAddress:
              typeof replyTo === "string" ? replyTo : replyTo?.email,
            subject: ctx.body.subject,
            content: sanitizeEmailContent(ctx.body.html || ctx.body.text || ""),
            contentType,
            status_state: "pending",
            provider: adapter.name,
            userId: ctx.context.session.user.id,
            // tags: ctx.body.tags ? JSON.stringify(ctx.body.tags) : undefined,
          }

          // Send email
          const sendResult = await adapter.adapter.sendEmail(emailRequest)

          // Update email log data based on send result
          if (sendResult.success) {
            // Success: save provider ID (message ID) and mark as sent
            emailLogData.providerId = sendResult.providerId
            emailLogData.status_state = "sent"
            emailLogData.sentAt = new Date()
          } else {
            // Failure: log the error and mark as failed
            emailLogData.status_state = "failed"
            emailLogData.failedAt = new Date()
            // emailLogData.errorMessage =
            //   sendResult.error || "Failed to send email";
          }

          // Create email log entry (for both success and failure)
          const emailLog = await ctx.context.adapter.create<DatabaseEmailLog>({
            model: "emailLog",
            data: {
              ...emailLogData,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })

          // Set the ID after creation
          ;(emailLog as DatabaseEmailLog).id = emailLogId

          // If send failed, throw error after logging
          if (!sendResult.success) {
            throw createValidationError(
              "INTERNAL_SERVER_ERROR",
              sendResult.error || "Failed to send email",
              EMAIL_ERROR_CODES.SEND_FAILED
            )
          }

          return {
            success: true,
            emailId: emailLog.id,
            providerId: sendResult.providerId,
            message: "Email sent successfully",
          }
        } catch (error) {
          if (error instanceof APIError) {
            throw error
          }

          throw createValidationError(
            "INTERNAL_SERVER_ERROR",
            error instanceof Error ? error.message : "Unknown error occurred",
            EMAIL_ERROR_CODES.SEND_FAILED
          )
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * POST `/email/send-bulk`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.sendBulkEmails`
     *
     * **client:**
     * `authClient.email.sendBulk`
     */
    sendBulkEmails: createAuthEndpoint(
      "/email/send-bulk",
      {
        method: "POST",
        body: z.object({
          emails: z.array(
            z
              .object({
                to: z.union([z.string().email(), z.array(z.string().email())]),
                from: z.string().email().optional(),
                subject: z.string().min(1),
                html: z.string().optional(),
                text: z.string().optional(),
                cc: z
                  .array(
                    z.object({ email: z.email(), name: z.string().optional() })
                  )
                  .optional(),
                bcc: z
                  .array(
                    z.object({ email: z.email(), name: z.string().optional() })
                  )
                  .optional(),
                replyTo: z.object({
                  email: z.email(),
                  name: z.string().optional(),
                }),
                tags: z
                  .array(
                    z.object({
                      name: z.string(),
                      value: z.string(),
                    })
                  )
                  .optional(),
              })
              .refine((data) => data.html || data.text, {
                message: "Either html or text content is required",
                path: ["content"],
              })
          ),
          provider: z.enum(["resend", "sendgrid", "brevo"]).optional(),
        }),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        if (!ctx.context.session) {
          throw new APIError("UNAUTHORIZED")
        }

        try {
          // Get adapter
          const adapter = ctx.body.provider
            ? adapters.get(ctx.body.provider) || getDefaultAdapter()
            : getDefaultAdapter()

          // Prepare email requests
          const emailRequests: SendEmailRequest[] = ctx.body.emails.map(
            (email) => ({
              ...email,
              from: { email: email.from || options?.fromAddress || "" },
              replyTo: email.replyTo || options?.replyToAddress,
              to: Array.isArray(email.to)
                ? email.to.map((to) => ({ email: to }))
                : [{ email: email.to }],
            })
          )

          // Validate all emails have from addresses
          for (const email of emailRequests) {
            if (!email.from) {
              throw createValidationError(
                "BAD_REQUEST",
                "From address is required for all emails",
                EMAIL_ERROR_CODES.INVALID_EMAIL_ADDRESS
              )
            }
          }

          // Send bulk emails
          const sendResults =
            await adapter.adapter.sendBulkEmails(emailRequests)

          // Create email log entries for each email
          const emailLogs: DatabaseEmailLog[] = []

          for (let i = 0; i < emailRequests.length; i++) {
            const email = emailRequests[i]
            const result = sendResults[i]

            const emailLogId = generateEmailId()
            const contentType = determineContentType(email.html, email.text)
            const toEmails = validateEmailArray(email.to.map((to) => to.email))

            const emailLogData: InputEmailLog = {
              fromAddress: email?.from?.email || options?.fromAddress || "",
              toAddress: arrayToString(toEmails) || toEmails[0],
              ccAddress: email.cc
                ? arrayToString(
                    validateEmailArray(email.cc.map((cc) => cc.email))
                  )
                : undefined,
              bccAddress: email.bcc
                ? arrayToString(
                    validateEmailArray(email.bcc.map((bcc) => bcc.email))
                  )
                : undefined,
              replyToAddress: email?.replyTo?.email || options?.replyToAddress,
              subject: email.subject,
              content: sanitizeEmailContent(email.html || email.text || ""),
              contentType,
              status_state: result.success ? "sent" : "failed",
              provider: adapter.name,
              providerId: result.providerId,
              userId: ctx.context.session.user.id,
              // errorMessage: result.success ? undefined : result.error,
              sentAt: result.success ? new Date() : undefined,
              failedAt: result.success ? undefined : new Date(),
              // tags: email.tags ? JSON.stringify(email.tags) : undefined,
            }

            const emailLog = await ctx.context.adapter.create<DatabaseEmailLog>(
              {
                model: "emailLog",
                data: {
                  ...emailLogData,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              }
            )

            // Set the ID after creation
            ;(emailLog as DatabaseEmailLog).id = emailLogId
            emailLogs.push(emailLog as DatabaseEmailLog)
          }

          const successful = sendResults.filter((r) => r.success).length
          const failed = sendResults.filter((r) => !r.success).length

          const result: BulkEmailResult = {
            total: emailRequests.length,
            successful,
            failed,
            results: sendResults,
          }

          return {
            success: true,
            ...result,
            emailLogs: emailLogs.map((log) => log.id),
            message: `Bulk email send completed: ${successful} successful, ${failed} failed`,
          }
        } catch (error) {
          if (error instanceof APIError) {
            throw error
          }

          throw createValidationError(
            "INTERNAL_SERVER_ERROR",
            error instanceof Error ? error.message : "Unknown error occurred",
            EMAIL_ERROR_CODES.BULK_SEND_FAILED
          )
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * GET `/email/logs`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.getEmailLogs`
     *
     * **client:**
     * `authClient.email.logs`
     */
    getEmailLogs: createAuthEndpoint(
      "/email/logs",
      {
        method: "GET",
        query: z
          .object({
            userId: z.string().optional(),
            status: z
              .enum([
                "pending",
                "sent",
                "delivered",
                "opened",
                "clicked",
                "bounced",
                "complained",
                "failed",
                "delivery_delayed",
              ])
              .optional(),
            provider: z.enum(["resend", "sendgrid", "brevo"]).optional(),
            limit: z.string().transform(Number).optional(),
            offset: z.string().transform(Number).optional(),
          })
          .optional(),
        use: [requireAbility({ action: "read", subject: "emailLogs" })],
      },
      async (ctx) => {
        const query: GetEmailLogsQuery = {
          userId: ctx.query?.userId || ctx.context?.session?.user?.id,
          status: ctx.query?.status,
          provider: ctx.query?.provider,
          limit: ctx.query?.limit || 50,
          offset: ctx.query?.offset || 0,
        }

        const whereConditions: Array<{
          field: string
          value: string | number | boolean
        }> = []

        // if (query.userId) {
        //   whereConditions.push({ field: "userId", value: query.userId });
        // }

        if (query.status) {
          whereConditions.push({ field: "status", value: query.status })
        }

        if (query.provider) {
          whereConditions.push({ field: "provider", value: query.provider })
        }

        const emailLogs = await ctx.context.adapter.findMany<DatabaseEmailLog>({
          model: "emailLog",
          where: whereConditions,
          limit: query.limit,
          offset: query.offset,
          sortBy: { field: "createdAt", direction: "desc" },
          select: ["id", "provider", "subject", "toAddress", "status_state"],
        })

        return {
          success: true,
          emailLogs,
          count: emailLogs.length,
          query,
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * GET `/email/stats`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.getEmailStats`
     *
     * **client:**
     * `authClient.email.stats`
     */
    getEmailStats: createAuthEndpoint(
      "/email/stats",
      {
        method: "GET",
        query: z
          .object({
            userId: z.string().optional(),
            provider: z.enum(["resend", "sendgrid", "brevo"]).optional(),
          })
          .optional(),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const userId = ctx.query?.userId || ctx.context.session.user.id
        const whereConditions = [{ field: "userId", value: userId }]

        if (ctx.query?.provider) {
          whereConditions.push({
            field: "provider",
            value: ctx.query.provider,
          })
        }

        const emailLogs = await ctx.context.adapter.findMany<DatabaseEmailLog>({
          model: "emailLog",
          where: whereConditions,
        })

        const stats: EmailStats = calculateEmailStats(emailLogs as EmailLog[])

        return {
          success: true,
          stats,
          userId,
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * POST `/email/send-system`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.sendSystemEmail`
     *
     * System-level email sending (no authentication required)
     * Used by auth flows like verification, welcome, reset emails
     */
    sendSystemEmail: createAuthEndpoint(
      "/email/send-system",
      {
        method: "POST",
        body: z
          .object({
            to: z.array(
              z.object({ email: z.email(), name: z.string().optional() })
            ),
            from: z
              .object({
                email: z.email(),
                name: z.string().optional(),
              })
              .optional(),
            subject: z.string().min(1),
            html: z.string().optional(),
            text: z.string().optional(),
            cc: z
              .array(
                z.object({ email: z.email(), name: z.string().optional() })
              )
              .optional(),
            bcc: z
              .array(
                z.object({ email: z.email(), name: z.string().optional() })
              )
              .optional(),
            replyTo: z
              .object({
                email: z.email(),
                name: z.string().optional(),
              })
              .optional(),
            tags: z
              .array(
                z.object({
                  name: z.string(),
                  value: z.string(),
                })
              )
              .optional(),
            attachments: z
              .array(
                z.object({
                  url: z.string().optional(),
                  filename: z.string(),
                  content: z.union([z.string(), z.instanceof(Buffer)]),
                  contentType: z.string().optional(),
                })
              )
              .optional(),
            provider: z.enum(["resend", "sendgrid", "brevo"]).optional(),
          })
          .refine((data) => data.html || data.text, {
            message: "Either html or text content is required",
            path: ["content"],
          }),
      },
      async (ctx) => {
        try {
          // Validate email addresses
          const toEmails = validateEmailArray(
            ctx.body.to.map((email) => email.email)
          )
          const ccEmails = ctx.body.cc
            ? validateEmailArray(ctx.body.cc.map((email) => email.email))
            : undefined
          const bccEmails = ctx.body.bcc
            ? validateEmailArray(ctx.body.bcc.map((email) => email.email))
            : undefined

          // Use provided from address or default
          const fromAddress = ctx.body.from || options?.fromAddress
          if (!fromAddress) {
            throw createValidationError(
              "BAD_REQUEST",
              "From address is required",
              EMAIL_ERROR_CODES.INVALID_EMAIL_ADDRESS
            )
          }

          const replyTo = ctx.body.replyTo || options?.replyToAddress

          // Get adapter
          const adapter = ctx.body.provider
            ? adapters.get(ctx.body.provider) || getDefaultAdapter()
            : getDefaultAdapter()

          // Prepare email request
          const emailRequest: SendEmailRequest = {
            to: ctx.body.to,
            ...(fromAddress && {
              from:
                typeof fromAddress === "string"
                  ? { email: fromAddress }
                  : fromAddress,
            }),
            subject: ctx.body.subject,
            html: ctx.body.html,
            text: ctx.body.text,
            cc: ctx.body.cc,
            bcc: ctx.body.bcc,
            ...(replyTo && {
              replyTo:
                typeof replyTo === "string" ? { email: replyTo } : replyTo,
            }),
            tags: ctx.body.tags,
            attachments: ctx.body.attachments,
          }

          // Prepare email log data first (before sending)
          const emailLogId = generateEmailId()
          const contentType = determineContentType(ctx.body.html, ctx.body.text)

          const emailLogData: InputEmailLog = {
            fromAddress:
              typeof fromAddress === "string" ? fromAddress : fromAddress.email,
            toAddress: arrayToString(toEmails) || toEmails[0],
            ccAddress: arrayToString(ccEmails),
            bccAddress: arrayToString(bccEmails),
            replyToAddress:
              typeof replyTo === "string" ? replyTo : replyTo?.email,
            subject: ctx.body.subject,
            content: sanitizeEmailContent(ctx.body.html || ctx.body.text || ""),
            contentType,
            status_state: "pending",
            provider: adapter.name,
            // tags: ctx.body.tags ? JSON.stringify(ctx.body.tags) : undefined,
          }

          // Send email
          const sendResult = await adapter.adapter.sendEmail(emailRequest)

          // Update email log data based on send result
          if (sendResult.success) {
            // Success: save provider ID (message ID) and mark as sent
            emailLogData.providerId = sendResult.providerId
            emailLogData.status_state = "sent"
            emailLogData.sentAt = new Date()
          } else {
            // Failure: log the error and mark as failed
            emailLogData.status_state = "failed"
            emailLogData.failedAt = new Date()
            // emailLogData.errorMessage =
            //   sendResult.error || "Failed to send email";
          }

          // Create email log entry (for both success and failure)
          const emailLog = await ctx.context.adapter.create<DatabaseEmailLog>({
            model: "emailLog",
            data: {
              ...emailLogData,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })

          // Set the ID after creation
          ;(emailLog as DatabaseEmailLog).id = emailLogId

          // If send failed, throw error after logging
          if (!sendResult.success) {
            throw createValidationError(
              "INTERNAL_SERVER_ERROR",
              sendResult.error || "Failed to send email",
              EMAIL_ERROR_CODES.SEND_FAILED
            )
          }

          return {
            success: true,
            emailId: emailLog.id,
            providerId: sendResult.providerId,
            message: "Email sent successfully",
          }
        } catch (error) {
          console.log("[EMAIL] Error sending email:", error)

          if (error instanceof APIError) {
            throw error
          }

          throw createValidationError(
            "INTERNAL_SERVER_ERROR",
            error instanceof Error ? error.message : "Unknown error occurred",
            EMAIL_ERROR_CODES.SEND_FAILED
          )
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * POST `/email/webhook`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.handleEmailWebhook`
     *
     * Handles webhooks from email providers to update email status
     */
    handleEmailWebhook: createAuthEndpoint(
      "/email/webhook",
      {
        method: "POST",
        metadata: { isAction: false },
        cloneRequest: true,
        disableBody: true, // use raw body for signature verification
      },
      async (ctx) => {
        console.log("[EMAIL WEBHOOK] Received webhook request")

        const body = await ctx?.request?.text()
        if (!body) {
          console.error("[EMAIL WEBHOOK] No request body provided")
          throw new APIError("BAD_REQUEST", {
            message: "No request body provided",
          })
        }

        let payload: any
        try {
          payload = JSON.parse(body)
          console.log(
            "[EMAIL WEBHOOK] Parsed payload:",
            JSON.stringify(payload, null, 2)
          )
        } catch (err) {
          console.error("[EMAIL WEBHOOK] Invalid JSON payload", err)
          throw new APIError("BAD_REQUEST", {
            message: "Invalid JSON payload",
          })
        }

        const adapter = ctx?.query?.provider
          ? adapters.get(ctx?.query?.provider) || getDefaultAdapter()
          : getDefaultAdapter()

        console.log("Adapter -------------> ", adapter)

        // --- Normalize webhook into unified format ---
        const normalized = adapter.adapter.parseWebhookData(payload)

        if (!normalized.email_id) {
          console.error(
            "[EMAIL WEBHOOK] No message ID found in webhook payload"
          )
          throw new APIError("BAD_REQUEST", {
            message: "No message ID found in webhook payload",
          })
        }

        // --- Find the email log by providerId ---
        const emailLog = await ctx.context.adapter.findOne<DatabaseEmailLog>({
          model: "emailLog",
          where: [{ field: "providerId", value: normalized.email_id }],
        })

        if (!emailLog) {
          console.warn(
            `[EMAIL WEBHOOK] No email log found for message ID: ${normalized.email_id}`
          )
          return {
            success: true,
            message: "Webhook received but no matching email log found",
            messageId: normalized.email_id,
            status: normalized.status_state,
          }
        }

        // --- Prepare update data ---
        const updateData: Partial<DatabaseEmailLog> = {
          status_state: normalized.status_state,
          status_reason: normalized.status_reason || undefined,
          smtp_response: normalized.smtp_response || undefined,
          meta: JSON.stringify(normalized.meta),
          raw_payload: JSON.stringify(normalized.raw_payload),
          ...(normalized.status_state === "email.sent" && {
            sentAt: new Date(normalized.timestamp),
          }),
          ...(normalized.status_state === "email.delivered" && {
            deliveredAt: new Date(normalized.timestamp),
          }),
          ...(normalized.status_state === "email.opened" && {
            openedAt: new Date(normalized.timestamp),
          }),
          ...(normalized.status_state === "email.clicked" && {
            clickedAt: new Date(normalized.timestamp),
          }),
          ...(normalized.status_state === "email.bounced" && {
            bouncedAt: new Date(normalized.timestamp),
          }),
          ...(normalized.status_state === "email.complained" && {
            complainedAt: new Date(normalized.timestamp),
          }),
          ...(normalized.status_state === "email.failed" && {
            failedAt: new Date(normalized.timestamp),
          }),
          updatedAt: new Date(),
        }

        // --- Update the email log ---
        const updatedEmailLog =
          await ctx.context.adapter.update<DatabaseEmailLog>({
            model: "emailLog",
            where: [{ field: "id", value: emailLog.id }],
            update: updateData,
          })

        console.log(
          "[EMAIL WEBHOOK] Successfully updated email log:",
          emailLog.id
        )

        return {
          success: true,
          message: "Email status updated successfully",
          emailId: emailLog.id,
          messageId: normalized.email_id,
          status: normalized.status_state,
          updated: !!updatedEmailLog,
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * POST `/email/template`
     *
     * Create a new email template
     */
    createTemplate: createAuthEndpoint(
      "/email/template",
      {
        method: "POST",
        body: z.object({
          name: z.string().min(1).max(255),
          model: z.string().min(1).max(255),
          event: z.string().min(1).max(255),
          criteria: z.object(z.any()).optional(),
          subject: z.string().min(1),
          to: z.string().min(1),
          cc: z.string().optional(),
          bcc: z.string().optional(),
          bodyType: z.enum(["html", "text"]),
          body: z.string().min(1),
        }),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const templateData = {
          id: crypto.randomUUID(),
          name: ctx.body.name,
          model: ctx.body.model,
          event: ctx.body.event,
          criteria: ctx.body.criteria
            ? JSON.stringify(ctx.body.criteria)
            : null,
          subject: ctx.body.subject,
          to: ctx.body.to,
          cc: ctx.body.cc || null,
          bcc: ctx.body.bcc || null,
          bodyType: ctx.body.bodyType,
          body: ctx.body.body,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const template = await ctx.context.adapter.create({
          model: "emailTemplate",
          data: templateData,
        })

        return { success: true, template }
      }
    ),

    /**
     * ### Endpoint
     *
     * GET `/email/template`
     *
     * List all email templates
     */
    listTemplate: createAuthEndpoint(
      "/email/templates",
      {
        method: "GET",
        query: z
          .object({
            limit: z.string().transform(Number).optional(),
            offset: z.string().transform(Number).optional(),
            model: z.string().optional(),
            event: z.string().optional(),
          })
          .optional(),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const whereConditions: Array<{ field: string; value: string }> = []

        if (ctx.query?.model) {
          whereConditions.push({ field: "model", value: ctx.query.model })
        }
        if (ctx.query?.event) {
          whereConditions.push({ field: "event", value: ctx.query.event })
        }

        const templates = await ctx.context.adapter.findMany({
          model: "emailTemplate",
          where: whereConditions,
          limit: ctx.query?.limit || 50,
          offset: ctx.query?.offset || 0,
          sortBy: { field: "createdAt", direction: "desc" },
        })

        // Parse criteria JSON for each template
        const parsedTemplates = templates.map((t: any) => ({
          ...t,
          criteria: t.criteria ? JSON.parse(t.criteria) : null,
        }))

        return {
          success: true,
          templates: parsedTemplates,
          count: templates.length,
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * GET `/email/template/:id`
     *
     * Get a single email template
     */
    getTemplate: createAuthEndpoint(
      "/email/template/:id",
      {
        method: "GET",
        metadata: { params: ["id"] },
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const template = await ctx.context.adapter.findOne({
          model: "emailTemplate",
          where: [{ field: "id", value: ctx.params.id }],
        })

        if (!template) {
          throw createValidationError("NOT_FOUND", "Email template not found")
        }

        return {
          success: true,
          template: {
            ...template,
            criteria: (template as any).criteria
              ? JSON.parse((template as any).criteria)
              : null,
          },
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * PATCH `/email/template/:id`
     *
     * Update an email template
     */
    updateTemplate: createAuthEndpoint(
      "/email/template/:id",
      {
        method: "PATCH",
        metadata: { params: ["id"] },
        body: z.object({
          name: z.string().min(1).max(255).optional(),
          model: z.string().min(1).max(255).optional(),
          event: z.string().min(1).max(255).optional(),
          criteria: z.object(z.any()).optional(),
          subject: z.string().min(1).optional(),
          to: z.string().min(1).optional(),
          cc: z.string().optional(),
          bcc: z.string().optional(),
          bodyType: z.enum(["html", "text"]).optional(),
          body: z.string().min(1).optional(),
        }),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const existing = await ctx.context.adapter.findOne({
          model: "emailTemplate",
          where: [{ field: "id", value: ctx.params.id }],
        })

        if (!existing) {
          throw createValidationError("NOT_FOUND", "Email template not found")
        }

        const updateData: any = { updatedAt: new Date() }
        if (ctx.body.name !== undefined) updateData.name = ctx.body.name
        if (ctx.body.model !== undefined) updateData.model = ctx.body.model
        if (ctx.body.event !== undefined) updateData.event = ctx.body.event
        if (ctx.body.criteria !== undefined)
          updateData.criteria = JSON.stringify(ctx.body.criteria)
        if (ctx.body.subject !== undefined)
          updateData.subject = ctx.body.subject
        if (ctx.body.to !== undefined) updateData.to = ctx.body.to
        if (ctx.body.cc !== undefined) updateData.cc = ctx.body.cc
        if (ctx.body.bcc !== undefined) updateData.bcc = ctx.body.bcc
        if (ctx.body.bodyType !== undefined)
          updateData.bodyType = ctx.body.bodyType
        if (ctx.body.body !== undefined) updateData.body = ctx.body.body

        const updated = await ctx.context.adapter.update({
          model: "emailTemplate",
          where: [{ field: "id", value: ctx.params.id }],
          update: updateData,
        })

        return {
          success: true,
          template: {
            ...(updated as any),
            criteria: (updated as any).criteria
              ? JSON.parse((updated as any).criteria)
              : null,
          },
        }
      }
    ),

    /**
     * ### Endpoint
     *
     * DELETE `/email/template/:id`
     *
     * Delete an email template
     */
    deleteTemplate: createAuthEndpoint(
      "/email/template/:id",
      {
        method: "DELETE",
        metadata: { params: ["id"] },
        use: [sessionMiddleware],
      },
      async (ctx) => {
        const existing = await ctx.context.adapter.findOne({
          model: "emailTemplate",
          where: [{ field: "id", value: ctx.params.id }],
        })

        if (!existing) {
          throw createValidationError("NOT_FOUND", "Email template not found")
        }

        await ctx.context.adapter.delete({
          model: "emailTemplate",
          where: [{ field: "id", value: ctx.params.id }],
        })

        return { success: true, message: "Email template deleted" }
      }
    ),

    /**
     * ### Endpoint
     *
     * GET `/email/models`
     *
     * List all available models from the drizzle schema
     */
    listModels: createAuthEndpoint(
      "/email/models",
      {
        method: "GET",
        metadata: { isPublic: true },
      },
      async (ctx) => {
        type FieldInfo = {
          name: string
          type: string
          notNull: boolean
          hasDefault: boolean
          isRelation?: boolean
        }

        type ModelDetail = {
          name: string
          tableName: string
          fields: FieldInfo[]
        }

        // First pass: collect all table configs keyed by their DB table name
        // so we can resolve FK references back to JS export names
        const tableNameToExportKey = new Map<string, string>()

        for (const [key, value] of Object.entries(schema)) {
          if (!value || typeof value !== "object") continue
          try {
            const config = getTableConfig(value as any)
            tableNameToExportKey.set(config.name, key)
          } catch {
            // not a table, skip
          }
        }

        // Second pass: build full model details including relations
        const modelDetails: ModelDetail[] = []

        for (const [key, value] of Object.entries(schema)) {
          if (!value || typeof value !== "object") continue

          try {
            const config = getTableConfig(value as any)

            // Scalar columns
            const fields: FieldInfo[] = config.columns.map((col) => ({
              name: col.name,
              type: col.dataType,
              notNull: col.notNull,
              hasDefault: col.hasDefault,
              isRelation: false,
            }))

            // Relation fields derived from foreign keys
            // for (const fk of config.foreignKeys) {
            //   try {
            //     // fk.reference() returns the referenced columns array
            //     const referencedColumns = fk.reference()
            //     if (!referencedColumns?.length || 0) continue

            //     // Get the table the FK points to
            //     const referencedTable = (referencedColumns[0] as any).table
            //     const referencedTableConfig = getTableConfig(referencedTable)
            //     const referencedTableName = referencedTableConfig.name

            //     // Resolve back to the JS export key (e.g. "user", "session")
            //     const relatedModelKey =
            //       tableNameToExportKey.get(referencedTableName)
            //     if (!relatedModelKey) continue

            //     // Derive a friendly relation field name from the FK column
            //     // e.g. userId → user, organizationId → organization
            //     const fkColName = fk.columns[0]?.name ?? ""
            //     const relationFieldName = fkColName
            //       .replace(/([A-Z])/g, "_$1")
            //       .toLowerCase()
            //       .replace(/_id$/, "")
            //       .replace(/^_/, "")
            //       // camelCase back: user_profile → userProfile
            //       .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

            //     // Avoid duplicating if a field with this name already exists
            //     if (!fields.some((f) => f.name === relationFieldName)) {
            //       fields.push({
            //         name: relationFieldName,
            //         type: relatedModelKey, // e.g. "user" — matches another model's export key
            //         notNull: false,
            //         hasDefault: false,
            //         isRelation: true,
            //       })
            //     }
            //   } catch {
            //     // skip malformed FK
            //   }
            // }

            modelDetails.push({
              name: key,
              tableName: config.name,
              fields,
            })
          } catch {
            // not a drizzle table, skip (relations objects, enums, etc.)
          }
        }

        return { success: true, models: modelDetails }
      }
    ),
  }

  return {
    id: "email",
    endpoints: emailEndpoints,
    schema: getSchema() as any,
    // Note: Welcome email functionality can be added separately
    // in the auth configuration where the proper context is available
  } satisfies BetterAuthPlugin
}

/**
 * Server-side email service for system use
 * Can be used by auth flows and other server-side code
 */
export class EmailService {
  private static instance: EmailService
  private baseUrl: string

  private constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public static getInstance(baseUrl?: string): EmailService {
    if (!baseUrl && !process.env.BETTER_AUTH_URL) {
      throw new Error(
        "Base URL must be provided or BETTER_AUTH_URL environment variable must be set"
      )
    }
    if (!EmailService.instance) {
      EmailService.instance = new EmailService(
        baseUrl || process.env.BETTER_AUTH_URL || ""
      )
    }
    return EmailService.instance
  }

  async sendSystemEmail(emailData: {
    to: {
      email: string
      name?: string
    }[]
    from?: {
      email: string
      name?: string
    }
    subject: string
    html?: string
    text?: string
    cc?: {
      email: string
      name?: string
    }[]
    bcc?: {
      email: string
      name?: string
    }[]
    replyTo?: {
      email: string
      name?: string
    }
    systemUsage?: string
  }) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/auth/email/send-system`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailData),
        }
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Unknown error" }))
        throw new Error(
          (typeof errorData === "object" &&
          errorData !== null &&
          "message" in errorData
            ? (errorData as { message?: string }).message
            : undefined) || `HTTP ${response.status}`
        )
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to send email:", error)
      throw error
    }
  }

  async sendEmail(emailData: {
    to: {
      email: string
      name?: string
    }[]
    from?: {
      email: string
      name?: string
    }
    subject: string
    html?: string
    text?: string
    cc?: {
      email: string
      name?: string
    }[]
    bcc?: {
      email: string
      name?: string
    }[]
    replyTo?: {
      email: string
      name?: string
    }
    systemUsage?: string
  }) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Unknown error" }))
        throw new Error(
          (typeof errorData === "object" &&
          errorData !== null &&
          "message" in errorData
            ? (errorData as { message?: string }).message
            : undefined) || `HTTP ${response.status}`
        )
      }
      return await response.json()
    } catch (error) {
      console.error("Failed to send email:", error)
      throw error
    }
  }

  // Convenience methods for auth flows
  async sendVerificationEmail(
    user: { email: string; name?: string },
    verificationUrl: string
  ) {
    return this.sendSystemEmail({
      to: [
        {
          email: user.email,
          name: user.name,
        },
      ],
      subject: "Verify your email address",
      html: verificationEmailTemplate(user, verificationUrl),
      systemUsage: "email-verification",
    })
  }

  async sendWelcomeEmail(user: { email: string; name?: string }) {
    return this.sendSystemEmail({
      to: [
        {
          email: user.email,
          name: user.name,
        },
      ],
      subject: "Welcome! Your account is verified",
      html: welcomeEmailTemplate(user),
      systemUsage: "welcome-email",
    })
  }

  async sendPasswordResetEmail(
    user: { email: string; name?: string },
    resetUrl: string
  ) {
    return this.sendSystemEmail({
      to: [
        {
          email: user.email,
          name: user.name,
        },
      ],
      subject: "Reset your password",
      html: passwordResetEmailTemplate(user, resetUrl),
      systemUsage: "password-reset",
    })
  }
}

// Email templates
const verificationEmailTemplate = (
  user: { name?: string; email: string },
  verifyUrl: string
) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Verify Your Email Address</h2>
  <p>Hi ${user.name || user.email.split("@")[0]},</p>
  <p>Please verify your email address by clicking the button below:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${verifyUrl}" 
       style="background-color: #007bff; color: white; padding: 12px 24px; 
              text-decoration: none; border-radius: 4px; display: inline-block;">
      Verify Email
    </a>
  </div>
  <p>This verification link will expire in 24 hours for security purposes.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    If the button doesn't work, copy and paste this link into your browser:
    <br>
    <a href="${verifyUrl}">${verifyUrl}</a>
  </p>
</div>
`

const welcomeEmailTemplate = (user: { name?: string; email: string }) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Welcome to Our Platform!</h2>
  <p>Hi ${user.name || user.email.split("@")[0]},</p>
  <p>Your email has been successfully verified and your account is ready to use.</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${process.env.BETTER_AUTH_URL}/dashboard" 
       style="background-color: #28a745; color: white; padding: 12px 24px; 
              text-decoration: none; border-radius: 4px; display: inline-block;">
      Get Started
    </a>
  </div>
  <p>Thank you for joining us!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    If you have any questions, feel free to contact our support team.
  </p>
</div>
`

const passwordResetEmailTemplate = (
  user: { name?: string; email: string },
  resetUrl: string
) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Reset Your Password</h2>
  <p>Hi ${user.name || user.email.split("@")[0]},</p>
  <p>We received a request to reset your password. Click the button below to create a new password:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" 
       style="background-color: #dc3545; color: white; padding: 12px 24px; 
              text-decoration: none; border-radius: 4px; display: inline-block;">
      Reset Password
    </a>
  </div>
  <p>This reset link will expire in 15 minutes for security purposes.</p>
  <p>If you didn't request this password reset, please ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    If the button doesn't work, copy and paste this link into your browser:
    <br>
    <a href="${resetUrl}">${resetUrl}</a>
  </p>
</div>
`

export * from "./types"
export * from "./utils"
export { EMAIL_ERROR_CODES }
