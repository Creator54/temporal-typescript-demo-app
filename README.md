# Temporal TypeScript Hello World

A simple Hello World application using Temporal and TypeScript.

## Prerequisites

- Node.js (v16 or later)
- Temporal server running locally (default: localhost:7233)
- npm or yarn

## Quick Start

The easiest way to run the application is using the start script:

```bash
./start.sh
```

This script will:
1. Check all prerequisites
2. Install dependencies if needed
3. Start the worker
4. Execute the workflow
5. Handle graceful shutdown

## Manual Setup

If you prefer to run the components manually:

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Running the Application Manually

1. First, make sure your Temporal server is running.

2. In one terminal, start the worker:
```bash
npm run worker
```

3. In another terminal, run the workflow:
```bash
npm run workflow
```

The workflow will execute and print "Hello Temporal!" to the console.

## Project Structure

- `src/workflows.ts` - Contains the workflow definition
- `src/worker.ts` - Worker process that hosts the workflow
- `src/client.ts` - Client code to start the workflow
- `start.sh` - Convenience script to run the entire demo

## Environment Variables

- `TEMPORAL_SERVER_URL` - Temporal server URL (default: localhost:7233)
- `TEMPORAL_NAMESPACE` - Temporal namespace (default: default)
- `TEMPORAL_TLS_CERT` - Path to TLS certificate (for Temporal Cloud)
- `TEMPORAL_TLS_KEY` - Path to TLS key (for Temporal Cloud)
- `SIGNOZ_INGESTION_KEY` - SigNoz ingestion key (optional) 