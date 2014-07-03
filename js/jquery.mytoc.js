/*!
 * mytoc - jQuery Table of Contents Plugin
 * v0.0.1
 * http://www.cafestop.net
 * copyright Cafestop 2013
 * MIT License
*/
(function($) {
    $.fn.extend({
        mytoc: function(options) {
            //default paramerters
            var defaultParams = {
                prefix: 'mytoc',
                selectors: 'h1, h2, h3',
                context: 'body'
            };

            //use user settings override default options
            var opts = $.extend({}, defaultParams, options);
            //get all heading elements in given context
            var headings = $(opts.selectors, opts.context);
            //prepend <span id=prefix+i> to each headings
            headings.each(function(i) {
                $('<span/>').attr('id', opts.prefix + i).insertBefore(this);
            });

            //add animation while jumping to target heading
            var scrollTo = function(e){
                e.preventDefault();
                var targetPos = $(e.target).attr('href');
                var scrollTo = $(targetPos).offset().top;
                $('body').animate({scrollTop:scrollTo}, 400, 'swing', function(){
                    location.hash = targetPos;
                });
            };

            return $(this).each(function(i) {
                var ul = $('<ul/>').attr('id', 'mytoc');
                headings.each(function(i) {
                    var a = $('<a/>').attr('href', '#' + opts.prefix + i).text($(this).text()).bind('click', scrollTo);
                    var li = $('<li/>').addClass(this.tagName.toLowerCase() + '-' + opts.prefix).append(a);
                    ul.append(li);
                });
                $(this).html(ul);
            });

        }

    });

})(jQuery);