---
layout: post
title: "告别臃肿与繁琐：纯原生 Swift + SwiftUI 打造 MacBook 专属极简应用商店 DahaiAppStore"
date: 2026-09-18 23:45:00 +0800
comments: true
categories:
- macOS
- 效率工具
tags:
- macOS
- Swift
- SwiftUI
- AppKit
- DahaiAppStore
- 原生开发
---

在日常使用 MacBook 的过程中，管理与安装 macOS 应用一直存在着令人无奈的割裂感：

1. **Mac App Store 限制重重**：由于苹果严格的沙盒机制与审核政策，许多高频使用的开发者工具、系统利器与开源项目根本无法在官方 App Store 上架。
2. **Homebrew 强大却缺乏直观体验**：命令行虽快，但对于多数日常应用，缺少了应用图标、分类索引、版本说明以及下载进度的直观感知。
3. **官网手动下载 DMG/PKG 极为繁琐**：每次找软件都要浏览器搜索官网、下载 DMG、手动挂载、拖拽到 Applications、弹出磁盘镜像，下载目录还堆满了旧安装包，磁盘空间不知不觉被挤爆；想要更新时，往往还要反复刷官网或依赖软件自有的弹窗。
4. **跨平台工具臃肿沉重**：市面上一些第三方的应用管理客户端动辄使用 Electron 打包，内存动辄吞噬数百兆，失去了 macOS 平台应有的轻快与优雅。

为了解决这些痛点，我用 **100% 纯苹果原生技术栈（Swift 6 + SwiftUI + AppKit）** 为 MacBook 量身打造了一款极简的原生 macOS 应用中心——**DahaiAppStore（大海应用商店）**。

![大海 App Store 官方原生图标](/uploads/20260918/dahai-app-store-icon.png)

---

## 一、设计哲学：致敬 Mac App Store 的纯白极简美学

在设计 DahaiAppStore 时，核心原则就是两个字：**克制**。

- **纯白通透的原生视觉**：遵循 macOS 原生 App Store 的设计语言，采用清爽明亮的白底与标准深浅自适应配色，摒弃花里胡哨的霓虹渐变和繁杂装饰，还原最纯正的 Mac 原生质感。
- **经典三栏/双栏导航**：采用现代 SwiftUI 的 `NavigationSplitView` 构建，清晰划分「发现应用」、「已安装」、「下载管理」、「应用录入」四大模块，交互逻辑自然顺手。
- **精心雕琢的矢量 AppIcon**：图标遵循 Apple macOS 官方规范，采用纯正 Squircle 苹果圆角，以深邃大海蓝为主基调，中央融入开启形态的应用宝盒与浪花剪影，右上角缀以星芒，与 macOS Dock 完美相融。
- **贴心的系统级原生交互**：
  - **全局无级字号缩放**：支持 `⌘ +` 放大、`⌘ -` 缩小、`⌘ 0` 重置（80% ~ 145% 自由缩放），并伴随动态悬浮 HUD 提示，关爱大屏与近视阅读体验；
  - **纯正的 macOS 系统菜单栏**：将常用功能和缩放项无缝并入 macOS 顶栏菜单，全中文适配，操作浑然一体。

---

## 二、核心功能亮点：为真实使用场景而生

### 1. 毫秒级本地应用探测与状态感知

DahaiAppStore 会在后台毫秒级扫描 `/Applications` 与 `~/Applications`，深度读取本地每个 `.app` 的 `Info.plist`（通过 `CFBundleIdentifier` 与 `CFBundleShortVersionString` 精准识别）。

根据版本对比与安装状态，卡片和详情页会自动呈现清晰的动作状态：
- **【获取】**：未安装，点击发起下载与自动安装；
- **【打开】**：已安装且为最新版，一键原生拉起应用；
- **【更新】**：检测到云端或源存在更高版本；
- **【下载中】**：显示下载进度条与实时网速。

### 2. “不打断工作流”的人性化更新体验

在常规应用商店里，一旦有新版本，按钮往往强制变为【更新】，如果你此时正好要急着用该应用处理工作，升级过程就会无情打断你的节奏。

DahaiAppStore 特别设计了**双操作并存机制**：
- 当检测到有新版本时，操作栏同时并排呈现高亮蓝色的 **【更新】** 与原生灰色的 **【打开】**。
- 用户既可以随时启动新版本下载，也可以无阻碍直接拉起当前本地安装的版本，绝不强制阻塞当前工作！
- 详情页核心指标栏更有一目了然的 **✨ 最新版本** 与 **💻 本地已装** 对照，透明清晰。

### 3. 三合一敏捷录入工具

一个好用的应用商店，关键在于生态内容的维护成本必须极低。DahaiAppStore 设计了三种灵活录入机制：

1. **Brew 包名一键解析**：输入 cask 包名（如 `visual-studio-code`、`google-chrome`、`iterm2`），系统会自动调用官方 Formulae 接口解析包名、版本、官方直链、主页及描述，一键保存为本地 JSON 并可直接发起安装；同时支持模糊搜索与多候选包一键切换。
2. **灵活自定义录入（含 Nginx Autoindex 解析）**：支持录入包名、中文名、分类、带 `{version}` 占位符的下载链接。更强大的是，它甚至内置了 Nginx `autoindex on` 目录页爬虫解析器，输入内网或镜像站的版本列表 URL，即可自动爬取提取历史多版本！
3. **标准 JSON 导入与模板**：界面内置规范的 JSON 格式模板与一键复制功能，支持在文本框中直接粘贴单条/批量配置，或从本地 `.json` 文件批量导入，非常适合团队统一分发内部开发工具套件。

### 4. 全生命周期下载与安装包缓存管理

传统的下载通常把一堆 `.dmg`、`.pkg` 堆在“下载”文件夹，长年累月占用几十上百 G 硬盘。DahaiAppStore 对此做了完整闭环：

- **精准下载引擎**：基于原生 `URLSessionDownloadDelegate`，实时计算已下载大小、总大小、百分比进度条与实时网速（KB/s、MB/s），支持暂停、重试与取消。
- **全自动安装驱动**：
  - **DMG**：自动通过系统命令无感知挂载，将内部 `.app` 同步拷贝至 `/Applications`，安装完成后自动弹出/卸载虚拟盘；
  - **PKG**：自动调用系统原生 Installer；
  - **ZIP**：自动解压缩并归档至应用目录。
- **独立的安装包管理中心**：将下载的所有安装介质统一缓存管理，清晰展示文件大小与日期，支持一键重新安装、单个删除或多选批量清理，随时释放宝贵的 SSD 磁盘空间。

---

## 三、纯原生技术架构与实现

整个项目采用纯原生 Swift 技术栈开发，不依赖任何庞大的第三方三方包，兼具优雅、轻快与高稳定性：

```text
DahaiAppStore/
├── Package.swift                     # 纯原生 SPM 工程配置
├── Resources/                        # 原生 AppIcon 矢量资源与图标
├── Sources/DahaiAppStore/
│   ├── DahaiAppStoreApp.swift        # App 入口、原生窗口与菜单栏命令
│   ├── Models/
│   │   ├── AppItem.swift             # 应用数据模型（版本、多渠道字段）
│   │   ├── DownloadTaskItem.swift    # 下载任务与实时状态模型
│   │   └── LocalPackage.swift        # 本地安装包缓存模型
│   ├── Services/
│   │   ├── AppStoreService.swift     # 软件源管理、JSON 持久化存储
│   │   ├── InstalledDetector.swift   # 本地 /Applications 扫描与版本比对引擎
│   │   ├── BrewService.swift         # Homebrew Cask API 解析器与模糊匹配
│   │   ├── NginxIndexParser.swift    # Nginx autoindex HTML 版本爬虫
│   │   ├── DownloadManager.swift     # 原生 URLSession 下载引擎
│   │   └── InstallerService.swift    # DMG 挂载拷贝 / PKG / ZIP 自动化安装器
│   └── Views/
│       ├── MainView.swift            # 侧边栏与主分栏视图
│       ├── AppListView.swift         # 应用卡片市场列表与已安装筛选
│       ├── AppDetailView.swift       # 详情页、历史版本切换与核心指标栏
│       ├── AppImportView.swift       # 三合一录入面板
│       ├── DownloadsView.swift       # 下载进度面板与安装包清理中心
│       └── Components/               # 字体缩放 HUD、状态胶囊等纯原生组件
```

### 为什么坚持纯原生技术栈？
- **零冷启动延迟**：双击即可毫秒级打开，无需等待 JavaScript 运行时或 Chromium 内核初始化；
- **超低内存占用**：常驻内存仅需几十兆，对 MacBook 续航和资源消耗极其友好；
- **天然的系统一致性**：无论是动画曲线、焦点状态、键盘快捷键还是系统外观切换，都具备 100% 原汁原味的 macOS 质感。

---

## 四、写在最后

在跨平台框架盛行的今天，为特定平台量身打磨一款纯原生的工具，依然有着不可替代的乐趣与体验优势。

DahaiAppStore 将 Homebrew 的庞大软件生态、私有源的灵活分发能力，以及 Mac App Store 的优雅视觉体验融为一体，让 MacBook 上的应用安装与版本管理重归简单、纯净与高效。
