#!/usr/bin/env bash
# =============================================================================
# 百度收录主动推送脚本 (普通收录 API)
# 用途：把 mintstart.cn 的 URL 主动推送给百度，缩短 spider 发现时间。
#       对应百度搜索资源平台文章《「快速抓取」使用说明与权益获取》的 API 提交方式。
# 说明：推送 = 加速抓取，不保证收录；提交即占用配额，先小批量验证状态码。
#
# 用法：
#   1. 登录 https://ziyuan.baidu.com → 「搜索服务 - 链接提交 - 普通收录 - API提交」
#      复制站点域名与 token
#   2. 推送单个 URL：
#        ./baidu-url-push.sh https://mintstart.cn/
#   3. 推送多个 URL（文件每行一个）：
#        ./baidu-url-push.sh urls.txt
#
# 环境变量：
#   BAIDU_TOKEN  百度 API token（建议以环境变量传入，勿硬编码进 git）
#   可选覆盖接口地址（默认普通收录接口；若站点有“快速抓取”权益，
#   以后台实际给出的接口为准覆盖即可）：
#   BAIDU_API    POST 地址，默认 https://data.zz.baidu.com/urls
# =============================================================================

set -euo pipefail

SITE="https://mintstart.cn"
API="${BAIDU_API:-https://data.zz.baidu.com/urls}"
TOKEN="${BAIDU_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "[错误] 未设置 BAIDU_TOKEN。"
  echo "       请到 ziyuan.baidu.com → 链接提交 → 普通收录 → API提交 复制 token，"
  echo "       然后执行：BAIDU_TOKEN=你的token $0 <url|urls.txt>"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "用法: $0 <单个URL 或 每行一个URL的文本文件>"
  exit 1
fi

# ---------- 组装要推送的 URL 列表 ----------
if [[ -f "$1" ]]; then
  # 过滤空行、去重；仅保留 mintstart.cn 的 https 链接
  mapfile -t URLS < <(grep -E '^https://mintstart\.cn/' "$1" | sort -u)
  [[ ${#URLS[@]} -eq 0 ]] && { echo "[错误] 文件里没有合法的 mintstart.cn URL"; exit 1; }
else
  case "$1" in
    https://mintstart.cn/*|https://mintstart.cn) URLS=("$1") ;;
    *) echo "[错误] 仅支持 https://mintstart.cn/ 开头的链接"; exit 1 ;;
  esac
fi

echo "站点: $SITE"
echo "接口: $API"
echo "本次推送 ${#URLS[@]} 条:"
printf '  %s\n' "${URLS[@]}"

# ---------- 推送（POST body 每行一个 URL）----------
BODY=$(printf '%s\n' "${URLS[@]}")
echo "----------------------------------------"
curl -s -m 30 -H 'Content-Type:text/plain' --data-binary "$BODY" \
  "$API?site=${SITE}&token=${TOKEN}" | python3 -m json.tool --no-ensure-ascii 2>/dev/null || true
echo "----------------------------------------"
echo "字段说明: success=成功条数 / remain=今日剩余配额 / not_same_site=非本站链接被拒"
