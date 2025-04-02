import { NativeConnection, Runtime, Worker } from '@temporalio/worker';
import * as activities from './activities';
import * as fs from 'fs';
import * as path from 'path';
import {
  OpenTelemetryActivityInboundInterceptor,
  OpenTelemetryActivityOutboundInterceptor,
  makeWorkflowExporter,
} from '@temporalio/interceptors-opentelemetry/lib/worker';
import { otelSdk, resource, traceExporter } from './instrumentation';
import { logs } from '@opentelemetry/api-logs';

const logger = logs.getLogger('worker');

function initializeRuntime() {
  Runtime.install({
    telemetryOptions: {
      metrics: {
        otel: {
          // Default OpenTelemetry endpoint for SigNoz cloud
          // Available regions:
          // - US: ingest.us.signoz.cloud:443
          // - EU: ingest.eu.signoz.cloud:443
          // - IN: ingest.in.signoz.cloud:443
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://ingest.in.signoz.cloud:443',
          metricsExportInterval: '1s'
        }
      },
    },
  });
}

async function run() {
  initializeRuntime();

  let worker: Worker | undefined;
  try {
    // Check for Temporal Cloud environment variables
    const host = process.env.TEMPORAL_HOST_URL || 'localhost:7233';
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
    const taskQueue = 'hello-world-task-queue';
    
    let connection;
    
    // If connecting to Temporal Cloud
    if (process.env.TEMPORAL_HOST_URL) {
      logger.emit({ body: `Connecting to Temporal Cloud at ${host} with namespace ${namespace}` });
      
      // Verify that TLS cert and key are available
      const tlsCert = process.env.TEMPORAL_TLS_CERT;
      const tlsKey = process.env.TEMPORAL_TLS_KEY;
      
      if (!tlsCert || !tlsKey) {
        throw new Error('TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY must be set for Temporal Cloud connection');
      }
      
      // Check if the files exist
      const certPath = path.resolve(process.cwd(), tlsCert);
      const keyPath = path.resolve(process.cwd(), tlsKey);
      
      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        throw new Error(`TLS certificates not found at ${certPath} or ${keyPath}`);
      }
      
      connection = await NativeConnection.connect({
        address: host,
        tls: {
          serverNameOverride: host.split(':')[0],
          clientCertPair: {
            crt: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          },
        },
      });
    } else {
      // Connect to local Temporal server
      logger.emit({ body: 'Connecting to local Temporal server at localhost:7233' });
      connection = await NativeConnection.connect({
        address: 'localhost:7233'
      });
    }

    worker = await Worker.create({
      connection,
      namespace,
      taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
      sinks: traceExporter && {
        exporter: makeWorkflowExporter(traceExporter, resource),
      },
      interceptors: traceExporter && {
        workflowModules: [require.resolve('./workflows')],
        activity: [
          (ctx) => ({
            inbound: new OpenTelemetryActivityInboundInterceptor(ctx),
            outbound: new OpenTelemetryActivityOutboundInterceptor(ctx),
          }),
        ],
      },
    });

    logger.emit({ body: 'Worker connected, starting...' });
    
    // Graceful shutdown
    process.once('SIGINT', async () => {
      logger.emit({ body: 'Gracefully shutting down worker...' });
      await worker?.shutdown();
      process.exit(0);
    });
    process.once('SIGTERM', async () => {
      logger.emit({ body: 'Gracefully shutting down worker...' });
      await worker?.shutdown();
      process.exit(0);
    });

    await worker.run();
  } catch (err) {
    logger.emit({ body: `Error running worker: ${err}`, severityText: 'ERROR' });
    process.exit(1);
  } finally {
    await otelSdk.shutdown();
  }
}

run(); 