#!/bin/bash
# Risk Management Dashboard
# Real-time monitoring display for risk management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to print header
print_header() {
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
}

# Function to print section
print_section() {
    echo -e "\n${BOLD}${BLUE}$1${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
}

# Check if risk CLI is available
if [ ! -f "$PROJECT_ROOT/src/risk-management/risk-cli.ts" ]; then
    echo -e "${RED}Error: Risk management system not found${NC}"
    exit 1
fi

# Build TypeScript if needed
if [ ! -d "$PROJECT_ROOT/dist/risk-management" ]; then
    echo "Building risk management system..."
    cd "$PROJECT_ROOT"
    npx tsc src/risk-management/risk-cli.ts --outDir dist/risk-management --module commonjs --target es2020 --esModuleInterop --skipLibCheck
fi

# Main dashboard display
clear
print_header "🎯 RISK MANAGEMENT DASHBOARD"

# Run status command
node "$PROJECT_ROOT/dist/risk-management/risk-cli.js" status

print_section "📋 Critical Risks (Daily Monitoring)"
node "$PROJECT_ROOT/dist/risk-management/risk-cli.js" list critical

print_section "⚠️  High Risks (Weekly Monitoring)"
node "$PROJECT_ROOT/dist/risk-management/risk-cli.js" list high

print_section "📢 Active Alerts"
node "$PROJECT_ROOT/dist/risk-management/risk-cli.js" alerts

# Footer with commands
echo -e "\n${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Quick Commands:${NC}"
echo -e "  ${GREEN}./scripts/risk-dashboard.sh${NC}              - Show this dashboard"
echo -e "  ${GREEN}node dist/risk-management/risk-cli.js detail <id>${NC}  - Risk details"
echo -e "  ${GREEN}node dist/risk-management/risk-cli.js report${NC}       - Weekly report"
echo -e "  ${GREEN}node dist/risk-management/risk-cli.js help${NC}         - Full help"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

# Check for critical alerts
CRITICAL_COUNT=$(node "$PROJECT_ROOT/dist/risk-management/risk-cli.js" alerts --critical 2>/dev/null | grep -c "CRITICAL" || echo "0")

if [ "$CRITICAL_COUNT" -gt 0 ]; then
    echo -e "\n${RED}${BOLD}🚨 WARNING: $CRITICAL_COUNT CRITICAL ALERT(S) REQUIRE IMMEDIATE ATTENTION!${NC}"
fi
