# Temporal TypeScript Demo App

A minimal Temporal TypeScript application demonstrating workflow orchestration with a simple Hello World example.

## Stack

* Node.js (v16+)
* TypeScript
* Temporal TypeScript SDK

## Project Structure

```
src/
├── activities.ts       # Activity implementations
├── client.ts           # Workflow client for starting workflows
├── worker.ts           # Worker process to execute workflows
└── workflows.ts        # Workflow definitions and implementations
```

## Prerequisites

* Node.js v16 or later
* npm
* Temporal server (self-hosted or Temporal Cloud)

## Deployment Options

### Option A: Self-Hosted Deployment

#### Terminal 1: Start Temporal Server

```bash
# Start the Temporal Server locally with Web UI on port 8080
temporal server start-dev --ui-port 8080
```

#### Terminal 2: Setup and Run Worker

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the worker:
   ```bash
   npm run worker
   ```

#### Terminal 3: Execute Workflow

1. Run the workflow:
   ```bash
   npm run workflow
   ```

### Option B: Cloud Deployment

#### Terminal 1: Setup and Run Worker

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   ```bash
   # Set Temporal Cloud variables
   export TEMPORAL_HOST_URL=<your-namespace>.tmprl.cloud:7233
   export TEMPORAL_NAMESPACE=<your-namespace>
   export TEMPORAL_TLS_CERT=<path-to-certificate.pem>
   export TEMPORAL_TLS_KEY=<path-to-private-key.key>
   ```

3. Start the worker:
   ```bash
   npm run worker
   ```

#### Terminal 2: Execute Workflow

1. Set Temporal Cloud variables:
   ```bash
   # Set Temporal Cloud variables (same as worker)
   export TEMPORAL_HOST_URL=<your-namespace>.tmprl.cloud:7233
   export TEMPORAL_NAMESPACE=<your-namespace>
   export TEMPORAL_TLS_CERT=<path-to-certificate.pem>
   export TEMPORAL_TLS_KEY=<path-to-private-key.key>
   ```

2. Run the workflow:
   ```bash
   npm run workflow
   ```

## Troubleshooting

### Connection Issues
* **Self-hosted Temporal**: Run `temporal server start-dev` in a separate terminal
* **Temporal Cloud**: Verify certificate files exist and have correct permissions
* **Command Line**: Run `temporal operator cluster health` to check connectivity

### Worker Issues
* Ensure worker is running in a separate terminal before executing workflows
* Both worker and workflow client must use the same configuration (task queue, namespace)
* Check worker logs for successful registration messages

### Common Errors
* "Failed to connect to Temporal server" - Check server is running and connectivity
* "Certificate issues" - Ensure paths are correct and files are readable

## References
* [Temporal TypeScript SDK Documentation](https://docs.temporal.io/develop/typescript)