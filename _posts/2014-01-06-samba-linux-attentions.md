---
layout: code
title: Linux安装Samba文件共享服务器
description: Samba相对于Windows服务器来说具有更灵活的配置、高效等特点。个人认为是共享服务器的最佳选择。
keywords: Samba,Linux,文件共享服务器,无法访问
category: linux
tags:
 - Samba
 - linux
---
####Linux安装Samba文件共享服务器
<p>
Samba相对于Windows服务器来说具有更灵活的配置、高效等特点。个人认为是共享服务器的最佳选择。
</p>
首先安装samba：
```bash
yum install samba
```
ubuntu下yum对应命令为：
```bash
apt-get install samba
```
samba主要配置文件在/etc/samba/smb.conf中
```bash
[global]
        realm = 192.168.0.2
        netbios name = SAMBA-SERVER
        netbios aliases = SAMBA-SERVER
        server string = Samba-Server
        security = SHARE
        log file = /var/log/samba/%m.log
        max log size = 50
        os level = 0
        wins proxy = Yes
        wins support = Yes
        idmap config * : backend = tdb
        hosts allow = 127., 192.
        cups options = raw

[test]
        comment = test
        path = /home/share/test
        read only = No
        create mask = 0777
        directory mask = 0777
```
<p>
其中比较要注意的是global中的security和hosts allow两个选项：</br>
&nbsp;&nbsp;security代表验证权限的机制，我一般使用share和user级别，这两种方式其实没多大区别~无非是先登录再查看还是先查看再登录的区别而已（注意：Linux的目录）
如果服务器共享了哪些文件夹是不怕公布并且多个部门使用同一个服务器以及各部门需要相互查看的话，建议使用share的方式，这样会极大的方便公司同事在windows中切换帐号。</br>
hosts allow代表了哪些前缀的ip地址能访问服务器。
</p>

