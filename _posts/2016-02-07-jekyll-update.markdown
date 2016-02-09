---
layout: post
title: "升级jekyll"
date: 2016-02-07 15:08:29 +0800
comments: true
categories: 
- jekyll
---


原先博客是使用 octopress 搭建的blog, jekyll版本是0.12
其中一个代码弊端是blog的源码中, source与octopress的部分代码耦合
所以希望能将代码分离, 这里采用直接jekyll的方案

使用jekyll的方案

* jekyll3 需要ruby2.0以上版本,安装总是出错,解决方案

```
sudo ln -sf ~/.rvm/rubies/ruby-2.2.1/bin/ruby /usr/bin/ruby
sudo ln -sf ~/.rvm/rubies/ruby-2.2.1/bin/gem /usr/bin/gem
```

* jekyll3升级了很多基本组件, 也存在很多的不兼容  
   markdown的解析组件有maruku|rdiscount|redcarpet|kramdown, 其中默认移除redcarpet, 采用kramdown
  
   highlighter的解析组件有pygments|coderay|rouge, 其中默认中移除pygments, 采用rouge

* 原先的markdown使用\`\`\`做为code block的符号, 新的kramdown没有默认支持
   * jekyll2中使用 kramdown.input=GFM , 可以继续使用
   * jekyll3.1.1时, 因为bug的原因, 无法支持,  参考 [http://www.tuicool.com/articles/aQ3aqq](http://www.tuicool.com/articles/aQ3aqq) 可以解决
   * 但是\`\`\`前有没有换行符, 对页面的展现, 有着不同的展示方案

 







## 自己遇到的一些bug
* Q: Don't know how to build task 'default'
* A: rake -v 不支持, 应该是 rake -V ,也就是说后面的命令有问题
* Q: jekyll requires Ruby version >= 2.0.0.
* A: rvm是安排在当前用户的, sudo时使用的 /usr/bin/ruby /usr/bin/gem的, 需要修正
      另外: ubuntu的ruby2.0也有问题, 切换至/usr/bin/ruby切换至rvm的2.2时, 问题解决
* Q: ERROR: While executing gem ... (TypeError) no implicit conversion of nil int
* A: 同上














--------

参考文档:
1. [Jekyll kramdown配置](http://www.tuicool.com/articles/rAnmQvB)









