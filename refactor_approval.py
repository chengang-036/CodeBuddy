#!/usr/bin/env python3
"""
Refactoring script: Simplify approval chain data model from complex nested structure
to a flat 3-layer model (approvalConfigsHQ / approvalConfigsBranch / approvalConfigsInst).
"""

import re
import sys

FILE_PATH = '/Users/tiger/WorkBuddy/2026-05-07-task-2/0016-Refund/续期保费退费管理系统_交互原型V2.html'

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
print(f"Total lines: {len(lines)}")

# ============================================================
# REPLACEMENT 1: Replace buildDefaultConfig() and APPROVAL_FLOW_CONFIG default data
# ============================================================
print("\n=== Replacement 1: buildDefaultConfig() and APPROVAL_FLOW_CONFIG ===")

# Find the start of buildDefaultConfig (line 2027) and end at line 2123 (return cfg; })
# Also replace the APPROVAL_FLOW_CONFIG = {} on line 2124

new_default_config = r'''        function buildDefaultConfig() {
            return {
                "version": "1.0.0",
                "approvalConfigsHQ": [
                    {
                        "channel": ["\u4e2a\u9669","\u94f6\u4fdd","\u56e2\u9669"],
                        "subChannels": ["PAA", "PSA", "-"],
                        "amountConfig": "all",
                        "nodes": [
                            {"order": 1, "name": "\u603b\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["wenghengtao"]},
                            {"order": 2, "name": "\u603b\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["huanglinyun"]},
                            {"order": 3, "name": "\u603b\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["fanli"]},
                            {"order": 4, "name": "\u603b\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["huletian"]}
                        ]
                    },
                    {
                        "channel": ["\u5728\u7ebf"],
                        "subChannels": ["-"],
                        "amountConfig": "range",
                        "ranges": [
                            {
                                "label": "5\u4e07\u5143\u4ee5\u4e0b",
                                "max": 50000,
                                "nodes": [
                                    {"order": 1, "name": "\u603b\u516c\u53f8\u5c42\uff08\u5355\u4eba\u5ba1\u6279\uff09", "approvers": ["lizhuoyou"]},
                                    {"order": 1, "name": "\u603b\u516c\u53f8\u5c42\uff08\u5355\u4eba\u5ba1\u6279\uff09", "approvers": ["guowei"]}
                                ]
                            },
                            {
                                "label": "5\u4e07\u5143\u53ca\u4ee5\u4e0a",
                                "min": 50000,
                                "nodes": [
                                    {"order": 1, "name": "\u603b\u516c\u53f8\u5c42\uff08\u53cc\u4eba\u5ba1\u6279\uff09", "approvers": ["lizhuoyou"]},
                                    {"order": 1, "name": "\u603b\u516c\u53f8\u5c42\uff08\u53cc\u4eba\u5ba1\u6279\uff09", "approvers": ["guowei"]},
                                    {"order": 2, "name": "\u603b\u516c\u53f8\u5c42\uff08\u53cc\u4eba\u5ba1\u6279\uff09", "approvers": ["dinghongzhi"]}
                                ]
                            }
                        ]
                    }
                ],
                "approvalConfigsBranch": [
                    {
                        "channel": ["\u4e2a\u9669","\u94f6\u4fdd","\u56e2\u9669"],
                        "subChannels": ["PAA", "PSA", "-"],
                        "branches": ["\u4e0a\u6d77\u5206\u516c\u53f8"],
                        "nodes": [
                            {"order": 1, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5185\u52e4", "approvers": ["luojiahui"]},
                            {"order": 2, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["chenyufan"]},
                            {"order": 3, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["huyiyang"]},
                            {"order": 4, "name": "\u5206\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["zhangjie"]},
                            {"order": 5, "name": "\u5206\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["caoshen"]},
                            {"order": 6, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5206\u7ba1\u603b", "approvers": ["chenzhibin"]}
                        ]
                    }
                ],
                "approvalConfigsInst": [
                    {
                        "channel": ["\u4e2a\u9669"],
                        "subChannels": ["PAA"],
                        "amountRange": {"label": "5000\u5143\u4ee5\u4e0b", "max": 5000},
                        "branch": "\u4e0a\u6d77\u5206\u516c\u53f8",
                        "org": "\u4e0a\u6d77\u4e2d\u652f\u4e00\u533a",
                        "nodes": [
                            {"order": 1, "name": "\u4e2d\u652f\u4e1a\u52a1\u90e8\u95e8\u5185\u52e4", "approvers": ["user001"]},
                            {"order": 2, "name": "\u4e2d\u652f\u4e1a\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["user002"]},
                            {"order": 3, "name": "\u4e2d\u652f\u4e1a\u52a1\u90e8\u95e8\u5206\u7ba1\u603b", "approvers": ["user003"]},
                            {"order": 4, "name": "\u4e2d\u652f\u8d22\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["user004"]},
                            {"order": 5, "name": "\u4e2d\u652f\u8d22\u52a1\u90e8\u95e8\u5206\u7ba1\u603b", "approvers": ["user005"]},
                            {"order": 6, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5185\u52e4", "approvers": ["luojiahui"]},
                            {"order": 7, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["chenyufan"]},
                            {"order": 8, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["huyiyang"]},
                            {"order": 9, "name": "\u5206\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["zhangjie"]},
                            {"order": 10, "name": "\u5206\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["caoshen"]},
                            {"order": 11, "name": "\u5206\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5206\u7ba1\u603b", "approvers": ["chenzhibin"]},
                            {"order": 12, "name": "\u603b\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["wenghengtao"]},
                            {"order": 13, "name": "\u603b\u516c\u53f8\u4e1a\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["huanglinyun"]},
                            {"order": 14, "name": "\u603b\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u5ba4\u7ecf\u7406", "approvers": ["fanli"]},
                            {"order": 15, "name": "\u603b\u516c\u53f8\u8d22\u52a1\u90e8\u95e8\u8d1f\u8d23\u4eba", "approvers": ["huletian"]}
                        ]
                    }
                ]
            };
        }
        let APPROVAL_FLOW_CONFIG = buildDefaultConfig();'''

