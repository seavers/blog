---
layout: post
title: "octopress deploy"
date: 2013-11-28 22:20:52 +0800
comments: true
categories: 
---

今天准备实现 octopress 的自动部署, 完成以下功能

  * 在github.com提交markdown文件后,自动触发服务器打包更新
  * 服务器打包更新后, 同步至github.io, 以及服务器展示

实现之前, 参考了下这篇, [监听github，自动编译octopress博客](http://imxylz.com/blog/2013/11/27/build-octopress-with-github-hook/), 写的蛮不错的, 不过, 我有不同的几个地方

1. github钩子, 我采用的是ruby, 命名为hook.rb

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
  //system('rake deploy')
  puts ''
}
```

1. 启动为后台进程
```
   nohup ruby hook.rb &
```

1. 在github上绑定webhook, 这是直接连接, 而不是通过nginx代理中转
	在github的项目设置的Service Hooks中添加一个WebHook URLs的钩子 
```
	http://blog.lianghaijun.com:4001/blog-update
```

1. 当github更新,触发hook时, 会自动发请求触发服务器, 执行
```
	git pull
	rake generate
```

1. 那服务器上如何来更新呢, 部署的时候, 是有两种方案的
```
	rake preview
```
	然后nginx再代理转发至preview的端口,
	

1. 另一种方案是, nginx直接请求 _deploy 目录
```
	location /blog/ {
		alias /octopress/_deploy/;
	}
```

1. 当然, 如果想在github.io上部署, 需要再同步至github.io
```
	rake deploy
```
	需要修改刚才的hook.py




















