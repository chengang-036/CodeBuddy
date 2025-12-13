# 👔 危老板的衣橱 - 腾讯云开发版

一个基于腾讯云开发(CloudBase)的智能衣橱管理系统，实现跨设备数据同步，无需代理即可在国内快速访问。

## 🌟 特性

- ☁️ **云端存储**：基于腾讯云开发，数据永久保存
- 🚀 **国内访问**：无需代理，访问速度快
- 📱 **跨设备同步**：任何设备都能访问你的衣橱
- 🖼️ **图片管理**：云存储图片，不占用浏览器空间
- 🏷️ **标签系统**：灵活的标签分类管理
- ✨ **智能搭配**：创建和保存搭配方案
- 🔍 **快速搜索**：支持描述和标签搜索

## 📋 功能模块

1. **衣服上架** - 上传衣服照片并添加描述
2. **衣橱管理** - 浏览、搜索、编辑、删除衣服
3. **搭配衣服** - 创建心仪的穿搭组合
4. **搭配方案** - 查看和管理已保存的搭配

## 🚀 快速开始

### 1. 配置云开发环境

请参考 [CLOUDBASE_SETUP.md](./CLOUDBASE_SETUP.md) 完成以下步骤：

1. 创建腾讯云开发环境
2. 开通数据库和云存储服务
3. 创建数据库集合（`clothes` 和 `outfits`）
4. 配置权限规则
5. 更新 `cloudbase-config.js` 中的环境ID

### 2. 本地运行

```bash
# 使用本地服务器运行（推荐）
python -m http.server 8080
# 或
npx http-server

# 然后访问
open http://localhost:8080
```

### 3. 部署到 GitHub Pages

```bash
git add .
git commit -m "feat: 添加腾讯云开发版衣橱系统"
git push origin main
```

访问：`https://your-username.github.io/your-repo/0006-Clothes-CloudBase/`

## 💰 费用说明

腾讯云开发按量计费模式提供免费额度：

| 资源 | 免费额度 | 说明 |
|-----|---------|------|
| 数据库存储 | 2GB | 足够存储数万条记录 |
| 数据库读 | 5万次/天 | 个人使用完全够用 |
| 数据库写 | 3万次/天 | 个人使用完全够用 |
| 云存储 | 5GB | 可存储数千张照片 |
| 下载流量 | 2GB/月 | 个人使用完全够用 |

**对于个人衣橱应用，免费额度完全足够，无需付费！**

## 🆚 版本对比

### CloudBase 版本 (本版本)
- ✅ 国内直接访问，速度快
- ✅ 腾讯云服务，稳定可靠
- ✅ 中文文档，支持友好
- ✅ 免费额度充足

### Firebase 版本 (0003-Clothes)
- ⚠️ 国内访问需要代理
- ✅ 全球服务，功能强大
- ⚠️ 英文文档为主

### LocalStorage 版本
- ✅ 完全离线，无需配置
- ❌ 数据仅存本地，不能跨设备
- ❌ 存储空间有限（~5MB）

## 📂 项目结构

```
0006-Clothes-CloudBase/
├── index.html                  # 主页
├── upload-cloudbase.html       # 衣服上架（云端版）
├── wardrobe-cloudbase.html     # 衣橱管理（云端版）- 待创建
├── match-cloudbase.html        # 搭配衣服（云端版）- 待创建
├── outfits-cloudbase.html      # 搭配方案（云端版）- 待创建
├── upload.html                 # 衣服上架（本地版）
├── wardrobe.html               # 衣橱管理（本地版）
├── match.html                  # 搭配衣服（本地版）
├── outfits.html                # 搭配方案（本地版）
├── cloudbase-config.js         # 云开发配置
├── CLOUDBASE_SETUP.md          # 配置指南
└── README.md                   # 本文件
```

## 🔧 技术栈

- **前端**: HTML5 + CSS3 + JavaScript
- **后端服务**: 腾讯云开发 CloudBase
- **数据库**: 云数据库（NoSQL）
- **存储**: 云存储（对象存储）
- **认证**: 匿名登录

## 📱 数据库结构

### clothes 集合
```javascript
{
  _id: "自动生成",
  description: "衣服描述",
  tags: ["标签1", "标签2"],
  imageUrl: "图片URL",
  fileID: "云存储文件ID",
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

### outfits 集合
```javascript
{
  _id: "自动生成",
  name: "搭配名称",
  clothes: ["衣服ID1", "衣服ID2"],
  createTime: "创建时间"
}
```

## 🔒 安全说明

当前配置为开发模式，所有用户都可以读写数据。**生产环境请设置更严格的权限规则**：

```json
{
  "read": "auth.uid != null",
  "write": "auth.uid != null"
}
```

## 🐛 常见问题

### Q: 提示"CloudBase 未初始化"？
A: 请检查 `cloudbase-config.js` 中的环境ID是否正确配置。

### Q: 图片上传失败？
A: 
1. 检查云存储是否已开通
2. 检查权限设置是否正确
3. 检查网络连接

### Q: 数据无法保存？
A:
1. 检查数据库集合是否已创建
2. 检查权限规则是否正确
3. 打开浏览器控制台查看具体错误

### Q: 本地测试无法访问云服务？
A: 在云开发控制台添加 `http://localhost:8080` 到安全域名白名单。

## 📚 参考资源

- [腾讯云开发官网](https://cloud.tencent.com/product/tcb)
- [CloudBase 文档](https://docs.cloudbase.net/)
- [Web SDK API](https://docs.cloudbase.net/api-reference/web/initialization)

## 📝 下一步计划

- [ ] 完成 wardrobe-cloudbase.html（衣橱管理云端版）
- [ ] 完成 match-cloudbase.html（搭配衣服云端版）
- [ ] 完成 outfits-cloudbase.html（搭配方案云端版）
- [ ] 添加数据导入导出功能
- [ ] 优化图片加载性能

## 📄 许可证

MIT License

---

**开发者**: 危老板  
**版本**: CloudBase v1.0  
**更新日期**: 2024-12-04
