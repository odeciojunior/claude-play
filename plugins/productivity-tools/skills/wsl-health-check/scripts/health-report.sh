#!/bin/bash

# Health Report Script for Ubuntu/WSL
# Usage: ./health-report.sh [OPTIONS]
# Options:
#   --full            : Generate full health report
#   --system          : Show system information
#   --disk-usage      : Show disk usage statistics
#   --memory          : Show memory and CPU usage
#   --network         : Show network configuration and connectivity
#   --processes       : Show running processes
#   --top-processes   : Show top resource-consuming processes
#   --services        : Show active services
#   --packages        : Show package management status
#   --wsl             : Show WSL-specific information
#   --check-services "<names>" : Show active state of key services (space-separated;
#                       default: $HEALTH_KEY_SERVICES, else "cron")
#   --save [filename] : Save output to file (default: health_report_TIMESTAMP.txt)
#   --no-color        : Disable colored output
#   --help            : Show this help message

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Variables
SAVE_TO_FILE=false
OUTPUT_FILE=""
USE_COLOR=true
SHOW_ALL=false
SHOW_KEY_SERVICES=false
KEY_SERVICES="${HEALTH_KEY_SERVICES:-cron}"
INTERNET_OK=""   # "", "yes" or "no"; filled once by check_internet

# Numeric comparisons without bc: num_gt A B (A > B), num_lt A B (A < B)
num_gt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a>b)}'; }
num_lt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<b)}'; }

# Ping once and remember the result
check_internet() {
    if [ -z "$INTERNET_OK" ]; then
        if ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
            INTERNET_OK=yes
        else
            INTERNET_OK=no
        fi
    fi
}

# Parse command line arguments
parse_args() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                SHOW_ALL=true
                shift
                ;;
            --system)
                SHOW_SYSTEM=true
                shift
                ;;
            --disk-usage)
                SHOW_DISK=true
                shift
                ;;
            --memory)
                SHOW_MEMORY=true
                shift
                ;;
            --network)
                SHOW_NETWORK=true
                shift
                ;;
            --processes)
                SHOW_PROCESSES=true
                shift
                ;;
            --top-processes)
                SHOW_TOP_PROCESSES=true
                shift
                ;;
            --services)
                SHOW_SERVICES=true
                shift
                ;;
            --packages)
                SHOW_PACKAGES=true
                shift
                ;;
            --wsl)
                SHOW_WSL=true
                shift
                ;;
            --check-services)
                SHOW_KEY_SERVICES=true
                if [[ -n "$2" && ! "$2" =~ ^-- ]]; then
                    KEY_SERVICES="$2"
                    shift 2
                else
                    shift
                fi
                ;;
            --save)
                SAVE_TO_FILE=true
                if [[ -n "$2" && ! "$2" =~ ^-- ]]; then
                    OUTPUT_FILE="$2"
                    shift 2
                else
                    OUTPUT_FILE="health_report_$(date +%Y%m%d_%H%M%S).txt"
                    shift
                fi
                ;;
            --no-color)
                USE_COLOR=false
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Disable colors if requested
disable_colors() {
    if [ "$USE_COLOR" = false ]; then
        RED=""
        GREEN=""
        YELLOW=""
        BLUE=""
        PURPLE=""
        CYAN=""
        WHITE=""
        NC=""
        BOLD=""
    fi
}

# Print section header
print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════${NC}"
}

# Print subsection header
print_subheader() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo -e "${WHITE}───────────────────────────────────────${NC}"
}

# Show help message
show_help() {
    echo -e "${BOLD}Health Report Script for Ubuntu/WSL${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --full            Generate full health report"
    echo "  --system          Show system information"
    echo "  --disk-usage      Show disk usage statistics"
    echo "  --memory          Show memory and CPU usage"
    echo "  --network         Show network configuration and connectivity"
    echo "  --processes       Show running processes"
    echo "  --top-processes   Show top resource-consuming processes"
    echo "  --services        Show active services"
    echo "  --packages        Show package management status"
    echo "  --wsl             Show WSL-specific information"
    echo "  --check-services \"<names>\""
    echo "                    Show active/inactive/not-found for each service (space-separated;"
    echo "                    default: \$HEALTH_KEY_SERVICES, else cron). Included in --full"
    echo "  --save [filename] Save output to file"
    echo "  --no-color        Disable colored output"
    echo "  --help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --full                    # Generate complete report"
    echo "  $0 --disk-usage --memory     # Show only disk and memory info"
    echo "  $0 --top-processes           # Show top processes"
    echo "  $0 --full --save             # Save full report to file"
}

