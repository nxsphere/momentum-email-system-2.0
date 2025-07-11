# Supabase Infrastructure Monitoring Setup Guide

This guide walks you through setting up comprehensive infrastructure monitoring for your Momentum Email System using Supabase's Prometheus metrics endpoint.

## Overview

The infrastructure monitoring system provides:
- **Database Performance**: Query times, connections, cache hit ratios
- **Edge Function Metrics**: Invocations, errors, response times, memory usage
- **API Performance**: Request rates, error rates, response times
- **Storage & Auth**: Storage size, user counts, session activity
- **Real-time**: Connection counts, message rates, channel activity
- **Automated Alerting**: Configurable thresholds and notifications
- **Grafana Dashboard**: Visual monitoring with 14+ panels

## Prerequisites

- Supabase project with Pro plan or higher (metrics endpoint access)
- Service role key with appropriate permissions
- Node.js environment for running the monitoring service
- Optional: Grafana instance for advanced visualization

## 1. Environment Configuration

### 1.1 Update Environment Variables

Add the following to your environment configuration:

```env
# Supabase Infrastructure Metrics
SUPABASE_METRICS_ENABLED=true
SUPABASE_METRICS_ENDPOINT=https://your-project-id.supabase.co/customer/v1/privileged/metrics
SUPABASE_METRICS_INTERVAL=60000 # Collection interval (60 seconds)
SUPABASE_METRICS_RETENTION_DAYS=30

# Infrastructure Alert Thresholds
INFRA_DB_RESPONSE_TIME_WARNING=2000    # milliseconds
INFRA_DB_RESPONSE_TIME_CRITICAL=5000   # milliseconds
INFRA_EDGE_FUNCTION_ERROR_RATE_WARNING=5     # percentage
INFRA_EDGE_FUNCTION_ERROR_RATE_CRITICAL=10   # percentage
INFRA_API_REQUEST_RATE_WARNING=80       # percentage of limit
INFRA_API_REQUEST_RATE_CRITICAL=95      # percentage of limit

# Optional: Prometheus/Grafana Integration
PROMETHEUS_ENABLED=false
PROMETHEUS_PORT=9090
GRAFANA_ENABLED=false
GRAFANA_PORT=3000
```

### 1.2 Get Your Metrics Endpoint URL

Your Supabase metrics endpoint follows this format:
```
https://<PROJECT_REF>.supabase.co/customer/v1/privileged/metrics
```

Replace `<PROJECT_REF>` with your actual project reference ID from the Supabase dashboard.

## 2. Database Setup

### 2.1 Run the Infrastructure Metrics Migration

Apply the infrastructure metrics migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply the specific migration
psql -h your-db-host -d your-db -f supabase/migrations/20250121000000_create_infrastructure_metrics.sql
```

This creates:
- `infrastructure_metrics` - Main metrics storage table
- `edge_function_metrics` - Detailed edge function performance
- `infrastructure_alert_rules` - Configurable alert thresholds
- Helper functions for trends and alerts
- Dashboard views for aggregated data

### 2.2 Verify Database Tables

Check that the tables were created successfully:

```sql
-- Check infrastructure metrics table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'infrastructure_metrics';

-- Check alert rules
SELECT * FROM infrastructure_alert_rules WHERE environment = 'production';

-- Check dashboard views
SELECT * FROM infrastructure_metrics_dashboard LIMIT 1;
```

## 3. Service Integration

### 3.1 Initialize Infrastructure Monitoring

Update your main application to include infrastructure monitoring:

```typescript
import { MonitoringService } from './src/services/monitoring.service';

const monitoringService = new MonitoringService();

// Start infrastructure metrics collection
monitoringService.startInfrastructureMetricsCollection();

// Run monitoring cycle (includes both app and infrastructure metrics)
setInterval(async () => {
  await monitoringService.runMonitoringCycle();
}, 60000); // Every minute
```

### 3.2 Manual Metrics Collection

You can also collect metrics manually:

```typescript
import { InfrastructureMetricsService } from './src/services/infrastructure-metrics.service';

const infraService = new InfrastructureMetricsService();

// Collect metrics once
const metrics = await infraService.collectMetrics();
console.log('Infrastructure metrics:', metrics);

// Get latest metrics from database
const latest = await infraService.getLatestMetrics();

// Get trends
const trends = await infraService.getTrends(24); // Last 24 hours

// Check alerts
const alerts = await infraService.checkAlerts();
```

## 4. Alert Configuration

### 4.1 Default Alert Rules

The system comes with pre-configured alert rules for production and staging:

**Production Thresholds:**
- Database Query P95: Warning 2s, Critical 5s
- Edge Function Errors: Warning 10, Critical 50
- API Error Rate: Warning 5%, Critical 10%
- API Response Time P95: Warning 3s, Critical 10s

**Staging Thresholds:**
- Database Query P95: Warning 3s, Critical 8s
- Edge Function Errors: Warning 20, Critical 100
- API Error Rate: Warning 8%, Critical 15%
- API Response Time P95: Warning 5s, Critical 15s

### 4.2 Custom Alert Rules

Add custom alert rules via SQL:

```sql
INSERT INTO infrastructure_alert_rules (
  environment,
  metric_name,
  alert_type,
  threshold_warning,
  threshold_critical,
  comparison_operator,
  alert_title,
  alert_description
) VALUES (
  'production',
  'db_connections_active',
  'threshold',
  80,
  95,
  'gte',
  'High Database Connection Usage',
  'Database connection pool is approaching capacity'
);
```

### 4.3 Alert Channels

Configure alert channels in your environment:

```env
# Email Alerts
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@momentumbusiness.capital,ops@momentumbusiness.capital

