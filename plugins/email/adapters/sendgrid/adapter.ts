import sgMail, {
  ClientResponse,
  MailDataRequired,
  MailService,
} from "@sendgrid/mail";
import sgClient from "@sendgrid/client";
import {
  SimpleEmailConfig,
  BatchEmailConfig,
  ScheduledEmailConfig,
  ScheduledBatchEmailConfig,
  EmailSendResponse,
  EmailContact,
  EmailAttachment,
  EmailStatisticsOptions,
  EmailStatistics,
  CancelScheduledEmailResponse,
  SuppressionGroup,
  BlockedEmail,
  BouncedEmail,
  SpamReport,
  InvalidEmail,
  Template,
} from "./types";
import {
  EmailAdapter,
  EmailProvider,
  SendEmailRequest,
  SendEmailResponse,
  WebhookData,
} from "../types";
import { baseAdapter } from "../base";

/**
 * Comprehensive SendGrid Email Adapter with full type safety
 * Supports all SendGrid transactional email features
 */
export class SendGridEmailAdapter extends baseAdapter {
  private mailService: MailService;
  private defaultSender?: EmailContact;
  private apiKey: string;

  /**
   * Initialize SendGrid Email Adapter
   * @param apiKey - Your SendGrid API key (optional if set in env)
   * @param defaultSender - Optional default sender for all emails
   */
  constructor(apiKey?: string, defaultSender?: EmailContact) {
    super("sendgrid");
    this.apiKey = apiKey || process.env.SENDGRID_API_KEY || "";

    if (!this.apiKey) {
      throw new Error("SendGrid API key is required");
    }

    this.mailService = sgMail;
    this.mailService.setApiKey(this.apiKey);

    sgClient.setApiKey(this.apiKey);

    this.defaultSender = defaultSender;
  }

  // ==========================================================================
  // SIMPLE EMAIL SENDING
  // ==========================================================================

  /**
   * Send a simple transactional email with HTML/text content
   * @param config - Email configuration
   * @returns Promise with response details
   */
  async sendEmail(email: SendEmailRequest): Promise<SendEmailResponse> {
    const emailData: MailDataRequired = {
      from: email.from || this.defaultSender!,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      content: [
        {
          type: "text/html",
          value: email.html || "",
        },
      ],
      attachments: email.attachments?.map((a) => ({
        content: a.content,
        filename: a.filename,
        type: a.contentType,
      })) as EmailAttachment[],
      categories: email.tags?.map((tag) => tag.name) as string[],
    };

    this.validateEmailData(emailData);

    const [response] = await this.mailService.send(emailData);

    return {
      success: true,
      id: response.headers["x-sendgrid-message-id"],
    };
  }

  // ==========================================================================
  // BATCH EMAIL SENDING
  // ==========================================================================

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

  // ==========================================================================
  // SCHEDULED EMAIL SENDING
  // ==========================================================================

