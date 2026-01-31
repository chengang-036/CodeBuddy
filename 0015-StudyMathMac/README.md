# 高中数学错题本 - Mac应用

基于SwiftUI和Swift开发的原生Mac应用，用于高中数学错题管理和学习。

## ✨ 功能特性

### 核心功能
- ✅ 错题录入和管理
- ✅ 图片上传和查看（支持拖拽、粘贴）
- ✅ 豆包AI图像识别
- ✅ 学习方法论管理
- ✅ 本地数据存储（CoreData + 文件系统）
- ✅ 按难度、掌握程度筛选
- ✅ 全文搜索功能
- ✅ 统计分析

### 界面特点
- 原生Mac UI设计
- 三栏布局（侧边栏、列表、详情）
- 支持深色模式
- 流畅的动画效果
- 键盘快捷键支持

### 数据管理
- 使用CoreData存储结构化数据
- 图片存储在应用容器内
- 支持导入导出备份（计划中）

## 🛠️ 技术栈

- **语言**: Swift 5.9+
- **框架**: SwiftUI + AppKit
- **数据库**: CoreData
- **图片处理**: AppKit + NSImage
- **网络**: URLSession
- **AI服务**: 豆包大模型

## 📋 系统要求

- macOS 13.0 (Ventura) 或更高版本
- Xcode 15.0 或更高版本

## 🚀 开始使用

### 1. 创建Xcode项目

详细步骤请参考 [Xcode项目创建指南.md](./Xcode项目创建指南.md)

简要步骤：
1. 打开Xcode
2. File > New > Project
3. 选择 macOS > App
4. 填写项目信息（Product Name: StudyMathMac）
5. 勾选 Use Core Data
6. 保存到本目录

### 2. 导入源代码文件

将以下文件/文件夹拖入Xcode项目：
- `Models/` - 数据模型
- `Views/` - 视图组件
- `ViewModels/` - 视图模型
- `Services/` - 服务层
- `StudyMathMacApp.swift` - 应用入口
- `ContentView.swift` - 主视图
- `StudyMath.xcdatamodeld/` - CoreData模型

### 3. 配置豆包API

1. 运行应用后，按 `⌘,` 打开设置
2. 在"AI设置"中填入：
   - **API Key**: 你的豆包API密钥
   - **Endpoint ID**: 推理接入点ID（格式：ep-xxxxx）

参考 [配置指南.md](./配置指南.md) 获取详细配置说明。

### 4. 运行应用

1. 在Xcode中选择目标设备：**My Mac**
2. 点击运行按钮（⌘R）

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| ⌘N | 新增错题 |
| ⌘E | 编辑选中错题 |
| ⌘⌫ | 删除选中错题 |
| ⌘F | 搜索（聚焦搜索框） |
| ⌘R | 刷新列表 |
| ⌘M | 新增方法论 |
| ⌘⇧L | 查看所有方法论 |
| ⌘⇧V | 粘贴图片 |
| ⌘O | 导入数据 |
| ⌘⇧S | 导出数据 |
| ⌘, | 打开设置 |
| ⌘Q | 退出应用 |

## 📁 项目结构

```
0015-StudyMathMac/
├── StudyMathMacApp.swift          # 应用入口
├── ContentView.swift              # 主视图（三栏布局）
├── Models/                        # 数据模型
│   ├── ErrorRecord.swift          # 错题模型
│   ├── Methodology.swift          # 方法论模型
│   └── PersistenceController.swift # CoreData控制器
├── ViewModels/                    # 视图模型
│   ├── ErrorViewModel.swift       # 错题业务逻辑
│   └── MethodologyViewModel.swift # 方法论业务逻辑
├── Views/                         # 视图组件
│   └── Components/
│       ├── SidebarView.swift      # 侧边栏
│       ├── ErrorListView.swift    # 错题列表
│       ├── ErrorDetailView.swift  # 错题详情
│       ├── ErrorEditView.swift    # 错题编辑
│       ├── MethodologyListView.swift # 方法论列表
│       └── SettingsView.swift     # 设置页面
├── Services/                      # 服务层
│   ├── ImageManager.swift         # 图片管理
│   └── DouBaoService.swift        # 豆包AI服务
├── StudyMath.xcdatamodeld/        # CoreData模型定义
├── Info.plist                     # 应用配置
├── README.md                      # 本文件
├── 配置指南.md                     # 豆包API配置指南
├── Xcode项目创建指南.md            # 项目创建详细步骤
└── .gitignore                     # Git忽略文件
```

## 📊 数据模型

### ErrorRecord（错题记录）
- `id`: UUID
- `date`: 创建日期
- `chapter`: 章节/知识点
- `difficulty`: 难度（基础/中等/难题）
- `mastery`: 掌握程度（未掌握/基本掌握/已掌握）
- `questionDescription`: 题目描述
- `errorReason`: 错误原因
- `correctSolution`: 正确解法
- `imagePaths`: 图片路径数组
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

### Methodology（学习方法论）
- `id`: UUID
- `title`: 标题
- `category`: 分类
- `content`: 内容
- `examples`: 示例
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

## 💾 数据存储位置

- **结构化数据**: `~/Library/Application Support/StudyMathMac/`
- **图片文件**: `~/Library/Application Support/StudyMathMac/Images/{错题ID}/`
- **用户设置**: `~/Library/Preferences/com.yourname.StudyMathMac.plist`

## 🔒 隐私和安全

- 所有数据存储在本地，不上传到云端
- 豆包API密钥存储在系统钥匙串中（通过UserDefaults）
- 图片文件采用JPEG格式，默认压缩质量80%

## 🎯 使用场景

1. **日常错题记录**: 拍照/粘贴题目图片，使用AI识别文字，快速录入
2. **错题复习**: 按难度、掌握程度筛选，重点攻克薄弱环节
3. **方法总结**: 记录解题方法和思维技巧
4. **学习统计**: 查看错题统计，了解薄弱章节

## 🐛 已知问题

- [ ] 导入导出功能尚未实现
- [ ] 统计图表功能需完善
- [ ] 公式渲染支持需要集成MathJax

## 📝 开发计划

- [x] Phase 1: 基础框架和数据模型
- [x] Phase 2: 错题管理功能
- [x] Phase 3: 图片管理和AI识别
- [x] Phase 4: 方法论管理
- [ ] Phase 5: 导入导出功能
- [ ] Phase 6: 统计分析和可视化
- [ ] Phase 7: iCloud同步支持

## 🤝 贡献

这是一个个人学习项目，暂不接受外部贡献。

## 📄 许可证

私有项目，仅供个人学习使用。

## 📮 反馈

如有问题或建议，请通过以下方式联系：
- 在项目目录中创建issue
- 或直接修改代码进行改进

---

**注意**: 首次运行前，请务必在设置中配置豆包API密钥！
