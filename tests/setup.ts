/**
 * Global Test Setup
 *
 * Runs before all tests to configure environment
 */

import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

// Setup test database
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = ':memory:';
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  // Clean up temp files
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});
