# Email Plugin for Better Auth

A comprehensive email plugin for Better Auth that provides email sending capabilities with database logging and webhook support.

## Features

- 🚀 **Multiple Email Providers**: Support for Resend (implemented), SendGrid, and brevo (extensible)
- 📊 **Database Logging**: All emails are logged to the database with status tracking
- 🔔 **Webhook Support**: Real-time email status updates via webhooks
- 📈 **Email Statistics**: Comprehensive analytics including open rates, click rates, and bounce rates
- 🔐 **Webhook Verification**: Secure webhook signature verification
- 📦 **Bulk Email**: Send multiple emails efficiently
- 🎯 **TypeScript**: Full type safety throughout

## Installation

The plugin is already integrated into your Better Auth setup. Make sure you have the required dependencies:

```bash
pnpm add resend svix
```

## Configuration

Add the email plugin to your Better Auth configuration:

```typescript
import { email } from "../plugins/email";
import { ResendEmailAdapter } from "../plugins/email/adapters";
import { resend } from "../lib/resend";

export const auth = betterAuth({
  // ... your other config
  plugins: [
    email({
      defaultProvider: "resend",
      fromAddress: "noreply@yourdomain.com",
      replyToAddress: "support@yourdomain.com",
      enableWebhooks: true,
      webhookSecret: process.env.RESEND_WEBHOOK_SIGNING_SECRET,
      trackOpens: true,
      trackClicks: true,
      adapters: [
        new ResendEmailAdapter(resend),
        // Add other adapters as needed
      ],
    }),
    // ... other plugins
  ],
});
```

## Environment Variables

Add these to your `.env` file:

```env
RESEND_API_KEY="your_resend_api_key"
RESEND_EMAIL_FROM="noreply@yourdomain.com"
RESEND_WEBHOOK_SIGNING_SECRET="your_webhook_secret"
```

## Database Schema

The plugin adds an `emailLog` table to track all sent emails:

```sql
CREATE TABLE emailLog (
  id VARCHAR(255) PRIMARY KEY,
  resendId VARCHAR(255),
  fromAddress VARCHAR(255) NOT NULL,
  toAddress VARCHAR(255) NOT NULL,
  ccAddress TEXT,
  bccAddress TEXT,
  replyToAddress VARCHAR(255),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  contentType VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  providerId VARCHAR(255),
  provider VARCHAR(50) NOT NULL,
  errorMessage TEXT,
  sentAt DATETIME,
  deliveredAt DATETIME,
  openedAt DATETIME,
  clickedAt DATETIME,
  bouncedAt DATETIME,
  complainedAt DATETIME,
  failedAt DATETIME,
  metadata TEXT,
  tags TEXT,
  userId VARCHAR(255),
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);
```

## Usage

### Server-side API

```typescript
// Send a single email
const result = await auth.api.sendEmail({
  to: "user@example.com",
  subject: "Welcome!",
  html: "<p>Welcome to our platform!</p>",
});

// Send bulk emails
const bulkResult = await auth.api.sendBulkEmails({
  emails: [
    {
      to: "user1@example.com",
      subject: "Welcome User 1!",
      html: "<p>Welcome!</p>",
    },
    {
      to: "user2@example.com",
      subject: "Welcome User 2!",
      html: "<p>Welcome!</p>",
    },
  ],
});

// Get email logs
const logs = await auth.api.getEmailLogs({
  status: "delivered",
  limit: 10,
});

// Get email statistics
const stats = await auth.api.getEmailStats();
```

### Client-side Usage

```typescript
import { useEmailClient } from "../plugins/email/client";

function EmailComponent() {
  const emailClient = useEmailClient();

  const sendEmail = async () => {
    const result = await emailClient.send({
      to: "user@example.com",
      subject: "Test Email",
      html: "<p>This is a test email</p>",
    });

    if (result.success) {
      console.log("Email sent successfully:", result.emailId);
    } else {
      console.error("Failed to send email:", result.error);
    }
  };

  const getStats = async () => {
    const stats = await emailClient.stats();
    if (stats.success) {
      console.log("Email statistics:", stats.stats);
    }
  };

  return (
    <div>
      <button onClick={sendEmail}>Send Email</button>
      <button onClick={getStats}>Get Stats</button>
    </div>
  );
}
```

## Webhook Setup

### 1. Configure Webhook URL

