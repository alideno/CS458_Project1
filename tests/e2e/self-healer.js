/**
 * Self-Healing Selenium Framework
 * Automatically repairs broken element selectors when UI changes
 */

const { By, until, WebDriver } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');
const LLMRepair = require('./utils/llm-repair');
const HeuristicScorer = require('./utils/heuristic-scorer');
const DOMAnalyzer = require('./utils/dom-analyzer');

class SelfHealingFramework {
  constructor(driver, options = {}) {
    this.driver = driver;
    this.healingHistory = [];
    this.historicalMetadata = new Map();
    this.domListener = null;
    this.options = {
      maxRetries: options.maxRetries || 3,
      enableShadowDOM: options.enableShadowDOM !== false,
      enableHeuristicScoring: options.enableHeuristicScoring !== false,
      logPath: options.logPath || './healing-logs',
      useLLM: options.useLLM !== false,
      ...options
    };

    this.ensureLogDirectory();
    this.initializeShadowDOMListener();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.options.logPath)) {
      fs.mkdirSync(this.options.logPath, { recursive: true });
    }
  }

  initializeShadowDOMListener() {
    if (!this.options.enableShadowDOM) return;

    const shadowDOMListenerScript = `
      window.__shadowDOMChanges = [];
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            window.__shadowDOMChanges.push({
              timestamp: new Date().toISOString(),
              type: mutation.type,
              target: mutation.target.tagName || mutation.target.nodeName
            });
          }
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id', 'class', 'data-testid']
      });
    `;

    this.driver.executeScript(shadowDOMListenerScript).catch(() => {});
  }

  /**
   * Find element with self-healing capability
   * @param {By} originalSelector - Original selector to find element
   * @param {string} elementDescription - Description of element (e.g., "Login button")
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<WebElement>}
   */
  async findElementWithHealing(originalSelector, elementDescription, timeout = 10000) {
    let lastError = null;
    let healedSelector = null;

    // Store metadata about this lookup attempt for heuristic scoring
    const lookupMetadata = {
      timestamp: new Date().toISOString(),
      originalSelector: originalSelector.toString(),
      elementDescription
    };

    try {
      // First attempt: Try original selector
      console.log(`🔍 Attempting to find: ${elementDescription}`);
      const element = await this.driver.wait(until.elementLocated(originalSelector), timeout);
      
      // Store successful metadata for future healing
      await this.storeElementMetadata(element, originalSelector, elementDescription);
      
      console.log(`✅ Found element with original selector: ${elementDescription}`);
      return element;
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Original selector failed for: ${elementDescription}`);
      console.log(`❌ Error: ${error.message}`);
    }

    // Healing phase: Try to fix the selector
    if (this.options.useLLM && healedSelector === null) {
      try {
        console.log(`🔧 Initiating healing for: ${elementDescription}`);
        healedSelector = await this.healSelector(
          originalSelector,
          elementDescription,
          timeout
        );

        if (healedSelector) {
          console.log(`💚 Healed selector found: ${healedSelector}`);
          const element = await this.driver.wait(until.elementLocated(healedSelector), timeout);
          
          // Log the healing
          await this.logHealing({
            elementDescription,
            originalSelector: originalSelector.toString(),
            healedSelector: healedSelector.toString(),
            success: true,
            timestamp: new Date().toISOString()
          });

          return element;
        }
      } catch (healError) {
        console.error(`🔴 Healing failed: ${healError.message}`);
        lastError = healError;
      }
    }

    // Final fallback: Try heuristic scoring with historical metadata
    if (this.options.enableHeuristicScoring) {
      try {
        console.log(`📊 Attempting heuristic-based recovery for: ${elementDescription}`);
        const recoveredElement = await this.recoverWithHeuristics(
          elementDescription,
          timeout
        );

        if (recoveredElement) {
          console.log(`✨ Recovered element using heuristics: ${elementDescription}`);
          return recoveredElement;
        }
      } catch (heuristicError) {
        console.error(`Heuristic recovery failed: ${heuristicError.message}`);
      }
    }

    // All recovery attempts failed
    throw new Error(
      `Failed to find element "${elementDescription}" after healing attempts: ${lastError.message}`
    );
  }

  /**
   * Heal a broken selector using LLM
   */
  async healSelector(originalSelector, elementDescription, timeout) {
    try {
      // Get current page source
      const pageSource = await this.driver.getPageSource();
      const domSnippet = new DOMAnalyzer().extractRelevantDOM(pageSource, elementDescription);

      // Use LLM to find new selector
      const llmRepair = new LLMRepair();
      const newSelector = await llmRepair.findNewSelector(
        originalSelector.toString(),
        elementDescription,
        domSnippet
      );

      if (!newSelector) {
        console.log('⚠️ LLM could not suggest a valid selector');
        return null;
      }

      // Validate the new selector works
      console.log(`🧪 Testing healed selector: ${newSelector}`);
      const testElement = await this.driver.wait(
        until.elementLocated(this.parseSelector(newSelector)),
        timeout
      );

      console.log(`✅ Healed selector validated successfully`);
      return this.parseSelector(newSelector);
    } catch (error) {
      console.error(`Selector healing error: ${error.message}`);
      return null;
    }
  }

  /**
   * Recover element using heuristic scoring
   */
  async recoverWithHeuristics(elementDescription, timeout) {
    try {
      const pageSource = await this.driver.getPageSource();
      const candidates = new DOMAnalyzer().extractCandidateElements(
        pageSource,
        elementDescription
      );

      if (candidates.length === 0) {
        console.log('No candidate elements found');
        return null;
      }

      // Score candidates based on historical metadata
      const scorer = new HeuristicScorer(this.historicalMetadata);
      const scoredCandidates = candidates.map(candidate => ({
        ...candidate,
        score: scorer.scoreCandidate(candidate, elementDescription)
      }));

      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.score - a.score);

      // Try top candidates
      for (const candidate of scoredCandidates.slice(0, 3)) {
        try {
          console.log(`🎯 Trying candidate selector with score ${candidate.score}: ${candidate.selector}`);
          const element = await this.driver.wait(
            until.elementLocated(this.parseSelector(candidate.selector)),
            timeout
          );

          console.log(`🎉 Successfully recovered with heuristic selector`);
          return element;
        } catch (e) {
          console.log(`Candidate failed: ${candidate.selector}`);
        }
      }

      return null;
    } catch (error) {
      console.error(`Heuristic recovery error: ${error.message}`);
      return null;
    }
  }

  /**
   * Store metadata about an element for heuristic scoring
   */
  async storeElementMetadata(element, selector, description) {
    try {
      const location = await element.getRect();
      const tagName = await element.getTagName();
      const text = await element.getText();
      const classes = await element.getAttribute('class');
      const id = await element.getAttribute('id');
      const ariaLabel = await element.getAttribute('aria-label');

      const metadata = {
        selector: selector.toString(),
        description,
        tagName,
        text,
        classes: classes ? classes.split(' ') : [],
        id,
        ariaLabel,
        location,
        timestamp: new Date().toISOString()
      };

      // Store with key = description
      this.historicalMetadata.set(description, metadata);

      // Log metadata to file
      this.logMetadata(metadata);
    } catch (error) {
      console.warn(`Could not store metadata: ${error.message}`);
    }
  }

  /**
   * Parse selector string to By object
   */
  parseSelector(selectorString) {
    if (selectorString.startsWith('xpath=') || selectorString.startsWith('//')) {
      return By.xpath(selectorString.replace('xpath=', ''));
    }
    if (selectorString.startsWith('css=')) {
      return By.css(selectorString.replace('css=', ''));
    }
    if (selectorString.startsWith('id=')) {
      return By.id(selectorString.replace('id=', ''));
    }
    if (selectorString.startsWith('[data-testid')) {
      return By.css(selectorString);
    }
    // Default to XPath
    return By.xpath(selectorString);
  }

  /**
   * Log healing event
   */
  async logHealing(healingEvent) {
    this.healingHistory.push(healingEvent);

    const logFile = path.join(this.options.logPath, 'healing-log.json');
    const logData = {
      timestamp: new Date().toISOString(),
      totalHealings: this.healingHistory.length,
      events: this.healingHistory
    };

    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  }

  /**
   * Log element metadata
   */
  logMetadata(metadata) {
    const logFile = path.join(this.options.logPath, 'element-metadata.json');
    let existingData = [];

    if (fs.existsSync(logFile)) {
      existingData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }

    existingData.push(metadata);
    fs.writeFileSync(logFile, JSON.stringify(existingData, null, 2));
  }

  /**
   * Get Shadow DOM changes
   */
  async getShadowDOMChanges() {
    try {
      return await this.driver.executeScript('return window.__shadowDOMChanges || [];');
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate healing report
   */
  generateReport() {
    return {
      totalHealings: this.healingHistory.length,
      sucessfulHealings: this.healingHistory.filter(h => h.success).length,
      healingRate: this.healingHistory.length > 0
        ? (this.healingHistory.filter(h => h.success).length / this.healingHistory.length * 100).toFixed(2) + '%'
        : 'N/A',
      healings: this.healingHistory
    };
  }
}

module.exports = SelfHealingFramework;
