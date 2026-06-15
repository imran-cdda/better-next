import {
  EmailProvider,
  SendEmailRequest,
  SendEmailResponse,
  WebhookData,
} from "./types";

export abstract class baseAdapter {
  name: EmailProvider;
  constructor(name: EmailProvider) {
    this.name = name;
  }

  abstract sendEmail(email: SendEmailRequest): Promise<SendEmailResponse>;
  abstract sendBulkEmails(
    emails: SendEmailRequest[]
  ): Promise<SendEmailResponse[]>;

  abstract parseWebhookData(data: any): WebhookData;
}
