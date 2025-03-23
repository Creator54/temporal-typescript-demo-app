// Preload grpc-js to ensure it's loaded before instrumentation
import '@grpc/grpc-js';

import { NativeConnection, Worker } from '@temporalio/worker';
import * as fs from 'fs';
import { initOpenTelemetry } from './config/opentelemetryConfig';
import { forceSpanExport, getTracer } from './config/signozTelemetryUtils';
import { DEFAULT_TASK_QUEUE, configureTemporalTracing, registerDashboardMetrics } from './config/temporalConfig';
import { trace, SpanKind, context, SpanStatusCode } from '@opentelemetry/api';
import * as WorkflowMetricsUtil from './config/workflowMetricsUtil';
import { MetricAttributes } from '@opentelemetry/api';
import os from 'os';
import util from 'util';

async function run() {
  // Configure Temporal tracing to match Java implementation
  configureTemporalTracing();
  
  // Set environment variables for SigNoz if not already set
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317';
  }
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
  process.env.OTEL_METRICS_EXPORT_INTERVAL = '5000';
  process.env.OTEL_METRICS_EXPORT_TIMEOUT = '4000'; // Ensure timeout is less than interval
  
  // Initialize OpenTelemetry
  console.log('[WORKER] Initializing OpenTelemetry...');
  await initOpenTelemetry('temporal-hello-world');
  console.log('[WORKER] OpenTelemetry initialized successfully');
  
  // Initialize metrics for dashboard
  WorkflowMetricsUtil.initializeMetrics();
  
  // Record worker start metric
  WorkflowMetricsUtil.recordServiceRequest('WorkerStart');
  
  // Get the parent tracer instance
  const tracer = getTracer();
  
  // Create a parent span for the whole worker lifecycle
  const parentSpan = tracer.startSpan('WorkerExecution', {
    kind: SpanKind.SERVER,
    attributes: {
      'service.name': 'temporal-hello-world-worker',
      'temporal.namespace': 'default',
      'temporal.task_queue': DEFAULT_TASK_QUEUE
    }
  });
  
  // Register dashboard metrics and store cleanup function
  console.log('[WORKER] Registering dashboard metrics...');
  const stopDashboardMetrics = registerDashboardMetrics();
  console.log('[WORKER] Dashboard metrics registered successfully');
  
  // Wrap the main worker execution in a context with the parent span
  context.with(trace.setSpan(context.active(), parentSpan), async () => {
    let worker: Worker | undefined;
    
    // Create a span for the workflow execution
    const executeWorkflowSpan = tracer.startSpan('ExecuteWorkflow', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'service.name': 'temporal-hello-world-worker',
        'temporal.operation': 'ExecuteWorkflow'
      }
    });
    
    // Record additional worker metrics for dashboard
    WorkflowMetricsUtil.recordServiceRequest('PollWorkflowTaskQueue');
    
    try {
      // Create Temporal connection - detailed logging for user visibility
      console.log(`Connecting to Temporal server at ${process.env.TEMPORAL_HOST_URL || 'localhost:7233'} with namespace ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
      
      // Check if using Temporal Cloud
      const useTemporalCloud = !!process.env.TEMPORAL_HOST_URL;
      let connection;
      
      if (useTemporalCloud) {
        // Verify TLS certificates exist
        const tlsCert = process.env.TEMPORAL_TLS_CERT;
        const tlsKey = process.env.TEMPORAL_TLS_KEY;
        
        if (!tlsCert || !tlsKey) {
          throw new Error('TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY must be set for Temporal Cloud connection');
        }
        
        // Read certificate files
        let certPem: Buffer | string = tlsCert;
        let keyPem: Buffer | string = tlsKey;
        
        // If the cert and key are file paths, read them
        if (tlsCert.endsWith('.pem') && fs.existsSync(tlsCert)) {
          certPem = fs.readFileSync(tlsCert);
        }
        
        if (tlsKey.endsWith('.key') && fs.existsSync(tlsKey)) {
          keyPem = fs.readFileSync(tlsKey);
        }
        
        // Connect to Temporal Cloud with TLS
        console.log(`Using TLS with cert: ${tlsCert}, key: ${tlsKey}`);
        const host = process.env.TEMPORAL_HOST_URL || '';
        connection = await NativeConnection.connect({
          address: host,
          tls: {
            serverNameOverride: process.env.TEMPORAL_SERVER_NAME || host.split(':')[0],
            clientCertPair: {
              crt: certPem as Buffer,
              key: keyPem as Buffer,
            },
          },
        });
      } else {
        // Connect to local Temporal server
        connection = await NativeConnection.connect({
          address: 'localhost:7233',
          tls: false,
        });
      }
      
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
      const taskQueue = DEFAULT_TASK_QUEUE;
      
      // Record service restart for worker
      WorkflowMetricsUtil.recordServiceRestart('worker');

      // Create worker with OpenTelemetry interceptors
      worker = await Worker.create({
        connection,
        namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows'),
        dataConverter: {
          payloadConverterPath: require.resolve('./config/temporalConfig'),
        },
        // Add OpenTelemetry interceptors using the documented format
        interceptors: {
          // Use the file path for workflow interceptor module
          workflowModules: [
            require.resolve('./config/workflowInterceptors')
          ]
        }
      });
      
      // Create and start the worker
      console.log(`Starting worker for task queue: ${taskQueue}`);
      
      // Record additional operation metrics
      WorkflowMetricsUtil.recordServiceRequest('RegisterWorker');
    
      // Start the worker and wait for workflows
      await worker.run();
      
      // Clean shutdown handling
      process.once('SIGINT', async () => {
        console.log('Worker shutdown initiated...');
        
        if (worker) {
          await worker.shutdown();
          worker = undefined;
        }
        
        console.log('Cleaning up metrics resources...');
        stopDashboardMetrics();
        WorkflowMetricsUtil.cleanup();
        
        // Mark the spans as completed with proper status, matching Java implementation
        executeWorkflowSpan.setAttribute('workflow.completed', true);
        executeWorkflowSpan.setStatus({ code: SpanStatusCode.OK });
        
        parentSpan.setAttribute('workflow.completed', true);
        parentSpan.setStatus({ code: SpanStatusCode.OK });
        
        // Wait briefly to allow metrics to be batched
        console.log('Finalizing telemetry...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force export of any pending spans
        console.log('Forcing export of pending spans...');
        await forceSpanExport();
        
        // End spans before exiting
        executeWorkflowSpan.end();
        parentSpan.end();
        
        console.log('Worker shutdown complete');
        process.exit(0);
      });
    } catch (error) {
      console.error('[WORKER] Error during worker execution:', error);
      
      // Record appropriate metrics for the error
      WorkflowMetricsUtil.recordServiceError('WorkerExecution');
        
      try {
        // Record detailed error information in both spans - same pattern as Java
        executeWorkflowSpan.recordException(error as Error);
        executeWorkflowSpan.setStatus({ code: SpanStatusCode.ERROR });
        executeWorkflowSpan.setAttribute('error.type', error instanceof Error ? error.name : 'UnknownError');
        executeWorkflowSpan.setAttribute('error.message', error instanceof Error ? error.message : String(error));
        
        parentSpan.recordException(error as Error);
        parentSpan.setStatus({ code: SpanStatusCode.ERROR });
        
        // Clean up resources
        stopDashboardMetrics();
        WorkflowMetricsUtil.cleanup();
      } finally {
        // Always end spans in finally block, same as Java implementation
        executeWorkflowSpan.end();
        parentSpan.end();
        process.exit(1);
      }
    }
  });
}

// Run the worker
run().catch(err => {
  console.error('[WORKER] Fatal error:', err);
  process.exit(1);
});