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

最终解决方法：[【完美解决json循环问题（使用javassist增强）：Spring MVC中使用jackson的MixInAnnotations方法动态过滤JSON字段】](/java/2013/12/06/spring-mvc-jackson.html)
===

#问题描述

###项目使用SpringMVC框架，并用jackson库处理JSON和POJO的转换。在POJO转化成JSON时，有些属性我们不需要输出或者有些属性循环引用会造成无法输出。

* 例如：实体User其中包括用户名、密码、邮箱等，但是我们在输出用户信息不希望输出密码、邮箱信息;
* 例如：实体user和department是多对一的关系，user内保存着department的信息，那么json输出时会导致这两个实体数据的循环输出;

jackson默认可以使用JsonIgnoreProperties接口来定义要过滤的属性,然后使用`ObjectMapper#addMixInAnnotations`来设置对应实体对应的JsonIgnoreProperties接口,这样就能达到过滤的目的。可是这样很不爽,因为如果你对n个实体对应有m种过滤需求就至少要建n*m个JsonIgnoreProperties接口。

#解决方案

##主要逻辑如下图

<img src="/images/post/jackson-logic.jpg">

##大致处理流程:

* 使用自定义注解controller方法
* 然后定义aop捕获所有controller方法
* 当aop捕获到controller方法时调用JavassistFilterPropertyHandler#filterProperties方法
* filterProperties读取注解并根据自定义注解使用javassist创建JsonIgnoreProperties临时实现类(同时缓存到map内,下次可直接取出)并存入当前线程内(ThreadJacksonMixInHolder, 使用threadlocal实现),
* 在springmvc输出json的类内自定义ObjectMapper, 从当前线程内取出JsonIgnoreProperties临时类, 调用ObjectMapper# addMixInAnnotations使之起效
* 最后使用ObjectMapper输出

#用法:
##`1、定义aop, 用来捕获springmvc的controller方法`

```java
package com.xiongyingqi.json.filter.aop;

import com.xiongyingqi.jackson.FilterPropertyHandler;
import com.xiongyingqi.jackson.impl.JavassistFilterPropertyHandler;
import org.apache.log4j.Logger;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;

import java.lang.reflect.Method;

/**
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-9-27 下午5:41:12
 */
@Aspect
public class IgnorePropertyAspect {
    public static final Logger LOGGER = Logger.getLogger(IgnorePropertyAspect.class);

    @Pointcut("execution(* com.kingray.web.*.*(..))")
    private void anyMethod() {

    }

    @Around("anyMethod()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        Object returnVal = pjp.proceed(); // 返回源结果
        try {
            FilterPropertyHandler filterPropertyHandler = new JavassistFilterPropertyHandler(true);
            Method method = ((MethodSignature) pjp.getSignature()).getMethod();
            returnVal = filterPropertyHandler.filterProperties(method, returnVal);
        } catch (Exception e) {
            LOGGER.error(e);
            e.printStackTrace();
        }

        return returnVal;
    }

    @AfterThrowing(pointcut = "anyMethod()", throwing = "e")
    public void doAfterThrowing(Exception e) {
        System.out.println(" -------- AfterThrowing -------- ");
    }
}
```

##2、spring配置

```xml
<!-- 启动mvc对aop的支持,使用aspectj代理 -->
<aop:aspectj-autoproxyproxy-target-class="true" />
<beanid="ignorePropertyAspect" class="com.xiongyingqi.json.filter.aop.IgnorePropertyAspect"></bean>
```

##3、配置spring-mvc的messageconverter

```xml
    <bean
    	class="org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter">
		<property name="cacheSeconds" value="0" />
		<!--日期格式转换 -->
		<property name="webBindingInitializer">
			<bean class="com.kingray.spring.http.convert.DateConverter" />
		</property>
		<property name="messageConverters">
			<list>
				<bean
					class="com.xiongyingqi.spring.http.convert.json.Jackson2HttpMessageConverter">
				</bean>
				<bean
					class="com.xiongyingqi.spring.http.convert.json.JacksonHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.BufferedImageHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.ResourceHttpMessageConverter">
				</bean>
				<bean class="org.springframework.http.converter.FormHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.support.AllEncompassingFormHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.xml.Jaxb2RootElementHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.feed.AtomFeedHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.feed.RssChannelHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.xml.Jaxb2CollectionHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.xml.SourceHttpMessageConverter">
				</bean>
				<bean
					class="org.springframework.http.converter.ByteArrayHttpMessageConverter">
				</bean>
			</list>
		</property>
		
	</bean>
```

##4、重写spring的MappingJackson2HttpMessageConverter类,这样输出的json内容就能自定义

