---
layout: post
title: "ruby Enumerator"
date: 2014-01-12 17:33:56 +0800
comments: true
categories: 
- ruby
---

之前看到这样的API文档

关于数组Array的

```
map { |item| block } → new_ary click to toggle source
map → Enumerator
Invokes the given block once for each element of self.

Creates a new array containing the values returned by the block.

See also Enumerable#collect.

If no block is given, an Enumerator is returned instead.
```

当时不明白, Array的map方法不带参数时返回 Enumerator, 而Array已经支持各类迭代操作了, 为什么还要返回Enumerator, 与数组的操作有什么区别呢, 当时没有细究, 今天知道了

<!--more-->

我们知道数组是继承自Enumerable的

```
irb(main):077:0> [].class.ancestors
=> [Array, Enumerable, Object, Kernel, BasicObject]
```

数组中的方法, 会比Enumerable多一些数组特色的方法, 如insert,push,pop,fist,last

而Enumerable调用map时, 有一些常用的方法, 无法满足, 比如

```
	[2,3,5,7,9,11].map {|item,index| item+index}
```

map时, 参数中的第一个参数, 为item, 但是不支持索引位置

而像select, count, reject 等方法时, 同样也不支持索引位置

于是Enumerator发挥作用了, 注意这里不是Enumerable

```
irb(main):071:0> [].map.methods - [].methods
=> [:with_index, :with_object, :next_values, :peek_values, :next, :peek, :feed, :rewind]
```

所以
```
irb(main):109:0> [2,3,5,7,9,11].map.with_index {|item,index| item+index}
=> [2, 4, 7, 10, 13, 16]
```

结论: Array中map,select,count,reject时, 如果不带闭包参数, 将返回Enumerator, 这时可继续使用索引参数


这里是ruby的官方文档, [Enumerator的API](http://ruby-doc.org/core-1.9.3/Enumerator.html)















