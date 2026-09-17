#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="blog"
REMOTE_DIR="/root/workspace/blog"

# 在服务端串行执行同步、依赖检查和构建，确保日志能对应本次部署。
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

stash_created=0

restore_local_changes() {
  if [ "$stash_created" -eq 1 ]; then
    echo "[deploy] 恢复远端 Gemfile.lock 本地修改"
    git stash pop
  fi
}

trap restore_local_changes EXIT

echo "[deploy] 工作目录: $(pwd)"

if ! git diff --quiet -- Gemfile.lock; then
  echo "[deploy] 临时保存远端 Gemfile.lock 本地修改"
  git stash push -m "deploy preserve local Gemfile.lock" -- Gemfile.lock
  stash_created=1
fi

echo "[deploy] 拉取 origin/master"
git pull --ff-only origin master
echo "[deploy] 当前提交: $(git rev-parse --short HEAD)"

echo "[deploy] 检查 Bundler 依赖"
if ! bundle check; then
  echo "[deploy] 警告: bundle check 未通过，继续尝试使用现有依赖构建"
fi

echo "[deploy] 构建 _deploy"
JEKYLL_NO_BUNDLER_REQUIRE=true jekyll build --destination _deploy
echo "[deploy] 构建完成: $(pwd)/_deploy"
REMOTE_SCRIPT

echo "[deploy] 博客部署完成：$REMOTE_HOST:$REMOTE_DIR/_deploy"
