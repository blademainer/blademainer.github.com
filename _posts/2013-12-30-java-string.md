---
layout: code
title: Java String对象的经典问题
description: Java String的经典问题，面试笔试题的经典~
keywords: Java,String,堆栈,String池
category: Java
tags:
 - java
 - string
---
#先来看一个例子，代码如下： 
```java
public class Test {  
    public static void main(String[] args) {  
        String str = "abc";  
        String str1 = "abc";  
        String str2 = new String("abc");  
        System.out.println(str == str1);  
        System.out.println(str1 == "abc");  
        System.out.println(str2 == "abc");  
        System.out.println(str1 == str2);  
        System.out.println(str1.equals(str2));  
        System.out.println(str1 == str2.intern());  
        System.out.println(str2 == str2.intern());  
        System.out.println(str1.hashCode() == str2.hashCode());  
	}  
}
``` 
如果您能对这8个输出结果直接判断出来，下面的分析就不用看了。但是我想还是有很多人对这个String对象这个问题只是表面的理解，下面就来分析一下Java语言String类和对象及其运行机制的问题。 
#做个基础的说明，堆(heap)内存和栈(Stack)内存的问题。
堆和栈的数据结构这里就不解释了。Java语言使用内存的时候，栈内存主要保存以下内容：基本数据类型和对象的引用，而堆内存存储对象，栈内存的速度要快于堆内存。总结成一句话就是：引用在栈而对象在堆。
#Java中的比较有两种，是==和equals()方法，equals()是Object类的方法，定义在Object类中的equals()方法是如下实现的：
```java
public boolean equals(Object obj){  
return (this==obj);  
}
```

#String类重写了equals()方法，改变了这些类型对象相等的原则，即判断对象是否相等依据的原则为判断二者的内容是否相等。
了解以上内容后我们来说说String，String类的本质是字符数组char[]，其次String类是final的，是不可被继承的，这点可能被大多数人忽略，再次String是特殊的封装类型，使用String时可以直接赋值，也可以用new来创建对象，但是这二者的实现机制是不同的。<p>
还有一个String池的概念，Java运行时维护一个String池，池中的String对象不可重复，没有创建，有则作罢。String池不属于堆和栈，而是属于常量池。
#下面分析上方代码的真正含义 
```java
String str = "abc";  
String str1= "abc";  
```

* 第一句的真正含义是在String池中创建一个对象”abc”，然后引用时str指向池中的对象”abc”。
* 第二句执行时，因为”abc”已经存在于String池了，所以不再创建，则str==str1返回true就明白了。
* str1==”abc”肯定正确了，在String池中只有一个”abc”，而str和str1都指向池中的”abc”，就是这个道理。 

```java
String str2 = new String("abc");  
```

这个是Java SE的热点问题，众所周知，单独这句话创建了2个String对象，而基于上面两句，只在栈内存创建str2引用，在堆内存上创建一个String对象，内容是”abc”，而str2指向堆内存对象的首地址。<p>
下面就是str2==”abc”的问题了，显然不对，”abc”是位于String池中的对象，而str2指向的是堆内存的String对象，==判断的是地址，肯定不等了。 <p>
str1.equals(str2)，这个是对的，前面说过，String类的equals重写了Object类的equals()方法，实际就是判断内容是否相同了。<p> 
下面说下intern()方法，在JavaDoc文档中，这样描述了intern()方法：返回字符串对象的规范化表示形式。<p>
怎么理解这句话？实际上过程是这样进行的：该方法现在String池中查找是否存在一个对象，存在了就返回String池中对象的引用。 <p>
那么本例中String池存在”abc”，则调用intern()方法时返回的是池中”abc”对象引用，那么和str/str1都是等同的，和str2就不同了，因为str2指向的是堆内存。 <p>
hashCode()方法是返回字符串内容的哈希码，既然内容相同，哈希码必然相同，那他们就相等了，这个容易理解。 
再看下面的例子： 

```java
public class Test {  
	private static String str = "abc";  
	public static void main(String[] args) {  
		String str1 = "a";  
		String str2 = "bc";  
		String combo = str1 + str2;  
		System.out.println(str == combo);  
		System.out.println(str == combo.intern());  
	}  
}
``` 

这个例子用来说明用+连接字符串时，实际上是在堆内容创建对象，那么combo指向的是堆内存存储”abc”字符串的空间首地址，显然str==combo是错误的，而str==combo.intern()是正确的，在String池中也存在”abc”，那就直接返回了，而str也是指向String池中的”abc”对象的。<p>
此例说明任何重新修改String都是重新分配内存空间，这就使得String对象之间互不干扰。也就是String中的内容一旦生成不可改变，直至生成新的对象。 <p>
同时问题也来了，使用+连接字符串每次都生成新的对象，而且是在堆内存上进行，而堆内存速度比较慢(相对而言)，那么再大量连接字符串时直接+是不可取的，当然需要一种效率高的方法。<p>
Java提供的StringBuffer和StringBuilder就是解决这个问题的。区别是前者是线程安全的而后者是非线程安全的，StringBuilder在JDK1.5之后才有。不保证安全的StringBuilder有比StringBuffer更高的效率。 <p>
自JDK1.5之后，Java虚拟机执行字符串的+操作时，内部实现也是StringBuilder，之前采用StringBuffer实现。 <p>
欢迎交流，希望对使用者有用。