---
layout: post
title: "octopress 自动部署方案"
date: 2013-11-28 22:20:52 +0800
comments: true
categories: 
- octopress
---

今天准备实现 octopress 的自动部署, 完成以下功能

* 在github.com提交markdown文件后,自动触发服务器打包更新
* 服务器打包更新后, 同步至github.io, 以及服务器展示

<!--more-->

实现之前, 参考了下这篇, [监听github，自动编译octopress博客](http://imxylz.com/blog/2013/11/27/build-octopress-with-github-hook/), 写的蛮不错的
不过, 我的方案, 有些不同的地方

## 钩子
在github的项目设置的Service Hooks中添加一个WebHook URLs的钩子
```
	http://<host>:<port>/blog-update
```
而github钩子, 我采用的是ruby, 命名为hook.rb

```ruby
require 'socket'

server = TCPServer.open 4001
puts "Listening on port " + server.addr[1].to_s

loop {
  client = server.accept()
  while((x = client.gets) != "\r\n")
    puts x
  end

  client.puts "HTTP/1.1 200 OK\r\n\r\nOK"
  client.close
  puts 'OK'

  system('git pull')
  system('rake generate')
  ##system('rake deploy')
  puts ''
}
```
然后启动为后台进程
```
   nohup ruby hook.rb &
```
当github更新时,会触发hook时, 服务器运行ruby代码,执行shell脚本 
```
	git pull
	rake generate
```

## 部署
那服务器上如何来更新呢, 部署的时候, 是有两种方案的,一种是
```
	rake preview
```
然后nginx代理转发至preview的端口

另一种方案是, nginx直接请求 _deploy 目录
```
	location /blog/ {
		alias ~/octopress/public/;
	}
```

## 部署在github上
当然, 如果想在github.io上部署, 需要再同步至github.io, 如在刚才在hook.rb里修改
```
	rake deploy
```
这里要小心,这样改会死循环的. 
deploy会触发git commit, commit再触发hook, hook里再deploy,再commit, 如此死循环
所以需要在hook里判断是master还是source

另一种解决方案, 就是把master与source, 放置在不同git仓库上
这样, 提交source的时候, 就不会触发blog的hook了


















