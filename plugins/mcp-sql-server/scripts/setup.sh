#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="$HOME/.claude/mcp-servers/mcp-sql-server/.venv"
REPO_URL="https://github.com/odeciojunior/mcp-sql-server.git"
MIN_PYTHON_VERSION="3.10"

# --- Subcommands ---

check_python() {
    local python_cmd=""
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            python_cmd="$cmd"
            break
        fi
    done

    if [[ -z "$python_cmd" ]]; then
        echo "ERROR: Python not found. Install Python 3.10 or later."
        exit 1
    fi

    local version
    version=$("$python_cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")
    local major minor
    major=$("$python_cmd" -c "import sys; print(sys.version_info.major)")
    minor=$("$python_cmd" -c "import sys; print(sys.version_info.minor)")

    if [[ "$major" -lt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -lt 10 ]]; }; then
        echo "ERROR: Python $version found but 3.10+ required."
        exit 1
    fi

    echo "Python $version found at $(command -v "$python_cmd")"
    exit 0
}

check_odbc() {
    local driver=""

    # Detect Windows (Git Bash / MSYS2 / Cygwin)
    local is_windows=false
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) is_windows=true ;;
    esac

    if $is_windows; then
        if ! command -v reg &>/dev/null; then
            echo "ERROR: reg.exe not found in PATH — cannot detect ODBC drivers."
            echo "       Ensure %SystemRoot%\\System32 is in your PATH and retry."
            exit 1
        fi

        # Check Windows Registry for installed ODBC drivers
        # tr -d '\r' strips CRLF from reg.exe output before piping to grep
        driver=$(reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers" 2>/dev/null \
            | tr -d '\r' | grep -oiE "ODBC Driver [0-9]+ for SQL Server" | tail -1)
        if [[ -n "$driver" ]]; then
            echo "$driver"
            exit 0
        fi
        # Also check 32-bit registry on 64-bit Windows
        driver=$(reg query "HKLM\\SOFTWARE\\WOW6432Node\\ODBC\\ODBCINST.INI\\ODBC Drivers" 2>/dev/null \
            | tr -d '\r' | grep -oiE "ODBC Driver [0-9]+ for SQL Server" | tail -1)
        if [[ -n "$driver" ]]; then
            echo "$driver"
            exit 0
        fi
        # Fallback: check specific driver subkeys directly (more reliable than parsing list)
        for ver in 18 17 13; do
            if reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Driver $ver for SQL Server" 2>/dev/null | tr -d '\r' | grep -qi "REG_SZ"; then
                echo "ODBC Driver $ver for SQL Server"
                exit 0
            fi
        done
        # Fallback: PowerShell Get-OdbcDriver
        if command -v powershell.exe &>/dev/null; then
            driver=$(powershell.exe -NoProfile -Command "Get-OdbcDriver | Where-Object { \$_.Name -match 'ODBC Driver \d+ for SQL Server' } | Select-Object -ExpandProperty Name | Sort-Object -Descending | Select-Object -First 1" 2>/dev/null | tr -d '\r')
            if [[ -n "$driver" ]]; then
                echo "$driver"
                exit 0
            fi
        fi

        echo "ERROR: Microsoft ODBC Driver for SQL Server not found."
        echo ""
        echo "Install instructions:"
        echo "  https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server"
        echo ""
        echo "Recommended: ODBC Driver 18 for SQL Server (17 also supported)"
        exit 1
    fi

    # Linux / macOS: check odbcinst.ini files
    for ini_file in /etc/odbcinst.ini /usr/local/etc/odbcinst.ini; do
        if [[ -f "$ini_file" ]]; then
            driver=$(grep -oP "ODBC Driver \d+ for SQL Server" "$ini_file" | tail -1)
            if [[ -n "$driver" ]]; then
                echo "$driver"
                exit 0
            fi
        fi
    done

    # Try odbcinst command
    if command -v odbcinst &>/dev/null; then
        driver=$(odbcinst -q -d 2>/dev/null | grep -oP "ODBC Driver \d+ for SQL Server" | tail -1)
        if [[ -n "$driver" ]]; then
            echo "$driver"
            exit 0
        fi
    fi

    # Fallback: check via package manager (driver installed but odbcinst unavailable)
    if command -v dpkg &>/dev/null; then
        for ver in 18 17; do
            if dpkg -l "msodbcsql${ver}" 2>/dev/null | grep -q "^ii"; then
                echo "ODBC Driver $ver for SQL Server"
                exit 0
            fi
        done
    fi
    if command -v rpm &>/dev/null; then
        for ver in 18 17; do
            if rpm -q "msodbcsql${ver}" &>/dev/null; then
                echo "ODBC Driver $ver for SQL Server"
                exit 0
            fi
        done
    fi

    # Not found — print platform-specific instructions
    echo "ERROR: Microsoft ODBC Driver for SQL Server not found."
    echo ""
    if [[ -f /etc/debian_version ]] || grep -qi ubuntu /etc/os-release 2>/dev/null; then
        echo "Install on Ubuntu/Debian:"
        echo "  curl https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc"
        echo "  sudo add-apt-repository \"https://packages.microsoft.com/ubuntu/\$(lsb_release -rs)/prod\""
        echo "  sudo apt-get update && sudo apt-get install -y msodbcsql18"
    elif [[ "$(uname)" == "Darwin" ]]; then
        echo "Install on macOS:"
        echo "  brew tap microsoft/mssql-release https://github.com/microsoft/homebrew-mssql-release"
        echo "  brew install msodbcsql18"
    else
        echo "Install instructions:"
        echo "  https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server"
    fi
    exit 1
}

