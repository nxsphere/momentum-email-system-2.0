#!/usr/bin/env node

import { program } from 'commander';
import { DeploymentManager } from '../config/deployment/deployment-config';

// =============================================
// DEPLOYMENT CLI
// =============================================

interface DeployOptions {
  environment: string;
  skipTests?: boolean;
  skipMigrations?: boolean;
  skipCronJobs?: boolean;
  functionsOnly?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

class DeploymentCLI {
  private deployment: DeploymentManager;

  constructor(environment: string) {
    this.deployment = new DeploymentManager(environment);
  }

  /**
   * Deploy everything
   */
  async deployAll(options: DeployOptions): Promise<void> {
    console.log(`🚀 Starting deployment to ${options.environment}`);
    console.log(`Options: ${JSON.stringify(options, null, 2)}`);

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No actual changes will be made');
      await this.deployment.getDeploymentStatus();
      return;
    }

    // Confirm production deployment
    if (options.environment === 'production' && !options.force) {
      const confirmed = await this.confirmProductionDeployment();
      if (!confirmed) {
        console.log('❌ Deployment cancelled');
        process.exit(1);
      }
    }

    try {
      if (options.functionsOnly) {
        await this.deployment.deployEdgeFunctions();
      } else {
        await this.deployment.deploy();
      }
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Deploy only specific components
   */
  async deployPartial(options: DeployOptions): Promise<void> {
    console.log(`🔧 Partial deployment to ${options.environment}`);

    try {
      if (!options.skipMigrations) {
        await this.deployment.runMigrations();
      }

      await this.deployment.deployEdgeFunctions();

      if (!options.skipCronJobs) {
        await this.deployment.setupCronJobs();
      }

      console.log('✅ Partial deployment completed');
    } catch (error) {
      console.error('❌ Partial deployment failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Show deployment status
   */
  async showStatus(): Promise<void> {
    await this.deployment.getDeploymentStatus();
  }

  /**
   * Confirm production deployment
   */
  private async confirmProductionDeployment(): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('⚠️  You are about to deploy to PRODUCTION. Are you sure? (yes/no): ', (answer: string) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Validate environment before deployment
   */
  async validateEnvironment(): Promise<boolean> {
    console.log('🔍 Validating environment...');

    // Check required environment variables
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'MAILTRAP_API_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars);
      return false;
    }

    // TODO: Add more validation checks
    // - Verify Supabase connection
    // - Verify Mailtrap API access
    // - Check function files exist

    console.log('✅ Environment validation passed');
    return true;
  }
}

// =============================================
// CLI COMMANDS
// =============================================

program
  .name('deploy')
  .description('Deploy Momentum Email System to different environments')
  .version('2.0.0');

program
  .command('full')
  .description('Full deployment (migrations, functions, cron jobs)')
  .option('-e, --environment <env>', 'deployment environment', 'development')
  .option('--skip-tests', 'skip pre-deployment tests')
  .option('--skip-migrations', 'skip database migrations')
  .option('--skip-cron-jobs', 'skip cron job setup')
  .option('--dry-run', 'show what would be deployed without making changes')
  .option('--force', 'force deployment without confirmation (production)')
  .action(async (options) => {
    const cli = new DeploymentCLI(options.environment);

    if (!(await cli.validateEnvironment())) {
      process.exit(1);
    }

    await cli.deployAll(options);
  });

program
  .command('functions')
  .description('Deploy only edge functions')
  .option('-e, --environment <env>', 'deployment environment', 'development')
  .option('--dry-run', 'show what would be deployed without making changes')
  .action(async (options) => {
    const cli = new DeploymentCLI(options.environment);

    if (!(await cli.validateEnvironment())) {
      process.exit(1);
    }

    await cli.deployPartial({ ...options, functionsOnly: true });
  });

program
  .command('migrations')
  .description('Run database migrations only')
  .option('-e, --environment <env>', 'deployment environment', 'development')
  .action(async (options) => {
    const deployment = new DeploymentManager(options.environment);

    try {
      await deployment.runMigrations();
      console.log('✅ Migrations completed');
    } catch (error) {
      console.error('❌ Migrations failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('cron-jobs')
  .description('Setup cron jobs only')
  .option('-e, --environment <env>', 'deployment environment', 'development')
  .action(async (options) => {
    const deployment = new DeploymentManager(options.environment);

    try {
      await deployment.setupCronJobs();
      console.log('✅ Cron jobs configured');
    } catch (error) {
      console.error('❌ Cron job setup failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show deployment status')
  .option('-e, --environment <env>', 'deployment environment', 'development')
  .action(async (options) => {
    const cli = new DeploymentCLI(options.environment);
    await cli.showStatus();
  });

program
  .command('validate')
  .description('Validate environment configuration')
  .option('-e, --environment <env>', 'deployment environment', 'development')
  .action(async (options) => {
    const cli = new DeploymentCLI(options.environment);
    const isValid = await cli.validateEnvironment();
    process.exit(isValid ? 0 : 1);
  });

// =============================================
// ENVIRONMENT-SPECIFIC SHORTCUTS
// =============================================

program
  .command('dev')
  .description('Deploy to development environment')
  .option('--functions-only', 'deploy only functions')
  .option('--dry-run', 'show what would be deployed')
  .action(async (options) => {
    const cli = new DeploymentCLI('development');

    if (!(await cli.validateEnvironment())) {
      process.exit(1);
    }

    if (options.functionsOnly) {
      await cli.deployPartial({ environment: 'development', functionsOnly: true });
    } else {
      await cli.deployAll({ environment: 'development', ...options });
    }
  });

program
  .command('staging')
  .description('Deploy to staging environment')
  .option('--functions-only', 'deploy only functions')
  .option('--dry-run', 'show what would be deployed')
  .action(async (options) => {
    const cli = new DeploymentCLI('staging');

    if (!(await cli.validateEnvironment())) {
      process.exit(1);
    }

    if (options.functionsOnly) {
      await cli.deployPartial({ environment: 'staging', functionsOnly: true });
    } else {
      await cli.deployAll({ environment: 'staging', ...options });
    }
  });

program
  .command('prod')
  .description('Deploy to production environment')
  .option('--functions-only', 'deploy only functions')
  .option('--force', 'skip confirmation prompt')
  .option('--dry-run', 'show what would be deployed')
  .action(async (options) => {
    const cli = new DeploymentCLI('production');

    if (!(await cli.validateEnvironment())) {
      process.exit(1);
    }

    if (options.functionsOnly) {
      await cli.deployPartial({ environment: 'production', functionsOnly: true, force: options.force });
    } else {
      await cli.deployAll({ environment: 'production', ...options });
    }
  });

// =============================================
// ERROR HANDLING
// =============================================

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
