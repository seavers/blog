#!/bin/sh

set -eu

API_URL="http://data.zz.baidu.com/urls?site=https://dahai.online&token=bnYATDJC4XqFbdn9"
BLOG_DIR="$(cd "$(dirname "$0")" && pwd)"
SITEMAP_FILE="$BLOG_DIR/_deploy/sitemap.xml"

# 步骤 1: 确定待推送的 URL 列表（支持参数指定，缺省自动获取最新 1 篇）
if [ $# -gt 0 ]; then
  urls="$*"
else
  if [ -f "$SITEMAP_FILE" ]; then
    urls=$(grep -o 'https://dahai.online/blog/[^<]*\.html' "$SITEMAP_FILE" | grep -v 'archives\.html' | head -n 1)
  else
    latest_filename=$(ls -1 "$BLOG_DIR/_posts" 2>/dev/null | sort -r | head -n 1 | sed -E 's/\.(markdown|md)$/\.html/')
    urls="https://dahai.online/blog/$latest_filename"
  fi
fi

if [ -z "$urls" ]; then
  echo "[push_baidu] 未找到待推送的 URL"
  exit 0
fi

# 步骤 2: 输出待推送列表并调用百度主动推送接口
echo "[push_baidu] 准备推送以下 URL 到百度收录 API:"
echo "$urls"

response=$(echo "$urls" | curl -s -X POST -H "Content-Type: text/plain" --data-binary @- "$API_URL")

echo "[push_baidu] 百度接口响应: $response"
