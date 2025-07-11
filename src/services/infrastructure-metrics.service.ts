import { createClient } from '@supabase/supabase-js';

// =============================================
// SUPABASE INFRASTRUCTURE METRICS SERVICE
// =============================================

interface InfrastructureMetrics {
  timestamp: Date;
  environment: string;

  // Database metrics
  db_connections_active: number;
  db_connections_max: number;
  db_query_duration_p95: number;
  db_query_duration_p99: number;
  db_transactions_per_second: number;
  db_cache_hit_ratio: number;
  db_size_bytes: number;

  // Edge Functions metrics
  edge_function_invocations_total: number;
  edge_function_errors_total: number;
  edge_function_duration_p95: number;
  edge_function_duration_p99: number;
  edge_function_memory_usage_mb: number;
  edge_function_cpu_usage_percent: number;

  // API metrics
  api_requests_total: number;
  api_requests_per_second: number;
  api_response_time_p95: number;
  api_response_time_p99: number;
  api_error_rate: number;
  api_rate_limit_usage: number;

  // Storage metrics
  storage_size_bytes: number;
  storage_objects_count: number;
  storage_bandwidth_bytes: number;

  // Auth metrics
  auth_users_total: number;
  auth_sessions_active: number;
  auth_requests_per_second: number;

  // Real-time metrics
  realtime_connections_active: number;
  realtime_messages_per_second: number;
  realtime_channels_active: number;

  // Raw metrics data
  raw_metrics: any;

  // Collection metadata
  collection_duration_ms: number;
  collection_success: boolean;
  collection_error?: string;
}

interface EdgeFunctionMetrics {
  function_name: string;
  invocations_total: number;
  errors_total: number;
  duration_avg: number;
  duration_p95: number;
  duration_p99: number;
  memory_usage_avg_mb: number;
  memory_usage_max_mb: number;
  cpu_usage_avg_percent: number;
  cpu_usage_max_percent: number;
  cold_starts: number;
  timeout_errors: number;
}

interface PrometheusMetric {
  name: string;
  type: string;
  help: string;
  metrics: Array<{
    labels: Record<string, string>;
    value: number;
    timestamp?: number;
  }>;
}

export class InfrastructureMetricsService {
  private supabase: any;
  private environment: string;
  private metricsEndpoint: string;
  private serviceRoleKey: string;
  private collectionInterval: number;
  private enabled: boolean;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.metricsEndpoint = process.env.SUPABASE_METRICS_ENDPOINT || '';
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.collectionInterval = parseInt(process.env.SUPABASE_METRICS_INTERVAL || '60000');
    this.enabled = process.env.SUPABASE_METRICS_ENABLED === 'true';

