#!/bin/bash
# kele 项目本地启动脚本
# 用法：把 start-game.sh 放到项目目录下，双击运行

DIR="$(cd "$(dirname "$0")" && pwd)"

# 找到 dist 目录或 index.html
if [ -d "$DIR/dist" ]; then
  SERVE_DIR="$DIR/dist"
elif [ -f "$DIR/index.html" ]; then
  SERVE_DIR="$DIR"
else
  echo "找不到 dist 目录或 index.html"
  exit 1
fi

echo "🎮 启动游戏服务器..."
echo "   目录: $SERVE_DIR"
echo "   地址: http://localhost:8080"
echo "   按 Ctrl+C 停止"
echo ""

cd "$SERVE_DIR" && python3 -m http.server 8080
