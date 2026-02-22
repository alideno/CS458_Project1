# ARES Authentication System - Test Suite Documentation

## Overview

The ARES (Adaptive Risk-aware Enhanced Security) test suite includes three comprehensive testing layers:

1. **Unit Tests** - Isolated testing of individual functions and components
2. **Integration Tests** - Testing interactions between authentication components  
3. **E2E Tests** - Advanced self-healing Selenium tests with LLM-powered repair

---

## Test Architecture

### 1. Self-Healing Selenium Framework

The framework automatically repairs broken element selectors when UI changes occur.

#### Core Components

- **`self-healer.js`** - Main framework handling element discovery and healing
- **`utils/llm-repair.js`** - LLM integration for intelligent selector repair
- **`utils/heuristic-scorer.js`** - Scores candidate elements based on historical metadata
- **`utils/dom-analyzer.js`** - DOM parsing and candidate element extraction

#### Healing Mechanism

1. **Detection** - Try-catch wraps element finding attempts
2. **Context Extraction** - Captures page DOM when element not found
3. **LLM Repair** - Uses Claude API to suggest new selectors
4. **Heuristic Recovery** - Fallback scoring system for selector validation
5. **Execution & Logging** - Applies new selector and logs healing events

### 2. Advanced Test Scenarios

#### Test 1: Dynamic ID Recovery
**Purpose**: Verify framework recovers when element IDs change at runtime

**Flow**:
1. Load login page and find button with original ID
2. JavaScript changes button ID dynamically
3. Framework detects failure and heals the selector
4. Button remains functional

**Key Skills Tested**:
- Real-time DOM mutation detection
- Selector recovery from ID changes
- Heuristic scoring for element matching

**Expected Outcome**: ✅ Test passes - Button is recovered and clickable

---

#### Test 2: Multimodal Failure (Popup Obstruction)
**Purpose**: Handle scenarios where desired elements are obscured

**Flow**:
1. Load login page
2. JavaScript injects overlay popup blocking login button
3. Framework identifies visible close button
4. Closes popup to access original element
5. Continues with login flow

**Key Skills Tested**:
- DOM change event detection
- Intelligent element priority (close popup first)
- Sequential interaction handling

**Expected Outcome**: ✅ Test passes - Popup closed, button accessed

---

#### Test 3: Cross-Browser Consistency
**Purpose**: Verify robustness to CSS modifications

**Flow**:
1. Load login page in Chrome/Firefox
2. Apply CSS hiding original email input
3. Create replacement element with different selector
4. Framework uses heuristics to locate replacement
5. Continues with login flow

**Key Skills Tested**:
- CSS-resistant selector generation
- Browser-independent element recovery
- Fallback selector strategies

**Expected Outcome**: ✅ Test passes across browsers

---

#### Test 4: Social Auth Handshake
**Purpose**: Verify OAuth token capture and session handling

**Flow**:
1. Navigate to login page
2. Locate "Login with Google" button
3. Mock OAuth callback
4. Verify token stored in localStorage
5. Confirm provider identification

**Key Skills Tested**:
- OAuth flow handling
- Token lifecycle management
- Provider-specific routing

**Expected Outcome**: ✅ Test passes - Token captured and validated

---

#### Test 5: Rate Limiting Simulation
**Purpose**: Verify adaptive rate limiting on brute force attempts

**Flow**:
1. Execute 6 failed login attempts
2. Monitor for rate limit triggers
3. Verify error messages
4. Track response time changes
5. Confirm account protection

**Key Skills Tested**:
- Brute force detection
- Adaptive response mechanisms
- Error handling and user feedback

**Expected Outcome**: ✅ Test passes - Rate limiting activates after 5 attempts

---

## Unit Tests

### Risk Scoring System

Tests the risk calculation algorithm:

```javascript
calculateRiskScore(userData, currentIP)
// Returns: { score (0-100), level (low|medium|high), factors [] }
```

**Test Cases**:
- ✅ Low risk: New user from new IP
- ✅ Low risk: Returning user from known IP
- ✅ Medium risk: New IP detected
- ✅ High risk: Multiple failed attempts
- ✅ Score capping at 100

### Password Validation

Ensures password meets security requirements:

```javascript
validatePassword(password)
// Requirements: ≥8 chars, uppercase, lowercase, number, special char
```

**Test Cases**:
- ✅ Accept strong passwords
- ✅ Reject weak passwords
- ✅ Enforce character type requirements

### Session Management

Validates session lifecycle:

```javascript
validateSession(session)
// Returns: { valid, reason }
```

**Test Cases**:
- ✅ Accept valid sessions
- ✅ Reject expired sessions
- ✅ Reject sessions with missing data

