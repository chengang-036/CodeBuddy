#!/usr/bin/env python3
# 将Firebase代码转换为CloudBase代码

import re

files = ['wardrobe-cloudbase.html', 'match-cloudbase.html', 'outfits-cloudbase.html']

for filename in files:
    print(f'Converting {filename}...')
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 替换SDK引用
    content = re.sub(
        r'<script src="https://www\.gstatic\.com/firebasejs/.*?firebase-app-compat\.js"></script>',
        '<script src="https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js"></script>',
        content
    )
    
    # 2. 删除其他Firebase SDK引用
    content = re.sub(r'<script src="https://www\.gstatic\.com/firebasejs/.*?firebase-.*?\.js"></script>\n', '', content)
    
    # 3. 替换配置文件引用
    content = content.replace('firebase-config.js', 'cloudbase-config.js')
    
    # 4. 替换Firestore查询为CloudBase方式
    # db.collection('clothes').get() -> 保持不变（CloudBase语法相同）
    # firebase.firestore.FieldValue.serverTimestamp() -> new Date()
    content = content.replace('firebase.firestore.FieldValue.serverTimestamp()', 'new Date()')
    content = content.replace('firebase.firestore.Timestamp', 'Date')
    
    # 5. 替换文本中的Firebase -> CloudBase
    content = re.sub(r'\bFirebase\b', 'CloudBase', content)
    content = re.sub(r'\bfirebase\b', 'cloudbase', content)
    content = re.sub(r'\bFirestore\b', 'CloudBase', content)
    content = re.sub(r'\bfirestore\b', 'cloudbase', content)
    
    # 6. 特殊处理：CloudBase没有Timestamp类，使用普通Date
    content = content.replace('cloudbase.cloudbase.', 'cloudbase.')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✅ {filename} converted')

print('\n✅ All files converted!')
