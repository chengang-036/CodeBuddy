# Xcode项目创建指南

本文档介绍如何在Xcode中手动创建Mac应用项目。

## 创建项目步骤

### 1. 打开Xcode

启动Xcode，选择 `File` > `New` > `Project...`

### 2. 选择项目模板

1. 在模板选择器中，选择 **macOS** 标签
2. 选择 **App** 模板
3. 点击 **Next**

### 3. 配置项目

填写以下信息：

- **Product Name**: `StudyMathMac`
- **Team**: 选择你的开发团队（或选择None）
- **Organization Identifier**: `com.yourname` (根据实际情况填写)
- **Bundle Identifier**: 会自动生成为 `com.yourname.StudyMathMac`
- **Interface**: 选择 **SwiftUI**
- **Language**: 选择 **Swift**
- **Storage**: 勾选 **Use Core Data**
- **Include Tests**: 可选

点击 **Next**

### 4. 选择保存位置

选择 `0015-StudyMathMac` 目录作为项目保存位置，点击 **Create**

## 导入现有文件

项目创建后，需要将现有的Swift文件导入到项目中：

### 方法1：使用Finder拖拽

1. 在Finder中打开项目目录的各个子文件夹（Models, Views, Services等）
2. 将Swift文件拖拽到Xcode的左侧项目导航器中
3. 在弹出的对话框中，确保勾选：
   - ✅ Copy items if needed
   - ✅ Create groups
   - ✅ Add to target: StudyMathMac

### 方法2：使用Add Files

1. 右键点击项目导航器中的 `StudyMathMac` 文件夹
2. 选择 `Add Files to "StudyMathMac"...`
3. 选择要添加的文件或文件夹
4. 确保勾选：
   - ✅ Copy items if needed
   - ✅ Add to targets: StudyMathMac

### 文件组织结构

建议按以下结构组织文件：

```
StudyMathMac
├── StudyMathMacApp.swift
├── ContentView.swift
├── Models/
│   ├── ErrorRecord.swift
│   ├── Methodology.swift
│   └── PersistenceController.swift
├── ViewModels/
│   ├── ErrorViewModel.swift
│   └── MethodologyViewModel.swift
├── Views/
│   └── Components/
│       ├── SidebarView.swift
│       ├── ErrorListView.swift
│       ├── ErrorDetailView.swift
│       ├── ErrorEditView.swift
│       ├── MethodologyListView.swift
│       └── SettingsView.swift
├── Services/
│   ├── ImageManager.swift
│   └── DouBaoService.swift
├── Resources/
│   ├── Assets.xcassets
│   └── StudyMath.xcdatamodeld
└── Info.plist
```

## 配置Core Data模型

1. 在Xcode中打开 `StudyMath.xcdatamodeld` 文件
2. 添加两个Entity：
   - **ErrorRecord**
   - **Methodology**

3. 为每个Entity添加属性（参考已有的xcdatamodel/contents文件）

或者，直接使用项目中已有的 `StudyMath.xcdatamodeld` 目录。

## 配置App Sandbox

如果需要访问文件系统：

1. 选择项目 > Target > **Signing & Capabilities**
2. 点击 `+ Capability` 添加 **App Sandbox**
3. 勾选需要的权限：
   - ✅ User Selected File: Read/Write
   - ✅ Pictures Folder: Read/Write

## 构建和运行

1. 选择目标设备：**My Mac**
2. 点击运行按钮（⌘R）或选择 `Product` > `Run`

## 常见问题

### 问题1：找不到某个类或模块

**解决**：确保所有Swift文件都已添加到项目Target中。在文件检查器中查看 "Target Membership"。

### 问题2：Core Data错误

**解决**：确保 Core Data 模型文件（.xcdatamodeld）已正确添加到项目，并且Entity名称与代码中一致。

### 问题3：图片存储目录权限问题

**解决**：在 App Sandbox 中启用必要的文件访问权限。

## 手动创建项目文件结构

如果你不想使用Xcode创建项目，可以使用以下终端命令：

```bash
cd 0015-StudyMathMac
mkdir -p StudyMathMac.xcodeproj
touch StudyMathMac.xcodeproj/project.pbxproj
```

但推荐使用Xcode图形界面创建，更简单可靠。

## 下一步

项目创建完成后：

1. 在设置中配置豆包API Key和Endpoint ID
2. 运行应用，测试各项功能
3. 根据需要调整UI和功能

## 快捷键参考

- ⌘R - 运行
- ⌘B - 构建
- ⌘. - 停止运行
- ⌘N - 新建文件
- ⌘⇧N - 新建项目
- ⌘⇧K - 清理构建
