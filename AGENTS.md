修改完后部署服务器 ssh blog sh /root/workspace/blog/deploy.sh
deploy.sh 会自动生成/同步 sitemap.xml 并向百度普通收录 API 推送最新博文；亦可手动执行 ./push_baidu.sh [url] 推送指定链接。
