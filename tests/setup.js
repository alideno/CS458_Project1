/**
 * Jest Setup File
 * Initializes test environment and global configurations
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.FACEBOOK_APP_ID = 'test-fb-id';
process.env.FACEBOOK_APP_SECRET = 'test-fb-secret';
process.env.CALLBACK_URL = 'http://localhost:3000';
process.env.FIREBASE_DATABASE_URL = 'https://test-project.firebaseio.com';

// Suppress console output during tests (uncomment if needed)
// global.console = {
//   log: jest.fn(),
//   error: console.error,
//   warn: console.warn,
//   info: console.info,
//   debug: console.debug
// };

// Global test utilities
global.testUtils = {
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  generateTestEmail: () => `test-${Date.now()}@example.com`,
  generateTestPassword: () => `TestPass${Math.random().toString(36).slice(2)}!`
};

afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});
