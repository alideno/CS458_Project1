#!/usr/bin/env node

/**
 * Command-line interface for running tests
 * Usage: npm test [option]
 */

const { spawn } = require('child_process');
const path = require('path');

const commands = {
  unit: () => spawn('jest', ['tests/unit', '--detectOpenHandles'], { stdio: 'inherit' }),
  integration: () => spawn('jest', ['tests/integration', '--detectOpenHandles'], { stdio: 'inherit' }),
  e2e: () => spawn('node', ['tests/e2e/runner.js'], { stdio: 'inherit' }),
  'e2e:firefox': () => {
    process.env.BROWSER = 'firefox';
    return spawn('node', ['tests/e2e/runner.js'], { stdio: 'inherit' });
  },
  all: () => spawn('jest', ['--detectOpenHandles', '--coverage'], { stdio: 'inherit' }),
  watch: () => spawn('jest', ['--watch'], { stdio: 'inherit' }),
  coverage: () => spawn('jest', ['--coverage'], { stdio: 'inherit' })
};

const testType = process.argv[2] || 'all';

if (!commands[testType]) {
  console.error(`\n❌ Unknown test type: ${testType}`);
  console.error('\nAvailable options:');
  Object.keys(commands).forEach(cmd => console.error(`  npm test ${cmd}`));
  process.exit(1);
}

console.log(`\n🧪 Running tests: ${testType}\n`);
const proc = commands[testType]();

proc.on('exit', (code) => {
  process.exit(code);
});