# Find the exact range: from buildDefaultConfig() function start to APPROVAL_FLOW_CONFIG = {};
# Line 2027 is "function buildDefaultConfig() {" and line 2124 is "let APPROVAL_FLOW_CONFIG = {};"
# We need to replace from line 2027 (index 2026) through line 2124 (index 2123)

old_start_line = None
old_end_line = None
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('function buildDefaultConfig()'):
        old_start_line = i
    if stripped == 'let APPROVAL_FLOW_CONFIG = {};':
        old_end_line = i
        break

if old_start_line is None or old_end_line is None:
    print("ERROR: Could not find buildDefaultConfig or APPROVAL_FLOW_CONFIG declaration")
    sys.exit(1)

print(f"Found buildDefaultConfig at line {old_start_line+1}, APPROVAL_FLOW_CONFIG at line {old_end_line+1}")

# Replace lines from old_start_line to old_end_line (inclusive)
lines[old_start_line:old_end_line+1] = new_default_config.split('\n')
print(f"Replaced lines {old_start_line+1}-{old_end_line+1} with new default config")

# ============================================================
# REPLACEMENT 2: Rewrite adminShowApprovalChainJSON() and helpers
# ============================================================
print("\n=== Replacement 2: adminShowApprovalChainJSON() ===")

new_json_view = r'''        // ==================== 审批链 JSON 视图 ====================
        var _adminApprovalChainJsonVisible = false;
        function adminShowApprovalChainJSON() {
            _adminApprovalChainJsonVisible = !_adminApprovalChainJsonVisible;
            var btn = document.getElementById('adminApprovalChainJsonBtn');
            var panel = document.getElementById('adminApprovalChainJsonPanel');
            var tableWrapper = document.querySelector('#adminApprovalChainTab .table-wrapper');

            if (_adminApprovalChainJsonVisible) {
                btn.textContent = '\ud83d\udccb \u8868\u683c\u89c6\u56fe';
                btn.style.color = '#e65100';
                btn.style.borderColor = '#e65100';
                tableWrapper.style.display = 'none';
                panel.style.display = 'block';

                var raw = localStorage.getItem('approvalFlowConfig');
                var config = raw ? JSON.parse(raw) : APPROVAL_FLOW_CONFIG;
                var html = '<div style="font-family:Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.7;color:#d4d4d4;">';
                html += '<div style="color:#569cd6;margin-bottom:8px;">\ud83d\udce6 \u672c\u5730\u6570\u636e\u6765\u6e90: <span style="color:#ce9178;">localStorage (approvalFlowConfig)</span></div>';

                var hqCount = (config.approvalConfigsHQ || []).length;
                var branchCount = (config.approvalConfigsBranch || []).length;
                var instCount = (config.approvalConfigsInst || []).length;
                html += '<div style="color:#569cd6;margin-bottom:16px;">\u603b\u516c\u53f8\u6a21\u677f: <span style="color:#b5cea8;">' + hqCount + '</span> \u6761 | \u5206\u516c\u53f8\u6a21\u677f: <span style="color:#b5cea8;">' + branchCount + '</span> \u6761 | \u673a\u6784\u5ba1\u6279\u6d41: <span style="color:#b5cea8;">' + instCount + '</span> \u6761</div>';

                // Section: 总公司审批链模板
                html += _renderConfigSection(config.approvalConfigsHQ, '\ud83d\udccb \u603b\u516c\u53f8\u5ba1\u6279\u94fe\u6a21\u677f', 'hq');
                // Section: 分公司审批链模板
                html += _renderConfigSection(config.approvalConfigsBranch, '\ud83d\udccb \u5206\u516c\u53f8\u5ba1\u6279\u94fe\u6a21\u677f', 'branch');
                // Section: 所属机构审批流
                html += _renderConfigSection(config.approvalConfigsInst, '\ud83d\udccb \u6240\u5c5e\u673a\u6784\u5ba1\u6279\u6d41', 'inst');

                html += '</div>';
                panel.innerHTML = html;
            } else {
                btn.textContent = '\ud83d\udcc4 JSON\u89c6\u56fe';
                btn.style.color = '#1a73e8';
                btn.style.borderColor = '#1a73e8';
                tableWrapper.style.display = 'block';
                panel.style.display = 'none';
            }
        }

        function _renderConfigSection(arr, title, type) {
            if (!arr || arr.length === 0) {
                return '<div style="margin-bottom:12px;padding:8px 12px;background:#2d2d2d;border-radius:6px;border-left:3px solid #808080;">' +
                    '<div style="color:#808080;">' + title + ' \u2014 \u6682\u65e0\u6570\u636e</div></div>';
            }
            var html = '';
            arr.forEach(function(item, idx) {
                var chLabel = (item.channel || []).join('/') + (item.subChannels && item.subChannels[0] !== '-' ? '(' + item.subChannels.filter(function(s){return s!=='-';}).join(',') + ')' : '');
                html += '<div style="margin-bottom:8px;padding:8px 12px;background:#2d2d2d;border-radius:6px;border-left:3px solid #4ec9b0;">';
                html += '<div style="color:#4ec9b0;cursor:pointer;" onclick="var p=this.nextElementSibling;p.style.display=p.style.display===\'none\'?\'block\':\'none\';">\u25bc [' + idx + '] ' + chLabel;
                if (type === 'branch' && item.branches) html += ' \u2014 ' + item.branches.join(',');
                if (type === 'inst' && item.branch) html += ' \u2014 ' + item.branch + '/' + (item.org || '');
                html += '</div>';
                html += '<pre style="margin:0;padding:8px;background:#1e1e1e;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;font-size:11px;display:block;">';
                html += _formatConfigItem(item, type);
                html += '</pre></div>';
            });
            return html;
        }

        function _formatConfigItem(item, type) {
            var lines = [];
            lines.push('<span style="color:#9cdcfe;">channel</span>: <span style="color:#ce9178;">' + (item.channel || []).join(', ') + '</span>');
            if (item.subChannels) lines.push('<span style="color:#9cdcfe;">subChannels</span>: <span style="color:#ce9178;">' + item.subChannels.join(', ') + '</span>');
            if (item.amountConfig) lines.push('<span style="color:#9cdcfe;">amountConfig</span>: <span style="color:#ce9178;">' + item.amountConfig + '</span>');
            if (type === 'branch' && item.branches) lines.push('<span style="color:#9cdcfe;">branches</span>: <span style="color:#ce9178;">' + item.branches.join(', ') + '</span>');
            if (type === 'inst') {
                if (item.amountRange) lines.push('<span style="color:#9cdcfe;">amountRange</span>: <span style="color:#ce9178;">' + (item.amountRange.label || '') + '</span>');
                if (item.branch) lines.push('<span style="color:#9cdcfe;">branch</span>: <span style="color:#ce9178;">' + item.branch + '</span>');
                if (item.org) lines.push('<span style="color:#9cdcfe;">org</span>: <span style="color:#ce9178;">' + item.org + '</span>');
            }
            if (item.amountConfig === 'range' && item.ranges) {
                item.ranges.forEach(function(r, ri) {
                    lines.push('');
                    lines.push('  <span style="color:#569cd6;">\u2502 Range [' + ri + ']: ' + (r.label || '') + '</span>');
                    (r.nodes || []).forEach(function(n) {
                        lines.push('    <span style="color:#b5cea8;">#' + n.order + '</span> <span style="color:#dcdcaa;">' + n.name + '</span> \u2192 <span style="color:#ce9178;">' + (n.approvers || []).join(', ') + '</span>');
                    });
                });
            }
            if (item.nodes) {
                lines.push('');
                lines.push('  <span style="color:#569cd6;">\u2502 Nodes:</span>');
                item.nodes.forEach(function(n) {
                    lines.push('    <span style="color:#b5cea8;">#' + n.order + '</span> <span style="color:#dcdcaa;">' + n.name + '</span> \u2192 <span style="color:#ce9178;">' + (n.approvers || []).join(', ') + '</span>');
                });
            }
            return lines.join('\n');
        }'''

