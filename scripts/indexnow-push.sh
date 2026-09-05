#!/usr/bin/env bash
# =============================================================================
# IndexNow 主动推送脚本
# 用途：URL 变更时即时通知 IndexNow 联盟引擎（Bing / Yandex / Naver / Seznam
#       / Yep），一次推送全部收到。Bing 索引是 ChatGPT Search / Perplexity /
#       Copilot 的引用来源，与本站 GEO 目标直接相关。
# 前提：域名根目录已部署 key 文件（public/ 下的 <key>.txt，随站点一起上线）。
# 说明：IndexNow = 通知，不保证收录；仅在发布新页/大改时推送，勿每日重复刷。
#
# 用法：
#   推送单个 URL：        ./indexnow-push.sh https://mintstart.cn/
#   批量（文件每行一个）： ./indexnow-push.sh urls.txt
#
# 参考：https://www.indexnow.org / https://www.bing.com/indexnow
# =============================================================================

set -euo pipefail

HOST="mintstart.cn"
KEY="59acf53cf1e1426b3684fe94ecb58e04"   # 与 public/<KEY>.txt 保持一致
API="${INDEXNOW_API:-https://api.indexnow.org/indexnow}"
KEY_LOCATION="https://${HOST}/${KEY}.txt"

if [[ $# -lt 1 ]]; then
  echo "用法: $0 <单个URL 或 每行一个URL的文本文件>"
  exit 1
fi

# ---------- 组装 URL 列表 ----------
if [[ -f "$1" ]]; then
  mapfile -t URLS < <(grep -E '^https://mintstart\.cn/' "$1" | sort -u)
  [[ ${#URLS[@]} -eq 0 ]] && { echo "[错误] 文件里没有合法的 mintstart.cn URL"; exit 1; }
else
  case "$1" in
    https://mintstart.cn/*|https://mintstart.cn) URLS=("$1") ;;
    *) echo "[错误] 仅支持 https://mintstart.cn/ 开头的链接"; exit 1 ;;
  esac
fi

echo "key 文件: $KEY_LOCATION (需可公开访问, Bing 会校验)"
echo "本次推送 ${#URLS[@]} 条:"
printf '  %s\n' "${URLS[@]}"

# ---------- POST（JSON，手拼避免依赖 jq）----------
PAYLOAD="{\"host\":\"${HOST}\",\"key\":\"${KEY}\",\"keyLocation\":\"${KEY_LOCATION}\",\"urlList\":["
FIRST=1
for u in "${URLS[@]}"; do
  if [[ $FIRST -eq 1 ]]; then FIRST=0; else PAYLOAD+=","; fi
  PAYLOAD+="\"${u}\""
done
PAYLOAD+="]}"

echo "----------------------------------------"
HTTP_CODE=$(curl -s -o /tmp/indexnow_resp.$$ -w "%{http_code}" -m 30 \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data "$PAYLOAD" "$API")
echo "HTTP $HTTP_CODE"
[[ -s /tmp/indexnow_resp.$$ ]] && cat /tmp/indexnow_resp.$$ && echo
rm -f /tmp/indexnow_resp.$$
echo "----------------------------------------"
echo "200/202 = 已接收（通知类接口通常不返回正文）；非 2xx = 推送失败"
