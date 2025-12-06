#!/bin/bash
# Bash script to start the backend server

echo "Starting Hypersphere Backend..."

cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

echo "Starting backend server on http://localhost:3001"
npm run dev

