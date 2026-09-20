#!/usr/bin/env bash
# ---------------------------------------------------------------
# ViCons → GitHub 推送腳本
#
# 用途：把本機 commit 推上 GitHub（repo 已存在時直接設定 remote 推送；
#       不存在時可用 gh 建一個 repo）。
#
# 前提：git 已能對 github.com 認證（gh auth login 或 Git Credential Manager）。
#
# 用法：
#   bash push-to-github.sh                              # 預設 minestormvictor-art/ViCons
#   bash push-to-github.sh owner/repo                   # 指定目標
#   bash push-to-github.sh owner/repo --private         # 不存在時建 private repo
# ---------------------------------------------------------------
set -uo pipefail

TARGET="${1:-minestormvictor-art/ViCons}"
VISIBILITY="${2:---public}"

OWNER="${TARGET%%/*}"
REPO="${TARGET##*/}"
if [ "$OWNER" = "$TARGET" ] || [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "✗ 目標格式須為 owner/repo，實得：$TARGET"
  exit 1
fi

GH=""
if command -v gh >/dev/null 2>&1; then GH="$(command -v gh)"
elif [ -x "/c/Program Files/GitHub CLI/gh.exe" ]; then GH="/c/Program Files/GitHub CLI/gh.exe"
fi

cd "$(dirname "$0")"

echo "════════════════════════════════════════"
echo "  ViCons → GitHub"
echo "  目標：$OWNER/$REPO"
echo "════════════════════════════════════════"
echo ""

# ---- 0. 前置檢查 ----
echo "── 0. 前置檢查 ──"
git rev-parse --git-dir >/dev/null 2>&1 || { echo "  ✗ 這裡不是 git repo"; exit 1; }
BRANCH="$(git branch --show-current)"
echo "  ✓ git repo 正常"
echo "  ✓ 分支：$BRANCH"
echo "  ✓ 追蹤檔案：$(git ls-files | wc -l | tr -d ' ') 個"
if [ -n "$(git status --porcelain)" ]; then
  echo "  ⚠ 有未提交的變更（本腳本只推已 commit 的內容）"
fi
echo ""

# ---- 1. 推送前安全複掃 ----
echo "── 1. 推送前敏感字串複掃 ──"
# 敏感詞清單刻意「不入庫」——清單本身若入庫，就等於把要保護的名字公開出去。
# 真正清單放 _sensitive-patterns.txt（已列入 .gitignore）；找不到就中止（fail closed）。
PATFILE="_sensitive-patterns.txt"
if [ ! -f "$PATFILE" ]; then
  echo "  ✗ 找不到 $PATFILE —— 安全閘門無法執行，已中止推送。"
  echo ""
  echo "    請由範例複製一份再填入："
  echo "        cp _sensitive-patterns.example.txt _sensitive-patterns.txt"
  echo "    每行一條 grep -E 樣式。"
  exit 1
fi
SENSITIVE_PATTERNS="$( { grep -vE '^[[:space:]]*(#|$)' "$PATFILE" || true; } | paste -sd '|' - )"
if [ -z "$SENSITIVE_PATTERNS" ]; then
  echo "  ✗ $PATFILE 內沒有有效樣式，已中止推送。"
  exit 1
fi
echo "  · 已載入 $(printf '%s' "$SENSITIVE_PATTERNS" | tr '|' '\n' | wc -l | tr -d ' ') 條敏感樣式"
LEAK="$( { git ls-files -z | xargs -0 grep -l -E "$SENSITIVE_PATTERNS" 2>/dev/null || true; } )"
if [ -n "$LEAK" ]; then
  echo "  ✗ 偵測到敏感字串，已中止推送："
  echo "$LEAK" | sed 's/^/    /'
  echo ""
  echo "    請先移除敏感資料再推送。"
  exit 1
fi
echo "  ✓ 0 敏感字串"
echo ""

# ---- 2. 設定 remote ----
echo "── 2. 設定 remote ──"
URL="https://github.com/$OWNER/$REPO.git"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$URL"
  echo "  ✓ origin 已更新 → $URL"
else
  git remote add origin "$URL"
  echo "  ✓ origin 已新增 → $URL"
fi
echo ""

# ---- 3. 推送 ----
echo "── 3. 推送 ──"
if [ -n "$GH" ] && "$GH" auth status >/dev/null 2>&1; then
  if "$GH" auth setup-git >/dev/null 2>&1; then
    echo "  ✓ git credential helper 已設定"
  else
    echo "  ⚠ 未能設定 git credential helper"
  fi
fi
if ! GIT_TERMINAL_PROMPT=0 git ls-remote "$URL" >/dev/null 2>&1; then
  echo "  ✗ 無法讀取遠端 —— git 未認證，或 repo 不存在／無權限。"
  echo ""
  echo "    若未認證，任選其一："
  echo "      gh auth login        # GitHub.com → HTTPS → 用瀏覽器登入"
  echo "      直接 git push        # 由 Git Credential Manager 彈窗登入"
  echo ""
  echo "    若 repo 不存在，可用 gh 建立："
  echo "      gh repo create $OWNER/$REPO $VISIBILITY --source=. --remote=origin --push"
  exit 1
fi
echo "  ✓ 遠端可讀取"
git push -u origin "$BRANCH"
echo ""

# ---- 4. 收尾核對 ----
echo "════════════════════════════════════════"
echo "  推送完成"
echo "════════════════════════════════════════"
echo ""
LOCAL_SHA="$(git rev-parse "$BRANCH")"
# 直接問遠端（ls-remote）—— 不依賴本機 remote-tracking ref，
# 後者推完不一定即時更新，會誤報「兩端不同」。
REMOTE_SHA="$(git ls-remote "$URL" "refs/heads/$BRANCH" 2>/dev/null | cut -f1)"
[ -n "$REMOTE_SHA" ] || REMOTE_SHA="(讀不到)"
echo "  本地 $BRANCH ：$LOCAL_SHA"
echo "  遠端 $BRANCH ：$REMOTE_SHA"
if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "  ✓ 兩端一致"
else
  echo "  ⚠ 兩端 SHA 不同，請再確認"
fi
echo ""
echo "  repo：https://github.com/$OWNER/$REPO"
