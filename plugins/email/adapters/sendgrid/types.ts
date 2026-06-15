/**
 * SendGrid Email Adapter Type Definitions
 */

export interface EmailContact {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type?: string; // MIME type
  disposition?: "attachment" | "inline";
  contentId?: string; // For inline images
}

export interface EmailHeader {
  [key: string]: string;
}

export interface EmailPersonalization {
  to: EmailContact[];
  cc?: EmailContact[];
  bcc?: EmailContact[];
  subject?: string;
  headers?: EmailHeader;
  substitutions?: { [key: string]: string };
  dynamicTemplateData?: { [key: string]: any };
  customArgs?: { [key: string]: string };
  sendAt?: number; // Unix timestamp
}

export interface SimpleEmailConfig {
  sender: EmailContact;
  to: EmailContact[];
  cc?: EmailContact[];
  bcc?: EmailContact[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  replyTo?: EmailContact;
  attachments?: EmailAttachment[];
  headers?: EmailHeader;
  categories?: string[]; // SendGrid tags
  customArgs?: { [key: string]: string };
  sendAt?: number; // Unix timestamp for scheduling
  batchId?: string;
  asm?: {
    groupId: number;
    groupsToDisplay?: number[];
  };
  ipPoolName?: string;
  templateId?: string;
  dynamicTemplateData?: { [key: string]: any };
}

export interface BatchEmailConfig {
  sender: EmailContact;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: string;
  personalizations: EmailPersonalization[];
  replyTo?: EmailContact;
  attachments?: EmailAttachment[];
  headers?: EmailHeader;
  categories?: string[];
  customArgs?: { [key: string]: string };
  batchId?: string;
  asm?: {
    groupId: number;
    groupsToDisplay?: number[];
  };
  ipPoolName?: string;
}

export interface ScheduledEmailConfig extends SimpleEmailConfig {
  sendAt: number; // Unix timestamp - required for scheduled emails
}

export interface ScheduledBatchEmailConfig extends BatchEmailConfig {
  sendAt: number; // Unix timestamp - required for scheduled emails
}

export interface EmailSendResponse {
  statusCode: number;
  headers?: { [key: string]: string };
  body?: any;
}

export interface CancelScheduledEmailResponse {
  success: boolean;
  message?: string;
}

export interface EmailStatisticsOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  aggregatedBy?: "day" | "week" | "month";
  limit?: number;
  offset?: number;
}

export interface EmailStatistics {
  date: string;
  stats: Array<{
    metrics: {
      blocks: number;
      bounce_drops: number;
      bounces: number;
      clicks: number;
      deferred: number;
      delivered: number;
      invalid_emails: number;
      opens: number;
      processed: number;
      requests: number;
      spam_report_drops: number;
      spam_reports: number;
      unique_clicks: number;
      unique_opens: number;
      unsubscribe_drops: number;
      unsubscribes: number;
    };
  }>;
}

export interface SuppressionGroup {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
  unsubscribes?: number;
}

export interface BlockedEmail {
  created: number;
  email: string;
  reason: string;
  status: string;
}

export interface BouncedEmail {
  created: number;
  email: string;
  reason: string;
  status: string;
}

export interface SpamReport {
  created: number;
  email: string;
  ip: string;
}

export interface InvalidEmail {
  created: number;
  email: string;
  reason: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  active: number;
  name: string;
  htmlContent?: string;
  plainContent?: string;
  subject?: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  generation: "legacy" | "dynamic";
  updatedAt: string;
  versions?: TemplateVersion[];
}
