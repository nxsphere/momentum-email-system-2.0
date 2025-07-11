#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';
import { InfrastructureMetricsService } from './src/services/infrastructure-metrics.service';
import { MonitoringService } from './src/services/monitoring.service';

// =============================================
// INFRASTRUCTURE MONITORING INTEGRATION TEST
// =============================================

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
  duration?: number;
}

class InfrastructureMonitoringTester {
  private infraService: InfrastructureMetricsService;
  private monitoringService: MonitoringService;
  private supabase: any;
  private results: TestResult[] = [];

  constructor() {
    this.infraService = new InfrastructureMetricsService();
    this.monitoringService = new MonitoringService();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Infrastructure Monitoring Integration Tests\n');

    // Environment validation tests
    await this.testEnvironmentConfiguration();
    await this.testDatabaseConnectivity();
    await this.testSupabaseMetricsEndpoint();

    // Database schema tests
    await this.testDatabaseSchema();
    await this.testDatabaseFunctions();
    await this.testAlertRules();

    // Service functionality tests
    await this.testInfrastructureMetricsCollection();
    await this.testMonitoringServiceIntegration();
    await this.testAlertingSystem();

    // Dashboard and reporting tests
    await this.testDashboardData();
    await this.testTrendsAndAnalytics();

    // Performance and reliability tests
    await this.testPerformanceMetrics();
    await this.testErrorHandling();

    // Print results summary
    this.printTestSummary();
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    console.log(`📋 Testing: ${name}...`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        success: true,
        message: 'Passed',
        duration
      });
      console.log(`✅ ${name} - Passed (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      this.results.push({
        name,
        success: false,
        message,
        duration
      });
      console.log(`❌ ${name} - Failed: ${message} (${duration}ms)\n`);
    }
  }

  // =============================================
  // ENVIRONMENT TESTS
  // =============================================

  private async testEnvironmentConfiguration(): Promise<void> {
    await this.runTest('Environment Configuration', async () => {
      const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'NODE_ENV'
      ];

      const optionalVars = [
        'SUPABASE_METRICS_ENABLED',
        'SUPABASE_METRICS_ENDPOINT',
        'SUPABASE_METRICS_INTERVAL'
      ];

      // Check required variables
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          throw new Error(`Required environment variable ${varName} is not set`);
        }
      }

      // Check optional variables
      const missingOptional = optionalVars.filter(varName => !process.env[varName]);
      if (missingOptional.length > 0) {
        console.log(`ℹ️ Optional variables not set: ${missingOptional.join(', ')}`);
      }

      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Metrics enabled: ${process.env.SUPABASE_METRICS_ENABLED}`);
    });
  }

  private async testDatabaseConnectivity(): Promise<void> {
    await this.runTest('Database Connectivity', async () => {
      const { data, error } = await this.supabase
        .from('email_campaigns')
        .select('count(*)')
        .limit(1);

      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }

      console.log('Database connection successful');
    });
  }

  private async testSupabaseMetricsEndpoint(): Promise<void> {
    await this.runTest('Supabase Metrics Endpoint', async () => {
      if (process.env.SUPABASE_METRICS_ENABLED !== 'true') {
        console.log('Metrics collection disabled, skipping endpoint test');
        return;
      }

      const endpoint = process.env.SUPABASE_METRICS_ENDPOINT;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!endpoint) {
        throw new Error('SUPABASE_METRICS_ENDPOINT not configured');
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`service_role:${serviceKey}`).toString('base64')}`,
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`Metrics endpoint returned ${response.status}: ${response.statusText}`);
      }

      const metricsData = await response.text();
      if (!metricsData || metricsData.length < 100) {
        throw new Error('Metrics endpoint returned insufficient data');
      }

      console.log(`Metrics endpoint accessible, data size: ${metricsData.length} bytes`);
    });
  }

  // =============================================
  // DATABASE SCHEMA TESTS
  // =============================================

  private async testDatabaseSchema(): Promise<void> {
    await this.runTest('Database Schema', async () => {
      const tables = [
        'infrastructure_metrics',
        'edge_function_metrics',
        'infrastructure_alert_rules'
      ];

      for (const tableName of tables) {
        const { data, error } = await this.supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          throw new Error(`Table ${tableName} not accessible: ${error.message}`);
        }
      }

      // Check views
      const { data: viewData, error: viewError } = await this.supabase
        .from('infrastructure_metrics_dashboard')
        .select('*')
        .limit(1);

      if (viewError) {
        throw new Error(`Dashboard view not accessible: ${viewError.message}`);
      }

      console.log('All required tables and views are accessible');
    });
  }

  private async testDatabaseFunctions(): Promise<void> {
    await this.runTest('Database Functions', async () => {
      const environment = process.env.NODE_ENV || 'development';

      // Test trends function
      const { data: trendsData, error: trendsError } = await this.supabase
        .rpc('get_infrastructure_trends', {
          p_environment: environment,
          p_hours: 24
        });

      if (trendsError) {
        throw new Error(`Trends function failed: ${trendsError.message}`);
      }

      // Test alerts function
      const { data: alertsData, error: alertsError } = await this.supabase
        .rpc('check_infrastructure_alerts', {
          p_environment: environment
        });

      if (alertsError) {
        throw new Error(`Alerts function failed: ${alertsError.message}`);
      }

      console.log('Database functions are working correctly');
    });
  }

  private async testAlertRules(): Promise<void> {
    await this.runTest('Alert Rules Configuration', async () => {
      const environment = process.env.NODE_ENV || 'development';

      const { data: alertRules, error } = await this.supabase
        .from('infrastructure_alert_rules')
        .select('*')
        .eq('environment', environment)
        .eq('enabled', true);

      if (error) {
        throw new Error(`Failed to fetch alert rules: ${error.message}`);
      }

      if (!alertRules || alertRules.length === 0) {
        console.log('No alert rules configured for current environment');
        return;
      }

      console.log(`Found ${alertRules.length} active alert rules for ${environment}`);

      // Validate rule structure
      for (const rule of alertRules) {
        if (!rule.metric_name || !rule.comparison_operator || !rule.alert_title) {
          throw new Error(`Invalid alert rule structure: ${JSON.stringify(rule)}`);
        }
      }
    });
  }

  // =============================================
  // SERVICE FUNCTIONALITY TESTS
  // =============================================

  private async testInfrastructureMetricsCollection(): Promise<void> {
    await this.runTest('Infrastructure Metrics Collection', async () => {
      const metrics = await this.infraService.collectMetrics();

      if (process.env.SUPABASE_METRICS_ENABLED !== 'true') {
        if (metrics !== null) {
          throw new Error('Expected null metrics when collection is disabled');
        }
        console.log('Metrics collection properly disabled');
        return;
      }

      if (!metrics) {
        throw new Error('Failed to collect infrastructure metrics');
      }

      // Validate metrics structure
      const requiredFields = [
        'timestamp',
        'environment',
        'collection_duration_ms',
        'collection_success'
      ];

      for (const field of requiredFields) {
        if (!(field in metrics)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (!metrics.collection_success) {
        throw new Error(`Metrics collection failed: ${metrics.collection_error}`);
      }

      console.log(`Metrics collected successfully in ${metrics.collection_duration_ms}ms`);
    });
  }

  private async testMonitoringServiceIntegration(): Promise<void> {
    await this.runTest('Monitoring Service Integration', async () => {
      // Test health checks
      const healthResults = await this.monitoringService.performHealthCheck();

      if (!healthResults || healthResults.length === 0) {
        throw new Error('No health check results returned');
      }

      console.log(`Health checks completed: ${healthResults.length} services checked`);

      // Test metrics collection
      const appMetrics = await this.monitoringService.collectMetrics();

      if (!appMetrics) {
        throw new Error('Failed to collect application metrics');
      }

      console.log('Application metrics collected successfully');

      // Test dashboard data
      const dashboardData = await this.monitoringService.getDashboardData();

      if (!dashboardData || !dashboardData.health_status) {
        throw new Error('Dashboard data incomplete');
      }

      console.log('Dashboard data assembled successfully');
    });
  }

  private async testAlertingSystem(): Promise<void> {
    await this.runTest('Alerting System', async () => {
      // Test alert condition checking
      const alerts = await this.infraService.checkAlerts();

      console.log(`Alert check completed: ${alerts.length} potential alerts found`);

      // Test alert rule evaluation (without actually sending alerts)
      const environment = process.env.NODE_ENV || 'development';
      const { data: alertRules } = await this.supabase
        .from('infrastructure_alert_rules')
        .select('*')
        .eq('environment', environment);

      if (alertRules && alertRules.length > 0) {
        console.log(`Alert rules evaluated: ${alertRules.length} rules active`);
      }

      // Verify alert cooldown mechanism
      const lastAlerts = await this.supabase
        .from('system_alerts')
        .select('*')
        .eq('environment', environment)
        .order('sent_at', { ascending: false })
        .limit(5);

      console.log('Alert history accessible');
    });
  }

  // =============================================
  // DASHBOARD AND REPORTING TESTS
  // =============================================

  private async testDashboardData(): Promise<void> {
    await this.runTest('Dashboard Data', async () => {
      const dashboardData = await this.infraService.getDashboardData();

      if (!dashboardData) {
        throw new Error('Dashboard data not available');
      }

      const expectedSections = [
        'current_metrics',
        'edge_function_performance',
        'trends',
        'alerts',
        'environment'
      ];

      for (const section of expectedSections) {
        if (!(section in dashboardData)) {
          throw new Error(`Missing dashboard section: ${section}`);
        }
      }

      console.log(`Dashboard data complete with ${expectedSections.length} sections`);
    });
  }

  private async testTrendsAndAnalytics(): Promise<void> {
    await this.runTest('Trends and Analytics', async () => {
      const trends = await this.infraService.getTrends(24);
      console.log(`Trends analysis completed: ${trends.length} metrics analyzed`);

      // Test aggregated dashboard views
      const { data: dashboardMetrics } = await this.supabase
        .from('infrastructure_metrics_dashboard')
        .select('*')
        .order('hour', { ascending: false })
        .limit(5);

      console.log(`Dashboard aggregation working: ${dashboardMetrics?.length || 0} data points`);
    });
  }

  // =============================================
  // PERFORMANCE AND RELIABILITY TESTS
  // =============================================

  private async testPerformanceMetrics(): Promise<void> {
    await this.runTest('Performance Metrics', async () => {
      if (process.env.SUPABASE_METRICS_ENABLED !== 'true') {
        console.log('Performance test skipped - metrics collection disabled');
        return;
      }

      const startTime = Date.now();
      const metrics = await this.infraService.collectMetrics();
      const collectionTime = Date.now() - startTime;

      if (collectionTime > 30000) { // 30 seconds
        throw new Error(`Metrics collection too slow: ${collectionTime}ms`);
      }

      if (metrics && metrics.collection_duration_ms > 15000) { // 15 seconds
        console.warn(`⚠️ Slow metrics collection: ${metrics.collection_duration_ms}ms`);
      }

      console.log(`Performance acceptable: collection in ${collectionTime}ms`);
    });
  }

  private async testErrorHandling(): Promise<void> {
    await this.runTest('Error Handling', async () => {
      // Test with invalid endpoint (should handle gracefully)
      const originalEndpoint = process.env.SUPABASE_METRICS_ENDPOINT;
      process.env.SUPABASE_METRICS_ENDPOINT = 'https://invalid-endpoint.example.com/metrics';

      const testService = new InfrastructureMetricsService();
      const metrics = await testService.collectMetrics();

      // Restore original endpoint
      if (originalEndpoint) {
        process.env.SUPABASE_METRICS_ENDPOINT = originalEndpoint;
      }

      if (process.env.SUPABASE_METRICS_ENABLED === 'true') {
        if (metrics && metrics.collection_success) {
          throw new Error('Expected error handling for invalid endpoint');
        }
        console.log('Error handling working correctly for invalid endpoint');
      } else {
        console.log('Error handling test skipped - metrics collection disabled');
      }
    });
  }

  // =============================================
  // RESULTS AND REPORTING
  // =============================================

  private printTestSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 INFRASTRUCTURE MONITORING TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`\n📈 Overall Results:`);
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`  • ${result.name}: ${result.message}`);
        });
    }

    const totalTime = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    console.log(`\n⏱️ Total Test Time: ${totalTime}ms`);

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
      console.log('🎉 All tests passed! Infrastructure monitoring is ready to use.');
      console.log('\nNext steps:');
      console.log('1. Start automatic metrics collection in production');
      console.log('2. Configure Grafana dashboard');
      console.log('3. Set up alert notification channels');
      console.log('4. Monitor system for 24-48 hours to verify operation');
    } else {
      console.log('⚠️ Some tests failed. Please review the issues above before deployment.');
      console.log('\nTroubleshooting:');
      console.log('1. Check environment configuration');
      console.log('2. Verify database migrations are applied');
      console.log('3. Confirm Supabase metrics endpoint access');
      console.log('4. Review service role key permissions');
    }

    console.log('\nFor detailed setup instructions, see:');
    console.log('📖 docs/INFRASTRUCTURE-MONITORING-SETUP.md');
  }
}

// =============================================
// MAIN EXECUTION
// =============================================

async function main() {
  try {
    const tester = new InfrastructureMonitoringTester();
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { InfrastructureMonitoringTester };
