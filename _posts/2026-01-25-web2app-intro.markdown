---
layout: post
title: "Web2App: 一键将任意网站生成 Android APP"
date: 2026-01-25 16:50:00 +0800
comments: true
categories:
- 工具
tags:
- Android
- Web2App
- APK
---

今天开发上线了一个新工具：[Web2App](https://github.com/seavers/web2app)，可以访问在线演示地址：[web2app.dahai.online](http://web2app.dahai.online)。

## 什么是 Web2App？

Web2App 是一个可以将任意网站一键生成为 Android APP 的工具。你只需要输入网址、标题，并上传一个可选的图标，就可以生成一个专属于该网站的 Android APP。

## 核心原理

Web2App 的核心在于使用了“预生成 APK + 动态修改”的技术：

1.  **预生成 APK**：系统预先准备好一个通用的 APK 模板。
2.  **动态解压**：当用户提交请求时，系统会在后台解压这个预生成的 APK。
3.  **替换配置**：将用户输入的 URL、标题和图标等信息替换到 APK 的配置文件和资源中。
4.  **再签名打包**：最后，系统重新打包并对 APK 进行签名，生成最终的安装包。

这种方式大大提高了生成效率，无需为每个请求重新编译整个项目。

欢迎大家试用并反馈！ GitHub 地址：[https://github.com/seavers/web2app](https://github.com/seavers/web2app)

另外，感慨一句：AI编程速度真快，这个文章也是AI写的
