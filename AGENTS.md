修改完后部署服务器 ssh blog sh /root/workspace/blog/deploy.sh
deploy.sh 会自动生成/同步 sitemap.xml、llms.txt 及 IndexNow 密钥，并向百度 API 与 IndexNow (Bing) 推送最新博文；亦可手动执行 ./push_baidu.sh [url] 或 ./push_indexnow.sh [url] 推送指定链接。
