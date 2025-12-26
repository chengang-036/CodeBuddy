# Clothes - 本地衣橱管理系统

一个完全本地化的衣橱管理系统，适用于Mac PC单机使用，无需联网。

## 功能特性

✨ **完全本地存储**
- 使用 localStorage 存储所有数据
- 图片使用 base64 编码存储
- 无需数据库，无需联网
- 数据完全私密，保存在本地浏览器

📤 **衣服上架**
- 支持点击或拖拽上传照片
- 添加描述和自定义标签
- 照片自动转换为 base64 格式存储

👗 **衣橱管理**
- 查看所有已上传的衣服
- 按描述搜索衣服
- 按标签筛选衣服
- 编辑衣服信息（描述和标签）
- 标签支持增加、删除、修改
- 删除不需要的衣服

✨ **搭配衣服**
- 分三个区域：上装、下装、鞋子/配饰
- 每个区域独立搜索和标签过滤
- 实时预览选中的衣服
- 保存搭配方案并命名

💼 **搭配方案**
- 查看所有保存的搭配
- 按名称搜索搭配
- 编辑已保存的搭配
- 删除不需要的搭配
- 点击查看大图

## 使用方法

### 方式一：直接打开（推荐）

1. 双击 `index.html` 文件
2. 使用默认浏览器打开（推荐 Safari 或 Chrome）
3. 开始使用

### 方式二：本地服务器

```bash
# 在项目目录下运行
python3 -m http.server 8000

# 浏览器访问
open http://localhost:8000
```

## 技术实现

- **前端框架**：纯 HTML + CSS + JavaScript（原生JS）
- **数据存储**：localStorage API
- **图片存储**：base64 编码
- **样式设计**：渐变色背景 + 卡片式布局
- **响应式设计**：支持不同屏幕尺寸

## 数据结构

### 衣服数据 (clothes)
```javascript
{
  id: "时间戳字符串",
  imageData: "base64编码的图片数据",
  description: "衣服描述",
  tags: ["标签1", "标签2"],
  createTime: "ISO日期字符串",
  updateTime: "ISO日期字符串"
}
```

### 搭配数据 (outfits)
```javascript
{
  id: "时间戳字符串",
  name: "搭配名称",
  top: "上装衣服ID",
  middle: "下装衣服ID",
  bottom: "鞋子衣服ID",
  createTime: "ISO日期字符串",
  updateTime: "ISO日期字符串"
}
```

## 注意事项

1. **存储限制**：localStorage 通常有 5-10MB 的存储限制
   - 系统会自动压缩上传的图片（最大宽度800px，质量70%）
   - 建议定期删除不需要的衣服以释放空间
   - 上传时会在控制台显示压缩前后的大小对比
   
2. **存储空间管理**：
   - 打开浏览器控制台（F12）可以查看当前存储使用情况
   - 当存储使用超过4MB时会收到警告
   - 如果提示"存储空间已满"，请删除一些旧衣服
   
3. **数据备份**：数据存储在浏览器本地，清除浏览器数据会导致数据丢失

4. **浏览器兼容**：建议使用现代浏览器（Safari 13+, Chrome 80+）

5. **图片优化建议**：
   - 系统会自动压缩，但建议上传前适当裁剪图片
   - 避免上传超大尺寸的原始照片
   - 推荐图片尺寸：800-1200px 宽度

## 数据导出/导入

可以通过浏览器开发者工具手动导出/导入数据：

### 导出数据
```javascript
// 在浏览器控制台执行
const data = {
  clothes: localStorage.getItem('clothes'),
  outfits: localStorage.getItem('outfits')
};
console.log(JSON.stringify(data));
// 复制输出结果保存到文件
```

### 导入数据
```javascript
// 在浏览器控制台执行
const data = /* 粘贴导出的数据 */;
localStorage.setItem('clothes', data.clothes);
localStorage.setItem('outfits', data.outfits);
location.reload();
```

## 项目结构

```
0008-Clothes-MacPC/
├── index.html          # 主页
├── upload.html         # 衣服上架页面
├── wardrobe.html       # 衣橱管理页面
├── match.html          # 搭配衣服页面
├── outfits.html        # 搭配方案页面
└── README.md           # 说明文档
```

## 版本历史

- v1.0 (2025-12-25)
  - 初始版本
  - 实现基本的衣橱管理功能
  - 实现搭配功能
  - 完全本地化存储

## 许可证

本项目仅供个人学习和使用。
