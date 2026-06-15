import { email } from "./../../index";
import { CreateEmailOptions, Resend } from "resend";
import { EmailAdapter, EmailAttachment, EmailProvider } from "./types";
import { baseAdapter } from "../base";
import { SendEmailRequest, SendEmailResponse, WebhookData } from "../types";

/**
 * Resend email adapter implementation
 */
export class ResendEmailAdapter extends baseAdapter {
  private apiKey: string = process.env.RESEND_API_KEY || "";
  private resend;

  constructor() {
    super("resend");
    this.resend = new Resend(this.apiKey);
  }

  async sendEmail(email: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      // Build email data with required fields
      const emailData = {
        from: email?.from?.email,
        to: email.to.map((t) => t.email),
        subject: email.subject,
        ...(email.html ? { html: email.html } : {}),
        ...(email.text ? { text: email.text } : {}),
        ...(email.cc ? { cc: email.cc.map((c) => c.email) } : {}),
        ...(email.bcc ? { bcc: email.bcc.map((b) => b.email) } : {}),
        ...(email.replyTo ? { replyTo: email.replyTo.email } : {}),
        ...(email.tags ? { tags: email.tags } : {}),
        ...(email.attachments
          ? {
              attachments: email.attachments.map((att: EmailAttachment) => ({
                filename: att.filename,
                content: att.content,
                react: false,
                ...(att.contentType ? { content_type: att.contentType } : {}),
              })),
            }
          : {}),
      };

      const response = await this.resend.emails.send(
        emailData as unknown as CreateEmailOptions
      );

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
        };
      }

      return {
        success: true,
        id: response.data?.id,
        providerId: response.data?.id,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async sendBulkEmails(
    emails: SendEmailRequest[]
  ): Promise<SendEmailResponse[]> {
    const results: SendEmailResponse[] = [];

    // Process emails in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map((email) => this.sendEmail(email));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown error",
          });
        }
      }
    }

    return results;
  }

  parseWebhookData(data: any): WebhookData {
    return {
      provider: "resend",
      event_type: data.type,
      email_id: data.email_id,
      recipient: data.to,
      timestamp: data.timestamp,
      status_state: data.type,
      status_reason: data.reason ?? null,
      smtp_response: data.smtp_response ?? null,
      meta: { ip: data.ip, tags: data.tags ?? [] },
      raw_payload: data,
    };
  }
}
