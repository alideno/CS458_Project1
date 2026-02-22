# Self-Healing Selenium Framework

## What is Self-Healing?

A self-healing test framework automatically repairs broken Selenium tests when UI elements change. Instead of tests failing when developers modify HTML IDs, classes, or text, the framework intelligently finds the new selectors and continues execution.

### Traditional Problem
```javascript
// Test breaks when ID changes from "login-btn" to "auth-btn"
const loginBtn = driver.findElement(By.id('login-btn')); // ❌ FAILS
```

### Self-Healing Solution
```javascript
// Framework detects failure, analyzes DOM, finds new selector
const loginBtn = await framework.findElementWithHealing(
  By.id('login-btn'), // Original (now broken)
  'Login button'      // Description for LLM
);
// ✅ Works! Framework found new selector: xpath=//button[@data-testid='login']
```

---

## Architecture

### 1. Detection Layer
```
findElement → Fails with StaleElementReferenceException
              ↓
         Try-Catch Block
              ↓
          Healing Triggered
```

### 2. Context Extraction
```
Get Page Source
       ↓
Extract Relevant DOM
       ↓
Identify Element Region
       ↓
Prepare for LLM Analysis
```

### 3. LLM Repair (Claude API)
```
System Prompt: "You are a Selenium expert..."
User Prompt: "Old: id='login-btn', New DOM: <button data-testid='login'>..."
       ↓
Claude Response: "xpath=//button[@data-testid='login']"
       ↓
Validate Selector
```

### 4. Heuristic Scoring (Fallback)
```
Extract Candidate Elements
       ↓
Score Each Candidate
  - Text Similarity: 25%
  - Location Proximity: 20%
  - Tag Match: 15%
  - Class Match: 15%
  - ID Match: 10%
  - ARIA Label: 10%
  - Recency: 5%
       ↓
Try Top Candidates
       ↓
Return First Match
```

### 5. Logging & Metadata
```
Save Healing Event:
  - Original selector
  - New selector
  - Success status
  - Timestamp
       ↓
Store Element Metadata:
  - Location (x, y, w, h)
  - Text content
  - Classes
  - ARIA labels
  - Historical reference
```

---

## Component Files

### Core Framework
```
tests/e2e/self-healer.js
│
├─ SelfHealingFramework class
├─ findElementWithHealing(selector, description, timeout)
├─ healSelector(selector, description, timeout)
├─ recoverWithHeuristics(descriptor, timeout)
└─ generateReport()
```

### LLM Integration
```
tests/e2e/utils/llm-repair.js
│
├─ LLMRepair class
├─ findNewSelector(oldSelector, description, domSnippet)
├─ isValidSelector(selector)
└─ analyzeBreakage(selector, dom, context)
```

### Heuristic Scoring
```
tests/e2e/utils/heuristic-scorer.js
│
├─ HeuristicScorer class
├─ scoreCandidate(candidate, description)
├─ scoreTextSimilarity(text1, text2)
├─ scoreLocationProximity(loc1, loc2)
└─ scoreClassSimilarity(classes1, classes2)
```

### DOM Analysis
```
tests/e2e/utils/dom-analyzer.js
│
├─ DOMAnalyzer class
├─ extractRelevantDOM(pageSource, description)
├─ extractCandidateElements(pageSource, description)
├─ generateSelectorFromHTML(htmlString)
└─ calculateRelevance(elementText, description)
```

---

## Healing Flow Diagram

