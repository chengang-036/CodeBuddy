#!/usr/bin/env python3
"""一键启动 HTTP 服务器并在浏览器中打开 HTML 原型"""
import http.server
import webbrowser
import sys
import os

PORT = 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

handler = http.server.SimpleHTTPRequestHandler
# 强制声明 UTF-8 编码
handler.extensions_map['.html'] = 'text/html; charset=utf-8'

with http.server.HTTPServer(("", PORT), handler) as httpd:
    url = f"http://localhost:{PORT}/续期保费退费管理系统_交互原型V2.html"
    print(f"服务器已启动 → {url}")
    webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
