killall python3 2>/dev/null
( python3 -m http.server 8060 >/tmp/http.log 2>&1 & )
sleep 1
cat test/install-transfer-import.mjs | sed -e 's/await runP4/if (false) await runP4/' | sed -e 's/if (false) await runP4cA/await runP4cA/' > test/install-transfer-import-fast.mjs
REPFORGE_URL=http://127.0.0.1:8060/ node test/install-transfer-import-fast.mjs 2>&1 | grep -A 10 -B 3 "P4c-A"
killall python3 2>/dev/null