```
┌─────────────────────────┐
│  findElementWithHealing │
└────────────┬────────────┘
             │
             ▼
    ┌────────────────┐
    │ Try Original   │
    │ Selector       │
    └────┬────────────┘
         │
         ├─ Success ─────────────────────┐
         │                              │
         └─ Fail ─────────────────────┐ │
                                      │ │
                                  Step 1
                                      │ │
                                      ▼ ▼
                            ┌────────────────────┐
                            │ Get Page Source    │
                            │ Extract Relevant   │
                            │ DOM Snippet        │
                            └────────┬───────────┘
                                     │
                                     ▼
                    ┌────────────────────────────┐
                    │ Query LLM with DOM Context │
                    │ (Claude API)               │
                    └────┬───────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
          Success                 Fail
              │                     │
              ▼                     ▼
    ┌──────────────────┐  ┌────────────────────┐
    │ Validate & Test  │  │ Heuristic Scoring  │
    │ New Selector     │  │ Fallback           │
    └────┬─────────────┘  └────┬───────────────┘
         │                     │
         ├─ Valid ────┐        │
         │            └─────┬──┴────────────┐
         │                  │               │
         ├─ Invalid ────────┤          Found Match
         │                  │          ✅ Success
         └─ Not Found ──────┤
                            │
                     Retry ──┤
                            │
                  Max Retries Exceeded
                     ❌ Fail
```

---

## Usage Examples

### Basic Setup
```javascript
const SelfHealingFramework = require('./self-healer');

// Create framework instance
const framework = new SelfHealingFramework(driver, {
  maxRetries: 3,
  enableShadowDOM: true,
  enableHeuristicScoring: true,
  useLLM: true,
  logPath: './healing-logs'
});
```

### Finding Elements
```javascript
// Simple find with healing
const loginBtn = await framework.findElementWithHealing(
  By.id('login-btn'),
  'Login button',
  10000 // timeout in ms
);

// Click and heal
await loginBtn.click();

// Fill input and heal
const emailInput = await framework.findElementWithHealing(
  By.css('[name="email"]'),
  'Email input field'
);
await emailInput.sendKeys('test@example.com');
```

### Advanced Configuration
```javascript
const framework = new SelfHealingFramework(driver, {
  maxRetries: 5,
  enableShadowDOM: true,
  enableHeuristicScoring: true,
  useLLM: true,
  logPath: './my-logs',
  // Custom options passed to constructor
});
```

### Generating Reports
```javascript
const report = framework.generateReport();
console.log(`Total healings: ${report.totalHealings}`);
console.log(`Success rate: ${report.healingRate}`);
console.log(`Details:`, report.healings);
```

---

## LLM Configuration

### Claude API (Recommended)
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### OpenAI API
```bash
export OPENAI_API_KEY="sk-..."
```

### Prompt Engineering

The system prompt forces the LLM to:
1. **Only return valid selectors** - No hallucination of HTML
2. **Prioritize stable attributes** - data-testid > aria-label > text
3. **Use XPath for flexibility** - //tag[conditions] format
4. **Never invent elements** - Must appear in provided DOM

**Example Interaction**:
```
INPUT:
  Original: id='login-btn'
  Description: "Login button"
  DOM contains: <button data-testid="auth-submit">Login</button>

OUTPUT:
  xpath=//button[@data-testid="auth-submit"]
```

---

## Heuristic Scoring Algorithm

When LLM unavailable, scores candidates using:

### Text Similarity (25%)
- Exact match: 1.0
- Substring: 0.8
- Levenshtein: normalized

### Location Proximity (20%)
- Calculates center-point distance
- Threshold: 500px
- Sweet spot: <100px

### Tag Match (15%)
- Same HTML tag: 1.0
- Different: 0.5

### Class Similarity (15%)
- Common classes / total classes
- Penalizes completely different classes

### Historical Metadata (30%)
- ID exact match: 1.0
- ARIA label match: 1.0
- Recency bonus: newer > older

**Example Score Calculation**:
```
Candidate: <button class="btn primary">Login</button>

Text match:     "Login" == "Login" → 1.0 × 0.25 = 0.25
Location:       10px away → 0.98 × 0.20 = 0.196
Tag:            button == button → 1.0 × 0.15 = 0.15
Classes:        2/2 match → 1.0 × 0.15 = 0.15
ID:             no match → 0.0 × 0.10 = 0.0
ARIA:           no match → 0.0 × 0.10 = 0.0
Recency:        recent → 0.9 × 0.05 = 0.045

TOTAL SCORE: 0.75 / 1.0 = 75%
```