# Find the range: from "// ==================== 审批链 JSON 视图 ====================" to just before "function adminClearRefunds()"
json_view_start = None
json_view_end = None
for i, line in enumerate(lines):
    if '// ==================== 审批链 JSON 视图 ====================' in line:
        json_view_start = i
    if 'function adminClearRefunds()' in line and json_view_start is not None and json_view_end is None:
        json_view_end = i
        break

if json_view_start is None or json_view_end is None:
    print("ERROR: Could not find JSON view section boundaries")
    sys.exit(1)

print(f"Found JSON view section at lines {json_view_start+1}-{json_view_end+1}")

# Replace from json_view_start to json_view_end (exclusive - don't replace adminClearRefunds)
lines[json_view_start:json_view_end] = new_json_view.split('\n')
print(f"Replaced JSON view section")

# ============================================================
# REPLACEMENT 3: Rewrite refreshAdminApprovalChain() table view
# ============================================================
print("\n=== Replacement 3: refreshAdminApprovalChain() ===")

new_refresh_approval = r'''        function refreshAdminApprovalChain() {
            var tbody = document.getElementById('adminApprovalChainBody');
            var cfg = APPROVAL_FLOW_CONFIG;
            var rows = [];

            // Summary counts
            var hqCount = (cfg.approvalConfigsHQ || []).length;
            var branchCount = (cfg.approvalConfigsBranch || []).length;
            var instCount = (cfg.approvalConfigsInst || []).length;
            var summaryEl = document.getElementById('adminApprovalChainSummary');
            if (summaryEl) {
                summaryEl.textContent = '\u603b\u516c\u53f8\u6a21\u677f: ' + hqCount + '\u6761 | \u5206\u516c\u53f8\u6a21\u677f: ' + branchCount + '\u6761 | \u673a\u6784\u5ba1\u6279\u6d41: ' + instCount + '\u6761';
            }

            // Flatten approvalConfigsInst into rows
            var insts = cfg.approvalConfigsInst || [];
            insts.forEach(function(inst) {
                var channels = (inst.channel || []).join(',');
                var subChs = (inst.subChannels || []).join(',');
                var branchName = inst.branch || '-';
                var orgName = inst.org || '-';
                var amountLabel = (inst.amountRange && inst.amountRange.label) || '-';

                (inst.nodes || []).forEach(function(node) {
                    (node.approvers || []).forEach(function(approver) {
                        rows.push({
                            nodeNumber: node.order,
                            channel: channels,
                            subChannel: subChs,
                            branch: branchName,
                            org: orgName,
                            amountRange: amountLabel,
                            nodeName: node.name,
                            userName: approver,
                            userDisplayName: approver
                        });
                    });
                    if (!node.approvers || node.approvers.length === 0) {
                        rows.push({
                            nodeNumber: node.order,
                            channel: channels,
                            subChannel: subChs,
                            branch: branchName,
                            org: orgName,
                            amountRange: amountLabel,
                            nodeName: node.name,
                            userName: '-',
                            userDisplayName: '-'
                        });
                    }
                });
            });

            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray-500);padding:40px;">\u6682\u65e0\u5ba1\u6279\u94fe\u8bb0\u5f55\uff0c\u8bf7\u5148\u5728\u201c\u5ba1\u6279\u6d41\u7ba1\u7406\u201d\u4e2d\u914d\u7f6e\u5ba1\u6279\u8282\u70b9</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(function(r, i) {
                return '<tr style="background:' + (i % 2 === 0 ? 'white' : 'var(--gray-100)') + '">' +
                    '<td style="text-align:center;font-weight:600;">' + r.nodeNumber + '</td>' +
                    '<td>' + r.channel + '</td>' +
                    '<td>' + r.subChannel + '</td>' +
                    '<td>' + r.branch + '</td>' +
                    '<td>' + r.org + '</td>' +
                    '<td>' + r.amountRange + '</td>' +
                    '<td style="font-weight:600;">' + r.nodeName + '</td>' +
                    '<td>' + r.userName + '</td>' +
                    '<td>' + r.userDisplayName + '</td>' +
                    '</tr>';
            }).join('');
        }'''