install_venv() {
    local python_cmd=""
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            python_cmd="$cmd"
            break
        fi
    done

    if [[ -z "$python_cmd" ]]; then
        echo "ERROR: Python not found. Run check-python first."
        exit 1
    fi

    # Resolve venv bin dir (Scripts on Windows, bin on Unix)
    local venv_bin="$VENV_DIR/bin"
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) venv_bin="$VENV_DIR/Scripts" ;;
    esac

    mkdir -p "$(dirname "$VENV_DIR")"

    if [[ ! -d "$VENV_DIR" ]]; then
        echo "Creating virtual environment at $VENV_DIR..."
        "$python_cmd" -m venv "$VENV_DIR"
    else
        echo "Virtual environment exists at $VENV_DIR, upgrading..."
    fi

    # Re-resolve pip after venv creation (Scripts/pip.exe on Windows)
    local pip_cmd="$venv_bin/pip"
    [[ -f "$venv_bin/pip.exe" ]] && pip_cmd="$venv_bin/pip.exe"

    "$pip_cmd" install --upgrade pip --quiet
    echo "Installing mcp-sql-server from GitHub..."

    # Two passes, deliberately. The first installs the package and its
    # dependencies, and is a no-op when they are already satisfied.
    if ! "$pip_cmd" install "git+${REPO_URL}" --quiet; then
        echo "ERROR: pip install failed."
        exit 1
    fi

    # The second forces the package itself to the current git HEAD. --force-reinstall
    # is required because the project version is static, so pip treats an existing
    # install as already satisfied and silently skips it even when HEAD has moved.
    # --no-deps is equally required: reinstalling dependencies would pull them across
    # major versions (the mcp pin is unbounded), breaking a working install.
    if ! "$pip_cmd" install --force-reinstall --no-deps "git+${REPO_URL}" --quiet; then
        echo "ERROR: pip install failed."
        exit 1
    fi

    # Report the commit actually installed, so a stale install is visible rather
    # than hidden behind a success message.
    local installed_commit
    installed_commit=$("$venv_bin/python" -c "
import json
try:
    from importlib.metadata import distribution
    raw = distribution('mcp-sql-server').read_text('direct_url.json')
    print(json.loads(raw).get('vcs_info', {}).get('commit_id', 'unknown')[:12] if raw else 'unknown')
except Exception:
    print('unknown')
" 2>/dev/null) || installed_commit="unknown"

    echo "Installed mcp-sql-server to $VENV_DIR (commit ${installed_commit})"
    exit 0
}

