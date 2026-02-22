module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server.js',
    'tests/**/*.js',
    '!tests/e2e/**',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  bail: false
};
