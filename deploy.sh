#!/bin/sh

set -eu

BLOG_DIR="/root/workspace/blog"
stash_created=0

log() {
  echo "[deploy] $*"
}

restore_local_changes() {
  exit_code=$?
  trap - EXIT

  if [ "$stash_created" -eq 1 ]; then
    log "恢复远端 Gemfile.lock 本地修改"
    if ! git stash pop; then
      log "错误: 恢复远端 Gemfile.lock 失败"
      exit_code=1
    fi
  fi

  exit "$exit_code"
}

trap restore_local_changes EXIT

cd "$BLOG_DIR"
log "工作目录: $(pwd)"

if ! git diff --quiet -- Gemfile.lock; then
  log "临时保存远端 Gemfile.lock 本地修改"
  git stash push -m "deploy preserve local Gemfile.lock" -- Gemfile.lock
  stash_created=1
fi

log "拉取 origin/master"
git pull --ff-only origin master
log "当前提交: $(git rev-parse --short HEAD)"

log "检查 Bundler 依赖"
if ! bundle check; then
  log "警告: bundle check 未通过，继续使用系统 Jekyll 构建"
fi

log "构建 _deploy"
JEKYLL_NO_BUNDLER_REQUIRE=true jekyll build --destination _deploy
log "构建完成: $BLOG_DIR/_deploy"

ROOT_DIR="/www/wwwroot/dahai.online"
if [ -d "$ROOT_DIR" ]; then
  # 步骤 1: 将 sitemap.xml 同步到站点根目录，确保 https://dahai.online/sitemap.xml 无前缀直接访问
  if [ -f "$BLOG_DIR/_deploy/sitemap.xml" ]; then
    log "同步 sitemap.xml 到 $ROOT_DIR/sitemap.xml"
    cp "$BLOG_DIR/_deploy/sitemap.xml" "$ROOT_DIR/sitemap.xml"
  fi

  # 步骤 2: 将 robots.txt 同步到站点根目录，引导爬虫发现 sitemap
  if [ -f "$BLOG_DIR/_deploy/robots.txt" ]; then
    log "同步 robots.txt 到 $ROOT_DIR/robots.txt"
    cp "$BLOG_DIR/_deploy/robots.txt" "$ROOT_DIR/robots.txt"
  fi

  # 步骤 3: 将 llms.txt 同步到站点根目录，便于 AI 和大模型直接抓取索引
  if [ -f "$BLOG_DIR/_deploy/llms.txt" ]; then
    log "同步 llms.txt 到 $ROOT_DIR/llms.txt"
    cp "$BLOG_DIR/_deploy/llms.txt" "$ROOT_DIR/llms.txt"
  fi
fi

# 步骤 4: 自动向百度普通收录 API 推送最新博文 URL（失败不阻断部署）
if [ -x "$BLOG_DIR/push_baidu.sh" ]; then
  log "向百度普通收录 API 推送最新文章"
  "$BLOG_DIR/push_baidu.sh" || log "警告: 百度 API 推送未成功完成，继续完成部署"
fi