```java
package com.xiongyingqi.spring.http.convert.json;

import java.io.IOException;

import com.xiongyingqi.jackson.helper.ThreadJacksonMixInHolder;
import org.springframework.http.HttpOutputMessage;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

/**
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-9-27 下午4:05:46
 */
public class Jackson2HttpMessageConverter extends MappingJackson2HttpMessageConverter {
    private ObjectMapper objectMapper = new ObjectMapper();
    private boolean prefixJson = false;


    /**
     * <br>
     * 2013-9-27 下午4:10:28
     *
     * @see org.springframework.http.converter.json.MappingJacksonHttpMessageConverter#writeInternal(Object,
     * org.springframework.http.HttpOutputMessage)
     */
    @Override
    protected void writeInternal(Object object, HttpOutputMessage outputMessage)
            throws IOException, HttpMessageNotWritableException {
        // super.writeInternal(object, outputMessage);

        // 判断是否需要重写objectMapper
        ObjectMapper objectMapper = this.objectMapper;// 本地化ObjectMapper，防止方法级别的ObjectMapper改变全局ObjectMapper
        if (ThreadJacksonMixInHolder.isContainsMixIn()) {
            objectMapper = ThreadJacksonMixInHolder.builderMapper();
        }

        JsonEncoding encoding = getJsonEncoding(outputMessage.getHeaders().getContentType());
        JsonGenerator jsonGenerator = objectMapper.getFactory().createGenerator(
                outputMessage.getBody(), encoding);

        // A workaround for JsonGenerators not applying serialization features
        // https://github.com/FasterXML/jackson-databind/issues/12
        if (objectMapper.isEnabled(SerializationFeature.INDENT_OUTPUT)) {
            jsonGenerator.useDefaultPrettyPrinter();
        }

        try {
            if (this.prefixJson) {
                jsonGenerator.writeRaw("{} && ");
            }
            objectMapper.writeValue(jsonGenerator, object);
        } catch (JsonProcessingException ex) {
            throw new HttpMessageNotWritableException("Could not write JSON: " + ex.getMessage(),
                    ex);
        }
        // JsonEncoding encoding =
        // getJsonEncoding(outputMessage.getHeaders().getContentType());
        // JsonGenerator jsonGenerator =
        // this.objectMapper.getJsonFactory().createJsonGenerator(outputMessage.getBody(),
        // encoding);
        //
        // // A workaround for JsonGenerators not applying serialization
        // features
        // // https://github.com/FasterXML/jackson-databind/issues/12
        // if (this.objectMapper.isEnabled(SerializationFeature.INDENT_OUTPUT))
        // {
        // jsonGenerator.useDefaultPrettyPrinter();
        // }
        //
        // try {
        // if (this.prefixJson) {
        // jsonGenerator.writeRaw("{} && ");
        // }
        // this.objectMapper.writeValue(jsonGenerator, object);
        // }
        // catch (JsonProcessingException ex) {
        // throw new HttpMessageNotWritableException("Could not write JSON: " +
        // ex.getMessage(), ex);
        // }
    }

    public boolean isPrefixJson() {
        return prefixJson;
    }

    public void setPrefixJson(boolean prefixJson) {
        this.prefixJson = prefixJson;
    }

}
```

##5、在方法上注解
#Controller方法的示例，yxResourceSelfRelationsForSuperiorResourceId是YxResource内要过滤的属性:
```java
    @IgnoreProperties(value= {
           @IgnoreProperty(pojo = YxResource.class, name = {
                  "yxResourceSelfRelationsForSuperiorResourceId"})})
   @RequestMapping(value = "/{resourceId}", method = RequestMethod.GET)
   @ResponseBody
   public Object getResourceByResourceId(@PathVariable Integer resourceId) {
       YxResource resource = resourceService.getResource(resourceId);
       return resource;
    }
```    

#主要类说明    
##1、自定义注解类：这些类是用于注解实体类输出json时要注解过滤的属性
###IgnoreProperties.java 用于同时注解`IgnoreProperty`和`AllowProperty`

```java
package com.xiongyingqi.jackson.annotation;

import java.lang.annotation.*;

/**
 * json属性过滤注解，对于同一个pojo来说 @AllowProperty 是与 @IgnoreProperty 是冲突的，如果这两个注解注解了<br>
 * 例如以下代码YxResource实体只会显示resourceName和resourceDescribe属性
 * <p/>
 * <pre>
 * @IgnoreProperties(
 *     value = {
 * 		@IgnoreProperty(
 * 			pojo = YxResource.class,
 * 			name = {
 * 				"yxResourceDataRelations",
 * 				"yxResourceSelfRelationsForSublevelResourceId",
 * 				"yxPermisionResourceRelations" }),
 * 		@IgnoreProperty(
 * 			pojo = YxResourceSelfRelation.class,
 * 			name = {
 * 				"yxResourceBySuperiorResourceId",
 * 				"id" })
 *    },
 * 	allow = {
 * 	@AllowProperty(
 * 			pojo = YxResource.class,
 * 			name = { "<b><i>resourceName</i></b>" }) })
 * 	@AllowProperty(
 * 			pojo = YxResource.class,
 * 			name = { "<b><i>resourceDescribe</i></b>" })
 * </pre>
 * <p/>
 * <p/>
 * 但是，对于同一个pojo的同一属性来说@AllowProperty是与@IgnoreProperty则会按照@IgnoreProperty过滤的属性名过滤
 * 例如以下代码YxResource实体不会显示resourceName属性的值
 * <p/>
 * <pre>
 * @IgnoreProperties(
 * 	value = {
 * 	@IgnoreProperty(
 * 			pojo = YxResource.class,
 * 			name = { "<b><i>resourceName</i></b>",
 * 				"yxResourceDataRelations",
 * 				"yxResourceSelfRelationsForSublevelResourceId",
 * 				"yxPermisionResourceRelations" }),
 * 	@IgnoreProperty(
 * 			pojo = YxResourceSelfRelation.class,
 * 			name = {
 * 				"yxResourceBySuperiorResourceId",
 * 				"id" })
 *    },
 * 	allow = {
 * 	@AllowProperty(
 * 			pojo = YxResource.class,
 * 			name = { "<b><i>resourceName</i></b>" }) })
 * </pre>
 *
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-9-27 下午4:18:39
 */
@Documented
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface IgnoreProperties {
    /**
     * 要过滤的属性
     *
     * @return
     */
    IgnoreProperty[] value() default @IgnoreProperty(pojo = Object.class, name = "");

    /**
     * 允许的属性
     *
     * @return
     */
    AllowProperty[] allow() default @AllowProperty(pojo = Object.class, name = "");
}
```

