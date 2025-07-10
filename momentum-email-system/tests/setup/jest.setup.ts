import { DatabaseSetup } from './database.setup';
import './test.config'; // Load test configuration first

// Global test timeout
jest.setTimeout(30000);

// Declare global test utilities type
declare global {
  var testUtils: {
    delay: (ms: number) => Promise<void>;
    generateRandomEmail: () => string;
    generateUUID: () => string;
  };
}

// Global setup and teardown
beforeAll(async () => {
  // Setup test database
  await DatabaseSetup.setupTestDatabase();
});

afterAll(async () => {
  // Cleanup test database
  await DatabaseSetup.cleanupTestDatabase();
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeEach(() => {
  // Mock console methods to reduce noise in tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;

  // Clear all mocks
  jest.clearAllMocks();
});

// Global test utilities
(global as any).testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  generateRandomEmail: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
  generateUUID: () => crypto.randomUUID(),
};
