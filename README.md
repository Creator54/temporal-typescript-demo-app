# Temporal TypeScript Demo App with OpenTelemetry

A minimal Temporal TypeScript application demonstrating workflow orchestration with OpenTelemetry integration for observability.

## Stack

* Node.js (v16+)
* TypeScript
* Temporal TypeScript SDK
* OpenTelemetry for metrics and tracing

## Project Structure

```
src/
├── activities.ts       # Activity implementations
├── client.ts           # Workflow client for starting workflows
├── instrumentation.ts  # OpenTelemetry setup and configuration
├── worker.ts           # Worker process to execute workflows
└── workflows.ts        # Workflow definitions and implementations
```

## Prerequisites

* Node.js v16 or later
* npm
* Temporal server (self-hosted or Temporal Cloud)
* OpenTelemetry collector (for observability)

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

2. Set environment variables:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
   export OTEL_RESOURCE_ATTRIBUTES="service.name=temporal-hello-world"
   ```

3. Start the worker:
   ```bash
   npm run worker
   ```

#### Terminal 3: Execute Workflow

1. Set the same environment variables if needed (usually not required for local):
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
   export OTEL_RESOURCE_ATTRIBUTES="service.name=temporal-hello-world"
   ```

2. Run the workflow:
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
   
   # Set OpenTelemetry variables for cloud
   export OTEL_EXPORTER_OTLP_ENDPOINT="https://<your-ingestion-endpoint>"
   export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=<your-token>"
   export OTEL_RESOURCE_ATTRIBUTES="service.name=temporal-hello-world"
   ```

3. Start the worker:
   ```bash
   npm run worker
   ```

#### Terminal 2: Execute Workflow

1. Set Temporal Cloud variables:
   ```bash
   # Set Temporal Cloud variables
   export TEMPORAL_HOST_URL=<your-namespace>.tmprl.cloud:7233
   export TEMPORAL_NAMESPACE=<your-namespace>
   export TEMPORAL_TLS_CERT=<path-to-certificate.pem>
   export TEMPORAL_TLS_KEY=<path-to-private-key.key>
   
   # Set OpenTelemetry variables for cloud
   export OTEL_EXPORTER_OTLP_ENDPOINT="https://<your-ingestion-endpoint>"
   export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=<your-token>"
   export OTEL_RESOURCE_ATTRIBUTES="service.name=temporal-hello-world"
   ```

2. Run the workflow:
   ```bash
   npm run workflow
   ```

## Available Metrics

All metrics are automatically prefixed with `temporal_`. For a complete list of available metrics, see the [Temporal SDK Metrics Reference](https://docs.temporal.io/references/sdk-metrics). Some key metrics include:

* `workflow_completed` - Counter for completed workflows
* `workflow_failed` - Counter for failed workflows 
* `activity_execution_latency` - Histogram for activity execution times

## Troubleshooting

### Connection Issues
* **Self-hosted Temporal**: Run `temporal server start-dev` in a separate terminal
* **Temporal Cloud**: Verify certificate files exist and have correct permissions
* **Command Line**: Run `temporal operator cluster health` to check connectivity

### OpenTelemetry Issues
* **Self-hosted**: Ensure collector is running on port 4317
* **Cloud**: Verify your access token and endpoint URL
* **Metrics Verification**: Check the observability platform to confirm data is flowing

### Worker Issues
* Ensure worker is running in a separate terminal before executing workflows
* Both worker and workflow client must use the same configuration (task queue, namespace)
* Check worker logs for successful registration messages

### Common Errors
* "Failed to connect to Temporal server" - Check server is running and connectivity
* "Certificate issues" - Ensure paths are correct and files are readable
* "No metrics data" - Verify OTLP endpoint is accessible and receiving data

## References
* [Temporal TypeScript SDK - OpenTelemetry Interceptors Sample](https://github.com/temporalio/samples-typescript/tree/main/interceptors-opentelemetry)
* [Temporal TypeScript SDK - Observability Documentation](https://docs.temporal.io/develop/typescript/observability)
* [Temporal SDK Metrics Reference](https://docs.temporal.io/references/sdk-metrics)