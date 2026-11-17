#!/bin/sh
# 博客部署脚本（服务器上执行：ssh blog sh /root/workspace/blog/deploy.sh）
# 构建由 Node 脚本 tools/build.mjs 完成，不再依赖 Jekyll / Ruby。

set -eu

BLOG_DIR="/root/workspace/blog"
ROOT_DIR="/www/wwwroot/dahai.online"

log() {
  echo "[deploy] $*"
}

cd "$BLOG_DIR"
log "工作目录: $(pwd)"

log "拉取 origin/master"
git pull --ff-only origin master
log "当前提交: $(git rev-parse --short HEAD)"

# 依赖只有 marked 与 highlight.js；node_modules 缺失或 package-lock.json 更新时重新安装
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  log "安装 Node 依赖"
  npm ci --omit=dev --no-audit --no-fund
  touch node_modules
fi

log "构建 _deploy"
node tools/build.mjs _deploy

if [ -d "$ROOT_DIR" ]; then
  # 站点根目录文件：首页、sitemap、robots、llms.txt、IndexNow 密钥
  log "同步首页到 $ROOT_DIR/index.html"
  cp "$BLOG_DIR/_deploy/home/index.html" "$ROOT_DIR/index.html"

  for f in sitemap.xml robots.txt llms.txt; do
    log "同步 $f 到 $ROOT_DIR/$f"
    cp "$BLOG_DIR/_deploy/$f" "$ROOT_DIR/$f"
  done

  if [ -f "$BLOG_DIR/6cba777ce8eea246ac93738da8d8592c.txt" ]; then
    log "同步 IndexNow 密钥到 $ROOT_DIR/6cba777ce8eea246ac93738da8d8592c.txt"
    cp "$BLOG_DIR/6cba777ce8eea246ac93738da8d8592c.txt" "$ROOT_DIR/6cba777ce8eea246ac93738da8d8592c.txt"
  fi
fi

# 向百度普通收录 API 推送最新博文 URL（失败不阻断部署）
if [ -x "$BLOG_DIR/push_baidu.sh" ]; then
  log "向百度普通收录 API 推送最新文章"
  "$BLOG_DIR/push_baidu.sh" || log "警告: 百度 API 推送未成功完成，继续完成部署"
fi

# 向 IndexNow API (Bing/Yandex) 推送最新博文 URL（失败不阻断部署）
if [ -x "$BLOG_DIR/push_indexnow.sh" ]; then
  log "向 IndexNow (Bing/Yandex) 推送最新文章"
  "$BLOG_DIR/push_indexnow.sh" || log "警告: IndexNow 推送未成功完成，继续完成部署"
fi

log "完成"
