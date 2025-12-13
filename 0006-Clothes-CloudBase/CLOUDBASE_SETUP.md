# 腾讯云开发 CloudBase 配置指南

## 🚀 快速开始

### 1. 创建云开发环境

1. 访问 [腾讯云开发控制台](https://console.cloud.tencent.com/tcb)
2. 点击「新建环境」
3. 选择「按量计费」（免费额度充足）
4. 环境名称：`clothes-wardrobe`（或自定义）
5. 记录下你的**环境ID**（格式类似：`clothes-1g2h3i4j5k`）

### 2. 开通服务

在云开发控制台中开通以下服务：

#### 数据库
- 进入「数据库」→ 点击「开通」
- 免费版配置即可

#### 云存储
- 进入「云存储」→ 点击「开通」
- 免费额度：5GB 存储空间

#### 用户认证
- 进入「用户管理」→ 开启「匿名登录」
- 这样用户无需注册即可使用

### 3. 配置环境ID

打开 `cloudbase-config.js` 文件，将环境ID替换为你的：

```javascript
const cloudbaseConfig = {
    env: 'your-env-id'  // 替换为你的环境ID
};
```

### 4. 创建数据库集合

在云开发控制台的「数据库」中创建以下集合：

#### 集合：`clothes`（衣服数据）
字段说明：
- `_id`: 自动生成的文档ID
- `description`: 衣服描述（string）
- `tags`: 标签数组（array）
- `imageUrl`: 图片URL（string）
- `fileID`: 云存储文件ID（string）
- `createTime`: 创建时间（object, serverDate）
- `updateTime`: 更新时间（object, serverDate）

#### 集合：`outfits`（搭配方案）
字段说明：
- `_id`: 自动生成的文档ID
- `name`: 搭配名称（string）
- `clothes`: 衣服ID数组（array）
- `createTime`: 创建时间（object, serverDate）

### 5. 设置数据库权限

在每个集合的「权限设置」中：
- 选择「自定义安全规则」
- 设置为以下规则（允许所有用户读写）：

```json
{
  "read": true,
  "write": true
}
```

**注意**：生产环境建议设置更严格的权限规则。

### 6. 设置云存储权限

在「云存储」→「权限设置」中：
- 创建自定义安全规则
- 允许所有用户上传：

```json
{
  "read": true,
  "write": true
}
```

## 📊 免费额度

腾讯云开发提供的免费额度（按量计费）：

| 资源类型 | 免费额度 |
|---------|---------|
| 数据库容量 | 2GB |
| 数据库读操作 | 5万次/天 |
| 数据库写操作 | 3万次/天 |
| 云存储容量 | 5GB |
| 云存储下载流量 | 2GB/月 |
| 云存储上传流量 | 1GB/月 |
| CDN流量 | 5GB/月 |

对于个人衣橱管理应用，免费额度完全够用！

## 🔧 API 使用说明

### 数据库操作

```javascript
// 添加数据
await db.collection('clothes').add({
    description: '白色T恤',
    tags: ['上衣', '夏季'],
    imageUrl: 'https://...',
    createTime: db.serverDate()
});

// 查询数据
const res = await db.collection('clothes').get();
console.log(res.data);

// 更新数据
await db.collection('clothes').doc('id').update({
    description: '新的描述'
});

// 删除数据
await db.collection('clothes').doc('id').remove();
```

### 文件上传

```javascript
// 上传文件
const result = await cloudbase.uploadFile({
    cloudPath: 'clothes/' + Date.now() + '.jpg',
    filePath: file  // File 对象
});

console.log('文件ID:', result.fileID);
console.log('下载URL:', result.download_url);
```

## 🌐 域名白名单配置

如果使用 GitHub Pages 部署，需要在云开发控制台添加安全域名：

1. 进入「用户管理」→「登录设置」
2. 在「WEB安全域名」中添加：
   - `https://chengang-036.github.io`
   - `http://localhost:8080`（本地测试）

## ⚠️ 注意事项

1. **环境ID**：务必替换 `cloudbase-config.js` 中的环境ID
2. **权限设置**：开发阶段可以设置宽松权限，生产环境需要严格控制
3. **数据备份**：定期在控制台导出数据备份
4. **流量监控**：在控制台监控流量使用情况

## 📚 相关文档

- [云开发官方文档](https://cloud.tencent.com/document/product/876)
- [Web SDK 文档](https://docs.cloudbase.net/api-reference/web/initialization)
- [数据库文档](https://docs.cloudbase.net/api-reference/web/database)
- [云存储文档](https://docs.cloudbase.net/api-reference/web/storage)

## 🆚 与 Firebase 的对比

| 特性 | CloudBase | Firebase |
|-----|-----------|----------|
| 国内访问 | ✅ 快速无阻 | ❌ 需要代理 |
| 免费额度 | 5GB存储+2GB流量 | 1GB存储+10GB流量 |
| 中文文档 | ✅ 完善 | ⚠️ 英文为主 |
| 微信小程序 | ✅ 原生支持 | ❌ 不支持 |
| 学习曲线 | 简单 | 中等 |

## ❓ 常见问题

### Q: 如何查看环境ID？
A: 在云开发控制台首页，环境名称下方就是环境ID

### Q: 匿名登录是什么？
A: 允许用户无需注册即可使用应用，系统会自动分配一个匿名身份

### Q: 数据会丢失吗？
A: 不会，所有数据都存储在腾讯云服务器上，只要不手动删除就永久保存

### Q: 超出免费额度怎么办？
A: 系统会按量计费，价格很便宜。可以在控制台设置费用预警

---

配置完成后，刷新页面即可使用云端版本！🎉
