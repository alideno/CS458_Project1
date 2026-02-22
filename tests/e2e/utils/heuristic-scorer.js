/**
 * Heuristic Scoring System
 * Scores candidate elements based on historical metadata and similarity
 */

class HeuristicScorer {
  constructor(historicalMetadata = new Map()) {
    this.historicalMetadata = historicalMetadata;
    this.weights = {
      textSimilarity: 0.25,
      locationProximity: 0.20,
      tagMatch: 0.15,
      classMatch: 0.15,
      idMatch: 0.10,
      ariaMatch: 0.10,
      recency: 0.05
    };
  }

  /**
   * Score a candidate element
   */
  scoreCandidate(candidate, elementDescription) {
    let totalScore = 0;

    // Get historical reference if available
    const historicalData = this.historicalMetadata.get(elementDescription);

    if (!historicalData) {
      // No historical data: basic scoring
      return this.basicScore(candidate, elementDescription);
    }

    // Text similarity (high importance)
    const textScore = this.scoreTextSimilarity(candidate.text, historicalData.text);
    totalScore += textScore * this.weights.textSimilarity;

    // Location proximity (how close to original)
    const locationScore = this.scoreLocationProximity(
      candidate.location,
      historicalData.location
    );
    totalScore += locationScore * this.weights.locationProximity;

    // Tag name match
    const tagScore = candidate.tagName === historicalData.tagName ? 1.0 : 0.5;
    totalScore += tagScore * this.weights.tagMatch;

    // Class similarity
    const classScore = this.scoreClassSimilarity(candidate.classes, historicalData.classes);
    totalScore += classScore * this.weights.classMatch;

    // ID match
    const idScore = candidate.id && historicalData.id && candidate.id === historicalData.id ? 1.0 : 0;
    totalScore += idScore * this.weights.idMatch;

    // ARIA label match
    const ariaScore = candidate.ariaLabel && historicalData.ariaLabel &&
      candidate.ariaLabel === historicalData.ariaLabel ? 1.0 : 0;
    totalScore += ariaScore * this.weights.ariaMatch;

    // Recency bonus (recent elements are more likely to be correct)
    const recencyScore = this.scoreRecency(historicalData.timestamp);
    totalScore += recencyScore * this.weights.recency;

    return totalScore;
  }

  /**
   * Text similarity score (0-1)
   */
  scoreTextSimilarity(currentText, historicalText) {
    if (!currentText && !historicalText) return 1.0;
    if (!currentText || !historicalText) return 0;

    // Exact match
    if (currentText === historicalText) return 1.0;

    // Substring match
    if (currentText.includes(historicalText) || historicalText.includes(currentText)) {
      return 0.8;
    }

    // Partial match (Levenshtein-like)
    const similarity = this.stringSimilarity(currentText, historicalText);
    return Math.max(similarity, 0);
  }

  /**
   * Location proximity score (0-1)
   * Closer locations are more likely to be the correct element
   */
  scoreLocationProximity(currentLocation, historicalLocation) {
    if (!currentLocation || !historicalLocation) return 0.5;

    const { x: cx = 0, y: cy = 0, width: cw = 0, height: ch = 0 } = currentLocation;
    const { x: hx = 0, y: hy = 0, width: hw = 0, height: hh = 0 } = historicalLocation;

    // Calculate center points
    const currentCenter = { x: cx + cw / 2, y: cy + ch / 2 };
    const historicalCenter = { x: hx + hw / 2, y: hy + hh / 2 };

    // Euclidean distance
    const distance = Math.sqrt(
      Math.pow(currentCenter.x - historicalCenter.x, 2) +
      Math.pow(currentCenter.y - historicalCenter.y, 2)
    );

    // Convert distance to score (max distance threshold: 500px)
    const maxDistance = 500;
    const score = Math.max(0, 1 - (distance / maxDistance));
    return Math.min(1, score);
  }

  /**
   * Class similarity score (0-1)
   */
  scoreClassSimilarity(currentClasses = [], historicalClasses = []) {
    if (currentClasses.length === 0 && historicalClasses.length === 0) return 1.0;
    if (currentClasses.length === 0 || historicalClasses.length === 0) return 0.3;

    const commonClasses = currentClasses.filter(c => historicalClasses.includes(c));
    const totalClasses = new Set([...currentClasses, ...historicalClasses]).size;

    return totalClasses > 0 ? commonClasses.length / totalClasses : 0;
  }

  /**
   * Recency score: boost newer elements
   */
  scoreRecency(historicalTimestamp) {
    if (!historicalTimestamp) return 0.5;

    const now = new Date();
    const timestamp = new Date(historicalTimestamp);
    const ageMs = now - timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Elements less than 7 days old get higher score
    if (ageDays < 7) return 1.0;
    if (ageDays < 30) return 0.8;
    if (ageDays < 90) return 0.6;
    return 0.3;
  }

  /**
   * Basic scoring when no historical data available
   */
  basicScore(candidate, elementDescription) {
    let score = 0;

    // Text match is primary factor
    const lowerDesc = elementDescription.toLowerCase();
    const lowerText = (candidate.text || '').toLowerCase();

    if (lowerText === lowerDesc) {
      score += 100;
    } else if (lowerText.includes(lowerDesc.split(' ')[0])) {
      score += 50;
    }

    // Favor specific selectors
    if (candidate.id) score += 30;
    if (candidate.ariaLabel) score += 25;
    if (candidate.classes.length > 0) score += 20;

    // Penalize generic elements
    if (candidate.tagName === 'div' && !candidate.classes.length) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate string similarity (Levenshtein distance normalized)
   */
  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen > 0 ? 1 - distance / maxLen : 1;
  }
}

module.exports = HeuristicScorer;
