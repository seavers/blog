---
layout: post
title: "maven构建archetype多模块工程模板的问题"
date: 2018-09-18 20:40:00 +0800
comments: true
categories: 
- maven
tags:
- archetype
- 多模块工程
- archetype-metadata
---

今天遇到了maven创建archetype多模块工程时的很多问题, 记录一下

#### archetype工程的创建可以参考:
  * [官方入口](http://maven.apache.org/archetype/maven-archetype-plugin/index.html)
  * [官方文档](http://maven.apache.org/archetype/maven-archetype-plugin/examples/create-multi-module-project.html)


#### 问题如下:

* 多模块时生成archetype-metadata.xml的问题
  * 单模块工程时, 可以直接写archetype-metadata.xml文件
  * 多模块工程时, 不可以写archetype-metadata.xml, 因为外层工程没有src目录
  * 解决方案: 多模块工程可以配置出archetype-metadata.xml, 参考 [这里](http://maven.apache.org/archetype/maven-archetype-plugin/examples/create-with-property-file.html)


* 无法拷贝.gitignore文件的问题
  * 参考[这里](https://stackoverflow.com/questions/7981060/maven-archetype-plugin-doesnt-let-resources-in-archetype-resources-through)的解决方案


#### 解决方案如下:
* 将.gitignore改名为__gitignore__
* 创建archetype.properties文件

```
## generate for archetype-metadata.xml
excludePatterns=archetype.properties,*.iml,.idea/,.idea/libraries,logs/,build.sh


## generate .gitignore file
gitignore=.gitignore
```

* 修改pom文件, 多模块工程最外层的pom文件

```
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-resources-plugin</artifactId>
                <version>3.0.2</version>
                <configuration>
                    <addDefaultExcludes>false</addDefaultExcludes>      <!-- 解决复制.gitignore的问题 -->
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-archetype-plugin</artifactId>
                <version>3.0.1</version>
                <configuration>
                    <propertyFile>archetype.properties</propertyFile>   <!-- 解决排除.idea目录的问题 -->
                </configuration>
            </plugin>
        </plugins>
    </build>
```

完美解决以上两个问题
