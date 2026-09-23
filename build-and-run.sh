#!/usr/bin/env bash
#
# Experiment 2 - build and run on the remote Linux server.
#
#   chmod +x build-and-run.sh stop-project.sh
#   ./build-and-run.sh
#
# Loads the MongoDB settings from .env, installs dependencies, builds the
# Vite/React site, confirms MongoDB accepts the login, frees port 4000 from the
# old Experiment 1 process, and starts ONE Node process on 0.0.0.0:4000 that
# serves both the study pages and the /api that writes to MongoDB. The process
# survives an SSH disconnect.
#
# The deployment port is fixed at 4000 (see PORT/HOST below).
#
# Optional environment overrides:
#   FORCE_FREE_PORT=1      free the port even if something other than the known
#                          Experiment 1 / Experiment 2 processes still holds it
#   SKIP_INSTALL=1         reuse the existing node_modules (faster re-deploys)
#
set -euo pipefail

# Resolve the project directory from the script's own location, so the script
# works no matter which directory it is invoked from and contains no hardcoded
# server path.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

APP_NAME="experiment2-4000"
EXP1_APP_NAME="unified-4000"          # the PM2 app name used by Experiment 1

# Fixed deployment values. PM2 reads env.PORT / env.HOST from
# ecosystem.config.cjs, so these are deliberately NOT overridable from the
# environment: an override here would leave this script checking one port while
# PM2 served another. To change the port, change it in BOTH this file and
# ecosystem.config.cjs (and stop-project.sh).
PORT=4000
HOST=0.0.0.0

ENV_FILE="$PROJECT_ROOT/.env"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/server.log"
PID_FILE="$LOG_DIR/experiment2.pid"
DIST_DIR="$PROJECT_ROOT/dist"
SERVER_ENTRY="$PROJECT_ROOT/server/index.js"

echo "=================================================="
echo " Experiment 2 - build and deploy"
echo "=================================================="
echo "Project : $PROJECT_ROOT"
echo "Port    : $PORT"
echo ""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

# Is anything listening on $PORT? Uses ss when available, otherwise lsof,
# otherwise a plain TCP connect probe through Node. None of these need sudo.
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
    ' "$PORT"
  fi
}

show_port_owner() {
  if have ss; then
    ss -ltnp 2>/dev/null | grep -E "[:.]${PORT}[[:space:]]" || true
  elif have lsof; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  fi
}

# GETs a path on the local server and prints the body. The path is passed
# WITHOUT its leading "/" (added inside Node), so no shell rewrites it as a
# file path. Uses Node's core http
# module with no keep-alive and lets the process end on its own (exitCode, not
# process.exit), so no socket is still closing when Node shuts down.
http_get() {
  node -e '
    const http = require("http");
    const req = http.get(
      { host: "127.0.0.1", port: Number(process.argv[1]), path: "/" + (process.argv[2] || ""), agent: false, timeout: 4000 },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          process.stdout.write(data);
          process.exitCode = res.statusCode === 200 ? 0 : 1;
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => { process.exitCode = 1; });
  ' "$PORT" "$1" 2>/dev/null
}

# Healthy = the API answers AND reaches MongoDB (/api/health runs a query),
# AND the study page itself is served.
health_ok() {
  local api page
  api="$(http_get api/health)" || return 1
  case "$api" in *'"ok":true'*) ;; *) return 1 ;; esac
  page="$(http_get "")" || return 1
  case "$page" in *'id="root"'*) return 0 ;; *) return 1 ;; esac
}

# Reads KEY=VALUE lines from .env without executing anything in it (no
# `source`, no eval), so a stray character in a password cannot run as a
# command. Surrounding quotes are removed. PORT/HOST/NODE_ENV are ignored
# because this deployment fixes them.
load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    if ! [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "      WARNING: ignoring an invalid line in .env (key '$key')"
      continue
    fi
    case "$key" in
      PORT|HOST|NODE_ENV)
        echo "      NOTE: $key in .env is ignored (this deployment fixes it)"
        continue ;;
    esac
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    export "$key=$value"
  done < "$file"
}

