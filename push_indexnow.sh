#!/bin/sh

set -eu

API_URL="https://api.indexnow.org/indexnow"
HOST="dahai.online"
KEY="6cba777ce8eea246ac93738da8d8592c"
KEY_LOCATION="https://dahai.online/6cba777ce8eea246ac93738da8d8592c.txt"
BLOG_DIR="$(cd "$(dirname "$0")" && pwd)"
SITEMAP_FILE="$BLOG_DIR/_deploy/sitemap.xml"

# 步骤 1: 确定待推送的 URL 列表（支持外部参数指定，缺省自动获取最新 1 篇）
if [ $# -gt 0 ]; then
  urls=$(printf "%s\n" "$@")
else
  if [ -f "$SITEMAP_FILE" ]; then
    urls=$(grep -o 'https://dahai.online/blog/[^<]*\.html' "$SITEMAP_FILE" | grep -v 'archives\.html' | head -n 1)
  else
    latest_filename=$(ls -1 "$BLOG_DIR/_posts" 2>/dev/null | sort -r | head -n 1 | sed -E 's/\.(markdown|md)$/\.html/')
    urls="https://dahai.online/blog/$latest_filename"
  fi
fi

if [ -z "$urls" ]; then
  echo "[push_indexnow] 未找到待推送的 URL"
  exit 0
fi

# 步骤 2: 格式化待推送的 URL 并组装 IndexNow JSON 请求体
echo "[push_indexnow] 准备推送以下 URL 到 IndexNow (Bing/Yandex/Seznam) API:"
echo "$urls"

json_urls=$(echo "$urls" | awk '{ if (NR > 1) printf ",\n"; printf "    \"%s\"", $0 }')
payload=$(cat <<EOF
{
  "host": "$HOST",
  "key": "$KEY",
  "keyLocation": "$KEY_LOCATION",
  "urlList": [
$json_urls
  ]
}
EOF
)

# 步骤 3: 发送 HTTP POST 请求到 IndexNow API 并解析响应状态码
http_code=$(echo "$payload" | curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json; charset=utf-8" --data-binary @- "$API_URL")

if [ "$http_code" = "200" ] || [ "$http_code" = "202" ]; then
  echo "[push_indexnow] 推送成功，HTTP 状态码: $http_code (已成功接收并进入分发)"
else
  echo "[push_indexnow] 警告: 接口响应异常，HTTP 状态码: $http_code"
  exit 1
fi
