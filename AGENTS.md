修改完后部署服务器 ssh blog sh /root/workspace/blog/deploy.sh
deploy.sh 会自动生成/同步 sitemap.xml、llms.txt 及 IndexNow 密钥，并向百度 API 与 IndexNow (Bing) 推送最新博文；亦可手动执行 ./push_baidu.sh [url] 或 ./push_indexnow.sh [url] 推送指定链接。

站点已不再使用 Jekyll，由 Node 脚本构建：
- 构建：npm install && npm run build（产物在 _deploy/，nginx 将 /blog 指向它）
- 本地预览：npm run serve，访问 http://localhost:4000/（/ 为首页，/blog/ 为文章）
- 文章：_posts/YYYY-MM-DD-slug.markdown，front matter 支持 title、date、categories、tags；正文可用 {{ site.baseurl }}，`<!--more-->` 之前为摘要
- 独立页面：pages/*.md|html（输出为 /blog/<name>.html）
- 首页作品：home/works.json；站点配置：site.json；样式与脚本：static/site.css、static/site.js
- 模板与构建逻辑：tools/build.mjs
