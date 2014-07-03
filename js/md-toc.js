/**
 * md-toc.js v1.0.1
 * https://github.com/yijian166/md-toc.js
 */

(function(window){
    function Toc(id,options){
        this.el = document.getElementById(id);
        if(!this.el) return;
        this.options = options || {};
        this.tocLevel = parseInt(options.level) || 0;
        this.tocClass = options.class || 'toc';
        this.position = options.position || 'absolute';
        this.tocTop = parseInt(options.top) || 0;
        this.elChilds = this.el.children;
        if(!this.elChilds.length) return;
        this._init();
    }

    Toc.prototype._init = function(){
        this._collectTitleElements();
        this._createTocContent();
        this._showToc();
    };


    Toc.prototype._collectTitleElements = function() {
        this._elTitlesNames = [],
            this.elTitleElements = [];
        for(var i=1;i<7;i++){
            if(this.el.getElementsByTagName('h'+i).length){
                this._elTitlesNames.push('h'+i);
            }
        }

        this._elTitlesNames.length = this._elTitlesNames.length > this.tocLevel ? this.tocLevel : this._elTitlesNames.length;

        for(var j=0;j < this.elChilds.length;j++){
            this._elChildName = this.elChilds[j].tagName.toLowerCase();
            if(this._elTitlesNames.toString().match( this._elChildName)){
                this.elTitleElements.push(this.elChilds[j]);
            }
        }
    };

    Toc.prototype._createTocContent = function(){
        this._elTitleElementsLen = this.elTitleElements.length;

        if(!this._elTitleElementsLen) return;

        this.tocContent = '';

        this._tempLists = [];

        // 本页面的完整地址，某些情况下base标签和页面地址不一致，会造成锚点混乱
        var url = location.origin+location.pathname;
        for(var i=0;i< this._elTitleElementsLen;i++){
            var j= i + 1;
            this._elTitleElement = this.elTitleElements[i];
            this._elTitleElementName = this._elTitleElement.tagName;
            this._elTitleElementText = this._elTitleElement.innerHTML;
            this._elTitleElement.setAttribute('id', 'tip' + i );

            if(!(j == this._elTitleElementsLen)){
                this._elNextTitleElementName = this.elTitleElements[j].tagName;

                if(this._elTitleElementName != this._elNextTitleElementName){

                    var checkColse = false,
                        y = 1;
                    for(var t = this._tempLists.length - 1 ;t >= 0 ;t--) {

                        if ( this._tempLists[t].tagName == this._elNextTitleElementName){
                            checkColse = true;
                            break;
                        }
                        y++;
                    }

                    if(checkColse){
                        switch(y){
                            case 1 :
                                this.tocContent  = this.tocContent + '<li class="tip"><a href="'
                                    + url
                                    + '#tip'
                                    + i
                                    +'">'
                                    +  this._elTitleElementText
                                    + '</a>'
                                    + '</li></ul>'
                                ;
                                break;

                            case 2 :
                                this.tocContent  = this.tocContent + '<li class="tip"><a href="'
                                    + url
                                    + '#tip'
                                    + i
                                    +'">'
                                    +  this._elTitleElementText
                                    + '</a>'
                                    + '</li></ul></li></ul>'
                                ;
                                break;
                            case 3 :
                                this.tocContent  = this.tocContent + '<li class="tip"><a href="'
                                    + url
                                    + '#tip'
                                    + i
                                    +'">'
                                    +  this._elTitleElementText
                                    + '</a>'
                                    + '</li></ul></li></ul></li></ul>'
                                ;
                                break;
                            case 4 :
                                this.tocContent  = this.tocContent + '<li class="tip"><a href="'
                                    + url
                                    + '#tip'
                                    + i
                                    +'">'
                                    +  this._elTitleElementText
                                    + '</a>'
                                    + '</li></ul></li></ul></li></ul></li></ul>'
                                ;
                                break;
                            case 5 :
                                this.tocContent  = this.tocContent + '<li class="tip"><a href="'
                                    + url
                                    + '#tip'
                                    + i
                                    +'">'
                                    +  this._elTitleElementText
                                    + '</a>'
                                    + '</li></ul></li></ul></li></ul></li></ul></li></ul>'
                                ;
                                break;
                        }
                        this._tempLists.length = this._tempLists.length - y ;//更新栈的长度。
                    } else {
                        this._tempLists.push(this._elTitleElement);
                        this.tocContent  =  this.tocContent +  '<li class="tip"><a href="'
                            + url
                            + '#tip'
                            + i
                            +'">'
                            +  this._elTitleElementText
                            + '</a>'
                            + '<ul>'
                        ;
                    }
                }else{
                    this.tocContent  = this.tocContent
                        + '<li class="tip"><a href="'
                        + url
                        + '#tip'
                        + i
                        +'">'
                        +  this._elTitleElementText
                        + '</a></li>'
                    ;
                }
            }else{

                if(this._tempLists.length){

                    this.tocContent  = this.tocContent + '<li class="tip"><a href="'
                        + url
                        + '#tip'
                        + i
                        +'">'
                        +  this._elTitleElementText
                        + '</a>'
                    ;

                    for(var x = this._tempLists.length;x > 0 ;x-- ){
                        this.tocContent  += '</li></ul>' ;

                    }
                }else{
                    this.tocContent +=  '<li class="tip"><a href="'
                        + url
                        + '#tip'
                        + i
                        +'">'
                        +  this._elTitleElementText
                        + '</a></li>'
                }
            }
        }
        this.tocContent = '<ul>'+ this.tocContent + '</ul>';
    };

    Toc.prototype._showToc = function() {

        this.toc = document.createElement('div');
        this.toc.innerHTML = this.tocContent;
        this.toc.setAttribute('class',this.tocClass);
        if(! this.options.targetId){
            // 没有传入目标id，追加到生成目录的div内
            this.el.appendChild(this.toc);
        }else{
            //有传入目标id，直接在目标id内生成div
            document.getElementById(this.options.targetId).appendChild(this.toc);
        }

        var self = this;

        if(this.tocTop > -1){
            window.onscroll = function(){
				if(self.position != 'relative'){
					var t = document.documentElement.scrollTop || document.body.scrollTop;
					if(t< self.tocTop){
						self.toc.setAttribute('style','position:absolute;top:'+ self.tocTop +'px;');
					}else{
						self.toc.setAttribute('style','position:fixed;top:10px;');
					}
				}
             
            }
        }

    };

    window.Toc = Toc;

})(window);