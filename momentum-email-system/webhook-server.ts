import 'dotenv/config';
import express from 'express';
import { createEmailService } from './src/config/email.config';
import { EmailQueueService } from './src/services/email-queue.service';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON with raw body for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Create service instances
const emailService = createEmailService();
const queueService = new EmailQueueService();

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'Momentum Email Webhook Server',
    timestamp: new Date().toISOString()
  });
});

// Main webhook endpoint for Mailtrap
app.post('/webhooks/mailtrap', async (req, res) => {
  try {
    // Get client IP for rate limiting
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string || 'unknown';

    console.log('📬 Received webhook from Mailtrap');
    console.log('Client IP:', clientIp);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    // Get the signature from headers
    const signature = req.headers['x-mailtrap-signature'] as string;

    if (!signature) {
      console.warn('⚠️ No signature provided in webhook');
      res.status(400).json({
        success: false,
        error: 'No signature provided'
      });
      return;
    }

    // Process the webhook through the rate-limited queue service
    const result = await queueService.handleMailtrapWebhook(req.body, clientIp);

    console.log('✅ Webhook processed successfully:', result);

    // Also process through email service for signature verification
    const webhookEvent = await emailService.processWebhook(req.body, signature);

    console.log('✅ Webhook event details:', {
      messageId: webhookEvent.messageId,
      event: webhookEvent.event,
      email: webhookEvent.email,
      timestamp: webhookEvent.timestamp
    });

    // Respond to Mailtrap
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      eventId: webhookEvent.messageId
    });

  } catch (error) {
    console.error('❌ Webhook processing failed:', error);

    // Handle rate limiting errors
    if ((error as any).statusCode === 429) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: (error as Error).message,
        retryAfter: (error as any).resetTime
      });
      return;
    }

    // Handle other errors
    const statusCode = (error as any).statusCode || 400;
    res.status(statusCode).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Momentum Email Webhook Server running on port ${port}`);
  console.log(`📍 Health check: http://localhost:${port}/health`);
  console.log(`🪝 Webhook endpoint: http://localhost:${port}/webhooks/mailtrap`);
  console.log(`🔒 Webhook secret configured: ${process.env.MAILTRAP_WEBHOOK_SECRET ? 'Yes' : 'No'}`);
});

export default app;
