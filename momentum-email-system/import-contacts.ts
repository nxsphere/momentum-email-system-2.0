import "dotenv/config";
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from "./src/config/supabase";
import { EmailCampaignService } from "./src/services/email-campaign.service";

/**
 * Contact Import Script Template
 *
 * This script helps you import contacts from various sources:
 * - CSV files
 * - JSON files
 * - Database exports
 * - API responses
 */

interface ImportContact {
  email: string;
  first_name?: string;
  last_name?: string;
  status?: 'active' | 'unsubscribed' | 'bounced';
  metadata?: Record<string, any>;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
}

class ContactImporter {
  private emailService: EmailCampaignService;
  private stats: ImportStats = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0
  };

  constructor() {
    this.emailService = new EmailCampaignService();
  }

  /**
   * Import from CSV file
   * Expected CSV format: email,first_name,last_name,status
   */
  async importFromCSV(filePath: string): Promise<ImportStats> {
    console.log(`📁 Importing contacts from CSV: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim());
    console.log(`📋 CSV headers found: ${headers.join(', ')}`);

    // Process data rows
    const contacts: ImportContact[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());

      if (values.length !== headers.length) {
        console.log(`⚠️  Skipping malformed row ${i + 1}: ${lines[i]}`);
        continue;
      }

      const contact = this.mapCSVRowToContact(headers, values);
      if (contact) {
        contacts.push(contact);
      }
    }

    return await this.importContacts(contacts);
  }

  /**
   * Import from JSON file
   * Expected format: Array of contact objects
   */
  async importFromJSON(filePath: string): Promise<ImportStats> {
    console.log(`📁 Importing contacts from JSON: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const jsonContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(jsonContent);

    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array of contacts');
    }

    const contacts = data.map(item => this.mapJSONToContact(item)).filter((contact): contact is ImportContact => contact !== null);
    return await this.importContacts(contacts);
  }

  /**
   * Import from raw data array
   * Use this for API responses or database exports
   */
  async importFromData(data: any[]): Promise<ImportStats> {
    console.log(`📊 Importing ${data.length} contacts from data array`);

    const contacts = data.map(item => this.mapDataToContact(item)).filter((contact): contact is ImportContact => contact !== null);
    return await this.importContacts(contacts);
  }

  /**
   * Core import function - processes array of contacts
   */
  private async importContacts(contacts: ImportContact[]): Promise<ImportStats> {
    this.stats.total = contacts.length;
    console.log(`\n🚀 Starting import of ${this.stats.total} contacts...\n`);

    // Check for existing emails to avoid duplicates
    const existingEmails = await this.getExistingEmails(contacts.map(c => c.email));

    for (const contact of contacts) {
      try {
        // Skip if email already exists
        if (existingEmails.has(contact.email.toLowerCase())) {
          console.log(`⏩ Skipping duplicate: ${contact.email}`);
          this.stats.duplicates++;
          continue;
        }

        // Validate email format
        if (!this.isValidEmail(contact.email)) {
          console.log(`❌ Invalid email: ${contact.email}`);
          this.stats.errors++;
          continue;
        }

        // Import the contact
        await this.emailService.createContact({
          email: contact.email,
          first_name: contact.first_name || undefined,
          last_name: contact.last_name || undefined,
          status: contact.status || 'active',
          metadata: contact.metadata || {}
        });

        console.log(`✅ Imported: ${contact.email}`);
        this.stats.imported++;

      } catch (error) {
        console.log(`❌ Error importing ${contact.email}: ${error.message}`);
        this.stats.errors++;
      }
    }

    this.printImportSummary();
    return this.stats;
  }

  /**
   * Map CSV row to contact object
   * Customize this function based on your CSV format
   */
  private mapCSVRowToContact(headers: string[], values: string[]): ImportContact | null {
    const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'));
    const firstNameIndex = headers.findIndex(h => h.toLowerCase().includes('first') && h.toLowerCase().includes('name'));
    const lastNameIndex = headers.findIndex(h => h.toLowerCase().includes('last') && h.toLowerCase().includes('name'));
    const statusIndex = headers.findIndex(h => h.toLowerCase().includes('status'));

    if (emailIndex === -1 || !values[emailIndex]) {
      return null;
    }

    return {
      email: values[emailIndex],
      first_name: firstNameIndex !== -1 ? values[firstNameIndex] : undefined,
      last_name: lastNameIndex !== -1 ? values[lastNameIndex] : undefined,
      status: statusIndex !== -1 ? values[statusIndex] as any : 'active',
      metadata: this.extractCSVMetadata(headers, values, [emailIndex, firstNameIndex, lastNameIndex, statusIndex])
    };
  }

  /**
   * Map JSON object to contact
   * Customize this function based on your JSON structure
   */
  private mapJSONToContact(item: any): ImportContact | null {
    if (!item.email) {
      return null;
    }

    return {
      email: item.email,
      first_name: item.first_name || item.firstName || item.fname,
      last_name: item.last_name || item.lastName || item.lname,
      status: item.status === 'unsubscribed' || item.status === 'bounced' ? item.status : 'active',
      metadata: this.extractJSONMetadata(item)
    };
  }

  /**
   * Map generic data object to contact
   * Customize this function based on your database structure
   */
  private mapDataToContact(item: any): ImportContact | null {
    // Example mappings - customize based on your data structure
    const emailFields = ['email', 'email_address', 'Email', 'EmailAddress'];
    const firstNameFields = ['first_name', 'firstName', 'fname', 'FirstName'];
    const lastNameFields = ['last_name', 'lastName', 'lname', 'LastName'];

    const email = this.findFieldValue(item, emailFields);
    if (!email) {
      return null;
    }

    return {
      email: email,
      first_name: this.findFieldValue(item, firstNameFields),
      last_name: this.findFieldValue(item, lastNameFields),
      status: 'active', // Default to active unless you have status mapping
      metadata: this.extractDataMetadata(item)
    };
  }

  /**
   * Extract additional metadata from CSV (non-standard fields)
   */
  private extractCSVMetadata(headers: string[], values: string[], usedIndexes: number[]): Record<string, any> {
    const metadata: Record<string, any> = {};

    headers.forEach((header, index) => {
      if (!usedIndexes.includes(index) && values[index]) {
        metadata[header] = values[index];
      }
    });

    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  /**
   * Extract additional metadata from JSON (non-standard fields)
   */
  private extractJSONMetadata(item: any): Record<string, any> {
    const standardFields = ['email', 'first_name', 'firstName', 'fname', 'last_name', 'lastName', 'lname', 'status'];
    const metadata: Record<string, any> = {};

    Object.keys(item).forEach(key => {
      if (!standardFields.includes(key) && item[key] !== null && item[key] !== undefined) {
        metadata[key] = item[key];
      }
    });

    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  /**
   * Extract additional metadata from generic data
   */
  private extractDataMetadata(item: any): Record<string, any> {
    const standardFields = [
      'email', 'email_address', 'Email', 'EmailAddress',
      'first_name', 'firstName', 'fname', 'FirstName',
      'last_name', 'lastName', 'lname', 'LastName'
    ];

    const metadata: Record<string, any> = {};

    Object.keys(item).forEach(key => {
      if (!standardFields.includes(key) && item[key] !== null && item[key] !== undefined) {
        metadata[key] = item[key];
      }
    });

    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  /**
   * Find field value from multiple possible field names
   */
  private findFieldValue(item: any, fieldNames: string[]): string | undefined {
    for (const fieldName of fieldNames) {
      if (item[fieldName]) {
        return item[fieldName];
      }
    }
    return undefined;
  }

  /**
   * Get existing emails from database to avoid duplicates
   */
  private async getExistingEmails(emails: string[]): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('contacts')
      .select('email')
      .in('email', emails);

    if (error) {
      console.log('Warning: Could not check for existing emails:', error.message);
      return new Set();
    }

    return new Set(data?.map(contact => contact.email.toLowerCase()) || []);
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Print import summary
   */
  private printImportSummary(): void {
    console.log('\n📊 Import Summary');
    console.log('================');
    console.log(`📈 Total contacts processed: ${this.stats.total}`);
    console.log(`✅ Successfully imported: ${this.stats.imported}`);
    console.log(`⏩ Duplicates skipped: ${this.stats.duplicates}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log(`📊 Success rate: ${((this.stats.imported / this.stats.total) * 100).toFixed(1)}%`);
  }
}

// =================================================================
// EXAMPLE USAGE FUNCTIONS
// =================================================================

/**
 * Example: Import from CSV file
 */
async function importFromCSVExample() {
  const importer = new ContactImporter();

  // Example CSV file format:
  // email,first_name,last_name,company,phone
  // john@example.com,John,Doe,ACME Corp,555-1234

  try {
    const stats = await importer.importFromCSV('./data/contacts.csv');
    console.log('CSV import completed:', stats);
  } catch (error) {
    console.error('CSV import failed:', error.message);
  }
}

/**
 * Example: Import from JSON file
 */
async function importFromJSONExample() {
  const importer = new ContactImporter();

  // Example JSON file format:
  // [
  //   {
  //     "email": "jane@example.com",
  //     "firstName": "Jane",
  //     "lastName": "Smith",
  //     "company": "Tech Inc",
  //     "phone": "555-5678"
  //   }
  // ]

  try {
    const stats = await importer.importFromJSON('./data/contacts.json');
    console.log('JSON import completed:', stats);
  } catch (error) {
    console.error('JSON import failed:', error.message);
  }
}

/**
 * Example: Import from database export or API response
 */
async function importFromDataExample() {
  const importer = new ContactImporter();

  // Example: Simulate database export or API response
  const sampleData = [
    {
      email_address: 'user1@company.com',
      fname: 'User',
      lname: 'One',
      company_name: 'Company A',
      source: 'website'
    },
    {
      email_address: 'user2@business.com',
      fname: 'User',
      lname: 'Two',
      company_name: 'Business B',
      source: 'referral'
    }
  ];

  try {
    const stats = await importer.importFromData(sampleData);
    console.log('Data import completed:', stats);
  } catch (error) {
    console.error('Data import failed:', error.message);
  }
}

/**
 * Example: Create sample data files for testing
 */
async function createSampleFiles() {
  console.log('📝 Creating sample import files...');

  // Create data directory
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  // Create sample CSV
  const csvContent = `email,first_name,last_name,company,phone
test1@example.com,John,Doe,ACME Corp,555-1234
test2@example.com,Jane,Smith,Tech Inc,555-5678
test3@example.com,Bob,Johnson,Startup LLC,555-9012`;

  fs.writeFileSync(path.join(dataDir, 'sample-contacts.csv'), csvContent);

  // Create sample JSON
  const jsonContent = [
    {
      email: 'json1@example.com',
      firstName: 'Alice',
      lastName: 'Wilson',
      company: 'Design Studio',
      phone: '555-3456'
    },
    {
      email: 'json2@example.com',
      firstName: 'Charlie',
      lastName: 'Brown',
      company: 'Consulting Group',
      phone: '555-7890'
    }
  ];

  fs.writeFileSync(path.join(dataDir, 'sample-contacts.json'), JSON.stringify(jsonContent, null, 2));

  console.log('✅ Sample files created in ./data/ directory');
  console.log('   • sample-contacts.csv');
  console.log('   • sample-contacts.json');
}

// =================================================================
// MAIN EXECUTION
// =================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  try {
    switch (command) {
             case 'csv':
         if (!filePath) {
           console.error('Usage: tsx import-contacts.ts csv <file-path>');
           process.exit(1);
         }
         const csvImporter = new ContactImporter();
         await csvImporter.importFromCSV(filePath);
         break;

       case 'json':
         if (!filePath) {
           console.error('Usage: tsx import-contacts.ts json <file-path>');
           process.exit(1);
         }
         const jsonImporter = new ContactImporter();
         await jsonImporter.importFromJSON(filePath);
         break;

      case 'data':
        await importFromDataExample();
        break;

      case 'samples':
        await createSampleFiles();
        break;

      default:
        console.log('📋 Contact Import Script');
        console.log('=======================');
        console.log('');
        console.log('Available commands:');
        console.log('  tsx import-contacts.ts csv <file-path>    # Import from CSV file');
        console.log('  tsx import-contacts.ts json <file-path>   # Import from JSON file');
        console.log('  tsx import-contacts.ts data               # Import from sample data');
        console.log('  tsx import-contacts.ts samples            # Create sample files');
        console.log('');
        console.log('Example usage:');
        console.log('  tsx import-contacts.ts samples            # Create sample files first');
        console.log('  tsx import-contacts.ts csv ./data/contacts.csv');
        console.log('  tsx import-contacts.ts json ./data/contacts.json');
        break;
    }
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Export for external use
export { ContactImporter, ImportContact, ImportStats };

// Run if executed directly
if (require.main === module) {
  main();
}