    if (this.enabled && !this.metricsEndpoint) {
      console.warn('⚠️ Supabase metrics enabled but no endpoint configured');
      this.enabled = false;
    }
  }

  /**
   * Collect metrics from Supabase Prometheus endpoint
   */
  async collectMetrics(): Promise<InfrastructureMetrics | null> {
    if (!this.enabled) {
      console.log('ℹ️ Infrastructure metrics collection disabled');
      return null;
    }

    const startTime = Date.now();
    console.log('📊 Collecting Supabase infrastructure metrics...');

    try {
      // Fetch metrics from Prometheus endpoint
      const rawMetrics = await this.fetchPrometheusMetrics();

      // Parse and process the metrics
      const processedMetrics = this.parsePrometheusMetrics(rawMetrics);

      // Create infrastructure metrics object with defaults
      const metrics: InfrastructureMetrics = {
        timestamp: new Date(),
        environment: this.environment,
        db_connections_active: 0,
        db_connections_max: 0,
        db_query_duration_p95: 0,
        db_query_duration_p99: 0,
        db_transactions_per_second: 0,
        db_cache_hit_ratio: 0,
        db_size_bytes: 0,
        edge_function_invocations_total: 0,
        edge_function_errors_total: 0,
        edge_function_duration_p95: 0,
        edge_function_duration_p99: 0,
        edge_function_memory_usage_mb: 0,
        edge_function_cpu_usage_percent: 0,
        api_requests_total: 0,
        api_requests_per_second: 0,
        api_response_time_p95: 0,
        api_response_time_p99: 0,
        api_error_rate: 0,
        api_rate_limit_usage: 0,
        storage_size_bytes: 0,
        storage_objects_count: 0,
        storage_bandwidth_bytes: 0,
        auth_users_total: 0,
        auth_sessions_active: 0,
        auth_requests_per_second: 0,
        realtime_connections_active: 0,
        realtime_messages_per_second: 0,
        realtime_channels_active: 0,
        ...processedMetrics,
        raw_metrics: rawMetrics,
        collection_duration_ms: Date.now() - startTime,
        collection_success: true
      };

      // Store metrics in database
      await this.storeMetrics(metrics);

      // Collect and store edge function breakdown
      await this.collectEdgeFunctionMetrics(rawMetrics);

      console.log(`✅ Infrastructure metrics collected successfully (${metrics.collection_duration_ms}ms)`);
      return metrics;

    } catch (error) {
      console.error('❌ Failed to collect infrastructure metrics:', error);

      // Store failed collection attempt
      const failedMetrics: InfrastructureMetrics = {
        timestamp: new Date(),
        environment: this.environment,
        db_connections_active: 0,
        db_connections_max: 0,
        db_query_duration_p95: 0,
        db_query_duration_p99: 0,
        db_transactions_per_second: 0,
        db_cache_hit_ratio: 0,
        db_size_bytes: 0,
        edge_function_invocations_total: 0,
        edge_function_errors_total: 0,
        edge_function_duration_p95: 0,
        edge_function_duration_p99: 0,
        edge_function_memory_usage_mb: 0,
        edge_function_cpu_usage_percent: 0,
        api_requests_total: 0,
        api_requests_per_second: 0,
        api_response_time_p95: 0,
        api_response_time_p99: 0,
        api_error_rate: 0,
        api_rate_limit_usage: 0,
        storage_size_bytes: 0,
        storage_objects_count: 0,
        storage_bandwidth_bytes: 0,
        auth_users_total: 0,
        auth_sessions_active: 0,
        auth_requests_per_second: 0,
        realtime_connections_active: 0,
        realtime_messages_per_second: 0,
        realtime_channels_active: 0,
        raw_metrics: {},
        collection_duration_ms: Date.now() - startTime,
        collection_success: false,
        collection_error: error instanceof Error ? error.message : String(error)
      };

      await this.storeMetrics(failedMetrics);
      return null;
    }
  }

  /**
   * Fetch raw metrics from Supabase Prometheus endpoint
   */
  private async fetchPrometheusMetrics(): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(this.metricsEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`service_role:${this.serviceRoleKey}`).toString('base64')}`,
          'Accept': 'text/plain'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Prometheus endpoint returned ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse Prometheus metrics format
   */
  private parsePrometheusMetrics(rawMetrics: string): Partial<InfrastructureMetrics> {
    const metrics: Partial<InfrastructureMetrics> = {};
    const lines = rawMetrics.split('\n');

    let currentMetricName = '';
    const parsedMetrics: Record<string, PrometheusMetric> = {};

    for (const line of lines) {
      if (line.startsWith('#')) {
        // Comment line - extract metric metadata
        if (line.startsWith('# HELP')) {
          const match = line.match(/# HELP (\S+) (.+)/);
          if (match) {
            currentMetricName = match[1];
            if (!parsedMetrics[currentMetricName]) {
              parsedMetrics[currentMetricName] = {
                name: currentMetricName,
                type: '',
                help: match[2],
                metrics: []
              };
            }
          }
        } else if (line.startsWith('# TYPE')) {
          const match = line.match(/# TYPE (\S+) (\S+)/);
          if (match) {
            currentMetricName = match[1];
            if (!parsedMetrics[currentMetricName]) {
              parsedMetrics[currentMetricName] = {
                name: currentMetricName,
                type: match[2],
                help: '',
                metrics: []
              };
            } else {
              parsedMetrics[currentMetricName].type = match[2];
            }
          }
        }
      } else if (line.trim() && !line.startsWith('#')) {
        // Metric value line
        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*){([^}]*)} ([0-9.e+-]+)(?:\s+([0-9]+))?/);
        if (match) {
          const metricName = match[1];
          const labelsStr = match[2];
          const value = parseFloat(match[3]);
          const timestamp = match[4] ? parseInt(match[4]) : undefined;

          // Parse labels
          const labels: Record<string, string> = {};
          const labelMatches = labelsStr.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g);
          for (const labelMatch of labelMatches) {
            labels[labelMatch[1]] = labelMatch[2];
          }

          if (!parsedMetrics[metricName]) {
            parsedMetrics[metricName] = {
              name: metricName,
              type: '',
              help: '',
              metrics: []
            };
          }

          parsedMetrics[metricName].metrics.push({
            labels,
            value,
            timestamp
          });
        }
      }
    }

    // Extract specific metrics we care about
    metrics.db_connections_active = this.extractMetricValue(parsedMetrics, 'pg_stat_database_numbackends') || 0;
    metrics.db_connections_max = this.extractMetricValue(parsedMetrics, 'pg_settings_max_connections') || 0;
    metrics.db_query_duration_p95 = this.extractMetricValue(parsedMetrics, 'pg_stat_statements_mean_time', { quantile: '0.95' }) || 0;
    metrics.db_query_duration_p99 = this.extractMetricValue(parsedMetrics, 'pg_stat_statements_mean_time', { quantile: '0.99' }) || 0;
    metrics.db_cache_hit_ratio = this.extractMetricValue(parsedMetrics, 'pg_stat_database_blks_hit_ratio') || 0;

    // Edge function metrics (aggregated)
    metrics.edge_function_invocations_total = this.sumMetricValues(parsedMetrics, 'supabase_edge_function_invocations_total') || 0;
    metrics.edge_function_errors_total = this.sumMetricValues(parsedMetrics, 'supabase_edge_function_errors_total') || 0;
    metrics.edge_function_duration_p95 = this.extractMetricValue(parsedMetrics, 'supabase_edge_function_duration', { quantile: '0.95' }) || 0;
    metrics.edge_function_duration_p99 = this.extractMetricValue(parsedMetrics, 'supabase_edge_function_duration', { quantile: '0.99' }) || 0;

    // API metrics
    metrics.api_requests_total = this.sumMetricValues(parsedMetrics, 'supabase_api_requests_total') || 0;
    metrics.api_response_time_p95 = this.extractMetricValue(parsedMetrics, 'supabase_api_response_time', { quantile: '0.95' }) || 0;
    metrics.api_response_time_p99 = this.extractMetricValue(parsedMetrics, 'supabase_api_response_time', { quantile: '0.99' }) || 0;

    // Calculate derived metrics
    metrics.api_error_rate = this.calculateErrorRate(parsedMetrics, 'supabase_api_requests_total');
    metrics.db_transactions_per_second = this.calculateRatePerSecond(parsedMetrics, 'pg_stat_database_xact_commit');
    metrics.api_requests_per_second = this.calculateRatePerSecond(parsedMetrics, 'supabase_api_requests_total');

    // Storage metrics
    metrics.storage_size_bytes = this.extractMetricValue(parsedMetrics, 'supabase_storage_size_bytes') || 0;
    metrics.storage_objects_count = this.extractMetricValue(parsedMetrics, 'supabase_storage_objects_count') || 0;

    // Auth metrics
    metrics.auth_users_total = this.extractMetricValue(parsedMetrics, 'supabase_auth_users_total') || 0;
    metrics.auth_sessions_active = this.extractMetricValue(parsedMetrics, 'supabase_auth_sessions_active') || 0;

    // Real-time metrics
    metrics.realtime_connections_active = this.extractMetricValue(parsedMetrics, 'supabase_realtime_connections_active') || 0;
    metrics.realtime_channels_active = this.extractMetricValue(parsedMetrics, 'supabase_realtime_channels_active') || 0;

    return metrics;
  }

  /**
   * Extract a single metric value with optional label filtering
   */
  private extractMetricValue(
    parsedMetrics: Record<string, PrometheusMetric>,
    metricName: string,
    labelFilter?: Record<string, string>
  ): number | null {
    const metric = parsedMetrics[metricName];
    if (!metric || !metric.metrics.length) return null;

    let targetMetric = metric.metrics[0];

    if (labelFilter) {
      const filtered = metric.metrics.find(m => {
        return Object.entries(labelFilter).every(([key, value]) => m.labels[key] === value);
      });
      if (filtered) targetMetric = filtered;
    }

    return targetMetric.value;
  }

  /**
   * Sum all values for a metric
   */
  private sumMetricValues(parsedMetrics: Record<string, PrometheusMetric>, metricName: string): number {
    const metric = parsedMetrics[metricName];
    if (!metric || !metric.metrics.length) return 0;

    return metric.metrics.reduce((sum, m) => sum + m.value, 0);
  }

  /**
   * Calculate error rate percentage
   */
  private calculateErrorRate(parsedMetrics: Record<string, PrometheusMetric>, requestsMetricName: string): number {
    const totalRequests = this.sumMetricValues(parsedMetrics, requestsMetricName);
    const errorRequests = this.sumMetricValues(parsedMetrics, requestsMetricName.replace('_total', '_errors_total'));

    if (totalRequests === 0) return 0;
    return (errorRequests / totalRequests) * 100;
  }

  /**
   * Calculate rate per second (simple approximation)
   */
  private calculateRatePerSecond(parsedMetrics: Record<string, PrometheusMetric>, metricName: string): number {
    // This is a simplified calculation - in a real implementation, you'd want to
    // calculate the rate based on timestamps between consecutive measurements
    const totalValue = this.sumMetricValues(parsedMetrics, metricName);
    return totalValue / 60; // Assume 60-second collection interval
  }

  /**
   * Store metrics in the database
   */
  private async storeMetrics(metrics: InfrastructureMetrics): Promise<void> {
    const { error } = await this.supabase
      .from('infrastructure_metrics')
      .insert(metrics);

    if (error) {
      console.error('Failed to store infrastructure metrics:', error);
      throw error;
    }
  }

  /**
   * Collect detailed edge function metrics
   */
  private async collectEdgeFunctionMetrics(rawMetrics: string): Promise<void> {
    // Parse edge function specific metrics
    const edgeFunctionMetrics: EdgeFunctionMetrics[] = [];

    // Extract metrics for each edge function
    const functionNames = ['email-processor', 'bounce-processor', 'campaign-scheduler', 'webhook-handler', 'webhook-mailtrap'];

    for (const functionName of functionNames) {
      // This would need to be adapted based on actual Supabase metrics format
      const functionMetric: EdgeFunctionMetrics = {
        function_name: functionName,
        invocations_total: 0,
        errors_total: 0,
        duration_avg: 0,
        duration_p95: 0,
        duration_p99: 0,
        memory_usage_avg_mb: 0,
        memory_usage_max_mb: 0,
        cpu_usage_avg_percent: 0,
        cpu_usage_max_percent: 0,
        cold_starts: 0,
        timeout_errors: 0
      };

      edgeFunctionMetrics.push(functionMetric);
    }

    // Store edge function metrics (would need the infrastructure_metrics_id)
    // This is a placeholder - you'd need to adapt based on your actual implementation
  }

  /**
   * Get latest infrastructure metrics
   */
  async getLatestMetrics(): Promise<InfrastructureMetrics | null> {
    const { data, error } = await this.supabase
      .from('infrastructure_metrics')
      .select('*')
      .eq('environment', this.environment)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Failed to fetch latest infrastructure metrics:', error);
      return null;
    }

    return data;
  }

  /**
   * Get infrastructure trends
   */
  async getTrends(hours: number = 24): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('get_infrastructure_trends', {
        p_environment: this.environment,
        p_hours: hours
      });

    if (error) {
      console.error('Failed to fetch infrastructure trends:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Check infrastructure alerts
   */
  async checkAlerts(): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('check_infrastructure_alerts', {
        p_environment: this.environment
      });

    if (error) {
      console.error('Failed to check infrastructure alerts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Start automatic metrics collection
   */
  startAutomaticCollection(): void {
    if (!this.enabled) {
      console.log('ℹ️ Infrastructure metrics collection disabled');
      return;
    }

    console.log(`🔄 Starting infrastructure metrics collection (interval: ${this.collectionInterval}ms)`);

    setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error in automatic metrics collection:', error);
      }
    }, this.collectionInterval);
  }

  /**
   * Get infrastructure metrics dashboard data
   */
  async getDashboardData(): Promise<any> {
    const { data: currentMetrics } = await this.supabase
      .from('infrastructure_metrics_dashboard')
      .select('*')
      .eq('environment', this.environment)
      .order('hour', { ascending: false })
      .limit(24);

    const { data: edgeFunctionData } = await this.supabase
      .from('edge_function_performance_dashboard')
      .select('*')
      .order('hour', { ascending: false })
      .limit(24);

    const trends = await this.getTrends();
    const alerts = await this.checkAlerts();

    return {
      current_metrics: currentMetrics || [],
      edge_function_performance: edgeFunctionData || [],
      trends,
      alerts,
      environment: this.environment,
      last_updated: new Date().toISOString()
    };
  }
}