# Find refreshAdminApprovalChain function
refresh_start = None
refresh_end = None
for i, line in enumerate(lines):
    if 'function refreshAdminApprovalChain()' in line:
        refresh_start = i
    # The function ends before the next function declaration at the same indent level
    if refresh_start is not None and i > refresh_start:
        stripped = line.strip()
        if stripped.startswith('async function ') or (stripped.startswith('function ') and not stripped.startswith('function refreshAdminApprovalChain')):
            refresh_end = i
            break

if refresh_start is None or refresh_end is None:
    print("ERROR: Could not find refreshAdminApprovalChain function")
    sys.exit(1)

print(f"Found refreshAdminApprovalChain at lines {refresh_start+1}-{refresh_end+1}")

lines[refresh_start:refresh_end] = new_refresh_approval.split('\n')
print(f"Replaced refreshAdminApprovalChain")

# ============================================================
# REPLACEMENT 4: Simplify CSV export for approval chain
# ============================================================
print("\n=== Replacement 4: CSV export ===")

new_csv_export_block = r'''            if (cfg.isApprovalChain) {
                // 审批链记录：按3层模型展平
                var config = APPROVAL_FLOW_CONFIG || {};
                var insts = config.approvalConfigsInst || [];
                insts.forEach(function(inst) {
                    var channels = (inst.channel || []).join(',');
                    var subChs = (inst.subChannels || []).join(',');
                    var branchName = inst.branch || '-';
                    var orgName = inst.org || '-';
                    var amountLabel = (inst.amountRange && inst.amountRange.label) || '-';
                    (inst.nodes || []).forEach(function(node) {
                        (node.approvers || []).forEach(function(approver) {
                            rows.push([node.order, channels, subChs, branchName, orgName, amountLabel, node.name || '', approver, approver]);
                        });
                        if (!node.approvers || node.approvers.length === 0) {
                            rows.push([node.order, channels, subChs, branchName, orgName, amountLabel, node.name || '', '-', '-']);
                        }
                    });
                });
                data = rows;'''