# Slack Alerts
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/slack/webhook

# Custom Webhook
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
ALERT_WEBHOOK_TOKEN=your_webhook_token
```

## 5. Grafana Dashboard Setup

### 5.1 Import Dashboard

1. Open Grafana
2. Go to **Dashboards** → **Import**
3. Upload the `grafana-dashboard.json` file
4. Configure data sources:
   - **PostgreSQL**: Point to your Supabase database
   - **Prometheus**: (Optional) Point to Supabase metrics endpoint

### 5.2 Data Source Configuration

**PostgreSQL Data Source:**
```
Host: db.your-project-ref.supabase.co:5432
Database: postgres
User: postgres
Password: your-database-password
SSL Mode: require
```

**Prometheus Data Source (Optional):**
```
URL: https://your-project-ref.supabase.co/customer/v1/privileged/metrics
Auth: Basic Auth
User: service_role
Password: your-service-role-key
```

### 5.3 Dashboard Features

The dashboard includes:
- **System Overview**: High-level metrics and health status
- **Email Performance**: Queue size, success rates, bounce rates
- **Database Performance**: Query times, connections, transactions
- **Edge Function Performance**: Invocations, errors, response times
- **API Performance**: Request rates, error rates
- **Infrastructure Health**: Storage, auth, real-time metrics
- **Alert Management**: Recent alerts and status

## 6. Monitoring Best Practices

### 6.1 Collection Intervals

- **Production**: 60 seconds (default)
- **Staging**: 120 seconds
- **Development**: 300 seconds

### 6.2 Data Retention

- **Infrastructure Metrics**: 30 days (configurable)
- **Alert History**: 90 days
- **Health Check Results**: 7 days

### 6.3 Performance Considerations

- Monitor collection duration (should be < 10 seconds)
- Set appropriate alert thresholds for your usage patterns
- Use dashboard filters to focus on specific time ranges
- Regularly clean up old metrics data

## 7. Troubleshooting

### 7.1 Common Issues

**Metrics Collection Failing:**
```bash
# Check environment configuration
echo $SUPABASE_METRICS_ENDPOINT
echo $SUPABASE_SERVICE_ROLE_KEY

# Test endpoint manually
curl -u "service_role:$SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_METRICS_ENDPOINT"
```

**No Data in Dashboard:**
```sql
-- Check if metrics are being collected
SELECT COUNT(*), MAX(timestamp)
FROM infrastructure_metrics
WHERE environment = 'production';

-- Check collection errors
SELECT collection_error, COUNT(*)
FROM infrastructure_metrics
WHERE collection_success = false
GROUP BY collection_error;
```

**Alerts Not Firing:**
```sql
-- Check alert rules
SELECT * FROM infrastructure_alert_rules WHERE enabled = true;

-- Test alert conditions
SELECT * FROM check_infrastructure_alerts('production');

-- Check recent alerts
SELECT * FROM system_alerts
WHERE sent_at >= NOW() - INTERVAL '1 day'
ORDER BY sent_at DESC;
```

### 7.2 Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
SUPABASE_METRICS_DEBUG=true
```

### 7.3 Health Checks

Monitor the monitoring system itself:

```typescript
// Check monitoring service health
const monitoringHealth = await monitoringService.performHealthCheck();
console.log('Monitoring health:', monitoringHealth);

// Check infrastructure metrics collection
const infraHealth = await infraService.getLatestMetrics();
console.log('Latest infrastructure metrics:', infraHealth);
```

## 8. Advanced Configuration

### 8.1 Custom Metrics Processing

Extend the metrics parser for custom Supabase metrics:

```typescript
// In infrastructure-metrics.service.ts
private parseCustomMetrics(rawMetrics: string): Partial<InfrastructureMetrics> {
  // Parse additional metrics specific to your setup
  const customMetrics = {};

  // Add custom parsing logic here

  return customMetrics;
}
```

### 8.2 Multi-Environment Setup

Configure environment-specific settings:

```typescript
// Different collection intervals per environment
const collectionInterval = {
  production: 60000,
  staging: 120000,
  development: 300000
}[process.env.NODE_ENV] || 60000;
```

### 8.3 Integration with External Systems

Export metrics to external monitoring systems:

```typescript
// Export to external monitoring
async exportToExternal(metrics: InfrastructureMetrics) {
  if (process.env.DATADOG_API_KEY) {
    await this.sendToDatadog(metrics);
  }

  if (process.env.NEW_RELIC_LICENSE_KEY) {
    await this.sendToNewRelic(metrics);
  }
}
```

## 9. Security Considerations

- Store service role keys securely (use environment variables)
- Limit metrics endpoint access to monitoring services only
- Use read-only database connections for dashboard queries
- Regularly rotate service role keys
- Monitor for unusual metrics collection patterns

## 10. Support and Maintenance

### 10.1 Regular Maintenance Tasks

- **Weekly**: Review alert thresholds and adjust as needed
- **Monthly**: Clean up old metrics data and analyze trends
- **Quarterly**: Review and update alert rules
- **Annually**: Evaluate and upgrade monitoring infrastructure

### 10.2 Performance Optimization

- Index frequently queried metrics columns
- Partition large metrics tables by date
- Use materialized views for complex dashboard queries
- Implement metrics aggregation for long-term storage

---

## Next Steps

1. ✅ Complete environment configuration
2. ✅ Run database migrations
3. ✅ Start infrastructure metrics collection
4. ✅ Configure alerts and thresholds
5. ✅ Set up Grafana dashboard
6. ✅ Test end-to-end monitoring flow
7. ✅ Document operational procedures

For support, refer to the [API Reference](./API-REFERENCE.md) or contact the development team.
