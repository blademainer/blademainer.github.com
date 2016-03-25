title: scala根据Class获取单例（孤立）对象
date: 2015-10-30 17:09:19
tags: 
 - scala
 - object
 - reflect
---
# 开发中遇到的问题
在scala开发过程中，有需要使用Class获取scala单例（孤立）对象的需求，但是直接使用Class.newInstance()是无法获取单例对象的。

# 发现
google之后，在一篇博客：http://blog.csdn.net/zhangjg_blog/article/details/23376465 其中有一个例子：
```scala
object  Test {
	val a = "a string";
	def printString = println(a)
}
```
编译之后可以看到有两个class文件：
> Test$.class
Test.class

也就是说， 这个孤立对象也被编译成一个同名类Test 。 除此之外， 还有一个叫做Test$的类， 这个以$结尾的类就是所谓的虚构类（synthetic class， 《Scala编程》中将之翻译为虚构类） 。
<!--more-->
## 单例对象原理
下面使用javap反编译Test.class , 得到如下结果（去掉了常量池等信息）：
```java
public final class Test
  SourceFile: "Test.scala"
  RuntimeVisibleAnnotations:
    0: #6(#7=s#8)
    ScalaSig: length = 0x3
     05 00 00
  minor version: 0
  major version: 50
  flags: ACC_PUBLIC, ACC_FINAL, ACC_SUPER

{
  public static void printString();
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=1, locals=0, args_size=0
         0: getstatic     #16                 // Field Test$.MODULE$:LTest$;
         3: invokevirtual #18                 // Method Test$.printString:()V
         6: return


  public static java.lang.String a();
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=1, locals=0, args_size=0
         0: getstatic     #16                 // Field Test$.MODULE$:LTest$;
         3: invokevirtual #22                 // Method Test$.a:()Ljava/lang/String;
         6: areturn
}
```
由反编译的结果可以看出：
>源码中的属性a对应一个静态的同名方法a()
源码中的方法printString也对应一个静态的同名方法printString()
静态方法a()调用Test$类中的静态字段MODULE$的a方法
静态方法printString()调用Test$类中的静态字段MODULE$的printString方法

如果用java来描述的话， Test类的逻辑是这样的：
```java
public final class Test{


	public static java.lang.String a(){
		return Test$.MODULE$.a()
	}
	
	public static void printString(){
		Test$.MODULE$.printString()
	}
}
```
下面再看Test类的虚构类Test$的javap反编译结果：
```java
public final class Test$
  SourceFile: "Test.scala"
    Scala: length = 0x0


  minor version: 0
  major version: 50
  flags: ACC_PUBLIC, ACC_FINAL, ACC_SUPER

{
  public static final Test$ MODULE$;
    flags: ACC_PUBLIC, ACC_STATIC, ACC_FINAL

  private final java.lang.String a;
    flags: ACC_PRIVATE, ACC_FINAL

  public static {};
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=1, locals=0, args_size=0
         0: new           #2                  // class Test$
         3: invokespecial #12                 // Method "<init>":()V
         6: return

  public java.lang.String a();
    flags: ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: getfield      #17                 // Field a:Ljava/lang/String;
         4: areturn

  public void printString();
    flags: ACC_PUBLIC
    Code:
      stack=2, locals=1, args_size=1
         0: getstatic     #24                 // Field scala/Predef$.MODULE$:Lscala/Predef$;
         3: aload_0
         4: invokevirtual #26                 // Method a:()Ljava/lang/String;
         7: invokevirtual #30                 // Method scala/Predef$.println:(Ljava/lang/Object;)V
        10: return

  private Test$();
    flags: ACC_PRIVATE
    Code:
      stack=2, locals=1, args_size=1
         0: aload_0
         1: invokespecial #31                 // Method java/lang/Object."<init>":()V
         4: aload_0
         5: putstatic     #33                 // Field MODULE$:LTest$;
         8: aload_0
         9: ldc           #35                 // String a string
        11: putfield      #17                 // Field a:Ljava/lang/String;
        14: return

}
```

