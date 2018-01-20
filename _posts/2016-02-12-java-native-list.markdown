---
layout: post
title: "java native方法列表"
date: 2016-02-12 12:40:08 +0800
comments: true
categories: 
- java
---

想了解一下JDK里有多少方法是用navtive实现的, 所以统计了下

```java

java.lang.Object.registerNatives();
java.lang.Object.getClass();
java.lang.Object.hashCode();
java.lang.Object.clone();
java.lang.Object.notify();
java.lang.Object.notifyAll();
java.lang.Object.wait(long timeout);

java.lang.String.intern();

java.lang.Throwable.fillInStackTrace();
java.lang.Throwable.getStackTraceDepth();
java.lang.Throwable.getStackTraceElement(int index);

java.lang.Class.registerNatives();
java.lang.Class.forName0(String native, boolean initialize, ClassLoader loader);
java.lang.Class.isInstance(Object obj);
java.lang.Class.isAssignableFrom(Class<?> cls);
java.lang.Class.isInterface();
java.lang.Class.isArray();
java.lang.Class.isPrimitive();
java.lang.Class.getName0();
java.lang.Class.getClassLoader0();
java.lang.Class.getSuperclass();
//.......

java.lang.System.registerNatives();
java.lang.System.setIn0(InputStream);
java.lang.System.setOut0(PrintStream);
java.lang.System.setErr0(PrintStream);
java.lang.System.currentTimeMillis();
java.lang.System.nanoTime();
java.lang.System.arraycopy(Object, int, Object, int, int);
java.lang.System.identityHashCode(Object);
java.lang.System.initProperties(Properties);
java.lang.System.mapLibraryName(String);


java.lang.Thread.registerNatives();
java.lang.Thread.currentThread();
java.lang.Thread.yield();
java.lang.Thread.sleep(long);
java.lang.Thread.start0();
java.lang.Thread.isInterrupted(boolean);
java.lang.Thread.isAlive();
java.lang.Thread.holdsLock(Object);
java.lang.Thread.dumpThreads(Thread[]);
java.lang.Thread.getThreads();
//......

java.lang.reflect.Proxy.defineClass0(ClassLoader, String, byte[], int, int);

```

得出以下结论:

* 这里的Object,Class,Throwable,System,Thread 都是比较底层的功能,都有native的方法
* 直接依赖了包装了native的类, 如
  - Math -> StrictMath
  - File -> FileSystem
  - Socket -> PlainSocketImpl

* java.lang.reflect包里的多数是Pojo, 都是从Class获取到的Pojo, 然后是纯内存操作, 但 Array 比较例外
* 有很多纯内存计算, 没有使用native方法了, 如 
    * String里编码转换
    * Date的api
    * ArrayList, HashMap的API
    * 对象的序列化
    * BigInteger, BigDecimal数字运算
    * 字符串格式化
* System, Thread, Runtime, Process都是系统核心紧密的, 几乎都需要调用至native方法的 
* Class, Object则是语言相关的, 需要操作至字节码, 也几乎都是调用至native方法的
* 还有比较特殊的 sun.misc.Unsafe 类, 主要是互斥锁类的API, 用于concurrent包


而jdk之上, 几乎就很少有native了, 如以下  

* http的实现
* sql,jdbc,log的实现
* 各类app应用


所以总结了下, 涉及native的共几类  

*   系统相关的 System, Runtime, Process, Thread, Unsafe, File, Socket
*   语言相关的 Object, Class, Array, ClassLoader
*   计算密集型的 StrictMath


其实看native源代码是最直观的了, 点击 [http://hg.openjdk.java.net/jdk7u/jdk7u/jdk/file/tip/src/share/native/java/lang/](http://hg.openjdk.java.net/jdk7u/jdk7u/jdk/file/tip/src/share/native/java/lang/)
或
[https://github.com/dmlloyd/openjdk/tree/jdk7u/jdk7u/jdk/src/share/native/java/lang](https://github.com/dmlloyd/openjdk/tree/jdk7u/jdk7u/jdk/src/share/native/java/lang)