# ---------------------------------------------------------------------------
# 1) Toolchain checks
# ---------------------------------------------------------------------------
echo "[1/9] Checking required tools..."
if ! have node; then
  echo "ERROR: 'node' was not found in PATH. Install Node.js 20.19+ or 22.12+." >&2
  exit 1
fi
if ! have npm; then
  echo "ERROR: 'npm' was not found in PATH." >&2
  exit 1
fi

# Vite 8 and the MongoDB 7 driver both require ^20.19.0 || >=22.12.0.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
NODE_OK=0
if [ "$NODE_MAJOR" -gt 22 ]; then NODE_OK=1
elif [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 12 ]; then NODE_OK=1
elif [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -ge 19 ]; then NODE_OK=1
fi
if [ "$NODE_OK" -ne 1 ]; then
  echo "ERROR: Node.js 20.19+ or 22.12+ is required (found $(node -v))." >&2
  exit 1
fi
echo "      node $(node -v) / npm $(npm -v)"

if [ ! -f "$SERVER_ENTRY" ]; then
  echo "ERROR: server/index.js is missing from $PROJECT_ROOT" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

# ---------------------------------------------------------------------------
# 2) MongoDB settings from .env
# ---------------------------------------------------------------------------
echo ""
echo "[2/9] Loading MongoDB settings from .env..."
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE does not exist." >&2
  echo "Create it on the server from the template:" >&2
  echo "  cp .env.example .env && nano .env && chmod 600 .env" >&2
  exit 1
fi
load_env_file "$ENV_FILE"

if [ -z "${MONGO_URL:-}" ] || [ -z "${MONGO_DB:-}" ]; then
  echo "ERROR: .env must define both MONGO_URL and MONGO_DB." >&2
  exit 1
fi
case "$MONGO_URL" in
  *CHANGE_ME*)
    echo "ERROR: MONGO_URL in .env still contains the placeholder CHANGE_ME." >&2
    echo "Put the real password for the database user there." >&2
    exit 1 ;;
esac

# Warn (not fail) if other users on the server can read the password file.
ENV_PERMS="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
if [ -n "$ENV_PERMS" ] && [ "$ENV_PERMS" != "600" ] && [ "$ENV_PERMS" != "400" ]; then
  echo "      WARNING: .env permissions are $ENV_PERMS - run: chmod 600 .env"
fi
echo "      Database: $MONGO_DB"
echo "      Server  : $(printf '%s' "$MONGO_URL" | sed -E 's#//([^:@/]+):[^@/]*@#//\1:***@#')"

# ---------------------------------------------------------------------------
# 3) Dependencies
# ---------------------------------------------------------------------------
echo ""
echo "[3/9] Installing dependencies..."
if [ "${SKIP_INSTALL:-0}" = "1" ] && [ -d "$PROJECT_ROOT/node_modules" ]; then
  echo "      SKIP_INSTALL=1 - reusing existing node_modules"
elif [ -f "$PROJECT_ROOT/package-lock.json" ]; then
  # npm ci gives a reproducible tree from the lockfile; fall back to npm
  # install if the lockfile and package.json ever drift apart.
  npm ci || {
    echo "      npm ci failed, falling back to npm install..."
    npm install
  }
else
  npm install
fi

# ---------------------------------------------------------------------------
# 4) Production build
# ---------------------------------------------------------------------------
echo ""
echo "[4/9] Building the production site..."
npm run build

# ---------------------------------------------------------------------------
# 5) Verify the build output
# ---------------------------------------------------------------------------
echo ""
echo "[5/9] Verifying build output..."
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "ERROR: build finished but $DIST_DIR/index.html does not exist." >&2
  exit 1
fi
if [ ! -d "$DIST_DIR/assets" ]; then
  echo "WARNING: $DIST_DIR/assets was not created - check the build output above."
