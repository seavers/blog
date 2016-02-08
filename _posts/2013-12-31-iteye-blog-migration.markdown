---
layout: post
title: "iteye 博客迁移"
date: 2013-12-31 15:16:16 +0800
comments: true
categories: 
- octopress
---

之前一直是在iteye上写博客的, 后来建立了本博客系统后, 就希望将博客从iteye上迁移过来

然而iteye上博客的文章太多了, 手动一篇一篇拷贝很不现实, 所以写了个工具来辅助迁移

iteye2markdown是一款博客迁移工具,可以将博客从iteye迁移至octopress

* 此工具会自动下载iteye博客上的所有文章
* 接着会将博客中的bbcode代码转换成markdown
* 下载转换后的markdown可用于octopress,迁移至自己的博客系统上

<!--more-->

使用方式:

* 修改download.rb中的cookie配置, cookie将用于连接iteye.com的后台系统, 下载博客内容
* 修改download.rb中的博客地址
* 使用以下命令
```
ruby download.rb
```
执行下载转换, 结果保存于blog目录中

源代码见:  [github](https://github.com/seavers/iteye2markdown)

核心代码如下:

```
re 'open-uri'
require 'nokogiri'

def process(id, date)
	host = 'http://seavers.iteye.com'
	cookie = ''      #IO.read('cookie.txt')
	agent = 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.14 Safari/537.36'

	html = open(host + '/admin/blogs/' + id + '/edit', 'User-Agent'=>agent, 'Cookie'=>cookie).read
	doc = Nokogiri::HTML(html)

	title = doc.search('#blog_title').attr('value').to_s
	text = doc.search('#editor_body').text
	category = doc.search('#blog_category_list').attr('value').to_s
	tag = doc.search('#blog_tag_list').attr('value').to_s
	

	content = text
		.gsub('[size=xx-large]', '#')
		.gsub('[size=x-large]', '##')
		.gsub('[size=large]', '###')
		.gsub('[size=medium]', '####')
		.gsub('[size=small]', '')
		.gsub('[size=x-small]', '')
		.gsub('[size=xx-small]', '')
		.gsub('[/size]', '')
		.gsub(/\[url=(.*)\](.*)\[\/url\]/, '[\2](\1)')
		.gsub('[url]', '').gsub('[/url]', '')
		.gsub('[b]', '*').gsub('[/b]', '*')
		.gsub('[list]', '').gsub('[/list]', '')
		.gsub('[b]', '*').gsub('[/b]', '*')
		.gsub('[*]', '* ')
		.gsub('[code]', '```').gsub('[ne/code]', '```')
		.gsub(/\[code="(.*)"\]/, '```')


	filename = date[0..9] + '-' + id + '.markdown'
	File.open('blog/' + filename, 'w') { |file|
		file.puts '---'
		file.puts 'layout: post'
		file.puts 'title: "' + title.to_s + '"'
		file.puts 'date: ' + date + ':00 +0800'
		file.puts 'comments: true'
		file.puts 'categories:'
		file.puts '- ' + category.to_s
		file.puts 'tags:'
		tag.split(',').each {|x|
			file.puts '- ' + x
		}
		file.puts '---'

		file.puts ''
		file.puts content 
	}

end

def spider(page)
	agent = 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.14 Safari/537.36'

	url = 'http://seavers.iteye.com/?page='+page.to_s
	html = open(url, 'User-Agent'=>agent)

	doc = Nokogiri::HTML(html)
	doc.search('.blog_main').each {|x|
		id = x.search('h3 a').attr('href').text[/[0-9]+/, 0]
		date = x.search('.blog_bottom .date').text
		puts id + "\t" + date
		process(id, date)
	}

	return doc.search('.pagination a.next_page').length == 0
end

##process('1416013', '2013-12-31 14:01')
(1..100).each {|page|
	break if spider(page)
}

```

