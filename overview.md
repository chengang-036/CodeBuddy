# 代码优化：硬编码消除与可读性提升

## 优化概要

对 `续期保费退费管理系统_交互原型V2.html`（10260行）进行了系统性的硬编码消除，引入5组枚举常量，替换了**56处**散落的魔法数字和字符串字面量。

## 优化详情

### 1. 状态码枚举 `STATUS`（替换 20+ 处）

**问题**：代码中散落 `r.status === 5`、`refund.status === 10`、`[8,9,10,11].includes(refund.status)` 等裸数字，无法从数字直接推断业务含义。

**方案**：定义语义化枚举常量
```js
const STATUS = {
    PROCESSING:       1,  // 受理中
    APPROVING:        3,  // 审批未完成
    MATERIAL_PENDING: 5,  // 待客户补材料
    FAILED:           10, // 退费失败
    CANCELLED:        11  // 退费撤销
    // ... 共11个状态
};
```

**替换示例**：
- `r.status !== 3` → `r.status !== STATUS.APPROVING`
- `[8, 9, 10, 11].includes(refund.status)` → `[STATUS.REFUNDING, STATUS.REFUNDED, STATUS.FAILED, STATUS.CANCELLED].includes(refund.status)`

### 2. 角色枚举 `ROLE` + 权限枚举 `PERM`（替换 12+ 处）

**问题**：`roleID === 'J1'`、`perms.includes('Q8')` 等裸字符串散落各处。

**方案**：
```js
const ROLE = { CUSTOMER: 'J1', ADMIN: 'J8', SEAT95500: 'J2', ... };
const PERM = { OPS: 'Q8', APPROVAL: 'Q3', APPROVAL_FLOW: 'Q9', ... };
```

### 3. 重复角色名数组提取 `INNER_ROLE_NAMES`（替换 5 处）

**问题**：`['95500坐席', '柜员', '业务内勤', '业务管理-分渠道', '业务管理-全渠道']` 在催办按钮逻辑中重复5次。

**方案**：提取为 `const INNER_ROLE_NAMES = [...]`，统一引用。

### 4. 提示消息常量 `MSG`（替换 8 处）

**问题**：`'请输入审批意见'`、`'已驳回，退回至第一审批节点'`、`'审批已拒绝，请与客户联系发起撤销操作'` 等提示语重复2-4次。

**方案**：
```js
const MSG = {
    ENTER_OPINION: '请输入审批意见',
    REJECT_TO_FIRST: '已驳回，退回至第一审批节点',
    APPROVAL_REJECTED: '审批已拒绝，请与客户联系发起撤销操作',
    // ...
};
```

### 5. STATUS_NAMES 重复定义清理

**问题**：第4964行局部定义了 `STATUS_NAMES = { 1: '受理中', 4: '审批第一个节点', 5: '材料待确认状态' }`，与全局 `STATUS_CONFIG` 部分重叠但名称不同（状态4在全局叫"审批完成"，撤回场景叫"审批第一个节点"）。

**方案**：重命名为 `RECALL_STATUS_NAMES` 并用 `STATUS` 枚举做key，加注释说明差异原因。

### 6. EMBEDDED_USERS 口令注释

**问题**：14个演示用户口令全部为 `123456`，无注释说明。

**方案**：添加注释 `⚠️ 演示用统一口令 123456，生产环境不可复用`。

## 验证结果

- ✅ Node.js 语法检查通过（8303行JS代码无错误）
- ✅ 零残留裸数字状态码（grep 确认）
- ✅ 零残留裸角色码/权限码（grep 确认）
- ✅ 枚举常量共被引用 56 处

## 未处理项（后续优化）

| 项目 | 数量 | 原因 |
|------|------|------|
| 颜色十六进制值 | 470+处 | 工作量巨大，不影响逻辑正确性，建议单独任务处理 |
| 渠道字符串散落 | 80+处 | 需定义 CHANNELS 常量数组，改动范围大，建议单独任务处理 |
| 导出CSV重复模式 | 10+处 | 低优先级 |

## 备份

原始文件备份于 `续期保费退费管理系统_交互原型V2_pre_refactor.html`
