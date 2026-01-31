#!/bin/bash

# 创建 DMG 安装包脚本
# 使用方法：./创建安装包.sh

APP_NAME="StudyMathMac"
APP_PATH="./build/${APP_NAME}.app"
DMG_NAME="${APP_NAME}_v1.0"
VOLUME_NAME="${APP_NAME} Installer"
DMG_TEMP="temp_dmg"
DMG_FINAL="${DMG_NAME}.dmg"

echo "🚀 开始创建 DMG 安装包..."

# 检查应用是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 错误：找不到应用文件 $APP_PATH"
    echo "请先导出应用到 ./build/ 目录"
    exit 1
fi

# 创建临时 DMG 目录
echo "📁 创建临时目录..."
mkdir -p "$DMG_TEMP"
cp -R "$APP_PATH" "$DMG_TEMP/"

# 创建应用程序文件夹的符号链接
echo "🔗 创建应用程序链接..."
ln -s /Applications "$DMG_TEMP/Applications"

# 创建 DMG
echo "📦 创建 DMG 文件..."
hdiutil create -volname "$VOLUME_NAME" \
    -srcfolder "$DMG_TEMP" \
    -ov -format UDZO \
    "$DMG_FINAL"

# 清理临时文件
echo "🧹 清理临时文件..."
rm -rf "$DMG_TEMP"

echo "✅ 完成！"
echo "📍 DMG 文件位置: $DMG_FINAL"
echo ""
echo "📤 现在可以分发这个 DMG 文件了！"