### 看一下这个类里的内容：
 首先， 该类中有一个常量字段MODULE$， 它的类型就是当前的虚构类Test$ 。
```java
public static final Test$ MODULE$;
    flags: ACC_PUBLIC, ACC_STATIC, ACC_FINAL
```
编译器在Test$中默认添加了静态初始化方法， 用于对静态字段MODULE$初始化：
```java
 public static {};
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=1, locals=0, args_size=0
         0: new           #2                  // class Test$
         3: invokespecial #12                 // Method "<init>":()V
         6: return
```
源码中的字段a在Test$中对应一个非静态的字段a ， 由于源码中的a是val的， 所以在Test$中对应的a字段是final的
```java
  private final java.lang.String a;
    flags: ACC_PRIVATE, ACC_FINAL
```
在Test$中还有一个成员方法a()与字段a对应， 这个方法的逻辑是返回a的值
```java
  public java.lang.String a();
    flags: ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: getfield      #17                 // Field a:Ljava/lang/String;
         4: areturn
```

源码中的方法printString对应Test$中的printString方法。 这个方法的逻辑是调用方法a()获取字段a的值， 并打印a的值。
```java
  public void printString();
    flags: ACC_PUBLIC
    Code:
      stack=2, locals=1, args_size=1
         0: getstatic     #24                 // Field scala/Predef$.MODULE$:Lscala/Predef$;
         3: aload_0
         4: invokevirtual #26                 // Method a:()Ljava/lang/String;
         7: invokevirtual #30                 // Method scala/Predef$.println:(Ljava/lang/Object;)V
        10: return
```

此外， 编译器在Test$中还加入默认的构造方法， 不过这个构造方法是私有的。 无法为外部调用。如下：
```java
  private Test$();
    flags: ACC_PRIVATE
    Code:
      stack=2, locals=1, args_size=1
         0: aload_0
         1: invokespecial #31                 // Method java/lang/Object."<init>":()V
         4: aload_0
         5: putstatic     #33                 // Field MODULE$:LTest$;
         8: aload_0
         9: ldc           #35                 // String a string
        11: putfield      #17                 // Field a:Ljava/lang/String;
        14: return
```

如果用java代码描述的话，Test$的逻辑是这样的：
```java
public final class Test${
	public static final Test$ MODULE$ = new Test$();

	private final String a = "a string";

 	public String a(){
		return a;
 	}

 	public void printString(){
		println(a());
 	}

 	private Test$(){}
}
```
由此可见
>这个虚构类Test$是单例的。
一方面， 这个类是编译器默认生成的，在Scala代码中无法访问到。 
另一方面， Test$构造器私有了， 只在内部创建了一个对象赋给了静态引用MODULE$ 。 

所以， 在Scala里面称用object关键字修饰的对象是单例对象， 在实现的角度上看， 并不是十分确切。 虽然称之为对象， 但是编译器确实为他生成了一个类， 如上面例子中的object Test ， 编译器确实生成了类Test。 但是这个类中只有静态方法， 即使是一个Scala中的字段， 也对应一个静态方法， 如上例中的字段a 。 这个类中的静态方法会访问虚构类Test$中的静态成员Test$ MODULE$ ，使用这个对象可以调用Test$中的其他成员方法，Test$中的成员和源码中的成员相对应， 只是会为源码中的字段添加同名方法。 主要的处理逻辑实际上是在虚构类Test$中完成的， Test类只是作为一个入口。

下面是看一下Scala是如何实现对单例对象的调用的。 首先写一个Scala的入口类：
```scala
object Main {
  //scala main 
  def main(args : Array[String]){
    Test.printString
  }
}
```