# Find the isApprovalChain block in adminExportCSV
csv_export_start = None
csv_export_end = None
for i, line in enumerate(lines):
    if 'if (cfg.isApprovalChain) {' in line:
        if csv_export_start is None:
            csv_export_start = i
        elif csv_export_start is not None and csv_export_end is None:
            # This is the second occurrence (inside the CSV building section)
            break
    if csv_export_start is not None and csv_export_end is None:
        # The first block ends with "data = rows;"
        if 'data = rows;' in line and i > csv_export_start:
            csv_export_end = i
            break

if csv_export_start is None or csv_export_end is None:
    print("ERROR: Could not find CSV export approval chain block")
    sys.exit(1)

print(f"Found CSV export block at lines {csv_export_start+1}-{csv_export_end+1}")

lines[csv_export_start:csv_export_end+1] = new_csv_export_block.split('\n')
print(f"Replaced CSV export block")

# ============================================================
# REPLACEMENT 5: Simplify CSV import for approval chain
# ============================================================
print("\n=== Replacement 5: CSV import ===")

new_csv_import_block = r'''                    if (cfg.isApprovalChain) {
                        showToast('CSV\u5bfc\u5165\u529f\u80fd\u7ef4\u62a4\u4e2d\uff0c\u8bf7\u76f4\u63a5\u5728JSON\u89c6\u56fe\u4e2d\u7f16\u8f91\u6570\u636e', 'warning');
                        fileInput.value = '';
                        return;
                    }'''

# Find the isApprovalChain block in adminImportCSV
csv_import_start = None
csv_import_end = None
for i, line in enumerate(lines):
    if 'if (cfg.isApprovalChain) {' in line:
        if csv_import_start is None:
            csv_import_start = i  # First occurrence was export, second is import
        else:
            # This could be the import one (second occurrence)
            pass
    # Look for the import section specifically - it has "审批链CSV导入"
    if '审批链CSV导入' in line or '将从CSV文件导入审批链数据' in line:
        csv_import_start = i - 1  # Include the if statement line
        break

if csv_import_start is None:
    # Try harder - search for the second occurrence of isApprovalChain
    count = 0
    for i, line in enumerate(lines):
        if 'if (cfg.isApprovalChain) {' in line:
            count += 1
            if count == 2:
                csv_import_start = i
                break

if csv_import_start is None:
    print("ERROR: Could not find CSV import approval chain block")
    sys.exit(1)

# Now find the end - it should be the line before "var newData;" or "cfg.refresh();"
csv_import_end = None
for i in range(csv_import_start, min(csv_import_start + 200, len(lines))):
    stripped = lines[i].strip()
    if stripped.startswith('var newData;') or (stripped.startswith('cfg.refresh();') and i > csv_import_start):
        csv_import_end = i - 1
        # Also go back to find the closing brace of the if block
        # Walk backward from csv_import_end to find the proper end
        break

if csv_import_end is None:
    # Find the closing brace at the right indent level
    for i in range(csv_import_start + 1, min(csv_import_start + 200, len(lines))):
        stripped = lines[i].strip()
        if stripped == '}' and lines[csv_import_start].strip().startswith('if (cfg.isApprovalChain)'):
            # Check if next line is "var newData;" or similar
            next_stripped = lines[i+1].strip() if i+1 < len(lines) else ''
            if next_stripped.startswith('var newData;') or next_stripped.startswith('if (cfg.isSimpleArray)'):
                csv_import_end = i
                break

if csv_import_end is None:
    print("ERROR: Could not find end of CSV import approval chain block")
    sys.exit(1)

print(f"Found CSV import block at lines {csv_import_start+1}-{csv_import_end+1}")

lines[csv_import_start:csv_import_end+1] = new_csv_import_block.split('\n')
print(f"Replaced CSV import block")

# ============================================================
# REPLACEMENT 6: Update adminViewLocalData() approval chain section
# ============================================================
print("\n=== Replacement 6: adminViewLocalData approval chain section ===")

