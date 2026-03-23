#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${GREEN}Starting development servers...${NC}\n"

# 清理函数
cleanup() {
    echo -e "\n${GREEN}Stopping servers...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

# 捕获 Ctrl+C 信号
trap cleanup SIGINT SIGTERM

# 启动后端
echo -e "${BLUE}[Backend]${NC} Starting FastAPI server on http://localhost:8000"
cd "$SCRIPT_DIR/backend" && uv run fastapi dev app/main.py &
BACKEND_PID=$!

# 启动前端
echo -e "${BLUE}[Frontend]${NC} Starting Vite server on http://localhost:3000"
cd "$SCRIPT_DIR/frontend" && pnpm dev &
FRONTEND_PID=$!

# 等待所有后台进程
wait
