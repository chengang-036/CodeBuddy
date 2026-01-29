# 豆包API配置说明

## 配置步骤

### 1. 访问火山引擎控制台
访问：https://console.volcengine.com/ark

### 2. 创建推理接入点（重要！）

在豆包(ARK)中，不能直接使用模型名称，必须先创建一个**推理接入点**：

1. 在控制台左侧菜单选择：**在线服务** -> **推理**
2. 点击 **创建接入点**
3. 选择支持视觉的模型，例如：
   - `doubao-vision-pro-32k` (推荐)
   - `doubao-vision-pro-256k`
4. 创建后，会获得一个**接入点ID**，格式类似：`ep-20250129162937-xxxxx`
5. 复制这个接入点ID，后续配置需要用到

### 3. 创建API Key

1. 在控制台左侧菜单选择：**API Key管理**
2. 点击 **创建API Key**
3. 设置密钥名称和权限
4. 创建成功后，**立即复制API Key**（只显示一次）
5. API Key格式类似：`ab68ac84-2f2b-4169-b9ff-a64f50eec2c8`

### 4. 在代码中配置

打开 `index.html`，找到第1156行左右的 `DOUBAO_CONFIG` 配置：

```javascript
const DOUBAO_CONFIG = {
    apiKey: 'your-api-key-here',           // 替换为你的API Key
    endpointId: 'ep-20250129162937-xxxxx', // 替换为你的接入点ID
    get endpoint() {
        return `https://ark.cn-beijing.volces.com/api/v3/chat/completions`;
    },
    get model() {
        return this.endpointId;
    }
};
```

**配置示例：**
```javascript
const DOUBAO_CONFIG = {
    apiKey: 'ab68ac84-2f2b-4169-b9ff-a64f50eec2c8',
    endpointId: 'ep-20250129162937-h5kqw',
    get endpoint() {
        return `https://ark.cn-beijing.volces.com/api/v3/chat/completions`;
    },
    get model() {
        return this.endpointId;
    }
};
```

## 使用方法

1. 在"新增错题"或"编辑错题"页面
2. 上传或粘贴题目图片
3. 点击图片右上角的 🔍 按钮
4. 等待几秒，识别的题目文字会自动填入"题目描述"框

## 常见问题

### Q1: 提示"接入点ID不存在或无权访问"
**原因：** endpointId配置错误或接入点未启用

**解决：**
- 检查endpointId是否正确复制（应以`ep-`开头）
- 在控制台确认接入点状态为"已启用"
- 确保API Key有权限访问该接入点

### Q2: 提示"API Key无效或已过期"
**原因：** API Key配置错误或已被删除

**解决：**
- 重新复制API Key（注意不要有多余空格）
- 如果API Key被删除，需要重新创建

### Q3: 识别不出题目或识别不准确
**原因：** 图片质量问题或包含手写内容

**解决：**
- 确保图片清晰，题目文字是印刷体
- 尽量裁剪掉手写部分
- 可以尝试多拍几张图片

### Q4: 识别后没有反应
**原因：** 可能是网络问题或API调用失败

**解决：**
- 按F12打开浏览器控制台，查看错误信息
- 检查网络连接
- 确认API配置正确

## 关键概念说明

### 为什么需要接入点ID而不是模型名称？

火山引擎(豆包)的API架构中：
- **推理接入点**是一个包装了模型的服务实例
- 每个接入点有独立的ID、配置和计费
- API调用时使用接入点ID而不是直接使用模型名称
- 这样可以实现：
  - 版本管理：可以创建多个接入点使用不同版本的模型
  - 流量控制：不同接入点可以有不同的配额和限流策略
  - 成本管理：每个接入点独立计费，便于成本追踪

### API调用流程

```
客户端 -> API Key认证 -> 指定接入点ID -> 路由到对应模型 -> 返回结果
```

## 费用说明

- 豆包API采用按Token计费
- 图像识别会消耗一定的Token
- 建议在控制台设置用量告警
- 查看详细价格：https://www.volcengine.com/docs/82379/1099320

## 技术支持

如遇到问题，可以：
1. 查看火山引擎官方文档：https://www.volcengine.com/docs/82379
2. 在浏览器控制台查看详细错误日志
3. 检查网络请求的响应内容