###`IgnoreProperty.java`：过滤指定对象内的指定字段名

```java
package com.xiongyingqi.jackson.annotation;

import java.lang.annotation.*;

/**
 * 用于注解json过滤pojo内的属性，其他的属性都会被序列化成字符串
 *
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-9-27 下午4:24:33
 */
@Documented
@Target({ElementType.TYPE, ElementType.METHOD, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface IgnoreProperty {
    /**
     * 要忽略字段的POJO <br>
     * 2013-9-27 下午4:27:08
     *
     * @return
     */
    Class<?> pojo();

    /**
     * 要忽略的字段名 <br>
     * 2013-9-27 下午4:27:12
     *
     * @return
     */
    String[] name();

    /**
     * 字段名，无论是哪种 <br>
     * 2013-9-27 下午4:27:15
     *
     * @return
     */
    //    String value() default "";

    /**
     * 最大迭代层次<br>
     * 当注解了pojo和name值时，该值表示遍历bean属性的最大曾次数，此注解一般用于自关联的bean类，
     * 如果循环层次大于等于maxLevel时则不再读取属性<br>
     * 如果maxIterationLevel为0，则不限制迭代层次<br>
     * 如果maxIterationLevel为1，则迭代读取属性一次<br>
     * 2013-10-21 下午2:16:26
     *
     * @return
     */
    //	int maxIterationLevel() default 0;
}
```

###`AllowProperty.java`：注解实体类允许的字段

```java
package com.xiongyingqi.jackson.annotation;

import java.lang.annotation.*;

/**
 * 只允许pojo内的属性序列化成json，对于同一个pojo该注解是与IgnoreProperty是冲突的<br>
 *
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-10-30 下午3:57:35
 */
@Documented
@Target({ElementType.TYPE, ElementType.METHOD, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface AllowProperty {
    /**
     * 目标POJO <br>
     * 2013-9-27 下午4:27:08
     *
     * @return
     */
    Class<?> pojo();

    /**
     * 允许序列化的属性名 <br>
     * 2013-9-27 下午4:27:12
     *
     * @return
     */
    String[] name();
}
```
##2、核心处理类，用于处理自定义注解并将生成的类存入当前线程

