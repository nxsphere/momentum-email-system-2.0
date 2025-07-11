import 'dotenv/config';
import express from 'express';
import { createEmailService } from './src/config/email.config';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON with raw body for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Create email service instance
const emailService = createEmailService();

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
    console.log('📬 Received webhook from Mailtrap');
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

    // Process the webhook through the email service
    const webhookEvent = await emailService.processWebhook(req.body, signature);

    console.log('✅ Webhook processed successfully:', {
      messageId: webhookEvent.messageId,
      event: webhookEvent.event,
      email: webhookEvent.email,
      timestamp: webhookEvent.timestamp
    });

    // Here you would typically update your database
    // Example: Update email log status in your campaign system
    if (webhookEvent.messageId) {
      console.log(`📊 Updating email status: ${webhookEvent.messageId} -> ${webhookEvent.event}`);

      // Example database update (you'll implement this based on your needs)
      // await updateEmailLogStatus(webhookEvent.messageId, webhookEvent.event, webhookEvent.data);
    }

    // Respond to Mailtrap
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      eventId: webhookEvent.messageId
    });

  } catch (error) {
    console.error('❌ Webhook processing failed:', error);

    res.status(400).json({
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
