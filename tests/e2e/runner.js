/**
 * E2E Test Runner
 * Orchestrates running the self-healing Selenium tests
 */

const AdvancedTestCases = require('./e2e/test-cases');

async function runE2ETests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ARES Self-Healing Selenium Test Suite');
  console.log('='.repeat(80) + '\n');

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const browser = process.env.BROWSER || 'chrome';

  console.log(`📍 Target URL: ${baseUrl}`);
  console.log(`🌐 Browser: ${browser}`);
  console.log(`⏰ Start Time: ${new Date().toISOString()}\n`);

  const testSuite = new AdvancedTestCases(baseUrl);

  try {
    const results = await testSuite.runAllTests(browser);

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl,
      browser,
      results,
      healingReport: testSuite.framework ? testSuite.framework.generateReport() : null,
      summary: {
        total: Object.keys(results).length,
        passed: Object.values(results).filter(r => r).length,
        failed: Object.values(results).filter(r => !r).length
      }
    };

    console.log('\n📊 Test Report generated');

    // Exit with appropriate code
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Test execution error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runE2ETests();
}

module.exports = runE2ETests;
