#!/bin/bash
# 续期保费退费管理系统 - 本地预览服务器
# 启动后访问: http://localhost:8899/

cd "$(dirname "$0")"

PORT=8899

# 检查端口是否已被占用
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[OK] 服务已在运行: http://localhost:$PORT/"
    echo "     打开地址: http://localhost:$PORT/续期保费退费管理系统_交互原型V2.html"
    exit 0
fi

echo "正在启动 HTTP 服务..."
echo ""
echo "  📋 预览地址: http://localhost:$PORT/续期保费退费管理系统_交互原型V2.html"
echo "  🛑 停止服务: Ctrl+C"
echo ""

python3 -m http.server $PORT