new_local_data_approval = r'''            // === 审批链记录 ===
            lines.push('');
            lines.push('========== 审批链记录 ==========');
            var rawApproval = localStorage.getItem('approvalFlowConfig');
            if (rawApproval) {
                try {
                    var acg = JSON.parse(rawApproval);
                    lines.push('\u6570\u636e\u6765\u6e90: localStorage (approvalFlowConfig)  <a href="#" onclick="jumpToApprovalChainJSONView();return false;" style="color:#1a73e8;text-decoration:underline;font-weight:600;">&#128196; &#26597;&#30475;JSON&#35270;&#22270; &#8599;</a>');
                    var hqArr = acg.approvalConfigsHQ || [];
                    var brArr = acg.approvalConfigsBranch || [];
                    var instArr = acg.approvalConfigsInst || [];
                    lines.push('\u603b\u516c\u53f8\u6a21\u677f: ' + hqArr.length + '\u6761');
                    lines.push('\u5206\u516c\u53f8\u6a21\u677f: ' + brArr.length + '\u6761');
                    lines.push('\u673a\u6784\u5ba1\u6279\u6d41: ' + instArr.length + '\u6761');

                    hqArr.forEach(function(hq, i) {
                        lines.push('  \u251c\u2500 [\u603b\u516c\u53f8 ' + (i+1) + '] \u6e20\u9053: ' + (hq.channel||[]).join(',') + ' \u5b50\u6e20\u9053: ' + (hq.subChannels||[]).join(',') + ' \u91d1\u989d\u914d\u7f6e: ' + (hq.amountConfig||'-'));
                        if (hq.amountConfig === 'range' && hq.ranges) {
                            hq.ranges.forEach(function(r) {
                                lines.push('  \u2502   \u2514\u2500 ' + (r.label||'') + ': ' + (r.nodes||[]).length + '\u4e2a\u8282\u70b9');
                            });
                        }
                        if (hq.nodes) lines.push('  \u2502   \u2514\u2500 ' + hq.nodes.length + '\u4e2a\u8282\u70b9');
                    });
                    brArr.forEach(function(br, i) {
                        lines.push('  \u251c\u2500 [\u5206\u516c\u53f8 ' + (i+1) + '] \u6e20\u9053: ' + (br.channel||[]).join(',') + ' \u5206\u516c\u53f8: ' + (br.branches||[]).join(',') + ' ' + (br.nodes||[]).length + '\u4e2a\u8282\u70b9');
                    });
                    instArr.forEach(function(inst, i) {
                        lines.push('  \u2514\u2500 [\u673a\u6784 ' + (i+1) + '] \u6e20\u9053: ' + (inst.channel||[]).join(',') + ' ' + (inst.branch||'-') + '/' + (inst.org||'-') + ' ' + (inst.nodes||[]).length + '\u4e2a\u8282\u70b9');
                    });
                } catch(e) {
                    lines.push('\u6570\u636e\u89e3\u6790\u5931\u8d25: ' + e.message);
                }
            } else {
                lines.push('\u6570\u636e\u6765\u6e90: \u65e0\u672c\u5730\u6570\u636e');
            }'''

# Find the approval chain section in adminViewLocalData
local_data_start = None
local_data_end = None
for i, line in enumerate(lines):
    if '// === 审批链记录 ===' in line:
        local_data_start = i
    if local_data_start is not None and local_data_end is None:
        # Find the end - look for "// === 续期退费审批记录 ==="
        if '// === 续期退费审批记录 ===' in line or '续期退费审批记录' in line:
            local_data_end = i
            break

if local_data_start is None or local_data_end is None:
    print("ERROR: Could not find adminViewLocalData approval chain section")
    sys.exit(1)

print(f"Found local data section at lines {local_data_start+1}-{local_data_end+1}")

lines[local_data_start:local_data_end] = new_local_data_approval.split('\n')
print(f"Replaced local data approval chain section")

# ============================================================
# REPLACEMENT 7: Update load/init code (initApprovalConfig)
# ============================================================
print("\n=== Replacement 7: initApprovalConfig ===")

new_init_config = r'''        // 初始化：加载审批链配置
        (function initApprovalConfig() {
            var saved = null;
            try { saved = JSON.parse(localStorage.getItem('approvalFlowConfig')); } catch(e) {}
            if (saved && typeof saved === 'object' && saved.approvalConfigsHQ) {
                // 用已保存配置，确保三个数组存在
                if (!saved.approvalConfigsHQ) saved.approvalConfigsHQ = [];
                if (!saved.approvalConfigsBranch) saved.approvalConfigsBranch = [];
                if (!saved.approvalConfigsInst) saved.approvalConfigsInst = [];
                APPROVAL_FLOW_CONFIG = saved;
            } else {
                // 无有效保存数据，使用默认配置
                APPROVAL_FLOW_CONFIG = buildDefaultConfig();
            }
        })();'''

# Find the initApprovalConfig IIFE
init_start = None
init_end = None
for i, line in enumerate(lines):
    if 'function initApprovalConfig()' in line or '(function initApprovalConfig()' in line:
        init_start = i
    if init_start is not None and init_end is None:
        # Find the closing })(); of the IIFE
        stripped = line.strip()
        if stripped == '})();' and i > init_start:
            init_end = i
            break

