#!/bin/bash

################################################################################
# FleetFusion Demo Launcher
# Starts all services needed for a complete demo
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# PID file to track processes
PIDFILE=".demo-pids"
mkdir -p logs

# Stop an earlier launcher still watching its services: its watchdog would otherwise treat
# our restart as a crash and kill the new processes listed in the shared PID file.
LAUNCHER_PIDFILE=".demo-launcher.pid"
if [ -f "$LAUNCHER_PIDFILE" ]; then
    OLD=$(cat "$LAUNCHER_PIDFILE")
    if [ -n "$OLD" ] && [ "$OLD" != "$$" ] && ps -p "$OLD" -o command= 2>/dev/null | grep -q "start-demo.sh"; then
        kill "$OLD" 2>/dev/null || true
        sleep 1  # let it finish its own shutdown before we write new PIDs
    fi
fi
echo $$ > "$LAUNCHER_PIDFILE"
rm -f "$PIDFILE"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "${PURPLE}▶${NC} $1"
}

cleanup() {
    echo ""
    print_header "Shutting Down FleetFusion Demo"
    
    if [ -f "$PIDFILE" ]; then
        print_step "Stopping all processes..."
        while read pid; do
            if ps -p $pid > /dev/null 2>&1; then
                print_info "Killing process $pid"
                kill $pid 2>/dev/null || true
            fi
        done < "$PIDFILE"
        rm "$PIDFILE"
        print_success "All processes stopped"
    fi
    
    print_info "Demo stopped. Thank you for using FleetFusion! 🚀"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    return 0
}

################################################################################
# Pre-flight Checks
################################################################################

print_header "🚀 FleetFusion Demo Launcher"

print_step "Running pre-flight checks..."

# Check Node.js
if check_command node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js is required but not installed"
    exit 1
fi

# Check Python
if check_command python3; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python installed: $PYTHON_VERSION"
else
    print_error "Python 3 is required but not installed"
    exit 1
fi

# Check npm
if check_command npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: v$NPM_VERSION"
else
    print_error "npm is required but not installed"
    exit 1
fi

################################################################################
# Check Dependencies
################################################################################

print_step "Checking dependencies..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing frontend dependencies..."
    npm install
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies found"
fi

# Check if Python virtual environment exists
if [ ! -d "backend-pathway/venv-pathway" ]; then
    print_warning "Python virtual environment not found. Creating..."
    cd backend-pathway
    python3 -m venv venv-pathway
    source venv-pathway/bin/activate
    pip install -r requirements-pathway.txt
    cd ..
    print_success "Python virtual environment created"
else
    print_success "Python virtual environment found"
fi

################################################################################
# Environment Setup
################################################################################

print_step "Checking environment configuration..."

# Create backend .env from the example if missing
if [ ! -f "backend-pathway/.env" ]; then
    print_info "Creating backend-pathway/.env from .env.example"
    cp backend-pathway/.env.example backend-pathway/.env
fi

# Check local LLM (Ollama) - optional, pipeline falls back to rule-based analysis
if curl -s --max-time 2 http://localhost:11434/v1/models >/dev/null 2>&1; then
    print_success "Local LLM server (Ollama) reachable"
else
    print_warning "Ollama not reachable on :11434 - AI reasoning will use rule-based fallback"
    print_info "Optional: install from https://ollama.com, then: ollama pull llama3.2:3b"
fi

################################################################################
# Start Services
################################################################################

print_header "Starting Services"

# Clean up old PID file
rm -f "$PIDFILE"

# Check for port conflicts and clean them up
print_step "Checking for port conflicts..."

# Check if port 3000 (Frontend) is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 3000 is already in use. Attempting to free it..."
    lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Check if port 8765 (WebSocket) is in use
if lsof -Pi :8765 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 8765 is already in use. Attempting to free it..."
    lsof -Pi :8765 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Kill any existing FleetFusion processes
print_step "Cleaning up any existing FleetFusion processes..."
pkill -f "python main.py" 2>/dev/null || true
pkill -f "devices/fleet_devices.py" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

print_step "Starting Backend Services..."
echo ""

# Telematics feed: real Traccar platform in Docker if available, else the built-in simulator.
# Force the built-in simulator with: FEED=internal ./start-demo.sh
FEED="${FEED:-auto}"
if [ "$FEED" = "auto" ]; then
    FEED=internal
    if command -v docker >/dev/null 2>&1; then
        if ! docker info >/dev/null 2>&1 && command -v colima >/dev/null 2>&1; then
            print_info "Starting Docker runtime (colima)..."
            colima start >/dev/null 2>&1 || true
        fi
        if docker info >/dev/null 2>&1; then FEED=traccar; fi
    fi
