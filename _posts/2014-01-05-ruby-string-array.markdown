---
layout: post
title: "ruby 字符串与数组"
date: 2014-01-05 18:55:00 +0800
comments: true
categories: 
- ruby
---

ruby的字符串与数组,在API设计上,有很多的相似之处,同时方法广度上,又有所区分,这里还是有很多学问

<!--more-->

字符串在底层上是字符的数组, 同是数组, 我们先从相同点开始

### 比较方法名

让我们先单纯的比较一下

```
'string'.methods.length   ### 161
('string'.methods - Object.new.methods).length   ## 107

[].methods.length         ### 167
([].methods - Object.new.methods).length   ## 113

([].methods & 'string'.methods).length    ## 76
([].methods & 'string'.methods - Object.new.methods).length  ## 22

[].methods & 'string'.methods - Object.new.methods
[:[], :[]=, :concat, :<<, :insert, :length, :size, :empty?, :index, :rindex, :reverse, :reverse!, :delete, :replace, :clear, :include?, :slice, :slice!, :+, :*, :count, :partition]
```

* 字符串共有161个方法,去掉继承后, 剩107个
* 数组共有167个方法,去掉继承后,剩113个 
* 字符串与数组相同的方法,共有76,去掉继承的54个, 只剩22个

让我们来仔细看看这22个方法

* [],[]=, 下标操作
* [],slice,slice! 子字符串,子数组操作
* <<,insert,+,\*       插入操作 
* length,size,count,empty?   大小计算
* index,rindex,include?    查找
* reverse, reverse!  反转
* delete,clear          删除
* partition         拆分 (数组中没找到此方法????)

汇总起来, 就是 增删改查, 子反转,大小


### 字符串

而字符串中去掉数组的方法, 就是真正的字符串操作了
```
irb(main):026:0> 'string'.methods - [].methods
=> [:casecmp, :%, :bytesize, :match, :succ, :succ!, :next, :next!, :upto, :chr, :getbyte, :setbyte, :byteslice, :to_i, :to_f, :to_str, :dump, :upcase, :downcase, :capitalize, :swapcase, :upcase!, :downcase!, :capitalize!, :swapcase!, :hex, :oct, :split, :lines, :bytes, :chars, :codepoints, :prepend, :crypt, :intern, :to_sym, :ord, :start_with?, :end_with?, :scan, :ljust, :rjust, :center, :sub, :gsub, :chop, :chomp, :strip, :lstrip, :rstrip, :sub!, :gsub!, :chop!, :chomp!, :strip!, :lstrip!, :rstrip!, :tr, :tr_s, :squeeze, :tr!, :tr_s!, :delete!, :squeeze!, :each_line, :each_byte, :each_char, :each_codepoint, :sum, :rpartition, :encoding, :force_encoding, :b, :valid_encoding?, :ascii_only?, :unpack, :encode, :encode!, :to_r, :to_c, :>, :>=, :<, :<=, :between?]
```

其中: getbyte,setbyte,byteslice,split,bytes,chars,codepoints,prepend,start_with?,end_with? ,sub,gsub,sub!,gsub!,delete!,each_line,each_byte,each_char,each_codepoint 等等,其实也是围绕这个概念,派生出来的方法,都是在"部分","全体", 在这个概念上生成的方法

而to_i, to_f, hex, < > 等, 这些是属于转换与比较的方法, 另upcase,downcase 是字符串间的转换

除去这个概念后, 与字符串本质有关的方法, 只有encoding,force_encoding 这几个方法了 

所以字符串的方法, 我们可以归结为三类

* 字符数组, 数组的操作方法
* 转换与比较
* 编码相关

### 数组

让我们再来看看数组

```
irb(main):031:0> [].methods - 'string'.methods
=> [:to_a, :to_ary, :at, :fetch, :first, :last, :push, :pop, :shift, :unshift, :each, :each_index, :reverse_each, :find_index, :join, :rotate, :rotate!, :sort, :sort!, :sort_by!, :collect, :collect!, :map, :map!, :select, :select!, :keep_if, :values_at, :delete_at, :delete_if, :reject, :reject!, :zip, :transpose, :fill, :assoc, :rassoc, :-, :&, :|, :uniq, :uniq!, :compact, :compact!, :flatten, :flatten!, :shuffle!, :shuffle, :sample, :cycle, :permutation, :combination, :repeated_permutation, :repeated_combination, :product, :take, :take_while, :drop, :drop_while, :bsearch, :pack, :entries, :sort_by, :grep, :find, :detect, :find_all, :flat_map, :collect_concat, :inject, :reduce, :group_by, :all?, :any?, :one?, :none?, :min, :max, :minmax, :min_by, :max_by, :minmax_by, :member?, :each_with_index, :each_entry, :each_slice, :each_cons, :each_with_object, :chunk, :slice_before, :lazy]
```

我们再来分下组

* 常用的增删改查, 子反转,大小 
* 同样的转换与比较  to_a
* 单项相关,   at,first,last,pop,min,max,take
* 遍历,     each,each_index, collect, map,select, take_while,drop_while,grep,find,find_all,reduce,all?,any?,one?, each_*


### 后续

我们可以看出,在数组中有很多方法,并没有在字符串中体现,字符串中部分数组的方法,必定是最常用

假如,数组里所有的方法,都放在字符串中,虽然行得通,但并不好,相反不好理解, 比如string.grep,实际意义不大

所以我们现在可以理解, 为什么 String 不是直接继承自 Array 了, 因为Array并不是String的核心, String中最核心的应该是别的, 比如字符与编码







































































