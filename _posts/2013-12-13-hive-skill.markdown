---
layout: post
title: "hive 常用技巧"
date: 2013-12-13 10:52:07 +0800
comments: true
categories: 
- hive
---

最近在使用hive来处理些大数据,偶有心得,记录之

<!--more-->

建表

```
create external table hive_table (
	id int,
	name string,
	category string,
	tag string
)
PARTITIONED BY (pt string) 
ROW FORMAT DELIMITED
   FIELDS TERMINATED BY ',' 
STORED AS TEXTFILE
```


分组统计

```
select id,name,count(*),
	count(distinct category),collect_set(category),
	count(distinct tag),collect_set(tag)
from hive_table
where pt='20131213'
group by id,name
```

拆分多行

```
select id,name,category_id
from hive_table
lateral view explode(split(category, ',')) category_table as category_id
where pt='20131213'
```

过滤某些行

```
select h.*
from hive_table h
left semi join
girl_names g
on h.name = g.name


```







