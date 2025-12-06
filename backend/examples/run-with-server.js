#!/usr/bin/env node

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { join } from 'path';
import fs from 'fs';

const SERVER_CMD = 'node';
const SERVER_ARGS = ['src/index.js'];
const SERVER_CWD = join(process.cwd());
const HEALTH_URL = 'http://localhost:3001/health';

function waitForHealth(timeout = 30000, interval = 500) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    // Tail server.log to show progress while waiting
    const logPath = join(SERVER_CWD, 'examples', 'server.log');
    let lastSize = 0;

    const tailInterval = setInterval(() => {
      try {
        if (fs.existsSync(logPath)) {
          const stat = fs.statSync(logPath);
          if (stat.size > lastSize) {
            const stream = fs.createReadStream(logPath, { start: lastSize, end: stat.size });
            stream.on('data', (chunk) => process.stdout.write(chunk.toString()));
            lastSize = stat.size;
          }
        }
      } catch (e) {
        // ignore log read errors
      }
    }, 1000);

    const tick = async () => {
      try {
        const res = await fetch(HEALTH_URL);
        if (res.ok) {
          clearInterval(tailInterval);
          return resolve(true);
        }
      } catch (e) {
        // ignore
      }

      if (Date.now() - start > timeout) {
        clearInterval(tailInterval);
        return reject(new Error('Health check timeout'));
      }
      setTimeout(tick, interval);
    };

    tick();
  });
}

async function main() {
  console.log('Starting backend server (detached, logs -> examples/server.log)...');

  // Ensure examples log directory exists
  const outLog = join(SERVER_CWD, 'examples', 'server.log');
  const out = fs.openSync(outLog, 'a');
  const err = fs.openSync(outLog, 'a');

  // Spawn detached so the parent process can continue without freezing
  const server = spawn(SERVER_CMD, SERVER_ARGS, {
    cwd: SERVER_CWD,
    detached: true,
    stdio: ['ignore', out, err],
  });

  // Allow the child to continue running independently
  server.unref();

  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  try {
    await waitForHealth(30000, 500);
    console.log('Backend healthy; running tests...');

    // Run master test runner in this process (will output to console)
    const tests = spawn('node', [join('examples', 'run-all-tests.js')], { cwd: SERVER_CWD, stdio: 'inherit' });

    tests.on('exit', (code) => {
      console.log(`Tests finished with exit code ${code}`);

      // Try to gracefully stop the detached server using its PID
      try {
        if (server && server.pid) {
          process.kill(server.pid);
        }
      } catch (e) {
        console.warn('Could not kill server process:', e.message);
      }

      // Close log file descriptors
      try { fs.closeSync(out); fs.closeSync(err); } catch (e) {}

      process.exit(code);
    });
  } catch (err) {
    console.error('Error waiting for server health:', err.message);
    try { if (server && server.pid) process.kill(server.pid); } catch(e) {}
    try { fs.closeSync(out); fs.closeSync(err); } catch (e) {}
    process.exit(1);
  }
}

main();
