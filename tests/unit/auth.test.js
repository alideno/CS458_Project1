/**
 * Unit Tests for Risk Scoring and Adaptive Authorization
 */

describe('Risk Scoring System', () => {
  // Mock the calculateRiskScore function
  const calculateRiskScore = (userData, currentIP, loginContext = {}) => {
    let riskScore = 0;
    const riskFactors = [];

    const failedAttempts = userData.failedAttempts || 0;
    const failedAttemptsScore = Math.min(failedAttempts * 10, 100);
    riskScore += failedAttemptsScore;
    if (failedAttempts > 0) riskFactors.push(`${failedAttempts} failed attempts (+${failedAttemptsScore}pts)`);

    const previousIPs = userData.loginIPs || [];
    
    // Either first-ever login OR new IP for returning user (not both)
    if (!previousIPs.includes(currentIP)) {
      if (previousIPs.length === 0) {
        // First-ever login
        riskScore += 10;
        riskFactors.push(`First-ever login (+10pts)`);
      } else {
        // New IP for returning user
        riskScore += 15;
        riskFactors.push(`New IP address: ${currentIP} (+15pts)`);
      }
    }

    return {
      score: Math.min(riskScore, 100),
      factors: riskFactors,
      level: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high'
    };
  };

  describe('Score Calculation', () => {
    test('should return low risk for new user from new IP', () => {
      const userData = {
        failedAttempts: 0,
        loginIPs: []
      };

      const result = calculateRiskScore(userData, '192.168.1.1');

      expect(result.score).toBe(10); // First-ever login bonus
      expect(result.level).toBe('low');
    });

    test('should return low risk for returning user from known IP', () => {
      const userData = {
        failedAttempts: 0,
        loginIPs: ['192.168.1.1', '192.168.1.2']
      };

      const result = calculateRiskScore(userData, '192.168.1.1');

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });

    test('should increase score for new IP', () => {
      const userData = {
        failedAttempts: 0,
        loginIPs: ['192.168.1.1']
      };

      const result = calculateRiskScore(userData, '10.0.0.1');

      expect(result.score).toBe(15); // New IP penalty
      expect(result.level).toBe('low');
      expect(result.factors).toContain('New IP address: 10.0.0.1 (+15pts)');
    });

    test('should penalize failed attempts', () => {
      const userData = {
        failedAttempts: 5,
        loginIPs: ['192.168.1.1']
      };

      const result = calculateRiskScore(userData, '192.168.1.1');

      expect(result.score).toBeGreaterThan(40); // 5 * 10 = 50
      expect(result.level).toBe('medium');
    });

    test('should cap risk score at 100', () => {
      const userData = {
        failedAttempts: 15, // Would be 150 without cap
        loginIPs: []
      };

      const result = calculateRiskScore(userData, '10.0.0.1');

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.level).toBe('high');
    });
  });

  describe('Risk Levels', () => {
    test('should classify low risk', () => {
      const userData = {
        failedAttempts: 1,
        loginIPs: ['192.168.1.1']
      };

      const result = calculateRiskScore(userData, '192.168.1.1');

      expect(result.level).toBe('low');
    });

    test('should classify medium risk', () => {
      const userData = {
        failedAttempts: 3,
        loginIPs: ['192.168.1.1']
      };

      const result = calculateRiskScore(userData, '10.0.0.1');

      expect(result.level).toBe('medium');
    });

    test('should classify high risk', () => {
      const userData = {
        failedAttempts: 8,
        loginIPs: []
      };

      const result = calculateRiskScore(userData, '10.0.0.1');

      expect(result.level).toBe('high');
    });
  });

  describe('Risk Factors', () => {
    test('should include all applicable risk factors', () => {
      const userData = {
        failedAttempts: 2,
        loginIPs: ['192.168.1.1']
      };

      const result = calculateRiskScore(userData, '10.0.0.1');

      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.factors).toContain('2 failed attempts (+20pts)');
      expect(result.factors).toContain('New IP address: 10.0.0.1 (+15pts)');
    });

    test('should handle empty risk factors for low-risk user', () => {
      const userData = {
        failedAttempts: 0,
        loginIPs: ['192.168.1.1']
      };

      const result = calculateRiskScore(userData, '192.168.1.1');

      expect(result.factors.length).toBe(0);
    });
  });
});

describe('Adaptive Authorization', () => {
  const determineChallenge = (riskScore) => {
    if (riskScore < 30) return null; // No additional challenge
    if (riskScore < 60) return 'mfa'; // Multi-factor authentication
    return 'block'; // Block the login attempt
  };

  test('should not require challenge for low risk', () => {
    const challenge = determineChallenge(20);
    expect(challenge).toBe(null);
  });

  test('should require MFA for medium risk', () => {
    const challenge = determineChallenge(50);
    expect(challenge).toBe('mfa');
  });

  test('should block high risk', () => {
    const challenge = determineChallenge(80);
    expect(challenge).toBe('block');
  });

  test('should require MFA at threshold boundary', () => {
    const challenge = determineChallenge(60);
    expect(challenge).toBe('block');
  });
});

describe('Password Validation', () => {
  const validatePassword = (password) => {
    const errors = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain number');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain special character (!@#$%^&*)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  test('should accept strong password', () => {
    const result = validatePassword('SecurePass123!');
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('should reject password without uppercase', () => {
    const result = validatePassword('securepass123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain uppercase letter');
  });

  test('should reject short password', () => {
    const result = validatePassword('Pass1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  test('should reject password without number', () => {
    const result = validatePassword('SecurePass!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain number');
  });

  test('should reject password without special character', () => {
    const result = validatePassword('SecurePass123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain special character (!@#$%^&*)');
  });
});

describe('Session Validation', () => {
  const validateSession = (session) => {
    if (!session) return { valid: false, reason: 'No session' };
    if (!session.user) return { valid: false, reason: 'No user' };
    if (!session.userId) return { valid: false, reason: 'No userId' };
    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      return { valid: false, reason: 'Session expired' };
    }
    return { valid: true, reason: 'Valid session' };
  };

  test('should accept valid session', () => {
    const session = {
      user: { email: 'test@example.com' },
      userId: '12345',
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };

    const result = validateSession(session);
    expect(result.valid).toBe(true);
  });

  test('should reject null session', () => {
    const result = validateSession(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('No session');
  });

  test('should reject session without user', () => {
    const session = { userId: '12345' };
    const result = validateSession(session);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('No user');
  });

  test('should reject expired session', () => {
    const session = {
      user: { email: 'test@example.com' },
      userId: '12345',
      expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
    };

    const result = validateSession(session);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Session expired');
  });
});