---

## Shadow DOM Monitoring

Tracks mutations asynchronously:
```javascript
// Automatically monitors:
window.__shadowDOMChanges = [
  { timestamp: "2024-02-22T...", type: "childList", target: "button" },
  { timestamp: "2024-02-22T...", type: "attributes", target: "div" }
];

// Access changes
const changes = await driver.executeScript('return window.__shadowDOMChanges');
```

---

## Logging

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

### Element Metadata
```json
[
  {
    "selector": "id=login-btn",
    "description": "Login button",
    "tagName": "button",
    "text": "Login",
    "classes": ["btn", "btn-primary"],
    "id": "login-btn",
    "location": { "x": 100, "y": 50, "width": 80, "height": 36 },
    "timestamp": "2024-02-22T10:30:00Z"
  }
]
```

---

## Performance Optimization

### Caching Strategies
1. **Selector Cache** - Reuse successful selectors
2. **Metadata Cache** - Store element properties
3. **DOM Cache** - Minimize re-parsing

### Retry Backoff
- Initial: 500ms
- Exponential: ×1.5
- Max: 5s

### Parallel Scoring
- Evaluate multiple candidates simultaneously
- Sort by score
- Try top 3 candidates

---

## Error Handling

### Recovery Strategy
```
1. Try Original Selector
   ↓ Fails
2. Query LLM
   ↓ Fails or returns invalid
3. Heuristic Scoring
   ↓ Fails
4. Generic Fallback
   ↓ Fails
5. Throw Error with Context
```

### Error Messages
```javascript
// High-context error
Error: Failed to find element "Login button" after healing attempts:
  - Original selector (id=login-btn) not found
  - LLM suggested (xpath=//button[@data]) not found
  - Heuristic recovery found no qualifying candidates
  - Error stack trace...
  
  Healing logs saved to: ./healing-logs/healing-log.json
  Suggested action: Check element manually, update metadata
```

---

## Best Practices

1. **Always Use Descriptions** - "Login button" > "Button 1"
2. **Stable Attributes First** - data-testid > aria-label > class
3. **Monitor Metadata** - Review healing-logs regularly
4. **Test Frequently** - Catch breakages early
5. **Keep API Keys Secure** - Use environment variables
6. **Update Prompts** - Improve LLM suggestions iteratively

---

## Limitations

- ❌ Cannot find elements that don't exist
- ❌ Cannot interact with invisible elements
- ❌ May fail on heavily dynamic UIs
- ❌ Requires stable element descriptions
- ❌ LLM costs scale with usage

## Strengths

- ✅ Handles ID/class changes automatically
- ✅ Cross-browser compatible
- ✅ Adapts to CSS changes
- ✅ Learns from historical data
- ✅ Fallback strategies for all scenarios

---

## FAQ

**Q: How often should I run tests?**
A: Continuously! On every push, PR, and scheduled daily.

**Q: How much does the LLM cost?**
A: Claude: $3-$15 per million tokens (~$0.01-0.05 per test run)

**Q: Can I use without LLM?**
A: Yes! Heuristic scoring works as fallback.

**Q: How do I improve healing success?**
A: 
1. Keep metadata files up-to-date
2. Add more test data
3. Improve prompt engineering
4. Use stable element identifiers

**Q: How long does healing take?**
A: 1-5 seconds typically, depends on LLM latency

---

## Version History

- **v1.0.0** (Feb 2024) - Initial release
  - LLM-based repair with Claude
  - Heuristic scoring fallback
  - Shadow DOM monitoring
  - Full logging system

---

## Contributing

To improve the framework:
1. Add new scorer weights
2. Improve prompt engineering
3. Add fallback selector patterns
4. Optimize performance

See [TESTING.md](./TESTING.md) for full documentation.

---

**Happy Self-Healing Testing! 🎉**
