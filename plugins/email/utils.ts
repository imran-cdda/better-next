import crypto from "crypto"
import type {
  EmailContentType,
  EmailLog,
  EmailStatus,
  ResendWebhookPayload,
  WebhookEvent,
} from "./types"

/**
 * Generate a unique ID for email logs
 */
export function generateEmailId(): string {
  return `email_${crypto.randomUUID()}`
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate email addresses in an array
 */
export function validateEmailArray(emails: string | string[]): string[] {
  const emailArray = Array.isArray(emails) ? emails : [emails]
  const invalidEmails = emailArray.filter((email) => !isValidEmail(email))

  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(", ")}`)
  }

  return emailArray
}

/**
 * Determine content type based on provided content
 */
export function determineContentType(
  html?: string,
  text?: string
): EmailContentType {
  if (html && text) return "mixed"
  if (html) return "html"
  if (text) return "text"
  throw new Error("Either html or text content is required")
}

/**
 * Convert arrays to comma-separated strings for database storage
 */
export function arrayToString(arr?: string[]): string | undefined {
  return arr && arr.length > 0 ? arr.join(",") : undefined
}

/**
 * Convert comma-separated strings to arrays
 */
export function stringToArray(str?: string): string[] | undefined {
  return str ? str.split(",").filter(Boolean) : undefined
}

/**
 * Convert webhook event to email log status
 */
export function webhookEventToStatus(eventType: string): EmailStatus {
  switch (eventType) {
    case "email.sent":
      return "sent"
    case "email.delivered":
      return "delivered"
    case "email.opened":
      return "opened"
    case "email.clicked":
      return "clicked"
    case "email.bounced":
      return "bounced"
    case "email.complained":
      return "complained"
    case "email.failed":
      return "failed"
    case "email.delivery_delayed":
      return "delivery_delayed"
    default:
      return "pending"
  }
}

/**
 * Extract timestamp from webhook event
 */
export function extractEventTimestamp(event: WebhookEvent): Date {
  return new Date(event.timestamp)
}

/**
 * Verify webhook signature using Svix library (used by Resend)
 */
export function verifyWebhookSignature(
  payload: string,
  headers: Record<string, string | null>,
  secret: string
): boolean {
  try {
    // Import Svix library dynamically to avoid issues
    const { Webhook } = require("svix")

    const wh = new Webhook(secret)

    // Extract Svix headers
    const svixHeaders = {
      "svix-provider": headers["svix-provider"],
      "svix-id": headers["svix-id"],
      "svix-timestamp": headers["svix-timestamp"],
      "svix-signature": headers["svix-signature"],
    }

    // Check if all required headers are present
    if (
      !svixHeaders["svix-provider"] ||
      !svixHeaders["svix-id"] ||
      !svixHeaders["svix-timestamp"] ||
      !svixHeaders["svix-signature"]
    ) {
      console.error("Missing required Svix headers:", svixHeaders)
      return false
    }

    // Verify the webhook - throws on error, returns verified content on success
    wh.verify(payload, svixHeaders)
    console.log("Webhook signature verified successfully")
    return true
  } catch (error) {
    console.error("Webhook signature verification error:", error)
    // If Svix is not available, log warning but allow webhook (for development)
    if (
      error instanceof Error &&
      error.message?.includes("Cannot find module 'svix'")
    ) {
      console.warn(
        "Svix library not found - webhook signature verification disabled"
      )
      return true // Allow in development
    }
    return false
  }
}

/**
 * Parse Resend webhook payload
 */
export function parseResendWebhook(
  payload: ResendWebhookPayload
): Partial<EmailLog> {
  const status = webhookEventToStatus(payload.type)
  const timestamp = new Date(payload.created_at)

  // Resend webhooks can have either 'id' or 'email_id' field
  const messageId = payload.data.id || payload.data.email_id

  if (!messageId) {
    throw new Error("No message ID found in webhook payload")
  }

  const updateData: Partial<EmailLog> = {
    status_state: status,
    providerId: messageId,
    updatedAt: timestamp,
  }

  // Set specific timestamp fields based on event type
  switch (payload.type) {
    case "email.sent":
      updateData.sentAt = timestamp
      break
    case "email.delivered":
      updateData.deliveredAt = timestamp
      break
    case "email.opened":
      updateData.openedAt = timestamp
      break
    case "email.clicked":
      updateData.clickedAt = timestamp
      break
    case "email.bounced":
      updateData.bouncedAt = timestamp
      if (payload.data.bounce_type) {
        updateData.status_reason = `Bounced: ${payload.data.bounce_type}`
      }
      break
    case "email.complained":
      updateData.complainedAt = timestamp
      if (payload.data.complaint_type) {
        updateData.status_reason = `Complained: ${payload.data.complaint_type}`
      }
      break
    case "email.failed":
      updateData.failedAt = timestamp
      updateData.status_reason = "Email delivery failed"
      break
  }

  return updateData
}

/**
 * Sanitize email content for database storage
 */
export function sanitizeEmailContent(content: string): string {
  // Remove null bytes and normalize whitespace
  return content.replace(/\0/g, "").trim()
}

/**
 * Calculate email statistics
 */
export function calculateEmailStats(emailLogs: EmailLog[]) {
  const total = emailLogs.length
  const sent = emailLogs.filter(
    (log) => log.status_state === "sent" || log.status_state === "delivered"
  ).length
  const delivered = emailLogs.filter(
    (log) => log.status_state === "delivered"
  ).length
  const opened = emailLogs.filter((log) => log.status_state === "opened").length
  const clicked = emailLogs.filter(
    (log) => log.status_state === "clicked"
  ).length
  const bounced = emailLogs.filter(
    (log) => log.status_state === "bounced"
  ).length
  const complained = emailLogs.filter(
    (log) => log.status_state === "complained"
  ).length
  const failed = emailLogs.filter((log) => log.status_state === "failed").length

  return {
    total,
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    failed,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
  }
}
