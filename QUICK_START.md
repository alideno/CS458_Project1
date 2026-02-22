# Quick Start Guide - ARES Test Suite

## 60-Second Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys
```bash
# Copy example environment file
cp .env.example .env

# Add your API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_CLIENT_ID="your-google-id"
export GOOGLE_CLIENT_SECRET="your-google-secret"
export FACEBOOK_APP_ID="your-fb-id"
export FACEBOOK_APP_SECRET="your-fb-secret"
```

### 3. Start Server
```bash
npm start
# Server runs on http://localhost:3000
```

### 4. Run Tests (in another terminal)
```bash
# All tests
npm test

# Or specific test type
npm run test:unit
npm run test:integration
npm run test:e2e
```

---

## Test Commands

### Unit Tests Only
```bash
npm run test:unit
```
**Output**: 
- Risk scoring validation
- Password security checks
- Session management
- Response time: ~2-5s
- Coverage report

### Integration Tests Only
```bash
npm run test:integration
```
**Output**:
- Authentication workflows
- Session lifecycle
- CSRF protection
- Rate limiting
- Response time: ~5-10s

### E2E Tests Only
```bash
npm run test:e2e
```
**Output**:
- Dynamic ID recovery
- Popup handling
- Cross-browser consistency
- OAuth flow
- Rate limiting simulation
- Response time: ~30-60s

### Watch Mode (Auto-rerun on changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```
- Opens coverage visualization
- Shows percentages by file
- Identifies untested code

---

## Test Scenarios Explained

### **Test 1: Dynamic ID Recovery** ⭐
**What it does**:
1. Finds login button with original ID
2. JavaScript changes button ID
3. Framework detects change and heals selector
4. Button remains clickable

**Why it matters**: Catches when developers rename IDs

**Expected Result**: ✅ PASS

---

### **Test 2: Multimodal Failure** 🎭
**What it does**:
1. Login page loads
2. Overlay popup blocks button
3. Framework identifies popup
4. Closes popup
5. Clicks original button

**Why it matters**: Handles real-world UI obstacles

**Expected Result**: ✅ PASS

---

### **Test 3: Cross-Browser Consistency** 🌐
**What it does**:
1. Load page in Chrome (or Firefox)
2. Apply CSS hiding original element
3. Create replacement with different selector
4. Framework recovers using heuristics
5. Continue authentication

**Why it matters**: CSS changes shouldn't break tests

**Expected Result**: ✅ PASS

---

### **Test 4: Social Auth Handshake** 🔑
**What it does**:
1. Find Google login button
2. Mock OAuth flow
3. Verify token capture in localStorage
4. Confirm session created

**Why it matters**: OAuth integration validation

**Expected Result**: ✅ PASS

---

### **Test 5: Rate Limiting** 🛑
**What it does**:
1. Execute 6 failed login attempts
2. Monitor for rate limit triggers
3. Verify error messages
4. Confirm account locked

**Why it matters**: Security against brute force

**Expected Result**: ✅ PASS after attempt 5

---

## Understanding Output

### Successful Test Run
```
✅ Found element with original selector: Login button
✅ PASSED: Dynamic ID Recovery
✅ PASSED: Multimodal Failure
✅ PASSED: Cross-Browser Consistency
✅ PASSED: Social Auth Handshake
✅ PASSED: Rate Limiting

📋 FINAL TEST REPORT
========================================
✅ PASSED: Dynamic ID Recovery
✅ PASSED: Multimodal Failure
✅ PASSED: Cross-Browser Consistency
✅ PASSED: Social Auth Handshake
✅ PASSED: Rate Limiting
========================================
Total: 5/5 tests passed

📊 Self-Healing Framework Report:
   Total healings attempted: 3
   Successful healings: 3
   Healing success rate: 100%
```

### Failed Test Run
```
⚠️ Original selector failed for: Login button
❌ Error: timeout after 10000ms
🔧 Initiating healing for: Login button
💚 Healed selector found: xpath=//button[@data-testid='login']
✅ Found element with healed selector

❌ FAILED: Dynamic ID Recovery
Error: Element still not found after all recovery attempts
```

