#!/bin/bash
# Database Migration Script
# Wrapper for TypeScript migration system

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo -e "${GREEN}🗄️  Database Migration System${NC}"
echo ""

# Check if TypeScript is installed
if ! command -v ts-node &> /dev/null; then
    echo -e "${YELLOW}⚠️  ts-node not found. Installing dependencies...${NC}"
    cd "$PROJECT_ROOT"
    npm install
fi

# Run migration
cd "$PROJECT_ROOT"

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --reset      Reset database (drop all tables and rebuild)"
    echo "  --force      Force reapply all migrations"
    echo "  --verify     Verify database integrity"
    echo "  --stats      Show database statistics"
    echo "  --db PATH    Use custom database path (default: .swarm/memory.db)"
    echo "  --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run pending migrations"
    echo "  $0 --reset            # Reset and rebuild database"
    echo "  $0 --verify           # Verify schema integrity"
    echo "  $0 --stats            # Show database stats"
    exit 0
fi

# Run TypeScript migration
npx ts-node "$SCRIPT_DIR/migrate.ts" "$@"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration complete!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed with exit code $EXIT_CODE${NC}"
    exit $EXIT_CODE
fi
