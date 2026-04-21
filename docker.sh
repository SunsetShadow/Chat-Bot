#!/bin/bash

# 根据 hostname 自动选择 Docker 环境配置
# 用法: ./docker.sh [up|down|ps]

ACTION=${1:-up}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOSTNAME=$(hostname)

# 按 hostname 或文件存在判断环境
if [[ "$HOSTNAME" == *nas* ]] || [[ "$HOSTNAME" == *NAS* ]]; then
    ENV_FILE=".env.nas"
    echo "检测到 NAS 设备，使用 $ENV_FILE"
elif [ -f "$SCRIPT_DIR/.env.mac" ]; then
    ENV_FILE=".env.mac"
    echo "使用 $ENV_FILE"
else
    echo "未找到环境配置文件，使用默认值"
    ENV_FILE=""
fi

cd "$SCRIPT_DIR"

case "$ACTION" in
    up)
        if [ -n "$ENV_FILE" ]; then
            docker compose --env-file "$ENV_FILE" up -d
        else
            docker compose up -d
        fi
        ;;
    down)
        docker compose down
        ;;
    ps)
        docker compose ps
        ;;
    *)
        echo "用法: $0 [up|down|ps]"
        exit 1
        ;;
esac
