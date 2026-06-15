import type { Session, User } from "better-auth";
import type { z } from "zod";
import type {
  bulkSendEmailSchema,
  sendEmailSchema,
  webhookEventSchema,
} from "./schema";
import { baseAdapter } from "./adapters/base";

// Better Auth Adapter interface for type safety
export interface BetterAuthAdapter {
  findOne<T = DatabaseEmailLog>(options: {
    model: string;
    where: Array<{
      field: string;
      value: string | number | boolean;
      operator?: string;
    }>;
  }): Promise<T | null>;

  findMany<T = DatabaseEmailLog>(options: {
    model: string;
    where?: Array<{ field: string; value: string | number | boolean }>;
    limit?: number;
    offset?: number;
    sortBy?: { field: string; direction: "asc" | "desc" };
  }): Promise<T[]>;

  create<T = DatabaseEmailLog>(options: {
    model: string;
    data: Partial<T>;
  }): Promise<T>;

  update<T = DatabaseEmailLog>(options: {
    model: string;
    where: Array<{ field: string; value: string | number | boolean }>;
    update: Partial<T>;
  }): Promise<T | null>;

  delete(options: {
    model: string;
    where: Array<{ field: string; value: string | number | boolean }>;
  }): Promise<void>;
}

// Email status enum
export type EmailStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "delivery_delayed";

// Email content type enum
export type EmailContentType = "html" | "text" | "mixed";

// Email provider enum
export type EmailProvider = "resend" | "sendgrid" | "brevo";

// Core Interfaces
export interface EmailLog {
  id: string;
  provider: string; // resend, sendgrid, brevo, etc.
  providerId?: string | null; // provider-specific message ID
  fromAddress: string;
  toAddress: string;
  ccAddress?: string | null;
  bccAddress?: string | null;
  replyToAddress?: string | null;
  subject: string;
  content: string;
  contentType: string;
  status_state:
    | "delivered"
    | "bounced"
    | "opened"
    | "clicked"
    | "failed"
    | string;
  status_reason?: string | null;
  smtp_response?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  clickedAt?: Date | null;
  bouncedAt?: Date | null;
  complainedAt?: Date | null;
  failedAt?: Date | null;
  meta?: string | null; // JSON string for tags, IP, campaign, etc.
  raw_payload?: any; // original webhook JSON
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Database types (what's actually stored)
export interface DatabaseEmailLog {
  id: string;
  provider: string; // resend, sendgrid, brevo, etc.
  providerId?: string | null; // provider-specific message ID
  fromAddress: string;
  toAddress: string;
  ccAddress?: string | null;
  bccAddress?: string | null;
  replyToAddress?: string | null;
  subject: string;
  content: string;
  contentType: string;
  status_state:
    | "delivered"
    | "bounced"
    | "opened"
    | "clicked"
    | "failed"
    | string;
  status_reason?: string | null;
  smtp_response?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  clickedAt?: Date | null;
  bouncedAt?: Date | null;
  complainedAt?: Date | null;
  failedAt?: Date | null;
  meta?: string | null; // JSON string for tags, IP, campaign, etc.
  raw_payload?: any; // original webhook JSON
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Input types (what we accept from users)
export interface InputEmailLog {
  provider: string; // resend, sendgrid, brevo, etc.
  providerId?: string | null; // provider-specific message ID
  fromAddress: string;
  toAddress: string;
  ccAddress?: string | null;
  bccAddress?: string | null;
  replyToAddress?: string | null;
  subject: string;
  content: string;
  contentType: string;
  status_state:
    | "delivered"
    | "bounced"
    | "opened"
    | "clicked"
    | "failed"
    | string;
  status_reason?: string | null;
  smtp_response?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  clickedAt?: Date | null;
  bouncedAt?: Date | null;
  complainedAt?: Date | null;
  failedAt?: Date | null;
  meta?: string | null; // JSON string for tags, IP, campaign, etc.
  raw_payload?: any; // original webhook JSON
  userId?: string | null;
}

// Email adapter interface
export interface EmailAdapter<T extends baseAdapter = baseAdapter> {
  name: EmailProvider;
  adapter: T;
}

// Request/Response Types
export type SendEmailRequest = z.infer<typeof sendEmailSchema>;
export type BulkSendEmailRequest = z.infer<typeof bulkSendEmailSchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export interface SendEmailResponse {
  success: boolean;
  id?: string;
  providerId?: string;
  error?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailTag {
  name: string;
  value: string;
}

// Plugin options
export interface EmailOptions {
  defaultProvider?: EmailProvider;
  enableWebhooks?: boolean;
  webhookSecret?: string;
  adapters?: EmailAdapter[];
  fromAddress?: string;
  replyToAddress?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

// Extended user and session types
export interface UserWithEmail extends User {
  emailLogs?: EmailLog[];
}

export interface SessionWithEmail extends Session {
  user: UserWithEmail;
}

// Webhook payload types for different providers
export interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    id?: string; // Some webhooks use 'id'
    email_id?: string; // Others use 'email_id'
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounce_type?: string;
    complaint_type?: string;
    click?: {
      ipAddress: string;
      link: string;
      timestamp: string;
      userAgent: string;
    };
  };
}

// Bulk operation types
export interface BulkEmailResult {
  total: number;
  successful: number;
  failed: number;
  results: SendEmailResponse[];
}

// Query types
export interface GetEmailLogsQuery {
  userId?: string;
  status?: EmailStatus;
  provider?: EmailProvider;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}
