---
layout: post
title: "maven war命令参数"
date: 2017-07-13 23:45:00 +0800
comments: true
categories:
- maven
tags:
- maven
---

本文翻译自: http://maven.apache.org/plugins/maven-war-plugin/war-mojo.html

## war:war

**全路径**:
org.apache.maven.plugins:maven-war-plugin:3.1.0:war
**描述**: 构建一个 WAR文件.
**特征**:

 * [必须] 一个maven工程用于执行
 * [必须] artifacts的依赖范围:  compile+runtime
 * 此目标是线程安全的, 支持并行构建
 * 绑定的默认的lifecycle phase: package

<!--more-->

### 必须的参数

|Name|Type|Since|Description|默认值|
|--|--|--|--|--|
|cacheFile|File|2.1-alpha-1|包含webapp结构的文件缓存|${project.build.directory}/war/work/webapp-cache.xml.|
|outputDirectory|String|-|用于输出WAR的目录|${project.build.directory}.|
|warSourceDirectory|File|-|WAR中包含额外文件的单个目录.这里是你放置JSP文件的地方|${basedir}/src/main/webapp.|
|webappDirectory|File|-|构建webapp的目录|${project.build.directory}/${project.build.finalName}.|
|workDirectory|File|-|解压WAR可选相关内容的目录|${project.build.directory}/war/work.|


### 可选参数

