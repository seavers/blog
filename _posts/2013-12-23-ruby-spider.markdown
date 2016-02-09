---
layout: post
title: "ruby spider"
date: 2013-12-23 21:19:09 +0800
comments: true
categories: 
- ruby
---

最近开始喜欢上研究ruby了,正好手头有一些抓取的需求,正好练练手

在写爬虫时,我们总希望能方便的实现以下功能

* 类似curl的下载模块,提供URL即可获取下载内容
* 方便的网页分析工具,最好能提供类似css selector的元素选择器
* 简单方便的数据处理模块

<!--more-->

写个简单的例子

```
#encoding:utf-8
require 'open-uri'
require 'nokogiri'

def spide
    url = "http://home.photo.qq.com/index.php?mod=activity&act=detail&category_id=1"

    html = open(url).read
    doc = Nokogiri::HTML(html)

    list = doc.search('.photo-list li img')
    list.each { |x|
        src = x.attr('src')
        puts src.gsub(/400/, '800');
    }
end

spide

```

其中:

1. open-uri模块用于实现curl的功能, open后read即可
1. Nokogiri为html分析模块,支持css selector式的元素选择
1. 而ruby本身的特点, 则可快速处理数据

抓到图片URL后,剩下的就容易多了,都下载下来吧~~














