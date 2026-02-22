#!/usr/bin/env node

/**
 * ARES Test Suite Installation & Setup Script
 * Automates initial configuration and verification
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}: ${filePath}`, 'green');
    return true;
  } else {
    log(`❌ Missing: ${filePath}`, 'red');
    return false;
  }
}

function checkCommand(command, description) {
  try {
    execSync(`${command} --version`, { stdio: 'pipe' });
    log(`✅ ${description}`, 'green');
    return true;
  } catch (e) {
    log(`❌ ${description} not installed`, 'red');
    return false;
  }
}

async function main() {
  log('\n🚀 ARES TEST SUITE - INSTALLATION VERIFICATION', 'cyan');
  log('version 1.0.0\n', 'cyan');

  let allGood = true;

  // Check Prerequisites
  section('CHECKING PREREQUISITES');
  
  if (!checkCommand('node', 'Node.js')) {
    allGood = false;
    log('→ Install from: https://nodejs.org/', 'yellow');
  }
  
  if (!checkCommand('npm', 'npm')) {
    allGood = false;
    log('→ npm should come with Node.js', 'yellow');
  }

  // Check Project Files
  section('CHECKING PROJECT FILES');

  const requiredFiles = [
    ['jest.config.js', 'Jest Configuration'],
    ['tests/setup.js', 'Jest Setup'],
    ['tests/e2e/self-healer.js', 'Self-Healing Framework'],
    ['tests/e2e/test-cases.js', '5 Test Scenarios'],
    ['tests/e2e/utils/llm-repair.js', 'LLM Repair Module'],
    ['tests/e2e/utils/heuristic-scorer.js', 'Heuristic Scoring'],
    ['tests/e2e/utils/dom-analyzer.js', 'DOM Analysis'],
    ['tests/unit/auth.test.js', 'Unit Tests'],
    ['tests/integration/auth.test.js', 'Integration Tests'],
    ['TESTING.md', 'Test Documentation'],
    ['SELF_HEALING_GUIDE.md', 'Framework Guide'],
    ['QUICK_START.md', 'Quick Start Guide'],
    ['.github/workflows/test.yml', 'GitHub Actions Workflow']
  ];

  let filesOk = true;
  for (const [file, desc] of requiredFiles) {
    if (!checkFile(file, desc)) {
      filesOk = false;
    }
  }

  // Check Dependencies
  section('CHECKING INSTALLED DEPENDENCIES');

  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = [
      'selenium-webdriver',
      'express',
      'firebase-admin',
      'passport-google-oauth20',
      'passport-facebook'
    ];

    const devDeps = ['jest', 'supertest'];

    let depsOk = true;
    
    for (const dep of requiredDeps) {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        log(`✅ ${dep}`, 'green');
      } else {
        log(`❌ Missing dependency: ${dep}`, 'red');
        depsOk = false;
      }
    }

    for (const dep of devDeps) {
      if (pkg.devDependencies && pkg.devDependencies[dep]) {
        log(`✅ ${dep} (dev)`, 'green');
      } else {
        log(`❌ Missing dev dependency: ${dep}`, 'red');
        depsOk = false;
      }
    }

    if (!depsOk || !filesOk) {
      allGood = false;
    }
  }

  // Check Environment Configuration
  section('CHECKING ENVIRONMENT SETUP');

  const envFile = fs.existsSync('.env');
  const envExampleFile = fs.existsSync('.env.example');

  if (envFile) {
    log('✅ .env file exists', 'green');
  } else {
    log('⚠️  .env file not found', 'yellow');
    log('→ Create with: cp .env.example .env', 'yellow');
  }

  if (process.env.OPENAI_API_KEY) {
    log('✅ OPENAI_API_KEY is set', 'green');
  } else {
    log('⚠️  OPENAI_API_KEY environment variable not set', 'yellow');
    log('→ Run: export OPENAI_API_KEY="sk-..."', 'yellow');
  }

  // Summary
  section('INSTALLATION STATUS');

  if (allGood) {
    log('\n✅ ALL SYSTEMS READY!\n', 'green');
    log('Next steps:', 'cyan');
    log('1. npm install               # Install dependencies', 'blue');
    log('2. export OPENAI_API_KEY="sk-..."', 'blue');
    log('3. npm start                 # Start server', 'blue');
    log('4. npm test                  # Run tests', 'blue');
    log('\nFor more information: see QUICK_START.md', 'cyan');
  } else {
    log('\n⚠️  SETUP INCOMPLETE\n', 'yellow');
    log('Suggested fixes:', 'cyan');
    
    if (!filesOk) {
      log('→ Some project files might be missing', 'yellow');
      log('→ Ensure all files were created correctly', 'yellow');
    }
    
    log('→ Run: npm install', 'yellow');
    log('→ Check: cat QUICK_START.md', 'yellow');
  }

  section('QUICK REFERENCE');
  
  log('\nTest Commands:', 'cyan');
  log('  npm test                    # Run all tests', 'blue');
  log('  npm run test:unit           # Unit tests only', 'blue');
  log('  npm run test:integration    # Integration tests only', 'blue');
  log('  npm run test:e2e            # E2E tests only', 'blue');
  log('  npm run test:watch          # Watch mode', 'blue');
  log('  npm run test:coverage       # Coverage report', 'blue');

  log('\nServer Commands:', 'cyan');
  log('  npm start                   # Start development server', 'blue');

  log('\nDocumentation:', 'cyan');
  log('  QUICK_START.md              # 60-second setup guide', 'blue');
  log('  TESTING.md                  # Comprehensive documentation', 'blue');
  log('  SELF_HEALING_GUIDE.md       # Deep dive into framework', 'blue');

  log('\nLogging:', 'cyan');
  log('  ./healing-logs/healing-log.json       # Healing events', 'blue');
  log('  ./healing-logs/element-metadata.json  # Element data', 'blue');

  log('\n' + '='.repeat(70) + '\n');
  
  process.exit(allGood ? 0 : 1);
}

main().catch(err => {
  log(`❌ Error: ${err.message}`, 'red');
  process.exit(1);
});
