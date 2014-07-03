---
layout: post
title: rmagick的安装
description: rmagick的安装方法，主要是ImageMagick与RailsInstaller版本不对
keywords: rmagick,jekyll
category: jekyll
tags:
 - rmagick
 - jekyll
---
在网上看到的基本上都是安装完ruby后再安装ImageMagick，然后再配置环境变量就可以了。。。
####按照他们的安装方法经常出现缺失环境必备的文件等问题，我找了一个月左右终于找到了对应的版本：
railsinstaller-2.2.1.exe<br>
ImageMagick-6.5.7-7-Q16-windows-dll.exe

####我安装的文件：<a href="http://url.cn/VajhlO">微云</a>

####然后配置四个环境变量就肯定可以安装
set DFImageMagick ImageMagick的安装目录<br>
set PATH=%DFImageMagick%;%PATH%<br>
set CPATH=%DFImageMagick%\include;%CPATH%<br>
set LIBRARY_PATH=%DFImageMagick%\lib;%LIBRARY_PATH%<br>