fi
echo "      OK: $DIST_DIR/index.html"

# ---------------------------------------------------------------------------
# 6) Confirm MongoDB accepts the login - BEFORE anything is stopped
# ---------------------------------------------------------------------------
# If the password or user is wrong, stop here, while Experiment 1 (or the
# previous Experiment 2) is still online.
echo ""
echo "[6/9] Checking the MongoDB login..."
if ! node --input-type=module -e '
  import { MongoClient } from "mongodb";
  const client = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  let code = 0;
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    await db.command({ ping: 1 });
    /* ping works without a login; listing collections does not. */
    await db.listCollections({}, { nameOnly: true }).toArray();
    console.log("      OK: logged in, database \"" + process.env.MONGO_DB + "\" is accessible");
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    console.error("      MongoDB said: " + msg);
    if (/Authentication failed/i.test(msg)) {
      console.error("      -> wrong username/password, or authSource is not \"admin\".");
    } else if (/requires authentication|not authorized/i.test(msg)) {
      console.error("      -> the user exists but has no readWrite role on " + process.env.MONGO_DB + ".");
    } else if (/ECONNREFUSED|Server selection timed out/i.test(msg)) {
      console.error("      -> MongoDB is not reachable. Check: sudo systemctl status mongod");
    }
    code = 1;
  } finally {
    await client.close().catch(() => {});
  }
  process.exitCode = code;
'; then
  echo "" >&2
  echo "ERROR: cannot use MongoDB with the settings in .env. Nothing was stopped." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 7) Release port 4000 (previous Experiment 2, then Experiment 1)
# ---------------------------------------------------------------------------
echo ""
echo "[7/9] Releasing port $PORT..."

# 7a) A previous Experiment 2 instance started by this script.
if [ -f "$PROJECT_ROOT/stop-project.sh" ]; then
  QUIET_STOP=1 bash "$PROJECT_ROOT/stop-project.sh" >/dev/null 2>&1 || true
fi

# 7b) Experiment 1, which owns port 4000 through its own PM2 app. Targeted by
#     name only - no blanket process killing. Its database is not touched.
if have pm2; then
  if pm2 describe "$EXP1_APP_NAME" >/dev/null 2>&1; then
    echo "      Stopping Experiment 1 PM2 app '$EXP1_APP_NAME'..."
    pm2 delete "$EXP1_APP_NAME" >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
  fi
fi

sleep 1

# 7c) Anything else still holding the port is NOT killed automatically.
if port_in_use && [ "${FORCE_FREE_PORT:-0}" = "1" ]; then
  echo "      FORCE_FREE_PORT=1 - freeing port $PORT..."
  if have fuser; then
    fuser -k "${PORT}/tcp" >/dev/null 2>&1 || sudo fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  else
    echo "      WARNING: 'fuser' is not available; cannot force-free the port."
  fi
  sleep 2
fi

if port_in_use; then
  echo ""
  echo "ERROR: port $PORT is still in use by another process:" >&2
  show_port_owner >&2
  echo "" >&2
  echo "Nothing was killed automatically. Options:" >&2
  echo "  - run Experiment 1's own ./stop-project.sh, then re-run this script" >&2
  echo "  - or re-run as: FORCE_FREE_PORT=1 ./build-and-run.sh" >&2
  exit 1
fi
echo "      Port $PORT is free."

# ---------------------------------------------------------------------------
# 8) Start Experiment 2, detached from the SSH session
# ---------------------------------------------------------------------------
echo ""
echo "[8/9] Starting Experiment 2..."

RUN_MODE=""
APP_PID=""

if have pm2; then
  # Preferred path: the same process manager Experiment 1 uses, so the app is
  # supervised, restarts on crash, and survives the SSH disconnect.
  # MONGO_URL / MONGO_DB are exported above; ecosystem.config.cjs passes them on.
  RUN_MODE="pm2"
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  pm2 start "$PROJECT_ROOT/ecosystem.config.cjs"
  pm2 save >/dev/null 2>&1 || true
  sleep 2
  APP_PID="$(pm2 pid "$APP_NAME" 2>/dev/null | tr -d '[:space:]' || true)"
  rm -f "$PID_FILE"