Set up your webhook endpoint in your email provider dashboard:

```
https://yourdomain.com/api/auth/email/webhook
```

### 2. Webhook Events

The plugin handles these Resend webhook events:

- `email.sent` - Email was accepted by the provider
- `email.delivered` - Email was delivered to recipient
- `email.opened` - Recipient opened the email
- `email.clicked` - Recipient clicked a link
- `email.bounced` - Email bounced
- `email.complained` - Email marked as spam
- `email.failed` - Email delivery failed
- `email.delivery_delayed` - Delivery temporarily delayed

### 3. Webhook Security

Webhooks are automatically verified using the signing secret:

```typescript
// The plugin automatically verifies webhook signatures
// Set RESEND_WEBHOOK_SIGNING_SECRET in your environment
```

## Email Adapters

### Resend Adapter (Implemented)

```typescript
import { ResendEmailAdapter } from "../plugins/email/adapters";
import { resend } from "../lib/resend";

const resendAdapter = new ResendEmailAdapter(resend);
```

### Custom Adapter

Create your own email adapter:

```typescript
import type {
  EmailAdapter,
  SendEmailRequest,
  SendEmailResponse,
} from "../plugins/email/types";

class CustomEmailAdapter implements EmailAdapter {
  name = "custom" as const;

  async sendEmail(email: SendEmailRequest): Promise<SendEmailResponse> {
    // Implement your email sending logic
    return {
      success: true,
      id: "email_id",
      providerId: "provider_id",
    };
  }

  async sendBulkEmails(
    emails: SendEmailRequest[],
  ): Promise<SendEmailResponse[]> {
    // Implement bulk email sending
    return emails.map(() => ({ success: true }));
  }
}
```

## API Endpoints

| Method | Endpoint           | Description              |
| ------ | ------------------ | ------------------------ |
| POST   | `/email/send`      | Send a single email      |
| POST   | `/email/send-bulk` | Send multiple emails     |
| GET    | `/email/logs`      | Get email logs           |
| GET    | `/email/stats`     | Get email statistics     |
| POST   | `/email/webhook`   | Handle provider webhooks |

## Email Statistics

The plugin provides comprehensive email analytics:

```typescript
interface EmailStats {
  total: number; // Total emails sent
  sent: number; // Successfully sent
  delivered: number; // Successfully delivered
  opened: number; // Opened by recipients
  clicked: number; // Had links clicked
  bounced: number; // Bounced emails
  complained: number; // Marked as spam
  failed: number; // Failed to send
  openRate: number; // Open rate percentage
  clickRate: number; // Click rate percentage
  bounceRate: number; // Bounce rate percentage
}
```

## Error Handling

The plugin provides detailed error codes:

- `EMAIL_NOT_FOUND` - Email log not found
- `INVALID_EMAIL_ADDRESS` - Invalid email format
- `SEND_FAILED` - Email sending failed
- `ADAPTER_NOT_FOUND` - Email adapter not configured
- `WEBHOOK_VERIFICATION_FAILED` - Invalid webhook signature
- `PROVIDER_ERROR` - Email provider error
- `MISSING_CONTENT` - No email content provided
- `UNAUTHORIZED_ACCESS` - User not authorized

## Extending with New Providers

To add support for new email providers:

1. Create a new adapter implementing the `EmailAdapter` interface
2. Add the provider to the `EmailProvider` type
3. Register the adapter in your configuration
4. Update webhook handling if needed

Example for SendGrid:

```typescript
// TODO: Implement SendGrid adapter
class SendGridEmailAdapter implements EmailAdapter {
  name = "sendgrid" as const;
  // ... implementation
}
```

## Security Considerations

- Always verify webhook signatures in production
- Use environment variables for API keys and secrets
- Implement rate limiting for email endpoints
- Validate email addresses before sending
- Sanitize email content to prevent XSS

## Troubleshooting

### Common Issues

1. **Emails not being sent**: Check API keys and adapter configuration
2. **Webhook not working**: Verify webhook URL and signing secret
3. **Database errors**: Ensure email log table exists and is accessible
4. **Rate limiting**: Implement delays between bulk email sends

### Debug Mode

Enable debug logging:

```typescript
// Add console.log statements in adapters for debugging
console.log("Sending email:", emailRequest);
```

## License

This plugin is part of your Better Auth project and follows the same license terms.
