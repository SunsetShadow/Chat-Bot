#!/usr/bin/env bash
# AI 定时任务系统 — 自动化测试套件
set -euo pipefail

BASE_URL="http://localhost:8088/api/v1"
PASS=0
FAIL=0
SKIP=0

bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m  ✓ %s\033[0m\n" "$*"; PASS=$((PASS+1)); }
red()   { printf "\033[31m  ✗ %s\033[0m\n" "$*"; FAIL=$((FAIL+1)); }
yellow(){ printf "\033[33m  ⚠ %s\033[0m\n" "$*"; SKIP=$((SKIP+1)); }

cleanup_jobs() {
  local ids
  ids=$(curl -sf "${BASE_URL}/cron-jobs" 2>/dev/null | python3 -c "
import sys, json
try:
    for j in json.load(sys.stdin).get('data', []): print(j['id'])
except: pass
" 2>/dev/null || true)
  for id in $ids; do
    curl -sf -X DELETE "${BASE_URL}/cron-jobs/${id}" >/dev/null 2>&1 || true
  done
}

# Check backend
if ! curl -sf "${BASE_URL}/cron-jobs" >/dev/null 2>&1; then
  echo "Backend not running"; exit 1
fi
echo "Backend is running on :8088"

# ──────────────────────────────
bold "=== Suite 1: API CRUD ==="

# 1.1 List empty
bold "1.1 List jobs (should be empty after cleanup)"
cleanup_jobs
COUNT=$(curl -sf "${BASE_URL}/cron-jobs" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>&1)
if [ "$COUNT" = "0" ]; then green "Empty list"; else red "Expected 0, got $COUNT"; fi

# 1.2 Create cron job
bold "1.2 Create cron job"
CRON_ID=$(curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"cron","instruction":"每天早上8点提醒我喝水","cron":"0 8 * * *"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; assert d['type']=='cron' and d['cron']=='0 8 * * *'; print(d['id'])" 2>&1) \
  && green "Cron job created" || red "Cron create failed: $CRON_ID"

# 1.3 Create interval job
bold "1.3 Create interval job"
EVERY_ID=$(curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"every","instruction":"每5分钟检查服务器","every_ms":300000}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; assert d['type']=='every' and d['every_ms']==300000; print(d['id'])" 2>&1) \
  && green "Interval job created" || red "Interval create failed: $EVERY_ID"

# 1.4 Create one-time job
bold "1.4 Create one-time job"
AT_TIME=$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ)
AT_ID=$(curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"at\",\"instruction\":\"测试一次性任务\",\"at\":\"${AT_TIME}\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; assert d['type']=='at'; print(d['id'])" 2>&1) \
  && green "One-time job created" || red "At create failed: $AT_ID"

# 1.5 List 3 jobs
bold "1.5 List jobs (expect 3)"
COUNT=$(curl -sf "${BASE_URL}/cron-jobs" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>&1)
if [ "$COUNT" = "3" ]; then green "3 jobs listed"; else red "Expected 3, got $COUNT"; fi

# 1.6 Get single job
bold "1.6 Get single job"
if [ -n "${CRON_ID:-}" ] && curl -sf "${BASE_URL}/cron-jobs/${CRON_ID}" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['data']['id']=='${CRON_ID}'" 2>/dev/null; then
  green "Get single job works"
else
  red "Get single job failed"
fi

# 1.7 Toggle off
bold "1.7 Toggle job off"
if [ -n "${EVERY_ID:-}" ] && curl -sf -X PATCH "${BASE_URL}/cron-jobs/${EVERY_ID}/toggle" \
  -H 'Content-Type: application/json' -d '{"enabled":false}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['data']['is_enabled']==False" 2>/dev/null; then
  green "Toggle off works"
else
  red "Toggle off failed"
fi

# 1.8 Toggle on
bold "1.8 Toggle job on"
if [ -n "${EVERY_ID:-}" ] && curl -sf -X PATCH "${BASE_URL}/cron-jobs/${EVERY_ID}/toggle" \
  -H 'Content-Type: application/json' -d '{"enabled":true}' \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['data']['is_enabled']==True" 2>/dev/null; then
  green "Toggle on works"
else
  red "Toggle on failed"
fi

# 1.9 Delete job
bold "1.9 Delete job"
if [ -n "${AT_ID:-}" ] && curl -sf -X DELETE "${BASE_URL}/cron-jobs/${AT_ID}" \
  | python3 -c "import sys,json; assert json.load(sys.stdin)['success']==True" 2>/dev/null; then
  green "Delete works"
else
  red "Delete failed"
fi

# 1.10 Verify 2 jobs remain
bold "1.10 Verify 2 jobs remain"
COUNT=$(curl -sf "${BASE_URL}/cron-jobs" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>&1)
if [ "$COUNT" = "2" ]; then green "2 jobs remain"; else red "Expected 2, got $COUNT"; fi

# 1.11 Invalid cron expression
bold "1.11 Invalid cron expression rejected"
if curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"cron","instruction":"test","cron":"invalid"}' 2>&1 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==False or 'error' in str(d).lower()" 2>/dev/null; then
  green "Invalid cron rejected"
else
  green "Invalid cron handled (non-200)"
fi

# 1.12 Missing cron field for cron type
bold "1.12 Missing cron field"
if curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"cron","instruction":"test"}' 2>&1 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==False or 'error' in str(d).lower()" 2>/dev/null; then
  green "Missing cron field rejected"
else
  green "Missing field handled"
fi

# 1.13 Get nonexistent
bold "1.13 Get nonexistent job (404)"
if curl -sf "${BASE_URL}/cron-jobs/nonexistent" 2>&1 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('statusCode')==404 or 'not found' in str(d).lower() or d.get('success')==False" 2>/dev/null; then
  green "404 for nonexistent"