# System Information
show_system_info() {
    print_header "SYSTEM INFORMATION"
    
    echo -e "${WHITE}Hostname:${NC} $(hostname)"
    echo -e "${WHITE}Kernel:${NC} $(uname -r)"
    echo -e "${WHITE}Architecture:${NC} $(uname -m)"
    echo -e "${WHITE}Uptime:${NC} $(uptime -p)"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo -e "${WHITE}OS:${NC} $NAME $VERSION"
    fi
    
    echo -e "${WHITE}Date:${NC} $(date)"
    echo -e "${WHITE}Timezone:${NC} $(timedatectl show --property=Timezone --value 2>/dev/null || echo $TZ)"
}

# WSL Information
show_wsl_info() {
    print_header "WSL INFORMATION"
    
    if grep -qi microsoft /proc/version; then
        echo -e "${GREEN}✓ Running in WSL${NC}"
        
        # Try to get WSL version
        if command -v wsl.exe &> /dev/null; then
            print_subheader "WSL Version"
            wsl.exe --version 2>/dev/null | head -5 || echo "Unable to get WSL version"
        fi
        
        # Check WSL-specific network
        if [ -f /etc/resolv.conf ]; then
            print_subheader "WSL DNS Configuration"
            grep nameserver /etc/resolv.conf
        fi
        
        # Check Windows drives mount
        print_subheader "Windows Drives"
        df -h | grep -E "^/mnt/[a-z]" || echo "No Windows drives mounted"
    else
        echo -e "${YELLOW}⚠ Not running in WSL${NC}"
    fi
}

# Disk Usage
show_disk_usage() {
    print_header "DISK USAGE"
    
    print_subheader "Filesystem Usage"
    df -h | grep -E "^/|Filesystem" | while read line; do
        if echo "$line" | grep -q "Filesystem"; then
            echo -e "${BOLD}$line${NC}"
        else
            usage=$(echo "$line" | awk '{print $5}' | sed 's/%//')
            if [ ! -z "$usage" ] && [ "$usage" -ge 90 ]; then
                echo -e "${RED}$line${NC}"
            elif [ ! -z "$usage" ] && [ "$usage" -ge 70 ]; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        fi
    done
    
    print_subheader "Home Directory Usage"
    du -sh ~ 2>/dev/null
    
    print_subheader "Top 10 Largest Directories in Home"
    du -h ~ -d 1 2>/dev/null | sort -rh | head -11 | tail -10
    
    print_subheader "Inode Usage"
    df -i | grep -E "^/|Filesystem" | head -5
}

# Memory and CPU
show_memory_cpu() {
    print_header "MEMORY & CPU"
    
    print_subheader "Memory Usage"
    free -h | while read line; do
        if echo "$line" | grep -q "Mem:"; then
            total=$(echo "$line" | awk '{print $2}')
            used=$(echo "$line" | awk '{print $3}')
            available=$(echo "$line" | awk '{print $7}')
            echo -e "${BOLD}Memory:${NC} Total: $total, Used: $used, Available: ${GREEN}$available${NC}"
        elif echo "$line" | grep -q "Swap:"; then
            total=$(echo "$line" | awk '{print $2}')
            used=$(echo "$line" | awk '{print $3}')
            echo -e "${BOLD}Swap:${NC} Total: $total, Used: $used"
        else
            echo "$line"
        fi
    done
    
    print_subheader "CPU Information"
    echo -e "${WHITE}Model:${NC} $(lscpu | grep "Model name" | cut -d: -f2 | xargs)"
    echo -e "${WHITE}CPUs:${NC} $(nproc)"
    echo -e "${WHITE}Cores per socket:${NC} $(lscpu | grep "Core(s) per socket" | cut -d: -f2 | xargs)"
    echo -e "${WHITE}Threads per core:${NC} $(lscpu | grep "Thread(s) per core" | cut -d: -f2 | xargs)"
    
    print_subheader "Load Average"
    load=$(uptime | awk -F'load average:' '{print $2}')
    echo -e "${WHITE}Load:${NC} $load"
    
    # Check if load is high
    cores=$(nproc)
    load1=$(echo $load | cut -d, -f1 | xargs)
    if num_gt "$load1" "$cores"; then
        echo -e "${RED}⚠ High load detected${NC}"
    else
        echo -e "${GREEN}✓ Load is normal${NC}"
    fi
}

