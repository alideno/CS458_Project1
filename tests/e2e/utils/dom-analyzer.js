/**
 * DOM Analysis Utilities
 * Extracts and analyzes DOM elements for healing purposes
 */

const xml2js = require('xml2js');

class DOMAnalyzer {
  /**
   * Extract relevant DOM snippet around an element description
   */
  extractRelevantDOM(pageSource, elementDescription, contextRadius = 500) {
    try {
      // Search for element containing the description text
      const patterns = [
        new RegExp(`<[^>]*>${elementDescription}[^>]*</[^>]*>`, 'i'),
        new RegExp(`[^>]*${elementDescription.split(' ')[0]}[^>]*`, 'i'),
        new RegExp(`<button[^>]*>\\s*${elementDescription}\\s*</button>`, 'i'),
        new RegExp(`<a[^>]*>\\s*${elementDescription}\\s*</a>`, 'i')
      ];

      let match = null;
      for (const pattern of patterns) {
        match = pageSource.match(pattern);
        if (match) break;
      }

      if (match) {
        // Get context around the match
        const startIdx = Math.max(0, match.index - contextRadius);
        const endIdx = Math.min(pageSource.length, match.index + match[0].length + contextRadius);
        return pageSource.substring(startIdx, endIdx);
      }

      // Fallback: return first 2000 characters
      return pageSource.substring(0, Math.min(2000, pageSource.length));
    } catch (error) {
      console.warn(`Error extracting DOM: ${error.message}`);
      return pageSource.substring(0, 2000);
    }
  }

  /**
   * Extract candidate elements from DOM
   * Returns array of potential elements matching the description
   */
  extractCandidateElements(pageSource, elementDescription) {
    const candidates = [];

    try {
      // Parse HTML to find relevant elements
      const patterns = {
        buttons: /<button[^>]*>([^<]*)<\/button>/gi,
        links: /<a[^>]*href=["'][^"']*["'][^>]*>([^<]*)<\/a>/gi,
        inputs: /<input[^>]*(?:value=["']([^"']*)["'])?[^>]*>/gi,
        divs: /<div[^>]*data-testid=["']([^"']*)["'][^>]*>/gi
      };

      for (const [elementType, pattern] of Object.entries(patterns)) {
        let match;
        while ((match = pattern.exec(pageSource)) !== null) {
          const fullMatch = match[0];
          const text = match[1] || '';

          // Extract attributes
          const idMatch = fullMatch.match(/id=["']([^"']*)["']/);
          const classMatch = fullMatch.match(/class=["']([^"']*)["']/);
          const dataTestIdMatch = fullMatch.match(/data-testid=["']([^"']*)["']/);
          const ariaLabelMatch = fullMatch.match(/aria-label=["']([^"']*)["']/);

          const candidate = {
            elementType,
            text: text.trim(),
            id: idMatch ? idMatch[1] : null,
            classes: classMatch ? classMatch[1].split(' ') : [],
            dataTestId: dataTestIdMatch ? dataTestIdMatch[1] : null,
            ariaLabel: ariaLabelMatch ? ariaLabelMatch[1] : null,
            fullHTML: fullMatch.substring(0, 200), // First 200 chars
            selector: this.generateSelectorFromHTML(fullMatch),
            relevanceScore: this.calculateRelevance(text, elementDescription)
          };

          // Only include if somewhat relevant
          if (candidate.relevanceScore > 0.3) {
            candidates.push(candidate);
          }
        }
      }

      // Sort by relevance
      candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

      return candidates.slice(0, 10); // Return top 10 candidates
    } catch (error) {
      console.warn(`Error extracting candidates: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate selector from HTML element
   */
  generateSelectorFromHTML(htmlString) {
    // Try to extract id first
    const idMatch = htmlString.match(/id=["']([^"']*)["']/);
    if (idMatch) {
      return `id=${idMatch[1]}`;
    }

    // Try data-testid
    const testIdMatch = htmlString.match(/data-testid=["']([^"']*)["']/);
    if (testIdMatch) {
      return `[data-testid="${testIdMatch[1]}"]`;
    }

    // Try aria-label
    const ariaMatch = htmlString.match(/aria-label=["']([^"']*)["']/);
    if (ariaMatch) {
      return `xpath=//*[@aria-label="${ariaMatch[1]}"]`;
    }

    // Generate XPath from text
    const textMatch = htmlString.match(/>([^<]+)<\//);
    if (textMatch) {
      const text = textMatch[1].trim();
      const tagMatch = htmlString.match(/^<([a-z]+)/i);
      if (tagMatch) {
        const tag = tagMatch[1];
        return `xpath=//${tag}[contains(text(), "${text.substring(0, 30)}")]`;
      }
    }

    // Fallback to CSS class
    const classMatch = htmlString.match(/class=["']([^"']*)["']/);
    if (classMatch) {
      const firstClass = classMatch[1].split(' ')[0];
      return `css=.${firstClass}`;
    }

    return null;
  }

  /**
   * Calculate relevance score of element text to description (0-1)
   */
  calculateRelevance(elementText, description) {
    if (!elementText || !description) return 0;

    const lowerText = elementText.toLowerCase();
    const lowerDesc = description.toLowerCase();

    // Exact match
    if (lowerText === lowerDesc) return 1.0;

    // Contains description
    if (lowerText.includes(lowerDesc)) return 0.9;

    // Description contains text
    if (lowerDesc.includes(lowerText)) return 0.7;

    // Word matching
    const descWords = lowerDesc.split(/\s+/);
    const textWords = lowerText.split(/\s+/);
    const matches = descWords.filter(word => textWords.some(t => t.includes(word)));

    if (matches.length > 0) {
      return Math.min(matches.length / descWords.length, 0.8);
    }

    return 0;
  }

  /**
   * Get element by position in the element tree
   */
  getElementByPosition(pageSource, position) {
    // position = { x, y, width, height }
    try {
      const regex = /<([a-z]+)[^>]*(?:style=["']([^"']*)["'])?[^>]*>/gi;
      let match;
      const elements = [];

      while ((match = regex.exec(pageSource)) !== null) {
        elements.push({
          tag: match[1],
          styles: match[2] || '',
          html: match[0]
        });
      }

      // Filter by approximate position (simple heuristic)
      return elements;
    } catch (error) {
      console.warn(`Error getting element by position: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract all elements with a specific attribute
   */
  extractElementsByAttribute(pageSource, attributeName, attributeValue) {
    const regex = new RegExp(
      `<[^>]*${attributeName}=["']${attributeValue}["'][^>]*>`,
      'gi'
    );

    const matches = [];
    let match;

    while ((match = regex.exec(pageSource)) !== null) {
      matches.push(match[0]);
    }

    return matches;
  }

  /**
   * Find all interactive elements (buttons, links, inputs)
   */
  extractInteractiveElements(pageSource) {
    const interactive = [];
    const patterns = [
      { type: 'button', regex: /<button[^>]*>([^<]*)<\/button>/gi },
      { type: 'link', regex: /<a[^>]*>([^<]*)<\/a>/gi },
      { type: 'input', regex: /<input[^>]*>/gi },
      { type: 'select', regex: /<select[^>]*>([^<]*)<\/select>/gi }
    ];

    for (const { type, regex } of patterns) {
      let match;
      while ((match = regex.exec(pageSource)) !== null) {
        interactive.push({
          type,
          html: match[0],
          text: match[1] || ''
        });
      }
    }

    return interactive;
  }
}

module.exports = DOMAnalyzer;
