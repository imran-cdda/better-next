import { BrevoClient, Brevo } from "@getbrevo/brevo";
import {
  EmailAdapter,
  EmailProvider,
  SendEmailRequest,
  SendEmailResponse,
  WebhookData,
} from "../types";
import { baseAdapter } from "../base";
import {
  AddDomainResponse,
  BrevoEmailEvent,
  DomainResponse,
  EmailAttachment,
  EmailContact,
  EmailSendResponse,
  EmailStatisticsOptions,
  EmailStatusResponse,
  ScheduledBatchEmailConfig,
  ScheduledEmailConfig,
} from "./types";

export class BrevoEmailAdapter extends baseAdapter {
  private readonly api: BrevoClient;
  private readonly defaultSender?: EmailContact;
  private readonly baseDomain: string;
  private readonly apiKey: string;

  constructor(defaultSender?: EmailContact) {
    super("brevo");
    this.apiKey = process.env.BREVO_API_KEY ?? "";
    this.baseDomain =
      process.env.BREVO_BASE_DOMAIN ?? "https://api.brevo.com/v5";
    this.defaultSender = defaultSender;
    this.api = new BrevoClient({ apiKey: this.apiKey });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async executeRequest(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<{ success: boolean; data?: unknown; message?: string }> {
    try {
      const response = await fetch(`${this.baseDomain}${path}`, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        return { success: false, message: await response.text() };
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private validateScheduledDate(scheduledAt: string): void {
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error("Invalid scheduled date format. Use ISO 8601 format.");
    }
    if (scheduledDate <= new Date()) {
      throw new Error("Scheduled date must be in the future");
    }
  }

  /**
   * Validates fields common to both single and batch sends.
   * `messageVersions` is only present on batch payloads — when absent, `to`
   * must be non-empty.
   */
  private validateEmailData(
    emailData: Brevo.transactionalEmails.SendTransacEmailRequest & {
      messageVersions?: Array<{ to: EmailContact[] }>;
    },
  ): void {
    if (!emailData.sender?.email) {
      throw new Error("Sender email is required");
    }
    if (!this.isValidEmail(emailData.sender.email)) {
      throw new Error("Invalid sender email address");
    }

    const hasVersions =
      Array.isArray(emailData.messageVersions) &&
      emailData.messageVersions.length > 0;

    if (!hasVersions) {
      if (!emailData.to || emailData.to.length === 0) {
        throw new Error("At least one recipient is required");
      }
      for (const r of emailData.to) {
        if (!this.isValidEmail(r.email)) {
          throw new Error(`Invalid recipient email: ${r.email}`);
        }
      }
    }

    for (const r of emailData.cc ?? []) {
      if (!this.isValidEmail(r.email)) {
        throw new Error(`Invalid CC email: ${r.email}`);
      }
    }
    for (const r of emailData.bcc ?? []) {
      if (!this.isValidEmail(r.email)) {
        throw new Error(`Invalid BCC email: ${r.email}`);
      }
    }

    if (!emailData.subject && !emailData.templateId) {
      throw new Error("Subject is required when not using a template");
    }

    if (
      !emailData.htmlContent &&
      !emailData.textContent &&
      !emailData.templateId &&
      !hasVersions
    ) {
      throw new Error(
        "Either htmlContent, textContent, or templateId is required",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Core send methods (required by baseAdapter)
  // ---------------------------------------------------------------------------

  async sendEmail(email: SendEmailRequest): Promise<SendEmailResponse> {
    const payload: Brevo.transactionalEmails.SendTransacEmailRequest = {
      sender: email.from
        ? { email: email.from.email, name: email.from.name }
        : this.defaultSender,
      to: email.to as EmailContact[],
      cc: email.cc as EmailContact[] | undefined,
      bcc: email.bcc as EmailContact[] | undefined,
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      replyTo: email.replyTo as EmailContact | undefined,
      attachment: email.attachments?.map((att) => ({
        name: att.filename,
        // The Brevo SDK accepts base64 string or a URL — keep whichever is set.
        content:
          typeof att.content === "string"
            ? att.content
            : att.content.toString("base64"),
        url: att.url,
      })) as EmailAttachment[] | undefined,
      tags: email.tags?.map((t) => t.name),
    };

    this.validateEmailData(payload);

    try {
      const response =
        await this.api.transactionalEmails.sendTransacEmail(payload);
      return { success: true, providerId: response.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendBulkEmails(
    emails: SendEmailRequest[],
  ): Promise<SendEmailResponse[]> {
    const BATCH_SIZE = 10;
    const results: SendEmailResponse[] = [];

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const settled = await Promise.allSettled(
        emails.slice(i, i + BATCH_SIZE).map((e) => this.sendEmail(e)),
      );

      for (const result of settled) {
        results.push(
          result.status === "fulfilled"
            ? result.value
            : {
                success: false,
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : "Unknown error",
              },
        );
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Scheduled sends
  // ---------------------------------------------------------------------------

  async scheduleEmail(
    config: ScheduledEmailConfig,
  ): Promise<EmailSendResponse> {
    this.validateScheduledDate(config.scheduledAt);

    const payload: Brevo.transactionalEmails.SendTransacEmailRequest = {
      sender: config.sender ?? this.defaultSender,
      to: config.to,
      cc: config.cc,
      bcc: config.bcc,
      subject: config.subject,
      htmlContent: config.htmlContent,
      textContent: config.textContent,
      scheduledAt: config.scheduledAt,
      batchId: config.batchId,
      replyTo: config.replyTo,
      attachment: config.attachment,
      headers: config.headers,
      tags: config.tags,
      params: config.params,
    };

    this.validateEmailData(payload);

    const response =
      await this.api.transactionalEmails.sendTransacEmail(payload);
    return { messageId: response.messageId };
  }

  async scheduleBatchEmails(
    config: ScheduledBatchEmailConfig,
  ): Promise<EmailSendResponse> {
    this.validateScheduledDate(config.scheduledAt);

    if (config.messageVersions.length > 1000) {
      throw new Error("Maximum 1000 message versions allowed per batch");
    }

    // Batch sends with messageVersions use the same sendTransacEmail endpoint;
    // the versions array carries per-recipient overrides.
    const payload: Brevo.transactionalEmails.SendTransacEmailRequest & {
      messageVersions: ScheduledBatchEmailConfig["messageVersions"];
    } = {
      sender: config.sender ?? this.defaultSender,
      subject: config.subject,
      htmlContent: config.htmlContent,
      textContent: config.textContent,
      templateId: config.templateId,
      params: config.params,
      scheduledAt: config.scheduledAt,
      batchId: config.batchId,
      replyTo: config.replyTo,
      headers: config.headers,
      tags: config.tags,
      messageVersions: config.messageVersions,
    };

    this.validateEmailData(payload);

    const response = await this.api.transactionalEmails.sendTransacEmail(
      payload as Brevo.transactionalEmails.SendTransacEmailRequest,
    );
    // Batch responses may return an array of message IDs.
    return { messageIds: response.messageIds };
  }

  // ---------------------------------------------------------------------------
  // Reporting & management
  // ---------------------------------------------------------------------------

  async getScheduledEmailStatus(params?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    days?: number;
    email?: string;
    event?: BrevoEmailEvent;
    messageId?: string;
    sort?: "asc" | "desc";
  }): Promise<Brevo.GetEmailEventReportResponse.Events> {
    const response = await this.api.transactionalEmails.getEmailEventReport(
      params ?? {},
    );
    return response.events as Brevo.GetEmailEventReportResponse.Events;
  }

  async deleteScheduledEmail(identifier: string): Promise<void> {
    await this.api.transactionalEmails.deleteScheduledEmailById({ identifier });
  }

  async getEmailStatistics(
    options: EmailStatisticsOptions = {},
  ): Promise<unknown> {
    const response = await this.api.transactionalEmails.getTransacEmailsList({
      messageId: options.messageId,
      email: options.email,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit,
      offset: options.offset,
      sort: options.sort || "desc",
    });
    return response.transactionalEmails;
  }

  // ---------------------------------------------------------------------------
  // Domain management (REST — no SDK wrapper)
  // ---------------------------------------------------------------------------

  async addDomain(domain: string): Promise<AddDomainResponse> {
    const result = await this.executeRequest("/senders/domains", "POST", {
      name: domain,
    });
    return result.data as AddDomainResponse;
  }

  async getDomains(): Promise<DomainResponse> {
    const result = await this.executeRequest("/senders/domains", "GET");
    return result.data as DomainResponse;
  }

  async deleteDomain(domain: string): Promise<void> {
    await this.executeRequest(`/senders/domains/${domain}`, "DELETE");
  }

  async getBlockedDomains(): Promise<unknown> {
    const response = await this.api.transactionalEmails.getBlockedDomains();
    return response.domains;
  }

  // ---------------------------------------------------------------------------
  // Webhook parsing
  // ---------------------------------------------------------------------------

  parseWebhookData(data: any): WebhookData {
    return {
      provider: "brevo",
      event_type: `email.${data.event}`,
      email_id: data["message-id"],
      recipient: data.to,
      timestamp: String(data.ts),
      status_state: `email.${data.event}`,
      status_reason: data.reason ?? null,
      smtp_response: data.smtp_response ?? null,
      meta: {
        ip: data.ip,
        tags: data.tags ?? [],
        tag: data.tag ?? undefined,
      },
      raw_payload: data,
    };
  }

  // ---------------------------------------------------------------------------
  // Static factory helpers
  // ---------------------------------------------------------------------------

  static createAttachment(content: string, name: string): EmailAttachment {
    return { content, name };
  }

  static createAttachmentFromUrl(url: string, name?: string): EmailAttachment {
    return { url, name };
  }

  static formatScheduledDate(date: Date | number): string {
    return new Date(date).toISOString();
  }

  static scheduleInHours(hours: number): string {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  }

  static scheduleInDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }
}

export default BrevoEmailAdapter;