```java
package com.xiongyingqi.jackson.impl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiongyingqi.jackson.FilterPropertyHandler;
import com.xiongyingqi.jackson.annotation.AllowProperty;
import com.xiongyingqi.jackson.annotation.IgnoreProperties;
import com.xiongyingqi.jackson.annotation.IgnoreProperty;
import com.xiongyingqi.jackson.helper.ThreadJacksonMixInHolder;
import com.xiongyingqi.util.EntityHelper;
import com.xiongyingqi.util.StringHelper;
import javassist.CannotCompileException;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.bytecode.AnnotationsAttribute;
import javassist.bytecode.ClassFile;
import javassist.bytecode.ConstPool;
import javassist.bytecode.annotation.*;
import org.apache.log4j.Logger;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ResponseBody;

import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.util.*;
import java.util.Map.Entry;

//@IgnoreProperty(pojo = YxUserRoleRelation.class, name = { "id", "yxUser" })

/**
 * 使用代理来创建jackson的MixInAnnotation注解接口<br>
 * 如果使用本实现方法，一定要配置在web.xml中配置过滤器WebContextFilter，否则无法输出json到客户端
 *
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-10-25 下午2:31:21
 */
public class JavassistFilterPropertyHandler implements FilterPropertyHandler {

    public static final Logger LOGGER = Logger.getLogger(JavassistFilterPropertyHandler.class);

    /**
     * 注解的方法对应生成的代理类映射表
     */
    private static Map<Method, Map<Class<?>, Class<?>>> proxyMethodMap = new HashMap<Method, Map<Class<?>, Class<?>>>();

    /**
     * String数组的hashCode与生成的对应的代理类的映射表
     */
    private static Map<Integer, Class<?>> proxyMixInAnnotationMap = new HashMap<Integer, Class<?>>();

    private static String[] globalIgnoreProperties = new String[]{"hibernateLazyInitializer",
            "handler" };

    /**
     * 如果是标注的SpringMVC中的Controller方法，则应判断是否注解了@ResponseBody
     */
    private boolean isResponseBodyAnnotation;
    /**
     * 创建代理接口的唯一值索引
     */
    private static int proxyIndex;

    public JavassistFilterPropertyHandler() {
    }

    public JavassistFilterPropertyHandler(String[] globalIgnoreProperties) {
        JavassistFilterPropertyHandler.globalIgnoreProperties = globalIgnoreProperties;
    }

    /**
     * @param isResponseBodyAnnotation 如果是标注的SpringMVC中的Controller方法，则应判断是否注解了@ResponseBody
     */
    public JavassistFilterPropertyHandler(boolean isResponseBodyAnnotation) {
        this.isResponseBodyAnnotation = isResponseBodyAnnotation;
    }

    /**
     * <br>
     * 2013-10-28 上午11:11:24
     *
     * @param collection
     * @param names
     * @return
     */
    private Collection<String> checkAndPutToCollection(Collection<String> collection, String[] names) {
        if (collection == null) {
            collection = new HashSet<String>();
        }
        Collections.addAll(collection, names);
        return collection;
    }

    private Collection<String> putGlobalIgnoreProperties(Collection<String> collection) {
        if (globalIgnoreProperties != null) {
            if (collection == null) {
                collection = new HashSet<String>();
            }
            for (int i = 0; i < globalIgnoreProperties.length; i++) {
                String name = globalIgnoreProperties[i];
                collection.add(name);
            }
        }
        return collection;
    }

    /**
     * 处理IgnoreProperties注解 <br>
     * 2013-10-30 下午6:15:41
     *
     * @param properties
     * @param pojoAndNamesMap
     */
    private void processIgnorePropertiesAnnotation(IgnoreProperties properties,
                                                   Map<Class<?>, Collection<String>> pojoAndNamesMap) {
        IgnoreProperty[] values = properties.value();

        AllowProperty[] allowProperties = properties.allow();

        if (allowProperties != null) {
            for (AllowProperty allowProperty : allowProperties) {
                processAllowPropertyAnnotation(allowProperty, pojoAndNamesMap);
            }
        }

        if (values != null) {
            for (IgnoreProperty property : values) {
                processIgnorePropertyAnnotation(property, pojoAndNamesMap);
            }
        }

    }

    /**
     * 处理IgnoreProperty注解 <br>
     * 2013-10-30 下午6:16:08
     *
     * @param property
     * @param pojoAndNamesMap
     */
    private void processIgnorePropertyAnnotation(IgnoreProperty property,
                                                 Map<Class<?>, Collection<String>> pojoAndNamesMap) {
        String[] names = property.name();
        Class<?> pojoClass = property.pojo();
        // Class<?> proxyAnnotationInterface = createMixInAnnotation(names);//
        // 根据注解创建代理接口

        Collection<String> nameCollection = pojoAndNamesMap.get(pojoClass);
        nameCollection = checkAndPutToCollection(nameCollection, names);
        pojoAndNamesMap.put(pojoClass, nameCollection);
    }

    /**
     * 处理AllowProperty注解 <br>
     * 2013-10-30 下午6:16:08
     *
     * @param property
     * @param pojoAndNamesMap
     */
    private void processAllowPropertyAnnotation(AllowProperty property,
                                                Map<Class<?>, Collection<String>> pojoAndNamesMap) {
        String[] allowNames = property.name();
        Class<?> pojoClass = property.pojo();

        Collection<String> ignoreProperties = EntityHelper
                .getUnstaticClassFieldNameCollection(pojoClass);

        Collection<String> allowNameCollection = new ArrayList<String>();
        Collections.addAll(allowNameCollection, allowNames);

        Collection<String> nameCollection = pojoAndNamesMap.get(pojoClass);
        if (nameCollection != null) {
            nameCollection.removeAll(allowNameCollection);
        } else {
            ignoreProperties.removeAll(allowNameCollection);
            nameCollection = ignoreProperties;
        }
        pojoAndNamesMap.put(pojoClass, nameCollection);
    }

    /**
     * 根据方法获取过滤映射表 <br>
     * 2013-10-25 下午2:47:34
     *
     * @param method 注解了 @IgnoreProperties 或 @IgnoreProperty 的方法（所在的类）
     * @return Map<Class<?>, Collection<Class<?>>> pojo与其属性的映射表
     */
    public Map<Class<?>, Class<?>> getProxyMixInAnnotation(Method method) {
        if (isResponseBodyAnnotation && !method.isAnnotationPresent(ResponseBody.class)) {
            return null;
        }
        Map<Class<?>, Class<?>> map = proxyMethodMap.get(method);// 从缓存中查找是否存在

        if (map != null && map.entrySet().size() > 0) {// 如果已经读取该方法的注解信息，则从缓存中读取
            return map;
        } else {
            map = new HashMap<Class<?>, Class<?>>();
        }

        Class<?> clazzOfMethodIn = method.getDeclaringClass();// 方法所在的class

        Map<Class<?>, Collection<String>> pojoAndNamesMap = new HashMap<Class<?>, Collection<String>>();

        IgnoreProperties classIgnoreProperties = clazzOfMethodIn
                .getAnnotation(IgnoreProperties.class);
        IgnoreProperty classIgnoreProperty = clazzOfMethodIn.getAnnotation(IgnoreProperty.class);
        AllowProperty classAllowProperty = clazzOfMethodIn.getAnnotation(AllowProperty.class);

        IgnoreProperties ignoreProperties = method.getAnnotation(IgnoreProperties.class);
        IgnoreProperty ignoreProperty = method.getAnnotation(IgnoreProperty.class);
        AllowProperty allowProperty = method.getAnnotation(AllowProperty.class);

        if (allowProperty != null) {// 方法上的AllowProperty注解
            processAllowPropertyAnnotation(allowProperty, pojoAndNamesMap);
        }
        if (classAllowProperty != null) {
            processAllowPropertyAnnotation(classAllowProperty, pojoAndNamesMap);
        }

        if (classIgnoreProperties != null) {// 类上的IgnoreProperties注解
            processIgnorePropertiesAnnotation(classIgnoreProperties, pojoAndNamesMap);
        }
        if (classIgnoreProperty != null) {// 类上的IgnoreProperty注解
            processIgnorePropertyAnnotation(classIgnoreProperty, pojoAndNamesMap);
        }

        if (ignoreProperties != null) {// 方法上的IgnoreProperties注解
            processIgnorePropertiesAnnotation(ignoreProperties, pojoAndNamesMap);
        }
        if (ignoreProperty != null) {// 方法上的IgnoreProperties注解
            processIgnorePropertyAnnotation(ignoreProperty, pojoAndNamesMap);
        }

        Set<Entry<Class<?>, Collection<String>>> entries = pojoAndNamesMap.entrySet();
        for (Iterator<Entry<Class<?>, Collection<String>>> iterator = entries.iterator(); iterator
                .hasNext(); ) {
            Entry<Class<?>, Collection<String>> entry = (Entry<Class<?>, Collection<String>>) iterator
                    .next();
            Collection<String> nameCollection = entry.getValue();
            nameCollection = putGlobalIgnoreProperties(nameCollection);// 将全局过滤字段放入集合内
            String[] names = nameCollection.toArray(new String[]{});

            // EntityHelper.print(entry.getKey());
            // for (int i = 0; i < names.length; i++) {
            // String name = names[i];
            // EntityHelper.print(name);
            // }
            Class<?> clazz = createMixInAnnotation(names);

            map.put(entry.getKey(), clazz);
        }

        proxyMethodMap.put(method, map);
        return map;
    }

    /**
     * 创建jackson的代理注解接口类 <br>
     * 2013-10-25 上午11:59:50
     *
     * @param names 要生成的字段
     * @return 代理接口类
     */
    private Class<?> createMixInAnnotation(String[] names) {
        Class<?> clazz = null;
        clazz = proxyMixInAnnotationMap.get(StringHelper.hashCodeOfStringArray(names));
        if (clazz != null) {
            return clazz;
        }

        ClassPool pool = ClassPool.getDefault();

        // 创建代理接口
        CtClass cc = pool.makeInterface("ProxyMixInAnnotation" + System.currentTimeMillis()
                + proxyIndex++);

        ClassFile ccFile = cc.getClassFile();
        ConstPool constpool = ccFile.getConstPool();

        // create the annotation
        AnnotationsAttribute attr = new AnnotationsAttribute(constpool,
                AnnotationsAttribute.visibleTag);
        // 创建JsonIgnoreProperties注解
        Annotation jsonIgnorePropertiesAnnotation = new Annotation(
                JsonIgnoreProperties.class.getName(), constpool);

        BooleanMemberValue ignoreUnknownMemberValue = new BooleanMemberValue(false, constpool);

        ArrayMemberValue arrayMemberValue = new ArrayMemberValue(constpool);// value的数组成员

        Collection<MemberValue> memberValues = new HashSet<MemberValue>();
        for (int i = 0; i < names.length; i++) {
            String name = names[i];
            StringMemberValue memberValue = new StringMemberValue(constpool);// 将name值设入注解内
            memberValue.setValue(name);
            memberValues.add(memberValue);
        }
        arrayMemberValue.setValue(memberValues.toArray(new MemberValue[]{}));

        jsonIgnorePropertiesAnnotation.addMemberValue("value", arrayMemberValue);
        jsonIgnorePropertiesAnnotation.addMemberValue("ignoreUnknown", ignoreUnknownMemberValue);

        attr.addAnnotation(jsonIgnorePropertiesAnnotation);
        ccFile.addAttribute(attr);

        // generate the class
        try {
            clazz = cc.toClass();
            proxyMixInAnnotationMap.put(StringHelper.hashCodeOfStringArray(names), clazz);
            // JsonIgnoreProperties ignoreProperties = (JsonIgnoreProperties)
            // clazz
            // .getAnnotation(JsonIgnoreProperties.class);

            // EntityHelper.print(ignoreProperties);
            //
            // EntityHelper.print(clazz);

            // try {
            // Object instance = clazz.newInstance();
            // EntityHelper.print(instance);
            //
            // } catch (InstantiationException e) {
            // e.printStackTrace();
            // } catch (IllegalAccessException e) {
            // e.printStackTrace();
            // }
        } catch (CannotCompileException e) {
            e.printStackTrace();
        }

        // right
        // mthd.getMethodInfo().addAttribute(attr);

        return clazz;

    }


    @Override
    public Object filterProperties(Method method, Object object) {

        Map<Class<?>, Class<?>> map = getProxyMixInAnnotation(method);
        if (map == null || map.entrySet().size() == 0) {// 如果该方法上没有注解，则返回原始对象
            return object;
        }

//    	Set<Entry<Class<?>, Class<?>>> entries = map.entrySet();
//		for (Iterator<Entry<Class<?>, Class<?>>> iterator = entries.iterator(); iterator.hasNext();) {
//			Entry<Class<?>, Class<?>> entry = (Entry<Class<?>, Class<?>>) iterator.next();
//			//			EntityHelper.print(entry.getKey());
//			Class<?> clazz = entry.getValue();
//			//			EntityHelper.print(clazz.getAnnotation(JsonIgnoreProperties.class));
//		}


//		ObjectMapper mapper = createObjectMapper(map);
        ThreadJacksonMixInHolder.addMixIns(getEntries(map));
//		try {
//			HttpServletResponse response = WebContext.getInstance().getResponse();
//			writeJson(mapper, response, object);
//		} catch (WebContextAlreadyClearedException e) {
//			e.printStackTrace();
//		}

        return object;
    }

    public Set<Entry<Class<?>, Class<?>>> getEntries(Map<Class<?>, Class<?>> map) {
        Set<Entry<Class<?>, Class<?>>> entries = map.entrySet();
        return entries;
    }

    /**
     * 根据指定的过滤表创建jackson对象 <br>
     * 2013-10-25 下午2:46:43
     *
     * @param map 过滤表
     * @return ObjectMapper
     */
    private ObjectMapper createObjectMapper(Map<Class<?>, Class<?>> map) {
        ObjectMapper mapper = new ObjectMapper();
        Set<Entry<Class<?>, Class<?>>> entries = map.entrySet();
        for (Iterator<Entry<Class<?>, Class<?>>> iterator = entries.iterator(); iterator.hasNext(); ) {
            Entry<Class<?>, Class<?>> entry = iterator.next();
            mapper.addMixInAnnotations(entry.getKey(), entry.getValue());
        }
        return mapper;
    }

    /**
     * 根据方法上的注解生成objectMapper
     *
     * @param method
     * @return
     */
    public ObjectMapper createObjectMapper(Method method) {
        return createObjectMapper(getProxyMixInAnnotation(method));
    }

//    /**
//     * 将结果输出到response <br>
//     * 2013-10-25 下午2:28:40
//     *
//     * @param objectMapper
//     * @param response
//     * @param object
//     */
//    private void writeJson(ObjectMapper objectMapper, HttpServletResponse response, Object object) {
//        response.setContentType("application/json");
//
//        JsonEncoding encoding = getJsonEncoding(response.getCharacterEncoding());
//        JsonGenerator jsonGenerator = null;
//        try {
//            jsonGenerator = objectMapper.getJsonFactory().createJsonGenerator(
//                    response.getOutputStream(), encoding);
//        } catch (IOException e1) {
//            e1.printStackTrace();
//        }
//
//        // A workaround for JsonGenerators not applying serialization features
//        // https://github.com/FasterXML/jackson-databind/issues/12
//        if (objectMapper.isEnabled(SerializationFeature.INDENT_OUTPUT)) {
//            jsonGenerator.useDefaultPrettyPrinter();
//        }
//
//        try {
//            objectMapper.writeValue(jsonGenerator, object);
//        } catch (JsonProcessingException ex) {
//            LOGGER.error(ex);
//
//            throw new HttpMessageNotWritableException("Could not write JSON: " + ex.getMessage(),
//                    ex);
//        } catch (IOException e) {
//            LOGGER.error(e);
//            // e.printStackTrace();
//        }
//
//    }

    /**
     * <br>
     * 2013-10-25 下午12:29:58
     *
     * @param characterEncoding
     * @return
     */
    private JsonEncoding getJsonEncoding(String characterEncoding) {
        for (JsonEncoding encoding : JsonEncoding.values()) {
            if (characterEncoding.equals(encoding.getJavaName())) {
                return encoding;
            }
        }
        return JsonEncoding.UTF8;
    }

    /**
     * Determine the JSON encoding to use for the given content type.
     *
     * @param contentType the media type as requested by the caller
     * @return the JSON encoding to use (never {@code null})
     */
    protected JsonEncoding getJsonEncoding(MediaType contentType) {
        if (contentType != null && contentType.getCharSet() != null) {
            Charset charset = contentType.getCharSet();
            for (JsonEncoding encoding : JsonEncoding.values()) {
                if (charset.name().equals(encoding.getJavaName())) {
                    return encoding;
                }
            }
        }
        return JsonEncoding.UTF8;
    }

}
```

##3、线程持有类，用于在当前线程内保存核心类处理过的自定义注解生成的MixIn注解，并且能提供ObjectMapper的生成

```java
package com.xiongyingqi.jackson.helper;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 在当前线程内保存ObjectMapper供Jackson2HttpMessageConverter使用
 * Created by 瑛琪<a href="http://xiongyingqi.com">xiongyingqi.com</a> on 2014/4/1 0001.
 */
public class ThreadJacksonMixInHolder {
    private static ThreadLocal<ThreadJacksonMixInHolder> holderThreadLocal = new ThreadLocal<ThreadJacksonMixInHolder>();
    private Set<Map.Entry<Class<?>, Class<?>>> mixIns;
    private ObjectMapper mapper;
    private org.codehaus.jackson.map.ObjectMapper codehausMapper;

    /**
     * 根据当前MixIn集合生成objectMapper<p>
     * <p/>
     * <b>注意：该方法在返回mapper对象之后调用clear方法，如果再次调用builderMapper()肯定会保存</b>
     *
     * @return
     */
    public static ObjectMapper builderMapper() {
        ThreadJacksonMixInHolder holder = holderThreadLocal.get();
        if (holder.mapper == null && isContainsMixIn()) {
            holder.mapper = new ObjectMapper();
            for (Map.Entry<Class<?>, Class<?>> mixIn : holder.mixIns) {
                holder.mapper.addMixInAnnotations(mixIn.getKey(), mixIn.getValue());
            }
        }
        clear();// 如果不调用clear可能导致线程内的数据是脏的！
        return holder.mapper;
    }

    /**
     * 根据当前MixIn集合生成objectMapper
     *
     * @return
     */
    public static org.codehaus.jackson.map.ObjectMapper builderCodehausMapper() {
        ThreadJacksonMixInHolder holder = holderThreadLocal.get();
        if (holder.codehausMapper == null && isContainsMixIn()) {
            holder.codehausMapper = new org.codehaus.jackson.map.ObjectMapper();
            for (Map.Entry<Class<?>, Class<?>> mixIn : holder.mixIns) {
                holder.codehausMapper.getDeserializationConfig().addMixInAnnotations(mixIn.getKey(), mixIn.getValue());
                holder.codehausMapper.getSerializationConfig().addMixInAnnotations(mixIn.getKey(), mixIn.getValue());
            }
        }
        clear();// 如果不调用clear可能导致线程内的数据是脏的！
        return holder.codehausMapper;
    }

    /**
     * 清除当前线程内的数据
     */
    public static void clear() {
        holderThreadLocal.set(null);
//        holderThreadLocal.remove();
    }

    /**
     * 设置MixIn集合到线程内，如果线程内已经存在数据，则会先清除
     *
     * @param resetMixIns
     */
    public static void setMixIns(Set<Map.Entry<Class<?>, Class<?>>> resetMixIns) {
        ThreadJacksonMixInHolder holder = holderThreadLocal.get();
        if (holder == null) {
            holder = new ThreadJacksonMixInHolder();
            holderThreadLocal.set(holder);
        }
        holder.mixIns = resetMixIns;
    }

    /**
     * 不同于setMixIns，addMixIns为增加MixIn集合到线程内，即不会清除已经保存的数据
     * <br>2014年4月4日 下午12:08:15
     *
     * @param toAddMixIns
     */
    public static void addMixIns(Set<Map.Entry<Class<?>, Class<?>>> toAddMixIns) {
        ThreadJacksonMixInHolder holder = holderThreadLocal.get();
        if (holder == null) {
            holder = new ThreadJacksonMixInHolder();
            holderThreadLocal.set(holder);
        }
        if (holder.mixIns == null) {
            holder.mixIns = new HashSet<Map.Entry<Class<?>, Class<?>>>();
        }
        holder.mixIns.addAll(toAddMixIns);
    }

    /**
     * 获取线程内的MixIn集合<p></p>
     * <b>注意：为了防止线程执行完毕之后仍然存在有数据，请务必适时调用clear()方法</b>
     *
     * @return
     * @see com.xiongyingqi.jackson.helper.ThreadJacksonMixInHolder#builderMapper()
     * @see com.xiongyingqi.jackson.helper.ThreadJacksonMixInHolder#builderCodehausMapper()
     * @see com.xiongyingqi.jackson.helper.ThreadJacksonMixInHolder#clear()
     */
    public static Set<Map.Entry<Class<?>, Class<?>>> getMixIns() {
        ThreadJacksonMixInHolder holder = holderThreadLocal.get();
        return holder.mixIns;
    }

    /**
     * 判断当前线程是否存在MixIn集合
     *
     * @return
     */
    public static boolean isContainsMixIn() {
        if (holderThreadLocal.get() == null) {
            return false;
        }
        if (holderThreadLocal.get().mixIns != null && holderThreadLocal.get().mixIns.size() > 0) {
            return true;
        }
        return false;
    }

}
```
#测试
##测试代码

```java
package com.xiongyingqi.jackson;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiongyingqi.jackson.annotation.IgnoreProperties;
import com.xiongyingqi.jackson.annotation.IgnoreProperty;
import com.xiongyingqi.jackson.helper.ThreadJacksonMixInHolder;
import com.xiongyingqi.jackson.impl.JavassistFilterPropertyHandler;
import com.xiongyingqi.jackson.pojo.Group;
import com.xiongyingqi.jackson.pojo.User;
import com.xiongyingqi.util.Assert;
import com.xiongyingqi.util.EntityHelper;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Collection;

/**
 * Created by 瑛琪<a href="http://xiongyingqi.com">xiongyingqi.com</a> on 2014/6/4 0004.
 */
public class JsonFilterPropertyTest {

    @IgnoreProperties(@IgnoreProperty(pojo = User.class, name = "id"))
    public Collection<User> listUsers() {
        Group group1 = new Group();
        group1.setId(1);
        group1.setName("分组1");

        User user1 = new User();
        user1.setId(1);
        user1.setGroup(group1);
        user1.setName("用户1");
        User user2 = new User();
        user2.setId(1);
        user2.setGroup(group1);
        user2.setName("用户1");
        User user3 = new User();
        user3.setId(1);
        user3.setName("用户1");
        user3.setGroup(group1);


        Group group2 = new Group();
        group2.setId(2);
        group2.setName("分组2");

        User user4 = new User();
        user4.setId(4);
        user4.setGroup(group2);
        user4.setName("用户4");
        User user5 = new User();
        user5.setId(5);
        user5.setGroup(group2);
        user5.setName("用户5");
        User user6 = new User();
        user6.setId(6);
        user6.setName("用户6");
        user6.setGroup(group2);

        Collection<User> users = new ArrayList<User>();
        users.add(user1);
        users.add(user2);
        users.add(user3);
        users.add(user4);
        users.add(user5);
        users.add(user6);
        return users;
    }

    @Test
    public void jsonTest() throws NoSuchMethodException, JsonProcessingException {
        FilterPropertyHandler filterPropertyHandler = new JavassistFilterPropertyHandler(false);
        Object object = listUsers();

        object = filterPropertyHandler.filterProperties(JsonFilterPropertyTest.class.getMethod("listUsers"), object);


        ObjectMapper mapper = ThreadJacksonMixInHolder.builderMapper();
        String json = mapper.writeValueAsString(object);
        EntityHelper.print(json);
        Assert.hasText(json);
    }
}
```
##测试结果
 ------------------------------------------------------------ 
    at com.xiongyingqi.jackson.JsonFilterPropertyTest.jsonTest(JsonFilterPropertyTest.java:80)
    String =============== [{"name":"用户1","group":{"id":1,"name":"分组1"}},{"name":"用户1","group":{"id":1,"name":"分组1"}},{"name":"用户1","group":{"id":1,"name":"分组1"}},{"name":"用户4","group":{"id":2,"name":"分组2"}},{"name":"用户5","group":{"id":2,"name":"分组2"}},{"name":"用户6","group":{"id":2,"name":"分组2"}}]
 ------------------------------------------------------------ 

#性能与缺陷
* 1、主要是在map内存储了Javassist的临时类，每个注解(IgnoreProperties等)的方法的调用，对应在FilterPropertyHandler会处理一次注解并在内存内产生一个Javassist临时类，但是访问过一次之后该类就会读取map缓存
* 2、ThreadJacksonMixInHolder：这个类的原理就是使用ThreadLocal在当前线程内存储处理过的annotation注解，java的容器或框架都是使用了该类，导致的效率问题应该不大
* 3、未知的bug

#其他说明
其他框架内使用
如果不是spring-mvc框架也能使用这些代码来解决，只是必须要修改aop的捕获方法、使用new JavassistFilterPropertyHandler(false)禁用ResponseBody，以及在ObjectMapper输出使用自己定义的输出

##源代码地址
<div class="github-widget" data-repo="blademainer/common_utils"></div>

##代码已上传到maven中央库：
http://mvnrepository.com/artifact/com.xiongyingqi/common_helper

##Maven Usage:
```xml
<dependency>
	<groupId>com.xiongyingqi</groupId>
	<artifactId>common_helper</artifactId>
	<version>${common_utils.version}</version>
</dependency>
```
---
代码可以随意copy，但希望多多关注本人博客：[xiongyingqi.com](xiongyingqi.com)
