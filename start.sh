#!/bin/bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup processes
cleanup() {
    echo -e "\nCleaning up processes..."
    pkill -f "node dist/workers/helloWorldWorker.js" 2>/dev/null || true
    exit 0
}

# Set up trap for Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM

# Function to check if a port is open
check_port() {
    local host=$1
    local port=$2
    local retries=$3
    local wait_time=$4
    local count=0

    while [ $count -lt $retries ]; do
        nc -z $host $port > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            return 0
        fi
        echo "Attempt $((count + 1))/$retries: Waiting for $host:$port..."
        sleep $wait_time
        count=$((count + 1))
    done
    return 1
}

# Function to check if we're using Temporal Cloud
is_temporal_cloud() {
    [ ! -z "$TEMPORAL_HOST_URL" ] || [ ! -z "$TEMPORAL_HOST_ADDRESS" ]
}

# Print header
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${GREEN}  Temporal TypeScript Hello World Application ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# OpenTelemetry Configuration
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4317"
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT="http://localhost:4317"
export OTEL_RESOURCE_ATTRIBUTES="service.name=temporal-hello-world,environment=development"
export OTEL_METRICS_EXPORTER=otlp
export OTEL_TRACES_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=none
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_HEADERS="signoz-access-token=1234567890"
export OTEL_LOG_LEVEL="debug"

echo -e "${BLUE}Starting application...${NC}"

# Check Temporal Server
echo -e "${BLUE}Checking Temporal Server...${NC}"
if ! check_port localhost 7233 3 2; then
    echo -e "${RED}ERROR: Temporal Server is not running. Please start it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Temporal Server is running${NC}"

# Check SigNoz/OpenTelemetry Collector
echo -e "${BLUE}Checking SigNoz/OpenTelemetry Collector...${NC}"
if ! check_port localhost 4317 3 2; then
    echo -e "${YELLOW}WARNING: SigNoz/OpenTelemetry Collector is not running. Metrics and traces will not be exported.${NC}"
else
    echo -e "${GREEN}✓ OpenTelemetry Collector is running${NC}"
fi

# Clean existing processes
echo -e "${BLUE}Cleaning up existing processes...${NC}"
pkill -f "node dist/workers/helloWorldWorker.js" 2>/dev/null || true
sleep 2

# Install dependencies and build
echo -e "${BLUE}Installing dependencies and building...${NC}"
npm install
npm run build

# Start worker
echo -e "${BLUE}Starting worker...${NC}"
node dist/workers/helloWorldWorker.js &
WORKER_PID=$!

# Wait for worker initialization
echo -e "${BLUE}Waiting for worker initialization...${NC}"
sleep 5
if ps -p $WORKER_PID > /dev/null; then
    echo -e "${GREEN}✓ Worker initialized${NC}"
else
    echo -e "${RED}ERROR: Worker failed to start${NC}"
    exit 1
fi

# Start workflow
echo -e "${BLUE}Starting workflow...${NC}"
node dist/main/helloWorldStarter.js

# Cleanup at the end
cleanup 