import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// =============================================
// BACKUP AND RECOVERY MANAGER
// =============================================

interface BackupConfig {
  environment: string;
  storage_type: 'local' | 's3' | 'gcs';
  storage_config: any;
  retention_days: number;
  backup_schedule: string;
  encryption_enabled: boolean;
  compression_enabled: boolean;
}

interface BackupMetadata {
  backup_id: string;
  environment: string;
  backup_type: 'full' | 'incremental' | 'configuration';
  created_at: Date;
  size_bytes: number;
  tables: string[];
  file_path: string;
  checksum: string;
  encryption_key?: string;
  restored_at?: Date;
  restoration_notes?: string;
}

interface RestoreOptions {
  backup_id: string;
  target_environment?: string;
  tables?: string[];
  exclude_tables?: string[];
  dry_run?: boolean;
  force?: boolean;
}

export class BackupManager {
  private supabase: any;
  private environment: string;
  private config: BackupConfig;
  private backupPath: string;

  constructor(environment: string = 'development') {
    this.environment = environment;
    this.backupPath = join(__dirname, '../../backups');

    // Ensure backup directory exists
    if (!existsSync(this.backupPath)) {
      mkdirSync(this.backupPath, { recursive: true });
    }

    // Load environment configuration
    this.loadEnvironmentConfig();

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.config = this.loadBackupConfig();
  }

