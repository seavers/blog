---
layout: post
title: "ruby语法糖 - 多返回值"
date: 2014-01-19 13:01:18 +0800
comments: true
categories: 
- ruby
---

前几天写代码的时候, 使用到了ruby的多返回值, 觉得很值得写一写

记得第一次看见多返回值, 是在lua中, 当时觉得不过是一语法糖, 没什么特别的, 并不会带来什么特别的好处, 就没有细细研究下去

多返回值, 比较经典的使用场景是交换数值, 最常用于排序等各类算法中, 比如

```ruby
	list[i],list[j] = list[j], list[i]
	width, height = height, width
```

而实际中, 我碰到的使用场景是这样的, 解析一个文本文件 

常见的写法这样的

```ruby
    IO.read('20140119_result.txt').lines.each { |line|
        words = line.split(',')
        id = words[0]
        name = words[1]
        type = words[2]
        status = words[3]
        
        puts "[#{status}] #{name}/#{id}" if type == 1
    }   
```

如果用多返回值, 效果就完全不同了, 而且达到了相同的效果

```
	IO.read('20140119_result.txt').lines.each { |line|
		id,name,type,status = line.split(',')
		puts "[#{status}] #{name}/#{id}" if type == 1
	}
```


在java中, 经常见一些让我很痛苦的写法, 如

```java
	Result<PairValue> result = NoSql.getValue(key);
	if(!result.isSuccess || result.getResult() == null || result.getResult().getValue() == null) {
		logger.error("......", result.getError());
	}
	Model model = result.getResult().getValue();
```

单独看这行代码, 你觉得无所谓, 但是一个方法里, 只有四行逻辑, 但却有16行代码,其中12个是这种判断,你就是发疯了,看代码太累了,无法直接看到主要的逻辑

```ruby
	model, key, err = NoSql.getValue(key);
	logger.error("....", err) if err

	List, err = Service.query(model.itemIds)
	logger.error("....", err) if err
```

纵观代码, 会把注意力集中到业务逻辑上, 而不是各种返回结果的判断上


## 本质

让我们来看看, ruby多返回值的本质

```ruby
	def multi
		return 1,2,3,4,5,6
	end
	result = multi
	puts result.class   ## Array
	puts result === [1,2,3,4,5,6]  ## true 
```

我们发现, 原来ruby的多返回值就是一个数组, 而且

* x=1,2,3,4,5,6 与 x=[1,2,3,4,5,6]  写法是一样的,结果也一样
* x,y=1,2,3,4,5,6 与 x,y=[1,2,3,4,5,6]  写法也是一样的,结果也一样
* 不一样的一点是   [1,2,3,4,5,6].class 与  (1,2,3,4,5,6).class 是不一样的, 后面会报语法错误
* 因此, 不带中括号, 其实是一种简写的方式, 只是有些地方能简单, 有些地方无法简写
* 从另一个角度来看, []其实也是一种运算符号, 与()一样, 是为了提高运算符的优先级



