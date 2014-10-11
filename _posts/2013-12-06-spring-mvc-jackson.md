---
layout:     code
title:      完美解决json循环问题（使用javassist增强）：Spring MVC中使用jackson的MixInAnnotations方法动态过滤JSON字段
description: springmvc中，默认使用jackson类返回java bean对象，但是如果存在回路时，会导致jackson输出循环。本文介绍如何通过自定义注解来定义过滤属性，web运行时如何通过AOP捕获Controller的ResponseBody注解的方法然后处理要过滤的属性。
keywords: jackson,json,endless loop,死循环,java,spring-mvc,spring mvc,spring,@ResponseBody,javassist
category: java
tags:
 - java
 - javassist
 - spring-mvc
 - jackson
---

<p>使用Spring MVC框架开发web时，Spring MVC默认用jackson库处理JSON和POJO的转换。
在POJO转化成JSON时，希望动态的过滤掉对象的某些属性。
所谓动态，是指的运行时，不同的controler方法可以针对同一POJO过滤掉不同的属性。</p>

<h3>原理</h3>
<ol>
	<li>在controller方法中新增@IgnoreProperties注解</li>
	<li>当spring-mvc返回pojo时，aop类IgnorePropertyAspect捕获到要处理的方法，交给FilterPropertyHandler（使用JavassistFilterPropertyHandler实现类）处理。</li>
	<li>JavassistFilterPropertyHandler读取Controller方法的过滤属性集合（先从缓存内读取，如果缓存内不存在该方法的过滤属性集合，则进行读取并放入缓存内）</li>
	<li>根据过滤属性的集合使用javassist动态生成接口(MixIn注解)</li>
	<li>使用jackson转换pojo（通过上面javassist生成的MixIn接口进行过滤，这样能使用到jackson原生的过滤机制）</li>
</ol>

<p></p>
<p>
欢迎参考：<a href="https://github.com/blademainer/YIXUN_1.5_EE">项目源代码</a>&nbsp;&nbsp;<a href="https://github.com/blademainer/YIXUN_1.5_EE/tree/master/src/main/java/com/kingray/json/filter">核心代码所在包</a><br>
以下是部分核心代码：</p>

方法注解<br>
IgnoreProperties.java
```java
/**
 * YIXUN_1.5_EE
 */
package com.kingray.json.filter.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * json属性过滤注解，对于同一个pojo来说 @AllowProperty 是与 @IgnoreProperty 是冲突的，如果这两个注解注解了<br>
 * 例如以下代码YxResource实体只会显示resourceName和resourceDescribe属性
 * 
 * <pre>
 * &#064;IgnoreProperties(
 * 	value = {
 * 		&#064;IgnoreProperty(
 * 			pojo = YxResource.class, 
 * 			name = { 
 * 				"yxResourceDataRelations",
 * 				"yxResourceSelfRelationsForSublevelResourceId",
 * 				"yxPermisionResourceRelations" }),
 * 		&#064;IgnoreProperty(
 * 			pojo = YxResourceSelfRelation.class, 
 * 			name = {
 * 				"yxResourceBySuperiorResourceId",
 * 				"id" }) 
 * 	}, 
 * 	allow = {
 * 	&#064;AllowProperty(
 * 			pojo = YxResource.class, 
 * 			name = { "<b><i>resourceName</i></b>" }) })
 * 	&#064;AllowProperty(
 * 			pojo = YxResource.class, 
 * 			name = { "<b><i>resourceDescribe</i></b>" })
 * </pre>
 * 
 * 
 * 但是，对于同一个pojo的同一属性来说@AllowProperty是与@IgnoreProperty则会按照@IgnoreProperty过滤的属性名过滤
 * 例如以下代码YxResource实体不会显示resourceName属性的值
 * 
 * <pre>
 * &#064;IgnoreProperties(
 * 	value = {
 * 	&#064;IgnoreProperty(
 * 			pojo = YxResource.class, 
 * 			name = { "<b><i>resourceName</i></b>",
 * 				"yxResourceDataRelations",
 * 				"yxResourceSelfRelationsForSublevelResourceId",
 * 				"yxPermisionResourceRelations" }),
 * 	&#064;IgnoreProperty(
 * 			pojo = YxResourceSelfRelation.class, 
 * 			name = { 
 * 				"yxResourceBySuperiorResourceId", 
 * 				"id" }) 
 * 	}, 
 * 	allow = { 
 * 	&#064;AllowProperty(
 * 			pojo = YxResource.class, 
 * 			name = { "<b><i>resourceName</i></b>" }) })
 * </pre>
 * 
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-9-27 下午4:18:39
 */
@Documented
@Target({ ElementType.TYPE, ElementType.METHOD })
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

过滤属性的注解<br>
IgnoreProperty.java
```java
/**
 * YIXUN_1.5_EE
 */
package com.kingray.json.filter.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 用于注解json过滤pojo内的属性，其他的属性都会被序列化成字符串
 * 
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-9-27 下午4:24:33
 */
@Documented
@Target({ ElementType.TYPE, ElementType.METHOD, ElementType.ANNOTATION_TYPE })
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
	//	String value() default "";

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

允许通过的属性注解<br>
AllowProperty.java
```java
/**
 * YIXUN_1.5_EE
 */
package com.kingray.json.filter.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import com.kingray.hibernate.domain.YxResource;
import com.kingray.hibernate.domain.YxResourceSelfRelation;

/**
 * 只允许pojo内的属性序列化成json，对于同一个pojo该注解是与IgnoreProperty是冲突的<br>
 * 
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-10-30 下午3:57:35
 */
@Documented
@Target({ ElementType.TYPE, ElementType.METHOD, ElementType.ANNOTATION_TYPE })
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

切面类：<br>
IgnorePropertyAspect.java
```java
/**
 * YIXUN_1.5_EE
 */
package com.kingray.json.filter.aop;

import java.lang.reflect.Method;

import javax.inject.Singleton;

import org.apache.commons.beanutils.BeanUtils;
import org.apache.log4j.Logger;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Scope;

import com.fasterxml.jackson.databind.util.BeanUtil;
import com.kingray.json.filter.FilterPropertyHandler;
import com.kingray.json.filter.impl.DefaultFilterPropertyHandler;
import com.kingray.json.filter.impl.JavassistFilterPropertyHandler;
import com.xiongyingqi.util.EntityHelper;
import com.xiongyingqi.util.StackTraceHelper;
import com.xiongyingqi.util.TimerHelper;

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
		Object[] args = pjp.getArgs();// 参数
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

核心处理类，包括读取Controller方法的注解、创建javassist代理接口、判断处理逻辑、转换为jackson对象等。<br>
JavassistFilterPropertyHandler.java
```java
package com.kingray.json.filter.impl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.web.bind.annotation.ResponseBody;

import javassist.CannotCompileException;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.bytecode.AnnotationsAttribute;
import javassist.bytecode.ClassFile;
import javassist.bytecode.ConstPool;
import javassist.bytecode.annotation.Annotation;
import javassist.bytecode.annotation.ArrayMemberValue;
import javassist.bytecode.annotation.BooleanMemberValue;
import javassist.bytecode.annotation.MemberValue;
import javassist.bytecode.annotation.StringMemberValue;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.kingray.context.WebContext;
import com.kingray.hibernate.domain.YxResource;
import com.kingray.hibernate.domain.YxResourceSelfRelation;
import com.kingray.json.filter.FilterPropertyHandler;
import com.kingray.json.filter.annotation.AllowProperty;
import com.kingray.json.filter.annotation.IgnoreProperties;
import com.kingray.json.filter.annotation.IgnoreProperty;
import com.kingray.web.exception.WebContextAlreadyClearedException;
import com.xiongyingqi.util.EntityHelper;
import com.xiongyingqi.util.StringHelper;

/**
 * 使用代理来创建jackson的MixInAnnotation注解接口<br>
 * 如果使用本实现方法，一定要配置在web.xml中配置过滤器WebContextFilter，否则无法输出json到客户端
 * 
 * @see com.kingray.filter.WebContextFilter
 * @author 瑛琪 <a href="http://xiongyingqi.com">xiongyingqi.com</a>
 * @version 2013-10-25 下午2:31:21
 */
public class JavassistFilterPropertyHandler implements FilterPropertyHandler {

	public static final Logger LOGGER = Logger.getLogger(JavassistFilterPropertyHandler.class);

	/**
	 * 注解的方法对应生成的代理类映射表
	 */
	private static Map<Method, Map<Class<?>, Class<?>>> proxydMethodMap = new HashMap<Method, Map<Class<?>, Class<?>>>();

	/**
	 * String数组的hashCode与生成的对应的代理类的映射表
	 */
	private static Map<Integer, Class<?>> proxyMixInAnnotationMap = new HashMap<Integer, Class<?>>();

	private static String[] globalIgnoreProperties = new String[] { "hibernateLazyInitializer",
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
	 * @param isResponseBodyAnnotation
	 *            如果是标注的SpringMVC中的Controller方法，则应判断是否注解了@ResponseBody
	 */
	public JavassistFilterPropertyHandler(boolean isResponseBodyAnnotation) {
		this.isResponseBodyAnnotation = isResponseBodyAnnotation;
	}

	/**
	 * <br>
	 * 2013-10-28 上午11:11:24
	 * 
	 * @param nameCollection
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
	 * @param method
	 *            注解了 @IgnoreProperties 或 @IgnoreProperty 的方法（所在的类）
	 * @return Map<Class<?>, Collection<Class<?>>> pojo与其属性的映射表
	 */
	protected Map<Class<?>, Class<?>> getProxyMixInAnnotation(Method method) {
		if (isResponseBodyAnnotation && !method.isAnnotationPresent(ResponseBody.class)) {
			return null;
		}
		Map<Class<?>, Class<?>> map = proxydMethodMap.get(method);// 从缓存中查找是否存在

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
				.hasNext();) {
			Entry<Class<?>, Collection<String>> entry = (Entry<Class<?>, Collection<String>>) iterator
					.next();
			Collection<String> nameCollection = entry.getValue();
			nameCollection = putGlobalIgnoreProperties(nameCollection);// 将全局过滤字段放入集合内
			String[] names = nameCollection.toArray(new String[] {});

			// EntityHelper.print(entry.getKey());
			// for (int i = 0; i < names.length; i++) {
			// String name = names[i];
			// EntityHelper.print(name);
			// }
			Class<?> clazz = createMixInAnnotation(names);

			map.put(entry.getKey(), clazz);
		}

		proxydMethodMap.put(method, map);
		return map;
	}

	/**
	 * 创建jackson的代理注解接口类 <br>
	 * 2013-10-25 上午11:59:50
	 * 
	 * @param names
	 *            要生成的字段
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
		CtClass cc = pool.makeInterface("ProxyMinxinAnnotation" + System.currentTimeMillis()
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
		arrayMemberValue.setValue(memberValues.toArray(new MemberValue[] {}));

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
		Set<Entry<Class<?>, Class<?>>> entries = map.entrySet();
		for (Iterator<Entry<Class<?>, Class<?>>> iterator = entries.iterator(); iterator.hasNext();) {
			Entry<Class<?>, Class<?>> entry = (Entry<Class<?>, Class<?>>) iterator.next();
			//			EntityHelper.print(entry.getKey());
			Class<?> clazz = entry.getValue();
			//			EntityHelper.print(clazz.getAnnotation(JsonIgnoreProperties.class));
		}

		if (map == null || map.entrySet().size() == 0) {// 如果该方法上没有注解，则返回原始对象
			return object;
		}

		ObjectMapper mapper = createObjectMapper(map);

		try {
			HttpServletResponse response = WebContext.getInstance().getResponse();
			writeJson(mapper, response, object);
		} catch (WebContextAlreadyClearedException e) {
			e.printStackTrace();
		}

		return null;// 如果处理完成， 则返回空
	}

	/**
	 * 根据指定的过滤表创建jackson对象 <br>
	 * 2013-10-25 下午2:46:43
	 * 
	 * @param map
	 *            过滤表
	 * @return ObjectMapper
	 */
	private ObjectMapper createObjectMapper(Map<Class<?>, Class<?>> map) {
		ObjectMapper mapper = new ObjectMapper();
		Set<Entry<Class<?>, Class<?>>> entries = map.entrySet();
		for (Iterator<Entry<Class<?>, Class<?>>> iterator = entries.iterator(); iterator.hasNext();) {
			Entry<Class<?>, Class<?>> entry = (Entry<Class<?>, Class<?>>) iterator.next();
			mapper.addMixInAnnotations(entry.getKey(), entry.getValue());
		}
		return mapper;
	}

	/**
	 * 将结果输出到response <br>
	 * 2013-10-25 下午2:28:40
	 * 
	 * @param objectMapper
	 * @param response
	 * @param object
	 */
	private void writeJson(ObjectMapper objectMapper, HttpServletResponse response, Object object) {
		response.setContentType("application/json");

		JsonEncoding encoding = getJsonEncoding(response.getCharacterEncoding());
		JsonGenerator jsonGenerator = null;
		try {
			jsonGenerator = objectMapper.getJsonFactory().createJsonGenerator(
					response.getOutputStream(), encoding);
		} catch (IOException e1) {
			e1.printStackTrace();
		}

		// A workaround for JsonGenerators not applying serialization features
		// https://github.com/FasterXML/jackson-databind/issues/12
		if (objectMapper.isEnabled(SerializationFeature.INDENT_OUTPUT)) {
			jsonGenerator.useDefaultPrettyPrinter();
		}

		try {
			objectMapper.writeValue(jsonGenerator, object);
		} catch (JsonProcessingException ex) {
			LOGGER.error(ex);

			throw new HttpMessageNotWritableException("Could not write JSON: " + ex.getMessage(),
					ex);
		} catch (IOException e) {
			LOGGER.error(e);
			// e.printStackTrace();
		}

	}

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
	 * @param contentType
	 *            the media type as requested by the caller
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

	@ResponseBody
	// @IgnoreProperties(value = {
	// @IgnoreProperty(pojo = YxUser.class, name = { "userPassword", "userName"
	// }),
	// @IgnoreProperty(pojo = YxUserRoleRelation.class, name = { "yxUser", "id"
	// }) })
	// @IgnoreProperty(pojo = YxUserRoleRelation.class, name = { "id", "yxUser"
	// })
	@IgnoreProperties(value = {
			@IgnoreProperty(pojo = YxResource.class, name = { "resourceName",
					"yxResourceDataRelations", "yxResourceSelfRelationsForSublevelResourceId",
					"yxPermisionResourceRelations" }),
			@IgnoreProperty(pojo = YxResourceSelfRelation.class, name = {
					"yxResourceBySuperiorResourceId", "id" }) }, allow = { @AllowProperty(pojo = YxResource.class, name = { "resourceName" }) })
	@AllowProperty(pojo = YxResource.class, name = { "resourceDescribe" })
	private Object test() {
		YxResource resource = new YxResource();
		resource.setResourceId(1);
		resource.setResourceName("父级资源");

		YxResource subResource = new YxResource();
		subResource.setResourceId(2);
		subResource.setResourceName("子集资源");

		YxResource grandsonResource = new YxResource();
		grandsonResource.setResourceId(2);
		grandsonResource.setResourceName("孙级资源");

		YxResourceSelfRelation subrelation = new YxResourceSelfRelation(null, grandsonResource,
				subResource);

		Set<YxResourceSelfRelation> subyxResourceSelfRelationsForSuperiorResourceId = new HashSet<YxResourceSelfRelation>();
		subyxResourceSelfRelationsForSuperiorResourceId.add(subrelation);

		subResource
				.setYxResourceSelfRelationsForSuperiorResourceId(subyxResourceSelfRelationsForSuperiorResourceId);

		YxResourceSelfRelation relation = new YxResourceSelfRelation(null, subResource, resource);

		Set<YxResourceSelfRelation> yxResourceSelfRelationsForSuperiorResourceId = new HashSet<YxResourceSelfRelation>();
		yxResourceSelfRelationsForSuperiorResourceId.add(relation);

		resource.setYxResourceSelfRelationsForSuperiorResourceId(yxResourceSelfRelationsForSuperiorResourceId);

		return resource;
	}

	public static void main(String[] args) {
		JavassistFilterPropertyHandler filterPropertyHandler = new JavassistFilterPropertyHandler();
		// for (int i = 0; i < 2; i++) {
		// Class<?> proxy = filterPropertyHandler.createMixInAnnotation(new
		// String[]{"resourceId"});
		// EntityHelper.print(proxy.getPackage());
		// }

		try {
			Map<Class<?>, Class<?>> map = null;
			try {
				map = filterPropertyHandler
						.getProxyMixInAnnotation(JavassistFilterPropertyHandler.class
								.getDeclaredMethod("test"));
			} catch (SecurityException e) {
				e.printStackTrace();
			} catch (NoSuchMethodException e) {
				e.printStackTrace();
			}

			Object object = filterPropertyHandler.test();

			ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

			if (map != null) {// 如果该方法上没有注解，则返回原始对象

				ObjectMapper objectMapper = filterPropertyHandler.createObjectMapper(map);

				JsonGenerator jsonGenerator = null;
				try {
					jsonGenerator = objectMapper.getFactory().createGenerator(outputStream);
				} catch (IOException e1) {
					e1.printStackTrace();
				}

				// A workaround for JsonGenerators not applying serialization
				// features
				// https://github.com/FasterXML/jackson-databind/issues/12
				// if
				// (objectMapper.isEnabled(SerializationFeature.INDENT_OUTPUT))
				// {
				jsonGenerator.useDefaultPrettyPrinter();
				// }

				try {
					objectMapper.writeValue(jsonGenerator, object);
				} catch (JsonProcessingException ex) {
					throw new HttpMessageNotWritableException("Could not write JSON: "
							+ ex.getMessage(), ex);
				} catch (IOException e) {
					e.printStackTrace();
				}

				// String json =
				// mapper.writeValueAsString(filterPropertyHandler.test());
				// EntityHelper.print(json);
			}

			//			String json = outputStream.toString();
			//			EntityHelper.print(json);

		} catch (Exception e1) {
			e1.printStackTrace();
		}
	}
}
```