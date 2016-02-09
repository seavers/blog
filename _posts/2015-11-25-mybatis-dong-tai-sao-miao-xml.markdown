---
layout: post
title: "mybatis 动态扫描xml"
date: 2014-11-25 08:34:29 +0800
comments: true
categories: 
- mybatis
---

之前在java工程中引入mybatis, 在配置xml时总是这样子的

```xml
	<bean id="userMapper" class="org.mybatis.spring.mapper.MapperFactoryBean">
		<property name="mapperInterface" value="com.company.application.mapper.auth.UserMapper" />
		<property name="sqlSessionFactory" ref="sqlSessionFactory" />
	</bean>
	
	<bean id="permissionMapper" class="org.mybatis.spring.mapper.MapperFactoryBean">
		<property name="mapperInterface" value="com.company.application.mapper.auth.PermissionMapper" />
		<property name="sqlSessionFactory" ref="sqlSessionFactory" />
	</bean>
	
	<bean id="roleMapper" class="org.mybatis.spring.mapper.MapperFactoryBean">
		<property name="mapperInterface" value="com.company.application.mapper.auth.RoleMapper" />
		<property name="sqlSessionFactory" ref="sqlSessionFactory" />
	</bean>
```

系统每增加一个mapper都要去配置一个bean, 这样不仅繁锁,而且多人编辑文件时,容易引起代码冲突

其实可以使用自动扫描的方式去加载所有的mapper文件,方法如下:

```xml
	<bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
		<property name="basePackage" value="com.company.application.mapper" />
		<property name="sqlSessionFactory" ref="sqlSessionFactory" />
	</bean>
```

这个MapperScannerConfigurer是在mybatis-spring包中定义的
引入方法为

```xml
	<dependency>
		<groupId>org.mybatis</groupId>
		<artifactId>mybatis-spring</artifactId>
		<version>1.1.1</version>
	</dependency>
```

如果是 MyBatis-Spring 1.2.0 以上, 还有一种更简单的方法, <mybatis:scan/>
见http://mybatis.github.io/spring/mappers.html    (英文)
或http://mybatis.github.io/spring/zh/mappers.html (中文)





