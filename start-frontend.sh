#!/bin/bash
# Bash script to start the frontend server

echo "Starting Hypersphere Frontend..."

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Starting frontend server on http://localhost:5173"
npm run dev

