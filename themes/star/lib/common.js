'use strict';

/**
 * @author      hustcer
 * @license     MIT
 * @copyright   TraceInvest.com
 * @create      07/10/2015
 */
let fs   = require('fs'),
    path = require('path'),
    _    = require('lodash'),
    cmd  = require('commander');

let conf = require('./conf.js').conf;

/* eslint no-extend-native:0 */
/**
 * 计算汉英混合字符串长度，汉字占两个字节，ASCII字符一个字节
 */
String.prototype.lenB = function(){
    return this.replace(/[^\x00-\xff]/g, '**').length;
};

/**
 * Pad string to required length
 * @param  {Number} length    The required length
 * @param  {String} direction Pad ' ' to left or right
 * @param {Boolean} isAscii   True to Ascii strings, otherwise false.
 * @return {String}           The result string
 */
String.prototype.padOutput = function(length, direction, isAscii){
    if(this.lenB() > length) { return this; }
    let ratio = isAscii ? 1 : 2;
    if(direction === 'left'){
        return ' '.repeat((length - this.lenB())*ratio) + this;
    }
    return this + ' '.repeat((length - this.lenB())*ratio);
};

let Common = {
    /**
     * 获取用户home目录路径
     * @return {String}  User home path
     */
    getUserHome : function(){
        return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
    },
    /**
     * 获取股票文件路径，路径查找规则如下：
     * 1. 如果传入股票文件路径参数则将其保存到用户目录的隐藏文件里面，下次可以重复使用不必每次都输入;
     * 2. 如果没有传入股票文件路径参数则先读取配置文件里面的路径参数，读取不到默认找 'symbols.yaml' 文件;
     * @return {String} 股票文件路径
     */
    getSymbolFilePath: function(){
        let symbolFile   = '';
        let starConf     = {};
        let starConfPath = path.join(Common.getUserHome(), conf.starConfFile);
        let confExist    = fs.existsSync(starConfPath);

        if(cmd.file){
            symbolFile = cmd.file;
            starConf   = confExist ? require(starConfPath): {};
            starConf.symbolFile = symbolFile;
            fs.writeFile(starConfPath, JSON.stringify(starConf, null, 4), (e) => {if (e) throw e; });
            return symbolFile;
        }
        if(confExist){
            starConf   = require(starConfPath);
            symbolFile = starConf.symbolFile || conf.symbolFile;
            return symbolFile;
        }
        return conf.symbolFile;
    },
    /**
     * Check duplication of symbols.
     * @param  {Object} counter An object whose key is the symbol code and the value is code counter
     * @return {Object}         Duplication status object.
     */
    checkDup: function(counter){
        let dup = {dup: false, dupCode:null, times:1};

        _.forOwn(counter, (v, k) => {
            if(v > 1){
                dup.dup     = true;
                dup.dupCode = k;
                dup.times   = v;
                return false;
            }
        });

        return dup;
    },
    /**
     * JsonP 解析
     * @param  {String} jsonpData A jsonP response.
     * @return {Object}           The JSON Object.
     */
    parseJsonP: function(jsonpData){
        let startPos   = jsonpData.indexOf('({');
        let endPos     = jsonpData.indexOf('})');
        let jsonString = jsonpData.substring(startPos+1, endPos+1);
        return JSON.parse(jsonString);
    }
};

exports.Common = Common;