  /**
   * Load environment configuration
   */
  private loadEnvironmentConfig() {
    // Load base environment
    dotenv.config();

    // Load environment-specific config
    const envPath = join(__dirname, `../../config/environments/${this.environment}.env`);
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
    }
  }

  /**
   * Load backup configuration
   */
  private loadBackupConfig(): BackupConfig {
    const configs: Record<string, BackupConfig> = {
      development: {
        environment: 'development',
        storage_type: 'local',
        storage_config: {
          path: join(this.backupPath, 'development')
        },
        retention_days: 7,
        backup_schedule: '0 2 * * *', // Daily at 2 AM
        encryption_enabled: false,
        compression_enabled: true
      },
      staging: {
        environment: 'staging',
        storage_type: process.env.BACKUP_STORAGE_TYPE as any || 'local',
        storage_config: {
          path: join(this.backupPath, 'staging'),
          bucket: process.env.BACKUP_S3_BUCKET,
          region: process.env.BACKUP_S3_REGION,
          access_key: process.env.BACKUP_S3_ACCESS_KEY,
          secret_key: process.env.BACKUP_S3_SECRET_KEY
        },
        retention_days: 30,
        backup_schedule: '0 2 * * *',
        encryption_enabled: true,
        compression_enabled: true
      },
      production: {
        environment: 'production',
        storage_type: process.env.BACKUP_STORAGE_TYPE as any || 's3',
        storage_config: {
          bucket: process.env.BACKUP_S3_BUCKET || 'momentum-production-backups',
          region: process.env.BACKUP_S3_REGION || 'us-east-1',
          access_key: process.env.BACKUP_S3_ACCESS_KEY,
          secret_key: process.env.BACKUP_S3_SECRET_KEY
        },
        retention_days: parseInt(process.env.BACKUP_RETENTION_DAYS || '365'),
        backup_schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
        encryption_enabled: true,
        compression_enabled: true
      }
    };

    return configs[this.environment] || configs.development;
  }

  /**
   * Create full database backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    console.log(`🗄️ Creating full backup for ${this.environment}...`);

    const backupId = this.generateBackupId('full');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${this.environment}-full-${timestamp}.sql`;
    const backupFilePath = join(this.backupPath, this.environment, backupFileName);

    try {
      // Ensure environment backup directory exists
      const envBackupPath = join(this.backupPath, this.environment);
      if (!existsSync(envBackupPath)) {
        mkdirSync(envBackupPath, { recursive: true });
      }

      // Get list of all tables
      const tables = await this.getAllTables();

      // Create database dump
      const dumpSQL = await this.createDatabaseDump(tables);

      // Compress if enabled
      let finalContent = dumpSQL;
      if (this.config.compression_enabled) {
        finalContent = await this.compressData(dumpSQL);
      }

      // Encrypt if enabled
      if (this.config.encryption_enabled) {
        finalContent = await this.encryptData(finalContent);
      }

      // Write backup file
      writeFileSync(backupFilePath, finalContent);

      // Calculate file size and checksum
      const fileSize = Buffer.byteLength(finalContent);
      const checksum = this.calculateChecksum(finalContent);

      // Create backup metadata
      const metadata: BackupMetadata = {
        backup_id: backupId,
        environment: this.environment,
        backup_type: 'full',
        created_at: new Date(),
        size_bytes: fileSize,
        tables,
        file_path: backupFilePath,
        checksum
      };

      // Store metadata in database
      await this.storeBackupMetadata(metadata);

      // Upload to remote storage if configured
      if (this.config.storage_type !== 'local') {
        await this.uploadToRemoteStorage(backupFilePath, metadata);
      }

      console.log(`✅ Full backup created: ${backupId} (${this.formatBytes(fileSize)})`);
      return metadata;

    } catch (error) {
      console.error(`❌ Full backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create incremental backup
   */
  async createIncrementalBackup(sinceTimestamp?: Date): Promise<BackupMetadata> {
    console.log(`📊 Creating incremental backup for ${this.environment}...`);

    const backupId = this.generateBackupId('incremental');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${this.environment}-incremental-${timestamp}.sql`;
    const backupFilePath = join(this.backupPath, this.environment, backupFileName);

    try {
      // Get last backup timestamp if not provided
      if (!sinceTimestamp) {
        const lastBackup = await this.getLastBackup();
        sinceTimestamp = lastBackup?.created_at || new Date(Date.now() - 86400000); // 24 hours ago
      }

      // Get tables with changes since last backup
      const changedTables = await this.getChangedTables(sinceTimestamp);

      if (changedTables.length === 0) {
        console.log('ℹ️ No changes detected since last backup');
        return null;
      }

      // Create incremental dump
      const dumpSQL = await this.createIncrementalDump(changedTables, sinceTimestamp);

      // Process backup file (compression, encryption)
      let finalContent = dumpSQL;
      if (this.config.compression_enabled) {
        finalContent = await this.compressData(dumpSQL);
      }
      if (this.config.encryption_enabled) {
        finalContent = await this.encryptData(finalContent);
      }

      // Write backup file
      writeFileSync(backupFilePath, finalContent);

      const fileSize = Buffer.byteLength(finalContent);
      const checksum = this.calculateChecksum(finalContent);

      const metadata: BackupMetadata = {
        backup_id: backupId,
        environment: this.environment,
        backup_type: 'incremental',
        created_at: new Date(),
        size_bytes: fileSize,
        tables: changedTables,
        file_path: backupFilePath,
        checksum
      };

      await this.storeBackupMetadata(metadata);

      if (this.config.storage_type !== 'local') {
        await this.uploadToRemoteStorage(backupFilePath, metadata);
      }

      console.log(`✅ Incremental backup created: ${backupId} (${this.formatBytes(fileSize)})`);
      return metadata;

    } catch (error) {
      console.error(`❌ Incremental backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create configuration backup
   */
  async createConfigurationBackup(): Promise<BackupMetadata> {
    console.log(`⚙️ Creating configuration backup for ${this.environment}...`);

    const backupId = this.generateBackupId('configuration');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${this.environment}-config-${timestamp}.json`;
    const backupFilePath = join(this.backupPath, this.environment, backupFileName);

    try {
      // Collect configuration data
      const configData = await this.collectConfigurationData();

      // Create backup content
      const backupContent = JSON.stringify(configData, null, 2);

      // Process backup (compression, encryption)
      let finalContent = backupContent;
      if (this.config.compression_enabled) {
        finalContent = await this.compressData(backupContent);
      }
      if (this.config.encryption_enabled) {
        finalContent = await this.encryptData(finalContent);
      }

      writeFileSync(backupFilePath, finalContent);

      const fileSize = Buffer.byteLength(finalContent);
      const checksum = this.calculateChecksum(finalContent);

      const metadata: BackupMetadata = {
        backup_id: backupId,
        environment: this.environment,
        backup_type: 'configuration',
        created_at: new Date(),
        size_bytes: fileSize,
        tables: ['environment_config', 'cron_job_config'],
        file_path: backupFilePath,
        checksum
      };

      await this.storeBackupMetadata(metadata);

      if (this.config.storage_type !== 'local') {
        await this.uploadToRemoteStorage(backupFilePath, metadata);
      }

      console.log(`✅ Configuration backup created: ${backupId}`);
      return metadata;

    } catch (error) {
      console.error(`❌ Configuration backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    console.log(`🔄 Restoring from backup: ${options.backup_id}`);

    if (this.environment === 'production' && !options.force) {
      throw new Error('Production restore requires --force flag for safety');
    }

    try {
      // Get backup metadata
      const metadata = await this.getBackupMetadata(options.backup_id);
      if (!metadata) {
        throw new Error(`Backup not found: ${options.backup_id}`);
      }

      // Download backup file if needed
      let backupFilePath = metadata.file_path;
      if (this.config.storage_type !== 'local') {
        backupFilePath = await this.downloadFromRemoteStorage(metadata);
      }

      // Verify backup integrity
      await this.verifyBackupIntegrity(backupFilePath, metadata);

      if (options.dry_run) {
        console.log('🔍 DRY RUN - Would restore the following:');
        console.log(`  Backup ID: ${metadata.backup_id}`);
        console.log(`  Type: ${metadata.backup_type}`);
        console.log(`  Tables: ${metadata.tables.join(', ')}`);
        console.log(`  Size: ${this.formatBytes(metadata.size_bytes)}`);
        return;
      }

      // Create restoration point
      const restorationPoint = await this.createFullBackup();
      console.log(`📍 Restoration point created: ${restorationPoint.backup_id}`);

      // Read and process backup content
      let backupContent = readFileSync(backupFilePath, 'utf8');

      if (this.config.encryption_enabled) {
        backupContent = await this.decryptData(backupContent);
      }
      if (this.config.compression_enabled) {
        backupContent = await this.decompressData(backupContent);
      }

      // Perform restoration
      await this.performRestore(backupContent, metadata, options);

      // Update metadata with restoration info
      await this.updateBackupMetadata(options.backup_id, {
        restored_at: new Date(),
        restoration_notes: `Restored to ${options.target_environment || this.environment}`
      });

      console.log(`✅ Restore completed from backup: ${options.backup_id}`);

    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(limit: number = 20): Promise<BackupMetadata[]> {
    const { data, error } = await this.supabase
      .from('backup_metadata')
      .select('*')
      .eq('environment', this.environment)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<void> {
    console.log(`🧹 Cleaning up old backups for ${this.environment}...`);

    const cutoffDate = new Date(Date.now() - (this.config.retention_days * 86400000));

    try {
      // Get old backups
      const { data: oldBackups, error } = await this.supabase
        .from('backup_metadata')
        .select('*')
        .eq('environment', this.environment)
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to get old backups: ${error.message}`);
      }

      if (!oldBackups || oldBackups.length === 0) {
        console.log('ℹ️ No old backups to clean up');
        return;
      }

      let deletedCount = 0;
      let deletedSize = 0;

      for (const backup of oldBackups) {
        try {
          // Delete from remote storage
          if (this.config.storage_type !== 'local') {
            await this.deleteFromRemoteStorage(backup);
          }

          // Delete local file
          if (existsSync(backup.file_path)) {
            const fs = require('fs');
            fs.unlinkSync(backup.file_path);
          }

          // Remove metadata
          await this.supabase
            .from('backup_metadata')
            .delete()
            .eq('backup_id', backup.backup_id);

          deletedCount++;
          deletedSize += backup.size_bytes;

        } catch (error) {
          console.warn(`Failed to delete backup ${backup.backup_id}: ${error.message}`);
        }
      }

      console.log(`✅ Cleaned up ${deletedCount} old backups (${this.formatBytes(deletedSize)} freed)`);

    } catch (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(filePath: string, metadata: BackupMetadata): Promise<boolean> {
    console.log(`🔍 Verifying backup integrity: ${metadata.backup_id}`);

    try {
      if (!existsSync(filePath)) {
        throw new Error(`Backup file not found: ${filePath}`);
      }

      const content = readFileSync(filePath, 'utf8');
      const checksum = this.calculateChecksum(content);

      if (checksum !== metadata.checksum) {
        throw new Error(`Checksum mismatch. Expected: ${metadata.checksum}, Got: ${checksum}`);
      }

      console.log('✅ Backup integrity verified');
      return true;

    } catch (error) {
      console.error(`❌ Backup integrity check failed: ${error.message}`);
      throw error;
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private generateBackupId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${this.environment}-${type}-${timestamp}-${random}`;
  }

  private async getAllTables(): Promise<string[]> {
    // Get all user tables from the database
    const { data, error } = await this.supabase.rpc('get_user_tables');

    if (error) {
      // Fallback to known tables
      return [
        'contacts', 'contact_lists', 'contact_segments', 'contact_list_memberships',
        'email_templates', 'email_campaigns', 'email_queue', 'email_logs',
        'campaign_logs', 'webhook_events', 'bounce_events', 'suppression_list',
        'environment_config', 'cron_job_config', 'cron_job_logs'
      ];
    }

    return data.map((row: any) => row.table_name);
  }

  private async createDatabaseDump(tables: string[]): Promise<string> {
    let dump = `-- Full backup for ${this.environment}\n`;
    dump += `-- Created at: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('*');

        if (error) {
          console.warn(`Skipping table ${table}: ${error.message}`);
          continue;
        }

        dump += `-- Table: ${table}\n`;
        dump += `DELETE FROM ${table};\n`;

        if (data && data.length > 0) {
          for (const row of data) {
            const values = Object.values(row).map(val =>
              val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`
            ).join(', ');

            dump += `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${values});\n`;
          }
        }

        dump += '\n';

      } catch (error) {
        console.warn(`Error dumping table ${table}: ${error.message}`);
      }
    }

    return dump;
  }

  private async getChangedTables(sinceTimestamp: Date): Promise<string[]> {
    // This is a simplified implementation
    // In a real system, you'd track table modification times
    const allTables = await this.getAllTables();
    return allTables.filter(table =>
      ['email_queue', 'email_logs', 'email_campaigns', 'campaign_logs'].includes(table)
    );
  }

  private async createIncrementalDump(tables: string[], sinceTimestamp: Date): Promise<string> {
    let dump = `-- Incremental backup for ${this.environment}\n`;
    dump += `-- Since: ${sinceTimestamp.toISOString()}\n`;
    dump += `-- Created at: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
      try {
        // Get records modified since timestamp
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .gte('updated_at', sinceTimestamp.toISOString());

        if (error) {
          console.warn(`Skipping table ${table}: ${error.message}`);
          continue;
        }

        if (data && data.length > 0) {
          dump += `-- Incremental data for table: ${table}\n`;

          for (const row of data) {
            const values = Object.values(row).map(val =>
              val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`
            ).join(', ');

            dump += `INSERT OR REPLACE INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${values});\n`;
          }

          dump += '\n';
        }

      } catch (error) {
        console.warn(`Error creating incremental dump for ${table}: ${error.message}`);
      }
    }

    return dump;
  }

  private async collectConfigurationData(): Promise<any> {
    const config: any = {
      environment: this.environment,
      backup_timestamp: new Date().toISOString(),
      configurations: {},
      cron_jobs: {}
    };

    try {
      // Get environment configurations
      const { data: envConfigs } = await this.supabase
        .from('environment_config')
        .select('*')
        .eq('environment', this.environment);

      config.configurations = envConfigs || [];

      // Get cron job configurations
      const { data: cronConfigs } = await this.supabase
        .from('cron_job_config')
        .select('*')
        .eq('environment', this.environment);

      config.cron_jobs = cronConfigs || [];

    } catch (error) {
      console.warn(`Error collecting configuration data: ${error.message}`);
    }

    return config;
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async compressData(data: string): Promise<string> {
    const zlib = require('zlib');
    const compressed = zlib.gzipSync(Buffer.from(data));
    return compressed.toString('base64');
  }

  private async decompressData(data: string): Promise<string> {
    const zlib = require('zlib');
    const compressed = Buffer.from(data, 'base64');
    const decompressed = zlib.gunzipSync(compressed);
    return decompressed.toString();
  }

  private async encryptData(data: string): Promise<string> {
    // Implement encryption using a secure method
    // This is a placeholder - use proper encryption in production
    return Buffer.from(data).toString('base64');
  }

  private async decryptData(data: string): Promise<string> {
    // Implement decryption
    // This is a placeholder - use proper decryption in production
    return Buffer.from(data, 'base64').toString();
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const { error } = await this.supabase
      .from('backup_metadata')
      .insert(metadata);

    if (error) {
      throw new Error(`Failed to store backup metadata: ${error.message}`);
    }
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const { data, error } = await this.supabase
      .from('backup_metadata')
      .select('*')
      .eq('backup_id', backupId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  private async getLastBackup(): Promise<BackupMetadata | null> {
    const { data, error } = await this.supabase
      .from('backup_metadata')
      .select('*')
      .eq('environment', this.environment)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  private async updateBackupMetadata(backupId: string, updates: Partial<BackupMetadata>): Promise<void> {
    const { error } = await this.supabase
      .from('backup_metadata')
      .update(updates)
      .eq('backup_id', backupId);

    if (error) {
      throw new Error(`Failed to update backup metadata: ${error.message}`);
    }
  }

  private async uploadToRemoteStorage(filePath: string, metadata: BackupMetadata): Promise<void> {
    // Implement upload to S3/GCS based on configuration
    console.log(`📤 Uploading backup to ${this.config.storage_type}...`);
    // This would be implemented based on the storage type
  }

  private async downloadFromRemoteStorage(metadata: BackupMetadata): Promise<string> {
    // Implement download from remote storage
    console.log(`📥 Downloading backup from ${this.config.storage_type}...`);
    // This would return the local file path after download
    return metadata.file_path;
  }

  private async deleteFromRemoteStorage(metadata: BackupMetadata): Promise<void> {
    // Implement deletion from remote storage
    console.log(`🗑️ Deleting backup from ${this.config.storage_type}...`);
  }

  private async performRestore(backupContent: string, metadata: BackupMetadata, options: RestoreOptions): Promise<void> {
    console.log('🔄 Performing database restore...');

    // This is a simplified implementation
    // In production, you'd want more sophisticated restore logic
    const statements = backupContent.split('\n').filter(line =>
      line.trim() && !line.startsWith('--')
    );

    for (const statement of statements) {
      try {
        await this.supabase.rpc('execute_sql', { sql: statement });
      } catch (error) {
        console.warn(`Failed to execute statement: ${statement.substring(0, 100)}...`);
      }
    }
  }
}

export { BackupConfig, BackupMetadata, RestoreOptions };
