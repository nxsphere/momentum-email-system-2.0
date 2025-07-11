import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

// =============================================
// DEPLOYMENT CONFIGURATION MANAGER
// =============================================

interface EdgeFunction {
  name: string;
  path: string;
  verify_jwt: boolean;
  import_map?: string;
  entrypoint?: string;
  description?: string;
}

interface DeploymentConfig {
  environment: string;
  project_id: string;
  project_ref: string;
  supabase_url: string;
  service_role_key: string;
  edge_functions: EdgeFunction[];
  environment_variables: Record<string, string>;
  cron_jobs: CronJobConfig[];
  database_migrations: string[];
  hooks: {
    pre_deploy?: string[];
    post_deploy?: string[];
  };
}

interface CronJobConfig {
  name: string;
  schedule: string;
  function_name: string;
  enabled: boolean;
  batch_size?: number;
  timeout_seconds?: number;
}

class DeploymentManager {
  private config: DeploymentConfig;
  private rootPath: string;

  constructor(environment: string = 'development') {
    this.rootPath = join(__dirname, '../..');
    this.config = this.loadDeploymentConfig(environment);
  }

  /**
   * Load deployment configuration for environment
   */
  private loadDeploymentConfig(environment: string): DeploymentConfig {
    console.log(`📋 Loading deployment configuration for environment: ${environment}`);

    // Load environment variables
    this.loadEnvironmentVariables(environment);

    // Base configuration
    const baseConfig: DeploymentConfig = {
      environment,
      project_id: process.env.SUPABASE_PROJECT_REF || '',
      project_ref: process.env.SUPABASE_PROJECT_REF || '',
      supabase_url: process.env.SUPABASE_URL || '',
      service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      edge_functions: this.getEdgeFunctionsConfig(environment),
      environment_variables: this.getEnvironmentVariables(),
      cron_jobs: this.getCronJobsConfig(environment),
      database_migrations: this.getDatabaseMigrations(),
      hooks: this.getDeploymentHooks(environment)
    };

    // Environment-specific overrides
    const envConfig = this.getEnvironmentSpecificConfig(environment);
    return { ...baseConfig, ...envConfig };
  }

