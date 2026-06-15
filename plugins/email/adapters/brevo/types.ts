/**
 * Email address with optional name
 */
export interface EmailContact {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  /** Base64 encoded file content */
  content?: string;
  /** File name with extension */
  name?: string;
  /** URL of the attachment (alternative to content) */
  url?: string;
}

/**
 * Custom headers for email
 */
export interface CustomHeaders {
  [key: string]: string;
}

/**
 * Template parameters for dynamic content
 */
export interface TemplateParams {
  [key: string]: string | number | boolean;
}

/**
 * Message version for batch sending
 */
export interface MessageVersion {
  /** Recipients for this version */
  to: EmailContact[];
  /** CC recipients (optional) */
  cc?: EmailContact[];
  /** BCC recipients (optional) */
  bcc?: EmailContact[];
  /** Override params for this version */
  params?: TemplateParams;
  /** Override subject for this version */
  subject?: string;
  /** Override HTML content for this version */
  htmlContent?: string;
  /** Override text content for this version */
  textContent?: string;
  /** Override reply-to for this version */
  replyTo?: EmailContact;
  /** Override attachments for this version */
  attachment?: EmailAttachment[];
  /** Override headers for this version */
  headers?: CustomHeaders;
}

/**
 * Base email configuration
 */
export interface BaseEmailConfig {
  /** Sender information (must be verified in Brevo) */
  sender: EmailContact;
  /** Email subject */
  subject: string;
  /** Reply-to address (optional) */
  replyTo?: EmailContact;
  /** Email tags for categorization (optional) */
  tags?: string[];
  /** Custom headers (optional) */
  headers?: CustomHeaders;
}

/**
 * Simple email configuration (HTML/Text content)
 */
export interface SimpleEmailConfig extends BaseEmailConfig {
  /** Recipients */
  to: EmailContact[];
  /** CC recipients (optional) */
  cc?: EmailContact[];
  /** BCC recipients (optional) */
  bcc?: EmailContact[];
  /** HTML content */
  htmlContent?: string;
  /** Plain text content */
  textContent?: string;
  /** Email attachments (optional) */
  attachment?: EmailAttachment[];
  /** Template parameters (optional) */
  params?: TemplateParams;
}

/**
 * Template-based email configuration
 */
export interface TemplateEmailConfig extends BaseEmailConfig {
  /** Recipients */
  to: EmailContact[];
  /** CC recipients (optional) */
  cc?: EmailContact[];
  /** BCC recipients (optional) */
  bcc?: EmailContact[];
  /** Brevo template ID */
  templateId: number;
  /** Template parameters for dynamic content */
  params?: TemplateParams;
  /** Email attachments (optional) */
  attachment?: EmailAttachment[];
}

/**
 * Batch email configuration (multiple versions)
 */
export interface BatchEmailConfig extends BaseEmailConfig {
  /** HTML content for default version */
  htmlContent?: string;
  /** Text content for default version */
  textContent?: string;
  /** Template ID for batch sending (optional) */
  templateId?: number;
  /** Default template parameters */
  params?: TemplateParams;
  /** Array of message versions (up to 1000) */
  messageVersions: MessageVersion[];
  /** Batch identifier for tracking */
  batchId?: string;
}

/**
 * Scheduled email configuration
 */
export interface ScheduledEmailConfig extends SimpleEmailConfig {
  /** ISO 8601 formatted date-time for scheduling */
  scheduledAt: string;
  /** Batch ID for tracking scheduled emails */
  batchId?: string;
}

/**
 * Scheduled template email configuration
 */
export interface ScheduledTemplateEmailConfig extends TemplateEmailConfig {
  /** ISO 8601 formatted date-time for scheduling */
  scheduledAt: string;
  /** Batch ID for tracking scheduled emails */
  batchId?: string;
}

/**
 * Scheduled batch email configuration
 */
export interface ScheduledBatchEmailConfig extends BatchEmailConfig {
  /** ISO 8601 formatted date-time for scheduling */
  scheduledAt: string;
}

/**
 * Email send response
 */
export interface EmailSendResponse {
  messageId?: string;
  messageIds?: string[];
}

/**
 * Email status response
 */
export interface EmailStatusResponse {
  status: string;
  scheduledAt?: string;
  messageId?: string;
}

/**
 * Email statistics options
 */
export interface EmailStatisticsOptions {
  email?: string;
  messageId?: string;
  /** Start date (YYYY-MM-DD format) */
  startDate?: string;
  /** End date (YYYY-MM-DD format) */
  endDate?: string;
  /** Number of days to get statistics for */
  days?: number;
  /** Tag to filter by */
  limit?: number;
  offset?: number;
  sort?: "asc" | "desc";
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  events: WebhookEvent[];
  description?: string;
}

/**
 * Webhook events that can be tracked
 */
export type WebhookEvent =
  | "sent"
  | "delivered"
  | "hardBounce"
  | "softBounce"
  | "blocked"
  | "spam"
  | "invalid"
  | "deferred"
  | "click"
  | "opened"
  | "uniqueOpened"
  | "unsubscribe"
  | "error"
  | "loadedByProxy";

export type AddDomainResponse = {
  id?: string;
  domain_name?: string;
  message: string;
  dns_records?: {
    dkim_record: {
      type: "TXT";
      value: string;
      host_name: string;
      status: boolean;
    };
    brevo_code: {
      type: "TXT";
      value: string;
      host_name: string;
      status: boolean;
    };
  };
};

export type DomainResponse = {
  domains: {
    id: string;
    domain_name: string;
    authenticated: boolean;
    verified: boolean;
    validationRequest: string | null;
    verifier: string | null;
    authenticator: string | null;
    creator: {
      id: string;
      email: string;
      method: string | null;
      creationDate: string; // ISO timestamp
    };
    ip: string | null;
  }[];
  count: number;
  current_page: number;
  total_pages: number;
};

export type deleteDomainResponse = {
  message: string;
};

export type BrevoEmailEvent =
  | "bounces"
  | "hardBounces"
  | "softBounces"
  | "delivered"
  | "spam"
  | "requests"
  | "opened"
  | "clicks"
  | "invalid"
  | "deferred"
  | "blocked"
  | "unsubscribed"
  | "error"
  | "loadedByProxy";