else
  # Fallback when PM2 is not installed: nohup + PID file. Nothing outside this
  # project folder is required.
  RUN_MODE="nohup"
  echo "      PM2 not found - starting with nohup instead."
  NODE_ENV=production PORT="$PORT" HOST="$HOST" \
    nohup node "$SERVER_ENTRY" >> "$LOG_FILE" 2>&1 &
  APP_PID="$!"
  disown "$APP_PID" 2>/dev/null || true
  echo "$APP_PID" > "$PID_FILE"
fi

# ---------------------------------------------------------------------------
# 9) Health check (site + API + database)
# ---------------------------------------------------------------------------
echo ""
echo "[9/9] Waiting for the site, API and database to answer on port $PORT..."
STARTED=0
for _ in $(seq 1 30); do
  if health_ok; then
    STARTED=1
    break
  fi
  sleep 1
done

if [ "$STARTED" -ne 1 ]; then
  echo ""
  echo "ERROR: Experiment 2 did not become healthy on port $PORT." >&2
  echo "Last log lines:" >&2
  # Collect the diagnostics BEFORE cleaning up, while the process still exists.
  if [ "$RUN_MODE" = "pm2" ]; then
    pm2 logs "$APP_NAME" --lines 40 --nostream 2>/dev/null || true
  fi
  [ -f "$LOG_FILE" ] && tail -n 40 "$LOG_FILE" >&2 || true
  [ -f "$LOG_DIR/server-error.log" ] && tail -n 40 "$LOG_DIR/server-error.log" >&2 || true

  # Tear down what THIS run started, so a broken deploy does not leave a PM2
  # app crash-looping or an orphaned node process behind.
  echo "" >&2
  echo "Cleaning up the failed startup..." >&2
  if [ "$RUN_MODE" = "pm2" ]; then
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
    echo "      PM2 app '$APP_NAME' removed - it will not keep restarting." >&2
  else
    if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
      kill "$APP_PID" 2>/dev/null || true
      for _ in $(seq 1 10); do
        kill -0 "$APP_PID" 2>/dev/null || break
        sleep 1
      done
      if kill -0 "$APP_PID" 2>/dev/null; then
        kill -9 "$APP_PID" 2>/dev/null || true
      fi
      echo "      Stopped process $APP_PID." >&2
    fi
    rm -f "$PID_FILE"
  fi
  echo "      Nothing from this run is left running. Fix the error above and" >&2
  echo "      run ./build-and-run.sh again." >&2
  exit 1
fi

if [ "$RUN_MODE" = "pm2" ] && [ -z "$APP_PID" ]; then
  APP_PID="$(pm2 pid "$APP_NAME" 2>/dev/null | tr -d '[:space:]' || true)"
fi

HEALTH_JSON="$(http_get api/health || true)"

echo ""
echo "=================================================="
echo " Experiment 2 successfully started."
echo "=================================================="
echo " Port     : $PORT  (bound to 0.0.0.0)"
echo " PID      : ${APP_PID:-unknown}"
echo " Mode     : $RUN_MODE"
echo " Database : $MONGO_DB"
if [ "$RUN_MODE" = "pm2" ]; then
  echo " Log      : $LOG_FILE"
  echo "            $LOG_DIR/server-error.log"
  echo "            live view: pm2 logs $APP_NAME"
else
  echo " Log      : $LOG_FILE"
  echo " PID file : $PID_FILE"
fi
echo " Health   : http://localhost:$PORT/api/health"
[ -n "$HEALTH_JSON" ] && echo "            $HEALTH_JSON"
echo ""
echo " Safe to close the SSH session now - the server keeps running."
echo " To stop it later:  ./stop-project.sh"
echo "=================================================="
