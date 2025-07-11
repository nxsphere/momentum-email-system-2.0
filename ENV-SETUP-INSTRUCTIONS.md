# Environment Setup Instructions

## Overview
Your momentum email system environment has been configured with comprehensive environment files. Follow these steps to complete the setup.

## Environment Files Created

- **`.env.example`** - Template file with all variables documented (safe to commit)
- **`.env`** - Main production environment file (DO NOT COMMIT)
- **`.env.development`** - Development-specific settings (DO NOT COMMIT)
- **`.gitignore`** - Updated to protect sensitive environment files

## Required Configuration Steps

### 1. Mailtrap Configuration (Required)
1. Sign up for Mailtrap at [https://mailtrap.io/](https://mailtrap.io/)
2. Get your API key from the dashboard
3. Create an inbox and get the inbox ID
4. Generate a webhook secret for delivery notifications
5. Update these variables in your `.env` file:
   ```
   MAILTRAP_API_KEY=your_actual_api_key
   MAILTRAP_INBOX_ID=your_actual_inbox_id
   MAILTRAP_WEBHOOK_SECRET=your_actual_webhook_secret
   ```

### 2. Supabase Configuration (Required)
1. Go to your Supabase project settings
2. Copy the project URL and service role key
3. Update these variables in your `.env` file:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### 3. Company Information (Required)
Update the following in your `.env` file:
```
COMPANY_NAME=Momentum Business Capital
COMPANY_ADDRESS=Your actual business address
DEFAULT_FROM_EMAIL=your-email@yourdomain.com
TEMPLATE_TRACKING_BASE_URL=https://track.yourdomain.com
```

### 4. Optional Customizations
Review and adjust these settings based on your needs:
- Email timeout and retry settings
- Rate limiting configuration
- UTM tracking parameters
- Template engine limits

## Environment Selection

- **Production**: Use `.env` file
- **Development**: Copy `.env.development` to `.env` or load it explicitly
- **Testing**: Create `.env.test` based on `.env.example`

## Validation

Run the application to validate your configuration:
```bash
npm run start
```

The system will validate required environment variables and show helpful error messages if anything is missing.

## Security Notes

- Never commit `.env` files to version control
- Use different API keys for development and production
- Rotate webhook secrets regularly
- Use the principle of least privilege for database access

## Troubleshooting

If you encounter configuration errors:
1. Check the console output for specific validation errors
2. Verify all required variables are set
3. Ensure URLs are properly formatted
4. Confirm API keys are valid and have necessary permissions

## Environment Variable Reference

See `.env.example` for complete documentation of all available environment variables and their purposes. 