---

## Integration Tests

### Authentication Flows

**Registration Flow**:
```javascript
POST /api/auth/register
Body: { email, password }
Response: { success, message }
```

**Test Cases**:
- ✅ Successful registration
- ✅ Missing email validation
- ✅ Missing password validation
- ✅ Duplicate email handling

### Session Management

**Login Flow**:
- Session creation
- User data storage
- CSRF token generation

**Logout Flow**:
- Session destruction
- Protected route access denial

### CSRF Protection

- Token generation on form load
- Token validation on submission
- Token rotation after use

### Rate Limiting

- Request count tracking per IP/user
- Timeout increments
- Exponential backoff verification

---

## Running Tests

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# E2E tests with Firefox
BROWSER=firefox npm run test:e2e
```

### Watch Mode (Development)

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

---

## Test Results Interpretation

### Healing Log

Found in `./healing-logs/healing-log.json`:

```json
{
  "timestamp": "2024-02-22T...",
  "events": [
    {
      "elementDescription": "Login button",
      "originalSelector": "id=login-btn",
      "healedSelector": "xpath=//button[@data-testid='login']",
      "success": true
    }
  ]
}
```

### Coverage Report

Run-generated coverage appears in `./coverage/` with:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

---

## LLM Integration

### Claude API Configuration

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export CLAUDE_API_KEY="sk-ant-..."
```

### Fallback Behavior

If LLM unavailable or API fails:
1. System attempts heuristic scoring
2. Historical metadata matching
3. Generic selector patterns

### Custom Prompts

Edit prompt engineering in `utils/llm-repair.js`:

```javascript
const systemPrompt = `...`; // Modify healing instructions
```

---

## Advanced Features

### Shadow DOM Monitoring

Tracks real-time DOM changes via MutationObserver:

```javascript
window.__shadowDOMChanges
// Array of: { timestamp, type, target }
```

### Heuristic Scoring Weights

Adjust in `utils/heuristic-scorer.js`:

```javascript
this.weights = {
  textSimilarity: 0.25,      // Exact text matching importance
  locationProximity: 0.20,   // Visual position proximity
  tagMatch: 0.15,            // HTML tag type match
  classMatch: 0.15,          // CSS class similarity
  idMatch: 0.10,             // ID attribute match
  ariaMatch: 0.10,           // Accessibility label match
  recency: 0.05              // Age of historical data
};
```

### Historical Metadata

Stored per element type in `./healing-logs/element-metadata.json`:

```json
{
  "description": "Login button",
  "tagName": "button",
  "text": "Login",
  "classes": ["btn", "btn-primary"],
  "location": { "x": 100, "y": 50, "width": 80, "height": 36 }
}
```

---

## Troubleshooting

### Tests Timeout

- Increase timeout: `jest.setTimeout(60000)` in `tests/setup.js`
- Check server is running on BASE_URL
- Verify Selenium WebDriver compatibility

### LLM API Fails

- Check API keys in `.env`
- Verify API rate limits
- Check network connectivity
- System will fallback to heuristics

### Element Not Found

1. Check selector in current DOM
2. Verify element is visible (not display:none)
3. Check z-index (not behind other elements)
4. Review healing logs for suggestions

### Cross-Browser Issues

- Install Geckodriver for Firefox: `brew install geckodriver`
- Update WebDriver: `npm update selenium-webdriver`
- Test in specific browser: `BROWSER=firefox npm run test:e2e`

---

## Performance Metrics

### Expected Timing

- Unit tests: 2-5 seconds
- Integration tests: 5-10 seconds
- E2E tests (Chrome): 30-60 seconds
- E2E tests (Firefox): 45-90 seconds

### Healing Success Rate

Target: >90% successful healing with historical data

Initial runs: ~70% (building metadata)
Subsequent runs: >90% (utilizing metadata)

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration
      - uses: actions/upload-artifact@v2
        with:
          name: coverage
          path: coverage/
```

---

## Best Practices

1. **Maintain Historical Metadata** - Don't delete `element-metadata.json`
2. **Run Full Suite Before PR** - Ensures healing system stability
3. **Monitor Healing Logs** - Track selector breakages for pattern analysis
4. **Update Prompts Regularly** - Improve LLM suggestions over time
5. **Test with Multiple Browsers** - Catch platform-specific issues

---

## Contact & Support

For issues or questions about the test suite:
- Review healing logs: `./healing-logs/`
- Check coverage reports: `./coverage/`
- Enable verbose output: `npm run test -- --verbose`

---

**Last Updated**: February 2024
**Framework Version**: 1.0.0
**Test Count**: 5 E2E + 15+ Unit + 10+ Integration
