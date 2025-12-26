@echo off
chcp 65001 >nul
title Clothes - 衣橱管理系统

echo.
echo ================================================
echo       Clothes - 衣橱管理系统 (Windows版)
echo ================================================
echo.
echo 正在启动浏览器...
echo.

REM 尝试使用不同的浏览器打开
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo 使用 Google Chrome 浏览器
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%~dp0index.html"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo 使用 Google Chrome 浏览器
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "%~dp0index.html"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    echo 使用 Microsoft Edge 浏览器
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" "%~dp0index.html"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo 使用 Microsoft Edge 浏览器
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%~dp0index.html"
) else (
    echo 使用系统默认浏览器
    start "" "%~dp0index.html"
)

echo.
echo 已启动！
echo.
echo 提示：
echo - 所有数据存储在浏览器本地
echo - 关闭浏览器窗口即可退出
echo - 下次直接双击此文件即可打开
echo.
echo ================================================
echo.

timeout /t 3 >nul
exit
