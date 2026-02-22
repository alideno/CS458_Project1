/**
 * Configuration for Self-Healing Framework
 * Customize healing behavior and logging
 */

module.exports = {
  // Healing settings
  healing: {
    enabled: true,
    maxRetries: 3,
    timeoutMs: 10000,
    retryDelayMs: 500
  },

  // LLM settings
  llm: {
    enabled: true,
    provider: 'anthropic', // 'anthropic' or 'openai'
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.3, // Lower = more deterministic
    maxTokens: 150,
    timeout: 15000
  },

  // Heuristic scoring
  heuristics: {
    enabled: true,
    weights: {
      textSimilarity: 0.25,
      locationProximity: 0.20,
      tagMatch: 0.15,
      classMatch: 0.15,
      idMatch: 0.10,
      ariaMatch: 0.10,
      recency: 0.05
    },
    locationThreshold: 500, // pixels
    textSimilarityThreshold: 0.3,
    ageWeightHours: 720 // 30 days
  },

  // Shadow DOM monitoring
  shadowDOM: {
    enabled: true,
    captureAttributes: ['id', 'class', 'data-testid'],
    observeSubtree: true,
    debounceMs: 100
  },

  // Logging
  logging: {
    verbose: true,
    logPath: './healing-logs',
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
    maxLogSize: 10485760, // 10MB
    logMetadata: true,
    logHealingEvents: true
  },

  // Browser settings
  browser: {
    chrome: {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    },
    firefox: {
      headless: false
    }
  },

  // Test timeouts
  timeouts: {
    login: 10000,
    oauth: 30000,
    rateLimiting: 60000,
    popup: 5000,
    cssTransition: 1000
  },

  // Retry strategy
  retry: {
    maxAttempts: 3,
    backoffMultiplier: 1.5,
    initialDelayMs: 500,
    maxDelayMs: 5000
  },

  // Fallback selectors for common elements
  fallbackSelectors: {
    loginButton: [
      'xpath=//button[contains(text(), "Login")]',
      'css=.btn-login',
      'css=#login-btn',
      'xpath=//button[@type="submit"][1]'
    ],
    googleButton: [
      'xpath=//button[contains(., "Google")]',
      'css=[data-testid="google-login"]',
      'xpath=//*[@data-provider="google"]'
    ],
    emailInput: [
      'xpath=//input[@type="email"]',
      'css=#email',
      'css=[name="email"]',
      'xpath=//input[@aria-label="email"]'
    ],
    passwordInput: [
      'xpath=//input[@type="password"]',
      'css=#password',
      'css=[name="password"]',
      'xpath=//input[@aria-label="password"]'
    ],
    submitButton: [
      'xpath=//button[@type="submit"]',
      'css=.btn-submit',
      'css=#submit'
    ]
  },

  // Risk scoring
  riskScoring: {
    failedAttemptWeight: 10,
    newIPWeight: 15,
    firstTimeIPWeight: 10,
    lowRiskThreshold: 30,
    mediumRiskThreshold: 60,
    highRiskThreshold: 100
  },

  // Rate limiting
  rateLimiting: {
    maxAttemptsPerIP: 5,
    windowSeconds: 900, // 15 minutes
    backoffSeconds: 300, // 5 minutes
    exponentialBackoff: true
  }
};
