---
layout: post
title: "ruby 学习笔记"
date: 2014-01-04 21:39:33 +0800
comments: true
categories: 
- ruby
---

<style>
figure.code{width: 48%; display:inline-block}
</style>


学习ruby已经有一段时间了, 抽点时间把常用的语法方法总结一下, 算是入门小笔记吧

<!--more-->

## 简述

* ruby为动态语言,弱类型,一切皆对象(就是可以.)
* ruby没有属性,只有方法,看似属性的,其实都只是其成员变量的读方法
* ruby调用方法时括号可省略, 行尾无分号, return 关键字可省略
* ruby支持[]语法创建变长数组, {}语法创建Hash对象, 支持闭包


## 常用的语法结构

```ruby
#encoding:utf-8
require 'nokogiri'

# comment

return if(i==0)

if(page==0)
	page = 1
end

for i in 0..10
	puts i.to_s + '.'
end

for step in ['one','two','three']
	process(step)
end

list.each do |x|
	puts "echo #{x}"
end

list.each_index { |i|
    puts "echo #{i} -> #{list[i]}"
}

def nilisnull
	nil.to_s === ''
end

case x
when 1..10              #匹配数字
    puts "First branch"
when foobar()           #批量方法返回的值
    puts "Second branch"
when /^hel.*/           #匹配正则表达式
    puts "Third branch"
else  
    puts "Last branch"
end
```


## 方法符号

语法上除了一些常见的顺序,选择,循环,变量,函数,模块,类, 还有一些特有的内容

```ruby
# 查看一个变量可以调用哪些方法
irb(main):108:0> 'string'.methods
=> [:<=>, :==, :===, :eql?, :hash, :casecmp, :+, :*, :%, :[], :[]=, :insert, :length, :size, :bytesize, :empty?, :=~, :match, :succ, :succ!, :next, :next!, :upto, :index, :rindex, :replace, :clear, :chr, :getbyte, :setbyte, :byteslice, :to_i, :to_f, :to_s, :to_str, :inspect, :dump, :upcase, :downcase, :capitalize, :swapcase, :upcase!, :downcase!, :capitalize!, :swapcase!, :hex, :oct, :split, :lines, :bytes, :chars, :codepoints, :reverse, :reverse!, :concat, :<<, :prepend, :crypt, :intern, :to_sym, :ord, :include?, :start_with?, :end_with?, :scan, :ljust, :rjust, :center, :sub, :gsub, :chop, :chomp, :strip, :lstrip, :rstrip, :sub!, :gsub!, :chop!, :chomp!, :strip!, :lstrip!, :rstrip!, :tr, :tr_s, :delete, :squeeze, :count, :tr!, :tr_s!, :delete!, :squeeze!, :each_line, :each_byte, :each_char, :each_codepoint, :sum, :slice, :slice!, :partition, :rpartition, :encoding, :force_encoding, :b, :valid_encoding?, :ascii_only?, :unpack, :encode, :encode!, :to_r, :to_c, :>, :>=, :<, :<=, :between?, :nil?, :!~, :class, :singleton_class, :clone, :dup, :taint, :tainted?, :untaint, :untrust, :untrusted?, :trust, :freeze, :frozen?, :methods, :singleton_methods, :protected_methods, :private_methods, :public_methods, :instance_variables, :instance_variable_get, :instance_variable_set, :instance_variable_defined?, :remove_instance_variable, :instance_of?, :kind_of?, :is_a?, :tap, :send, :public_send, :respond_to?, :extend, :display, :method, :public_method, :define_singleton_method, :object_id, :to_enum, :enum_for, :equal?, :!, :!=, :instance_eval, :instance_exec, :__send__, :__id__]
```

其中:

* 冒号: 用冒号+字符串代表Symbol(名字), 表示创建了一个Symbol对象, 常用于表示方法, 可以参考[这里](http://www.ibm.com/developerworks/cn/opensource/os-cn-rubysbl/index.html)
* 问号: 问号也是方法名的一部分,表示这个方法,返回true或者false
* 叹号: 叹号也是方法名的一部分,表示这个方法,与同名的方法(如gsub,gsub!)功能类似,但此方法会改变对象的内部属性, 相反, 另一个方法则不会修改
* 下划线: 如\_\_send\_\_, \_\_id\_\_, 为特殊命名方式, 因send太常见,可能被覆盖,用\_\_send\_\_可避免



## 字符串操作

```ruby
## 简单
'hello'.length   ## 5
'hello'.start_with?('he')   ## true
'hello'.end_with?('he')     ## false
' hello '.strip             ## 'hello'

# 字符串连接
'hello ' + 'world ' + 3.to_s  ## 'hello world 3'

# 子字符串
'hello world'[3]     ## 'l'
'hello world'[3,5]   ## 'lo wo'
'hello world'[3..5]  ## 'lo '

# 查找
'hello world'.index('orl')   ## 7
'hello world'.index(/[ole]+/)  ## 1

# 替换
'hello world'.gsub('o', 'e')  ## 'helle werld'
'hello world'.gsub(/[a-z]+/, 'ok')   ## 'ok ok'

# 分拆
'hello world'.lines(' ')     ## ["hello ", "world"]
" now's  the time".split(' ')   #=> ["now's", "the", "time"]
"hello".split(//)               #=> ["h", "e", "l", "l", "o"]

```


## 数组操作

```ruby
['one','two','three'].length    ## 3
['one','two','three'].include?('four')   ## false
['1','2','3'] << '4'            ## ['1','2','3','4']
[1,2,3,4][1..3]                 ## [2,3]
[3,2,4,1].sort					## [1,2,3,4]
[1,3,3,4].uniq					## [1,3,4]
['one','two','three'].join(',') ## 'one,two,three'

```

## 函数

```
def process

end
```














