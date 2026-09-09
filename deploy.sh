#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="blog"
REMOTE_DIR="/root/workspace/blog"

# 先同步服务端源码，确保部署使用远端 master 的最新提交。
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && git pull --ff-only origin master"

# 校验锁定依赖后构建到 Nginx 实际映射的发布目录。
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && bundle check && bundle exec jekyll build --destination _deploy"

echo "博客部署完成：$REMOTE_HOST:$REMOTE_DIR/_deploy"
