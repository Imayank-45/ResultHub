#!/usr/bin/env bash

# ResultAI - 1-Click Linux Launcher (Backend + Frontend)

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
VENV_PYTHON="$ROOT_DIR/venv/bin/python3"
SERVER_SCRIPT="$ROOT_DIR/backend/server.py"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo -e "\033[1;36m============================================\033[0m"
echo -e "\033[1;36m   ResultAI - Starting Frontend and Backend\033[0m"
echo -e "\033[1;36m============================================\033[0m"
echo ""

if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "\033[1;31m[Error] Virtual environment not found at $ROOT_DIR/venv\033[0m"
    echo "Please set up the virtual environment first."
    exit 1
fi

cleanup() {
    echo ""
    echo -e "\033[1;33mStopping ResultAI Backend and Frontend...\033[0m"
    kill 0
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo -e "\033[1;33m[1/2] Starting Backend (FastAPI on http://127.0.0.1:8000)...\033[0m"
"$VENV_PYTHON" "$SERVER_SCRIPT" &
BACKEND_PID=$!

sleep 2

echo -e "\033[1;33m[2/2] Starting Frontend (Vite on http://localhost:5173)...\033[0m"
cd "$FRONTEND_DIR" && npm run dev &
FRONTEND_PID=$!

sleep 2

echo ""
echo -e "\033[1;32mBoth servers launched successfully!\033[0m"
echo -e "\033[1;32m  👉 Dashboard App : http://localhost:5173\033[0m"
echo -e "\033[1;36m  Backend API   : http://127.0.0.1:8000\033[0m"
echo -e "\033[1;36m  API Docs      : http://127.0.0.1:8000/docs\033[0m"
echo ""
echo -e "\033[1;30mPress Ctrl+C to stop both servers.\033[0m"

if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:5173" > /dev/null 2>&1 &
fi

wait
