# 🚀 Momentum Email System - Deployment Guide

## Overview

This guide covers the complete deployment process for the Momentum Email System across development, staging, and production environments. The system includes automated deployment, environment management, monitoring, alerting, and backup/recovery procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Migrations](#database-migrations)
4. [Deployment Process](#deployment-process)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Backup & Recovery](#backup--recovery)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Supabase CLI
- Git

### Required Accounts & Services
- Supabase account with projects for each environment
- Mailtrap account with API access
- AWS S3 (for production backups) - optional
- Slack workspace (for alerts) - optional

### Environment Projects
- **Development**: Local Supabase or development project
- **Staging**: Dedicated Supabase project for staging
- **Production**: `pxzccwwvzpvyceumnekw` (current production project)

## Environment Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

The system supports three environments with specific configurations:

#### Development Environment
```bash
# Copy and customize development environment
cp config/environments/development.env .env.development

# Edit with your development values
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key
MAILTRAP_API_KEY=your_dev_mailtrap_key
# ... other development settings
```

#### Staging Environment
```bash
# Copy and customize staging environment
cp config/environments/staging.env .env.staging

# Edit with your staging values
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key
MAILTRAP_API_KEY=your_staging_mailtrap_key
# ... other staging settings
```

#### Production Environment
```bash
# Copy and customize production environment
cp config/environments/production.env .env.production

# Edit with your production values
SUPABASE_URL=https://pxzccwwvzpvyceumnekw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
MAILTRAP_API_KEY=your_production_mailtrap_key
# ... other production settings
```

### 3. Validate Environment Configuration

```bash
# Validate environment setup
npm run env:validate

# Validate specific environment
npm run deploy:validate -- --environment production
```

## Database Migrations

### Running Migrations

The system uses a comprehensive migration system that tracks changes across environments:

```bash
# Run migrations for development
npm run migrate:dev

# Run migrations for staging
npm run migrate:staging

# Run migrations for production (requires extra confirmation)
npm run migrate:prod

# Check migration status
npm run migrate:status -- staging

# Validate migration integrity
npm run migrate:validate -- production
```

### Available Migrations

1. **20250710001114_create_email_campaign_schema.sql** - Core email system schema
2. **20250710002156_email_campaign_functions.sql** - Database functions
3. **20250712000000_enable_realtime.sql** - Real-time monitoring
4. **20250117000000_setup_cron_jobs.sql** - Cron job system
5. **20250118000000_create_contact_lists_segments.sql** - Contact management
6. **20250119000000_create_webhook_system.sql** - Webhook processing
7. **20250119000001_create_backup_system.sql** - Backup and monitoring
8. **environment-config.sql** - Environment-specific configurations

### Migration Rollback

```bash
# Rollback last migration (if rollback SQL available)
npm run migrate:rollback -- production
```

## Deployment Process

### Quick Deployment Commands

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production (requires confirmation)
npm run deploy:prod

# Deploy only functions
npm run deploy:functions -- --environment staging

# Dry run (see what would be deployed)
npm run deploy:dry-run -- --environment production
```

### Full Deployment Process

#### 1. Pre-Deployment Checks

```bash
# Validate environment
npm run deploy:validate -- --environment staging

# Run tests
npm run test:all

# Security scan
npm run security-scan
```

#### 2. Deploy to Staging

```bash
# Full staging deployment
npm run deploy:staging
```

This will:
- Run pre-deployment hooks (tests, linting)
- Apply database migrations
- Deploy all edge functions
- Configure cron jobs
- Run post-deployment tests

#### 3. Staging Validation

```bash
# Run staging smoke tests
npm run smoke-test:staging

# Check staging health
npm run health-check:staging

# Monitor staging metrics
npm run monitor:dashboard -- --environment staging
```

#### 4. Production Deployment

```bash
# Deploy to production (requires confirmation)
npm run deploy:prod

# Or force deployment (skip confirmation)
npm run deploy:prod -- --force
```

### Deployment Components

#### Edge Functions
- **email-processor**: Processes email queue in batches
- **webhook-handler**: Handles Mailtrap webhooks
- **campaign-scheduler**: Manages scheduled campaigns
- **bounce-processor**: Processes bounce notifications
- **webhook-mailtrap**: Legacy webhook handler

#### Cron Jobs
- **email-processor-job**: Every minute (production), every 2 minutes (dev)
- **status-updater-job**: Every 5 minutes
- **campaign-scheduler-job**: Every minute
- **bounce-handler-job**: Every 15 minutes
- **log-cleanup-job**: Daily at 2 AM (production), 6 AM (dev)

### Environment-Specific Settings

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| Email Batch Size | 2 | 3 | 4 |
| Campaign Batch Size | 2 | 3 | 5 |
| Rate Limiting | Disabled | Enabled | Enabled |
| Webhook Verification | Disabled | Enabled | Enabled |
| Log Level | debug | info | warn |
| Backup Enabled | false | true | true |
| Alert Email | false | false | true |

## Monitoring & Alerting

### Health Monitoring

```bash
# Run health check
npm run monitor:health -- --environment production

# Collect metrics
npm run monitor:metrics -- --environment production

# Check for alerts
npm run monitor:alerts -- --environment production

# View monitoring dashboard
npm run monitor:dashboard -- --environment production
```

### Monitoring Components

#### Health Checks
- Database connectivity and performance
- Email queue health
- Cron jobs status
- Mailtrap API accessibility
- Edge functions availability
- System resources (CPU, memory)

#### Metrics Collection
- Email queue size
- Failed jobs count
- Success rate (24h)
- Average response time
- Active campaigns
- Total emails sent (24h)
- Bounce rate (24h)

#### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Queue Size | 800 | 1000 |
| Failure Rate | 8% | 10% |
| Response Time | 24s | 30s |
| Bounce Rate | 3% | 5% |

### Alert Channels

#### Email Alerts
```env
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@momentumbusiness.capital,ops@momentumbusiness.capital
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
```

#### Slack Alerts
```env
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/slack/webhook
```

#### Custom Webhooks
```env
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
ALERT_WEBHOOK_TOKEN=your_webhook_token
```

## Backup & Recovery

### Automated Backups

#### Configuration
```env
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30   # Staging: 30, Production: 365
BACKUP_STORAGE_TYPE=s3     # local, s3, gcs
BACKUP_S3_BUCKET=momentum-production-backups
```

#### Backup Types

1. **Full Backup**: Complete database dump
2. **Incremental Backup**: Changes since last backup
3. **Configuration Backup**: Environment settings and cron jobs

### Manual Backup Operations

```bash
# Create full backup
npm run backup:full -- --environment production

# Create incremental backup
npm run backup:incremental -- --environment production

# Create configuration backup
npm run backup:config -- --environment production

# List available backups
npm run backup:list -- --environment production

# Verify backup integrity
npm run backup:verify -- --backup-id your-backup-id

# Clean up old backups
npm run backup:cleanup -- --environment production
```

### Disaster Recovery

#### Restore from Backup

```bash
# List available backups
npm run backup:list -- --environment production

# Dry run restore (see what would be restored)
npm run backup:restore -- --backup-id backup-id --dry-run

# Restore from backup (requires confirmation for production)
npm run backup:restore -- --backup-id backup-id --environment production

# Force restore (skip confirmation)
npm run backup:restore -- --backup-id backup-id --force
```

#### Recovery Procedures

1. **Database Corruption**:
   ```bash
   # Restore from latest full backup
   npm run backup:restore -- --backup-id latest-full-backup
   ```

2. **Configuration Loss**:
   ```bash
   # Restore configuration only
   npm run backup:restore -- --backup-id config-backup --tables environment_config,cron_job_config
   ```

3. **Partial Data Loss**:
   ```bash
   # Restore specific tables
   npm run backup:restore -- --backup-id backup-id --tables email_campaigns,email_logs
   ```

### Backup Storage

#### Local Storage
- Development: `backups/development/`
- Files stored locally with compression

#### S3 Storage (Production)
- Bucket: `momentum-production-backups`
- Encryption: AES-256
- Lifecycle: 365 days retention
- Cross-region replication available

## Troubleshooting

### Common Issues

#### Deployment Failures

**Issue**: Migration fails during deployment
```bash
# Check migration status
npm run migrate:status -- production

# Validate migration integrity
npm run migrate:validate -- production

# Rollback if needed
npm run migrate:rollback -- production
```

**Issue**: Edge function deployment fails
```bash
# Deploy functions individually
npm run deploy:functions -- --environment production

# Check function logs
npm run supabase:functions:logs -- email-processor
```

#### Environment Issues

**Issue**: Environment variables not loading
```bash
# Validate environment configuration
npm run env:validate -- --environment production

# Compare environments
npm run env:compare -- staging production
```

**Issue**: Cron jobs not running
```bash
# Check cron job status
npm run cron:status -- --environment production

# View cron job logs
npm run cron:logs -- --environment production

# Restart cron jobs
npm run cron:restart -- --environment production
```

#### Monitoring Issues

**Issue**: Health checks failing
```bash
# Run manual health check
npm run monitor:health -- --environment production

# Check specific service
npm run health-check:production
```

**Issue**: Alerts not being sent
```bash
# Test alert configuration
npm run monitor:alerts -- --environment production --test

# Check alert channel configuration
npm run env:validate -- --environment production
```

#### Backup Issues

**Issue**: Backup creation fails
```bash
# Verify backup permissions
npm run backup:verify -- --environment production

# Check storage configuration
npm run env:validate -- --environment production

# Create manual backup
npm run backup:full -- --environment production --verbose
```

**Issue**: Restore fails
```bash
# Verify backup integrity
npm run backup:verify -- --backup-id backup-id

# Check restore target environment
npm run env:validate -- --environment production

# Perform dry run first
npm run backup:restore -- --backup-id backup-id --dry-run
```

### Support Contacts

- **Development Issues**: Contact development team
- **Staging Issues**: Run staging tests and validate configuration
- **Production Issues**:
  1. Check monitoring dashboard
  2. Review recent alerts
  3. Validate system health
  4. Contact operations team if needed

### Useful Commands

```bash
# Check overall system status
npm run deploy:status -- --environment production

# View deployment configuration
npm run deploy:validate -- --environment production

# Monitor system in real-time
npm run monitor:dashboard -- --environment production

# Emergency health check
npm run health-check:production

# Emergency backup
npm run backup:full -- --environment production

# Emergency cron job restart
npm run cron:restart -- --environment production
```

## Best Practices

### Deployment
1. Always test in staging before production
2. Use dry-run for production deployments
3. Monitor system after deployment
4. Keep rollback plan ready

### Environment Management
1. Use environment-specific configurations
2. Validate environment before deployment
3. Document environment changes
4. Regular environment audits

### Monitoring
1. Set up appropriate alert thresholds
2. Monitor key metrics continuously
3. Review alerts regularly
4. Document incident responses

### Backup & Recovery
1. Test backup and restore procedures regularly
2. Verify backup integrity
3. Maintain multiple backup types
4. Document recovery procedures
5. Practice disaster recovery scenarios

## Conclusion

This deployment system provides comprehensive environment management with automated deployment, monitoring, alerting, and backup/recovery capabilities. The system is designed for enterprise-scale email operations with proper separation of environments and comprehensive operational procedures.

For additional help, refer to the specific documentation files:
- [CRON-MANAGEMENT.md](./CRON-MANAGEMENT.md) - Cron job management
- [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) - Edge function documentation
- [WEBHOOK-SYSTEM.md](./WEBHOOK-SYSTEM.md) - Webhook processing
- [TEMPLATE-ENGINE.md](./TEMPLATE-ENGINE.md) - Template engine documentation