# Network
show_network() {
    print_header "NETWORK"
    
    print_subheader "Network Interfaces"
    ip -brief addr show | while read line; do
        if echo "$line" | grep -q "UP"; then
            echo -e "${GREEN}$line${NC}"
        else
            echo "$line"
        fi
    done
    
    print_subheader "Routing Table"
    ip route | head -5
    
    print_subheader "DNS Configuration"
    if [ -f /etc/resolv.conf ]; then
        grep -E "nameserver|search" /etc/resolv.conf | head -5
    fi
    
    print_subheader "Network Connectivity Test"
    echo -n "Testing internet connectivity... "
    check_internet
    if [ "$INTERNET_OK" = yes ]; then
        echo -e "${GREEN}✓ Connected${NC}"

        echo -n "DNS resolution... "
        if ping -c 1 -W 2 google.com &>/dev/null; then
            echo -e "${GREEN}✓ Working${NC}"
        else
            echo -e "${RED}✗ Failed${NC}"
        fi
    else
        echo -e "${RED}✗ No internet connection${NC}"
    fi
    
    print_subheader "Open Ports"
    ss -tuln | head -10
}

# Processes
show_processes() {
    print_header "PROCESSES"
    
    print_subheader "Process Statistics"
    echo -e "${WHITE}Total processes:${NC} $(ps aux | wc -l)"
    echo -e "${WHITE}Running processes:${NC} $(ps aux | grep -c " R ")"
    echo -e "${WHITE}Sleeping processes:${NC} $(ps aux | grep -c " S ")"
    echo -e "${WHITE}Zombie processes:${NC} $(ps -eo stat= | grep -c '^Z')"
    
    print_subheader "Process Tree (top level)"
    pstree -p | head -20
}

# Top Processes
show_top_processes() {
    print_header "TOP PROCESSES"
    
    print_subheader "Top 10 CPU Consumers"
    ps aux --sort=-%cpu | head -11 | while read line; do
        if echo "$line" | grep -q "USER"; then
            echo -e "${BOLD}$line${NC}"
        else
            cpu=$(echo "$line" | awk '{print $3}')
            if num_gt "$cpu" 50; then
                echo -e "${RED}$line${NC}"
            elif num_gt "$cpu" 20; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        fi
    done
    
    print_subheader "Top 10 Memory Consumers"
    ps aux --sort=-%mem | head -11 | while read line; do
        if echo "$line" | grep -q "USER"; then
            echo -e "${BOLD}$line${NC}"
        else
            mem=$(echo "$line" | awk '{print $4}')
            if num_gt "$mem" 20; then
                echo -e "${RED}$line${NC}"
            elif num_gt "$mem" 10; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        fi
    done
}

# Key services: one line per service, "<name>: active|inactive|not-found"
show_key_services() {
    print_subheader "Key Services"
    local svc state
    for svc in $KEY_SERVICES; do
        if command -v systemctl &> /dev/null && [ -d /run/systemd/system ]; then
            if systemctl is-active --quiet "$svc" 2>/dev/null; then
                state=active
            elif systemctl cat "$svc" &>/dev/null || systemctl list-unit-files "$svc.service" 2>/dev/null | grep -q "$svc"; then
                state=inactive
            else
                state=not-found
            fi
        elif [ -f "/etc/init.d/$svc" ]; then
            if service "$svc" status &>/dev/null; then
                state=active
            else
                state=inactive
            fi
        else
            state=not-found
        fi
        echo "$svc: $state"
    done
}

# Services
show_services() {
    print_header "SERVICES"
    show_key_services

    if command -v systemctl &> /dev/null; then
        print_subheader "Failed Services"
        failed=$(systemctl list-units --failed --no-legend | wc -l)
        if [ "$failed" -gt 0 ]; then
            echo -e "${RED}⚠ $failed failed services detected${NC}"
            systemctl list-units --failed
        else
            echo -e "${GREEN}✓ No failed services${NC}"
        fi
        
        print_subheader "Active Services (Top 15)"
        systemctl list-units --type=service --state=active --no-legend | head -15
    else
        echo -e "${YELLOW}systemd not available${NC}"
        
        print_subheader "Running Services (via service command)"
        service --status-all 2>/dev/null | grep " + " | head -15
    fi
}

