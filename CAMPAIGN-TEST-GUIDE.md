# 🚀 Email Campaign Testing Guide

Welcome! You have a fully functional email campaign system ready to test. Here are several ways to test email campaigns:

## 🏃‍♂️ Quick Start - Simple Campaign Test

I've created a simple step-by-step campaign test script for you:

```bash
cd momentum-email-system
npm run test-campaign
```

This script will:
1. ✅ Check your system status
2. 📝 Create or use an existing email template
3. 👥 Set up test contacts
4. 📋 Create a contact list
5. 📧 Create an email campaign
6. 🚀 Start the campaign
7. 📦 Process the email queue
8. 📊 Show campaign statistics

## 🎯 Environment Setup

Before running any tests, you'll need to set up your environment variables. Your system is already deployed to production [[memory:2875253]] with project ID `pxzccwwvzpvyceumnekw`.

### Option 1: Copy from existing environment files
```bash
# Use development environment
cp config/environments/development.env .env

# Or use production environment
cp config/environments/production.env .env
```

### Option 2: Get your Supabase credentials
1. Go to your Supabase dashboard: https://pxzccwwvzpvyceumnekw.supabase.co
2. Go to Settings > API
3. Copy your project URL and API keys
4. Update your `.env` file with:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

### Required Environment Variables
```env
SUPABASE_URL=https://pxzccwwvzpvyceumnekw.supabase.co
SUPABASE_ANON_KEY=your_key_here
# Optional: For sending real emails
MAILTRAP_API_KEY=your_mailtrap_key
MAILTRAP_INBOX_ID=your_inbox_id
MAILTRAP_TEST_MODE=true
```

## 📧 Testing Options

### 1. Simple Campaign Test (Recommended)
```bash
npm run test-campaign
```
Creates a complete campaign with test data and shows you the entire flow.

### 2. Full System Demo with Real-time Monitoring
```bash
npm run dev
```
Runs the complete system with real-time monitoring and advanced features.

### 3. Comprehensive Campaign Management Demo
```bash
npx tsx examples/campaign-management-demo.ts
```
Shows all advanced features:
- Contact list and segment management
- Campaign validation
- Real-time monitoring
- Pause/resume functionality
- Campaign duplication
- Advanced filtering

### 4. Real-time Monitoring Demo
```bash
npx tsx examples/realtime-demo.ts
```
Focuses on real-time campaign monitoring features.

### 5. Template Engine Demo
```bash
npx tsx examples/template-engine-demo.ts
```
Demonstrates email template creation and management.

## 🎯 What Each Test Does

### Simple Campaign Test (`npm run test-campaign`)
- **Best for**: First-time testing, quick validation
- **Creates**: Template, contacts, contact list, campaign
- **Shows**: Basic campaign flow from creation to statistics
- **Duration**: ~30 seconds

### Full System Demo (`npm run dev`)
- **Best for**: Understanding the complete system
- **Features**: Real-time monitoring, system stats, campaign processing
- **Shows**: Production-like environment with all features active
- **Duration**: Runs continuously until stopped

### Campaign Management Demo
- **Best for**: Learning advanced features
- **Features**: Segments, validation, bulk operations, monitoring
- **Shows**: Enterprise-level campaign management
- **Duration**: ~2-3 minutes

## 📊 Understanding the Output

When you run any test, you'll see:

### ✅ Success Indicators
- System connection confirmed
- Templates and contacts created
- Campaign created and started
- Emails queued and processed
- Statistics generated

### 📈 Campaign Statistics
- **Total Sent**: Number of emails sent
- **Delivered**: Successfully delivered emails
- **Opened**: Emails that were opened
- **Clicked**: Links that were clicked
- **Bounced**: Failed deliveries
- **Delivery Rate**: Percentage of successful deliveries
- **Open Rate**: Percentage of emails opened
- **Click Rate**: Percentage of links clicked

## 🔧 Troubleshooting

### "Database connection failed"
- Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Verify the project is accessible

### "No contacts found"
- The test will create test contacts automatically
- If using real email lists, ensure contacts exist in the database

### "Template not found"
- The test will create a template automatically
- You can also create templates manually in your Supabase dashboard

### "Mailtrap errors"
- Set `MAILTRAP_TEST_MODE=true` to avoid sending real emails
- The system works without Mailtrap for testing the database flow

## 🎉 Next Steps After Testing

Once your campaign test is successful:

1. **Create Real Templates**: Design your actual email templates
2. **Import Contacts**: Add your real contact lists
3. **Set Up Mailtrap**: Configure for sending real emails
4. **Monitor Performance**: Use the real-time monitoring features
5. **Schedule Campaigns**: Set up automated campaign scheduling

## 🆘 Need Help?

- Check the `docs/` folder for detailed documentation
- Review the `examples/` folder for more use cases
- All features are production-ready and fully deployed [[memory:2875253]]

## 🚀 Quick Command Reference

```bash
# Test a simple campaign
npm run test-campaign

# Run full system with monitoring
npm run dev

# Advanced campaign features
npx tsx examples/campaign-management-demo.ts

# Template management
npx tsx examples/template-engine-demo.ts

# Real-time monitoring
npx tsx examples/realtime-demo.ts

# Webhook processing
npx tsx examples/webhook-processing-demo.ts
```

---

**Your email system is ready to go!** 🎊 Start with `npm run test-campaign` for a quick test, then explore the other demos to see all the powerful features available.