相同的原理， 入口类Main也是单例对象， 实现原理和Test是相同的。 大部分的逻辑都在虚构类Main$中的成员方法main中实现的。反编译 Main$后的结果如下：
```java
public final class Main$
  SourceFile: "Main.scala"
    Scala: length = 0x0
  minor version: 0
  major version: 50
  flags: ACC_PUBLIC, ACC_FINAL, ACC_SUPER

{
  public static final Main$ MODULE$;
    flags: ACC_PUBLIC, ACC_STATIC, ACC_FINAL

  public static {};
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=1, locals=0, args_size=0
         0: new           #2                  // class Main$
         3: invokespecial #12                 // Method "<init>":()V
         6: return

  public void main(java.lang.String[]);
    flags: ACC_PUBLIC
    Code:
      stack=1, locals=2, args_size=2
         0: getstatic     #19                 // Field Test$.MODULE$:LTest$;
         3: invokevirtual #22                 // Method Test$.printString:()V
         6: return

  private Main$();
    flags: ACC_PRIVATE
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #26                 // Method java/lang/Object."<init>":()V
         4: aload_0
         5: putstatic     #28                 // Field MODULE$:LMain$;
         8: return
}
```

用Java代码实现如下：
```java
public final class Main${
	public static final Main$ MODULE$ = new Main$();
	public void main(String[] args){
		Test$.MODULE$.printString();
	}

  	 private Main$(){}
}
```

由此可见， 在Main$中的成员方法main中， 直接调用了Test$.MODULE$.printString()方法， 而绕过了Test类， 这也是合理的， 因为只有Test$才处理相关逻辑。


而Main.class用java代码表示如下：
```java
public final class Main{
	public static void main(String[] args){
		Main$.MODULE$.main(args);
	}
}
```

做一下总结：
>Main.class提供JVM的入口函数， 在入口函数中调用Main$的成员方法main， 而Main$的成员方法main又调用了Test$的成员方法printString来处理相关逻辑， 即打印字符串。 

单例对象的调用方式如下图所示：

![](/images/post/scala-invoke-tree.png)


# 解决问题
## 原理
根据上面的scala单例原理说明，我们可以知道，单例对象的类名是以**$**结束的，并且单例对象是在类定义下面的**MODULE$**字段下。因此，我们只需判断Class是不是以**$**结束，并且在此类下获取**MODULE$**字段值即可

## 实现代码
ReflectionUtil.scala

```scala
/**
 * 反射工具
 * @author  <a href="http://xiongyingqi.com">qi</a>
 * @version 2015-10-21 21:01
 */
object ReflectionUtil {
  val SINGLETON_END_NAME = "$"
  val SINGLETON_FIELD_NAME = "MODULE$"

  /**
   * 根据class获取单例对象（必须是object关键字）
   * @param clazz Class
   * @tparam T 泛型
   * @return T
   * @see http://blog.csdn.net/zhangjg_blog/article/details/23376465
   */
  def getSingleton[T](clazz: Class[T]): Option[T] = {
    if (!clazz.getSimpleName.endsWith(SINGLETON_END_NAME)) {
      println("class name not end with: '" + SINGLETON_END_NAME + "', it's not a singleton object!" +
        "Must declared with 'object'. e.g., object A {}")
      return None
    }

    val field = clazz.getDeclaredField(SINGLETON_FIELD_NAME)
    if (field == null) {
      return None
    }
    val fieldType = field.getType
    if (!fieldType.equals(clazz)) {
      println("fieldType: " + fieldType + " not equals " + clazz)
      return None
    }
    val module: T = field.get(null).asInstanceOf[T]
    Some(module)
  }

  /**
   * test
   * @param args
   */
  def main(args: Array[String]) {
    val o = getSingleton(ReflectionUtil.getClass)
    println(s"ReflectionUtil getSingleton(ReflectionUtil.getClass) =========== ${o.get}")
    println(s"ReflectionUtil =========== $ReflectionUtil")
    assert(getSingleton(ReflectionUtil.getClass).get == ReflectionUtil)
  }
}
```
