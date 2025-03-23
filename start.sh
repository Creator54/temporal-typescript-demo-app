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
    echo -e "\n${BLUE}Initiating graceful shutdown...${NC}"
    
    if [ ! -z "$WORKER_PID" ]; then
        echo -e "${YELLOW}Stopping worker process...${NC}"
        kill -SIGTERM $WORKER_PID 2>/dev/null || true
        
        # Wait for graceful shutdown
        for i in {1..5}; do
            if ! kill -0 $WORKER_PID 2>/dev/null; then
                echo -e "${GREEN}Worker stopped gracefully${NC}"
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if kill -0 $WORKER_PID 2>/dev/null; then
            echo -e "${YELLOW}Force stopping worker...${NC}"
            kill -9 $WORKER_PID 2>/dev/null || true
        fi
    fi

    # Cleanup any remaining processes
    pkill -f "ts-node src/worker.ts" 2>/dev/null || true
    
    echo -e "${GREEN}Cleanup completed${NC}"
    exit 0
}

# Function to check worker startup
check_worker() {
    local pid=$1
    local timeout=5
    local count=0
    
    echo -e "${YELLOW}Waiting for worker initialization...${NC}"
    while [ $count -lt $timeout ]; do
        if ! kill -0 $pid 2>/dev/null; then
            echo -e "\n${RED}✗ Worker failed to start${NC}"
            return 1
        fi
        sleep 1
        echo -n "."
        count=$((count + 1))
    done
    echo -e "\n${GREEN}✓ Worker initialized${NC}"
    return 0
}

# Set up trap for Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM EXIT

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
        echo -e "${YELLOW}Attempt $((count + 1))/$retries: Waiting for $host:$port...${NC}"
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
export OTEL_RESOURCE_ATTRIBUTES="service.name=temporal-hello-world"

# If SigNoz ingestion key is provided, set it
if [ ! -z "$SIGNOZ_INGESTION_KEY" ]; then
    export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=$SIGNOZ_INGESTION_KEY"
    echo -e "${GREEN}✓ Using SigNoz with provided ingestion key${NC}"
fi

# Debug output for Temporal config
echo -e "\n${BLUE}Temporal configuration:${NC}"
echo -e "TEMPORAL_HOST_URL: '${TEMPORAL_HOST_URL}'"
echo -e "TEMPORAL_NAMESPACE: '${TEMPORAL_NAMESPACE}'"
echo -e "TEMPORAL_TLS_CERT: '${TEMPORAL_TLS_CERT}'"
echo -e "TEMPORAL_TLS_KEY: '${TEMPORAL_TLS_KEY}'"

# Check Temporal Server (only for local development)
if ! is_temporal_cloud; then
    echo -e "\n${BLUE}Checking Temporal Server...${NC}"
    if ! check_port localhost 7233 3 2; then
        echo -e "${RED}✗ Error: Local Temporal Server is not running${NC}"
        echo -e "Please start it first with:"
        echo -e "${GREEN}temporal server start-dev --ui-port 8080${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Local Temporal Server is running${NC}"
else
    echo -e "\n${BLUE}Checking Temporal Cloud configuration...${NC}"
    if [ -z "$TEMPORAL_TLS_CERT" ] || [ -z "$TEMPORAL_TLS_KEY" ]; then
        echo -e "${RED}✗ Error: TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY must be set for Temporal Cloud${NC}"
        exit 1
    fi
    
    # Check if certificate files exist
    if [ ! -f "$TEMPORAL_TLS_CERT" ] || [ ! -f "$TEMPORAL_TLS_KEY" ]; then
        echo -e "${RED}✗ Error: Certificate files $TEMPORAL_TLS_CERT or $TEMPORAL_TLS_KEY not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Temporal Cloud credentials verified${NC}"
fi

# Check SigNoz/OpenTelemetry Collector
echo -e "\n${BLUE}Checking OpenTelemetry Collector...${NC}"
if ! check_port localhost 4317 3 2; then
    echo -e "${YELLOW}⚠ Warning: OpenTelemetry Collector is not running${NC}"
    echo -e "   Metrics and traces will not be exported"
else
    echo -e "${GREEN}✓ OpenTelemetry Collector is running${NC}"
fi

# Clean existing processes
echo -e "\n${BLUE}Preparing environment...${NC}"
pkill -f "ts-node src/worker.ts" 2>/dev/null || true
sleep 2

# Install dependencies if needed
echo -e "\n${BLUE}Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Start the worker
echo -e "\n${BLUE}Starting worker process...${NC}"
npm run worker &
WORKER_PID=$!

# Check if worker started successfully
if ! check_worker $WORKER_PID; then
    echo -e "${RED}Error: Worker failed to start. Check the logs above for details.${NC}"
    exit 1
fi

# Start the workflow
echo -e "\n${BLUE}Executing workflow...${NC}"
if npm run workflow; then
    echo -e "${GREEN}✓ Workflow completed successfully${NC}"
else
    echo -e "${RED}✗ Workflow execution failed${NC}"
    exit 1
fi

echo -e "\n${BLUE}Demo completed successfully${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}Initiating graceful shutdown...${NC}"

# Wait for metrics to be exported (similar to Java implementation)
echo -e "${YELLOW}Waiting for metrics export to complete...${NC}"
for i in {1..5}; do
    echo -n "."
    sleep 1
done
echo ""

# Cleanup
echo -e "Stopping worker process..."
cleanup 