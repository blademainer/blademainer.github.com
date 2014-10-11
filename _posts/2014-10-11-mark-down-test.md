---
layout:     code
title:      最终版解决方案：json循环问题（使用javassist增强）：Spring MVC中使用jackson的MixInAnnotations方法动态过滤JSON字段
description: springmvc中，默认使用jackson类返回java bean对象，但是如果存在回路时，会导致jackson输出循环。本文介绍如何通过自定义注解来定义过滤属性，web运行时如何通过AOP捕获Controller的ResponseBody注解的方法然后处理要过滤的属性。
keywords: jackson,json,endless loop,死循环,java,spring-mvc,spring mvc,spring,@ResponseBody,javassist
category: java
tags:
 - java
 - javassist
 - spring-mvc
 - jackson
---

```javascript
  var ihubo = {
    nickName  : "草依山",
    site : "http://jser.me"
  }
```
