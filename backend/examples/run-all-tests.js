#!/usr/bin/env node

/**
 * Test Suite Runner
 * Orchestrates all test scripts
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  { name: 'Integration Tests', file: 'test-integration.js', priority: 1 },
  { name: 'Error Scenario Tests', file: 'test-errors.js', priority: 2 },
  { name: 'Performance Tests', file: 'test-performance.js', priority: 3 },
];

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runTest(test) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Running: ${test.name}`);
    console.log(`📄 File: ${test.file}`);
    console.log('='.repeat(70));

    return new Promise((resolve) => {
      const testPath = join(__dirname, test.file);
      const child = spawn('node', [testPath], {
        stdio: 'inherit',
        cwd: __dirname,
      });

      child.on('exit', (code) => {
        const testResult = {
          name: test.name,
          file: test.file,
          passed: code === 0,
          exitCode: code,
        };

        this.results.push(testResult);
        resolve(testResult);
      });

      child.on('error', (error) => {
        console.error(`\n❌ Error running ${test.name}:`, error.message);

        const testResult = {
          name: test.name,
          file: test.file,
          passed: false,
          error: error.message,
        };

        this.results.push(testResult);
        resolve(testResult);
      });
    });
  }

  async runAll() {
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║          Solana Tap-to-Pay Test Suite Runner                       ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');

    console.log('\nℹ️  Make sure the backend is running on localhost:3001');
    console.log('   Run: cd backend && npm start');

    // Sort by priority
    const sortedTests = tests.sort((a, b) => a.priority - b.priority);

    for (const test of sortedTests) {
      try {
        await this.runTest(test);
      } catch (error) {
        console.error(`\nFailed to run ${test.name}:`, error);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printSummary();
  }

  printSummary() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                      Test Suite Summary                            ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');

    console.log('\nTest Results:');
    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${result.name}`);
      if (result.error) {
        console.log(`       Error: ${result.error}`);
      }
    }

    console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Duration: ${totalTime.toFixed(2)}s`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${failed} test suite(s) failed`);
    }

    console.log('\n' + '='.repeat(70) + '\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

const runner = new TestRunner();
await runner.runAll();