  /**
   * Load environment variables
   */
  private loadEnvironmentVariables(environment: string) {
    // Load base .env file
    const basePath = join(this.rootPath, '.env');
    if (existsSync(basePath)) {
      dotenv.config({ path: basePath });
    }

    // Load environment-specific config
    const envPath = join(this.rootPath, 'config/environments', `${environment}.env`);
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
    }
  }

  /**
   * Get edge functions configuration
   */
  private getEdgeFunctionsConfig(environment: string): EdgeFunction[] {
    const baseFunctions: EdgeFunction[] = [
      {
        name: 'email-processor',
        path: 'supabase/functions/email-processor',
        verify_jwt: false,
        description: 'Processes email queue in batches'
      },
      {
        name: 'webhook-handler',
        path: 'supabase/functions/webhook-handler',
        verify_jwt: false,
        description: 'Handles Mailtrap webhooks for tracking updates'
      },
      {
        name: 'campaign-scheduler',
        path: 'supabase/functions/campaign-scheduler',
        verify_jwt: false,
        description: 'Checks for scheduled campaigns and starts them'
      },
      {
        name: 'bounce-processor',
        path: 'supabase/functions/bounce-processor',
        verify_jwt: false,
        description: 'Handles bounce notifications and updates contact status'
      },
      {
        name: 'webhook-mailtrap',
        path: 'supabase/functions/webhook-mailtrap',
        verify_jwt: false,
        description: 'Legacy webhook handler (consider migrating)'
      }
    ];

    // Environment-specific function configurations
    if (environment === 'development') {
      // In development, we might want to add debug functions
      baseFunctions.push({
        name: 'debug-helper',
        path: 'supabase/functions/debug-helper',
        verify_jwt: false,
        description: 'Development debugging utilities'
      });
    }

    return baseFunctions;
  }

  /**
   * Get environment variables for deployment
   */
  private getEnvironmentVariables(): Record<string, string> {
    const vars: Record<string, string> = {};

    // Essential variables that need to be available in edge functions
    const essentialVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'MAILTRAP_API_KEY',
      'MAILTRAP_WEBHOOK_SECRET',
      'DEFAULT_FROM_EMAIL',
      'NODE_ENV',
      'EMAIL_BATCH_SIZE',
      'CAMPAIGN_BATCH_SIZE'
    ];

    essentialVars.forEach(varName => {
      if (process.env[varName]) {
        vars[varName] = process.env[varName]!;
      }
    });

    return vars;
  }

  /**
   * Get cron jobs configuration
   */
  private getCronJobsConfig(environment: string): CronJobConfig[] {
    const configs: Record<string, CronJobConfig[]> = {
      development: [
        {
          name: 'email-processor-job',
          schedule: '*/2 * * * *', // Every 2 minutes
          function_name: 'email-processor',
          enabled: true,
          batch_size: 2,
          timeout_seconds: 120
        },
        {
          name: 'status-updater-job',
          schedule: '*/10 * * * *', // Every 10 minutes
          function_name: 'webhook-handler',
          enabled: true,
          timeout_seconds: 60
        },
        {
          name: 'campaign-scheduler-job',
          schedule: '*/5 * * * *', // Every 5 minutes
          function_name: 'campaign-scheduler',
          enabled: true,
          batch_size: 2,
          timeout_seconds: 60
        },
        {
          name: 'bounce-handler-job',
          schedule: '*/30 * * * *', // Every 30 minutes
          function_name: 'bounce-processor',
          enabled: true,
          batch_size: 10,
          timeout_seconds: 120
        }
      ],
      staging: [
        {
          name: 'email-processor-job',
          schedule: '* * * * *', // Every minute
          function_name: 'email-processor',
          enabled: true,
          batch_size: 3,
          timeout_seconds: 180
        },
        {
          name: 'status-updater-job',
          schedule: '*/5 * * * *', // Every 5 minutes
          function_name: 'webhook-handler',
          enabled: true,
          timeout_seconds: 120
        },
        {
          name: 'campaign-scheduler-job',
          schedule: '* * * * *', // Every minute
          function_name: 'campaign-scheduler',
          enabled: true,
          batch_size: 3,
          timeout_seconds: 120
        },
        {
          name: 'bounce-handler-job',
          schedule: '*/15 * * * *', // Every 15 minutes
          function_name: 'bounce-processor',
          enabled: true,
          batch_size: 50,
          timeout_seconds: 180
        }
      ],
      production: [
        {
          name: 'email-processor-job',
          schedule: '* * * * *', // Every minute
          function_name: 'email-processor',
          enabled: true,
          batch_size: 4,
          timeout_seconds: 300
        },
        {
          name: 'status-updater-job',
          schedule: '*/5 * * * *', // Every 5 minutes
          function_name: 'webhook-handler',
          enabled: true,
          timeout_seconds: 180
        },
        {
          name: 'campaign-scheduler-job',
          schedule: '* * * * *', // Every minute
          function_name: 'campaign-scheduler',
          enabled: true,
          batch_size: 5,
          timeout_seconds: 180
        },
        {
          name: 'bounce-handler-job',
          schedule: '*/15 * * * *', // Every 15 minutes
          function_name: 'bounce-processor',
          enabled: true,
          batch_size: 100,
          timeout_seconds: 300
        }
      ]
    };

    return configs[environment] || configs.development;
  }

  /**
   * Get database migrations list
   */
  private getDatabaseMigrations(): string[] {
    const migrationsPath = join(this.rootPath, 'supabase/migrations');
    if (!existsSync(migrationsPath)) {
      return [];
    }

    const fs = require('fs');
    return fs.readdirSync(migrationsPath)
      .filter((file: string) => file.endsWith('.sql'))
      .sort();
  }

  /**
   * Get deployment hooks
   */
  private getDeploymentHooks(environment: string): { pre_deploy?: string[]; post_deploy?: string[] } {
    const hooks: Record<string, { pre_deploy?: string[]; post_deploy?: string[] }> = {
      development: {
        pre_deploy: [
          'npm run test:unit',
          'npm run lint'
        ],
        post_deploy: [
          'npm run test:integration:dev'
        ]
      },
      staging: {
        pre_deploy: [
          'npm run test:unit',
          'npm run test:integration',
          'npm run lint',
          'npm run build'
        ],
        post_deploy: [
          'npm run test:e2e:staging',
          'npm run smoke-test:staging'
        ]
      },
      production: {
        pre_deploy: [
          'npm run test:all',
          'npm run lint',
          'npm run build',
          'npm run security-scan'
        ],
        post_deploy: [
          'npm run smoke-test:production',
          'npm run health-check:production'
        ]
      }
    };

    return hooks[environment] || hooks.development;
  }

  /**
   * Get environment-specific configuration overrides
   */
  private getEnvironmentSpecificConfig(environment: string): Partial<DeploymentConfig> {
    const configs: Record<string, Partial<DeploymentConfig>> = {
      development: {
        project_id: process.env.DEV_PROJECT_REF || process.env.SUPABASE_PROJECT_REF,
      },
      staging: {
        project_id: process.env.STAGING_PROJECT_REF || process.env.SUPABASE_PROJECT_REF,
      },
      production: {
        project_id: 'pxzccwwvzpvyceumnekw', // Known production project ID
        project_ref: 'pxzccwwvzpvyceumnekw'
      }
    };

    return configs[environment] || {};
  }

  /**
   * Deploy all edge functions
   */
  async deployEdgeFunctions(): Promise<void> {
    console.log(`🚀 Deploying edge functions to ${this.config.environment}...`);

    for (const func of this.config.edge_functions) {
      await this.deployEdgeFunction(func);
    }

    console.log('✅ All edge functions deployed successfully');
  }

  /**
   * Deploy a single edge function
   */
  async deployEdgeFunction(func: EdgeFunction): Promise<void> {
    console.log(`📦 Deploying function: ${func.name}`);

    try {
      const functionPath = join(this.rootPath, func.path);

      if (!existsSync(functionPath)) {
        throw new Error(`Function path does not exist: ${functionPath}`);
      }

      // Build deploy command
      const deployCmd = [
        'supabase functions deploy',
        func.name,
        '--project-ref', this.config.project_ref,
        func.verify_jwt ? '' : '--no-verify-jwt'
      ].filter(Boolean).join(' ');

      // Execute deployment
      execSync(deployCmd, {
        cwd: this.rootPath,
        stdio: 'inherit',
        env: {
          ...process.env,
          ...this.config.environment_variables
        }
      });

      console.log(`✅ Function deployed: ${func.name}`);

    } catch (error) {
      console.error(`❌ Failed to deploy function: ${func.name}`);
      throw error;
    }
  }

  /**
   * Setup cron jobs
   */
  async setupCronJobs(): Promise<void> {
    console.log(`⏰ Setting up cron jobs for ${this.config.environment}...`);

    const cronSetupSQL = this.generateCronJobsSQL();
    const sqlFile = join(this.rootPath, 'temp-cron-setup.sql');

    try {
      // Write SQL to temporary file
      writeFileSync(sqlFile, cronSetupSQL);

      // Execute SQL using Supabase CLI
      const dbCmd = `supabase db push --project-ref ${this.config.project_ref} --file ${sqlFile}`;
      execSync(dbCmd, {
        cwd: this.rootPath,
        stdio: 'inherit'
      });

      console.log('✅ Cron jobs configured successfully');

    } catch (error) {
      console.error('❌ Failed to setup cron jobs');
      throw error;
    } finally {
      // Clean up temporary file
      if (existsSync(sqlFile)) {
        const fs = require('fs');
        fs.unlinkSync(sqlFile);
      }
    }
  }

  /**
   * Generate SQL for cron jobs setup
   */
  private generateCronJobsSQL(): string {
    const cronJobs = this.config.cron_jobs;

    let sql = `-- Cron Jobs Setup for ${this.config.environment}\n`;
    sql += `-- Generated at: ${new Date().toISOString()}\n\n`;

    // Add project configuration
    sql += `-- Set project configuration\n`;
    sql += `ALTER DATABASE postgres SET app.settings.project_ref = '${this.config.project_ref}';\n`;
    sql += `ALTER DATABASE postgres SET app.settings.service_role_key = '${this.config.service_role_key}';\n\n`;

    // Unschedule existing jobs
    sql += `-- Unschedule existing jobs\n`;
    for (const job of cronJobs) {
      sql += `SELECT public.safe_unschedule_job('${job.name}');\n`;
    }
    sql += '\n';

    // Schedule new jobs
    sql += `-- Schedule new jobs\n`;
    for (const job of cronJobs) {
      if (job.enabled) {
        const payload = JSON.stringify({
          batch_size: job.batch_size || 1,
          timeout_seconds: job.timeout_seconds || 300
        });

        sql += `SELECT cron.schedule(\n`;
        sql += `    '${job.name}',\n`;
        sql += `    '${job.schedule}',\n`;
        sql += `    $$SELECT public.execute_cron_job(\n`;
        sql += `        '${job.name.replace('-job', '')}',\n`;
        sql += `        '${job.function_name}',\n`;
        sql += `        '${payload}'::jsonb\n`;
        sql += `    );$$\n`;
        sql += `);\n\n`;
      }
    }

    return sql;
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    console.log(`📊 Running database migrations for ${this.config.environment}...`);

    try {
      const migrateCmd = `node scripts/migrations/migration-runner.js migrate ${this.config.environment}`;
      execSync(migrateCmd, {
        cwd: this.rootPath,
        stdio: 'inherit',
        env: {
          ...process.env,
          ...this.config.environment_variables
        }
      });

      console.log('✅ Database migrations completed');

    } catch (error) {
      console.error('❌ Database migrations failed');
      throw error;
    }
  }

  /**
   * Run pre-deployment hooks
   */
  async runPreDeployHooks(): Promise<void> {
    const hooks = this.config.hooks.pre_deploy;
    if (!hooks || hooks.length === 0) {
      console.log('ℹ️ No pre-deployment hooks configured');
      return;
    }

    console.log('🔄 Running pre-deployment hooks...');

    for (const hook of hooks) {
      console.log(`⏳ Running: ${hook}`);
      try {
        execSync(hook, {
          cwd: this.rootPath,
          stdio: 'inherit'
        });
        console.log(`✅ Completed: ${hook}`);
      } catch (error) {
        console.error(`❌ Failed: ${hook}`);
        throw error;
      }
    }
  }

  /**
   * Run post-deployment hooks
   */
  async runPostDeployHooks(): Promise<void> {
    const hooks = this.config.hooks.post_deploy;
    if (!hooks || hooks.length === 0) {
      console.log('ℹ️ No post-deployment hooks configured');
      return;
    }

    console.log('🔄 Running post-deployment hooks...');

    for (const hook of hooks) {
      console.log(`⏳ Running: ${hook}`);
      try {
        execSync(hook, {
          cwd: this.rootPath,
          stdio: 'inherit'
        });
        console.log(`✅ Completed: ${hook}`);
      } catch (error) {
        console.error(`❌ Failed: ${hook}`);
        // Don't throw on post-deploy hook failures, just warn
        console.warn(`⚠️ Post-deploy hook failed, continuing...`);
      }
    }
  }

  /**
   * Full deployment process
   */
  async deploy(): Promise<void> {
    console.log(`🚀 Starting full deployment to ${this.config.environment}...`);

    try {
      // Pre-deployment hooks
      await this.runPreDeployHooks();

      // Run database migrations
      await this.runMigrations();

      // Deploy edge functions
      await this.deployEdgeFunctions();

      // Setup cron jobs
      await this.setupCronJobs();

      // Post-deployment hooks
      await this.runPostDeployHooks();

      console.log(`🎉 Deployment to ${this.config.environment} completed successfully!`);

    } catch (error) {
      console.error(`❌ Deployment to ${this.config.environment} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(): Promise<void> {
    console.log(`📊 Deployment Status - Environment: ${this.config.environment}`);
    console.log(`Project: ${this.config.project_id}`);
    console.log(`Supabase URL: ${this.config.supabase_url}`);
    console.log(`\nEdge Functions (${this.config.edge_functions.length}):`);

    for (const func of this.config.edge_functions) {
      console.log(`  📦 ${func.name} - ${func.description}`);
    }

    console.log(`\nCron Jobs (${this.config.cron_jobs.length}):`);
    for (const job of this.config.cron_jobs) {
      const status = job.enabled ? '✅ Enabled' : '❌ Disabled';
      console.log(`  ⏰ ${job.name} (${job.schedule}) [${status}]`);
    }

    console.log(`\nDatabase Migrations (${this.config.database_migrations.length}):`);
    for (const migration of this.config.database_migrations) {
      console.log(`  📊 ${migration}`);
    }
  }
}

export { CronJobConfig, DeploymentConfig, DeploymentManager, EdgeFunction };
