# Tests Overview

This project has three layers of tests:

- Unit tests: isolated checks of core logic in tests/unit
- Integration tests: API and component interaction checks in tests/integration
- E2E tests: Selenium-based browser flows in tests/e2e

## How To Run

Prereqs:
- Node.js and npm installed
- API keys and app config set in your environment (.env if you use it)

Common commands:

```bash
# Install dependencies
npm install

# Run all Jest tests (unit + integration)
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests (Selenium)
npm run test:e2e

# Watch mode for Jest
npm run test:watch

# Coverage report
npm run test:coverage
```

## Notes

- E2E tests run in real browsers via Selenium and may take longer.
- If E2E tests fail, confirm browser drivers are installed and the app is running on the expected base URL.
- Jest settings are defined in jest.config.js.