|Name|Type|Since|Description|默认值|
|--|--|--|--|--|
|archive|MavenArchiveConfiguration|-|可使用的 archive configuration . 见 [Maven Archiver Reference](http://maven.apache.org/shared/maven-archiver/index.html).|
|archiveClasses|boolean|2.0.1|是否需要创建一个JAR文件用于webapp中的classes. 使用这个可选参数将编译classes打包到一个JAR文件以及classes目录将从webapp中排除.|false|
|attachClasses|boolean|2.1-alpha-2|是否classes(WEB-INF/classes目录中的内容)是否作为一个新增的artifact附加至工程中|默认的附加artifact的标识是 'classes'. 你可以使用 ```<classesClassifier>someclassifier</classesClassifier>``` 参数去更改它如果这个参数是 true, 另一个工程可以通过以下方式来依赖它<br>    ```<dependency><groupId>myGroup</groupId><artifactId>myArtifact</artifactId><version>myVersion</myVersion><classifier>classes</classifier></dependency>``` 默认值是: false.|
|classesClassifier|String|2.1-alpha-2|用于附加 classes artifact 的标识 | 默认值是classes|
|classifier|String|-|一个标识用于添加至产生的WAR中. 如果给定, 则 artifact 则使用一个附件来代替. 这个标识将不会用于工程的JAR文件中, 仅用于这个WAR中  (没明白啥意思)||
|containerConfigXML|File|-|servlet容器的配置文件路. 注意不同的容器文件名可能不同. Apache Tomcat 使用的配置文件命名为 context.xml. 这个文件将被拷贝至 META-INF目录.||
|delimiters|LinkedHashSet|3.0.0|表达式的分隔符列表, 用于过滤资源. 这些分隔符以 'beginToken*endToken' 这样的形式指定. 如果没有 '*' 指定, 这些分隔符将假定开始与结束都相同 所以默认的分隔符可能是下面的形式指定<delimiters><delimiter>${*}</delimiter><delimiter>@</delimiter></delimiters> Since '@' delimiter is the same on both ends, we don't need to specify '@*@' (though we can).|
|dependentWarExcludes|String|-|当做一个WAR的overlay时, 指定的一个逗号分隔的排除列表|默认值是 Overlay.DEFAULT_EXCLUDES|
|dependentWarIncludes|String|-|当做一个WAR的overlay时, 指定的一个逗号分隔的包含列表|默认值是 DEFAULT_INCLUDES|
|escapeString|String|2.1-beta-1|String中的表达式处理不会被替换,  \\${foo} 将换替换为@ ${foo}.|
|escapedBackslashesInFilePath|boolean|2.1-alpha-2|转义插入的值, 使用windows路径 c:\foo\bar will 将被替换为 c:\\foo\\bar.默认值是: false.|
|failOnMissingWebXml|Boolean|2.1-alpha-2|当web.xml丢失时, 决定是否失败此构建. 当构建不依赖于web.xml文件时,设置为false. 如果你在构建一个overlay, 且没有web.xml时, 非常有用|开始于 3.1.0, 如果工程依赖于servlet3.0api或者更新版本, 则这个属性默认为false|
|filteringDeploymentDescriptors|boolean|2.1-alpha-2|过滤部署描述符. 默认不使用|默认值为 false.|
|filters|List|-|在pom.xml的执行过程中, 包含的过滤器 Filters (property files) .| |
|includeEmptyDirectories|boolean|2.4|(no description)|默认值是: false.|
|nonFilteredFileExtensions|List|2.1-alpha-2|一个应该被过滤的文件扩展名列表. 可用于过滤webResources以及覆写.| |
|outputFileNameMapping|String|2.1-alpha-1|当拷贝libraries和TLDs时的文件名映射. 如果没有设置文件映射. (默认的)文件将使用标准名称进行拷贝.|
|overlays|List|2.1-alpha-1|实现覆写. 每个&lt;overlay>元素可以包含:<br>* id (默认值为当前的构建)<br>* groupId (当此项与 artifactId 为空时,当前工程作为他自身的overlay)<br>* artifactId 见上)<br>* classifier<br>* type<br>* includes (字符串pattern的列表)<br>* excludes (字符串pattern的列表)<br>* filtered (默认为 false)<br>* skip (默认为false)<br>* targetPath 默认为 webapp 结构的root)|
|packagingExcludes|String|2.1-alpha-2|用逗号分隔的单词列表, 用于在打包前从WAR中排除. 这个选项可能用于实现WAR包瘦身. 注意你可以使用正则表达式引擎来包含和排除指定的样式, 使用表达式%regex[]. 提示:阅读关于 (?!Pattern).|
|packagingIncludes|String|2.1-beta-1|用逗号分隔的单词列表, 用于在打包前包含至WAR中, 默认是包含所有的. 这个可选项可能用于实现skinny WAR 的案例. 注意你可以使用正式表达式引擎去包含与排除指定的样式,  使用这样的表达式 %regex[].|
|primaryArtifact|boolean|-|在构建时, 这是否是一个主 artifact . 假如你不想在执行中 install or deploy它至本地仓库代替默认的一| 默认值是: true.|
|recompressZippedFiles|boolean|2.3|当zip包(jar,zip等)增加至war时, 是否再次压缩, 再次压缩可能产生更小的文件大小, 但是会显著的增加执行时间|默认值是 true.|
|resourceEncoding|String|2.3|用于拷贝web资源的编码|默认值是 ${project.build.sourceEncoding}.|
|skip|boolean|3.0.0|在你需要的时候, 你可以跳过此插件的执行, 但他不推荐使用, 但也有合适的场景默认值是: false.||User property is: maven.war.skip.|
|supportMultiLineFiltering|boolean|2.4|停止在文件末尾搜索 endToken| 默认值是 false.|
|useCache|boolean|2.1-alpha-1|是否应该使用缓来保存webapp跨多个runs的状态, 这实特性, 所以默认没有启用|默认值是 false.|
|useDefaultDelimiters|boolean|3.0.0|将默认的分隔符增加至自定义的分隔符中, 如果有的话|默认值是 true.|
|useJvmChmod|boolean|2.4|是否使用 jvmChmod代替 cli chmod用于 forking 进程|默认值是true|
|warSourceExcludes|String|-|以逗号分隔的单词列表, 表示当拷贝warSourceDirectory的内容时, 需要排除的||
|warSourceIncludes|String|-|以逗号分隔的单词列表, 表示当拷贝warSourceDirectory的内容时, 需要包含的|默认值 是 ** |
|webResources|Resource[]|-|我们需要传输的webResources 列表||
|webXml|File|-|使用的web.xml文件的路径||
