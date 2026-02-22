/**
 * LLM-based Selector Repair using OpenAI API
 * Intelligently repairs broken selectors by analyzing DOM changes
 */

require('dotenv').config();
const OpenAI = require('openai');

class LLMRepair {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured. Using fallback selector recovery.');
      this.client = null;
      return;
    }
    
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Find a new selector for an element using LLM
   * @param {string} oldSelector - The original selector that failed
   * @param {string} elementDescription - Description of what element we're looking for
   * @param {string} domSnippet - Relevant DOM HTML snippet
   * @returns {Promise<string>} - New XPath or CSS selector
   */
  async findNewSelector(oldSelector, elementDescription, domSnippet) {
    if (!this.client) {
      console.log('🔄 LLM not configured, using heuristic fallback');
      return this.generateFallbackSelector(oldSelector, elementDescription);
    }

    try {
      const systemPrompt = `You are an expert Selenium/Web automation specialist. Your task is to find the MOST RELIABLE selector for a web element when the original selector no longer works.

CRITICAL RULES:
1. Return ONLY ONE valid selector in your response
2. Prefer XPath selectors starting with // for flexibility
3. NEVER return a non-existent element selector
4. DO NOT hallucinate HTML tags or attributes that don't appear in the DOM
5. Focus on stable attributes like data-testid, aria-label, name, or unique text content
6. If multiple candidates exist, choose the MOST SPECIFIC and STABLE one
7. Return format: xpath=//your/xpath OR css=.your-css-selector

ANALYZE THIS DOM CAREFULLY:
${domSnippet}`;

      const userPrompt = `I need to find: "${elementDescription}"
The original selector was: ${oldSelector}

This selector no longer works. Looking at the current DOM provided above, what is the MOST LIKELY new selector for this element?

Return ONLY the selector, nothing else. Start with "xpath=" or "css="`;

      console.log('🤖 Sending repair request to OpenAI...');

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 150,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const newSelector = response.choices[0].message.content.trim();
      console.log(`📝 LLM suggested selector: ${newSelector}`);

      // Validate the response format
      if (this.isValidSelector(newSelector)) {
        return newSelector;
      } else {
        console.warn(`⚠️ LLM returned invalid selector format: ${newSelector}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ OpenAI API error: ${error.message}`);
      return this.generateFallbackSelector(oldSelector, elementDescription);
    }
  }

  /**
   * Validate selector format
   */
  isValidSelector(selector) {
    if (!selector) return false;

    // Check for common prefixes
    if (selector.startsWith('xpath=') || selector.startsWith('//')) return true;
    if (selector.startsWith('css=') || selector.startsWith('.') || selector.startsWith('[')) return true;
    if (selector.startsWith('id=')) return true;

    // Allow raw XPath
    if (selector.startsWith('//') || selector.startsWith('(/')) return true;

    return false;
  }

  /**
   * Generate fallback selector using heuristics
   */
  generateFallbackSelector(oldSelector, elementDescription) {
    console.log('🔄 Using heuristic fallback selector generation...');

    // Extract common patterns from description
    const lowerDesc = elementDescription.toLowerCase();

    if (lowerDesc.includes('login')) {
      return 'xpath=//button[contains(text(), "Login")] | //input[@id="login-btn"] | //button[@data-testid="login-button"]';
    }
    if (lowerDesc.includes('google')) {
      return 'xpath=//button[contains(., "Google")] | //*[@data-testid="google-login"] | //a[contains(@href, "google")]';
    }
    if (lowerDesc.includes('password')) {
      return 'xpath=//input[@type="password"] | //input[@name="password"] | //input[@id="password"]';
    }
    if (lowerDesc.includes('email')) {
      return 'xpath=//input[@type="email"] | //input[@name="email"] | //input[@id="email"]';
    }
    if (lowerDesc.includes('submit')) {
      return 'xpath=//button[@type="submit"] | //input[@type="submit"]';
    }

    // Generic fallback
    return 'xpath=//*[contains(text(), "' + elementDescription.split(' ')[0] + '")]';
  }

  /**
   * Analyze why selector broke and suggest fix strategy
   */
  async analyzeBreakage(oldSelector, currentDOM, errorContext) {
    if (!this.client) return null;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Analyze why this selector broke:
Original selector: ${oldSelector}

Current DOM excerpt:
${currentDOM}

Error context: ${errorContext}

What likely changed? Suggest 2-3 alternative selectors that would be more resilient.`
          }
        ]
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error(`Analysis error: ${error.message}`);
      return null;
    }
  }
}

module.exports = LLMRepair;
