---
layout: code
title: Windows使用bat脚本定时备份文件（夹）并删除一定日期之前的备份和日志
description: 通过windows的bat功能实现对文件夹的拷贝，并根据文件夹的日期计算是否要删除该文件夹
keywords: 定时备份,Windows,bat,脚本
category: windows
tags:
 - bat
 - windows
---
备份的原理是使用windows的任务计划程序定时执行该脚本从而达到备份和删除备份历史的目的。</br>
脚本主要需要设置参数有四个：
<ol>
	<li>bakPath：要备份的目录，必须以\结尾</li>
	<li>bakTargetPath：备份文件存储路径（可以是网络路径，前提是必须要有权限管理该路径下的文件夹）</li>
	<li>DaysAgo：该参数表示要删除多少天之前的备份（比如今天是2012年12月31日，那么20121221的文件不会被删除，20121220或比之小的文件夹将会被删除）</li>
	<li>logDaysAgo：该参数表示要删除多少天之前的日志文件</li>
</ol>

####BackUpTask.bat
```bash
::  ------------------------------------------------------------------------ 
::                       自动备份及清除文件夹脚本说明
::  本脚本能备份指定文件夹下的所有文件夹并以日期的形式来存放每次备份的文件夹，
::  同时，能删除指定时间之前的备份文件夹。如果要使本脚本能按一定间隔时间来执行
::  此脚本，那么请在系统定时任务内创建一个任务，并设置好执行时间，然后指定执行
::  此脚本即可。
::  注意：由于定时任务执行的方式与直接点击执行脚本的方式有很大差别（对于定时任
::  务来说，脚本的相对路径其实就是相对于cmd.exe来说的路径），所以必须使用绝对
::  路径的方式来进行拷贝。
::  具体设置的参数：（所有的目录路径必须以\结尾）
::  bakPath 要备份的目录，必须以\结尾
::  bakTargetPath 备份文件存储路径（可以是网络路径，前提是必须要有权限管理该路径下的文件夹）
::  DaysAgo 该参数表示要删除多少天之前的备份（比如今天是2012年12月31日，那么20121221的文件不会被删除，20121220或比之小的文件夹将会被删除）
::  logDaysAgo 该参数表示要删除多少天之前的日志文件
:: 														--by Blademainer
::  ------------------------------------------------------------------------ 

@echo off
:: for /f "tokens=1-3 delims=- " %%1 in ("%date%") do set ttt=%%1%%2%%3
:: for /f "tokens=1-3 delims=.: " %%1 in ("%time%") do set ttt=%ttt%-%%1%%2%%3

:: 要备份的目录，必须以\结尾
set bakPath=C:\Users\blademainer\Desktop\test\

:: 备份文件存储路径（可以是网络路径，前提是必须要有权限管理该路径下的文件夹）
set bakTargetPath=C:\Users\blademainer\Desktop\bak\

:: 该参数表示要删除多少天之前的备份（比如今天是2012年12月31日，那么20121221的文件不会被删除，20121220或比之小的文件夹将会被删除）
set DaysAgo=10
:: 该参数表示要删除多少天之前的日志文件
set logDaysAgo=%DaysAgo%


:: ----------------------------------- 注意：除非你有足够的自信，否则不要变动以下参数 ----------------------------------- 
:: 日志存放路径
set logDir=%bakTargetPath%\log\

:: 截取日期函数
set dateStr=%date:~0,4%%date:~5,2%%date:~8,2%
:: 时间戳
set timeStr=%time:~0,2%%time:~3,2%%time:~6,2%%time:~9,2%
:: 得出的索引
set indexStr=%dateStr%_%timeStr%

:: 设置时间格式
for /f "tokens=1-3 delims=- " %%1 in ("%time%") do set beautyTime=%%1%%2%%3

:: 日志文件名
set logFile=%logDir%%indexStr%.log

:: 获取最后一个文件夹名称
call :LastFolder %bakPath% bakName
:: 备份所在文件夹（按日期分）
set bakDataFolder=%bakTargetPath%%indexStr%\
:: 备份后的路径
set bakDataPath=%bakDataFolder%%bakName%\
echo bakDataPath======%bakDataPath%

:: 创建日志目录
if not exist %logDir% mkdir %logDir%

echo 开始备份文件夹
echo ------------------ %date% %beautyTime% ------------------  >> %logFile%
if not exist %bakDataPath% mkdir %bakDataPath%
xcopy %bakPath%* %bakDataPath% /c/s/e/y/r >> %logFile%
IF ERRORLEVEL 1 ECHO ------------------ 文件拷贝失败 ------------------  >> %logFile%
IF ERRORLEVEL 0 ECHO ------------------ 文件拷贝成功 ------------------  >> %logFile%

::  ------------------- 计算指定DaysAgo天之前的日期 ------------------- 
:: 日期的格式为yyyymmdd
call :DateToDays %date:~0,4% %date:~5,2% %date:~8,2% PassDays
set /a PassDays-=%DaysAgo%
call :DaysToDate %PassDays% DstYear DstMonth DstDay
set DstDate=%DstYear%%DstMonth%%DstDay%
echo %DaysAgo%天前的日期是%DstDate%

::  ------------------- 计算指定logDaysAgo天之前的日期 ------------------- 
:: 日期的格式为yyyymmdd
call :DateToDays %date:~0,4% %date:~5,2% %date:~8,2% logPassDays
set /a logPassDays-=%logDaysAgo%
call :DaysToDate %logPassDays% DstYear DstMonth DstDay
set logDstDate=%DstYear%%DstMonth%%DstDay%
echo %logDaysAgo%天前的日期是%logDstDate%

::  ------------------- 删除文件夹 ------------------- 
echo 开始删除数据文件夹
echo 开始删除数据文件夹 >> %logFile%
setlocal enabledelayedexpansion
for /f "delims=" %%s in ('dir /b /ad "%bakTargetPath%"') do (
	set d=%%s
	set dateParse=!d:~0,8!
	echo 截取的日期为：!dateParse!
	set stDate=%DstDate%
	:: 如果该文件夹的日期小于该删除的备份日期，则删除该文件夹
	set path=%bakTargetPath%!d!
	echo 当前的路径!path!
	if !dateParse! lss !stDate! call :DeleteDirectory !path!
)

echo 开始删除日志文件夹%logDir%
echo 开始删除日志文件夹 >> %logFile%
for /f "delims=" %%s in ('dir /a-d /b "%logDir%"') do (
	set d=%%s
	set dateParse=!d:~0,8!
	echo 截取的日期为：!dateParse!
	set stDate=%logDstDate%
	:: 如果该文件夹的日期小于该删除的备份日期，则删除该文件夹
	set path=%logDir%!d!
	echo 当前的路径!path!
	if !dateParse! lss !stDate! call :DeleteFile !path!
)

endlocal
::  --------------------------- 结束--------------------------- 
goto :eof

:: 根据路径计算最后一个文件夹
:LastFolder %1 folderName
Setlocal ENABLEDELAYEDEXPANSION
set string=%1
::定义路径分隔符
set ch=\
set last=%string:~-1%
if "%last%"=="%ch%" (set "string=%string:~0,-1%")
set str=%string%

:next
if not "%str%"=="" (
	if "!str:~-1!"=="%ch%" goto last
	set rsString=!str:~-1!%rsString% 
	::比较首字符是否为要求的字符，如果是则跳出循环
	set "str=%str:~0,-1%"
	goto next
)
:last
::将空格去掉
set rsString=%rsString: =%
echo 结果：%rsString%
endlocal&set %2=%rsString%&goto :EOF

:: 删除文件夹
:DeleteDirectory %1
setlocal ENABLEEXTENSIONS
echo  ------------------ %1 ------------------
rd /s /q %1
echo  ------------------ 成功删除文件夹: %1 ------------------  >> %logFile%
endlocal&goto :EOF

:: 删除文件
:DeleteFile %1
setlocal ENABLEEXTENSIONS
echo  ------------------ %1 ------------------
del /f /s /q /a %1
echo  ------------------ 成功删除文件: %1 ------------------  >> %logFile%
endlocal&goto :EOF

::以下是计算日期使用
:DateToDays %yy% %mm% %dd% days
setlocal ENABLEEXTENSIONS
set yy=%1&set mm=%2&set dd=%3
if 1%yy% LSS 200 if 1%yy% LSS 170 (set yy=20%yy%) else (set yy=19%yy%)
set /a dd=100%dd%%%100,mm=100%mm%%%100
set /a z=14-mm,z/=12,y=yy+4800-z,m=mm+12*z-3,j=153*m+2
set /a j=j/5+dd+y*365+y/4-y/100+y/400-2472633
endlocal&set %4=%j%&goto :EOF

:DaysToDate %days% yy mm dd
setlocal ENABLEEXTENSIONS
set /a a=%1+2472632,b=4*a+3,b/=146097,c=-b*146097,c/=4,c+=a
set /a d=4*c+3,d/=1461,e=-1461*d,e/=4,e+=c,m=5*e+2,m/=153,dd=153*m+2,dd/=5
set /a dd=-dd+e+1,mm=-m/10,mm*=12,mm+=m+3,yy=b*100+d-4800+m/10
(if %mm% LSS 10 set mm=0%mm%)&(if %dd% LSS 10 set dd=0%dd%)
endlocal&set %2=%yy%&set %3=%mm%&set %4=%dd%&goto :EOF
:: 结束goto使用： goto :eof
```