fi

if [ "$FEED" = "traccar" ]; then
    print_info "Starting Traccar telematics platform (Docker)..."
    ./infra/traccar.sh up
    sleep 5
fi

# Start backend (Pathway pipeline + realtime hub in one process)
print_info "Starting FleetFusion backend (feed: $FEED)..."
cd backend-pathway
source venv-pathway/bin/activate
if [ "$FEED" = "traccar" ]; then
    FEED=traccar ENABLE_SIMULATOR=false DEMO_CONTROLS=false \
        DECISION_WEBHOOK_URL=http://127.0.0.1:9099/decisions \
        python main.py > ../logs/backend.log 2>&1 &
else
    FEED=internal python main.py > ../logs/backend.log 2>&1 &
fi
BACKEND_PID=$!
echo $BACKEND_PID >> "../$PIDFILE"
if [ "$FEED" = "traccar" ]; then
    sleep 5
    # Simulated GPS trackers on real lanes, reporting to Traccar like hardware would.
    # The 30x demo clock continues from the last run (output/.device_clock). Never reset it: Traccar keeps the
    # newest position per tracker, so a clock that jumps back freezes its map and scrambles replays.
    python -u devices/fleet_devices.py > ../logs/devices.log 2>&1 &
    DEVICES_PID=$!
    echo $DEVICES_PID >> "../$PIDFILE"
fi
cd ..

sleep 4

if ps -p $BACKEND_PID > /dev/null; then
    print_success "Backend started (PID: $BACKEND_PID)"
else
    print_error "Failed to start backend"
    cat logs/backend.log
    exit 1
fi

echo ""
print_step "Starting Frontend..."
echo ""

# Start Next.js Frontend
print_info "Starting Next.js Development Server..."
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID >> "$PIDFILE"

sleep 5

if ps -p $FRONTEND_PID > /dev/null; then
    print_success "Frontend started (PID: $FRONTEND_PID)"
else
    print_error "Failed to start Frontend"
    cat logs/frontend.log
    exit 1
fi

################################################################################
# Demo Ready
################################################################################

print_header "🎉 FleetFusion Demo is Running!"

echo ""
print_success "All services started successfully!"
echo ""
print_info "Access Points:"
echo "   • Frontend:        ${CYAN}http://localhost:3000${NC}"
echo "   • Dashboard:       ${CYAN}http://localhost:3000/dashboard${NC}"
echo "   • Analytics:       ${CYAN}http://localhost:3000/analytics${NC}"
echo "   • Realtime hub:    ${CYAN}ws://localhost:8765${NC} (health: http://localhost:8765/health)"
echo "   • Telemetry API:   ${CYAN}POST http://localhost:8090/telemetry${NC}"
echo ""
print_info "Log Files:"
echo "   • Backend:         ${YELLOW}logs/backend.log${NC}"
echo "   • Frontend:        ${YELLOW}logs/frontend.log${NC}"
echo ""
print_info "Running Processes:"
echo "   • Backend (Pathway + hub): PID $BACKEND_PID (feed: $FEED)"
if [ "$FEED" = "traccar" ]; then
echo "   • GPS trackers (simulated): PID $DEVICES_PID"
echo "   • Traccar web map:         ${CYAN}http://localhost:8082${NC}"
echo "   • Cause an incident:       ${CYAN}cd backend-pathway && venv-pathway/bin/python scripts/inject.py breakdown${NC}"
fi
echo "   • Next.js Frontend:        PID $FRONTEND_PID"
echo ""
print_warning "Press ${RED}Ctrl+C${NC} to stop all services"
echo ""

print_header "Demo Instructions"
echo ""
echo "1. Open your browser and go to ${CYAN}http://localhost:3000${NC}"
echo "2. Click 'Launch FleetFusion' to access the dashboard"
echo "3. Watch the live map with real-time truck tracking"
echo "4. Observe delay detection and arbitrage opportunities"
echo "5. Check the Agent Stream for real-time events"
echo ""
echo "Enjoy the demo! 🚀"
echo ""

################################################################################
# Monitor Services
################################################################################

print_step "Monitoring services... (logs updating in real-time)"
echo ""

# Keep script running and show periodic status
while true; do
    sleep 30
    
    # Check if all processes are still running
    ALL_RUNNING=true
    
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        print_error "Backend stopped unexpectedly!"
        ALL_RUNNING=false
    fi
    
    if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
        print_error "Frontend stopped unexpectedly!"
        ALL_RUNNING=false
    fi
    
    if [ "$ALL_RUNNING" = false ]; then
        print_error "One or more services crashed. Check log files."
        cleanup
        exit 1
    fi
done
