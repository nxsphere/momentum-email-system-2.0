import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// =============================================
// MIGRATION RUNNER FOR MOMENTUM EMAIL SYSTEM
// =============================================

interface MigrationFile {
  version: string;
  name: string;
  path: string;
  content: string;
  checksum: string;
}

interface MigrationRecord {
  version: string;
  name: string;
  applied_at: string;
  checksum: string;
  execution_time_ms: number;
}

class MigrationRunner {
  private supabase: any;
  private environment: string;
  private migrationsPath: string;

  constructor(environment: string = 'development') {
    this.environment = environment;
    this.migrationsPath = join(__dirname, '../../supabase/migrations');

    // Load environment-specific configuration
    this.loadEnvironmentConfig();

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  private loadEnvironmentConfig() {
    // Load base environment file
    dotenv.config();

    // Load environment-specific config if it exists
    const envPath = join(__dirname, `../../config/environments/${this.environment}.env`);
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
    }
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
    console.log('🔧 Initializing migration tracking table...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER,
        environment VARCHAR(50) NOT NULL DEFAULT '${this.environment}',
        rollback_sql TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_migrations_version ON _migrations(version);
      CREATE INDEX IF NOT EXISTS idx_migrations_environment ON _migrations(environment);
      CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON _migrations(applied_at);
    `;

    await this.executeSQL(createTableSQL);
    console.log('✅ Migration tracking table initialized');
  }

  /**
   * Get list of available migration files
   */
  getMigrationFiles(): MigrationFile[] {
    if (!existsSync(this.migrationsPath)) {
      console.warn(`⚠️ Migrations directory not found: ${this.migrationsPath}`);
      return [];
    }

    const files = readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const path = join(this.migrationsPath, file);
      const content = readFileSync(path, 'utf8');
      const version = this.extractVersionFromFilename(file);
      const name = this.extractNameFromFilename(file);
      const checksum = this.calculateChecksum(content);

      return {
        version,
        name,
        path,
        content,
        checksum
      };
    });
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const { data, error } = await this.supabase
      .from('_migrations')
      .select('*')
      .eq('environment', this.environment)
      .order('version', { ascending: true });

    if (error && !error.message.includes('relation "_migrations" does not exist')) {
      throw new Error(`Failed to get applied migrations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    console.log(`🚀 Running migrations for environment: ${this.environment}`);

    // Initialize migration table if needed
    await this.initializeMigrationTable();

    const migrationFiles = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    const pendingMigrations = migrationFiles.filter(file =>
      !appliedVersions.has(file.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations found');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.runSingleMigration(migration);
    }

    console.log('🎉 All migrations completed successfully');
  }

  /**
   * Run a single migration
   */
  private async runSingleMigration(migration: MigrationFile): Promise<void> {
    console.log(`⏳ Running migration: ${migration.version} - ${migration.name}`);

    const startTime = Date.now();

    try {
      // Execute the migration SQL
      await this.executeSQL(migration.content);

      const executionTime = Date.now() - startTime;

      // Record successful migration
      const { error } = await this.supabase
        .from('_migrations')
        .insert({
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          execution_time_ms: executionTime,
          environment: this.environment
        });

      if (error) {
        throw new Error(`Failed to record migration: ${error.message}`);
      }

      console.log(`✅ Migration completed in ${executionTime}ms: ${migration.name}`);

    } catch (error) {
      console.error(`❌ Migration failed: ${migration.name}`);
      console.error(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rollback last migration (if rollback SQL is available)
   */
  async rollbackLastMigration(): Promise<void> {
    console.log('🔄 Rolling back last migration...');

    const { data: lastMigration, error } = await this.supabase
      .from('_migrations')
      .select('*')
      .eq('environment', this.environment)
      .order('applied_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastMigration) {
      console.log('ℹ️ No migrations to rollback');
      return;
    }

    if (!lastMigration.rollback_sql) {
      throw new Error(`No rollback SQL available for migration: ${lastMigration.name}`);
    }

    try {
      // Execute rollback SQL
      await this.executeSQL(lastMigration.rollback_sql);

      // Remove migration record
      const { error: deleteError } = await this.supabase
        .from('_migrations')
        .delete()
        .eq('version', lastMigration.version)
        .eq('environment', this.environment);

      if (deleteError) {
        throw new Error(`Failed to remove migration record: ${deleteError.message}`);
      }

      console.log(`✅ Rolled back migration: ${lastMigration.name}`);

    } catch (error) {
      console.error(`❌ Rollback failed: ${lastMigration.name}`);
      throw error;
    }
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<boolean> {
    console.log('🔍 Validating migration integrity...');

    const migrationFiles = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();

    let isValid = true;

    for (const appliedMigration of appliedMigrations) {
      const migrationFile = migrationFiles.find(f => f.version === appliedMigration.version);

      if (!migrationFile) {
        console.error(`❌ Migration file not found: ${appliedMigration.version}`);
        isValid = false;
        continue;
      }

      if (migrationFile.checksum !== appliedMigration.checksum) {
        console.error(`❌ Checksum mismatch: ${appliedMigration.version}`);
        console.error(`  Expected: ${appliedMigration.checksum}`);
        console.error(`  Actual: ${migrationFile.checksum}`);
        isValid = false;
      }
    }

    if (isValid) {
      console.log('✅ All migrations are valid');
    }

    return isValid;
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<void> {
    console.log(`📊 Migration Status - Environment: ${this.environment}`);

    const migrationFiles = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    console.log(`\nTotal migration files: ${migrationFiles.length}`);
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    console.log(`Pending migrations: ${migrationFiles.length - appliedMigrations.length}`);

    console.log('\n📋 Migration Details:');
    for (const file of migrationFiles) {
      const status = appliedVersions.has(file.version) ? '✅ Applied' : '⏳ Pending';
      console.log(`  ${file.version} - ${file.name} [${status}]`);
    }
  }

  /**
   * Execute SQL with error handling
   */
  private async executeSQL(sql: string): Promise<void> {
    const { error } = await this.supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  /**
   * Extract version from filename
   */
  private extractVersionFromFilename(filename: string): string {
    const match = filename.match(/^(\d{14})_/);
    return match ? match[1] : filename.replace('.sql', '');
  }

  /**
   * Extract name from filename
   */
  private extractNameFromFilename(filename: string): string {
    return filename.replace(/^\d{14}_/, '').replace('.sql', '').replace(/_/g, ' ');
  }

  /**
   * Calculate MD5 checksum
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

// =============================================
// CLI INTERFACE
// =============================================

async function main() {
  const command = process.argv[2];
  const environment = process.argv[3] || process.env.NODE_ENV || 'development';

  const runner = new MigrationRunner(environment);

  try {
    switch (command) {
      case 'migrate':
        await runner.runMigrations();
        break;

      case 'rollback':
        await runner.rollbackLastMigration();
        break;

      case 'status':
        await runner.getMigrationStatus();
        break;

      case 'validate':
        const isValid = await runner.validateMigrations();
        process.exit(isValid ? 0 : 1);
        break;

      case 'init':
        await runner.initializeMigrationTable();
        break;

      default:
        console.log('Usage: npm run migrate <command> [environment]');
        console.log('Commands:');
        console.log('  migrate   - Run pending migrations');
        console.log('  rollback  - Rollback last migration');
        console.log('  status    - Show migration status');
        console.log('  validate  - Validate migration integrity');
        console.log('  init      - Initialize migration table');
        console.log('');
        console.log('Environments: development, staging, production');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MigrationRunner };
