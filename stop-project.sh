#!/usr/bin/env bash
#
# Experiment 2 - stop the running server. (site + API; MongoDB itself is not stopped)
#
#   ./stop-project.sh
#
# Stops ONLY Experiment 2:
#   * the PM2 app named "experiment2-4000", if PM2 is in use, and/or
#   * the process recorded in logs/experiment2.pid, but only after ps confirms
#     its command line contains this project's exact absolute server/index.js path.
#
# It never kills a process it has not positively identified as Experiment 2,
# and it never touches Experiment 1.
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

APP_NAME="experiment2-4000"

# Fixed deployment port. Must stay in sync with env.PORT in
# ecosystem.config.cjs and with build-and-run.sh. Not overridable, so this
# script can never check a different port from the one PM2 actually serves.
PORT=4000
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOG_DIR/experiment2.pid"
SERVER_ENTRY="$PROJECT_ROOT/server/index.js"

# build-and-run.sh calls this script with QUIET_STOP=1 before redeploying.
QUIET="${QUIET_STOP:-0}"
say() { [ "$QUIET" = "1" ] || echo "$@"; }

have() { command -v "$1" >/dev/null 2>&1; }

port_in_use() {
  if have ss; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${PORT}$"
  elif have lsof; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
  else
    node -e '
      const net = require("net");
      const s = net.connect(Number(process.argv[1]), "127.0.0.1");
      s.on("connect", () => { s.destroy(); process.exit(0); });
      s.on("error", () => process.exit(1));
      setTimeout(() => { s.destroy(); process.exit(1); }, 1500);
    ' "$PORT" 2>/dev/null
  fi
}

say "=================================================="
say " Stopping Experiment 2"
say "=================================================="

STOPPED_SOMETHING=0

# ---------------------------------------------------------------------------
# 1) PM2-managed instance
# ---------------------------------------------------------------------------
if have pm2; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    say "[1/3] Stopping PM2 app '$APP_NAME'..."
    pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
    STOPPED_SOMETHING=1
  else
    say "[1/3] No PM2 app named '$APP_NAME' is registered."
  fi
else
  say "[1/3] PM2 is not installed - skipping PM2 shutdown."
fi

# ---------------------------------------------------------------------------
# 2) nohup-managed instance recorded in the PID file
# ---------------------------------------------------------------------------
if [ -f "$PID_FILE" ]; then
  PID="$(tr -dc '0-9' < "$PID_FILE" || true)"
  if [ -z "$PID" ]; then
    say "[2/3] PID file is empty or invalid - removing it."
    rm -f "$PID_FILE"
  elif ! kill -0 "$PID" 2>/dev/null; then
    say "[2/3] Stale PID file (process $PID is not running) - removing it."
    rm -f "$PID_FILE"
  else
    # Safety gate: the PID is killed ONLY when ps positively confirms that its
    # command line contains this project's exact absolute server/index.js path.
    # A PID can be recycled by the kernel and handed to an unrelated process,
    # so anything less than an exact match is not proof. If ps is missing, or
    # returns nothing, we cannot verify - and we never kill what we cannot
    # verify.
    CMDLINE=""
    if have ps; then
      CMDLINE="$(ps -p "$PID" -o args= 2>/dev/null || true)"
    fi

    if [ -z "$CMDLINE" ]; then
      say "[2/3] WARNING: cannot verify process $PID (ps is unavailable or"
      say "      returned no command line). It was NOT killed."
      say "      Removing the unverifiable PID file. Check it yourself with:"
      say "        ps -p $PID -o pid,args"
      rm -f "$PID_FILE"
    else
      case "$CMDLINE" in
        *"$SERVER_ENTRY"*)
          say "[2/3] Stopping Experiment 2 process $PID..."
          kill "$PID" 2>/dev/null || true
          for _ in $(seq 1 10); do
            kill -0 "$PID" 2>/dev/null || break
            sleep 1
          done
          if kill -0 "$PID" 2>/dev/null; then
            say "      Process did not exit after SIGTERM - sending SIGKILL."
            kill -9 "$PID" 2>/dev/null || true
            sleep 1
          fi
          rm -f "$PID_FILE"
          STOPPED_SOMETHING=1
          ;;
        *)
          say "[2/3] PID $PID is not this project's server - leaving it alone."
          say "      Expected to find: $SERVER_ENTRY"
          say "      Actual command line: $CMDLINE"
          rm -f "$PID_FILE"
          ;;
      esac
    fi
  fi
else
  say "[2/3] No PID file at $PID_FILE."
fi

# ---------------------------------------------------------------------------
# 3) Confirm the port was released
# ---------------------------------------------------------------------------
sleep 1
if port_in_use; then
  say "[3/3] WARNING: something is still listening on port $PORT."
  if have ss; then
    ss -ltnp 2>/dev/null | grep -E "[:.]${PORT}[[:space:]]" || true
  elif have lsof; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  fi
  say ""
  say "It was not killed, because it is not a process this script started."
  say "If it is the old Experiment 1, stop it from the Experiment 1 folder."
  exit 1
fi

say "[3/3] Port $PORT is free."
say ""
if [ "$STOPPED_SOMETHING" = "1" ]; then
  say "Experiment 2 stopped successfully."
else
  say "Experiment 2 was not running - nothing to stop."
fi
say "=================================================="
exit 0
