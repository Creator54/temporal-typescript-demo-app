import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/index';
import * as fs from 'fs';
import * as path from 'path';
import { initOpenTelemetry } from './config/opentelemetryConfig';
import { forceSpanExport, getTracer } from './config/signozTelemetryUtils';
import { DEFAULT_TASK_QUEUE } from './config/temporalConfig';
import { trace, SpanKind, context, SpanStatusCode } from '@opentelemetry/api';

async function run() {
  // Initialize OpenTelemetry
  console.log('[WORKER] Initializing OpenTelemetry...');
  await initOpenTelemetry('temporal-hello-world');
  console.log('[WORKER] OpenTelemetry initialized successfully');

  const tracer = getTracer();
  
  // Create main worker span
  const executeWorkflowSpan = tracer.startSpan('ExecuteWorkflow', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'worker.type': 'temporal',
      'service.name': 'temporal-hello-world',
      'workflow.task_queue': DEFAULT_TASK_QUEUE,
      'temporal.component': 'worker'
    }
  });
  
  // Make the span active for the worker lifetime
  const workerContext = trace.setSpan(context.active(), executeWorkflowSpan);
  
  await context.with(workerContext, async () => {
    let worker: Worker | undefined;
    try {
      // Check for Temporal Cloud environment variables
      const host = process.env.TEMPORAL_HOST_URL || 'localhost:7233';
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
      const taskQueue = DEFAULT_TASK_QUEUE;
      
      let connection;
      
      // If connecting to Temporal Cloud
      if (process.env.TEMPORAL_HOST_URL) {
        console.log(`Connecting to Temporal Cloud at ${host} with namespace ${namespace}`);
        
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
        console.log('Connecting to local Temporal server at localhost:7233');
        connection = await NativeConnection.connect({
          address: 'localhost:7233'
        });
      }

      worker = await Worker.create({
        connection,
        namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows/impl/helloWorldWorkflowImpl'),
        activities,
      });

      console.log('Worker connected, starting...');
      
      // Graceful shutdown
      const shutdown = async () => {
        console.log('\nGracefully shutting down worker...');
        await worker?.shutdown();
        executeWorkflowSpan.end();
        console.log('[WORKER] Shutting down OpenTelemetry SDK');
        await forceSpanExport();
        console.log('[WORKER] Worker shut down successfully');
        process.exit(0);
      };
      
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);

      await worker.run();
    } catch (err) {
      console.error('Error running worker:', err);
      executeWorkflowSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err)
      });
      executeWorkflowSpan.end();
      await forceSpanExport();
      console.log('[WORKER] Completed span export');
      process.exit(1);
    }
  });
}

run(); 