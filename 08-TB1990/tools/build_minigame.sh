#!/bin/bash
# 同步网页版源码到微信小游戏工程（保持单一源码）
set -e
cd "$(dirname "$0")/.."
cp preview/js/*.js minigame/js/
echo "已同步 $(ls minigame/js | wc -l | tr -d ' ') 个模块到 minigame/js/"
echo "用微信开发者工具导入 minigame/ 目录即可预览（appid 需替换为自己的）"
