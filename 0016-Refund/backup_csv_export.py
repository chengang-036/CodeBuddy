#!/usr/bin/env python3
"""
备份 csv_export 目录脚本

功能：
1. 将当前的 csv_export 目录重命名为 csv_export_YYYYMMDD_HHMMSS
2. 创建新的 csv_export 目录
3. 从 default_data 目录复制文件到新的 csv_export 目录

使用方法：
方式一（推荐）：从浏览器导出当前数据
  1. 在浏览器中打开系统，进入Admin页面
  2. 点击"💾 备份数据到csv_export"按钮，下载所有CSV文件
  3. 将下载的CSV文件放到本脚本同目录下
  4. 运行本脚本：python backup_csv_export.py

方式二：从 default_data 生成默认数据
  1. 直接运行本脚本：python backup_csv_export.py --from-default
  2. 脚本会从 default_data 目录读取数据并生成CSV文件

选项：
  --from-default    从 default_data 目录生成CSV文件（不备份现有数据）
  --no-backup       不备份现有 csv_export 目录（直接覆盖）
"""

import os
import shutil
import csv
import json
import glob
from datetime import datetime
import argparse

# 文件名映射：default_data 中的文件名 -> csv_export 中的文件名
FILE_MAPPING = {
    '01_保单信息.csv': '01_保单信息.csv',
    '02_缴费记录.csv': '02_缴费记录管理.csv',
    '03_自然人信息_反洗钱9字段.csv': '03_自然人信息管理.csv',
    '04_场景管理.csv': '04_场景管理.csv',
    '05_退费受理记录.json': '05_退费受理记录.json',
    '06_角色管理.csv': '06_角色管理.csv',
    '07_权限管理.csv': '07_权限管理.csv',
    '08_角色对应权限管理.csv': '08_角色对应权限管理.csv',
    '09_用户管理.csv': '09_用户管理.csv',
    '10_用户角色管理.csv': '10_用户角色管理.csv',
    '11_短信发送记录.csv': '11_短信发送记录.csv',
    '12_微信发送记录.csv': '12_微信发送记录.csv',
    '13_审批链记录.csv': '13_审批链记录.csv',
    '14_分公司管理.csv': '14_分公司管理.csv',
    '15_所属机构管理.csv': '15_所属机构管理.csv',
}

def backup_csv_export(from_default=False, no_backup=False):
    """备份 csv_export 目录"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_export_dir = os.path.join(current_dir, 'csv_export')
    default_data_dir = os.path.join(current_dir, 'default_data')
    
    # 检查 csv_export 目录是否存在
    if os.path.exists(csv_export_dir) and not no_backup:
        # 生成时间戳
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_dir = os.path.join(current_dir, f'csv_export_{timestamp}')
        
        # 重命名目录
        print(f'正在备份：{csv_export_dir} -> {backup_dir}')
        shutil.move(csv_export_dir, backup_dir)
        print(f'✓ 备份完成：{backup_dir}')
    elif no_backup:
        # 直接删除现有目录
        if os.path.exists(csv_export_dir):
            shutil.rmtree(csv_export_dir)
            print(f'✓ 已删除现有目录：{csv_export_dir}')
    
    # 创建新的 csv_export 目录
    os.makedirs(csv_export_dir, exist_ok=True)
    print(f'✓ 创建新目录：{csv_export_dir}')
    
    if from_default:
        # 从 default_data 复制文件
        if not os.path.exists(default_data_dir):
            print(f'✗ 错误：default_data 目录不存在')
            return
        
        print(f'\n从 {default_data_dir} 生成CSV文件...')
        for src_name, dst_name in FILE_MAPPING.items():
            src_file = os.path.join(default_data_dir, src_name)
            dst_file = os.path.join(csv_export_dir, dst_name)
            
            if os.path.exists(src_file):
                shutil.copy2(src_file, dst_file)
                print(f'  ✓ {dst_name} (从 {src_name})')
            else:
                print(f'  ✗ {dst_name} (源文件不存在: {src_name})')
        
        print(f'\n✓ 文件已生成到 {csv_export_dir}')
    else:
        # 查找当前目录下的CSV文件（从浏览器导出的）
        csv_files = glob.glob(os.path.join(current_dir, '*.csv'))
        
        if csv_files:
            print(f'\n发现 {len(csv_files)} 个CSV文件，正在复制到 csv_export 目录...')
            for csv_file in csv_files:
                filename = os.path.basename(csv_file)
                dst_path = os.path.join(csv_export_dir, filename)
                shutil.copy2(csv_file, dst_path)
                print(f'  ✓ {filename}')
            print(f'\n✓ 所有文件已复制到 {csv_export_dir}')
        else:
            print(f'\n提示：未找到CSV文件')
            print(f'请先将浏览器导出的CSV文件放到此目录下，或使用权方式二：')
            print(f'  python {os.path.basename(__file__)} --from-default')
    
    print(f'\n{"="*60}')
    print(f'操作完成！')
    print(f'  新目录：{csv_export_dir}')
    print(f'{"="*60}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='备份 csv_export 目录并导出数据')
    parser.add_argument('--from-default', action='store_true', help='从 default_data 目录生成CSV文件')
    parser.add_argument('--no-backup', action='store_true', help='不备份现有 csv_export 目录（直接覆盖）')
    args = parser.parse_args()
    
    backup_csv_export(from_default=args.from_default, no_backup=args.no_backup)