verify_install() {
    # Resolve venv bin dir (Scripts on Windows, bin on Unix)
    local venv_bin="$VENV_DIR/bin"
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) venv_bin="$VENV_DIR/Scripts" ;;
    esac

    if [[ ! -f "$venv_bin/python" ]] && [[ ! -f "$venv_bin/python.exe" ]]; then
        echo "ERROR: Virtual environment not found at $VENV_DIR"
        exit 1
    fi

    local python_bin="$venv_bin/python"
    [[ -f "$venv_bin/python.exe" ]] && python_bin="$venv_bin/python.exe"

    local version
    version=$("$python_bin" -c "import mcp_sql_server; print(getattr(mcp_sql_server, '__version__', 'unknown'))" 2>&1) || {
        echo "ERROR: Failed to import mcp_sql_server: $version"
        exit 1
    }

    echo "mcp-sql-server v$version verified"
    exit 0
}

detect_env() {
    local search_path
    search_path=$(cd "${1:-.}" && pwd)
    local env_file=""
    local db_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "DB_DATABASE" "DB_PORT" "DB_ENCRYPT" "DB_TRUST_CERT")

    # Search starting directory and up to 5 parent levels (6 locations total)
    local dir="$search_path"
    for _ in 1 2 3 4 5; do
        if [[ -f "$dir/.env" ]]; then
            env_file="$dir/.env"
            break
        fi
        dir=$(dirname "$dir")
    done

    if [[ -z "$env_file" ]]; then
        echo "No .env file found"
        exit 1
    fi

    echo "Found: $env_file"
    local found_host=false
    for var in "${db_vars[@]}"; do
        local value
        value=$(grep -oP "^${var}=\K.*" "$env_file" 2>/dev/null | head -1 | sed 's/^["'\''"]//;s/["'\''"]$//')
        if [[ -n "$value" ]]; then
            if [[ "$var" == "DB_PASSWORD" ]]; then
                echo "$var=********"
            elif [[ ${#value} -le 6 ]]; then
                echo "$var=***"
            else
                echo "$var=${value:0:3}***${value: -3}"
            fi
            [[ "$var" == "DB_HOST" ]] && found_host=true
        fi
    done

    if $found_host; then
        exit 0
    else
        echo "ERROR: .env found but DB_HOST not set"
        exit 1
    fi
}

register_mcp_json() {
    # Usage: register-mcp-json <mcp-json-path> <python-path> <DB_HOST> <DB_PORT> <DB_USER> <DB_PASSWORD> <DB_NAME> <DB_DRIVER> <DB_ENCRYPT> <DB_TRUST_CERT>
    local mcp_json_path="${1:-}"
    local python_path="${2:-}"
    local db_host="${3:-}"
    local db_port="${4:-1433}"
    local db_user="${5:-}"
    local db_password="${6:-}"
    local db_name="${7:-}"
    local db_driver="${8:-ODBC Driver 18 for SQL Server}"
    local db_encrypt="${9:-false}"
    local db_trust_cert="${10:-false}"

    # db_password intentionally not required (valid for Windows Auth / trusted connections)
    if [[ -z "$mcp_json_path" || -z "$python_path" || -z "$db_host" || -z "$db_user" || -z "$db_name" ]]; then
        echo "ERROR: Missing required arguments."
        echo "Usage: setup.sh register-mcp-json <mcp-json-path> <python-path> <host> <port> <user> <password> <name> [driver] [encrypt] [trust_cert]"
        exit 1
    fi

    # Build the new MCP server entry as JSON
    local new_entry
    new_entry=$(node -e "
const entry = {
  command: process.argv[1],
  args: ['-m', 'mcp_sql_server.server'],
  env: {
    DB_HOST: process.argv[2],
    DB_PORT: process.argv[3],
    DB_USER: process.argv[4],
    DB_PASSWORD: process.argv[5],
    DB_NAME: process.argv[6],
    DB_DRIVER: process.argv[7],
    DB_ENCRYPT: process.argv[8],
    DB_TRUST_CERT: process.argv[9]
  }
};
process.stdout.write(JSON.stringify(entry));
" "$python_path" "$db_host" "$db_port" "$db_user" "$db_password" "$db_name" "$db_driver" "$db_encrypt" "$db_trust_cert")

    if [[ -z "$new_entry" ]]; then
        echo "ERROR: Failed to build JSON entry (is node available?)"
        exit 1
    fi

    # Merge into existing .mcp.json or create new
    if [[ -f "$mcp_json_path" ]]; then
        local merged
        merged=$(node -e "
const fs = require('fs');
const existing = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const newEntry = JSON.parse(process.argv[2]);
if (!existing.mcpServers) existing.mcpServers = {};
const prev = existing.mcpServers['mcp-sql-server'];
const prevEnv = (prev && typeof prev.env === 'object' && prev.env !== null) ? prev.env : {};
// Overwrite only the default DB_* keys; keep DB_DATABASES and any DB_<ALIAS>_* vars
existing.mcpServers['mcp-sql-server'] = Object.assign({}, prev, {
  command: newEntry.command,
  args: newEntry.args,
  env: Object.assign({}, prevEnv, newEntry.env)
});
process.stdout.write(JSON.stringify(existing, null, 2) + '\n');
" "$mcp_json_path" "$new_entry")
        if [[ -z "$merged" ]]; then
            echo "ERROR: Failed to merge JSON"
            exit 1
        fi
        printf '%s\n' "$merged" > "$mcp_json_path"
        echo "Updated $mcp_json_path (default database updated; additional databases preserved)"
    else
        local full_json
        full_json=$(node -e "
const newEntry = JSON.parse(process.argv[1]);
const doc = { mcpServers: { 'mcp-sql-server': newEntry } };
process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
" "$new_entry")
        if [[ -z "$full_json" ]]; then
            echo "ERROR: Failed to build JSON document"
            exit 1
        fi
        mkdir -p "$(dirname "$mcp_json_path")"
        printf '%s\n' "$full_json" > "$mcp_json_path"
        echo "Created $mcp_json_path with mcp-sql-server"
    fi

    exit 0
}

ensure_gitignore() {
    # Usage: ensure-gitignore <project-dir> <pattern>
    # Ensures the given pattern exists in .gitignore (creates file if needed)
    local project_dir="${1:-}"
    local pattern="${2:-}"

    if [[ -z "$project_dir" || -z "$pattern" ]]; then
        echo "ERROR: Usage: setup.sh ensure-gitignore <project-dir> <pattern>"
        exit 1
    fi

    local gitignore="$project_dir/.gitignore"

    if [[ -f "$gitignore" ]]; then
        if grep -qxF "$pattern" "$gitignore"; then
            echo "$pattern already in $gitignore"
            exit 0
        fi
    fi

    # Append with a newline before if file doesn't end with one
    if [[ -f "$gitignore" ]] && [[ -s "$gitignore" ]] && [[ "$(tail -c1 "$gitignore")" != "" ]]; then
        printf '\n%s\n' "$pattern" >> "$gitignore"
    else
        printf '%s\n' "$pattern" >> "$gitignore"
    fi

    echo "Added $pattern to $gitignore"
    exit 0
}

add_database() {
    # Usage: add-database <mcp-json-path> <alias> <host> <port> <user> <password> <name> [driver] [encrypt] [trust_cert]
    # Adds an additional named database (alias) to an existing mcp-sql-server entry.
    local mcp_json_path="${1:-}"
    local db_alias="${2:-}"
    local db_host="${3:-}"
    local db_port="${4:-1433}"
    local db_user="${5:-}"
    local db_password="${6:-}"
    local db_name="${7:-}"
    local db_driver="${8:-ODBC Driver 18 for SQL Server}"
    local db_encrypt="${9:-false}"
    local db_trust_cert="${10:-false}"

    if [[ -z "$mcp_json_path" || -z "$db_alias" || -z "$db_host" || -z "$db_user" || -z "$db_name" ]]; then
        echo "ERROR: Missing required arguments."
        echo "Usage: setup.sh add-database <mcp-json-path> <alias> <host> <port> <user> <password> <name> [driver] [encrypt] [trust_cert]"
        exit 1
    fi

    # Must match the server's alias pattern: [a-zA-Z][a-zA-Z0-9_]{0,63}
    if ! [[ "$db_alias" =~ ^[a-zA-Z][a-zA-Z0-9_]{0,63}$ ]]; then
        echo "ERROR: Invalid alias '$db_alias'. Start with a letter; letters, digits and underscores only; max 64 characters."
        exit 1
    fi

    # "default" is the primary connection and is configured by register-mcp-json
    local alias_lower
    alias_lower=$(printf '%s' "$db_alias" | tr '[:upper:]' '[:lower:]')
    if [[ "$alias_lower" == "default" ]]; then
        echo "ERROR: 'default' is reserved for the primary connection. Use register-mcp-json instead."
        exit 1
    fi

    # Prefixed configs have no fallback and require a non-empty password. An empty one
    # would leave the alias skipped and silently unavailable at startup, so catch it here.
    if [[ -z "$db_password" ]]; then
        echo "ERROR: A password is required for additional databases (alias '$db_alias')."
        exit 1
    fi

    if [[ ! -f "$mcp_json_path" ]]; then
        echo "ERROR: $mcp_json_path not found. Register the default database first (register-mcp-json)."
        exit 1
    fi

    local updated
    if ! updated=$(node -e "
const fs = require('fs');
const a = process.argv;
const doc = JSON.parse(fs.readFileSync(a[1], 'utf8'));
const server = doc.mcpServers && doc.mcpServers['mcp-sql-server'];
if (!server) {
  process.stderr.write('ERROR: no mcp-sql-server entry in ' + a[1] + '\n');
  process.exit(1);
}
if (!server.env || typeof server.env !== 'object') server.env = {};
const alias = a[2];
const p = alias.toUpperCase();
server.env['DB_' + p + '_HOST'] = a[3];
server.env['DB_' + p + '_PORT'] = a[4];
server.env['DB_' + p + '_USER'] = a[5];
server.env['DB_' + p + '_PASSWORD'] = a[6];
server.env['DB_' + p + '_NAME'] = a[7];
server.env['DB_' + p + '_DRIVER'] = a[8];
server.env['DB_' + p + '_ENCRYPT'] = a[9];
server.env['DB_' + p + '_TRUST_CERT'] = a[10];
const listed = (server.env.DB_DATABASES || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
if (!listed.some(function (x) { return x.toLowerCase() === alias.toLowerCase(); })) listed.push(alias);
server.env.DB_DATABASES = listed.join(',');
process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
" "$mcp_json_path" "$db_alias" "$db_host" "$db_port" "$db_user" "$db_password" "$db_name" "$db_driver" "$db_encrypt" "$db_trust_cert"); then
        exit 1
    fi

    if [[ -z "$updated" ]]; then
        echo "ERROR: Failed to update JSON (is node available?)"
        exit 1
    fi

    printf '%s\n' "$updated" > "$mcp_json_path"
    echo "Added database '$db_alias' ($db_name@$db_host) to $mcp_json_path"
    exit 0
}

# --- Main dispatcher ---
case "${1:-}" in
    check-python)       check_python ;;
    check-odbc)         check_odbc ;;
    install-venv)       install_venv ;;
    verify-install)     verify_install ;;
    detect-env)         detect_env "${2:-.}" ;;
    register-mcp-json)  shift; register_mcp_json "$@" ;;
    add-database)      shift; add_database "$@" ;;
    ensure-gitignore)   ensure_gitignore "${2:-}" "${3:-}" ;;
    *)
        echo "Usage: setup.sh {check-python|check-odbc|install-venv|verify-install|detect-env [path]|register-mcp-json <args...>|add-database <args...>|ensure-gitignore <dir> <pattern>}"
        exit 1
        ;;
esac