if init_start is None or init_end is None:
    print("ERROR: Could not find initApprovalConfig")
    sys.exit(1)

print(f"Found initApprovalConfig at lines {init_start+1}-{init_end+1}")

# Also need to find the comment and the opening line before the function
# Go back to find the "// 初始化：" comment
for i in range(init_start - 5, init_start):
    if '// 初始化：' in lines[i] or '初始化' in lines[i]:
        init_start = i
        break

lines[init_start:init_end+1] = new_init_config.split('\n')
print(f"Replaced initApprovalConfig")

# ============================================================
# Also update getApprovalNodes to work with new structure
# ============================================================
print("\n=== Updating getApprovalNodes() ===")

new_get_approval_nodes = r'''        function getApprovalNodes(salesChannel, totalAmount, branch, subBranch, subChannel) {
            var cfg = APPROVAL_FLOW_CONFIG;
            if (!cfg || !cfg.approvalConfigsInst) {
                return { channel: '', tierLabel: '-', tierLevel: '-', nodes: [] };
            }

            // Determine channel and subChannel from salesChannel
            var ch = salesChannel || '';
            var subCh = subChannel || '-';
            if (ch.indexOf('个险') >= 0 || ch === '个险渠道') {
                ch = '个险';
                if (subChannel === 'PSA' || (salesChannel && salesChannel.indexOf('PSA') >= 0)) subCh = 'PSA';
                else subCh = 'PAA';
            } else if (ch.indexOf('银保') >= 0) {
                ch = '银保'; subCh = '-';
            } else if (ch.indexOf('团险') >= 0) {
                ch = '团险'; subCh = '-';
            } else if (ch.indexOf('在线') >= 0) {
                ch = '在线'; subCh = '-';
            }

            // 1. Try to match inst config (most specific)
            var insts = cfg.approvalConfigsInst || [];
            for (var i = 0; i < insts.length; i++) {
                var inst = insts[i];
                var chMatch = inst.channel && inst.channel.indexOf(ch) >= 0;
                var subChMatch = !inst.subChannels || inst.subChannels.length === 0 || inst.subChannels.indexOf(subCh) >= 0 || inst.subChannels.indexOf('-') >= 0;
                var brMatch = !inst.branch || inst.branch === branch;
                var orgMatch = !inst.org || inst.org === subBranch;
                var amountMatch = !inst.amountRange || (inst.amountRange.max === undefined || totalAmount < inst.amountRange.max) && (inst.amountRange.min === undefined || totalAmount >= inst.amountRange.min);
                if (chMatch && subChMatch && brMatch && orgMatch && amountMatch) {
                    return {
                        channel: ch,
                        tierLabel: inst.amountRange ? inst.amountRange.label : '-',
                        tierLevel: '机构审批流',
                        nodes: (inst.nodes || []).map(function(n) {
                            return {
                                name: n.name, role: n.name, level: n.order <= 5 ? '中支' : (n.order <= 11 ? '分公司' : '总公司'),
                                status: 'pending', operator: '-', time: '-',
                                isFirstNode: n.order === 1, showCommissionRebate: n.order === 1, showRejectBack: n.order > 1,
                                isFinancial: n.name.indexOf('财务') >= 0,
                                selectedUsers: (n.approvers || []).map(function(a) { return { userID: a, username: a, userDisplayName: a }; })
                            };
                        })
                    };
                }
            }

            // 2. Try branch config
            var branches = cfg.approvalConfigsBranch || [];
            for (var i = 0; i < branches.length; i++) {
                var br = branches[i];
                var chMatch = br.channel && br.channel.indexOf(ch) >= 0;
                var brMatch = br.branches && br.branches.indexOf(branch) >= 0;
                if (chMatch && brMatch) {
                    return {
                        channel: ch, tierLabel: '-', tierLevel: '分公司',
                        nodes: (br.nodes || []).map(function(n) {
                            return {
                                name: n.name, role: n.name, level: '分公司',
                                status: 'pending', operator: '-', time: '-',
                                isFirstNode: n.order === 1, showCommissionRebate: n.order === 1, showRejectBack: n.order > 1,
                                isFinancial: n.name.indexOf('财务') >= 0,
                                selectedUsers: (n.approvers || []).map(function(a) { return { userID: a, username: a, userDisplayName: a }; })
                            };
                        })
                    };
                }
            }

            // 3. Try HQ config
            var hqs = cfg.approvalConfigsHQ || [];
            for (var i = 0; i < hqs.length; i++) {
                var hq = hqs[i];
                var chMatch = hq.channel && hq.channel.indexOf(ch) >= 0;
                if (chMatch) {
                    var nodes = [];
                    if (hq.amountConfig === 'range' && hq.ranges) {
                        for (var ri = 0; ri < hq.ranges.length; ri++) {
                            var range = hq.ranges[ri];
                            var inRange = (range.max === undefined || totalAmount < range.max) && (range.min === undefined || totalAmount >= range.min);
                            if (inRange) {
                                nodes = (range.nodes || []).map(function(n) {
                                    return {
                                        name: n.name, role: n.name, level: '总公司',
                                        status: 'pending', operator: '-', time: '-',
                                        isFirstNode: n.order === 1, showCommissionRebate: false, showRejectBack: true,
                                        isFinancial: n.name.indexOf('财务') >= 0,
                                        selectedUsers: (n.approvers || []).map(function(a) { return { userID: a, username: a, userDisplayName: a }; })
                                    };
                                });
                                return { channel: ch, tierLabel: range.label || '-', tierLevel: '总公司', nodes: nodes };
                            }
                        }
                    }
                    // all amountConfig
                    nodes = (hq.nodes || []).map(function(n) {
                        return {
                            name: n.name, role: n.name, level: '总公司',
                            status: 'pending', operator: '-', time: '-',
                            isFirstNode: n.order === 1, showCommissionRebate: false, showRejectBack: true,
                            isFinancial: n.name.indexOf('财务') >= 0,
                            selectedUsers: (n.approvers || []).map(function(a) { return { userID: a, username: a, userDisplayName: a }; })
                        };
                    });
                    return { channel: ch, tierLabel: '-', tierLevel: '总公司', nodes: nodes };
                }
            }

            // Fallback: empty
            return { channel: ch, tierLabel: '-', tierLevel: '-', nodes: [] };
        }'''

