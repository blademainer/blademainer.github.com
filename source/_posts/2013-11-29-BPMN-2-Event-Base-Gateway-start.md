---
layout:     post
title:      BPMN 2.0之使用Event Base Gateway启动流程
description: 业务流程建模标记法（BPMN, Business Process Modeling Notation）是工作流中特定业务流程的图形化表示法。它由业务流程管理倡议组织（BPMI, Business Process Management Initiative）开发，该组织已于2005年与对象管理组织（OMG, Object Management Group）合并，从那时起，BPMN由OMG维护。BPMN当前版本为1.2，2009年1月发布，有重要修改的2.0版已经进入投票阶段。
keywords: BPMN
category: jbpm
tags:
 - BPMN
 - Gateway
---

在上篇BPMN 2.0之Event Base Gateway（基于事件的网关）说了Event Base Gateway在流程流转中间的使用，Event Base Gateway的另一个用途是可以启动流程。

当Event Base Gateway被设置成启动流程时，它的图标会改变同时上游也不允许有流入的Sequence Flow。下面是个例子：
<img src="/images/post/eventbase_gateway_start_process_1.png"/>

当上图的流程部署后，就会等待Email或电话请求。如果Email来了，就实例化一个流程实例，并从Task1开始执行。如果电话请求来了就再实例化一个流程实例从Task2开始执行。

缺省设置下，启动流程的Event Base Gateway是互斥的。可以用多个Start Event达到同样效果：
<img src="/images/post/eventbase_gateway_start_process_2.png"/>

本人认为这种情况下，使用Start Event更直观也省画面空间。

另外我们也可以设置启动流程的Event Base Gateway是并行的，如下图（注意Event Base Gateway图标的变化）：
<img src="/images/post/eventbase_gateway_start_process_1_same.png"/>

并行的Event Base Gateway在一个分支被激活并启动流程实例后，其他分支在启动的同一个流程实例中继续等待，如果在流程实例运行完成之前，其他分支也被激活，流程实例就多一条并行的流转分支。
这种情况真还一时半会还想不出对应的业务情景，很复杂？！