import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// =============================================
// MONITORING AND ALERTING SERVICE
// =============================================

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: any;
  timestamp: Date;
}

interface SystemMetrics {
  timestamp: Date;
  email_queue_size: number;
  failed_jobs_count: number;
  success_rate_24h: number;
  avg_response_time: number;
  active_campaigns: number;
  total_emails_sent_24h: number;
  bounce_rate_24h: number;
  memory_usage?: number;
  cpu_usage?: number;
}

interface AlertThresholds {
  queue_size_critical: number;
  queue_size_warning: number;
  failure_rate_critical: number;
  failure_rate_warning: number;
  response_time_critical: number;
  response_time_warning: number;
  bounce_rate_critical: number;
  bounce_rate_warning: number;
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook';
  config: any;
  enabled: boolean;
}

export class MonitoringService {
  private supabase: any;
  private environment: string;
  private thresholds: AlertThresholds;
  private alertChannels: AlertChannel[];
  private lastAlertTime: Map<string, Date> = new Map();
  private alertCooldown: number = 300000; // 5 minutes

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.thresholds = this.loadAlertThresholds();
    this.alertChannels = this.loadAlertChannels();
  }

  /**
   * Load alert thresholds from environment or database
   */
  private loadAlertThresholds(): AlertThresholds {
    return {
      queue_size_critical: parseInt(process.env.ALERT_QUEUE_SIZE_THRESHOLD || '1000'),
      queue_size_warning: parseInt(process.env.ALERT_QUEUE_SIZE_THRESHOLD || '1000') * 0.8,
      failure_rate_critical: parseInt(process.env.ALERT_FAILURE_RATE_THRESHOLD || '10'),
      failure_rate_warning: parseInt(process.env.ALERT_FAILURE_RATE_THRESHOLD || '10') * 0.8,
      response_time_critical: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '30000'),
      response_time_warning: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '30000') * 0.8,
      bounce_rate_critical: 5.0, // 5%
      bounce_rate_warning: 3.0   // 3%
    };
  }

  /**
   * Load alert channels configuration
   */
  private loadAlertChannels(): AlertChannel[] {
    const channels: AlertChannel[] = [];

    // Email alerts
    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      channels.push({
        type: 'email',
        config: {
          recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(','),
          smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD
            }
          }
        },
        enabled: true
      });
    }

    // Slack alerts
    if (process.env.ALERT_SLACK_WEBHOOK_URL) {
      channels.push({
        type: 'slack',
        config: {
          webhook_url: process.env.ALERT_SLACK_WEBHOOK_URL
        },
        enabled: true
      });
    }

    // Custom webhook alerts
    if (process.env.ALERT_WEBHOOK_URL) {
      channels.push({
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ALERT_WEBHOOK_TOKEN
          }
        },
        enabled: true
      });
    }

    return channels;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult[]> {
    console.log('🔍 Performing health check...');

    const checks: HealthCheckResult[] = [];

    // Database health check
    checks.push(await this.checkDatabaseHealth());

    // Email queue health check
    checks.push(await this.checkEmailQueueHealth());

    // Cron jobs health check
    checks.push(await this.checkCronJobsHealth());

    // Mailtrap API health check
    checks.push(await this.checkMailtrapHealth());

    // Edge functions health check
    checks.push(await this.checkEdgeFunctionsHealth());

    // System resources check
    checks.push(await this.checkSystemResources());

    return checks;
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.supabase
        .from('email_campaigns')
        .select('count(*)')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          service: 'database',
          status: 'unhealthy',
          responseTime,
          message: `Database error: ${error.message}`,
          timestamp: new Date()
        };
      }

      const status = responseTime > 5000 ? 'degraded' : 'healthy';

      return {
        service: 'database',
        status,
        responseTime,
        message: status === 'degraded' ? 'Database responding slowly' : 'Database healthy',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check email queue health
   */
  private async checkEmailQueueHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const { data: queueData, error } = await this.supabase
        .from('email_queue')
        .select('status, created_at')
        .in('status', ['pending', 'failed']);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          service: 'email_queue',
          status: 'unhealthy',
          responseTime,
          message: `Queue check failed: ${error.message}`,
          timestamp: new Date()
        };
      }

      const pendingCount = queueData?.filter(item => item.status === 'pending').length || 0;
      const failedCount = queueData?.filter(item => item.status === 'failed').length || 0;
      const oldPendingCount = queueData?.filter(item =>
        item.status === 'pending' &&
        new Date(item.created_at) < new Date(Date.now() - 3600000) // 1 hour old
      ).length || 0;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Email queue healthy';

      if (pendingCount > this.thresholds.queue_size_critical || oldPendingCount > 50) {
        status = 'unhealthy';
        message = `Queue critical: ${pendingCount} pending, ${oldPendingCount} stale`;
      } else if (pendingCount > this.thresholds.queue_size_warning || oldPendingCount > 20) {
        status = 'degraded';
        message = `Queue warning: ${pendingCount} pending, ${oldPendingCount} stale`;
      }

      return {
        service: 'email_queue',
        status,
        responseTime,
        message,
        details: {
          pending_count: pendingCount,
          failed_count: failedCount,
          old_pending_count: oldPendingCount
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        service: 'email_queue',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Queue health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check cron jobs health
   */
  private async checkCronJobsHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check recent cron job executions
      const { data: cronLogs, error } = await this.supabase
        .from('cron_job_logs')
        .select('job_name, success, started_at, execution_time_ms')
        .gte('started_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('started_at', { ascending: false });

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          service: 'cron_jobs',
          status: 'unhealthy',
          responseTime,
          message: `Cron jobs check failed: ${error.message}`,
          timestamp: new Date()
        };
      }

      if (!cronLogs || cronLogs.length === 0) {
        return {
          service: 'cron_jobs',
          status: 'degraded',
          responseTime,
          message: 'No recent cron job executions found',
          timestamp: new Date()
        };
      }

      const totalJobs = cronLogs.length;
      const failedJobs = cronLogs.filter(log => !log.success).length;
      const failureRate = (failedJobs / totalJobs) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Cron jobs healthy';

      if (failureRate > this.thresholds.failure_rate_critical) {
        status = 'unhealthy';
        message = `Cron jobs critical: ${failureRate.toFixed(1)}% failure rate`;
      } else if (failureRate > this.thresholds.failure_rate_warning) {
        status = 'degraded';
        message = `Cron jobs warning: ${failureRate.toFixed(1)}% failure rate`;
      }

      return {
        service: 'cron_jobs',
        status,
        responseTime,
        message,
        details: {
          total_jobs: totalJobs,
          failed_jobs: failedJobs,
          failure_rate: failureRate,
          recent_failures: cronLogs.filter(log => !log.success).slice(0, 5)
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        service: 'cron_jobs',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Cron jobs health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check Mailtrap API health
   */
  private async checkMailtrapHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple API call to check Mailtrap connectivity
      const response = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MAILTRAP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: { email: 'test@example.com' },
          to: [{ email: 'test@example.com' }],
          subject: 'Health Check',
          text: 'This is a health check email'
        })
      });

      const responseTime = Date.now() - startTime;

      // We expect this to fail (invalid email), but we want to check API accessibility
      const status = response.status === 422 ? 'healthy' :
                   response.status >= 500 ? 'unhealthy' : 'degraded';

      return {
        service: 'mailtrap_api',
        status,
        responseTime,
        message: status === 'healthy' ? 'Mailtrap API accessible' :
                `Mailtrap API status: ${response.status}`,
        details: {
          status_code: response.status
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        service: 'mailtrap_api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Mailtrap API unreachable: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check edge functions health
   */
  private async checkEdgeFunctionsHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check one of the edge functions
      const functionUrl = `${process.env.SUPABASE_URL}/functions/v1/email-processor`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ health_check: true })
      });

      const responseTime = Date.now() - startTime;

      const status = response.ok ? 'healthy' :
                   response.status >= 500 ? 'unhealthy' : 'degraded';

      return {
        service: 'edge_functions',
        status,
        responseTime,
        message: status === 'healthy' ? 'Edge functions accessible' :
                `Edge functions status: ${response.status}`,
        details: {
          status_code: response.status,
          function_url: functionUrl
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        service: 'edge_functions',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Edge functions unreachable: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check system resources
   */
  private async checkSystemResources(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const os = require('os');
      const memoryUsage = process.memoryUsage();
      const cpuUsage = os.loadavg()[0]; // 1-minute load average

      const memoryUsedMB = memoryUsage.rss / 1024 / 1024;
      const totalMemoryMB = os.totalmem() / 1024 / 1024;
      const memoryUsagePercent = (memoryUsedMB / totalMemoryMB) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'System resources healthy';

      if (memoryUsagePercent > 90 || cpuUsage > 4) {
        status = 'unhealthy';
        message = 'System resources critical';
      } else if (memoryUsagePercent > 75 || cpuUsage > 2) {
        status = 'degraded';
        message = 'System resources elevated';
      }

      return {
        service: 'system_resources',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          memory_used_mb: Math.round(memoryUsedMB),
          memory_total_mb: Math.round(totalMemoryMB),
          memory_usage_percent: Math.round(memoryUsagePercent),
          cpu_load_avg: cpuUsage.toFixed(2),
          uptime_hours: Math.round(process.uptime() / 3600)
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        service: 'system_resources',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        message: `System resources check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Collect system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    console.log('📊 Collecting system metrics...');

    try {
      // Get email queue size
      const { data: queueData } = await this.supabase
        .from('email_queue')
        .select('count(*)')
        .eq('status', 'pending');

      // Get failed jobs count (last 24 hours)
      const { data: failedJobs } = await this.supabase
        .from('cron_job_logs')
        .select('count(*)')
        .eq('success', false)
        .gte('started_at', new Date(Date.now() - 86400000).toISOString());

      // Get success rate (last 24 hours)
      const { data: allJobs } = await this.supabase
        .from('cron_job_logs')
        .select('success')
        .gte('started_at', new Date(Date.now() - 86400000).toISOString());

      const successRate = allJobs && allJobs.length > 0
        ? (allJobs.filter(job => job.success).length / allJobs.length) * 100
        : 100;

      // Get average response time
      const { data: responseTimes } = await this.supabase
        .from('cron_job_logs')
        .select('execution_time_ms')
        .gte('started_at', new Date(Date.now() - 86400000).toISOString())
        .not('execution_time_ms', 'is', null);

      const avgResponseTime = responseTimes && responseTimes.length > 0
        ? responseTimes.reduce((sum, job) => sum + job.execution_time_ms, 0) / responseTimes.length
        : 0;

      // Get active campaigns
      const { data: activeCampaigns } = await this.supabase
        .from('email_campaigns')
        .select('count(*)')
        .eq('status', 'running');

      // Get total emails sent (last 24 hours)
      const { data: emailsSent } = await this.supabase
        .from('email_logs')
        .select('count(*)')
        .gte('sent_at', new Date(Date.now() - 86400000).toISOString());

      // Get bounce rate (last 24 hours)
      const { data: bounces } = await this.supabase
        .from('email_logs')
        .select('status')
        .gte('sent_at', new Date(Date.now() - 86400000).toISOString())
        .in('status', ['sent', 'delivered', 'bounced']);

      const bounceRate = bounces && bounces.length > 0
        ? (bounces.filter(email => email.status === 'bounced').length / bounces.length) * 100
        : 0;

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        email_queue_size: queueData?.[0]?.count || 0,
        failed_jobs_count: failedJobs?.[0]?.count || 0,
        success_rate_24h: successRate,
        avg_response_time: avgResponseTime,
        active_campaigns: activeCampaigns?.[0]?.count || 0,
        total_emails_sent_24h: emailsSent?.[0]?.count || 0,
        bounce_rate_24h: bounceRate
      };

      // Store metrics in database
      await this.supabase
        .from('system_metrics')
        .insert(metrics);

      return metrics;

    } catch (error) {
      console.error('Failed to collect metrics:', error);
      throw error;
    }
  }

  /**
   * Send alert based on health check results
   */
  async sendAlert(severity: 'warning' | 'critical', title: string, message: string, details?: any): Promise<void> {
    const alertKey = `${severity}-${title}`;
    const lastAlert = this.lastAlertTime.get(alertKey);

    // Check cooldown period
    if (lastAlert && Date.now() - lastAlert.getTime() < this.alertCooldown) {
      console.log(`⏰ Alert cooldown active for: ${alertKey}`);
      return;
    }

    console.log(`🚨 Sending ${severity} alert: ${title}`);

    const alert = {
      environment: this.environment,
      severity,
      title,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    // Send to all enabled alert channels
    for (const channel of this.alertChannels) {
      if (channel.enabled) {
        try {
          await this.sendAlertToChannel(channel, alert);
        } catch (error) {
          console.error(`Failed to send alert via ${channel.type}:`, error);
        }
      }
    }

    // Update last alert time
    this.lastAlertTime.set(alertKey, new Date());

    // Store alert in database
    await this.supabase
      .from('system_alerts')
      .insert({
        environment: this.environment,
        severity,
        title,
        message,
        details,
        sent_at: new Date().toISOString()
      });
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(channel: AlertChannel, alert: any): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailAlert(channel.config, alert);
        break;
      case 'slack':
        await this.sendSlackAlert(channel.config, alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(channel.config, alert);
        break;
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(config: any, alert: any): Promise<void> {
    const transporter = nodemailer.createTransport(config.smtp);

    const emailContent = `
      Alert: ${alert.title}

      Environment: ${alert.environment}
      Severity: ${alert.severity.toUpperCase()}
      Time: ${alert.timestamp}

      Message: ${alert.message}

      ${alert.details ? `Details: ${JSON.stringify(alert.details, null, 2)}` : ''}

      --
      Momentum Email System Monitoring
    `;

    for (const recipient of config.recipients) {
      await transporter.sendMail({
        from: process.env.DEFAULT_FROM_EMAIL || 'alerts@momentumbusiness.capital',
        to: recipient,
        subject: `[${alert.severity.toUpperCase()}] ${alert.title} - ${alert.environment}`,
        text: emailContent
      });
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(config: any, alert: any): Promise<void> {
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const emoji = alert.severity === 'critical' ? '🔴' : '⚠️';

    const payload = {
      text: `${emoji} Alert: ${alert.title}`,
      attachments: [{
        color,
        fields: [
          { title: 'Environment', value: alert.environment, short: true },
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Message', value: alert.message, short: false },
          { title: 'Time', value: alert.timestamp, short: true }
        ]
      }]
    };

    if (alert.details) {
      payload.attachments[0].fields.push({
        title: 'Details',
        value: `\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``,
        short: false
      });
    }

    await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(config: any, alert: any): Promise<void> {
    await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(alert)
    });
  }

  /**
   * Run monitoring cycle
   */
  async runMonitoringCycle(): Promise<void> {
    console.log('🔄 Starting monitoring cycle...');

    try {
      // Perform health checks
      const healthResults = await this.performHealthCheck();

      // Collect metrics
      const metrics = await this.collectMetrics();

      // Check for alerts
      await this.checkAlertConditions(healthResults, metrics);

      console.log('✅ Monitoring cycle completed');

    } catch (error) {
      console.error('❌ Monitoring cycle failed:', error);

      // Send critical alert about monitoring failure
      await this.sendAlert(
        'critical',
        'Monitoring System Failure',
        `Monitoring cycle failed: ${error instanceof Error ? error.message : String(error)}`,
        { error: error instanceof Error ? error.stack : String(error) }
      );
    }
  }

  /**
   * Check alert conditions and send alerts if needed
   */
  private async checkAlertConditions(healthResults: HealthCheckResult[], metrics: SystemMetrics): Promise<void> {
    // Check unhealthy services
    const unhealthyServices = healthResults.filter(result => result.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      await this.sendAlert(
        'critical',
        'Unhealthy Services Detected',
        `${unhealthyServices.length} services are unhealthy`,
        { unhealthy_services: unhealthyServices }
      );
    }

    // Check degraded services
    const degradedServices = healthResults.filter(result => result.status === 'degraded');
    if (degradedServices.length > 0) {
      await this.sendAlert(
        'warning',
        'Degraded Services Detected',
        `${degradedServices.length} services are degraded`,
        { degraded_services: degradedServices }
      );
    }

    // Check queue size
    if (metrics.email_queue_size > this.thresholds.queue_size_critical) {
      await this.sendAlert(
        'critical',
        'Email Queue Critical',
        `Queue size is critical: ${metrics.email_queue_size} pending emails`,
        { queue_size: metrics.email_queue_size }
      );
    } else if (metrics.email_queue_size > this.thresholds.queue_size_warning) {
      await this.sendAlert(
        'warning',
        'Email Queue Warning',
        `Queue size is elevated: ${metrics.email_queue_size} pending emails`,
        { queue_size: metrics.email_queue_size }
      );
    }

    // Check failure rate
    const failureRate = 100 - metrics.success_rate_24h;
    if (failureRate > this.thresholds.failure_rate_critical) {
      await this.sendAlert(
        'critical',
        'High Failure Rate',
        `Failure rate is critical: ${failureRate.toFixed(1)}%`,
        { failure_rate: failureRate, success_rate: metrics.success_rate_24h }
      );
    } else if (failureRate > this.thresholds.failure_rate_warning) {
      await this.sendAlert(
        'warning',
        'Elevated Failure Rate',
        `Failure rate is elevated: ${failureRate.toFixed(1)}%`,
        { failure_rate: failureRate, success_rate: metrics.success_rate_24h }
      );
    }

    // Check bounce rate
    if (metrics.bounce_rate_24h > this.thresholds.bounce_rate_critical) {
      await this.sendAlert(
        'critical',
        'High Bounce Rate',
        `Bounce rate is critical: ${metrics.bounce_rate_24h.toFixed(1)}%`,
        { bounce_rate: metrics.bounce_rate_24h }
      );
    } else if (metrics.bounce_rate_24h > this.thresholds.bounce_rate_warning) {
      await this.sendAlert(
        'warning',
        'Elevated Bounce Rate',
        `Bounce rate is elevated: ${metrics.bounce_rate_24h.toFixed(1)}%`,
        { bounce_rate: metrics.bounce_rate_24h }
      );
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(): Promise<any> {
    const healthResults = await this.performHealthCheck();
    const metrics = await this.collectMetrics();

    // Get recent alerts
    const { data: recentAlerts } = await this.supabase
      .from('system_alerts')
      .select('*')
      .gte('sent_at', new Date(Date.now() - 86400000).toISOString()) // Last 24 hours
      .order('sent_at', { ascending: false })
      .limit(10);

    // Get metrics history
    const { data: metricsHistory } = await this.supabase
      .from('system_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 86400000).toISOString()) // Last 24 hours
      .order('timestamp', { ascending: true });

    return {
      health_status: healthResults,
      current_metrics: metrics,
      recent_alerts: recentAlerts || [],
      metrics_history: metricsHistory || [],
      thresholds: this.thresholds,
      environment: this.environment
    };
  }
}

export { AlertThresholds, HealthCheckResult, SystemMetrics };