# Find getApprovalNodes function
get_nodes_start = None
get_nodes_end = None
for i, line in enumerate(lines):
    if 'function getApprovalNodes(' in line:
        get_nodes_start = i
    if get_nodes_start is not None and get_nodes_end is None:
        # Find end of function - look for closing brace at same indent level
        stripped = line.strip()
        if i > get_nodes_start and stripped == '}':
            get_nodes_end = i
            break

if get_nodes_start is None or get_nodes_end is None:
    print("ERROR: Could not find getApprovalNodes")
    sys.exit(1)

print(f"Found getApprovalNodes at lines {get_nodes_start+1}-{get_nodes_end+1}")

lines[get_nodes_start:get_nodes_end+1] = new_get_approval_nodes.split('\n')
print(f"Replaced getApprovalNodes")

# ============================================================
# Also update clearApprovalConfig to use new structure
# ============================================================
print("\n=== Updating clearApprovalConfig ===")

new_clear_config = r'''        function clearApprovalConfig() {
            if (!confirm('确认清空所有审批链数据？此操作不可撤销！')) return;
            APPROVAL_FLOW_CONFIG = { version: '1.0.0', approvalConfigsHQ: [], approvalConfigsBranch: [], approvalConfigsInst: [] };
            try { localStorage.removeItem('approvalFlowConfig'); } catch(e) {}
            try { localStorage.removeItem('approvalFlowConfigMeta'); } catch(e) {}
            refreshAdminApprovalChain();
            showToast('审批链数据已清空', 'success');
        }'''

# Find clearApprovalConfig
clear_start = None
clear_end = None
for i, line in enumerate(lines):
    if 'function clearApprovalConfig()' in line:
        clear_start = i
    if clear_start is not None and clear_end is None:
        stripped = line.strip()
        if i > clear_start and stripped == '}':
            clear_end = i
            break

if clear_start is not None and clear_end is not None:
    print(f"Found clearApprovalConfig at lines {clear_start+1}-{clear_end+1}")
    lines[clear_start:clear_end+1] = new_clear_config.split('\n')
    print(f"Replaced clearApprovalConfig")
else:
    print("WARNING: Could not find clearApprovalConfig")

# ============================================================
# Update approvalConfigSaveSilent to handle new structure
# ============================================================
print("\n=== Updating approvalConfigSaveSilent ===")

# This function is fine - it just saves whatever APPROVAL_FLOW_CONFIG is.
# But the comment in initApprovalConfig that says "强制清除 localStorage" should be updated.
# Already handled in replacement 7.

# ============================================================
# Update ADMIN_CSV_CONFIG headers
# ============================================================
print("\n=== Updating ADMIN_CSV_CONFIG headers ===")

for i, line in enumerate(lines):
    if "headers: ['节点编号', '销售渠道', '子渠道', '所属分公司', '所属机构', '金额区间', '节点名称', '用户名', '用户姓名', '审批层级']" in line:
        lines[i] = line.replace("headers: ['节点编号', '销售渠道', '子渠道', '所属分公司', '所属机构', '金额区间', '节点名称', '用户名', '用户姓名', '审批层级']", "headers: ['节点序号', '销售渠道', '子渠道', '所属分公司', '所属机构', '金额区间', '节点名称', '用户名', '用户姓名']")
        print(f"Updated CSV headers at line {i+1}")
        break

# ============================================================
# Write the output file
# ============================================================
output = '\n'.join(lines)

with open(FILE_PATH, 'w', encoding='utf-8') as f:
    f.write(output)

print(f"\n=== Done! Written {len(lines)} lines to {FILE_PATH} ===")