### Healing Log
```json
{
  "timestamp": "2024-02-22T10:30:45Z",
  "totalHealings": 3,
  "events": [
    {
      "elementDescription": "Login button",
      "originalSelector": "id=login-btn",
      "healedSelector": "xpath=//button[@data-testid='login']",
      "success": true,
      "timestamp": "2024-02-22T10:30:20Z"
    }
  ]
}
```

---

## Viewing Results

### Healing Logs
```bash
cat ./healing-logs/healing-log.json
cat ./healing-logs/element-metadata.json
```

### Coverage Report
```bash
# Generate HTML report
npm run test:coverage

# Open in browser
open ./coverage/lcov-report/index.html
```

### Test Report
```bash
cat ./healing-logs/test-report.json
```

---

## Environment Variables

Required for local testing:
```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...         # Claude API
OPENAI_API_KEY=sk-...                # GPT-4 (optional)

# OAuth Credentials
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# Server Configuration
BASE_URL=http://localhost:3000
NODE_ENV=test
```

Optional:
```bash
# Test Configuration
BROWSER=chrome              # or firefox
HEADLESS=false             # or true for CI
VERBOSE=true               # Extra logging
```

---

## Troubleshooting

### Issue: "Command not found: npm"
```bash
# Install Node.js first
# Visit: https://nodejs.org/
node --version  # Should be v18+
```

### Issue: "Chrome/Firefox not installed"
```bash
# Windows
choco install googlechrome firefox

# Mac
brew install google-chrome firefox

# Linux
apt-get install chromium firefox
```

### Issue: "API key not found"
```bash
# Verify .env file exists
ls .env

# Check key is set
echo $ANTHROPIC_API_KEY

# Set temporarily for current session
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Issue: Tests timeout
```bash
# Increase timeout in jest.config.js
testTimeout: 60000

# Or run with extended timeout
npm test -- --testTimeout=60000
```

### Issue: "Server already running on port 3000"
```bash
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

---

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Every push to main/develop/staging
- Every pull request
- Can be triggered manually

View results:
1. Go to repo → Actions tab
2. Click workflow run
3. View test results
4. Download artifacts (logs, coverage)

### Local Pre-Commit Hook
```bash
# Create .git/hooks/pre-commit
#!/bin/bash
npm run test:unit
if [ $? -ne 0 ]; then
  echo "Unit tests failed!"
  exit 1
fi
```

---

## Advanced Usage

### Run Specific Test
```bash
# Only Dynamic ID Recovery test
npm run test:e2e -- --testNamePattern="Dynamic ID"
```

### Debug Mode
```bash
# See all console.log output
NODE_DEBUG=* npm test

# Stop on first failure
npm test -- --bail

# Run in watch mode with debugging
npm run test:watch -- --verbose
```

### Memory Profiling
```bash
node --max_old_space_size=4096 node_modules/.bin/jest
```

### Parallel vs Sequential
```bash
# Parallel (default, fast)
npm test

# Sequential (safer for DB/network)
npm test -- --runInBand
```

---

## Performance Benchmarks

| Test Type | Typical Duration | Healing Overhead |
|-----------|------------------|------------------|
| Unit | 2-5s | N/A |
| Integration | 5-10s | N/A |
| E2E Chrome | 30-60s | +10-20ms per heal |
| E2E Firefox | 45-90s | +10-20ms per heal |

---

## Success Checklist

Before committing code:
- [ ] `npm test` passes locally
- [ ] `npm run test:coverage` shows >50%
- [ ] No new browser console errors
- [ ] Healing logs show 0 errors
- [ ] All 5 E2E tests PASSED

Before merging PR:
- [ ] All GitHub Actions checks pass
- [ ] Coverage increased or maintained
- [ ] No failing integration tests
- [ ] E2E tests pass on CI

---

## Next Steps

1. **Read Full Docs**: [TESTING.md](./TESTING.md)
2. **Understand Framework**: [SELF_HEALING_GUIDE.md](./SELF_HEALING_GUIDE.md)
3. **Explore Code**: Check `tests/` directory
4. **Run Tests**: `npm test`
5. **Review Logs**: `./healing-logs/`
6. **Iterate**: Modify tests, re-run, verify

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Selenium WebDriver](https://www.selenium.dev/)
- [Claude API](https://console.anthropic.com/)
- [Test Report](./healing-logs/test-report.json)

---

**Questions?** Check the healing logs or run tests with `--verbose` flag.

**Ready to test?** → `npm test`

---