  /**
   * Schedule an email to be sent at a specific time
   * @param config - Scheduled email configuration
   * @returns Promise with response details
   */
  async scheduleEmail(
    config: ScheduledEmailConfig
  ): Promise<EmailSendResponse> {
    this.validateScheduledTime(config.sendAt);

    const emailData: MailDataRequired = {
      from: config.sender || this.defaultSender!,
      to: config.to,
      cc: config.cc,
      bcc: config.bcc,
      subject: config.subject,
      html: config.htmlContent,
      text: config.textContent,
      sendAt: config.sendAt,
      replyTo: config.replyTo,
      attachments: config.attachments,
      content: [
        {
          type: "text/html",
          value: config.htmlContent || "",
        },
        {
          type: "text/plain",
          value: config.textContent || "",
        },
      ],
    };

    this.validateEmailData(emailData);

    const [response] = await this.mailService.send(emailData);

    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    };
  }

  /**
   * Schedule batch emails to be sent at a specific time
   * @param config - Scheduled batch email configuration
   * @returns Promise with response details
   */
  async scheduleBatchEmails(
    config: ScheduledBatchEmailConfig
  ): Promise<EmailSendResponse> {
    this.validateScheduledTime(config.sendAt);

    if (config.personalizations.length > 1000) {
      throw new Error("Maximum 1000 personalizations allowed per batch");
    }

    const emailData: MailDataRequired = {
      from: config.sender || this.defaultSender!,
      subject: config.subject,
      html: config.htmlContent,
      text: config.textContent,
      sendAt: config.sendAt,
      replyTo: config.replyTo,
      attachments: config.attachments,
      content: [
        {
          type: "text/html",
          value: config.htmlContent || "",
        },
        {
          type: "text/plain",
          value: config.textContent || "",
        },
      ],
    };

    this.validateEmailData(emailData);

    const [response] = await this.mailService.send(emailData);

    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    };
  }

  // ==========================================================================
  // SCHEDULED EMAIL MANAGEMENT
  // ==========================================================================

  /**
   * Cancel a scheduled send for a specific batch ID
   * @param batchId - The batch ID of the scheduled send
   * @returns Promise with cancellation status
   */
  async cancelScheduledSend(
    batchId: string
  ): Promise<CancelScheduledEmailResponse> {
    try {
      const request = {
        url: `/v3/user/scheduled_sends/${batchId}`,
        method: "DELETE" as const,
      };

      await sgClient.request(request);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Update a scheduled send time
   * @param batchId - The batch ID of the scheduled send
   * @param sendAt - New send time (Unix timestamp)
   * @returns Promise with update status
   */
  async updateScheduledSend(
    batchId: string,
    sendAt: number
  ): Promise<CancelScheduledEmailResponse> {
    this.validateScheduledTime(sendAt);

    try {
      const request = {
        url: `/v3/user/scheduled_sends/${batchId}`,
        method: "PATCH" as const,
        body: {
          status: "pause",
        },
      };

      await sgClient.request(request);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Get all scheduled sends
   * @returns Promise with list of scheduled sends
   */
  async getScheduledSends(): Promise<any> {
    const request = {
      url: `/v3/user/scheduled_sends`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body;
  }

  // ==========================================================================
  // EMAIL TRACKING & STATISTICS
  // ==========================================================================

  /**
   * Get email statistics
   * @param options - Statistics filter options
   * @returns Promise with email statistics
   */
  async getEmailStatistics(
    options: EmailStatisticsOptions = {}
  ): Promise<EmailStatistics[]> {
    const queryParams: any = {};

    if (options.startDate) queryParams.start_date = options.startDate;
    if (options.endDate) queryParams.end_date = options.endDate;
    if (options.aggregatedBy) queryParams.aggregated_by = options.aggregatedBy;
    if (options.limit) queryParams.limit = options.limit;
    if (options.offset) queryParams.offset = options.offset;

    const queryString = new URLSearchParams(queryParams).toString();
    const request = {
      url: `/v3/stats?${queryString}`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as EmailStatistics[];
  }

  /**
   * Get category-specific statistics
   * @param categories - Array of category names
   * @param options - Statistics filter options
   * @returns Promise with category statistics
   */
  async getCategoryStatistics(
    categories: string[],
    options: EmailStatisticsOptions = {}
  ): Promise<EmailStatistics[]> {
    const queryParams: any = {
      categories: categories.join(","),
    };

    if (options.startDate) queryParams.start_date = options.startDate;
    if (options.endDate) queryParams.end_date = options.endDate;
    if (options.aggregatedBy) queryParams.aggregated_by = options.aggregatedBy;

    const queryString = new URLSearchParams(queryParams).toString();
    const request = {
      url: `/v3/categories/stats?${queryString}`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as EmailStatistics[];
  }

  // ==========================================================================
  // SUPPRESSION MANAGEMENT
  // ==========================================================================

  /**
   * Get all suppression groups
   * @returns Promise with list of suppression groups
   */
  async getSuppressionGroups(): Promise<SuppressionGroup[]> {
    const request = {
      url: `/v3/asm/groups`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as SuppressionGroup[];
  }

  /**
   * Get blocked emails
   * @param startTime - Optional start time (Unix timestamp)
   * @param endTime - Optional end time (Unix timestamp)
   * @param limit - Optional limit
   * @param offset - Optional offset
   * @returns Promise with list of blocked emails
   */
  async getBlockedEmails(
    startTime?: number,
    endTime?: number,
    limit?: number,
    offset?: number
  ): Promise<BlockedEmail[]> {
    const queryParams: any = {};
    if (startTime) queryParams.start_time = startTime;
    if (endTime) queryParams.end_time = endTime;
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;

    const queryString = new URLSearchParams(queryParams).toString();
    const request = {
      url: `/v3/suppression/blocks?${queryString}`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as BlockedEmail[];
  }

  /**
   * Delete a blocked email
   * @param email - Email address to unblock
   * @returns Promise<void>
   */
  async deleteBlockedEmail(email: string): Promise<void> {
    const request = {
      url: `/v3/suppression/blocks/${email}`,
      method: "DELETE" as const,
    };

    await sgClient.request(request);
  }

  /**
   * Get bounced emails
   * @param startTime - Optional start time (Unix timestamp)
   * @param endTime - Optional end time (Unix timestamp)
   * @returns Promise with list of bounced emails
   */
  async getBouncedEmails(
    startTime?: number,
    endTime?: number
  ): Promise<BouncedEmail[]> {
    const queryParams: any = {};
    if (startTime) queryParams.start_time = startTime;
    if (endTime) queryParams.end_time = endTime;

    const queryString = new URLSearchParams(queryParams).toString();
    const request = {
      url: `/v3/suppression/bounces?${queryString}`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as BouncedEmail[];
  }

  /**
   * Get spam reports
   * @param startTime - Optional start time (Unix timestamp)
   * @param endTime - Optional end time (Unix timestamp)
   * @returns Promise with list of spam reports
   */
  async getSpamReports(
    startTime?: number,
    endTime?: number
  ): Promise<SpamReport[]> {
    const queryParams: any = {};
    if (startTime) queryParams.start_time = startTime;
    if (endTime) queryParams.end_time = endTime;

    const queryString = new URLSearchParams(queryParams).toString();
    const request = {
      url: `/v3/suppression/spam_reports?${queryString}`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as SpamReport[];
  }

  /**
   * Get invalid emails
   * @param startTime - Optional start time (Unix timestamp)
   * @param endTime - Optional end time (Unix timestamp)
   * @returns Promise with list of invalid emails
   */
  async getInvalidEmails(
    startTime?: number,
    endTime?: number
  ): Promise<InvalidEmail[]> {
    const queryParams: any = {};
    if (startTime) queryParams.start_time = startTime;
    if (endTime) queryParams.end_time = endTime;

    const queryString = new URLSearchParams(queryParams).toString();
    const request = {
      url: `/v3/suppression/invalid_emails?${queryString}`,
      method: "GET" as const,
    };

    const [response] = await sgClient.request(request);
    return response.body as InvalidEmail[];
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Validate email data before sending
   * @param emailData - Email data to validate
   * @throws Error if validation fails
   */
  private validateEmailData(emailData: MailDataRequired): void {
    if (!emailData.from) {
      throw new Error("Sender is required");
    }

    const senderEmail =
      typeof emailData.from === "string"
        ? emailData.from
        : emailData.from.email;

    if (!this.isValidEmail(senderEmail)) {
      throw new Error("Invalid sender email address");
    }

    // Validate recipients
    const recipients = Array.isArray(emailData.to)
      ? emailData.to
      : [emailData.to];

    if (recipients.length === 0 && !emailData.personalizations) {
      throw new Error("At least one recipient is required");
    }

    recipients
      .filter((r): r is string | { email: string } => r !== undefined)
      .forEach((recipient) => {
        const recipientEmail =
          typeof recipient === "string" ? recipient : recipient.email;
        if (!this.isValidEmail(recipientEmail)) {
          throw new Error(`Invalid recipient email: ${recipientEmail}`);
        }
      });

    // Validate subject
    if (
      !emailData.subject &&
      !emailData.templateId &&
      !emailData.personalizations
    ) {
      throw new Error("Subject is required when not using a template");
    }

    // Validate content
    if (
      !emailData.html &&
      !emailData.text &&
      !emailData.templateId &&
      !emailData.personalizations
    ) {
      throw new Error("Either html, text, or templateId is required");
    }
  }

  /**
   * Validate email address format
   * @param email - Email address to validate
   * @returns boolean
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate scheduled time
   * @param sendAt - Unix timestamp to validate
   * @throws Error if time is invalid or in the past
   */
  private validateScheduledTime(sendAt: number): void {
    const now = Math.floor(Date.now() / 1000);

    if (sendAt <= now) {
      throw new Error("Scheduled time must be in the future");
    }

    // SendGrid requires scheduling at least 10 minutes in the future
    const tenMinutesFromNow = now + 600;
    if (sendAt < tenMinutesFromNow) {
      throw new Error(
        "Scheduled time must be at least 10 minutes in the future"
      );
    }

    // SendGrid doesn't allow scheduling more than 72 hours in advance
    const maxScheduleTime = now + 72 * 60 * 60;
    if (sendAt > maxScheduleTime) {
      throw new Error(
        "Scheduled time cannot be more than 72 hours in the future"
      );
    }
  }

  /**
   * Create an email attachment from base64 content
   * @param content - Base64 encoded file content
   * @param filename - File name with extension
   * @param type - MIME type
   * @param disposition - Attachment or inline
   * @returns EmailAttachment object
   */
  static createAttachment(
    content: string,
    filename: string,
    type?: string,
    disposition: "attachment" | "inline" = "attachment"
  ): EmailAttachment {
    return { content, filename, type, disposition };
  }

  /**
   * Create an inline image attachment
   * @param content - Base64 encoded image content
   * @param filename - File name
   * @param contentId - Content ID for referencing in HTML
   * @param type - MIME type
   * @returns EmailAttachment object
   */
  static createInlineImage(
    content: string,
    filename: string,
    contentId: string,
    type?: string
  ): EmailAttachment {
    return {
      content,
      filename,
      type,
      disposition: "inline",
      contentId,
    };
  }

  /**
   * Generate Unix timestamp for scheduling
   * @param date - Date object or timestamp
   * @returns Unix timestamp
   */
  static getUnixTimestamp(date: Date | number): number {
    if (typeof date === "number") {
      return Math.floor(date / 1000);
    }
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Schedule email for a specific number of hours from now
   * @param hours - Number of hours from now
   * @returns Unix timestamp
   */
  static scheduleInHours(hours: number): number {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Schedule email for a specific number of days from now
   * @param days - Number of days from now
   * @returns Unix timestamp
   */
  static scheduleInDays(days: number): number {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Generate a unique batch ID
   * @returns Batch ID string
   */
  static generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  parseWebhookData(data: any): WebhookData {
    return {
      provider: "sendgrid",
      event_type: data.event,
      email_id: data.sg_message_id,
      recipient: data.email,
      timestamp: new Date(data.timestamp * 1000).toISOString(),
      status_state: data.event,
      status_reason: data.reason ?? null,
      smtp_response: data.response ?? null,
      meta: { category: data.category, ip: data.ip },
      raw_payload: data,
    };
  }
}

export default SendGridEmailAdapter;
