#!/bin/sh

set -eu

BLOG_DIR="/root/workspace/blog"
ROOT_INDEX="/www/wwwroot/dahai.online/index.html"
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

log "同步根域名首页到 $ROOT_INDEX"
cp "$BLOG_DIR/_deploy/index.html" "$ROOT_INDEX"
log "根域名首页同步完成"
