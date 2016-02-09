---
layout: post
title: "utuntu group"
date: 2013-12-02 14:28:53 +0800
comments: true
categories: 
- ubuntu
---


linux用户管理中, 一直都有分组的概念, 然而我们总感觉使用场景较少, 其实是因为我们不了解

举个例子, 比如

  *  在配置apache,nginx时, htdocs的目录权限, 遇到问题时, 我们总喜欢用 777,
  *  在使用samba, 或者 nfs 或者 ftp 时, 为避免复杂性, 也是 777
  *  是否希望将工作,生活的帐户体系分开, 是否希望, 使用不同的git环境

<!--more-->


## 基础

  *  每个用户都有一个主分组, 以及多个次分组, 即一个用户可以属于多个分组



## 常用命令

分组常用的几个操作

查看自己的分组
```
seavers@seavers:/home/admin$ id
uid=1000(seavers) gid=1000(seavers) groups=1000(seavers),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),109(lpadmin),124(sambashare)
```

查看所有的分组
```
	cat /etc/group
```

查看某个用户所在的分组
```
	groups seavers
```

增加用户到某个分组
```
	usermod seavers -a -G admin 
```



