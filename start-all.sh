#!/bin/bash
# Bash script to start both backend and frontend

echo "Starting Hypersphere Backend and Frontend..."

# Start backend in background
./start-backend.sh &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend in background
./start-frontend.sh &
FRONTEND_PID=$!

echo "Backend and Frontend are starting..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait

