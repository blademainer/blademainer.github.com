title: Jackson解析json为指定泛型的集合
date: 2016-03-29 11:22:49
tags: 
- java
- jackson
- fasterxml
- collection
- deserialize
keywords: java,jackson,fasterxml,collection,deserialize
---
# 问题
在日常开发中，当使用ObjectMapper进行解析json时，我们时常需要将json解析成我们指定泛型的集合类型`Collection<type>`。  
但是如果直接使用`objectMapper.readValue(json, Collection.class)`的话，那么就会解析为`Collection<Map>`的类型，这个明显不是我们想要的。  
# 方案
在jackson内，如果要反序列化为Collection或者Map，我们可以使用  
- `CollectionType construct = CollectionType.construct(LinkedList.class, SimpleType.construct(clazz));` 
- `MapType construct = MapType.construct(HashMap.class, SimpleType.construct(keyType), SimpleType.construct(valueType))`

<!--more-->
```java
package com.xiongyingqi.json;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import com.fasterxml.jackson.databind.type.MapType;
import com.fasterxml.jackson.databind.type.SimpleType;

import java.io.IOException;
import java.util.*;

/**
 * @author xiongyingqi
 * @version 2016-03-29 11:23
 */
public class JacksonDemo {

    public static ObjectMapper getMapper() {
        return new ObjectMapper();
    }

    public String writeAsString(Object o) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.writeValueAsString(o);
    }

    /**
     * 获取反序列化的集合类型JavaType
     *
     * @param clazz 元素类型
     * @return {@link JavaType}
     */
    public static JavaType getListType(Class<?> clazz) {
        CollectionType construct = CollectionType
                .construct(LinkedList.class, SimpleType.construct(clazz));
        return construct;
    }

    /**
     * 获取反序列化的map类型JavaType
     *
     * @param keyType   键类型
     * @param valueType 值类型
     * @return {@link JavaType}
     */
    public static JavaType getMapType(Class<?> keyType, Class<?> valueType) {
        MapType construct = MapType.construct(HashMap.class, SimpleType.construct(keyType),
                SimpleType.construct(valueType));
        return construct;
    }

    public static void main(String[] args) throws IOException {
        List<String> list = new ArrayList<String>();
        list.add("hello");
        list.add("world");
        list.add("!");
        JacksonDemo jacksonDemo = new JacksonDemo();
        String listJson = jacksonDemo.writeAsString(list);
        System.out.println(listJson);
        JavaType listType = getListType(String.class);
        ObjectMapper mapper = getMapper();
        List<String> result = mapper.readValue(listJson, listType);
        System.out.println(result);
        System.out.println(result.getClass()); // LinkedList



        Map<String, String> map = new HashMap<String, String>();
        map.put("one", "hello");
        map.put("two", "world");
        String mapJson = jacksonDemo.writeAsString(map);
        System.out.println(mapJson);
        JavaType mapType = getMapType(String.class,String.class);
        Map<String, String> result2 = mapper.readValue(mapJson, mapType);
        System.out.println(result2);
        System.out.println(result2.getClass()); // HashMap
    }
}
```
