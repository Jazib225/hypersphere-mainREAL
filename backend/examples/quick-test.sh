#!/bin/bash

# Quick Start Test Guide
# This script sets up and runs all tests

echo "════════════════════════════════════════════════════════"
echo "  Solana Tap-to-Pay Test Suite - Quick Start"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if backend directory exists
if [ ! -d "backend" ]; then
  echo "❌ Error: backend directory not found"
  echo "Please run this script from the project root"
  exit 1
fi

echo "✅ Found backend directory"
echo ""

# Check if backend is running
echo "🔍 Checking if backend is running on localhost:3001..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "✅ Backend is running"
else
  echo "⚠️  Backend is not running"
  echo ""
  echo "Starting backend..."
  cd backend
  npm install > /dev/null 2>&1
  npm start > /tmp/backend.log 2>&1 &
  BACKEND_PID=$!
  echo "   Backend started (PID: $BACKEND_PID)"
  echo "   Waiting 3 seconds for startup..."
  sleep 3
  
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend started successfully"
  else
    echo "❌ Failed to start backend"
    echo "   Check logs: cat /tmp/backend.log"
    exit 1
  fi
  cd ..
fi

echo ""
echo "📦 Installing test dependencies..."
cd backend
npm install node-fetch > /dev/null 2>&1
echo "✅ Dependencies installed"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  Running Test Suite"
echo "════════════════════════════════════════════════════════"
echo ""

# Run all tests
node examples/run-all-tests.js

# Capture exit code
TEST_EXIT=$?

echo ""
echo "════════════════════════════════════════════════════════"

if [ $TEST_EXIT -eq 0 ]; then
  echo "  ✅ All tests passed!"
else
  echo "  ❌ Some tests failed"
fi

echo "════════════════════════════════════════════════════════"
echo ""

# Kill backend if we started it
if [ ! -z "$BACKEND_PID" ]; then
  echo "Cleaning up..."
  kill $BACKEND_PID 2>/dev/null || true
  echo "✅ Backend stopped"
fi

exit $TEST_EXIT
