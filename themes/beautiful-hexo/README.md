# [Beautiful-hexo  ] (http://twoyao.cn/beautiful-hexo/)[![hexo](https://img.shields.io/badge/Hexo-v3.1%2B-blue.svg)](https://hexo.io/)

Beautiful-hexo is a simple elegant hexo theme ported from [Beautiful-jekyll](http://deanattali.com/beautiful-jekyll) which written by [Dean Attali](http://deanattali.com/aboutme). Nice work!

![hexo-preview](images/hexo-preview.png)

### Install

```
hexo init site 
cd site
npm install --save hexo-generator-archive hexo-renderer-jade hexo-generator-tag hexo-generator-feed hexo-generator-sitemap hexo-browsersync 
git clone --depth 1 git@github.com:twoyao/beautiful-hexo.git themes/beautiful-hexo
```


Modify `_config.yml` change `theme` to `beautiful-hexo` and configure hexo-generator-archive :

```
theme: beautiful-hexo

archive_generator:
    per_page: 0
    yearly: false
    monthly: false
    daily: false
```

Theme config file is brief and clear. 
If you have any question, check [hexo online document](https://hexo.io/).