# Package Management
show_packages() {
    print_header "PACKAGE MANAGEMENT"
    
    if command -v apt &> /dev/null; then
        print_subheader "APT Package Statistics"
        echo -e "${WHITE}Total packages:${NC} $(dpkg -l | tail -n +6 | wc -l)"
        echo -e "${WHITE}Installed:${NC} $(dpkg -l | tail -n +6 | grep -c "^ii")"
        
        print_subheader "Updates Available"
        updates=$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)
        if [ "$updates" -gt 0 ]; then
            echo -e "${YELLOW}⚠ $updates updates available${NC}"
            echo ""
            apt list --upgradable 2>/dev/null | head -11 | tail -10
            echo ""
            echo -e "${WHITE}To update: ${NC}sudo apt update && sudo apt upgrade"
        else
            echo -e "${GREEN}✓ System is up to date${NC}"
        fi
        
        print_subheader "Broken Packages"
        broken=$(dpkg --audit 2>/dev/null | wc -l)
        if [ "$broken" -gt 0 ]; then
            echo -e "${RED}⚠ $broken lines of dpkg --audit output (broken or half-configured packages)${NC}"
            dpkg --audit 2>/dev/null | head -10
        else
            echo -e "${GREEN}✓ No broken packages${NC}"
        fi
        
        print_subheader "Last APT Update"
        if [ -f /var/lib/apt/periodic/update-success-stamp ]; then
            echo "Last update: $(stat -c %y /var/lib/apt/periodic/update-success-stamp | cut -d. -f1)"
        else
            echo "Update timestamp not available"
        fi
    fi
    
    # Check for snap packages
    if command -v snap &> /dev/null; then
        print_subheader "Snap Packages"
        echo -e "${WHITE}Installed snaps:${NC} $(snap list 2>/dev/null | tail -n +2 | wc -l)"
    fi
}

# Generate Health Summary
generate_summary() {
    print_header "HEALTH SUMMARY"
    
    echo ""
    # Check memory
    mem_percent=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ "$mem_percent" -lt 80 ]; then
        echo -e "${GREEN}✓ Memory usage is healthy ($mem_percent%)${NC}"
    else
        echo -e "${RED}⚠ High memory usage ($mem_percent%)${NC}"
    fi
    
    # Check disk
    root_usage=$(df / | tail -1 | awk '{print int($5)}')
    if [ "$root_usage" -lt 80 ]; then
        echo -e "${GREEN}✓ Disk usage is healthy ($root_usage%)${NC}"
    else
        echo -e "${RED}⚠ High disk usage ($root_usage%)${NC}"
    fi
    
    # Check load
    load1=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | xargs)
    cores=$(nproc)
    if num_lt "$load1" "$cores"; then
        echo -e "${GREEN}✓ System load is normal${NC}"
    else
        echo -e "${RED}⚠ High system load detected${NC}"
    fi

    # Zombie processes
    echo -e "${WHITE}Zombie processes:${NC} $(ps -eo stat= | grep -c '^Z')"

    # Check network (ping result is cached by check_internet)
    check_internet
    if [ "$INTERNET_OK" = yes ]; then
        echo -e "${GREEN}✓ Network connectivity is working${NC}"
    else
        echo -e "${RED}⚠ Network connectivity issues${NC}"
    fi
    
    # Check for updates
    if command -v apt &> /dev/null; then
        updates=$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)
        if [ "$updates" -gt 0 ]; then
            echo -e "${YELLOW}⚠ $updates system updates available${NC}"
        else
            echo -e "${GREEN}✓ System is up to date${NC}"
        fi
    fi
    
    echo ""
    echo -e "${BOLD}Report generated at: $(date)${NC}"
}

# Main execution function
main() {
    parse_args "$@"
    disable_colors
    
    # Redirect output if saving to file
    if [ "$SAVE_TO_FILE" = true ]; then
        exec > >(tee "$OUTPUT_FILE")
        echo "Saving output to: $OUTPUT_FILE"
    fi
    
    echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║           SYSTEM HEALTH REPORT                        ║${NC}"
    echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    
    # Show requested sections
    if [ "$SHOW_ALL" = true ]; then
        show_system_info
        show_wsl_info
        show_disk_usage
        show_memory_cpu
        show_network
        show_top_processes
        show_services
        show_packages
        generate_summary
    else
        [ "$SHOW_SYSTEM" = true ] && show_system_info
        [ "$SHOW_WSL" = true ] && show_wsl_info
        [ "$SHOW_DISK" = true ] && show_disk_usage
        [ "$SHOW_MEMORY" = true ] && show_memory_cpu
        [ "$SHOW_NETWORK" = true ] && show_network
        [ "$SHOW_PROCESSES" = true ] && show_processes
        [ "$SHOW_TOP_PROCESSES" = true ] && show_top_processes
        [ "$SHOW_SERVICES" = true ] && show_services
        if [ "$SHOW_KEY_SERVICES" = true ] && [ "$SHOW_SERVICES" != true ]; then
            show_key_services
        fi
        [ "$SHOW_PACKAGES" = true ] && show_packages
    fi
    
    if [ "$SAVE_TO_FILE" = true ]; then
        echo ""
        echo -e "${GREEN}Report saved to: $OUTPUT_FILE${NC}"
    fi
}

# Run main function
main "$@"