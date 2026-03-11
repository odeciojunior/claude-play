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
    "$pip_cmd" install "git+${REPO_URL}" --quiet
    echo "Installed mcp-sql-server to $VENV_DIR"
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

    # Search starting directory and up to 4 parent levels (5 locations total)
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

# --- Main dispatcher ---
case "${1:-}" in
    check-python)   check_python ;;
    check-odbc)     check_odbc ;;
    install-venv)   install_venv ;;
    verify-install) verify_install ;;
    detect-env)     detect_env "${2:-.}" ;;
    *)
        echo "Usage: setup.sh {check-python|check-odbc|install-venv|verify-install|detect-env [path]}"
        exit 1
        ;;
esac
