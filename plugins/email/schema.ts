import { z } from "zod"

export function getSchema() {
  return {
    emailLog: {
      fields: {
        provider: { type: "string", required: true }, // resend, sendgrid, brevo, etc.
        providerId: { type: "string", required: false }, // provider-specific message ID
        fromAddress: { type: "string", required: true },
        toAddress: { type: "string", required: true },
        ccAddress: { type: "string", required: false },
        bccAddress: { type: "string", required: false },
        replyToAddress: { type: "string", required: false },
        subject: { type: "string", required: true },
        content: { type: "string", required: true },
        contentType: { type: "string", required: true },
        status_state: { type: "string", required: true }, // delivered, bounced, opened, clicked, failed
        status_reason: { type: "string", required: false }, // bounce reason or error
        smtp_response: { type: "string", required: false },
        sentAt: { type: "date", required: false },
        deliveredAt: { type: "date", required: false },
        openedAt: { type: "date", required: false },
        clickedAt: { type: "date", required: false },
        bouncedAt: { type: "date", required: false },
        complainedAt: { type: "date", required: false },
        failedAt: { type: "date", required: false },
        meta: { type: "string", required: false }, // JSON string for tags, IP, campaign, etc.
        raw_payload: { type: "string", required: false }, // original webhook JSON
        userId: { type: "string", required: false },
        createdAt: { type: "date", required: true },
        updatedAt: { type: "date", required: true },
      },
    },
    emailTemplate: {
      fields: {
        name: { type: "string", required: true },
        model: { type: "string", required: true },
        event: { type: "string", required: true },
        criteria: { type: "string", required: false },
        subject: { type: "string", required: true },
        to: { type: "string", required: true },
        cc: { type: "string", required: false },
        bcc: { type: "string", required: false },
        bodyType: { type: ["html", "text"], required: true },
        body: { type: "string", required: true },
        createdAt: { type: "date", required: true },
        updatedAt: { type: "date", required: true },
      },
    },
  } as const
}

// Validation schemas
export const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  from: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  replyTo: z.string().email().optional(),
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
        filename: z.string(),
        content: z.union([z.string(), z.instanceof(Buffer)]),
        contentType: z.string().optional(),
      })
    )
    .optional(),
})

export const bulkSendEmailSchema = z.object({
  emails: z.array(sendEmailSchema),
})

// Unified webhook event schema
export const webhookEventSchema = z.object({
  id: z.string(),
  provider: z.string(), // resend, sendgrid, brevo, etc.
  event_type: z.enum([
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.complained",
    "email.bounced",
    "email.opened",
    "email.clicked",
    "email.failed",
  ]),
  timestamp: z.string(), // ISO string
  recipient: z.string().email(),
  subject: z.string().optional(),
  message_id: z.string().optional(),
  status_state: z.string(), // delivered, bounced, opened, etc.
  status_reason: z.string().optional(),
  smtp_response: z.string().optional(),
  meta: z
    .object({
      tags: z.array(z.string()).optional(),
      campaign_id: z.string().optional(),
      template_id: z.string().optional(),
      ip: z.string().optional(),
      user_agent: z.string().optional(),
    })
    .optional(),
  raw_payload: z.any(), // original provider payload
})
