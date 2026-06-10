# 6月8日晚 ~ 6月9日 全部代码恢复完成

## 事故回顾

6月10日下午ASCII编码脚本bug清空了文件（0字节）。从**6月8日14:34**备份恢复时只重做了6月10日的改动，导致6月8日晚上~6月9日全天约40+处改动丢失。经过两轮恢复，现全部找回。

## 恢复清单

### 第一轮恢复（前面已完成）
| # | 改动 | 关键函数 |
|---|------|----------|
| 1 | 操作人显示真实姓名 | `currentOperatorName()` + 27处替换 |
| 2 | 状态污染修复 | `approvalConfigSwitchScope/SwitchChannel/renderApprovalFlowConfig` |
| 3 | 审批节点复制按钮 | `CopyFromMidAndBranch/CopyFromMidBranchAndHq/CopyCityFromBranch` |
| 4 | 移动端客户列表 | `renderMobileCustomerList/quickMobileCustomerLogin/mCustListSection` |

### 第二轮恢复（本轮完成）
| # | 改动 | 说明 |
|---|------|------|
| 1 | Dropdown时序修复 | `_dropdownTimer` + 250ms延迟 + clearTimeout防止竞态 |
| 2 | Store函数try-catch | 9个getXxxStore全部健壮化 |
| 3 | 数据源迁移 | 移除硬编码BRANCH_LIST/MID_BRANCH_LIST → Admin动态读取 |
| 4 | 所属机构显示修复 | `orgCol = midBranchName \|\| '-'` |
| 5 | 审批链CSV导入重写 | 确认对话框 + 四层重建 + push多用户 |
| 6 | 审批层级模糊匹配 | `indexOf('总公司')>=0` 兼容新旧格式 |
| 7 | 审批层级去"层"字 | `level:'总公司层'` → `level:'总公司'` |
| 8 | 在线C+空tiers修复 | 自动填充默认tiers结构 |
| 9 | 中支label修复 | 缺失时自动补全金额区间标签 |
| 10 | 金额区间显示修复 | `tierLabel==='-'` 时仅显示 `-` |
| 11 | 节点名称去后缀 | 全页面去掉(PAA)/(PSA) |
| 12 | getCurrentConfig引用 | 确保_midBranches引用一致性 |

## 文件状态

- **当前**: 7,811 行 / 556KB
- **JS语法**: ✅ 通过 node --check 验证
- **对比备份**: +2,500行 / +24KB

## 6月8日晚~6月9日改动全部恢复 ✅