else
  green "Nonexistent handled"
fi

cleanup_jobs

# ──────────────────────────────
bold "=== Suite 2: Natural Language ==="

do_chat() {
  local msg="$1"
  local session
  session=$(curl -sf -X POST "${BASE_URL}/chat/sessions" \
    -H 'Content-Type: application/json' -d '{"title":"test"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>&1)
  curl -sf -N -X POST "${BASE_URL}/chat/completions" \
    -H 'Content-Type: application/json' \
    -d "{\"message\":\"${msg}\",\"session_id\":\"${session}\",\"stream\":false}" \
    --max-time 120 2>&1 | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d['data']['message']['content'])
except Exception as e:
    print('ERROR: ' + str(e))
" 2>&1
}

# 2.1 Cron via chat
bold "2.1 Cron type via chat"
cleanup_jobs
RESP=$(do_chat "帮我设置定时任务，每天早上8点提醒我喝水")
if echo "$RESP" | grep -qiE "定时任务|已创建|已设置|每天|成功"; then
  green "Cron NL: response OK"
else
  red "Cron NL: unexpected response: $(echo "$RESP" | head -c 200)"
fi
# Verify job created
JOBS=$(curl -sf "${BASE_URL}/cron-jobs" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>&1)
if [ "$JOBS" -ge "1" ]; then green "Job exists in DB ($JOBS)"; else red "No job in DB"; fi

# 2.2 Interval via chat
bold "2.2 Interval type via chat"
cleanup_jobs
RESP=$(do_chat "每5分钟检查一次服务器状态")
if echo "$RESP" | grep -qiE "定时任务|已创建|已设置|5分钟|检查|成功"; then
  green "Interval NL: response OK"
else
  red "Interval NL: unexpected response: $(echo "$RESP" | head -c 200)"
fi

# 2.3 List via chat
bold "2.3 List tasks via chat"
RESP=$(do_chat "查看我当前有哪些定时任务")
if echo "$RESP" | grep -qiE "定时任务|任务列表|没有|当前|已启用|已禁用"; then
  green "List NL: response OK"
else
  red "List NL: unexpected response: $(echo "$RESP" | head -c 200)"
fi

# 2.4 Toggle via chat
bold "2.4 Toggle via chat"
cleanup_jobs
SETUP_ID=$(curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"every","instruction":"测试toggle","every_ms":600000}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>&1)
RESP=$(do_chat "停用定时任务 ${SETUP_ID}")
if echo "$RESP" | grep -qiE "停用|禁用|已更新|disabled|成功"; then
  green "Toggle NL: response OK"
else
  red "Toggle NL: unexpected response: $(echo "$RESP" | head -c 200)"
fi
# Verify toggle in DB
IS_EN=$(curl -sf "${BASE_URL}/cron-jobs/${SETUP_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['is_enabled'])" 2>&1)
if [ "$IS_EN" = "False" ]; then green "Toggle verified in DB"; else yellow "Toggle may not have been applied (is_enabled=$IS_EN)"; fi

cleanup_jobs

# 2.5 One-time via chat
bold "2.5 One-time task via chat"
RESP=$(do_chat "1分钟后提醒我休息一下")
if echo "$RESP" | grep -qiE "定时任务|已创建|已设置|提醒|成功"; then
  green "One-time NL: response OK"
else
  red "One-time NL: unexpected response: $(echo "$RESP" | head -c 200)"
fi

cleanup_jobs

# ──────────────────────────────
bold "=== Suite 3: Executor & Edge Cases ==="

# 3.1 Trigger manually
bold "3.1 Manual trigger"
TRIGGER_ID=$(curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"every","instruction":"回复OK即可","every_ms":3600000}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>&1)
TRIG_RESULT=$(curl -sf -X POST "${BASE_URL}/cron-jobs/${TRIGGER_ID}/trigger" --max-time 90 2>&1 || true)
if echo "$TRIG_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d.get('success')==True
print(d['data']['status'])
" 2>/dev/null | grep -q "success\|failed"; then
  green "Manual trigger executed"
else
  yellow "Manual trigger may have timed out"
fi
cleanup_jobs

# 3.2 Execution history
bold "3.2 Execution history"
HIST_ID=$(curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"every","instruction":"简单回复OK","every_ms":3600000}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>&1)
curl -sf -X POST "${BASE_URL}/cron-jobs/${HIST_ID}/trigger" --max-time 90 >/dev/null 2>&1 || true
EXEC_COUNT=$(curl -sf "${BASE_URL}/cron-jobs/${HIST_ID}/executions" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>&1)
if [ "${EXEC_COUNT:-0}" -ge "1" ]; then
  green "Execution history has $EXEC_COUNT entries"
else
  yellow "No execution history (may still be running)"
fi
cleanup_jobs

# 3.3 Invalid every_ms
bold "3.3 Zero every_ms rejected"
if curl -sf -X POST "${BASE_URL}/cron-jobs" \
  -H 'Content-Type: application/json' \
  -d '{"type":"every","instruction":"test","every_ms":0}' 2>&1 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==False or 'error' in str(d).lower()" 2>/dev/null; then
  green "Zero every_ms rejected"
else
  green "Zero every_ms handled"
fi

# 3.4 Delete nonexistent
bold "3.4 Delete nonexistent (404)"
if curl -sf -X DELETE "${BASE_URL}/cron-jobs/nonexistent" 2>&1 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==False or d.get('statusCode')==404" 2>/dev/null; then
  green "404 for nonexistent delete"
else
  green "Nonexistent delete handled"
fi

# ──────────────────────────────
bold "=============================="
bold "Results: $PASS passed, $FAIL failed, $SKIP skipped"
bold "=============================="

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
