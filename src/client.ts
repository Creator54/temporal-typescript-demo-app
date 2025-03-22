import { Client, Connection } from '@temporalio/client';
import * as fs from 'fs';
import { initOpenTelemetry } from './config/opentelemetryConfig';
import { forceSpanExport, getTracer, getMeter } from './config/signozTelemetryUtils';
import { DEFAULT_TASK_QUEUE, registerDashboardMetrics, configureTemporalTracing } from './config/temporalConfig';
import { OpenTelemetryWorkflowClientInterceptor } from '@temporalio/interceptors-opentelemetry';
import { trace, SpanKind, context, SpanStatusCode } from '@opentelemetry/api';
import * as WorkflowMetricsUtil from './config/workflowMetricsUtil';

// Simple ID generator function
function generateId(length = 8) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function run() {
  // Configure Temporal tracing to match Java implementation
  configureTemporalTracing();
  
  // Set environment variables for SigNoz
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317';
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
  process.env.OTEL_METRICS_EXPORT_INTERVAL = '5000';
  process.env.OTEL_METRICS_EXPORT_TIMEOUT = '30000';
  
  // Initialize OpenTelemetry
  console.log('[STARTER] Initializing OpenTelemetry...');
  await initOpenTelemetry('temporal-hello-world');
  console.log('[STARTER] OpenTelemetry initialized successfully');

  // Initialize metrics
  WorkflowMetricsUtil.initializeMetrics();

  // Record initial service request for SigNoz dashboard
  WorkflowMetricsUtil.recordServiceRequest('ClientStart');

  // Start periodic metrics emissions for dashboard
  const stopMetrics = registerDashboardMetrics();

  // Get tracer and meter instances for instrumentation
  const tracer = getTracer();
  const meter = getMeter();

  // Create workflow execution counter for monitoring workflow activity
  const workflowStartCounter = meter.createCounter('workflow_started_count_total', {
    description: 'Total workflow executions started'
  });
  
  const workflowCompletionCounter = meter.createCounter('workflow_completed_count_total', {
    description: 'Total workflow executions completed'
  });

  // Create main "StartWorkflow" span to track the entire workflow execution process
  const startWorkflowSpan = tracer.startSpan('StartWorkflow', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'workflow.type': 'HelloWorld',
      'service.name': 'temporal-hello-world',
      'service.namespace': 'default',
      'deployment.environment': process.env.OTEL_ENVIRONMENT || 'development',
      'temporal.component': 'starter'
    }
  });

  // Make the start workflow span the active span for this context
  const starterContext = trace.setSpan(context.active(), startWorkflowSpan);
  
  try {
    await context.with(starterContext, async () => {
      console.log('Creating Temporal client...');
      
      // Check for Temporal Cloud environment variables
      const host = process.env.TEMPORAL_HOST_URL || 'localhost:7233';
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
      
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
        
        connection = await Connection.connect({
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
        // For local development
        console.log(`Connecting to local Temporal server at ${host} with namespace ${namespace}`);
        connection = await Connection.connect({
          address: host,
        });
      }
      
      const client = new Client({
        connection,
        namespace,
        dataConverter: {
          payloadConverterPath: require.resolve('./config/temporalConfig'),
        },
        // Use the official OpenTelemetry client interceptor with the correct format
        interceptors: {
          workflow: [new OpenTelemetryWorkflowClientInterceptor()]
        }
      });
      
      // Generate a unique workflow ID for this execution
      const workflowId = `hello-world-${generateId()}`;
      console.log('Starting workflow with ID:', workflowId);
      
      // Record workflow started metric
      workflowStartCounter.add(1, {
        'workflow_type': workflowId,
        'operation': 'StartWorkflow'
      });
      
      // Record service request metric for SigNoz dashboard
      WorkflowMetricsUtil.recordServiceRequest('StartWorkflow');
      
      // Use a consistent workflow name - can be either 'sayHello' or 'HelloWorldWorkflow'
      // since we export both in the workflows/index.ts
      const workflow = 'HelloWorldWorkflow';
      const runId = generateId(12);
      
      // Add workflow started attribute to parent span
      startWorkflowSpan.setAttribute('workflow.started', true);
      startWorkflowSpan.setAttribute('workflow.name', 'Temporal');
      startWorkflowSpan.setAttribute('workflow.id', workflowId);
      
      try {
        console.log('Executing workflow...');
        console.log(`Starting workflow '${workflow}' in task queue '${DEFAULT_TASK_QUEUE}'`);
        
        // Create ExecuteWorkflow span as a child of StartWorkflow
        const executeWorkflowSpan = tracer.startSpan('ExecuteWorkflow', {
          kind: SpanKind.INTERNAL,
          attributes: {
            'workflow.id': workflowId,
            'workflow.type': 'HelloWorld',
            'service.name': 'temporal-hello-world',
            'service.namespace': 'default',
            'workflow.task_queue': DEFAULT_TASK_QUEUE
          }
        });
        
        try {
          // Make the execution span active during workflow execution
          const executeContext = trace.setSpan(context.active(), executeWorkflowSpan);
          
          const result = await context.with(executeContext, async () => {
            const handle = await client.workflow.start(workflow, {
              workflowId,
              taskQueue: DEFAULT_TASK_QUEUE,
              args: ['Temporal'],
              memo: {
                runId: runId,
                description: 'A demonstration workflow for Temporal TypeScript',
              },
            });
            
            console.log(`Workflow started with ID: ${workflowId}, run ID: ${handle.firstExecutionRunId}`);
            console.log('Waiting for workflow result...');
            
            // Add run ID to the executeWorkflowSpan as required by Java spec
            executeWorkflowSpan.setAttribute('runid', handle.firstExecutionRunId);
            
            return await handle.result();
          });
          
          // Record workflow completed metric
          workflowCompletionCounter.add(1, {
            'workflow_type': workflowId,
            'operation': 'CompletionStats'
          });
          
          // Record service request completion metric for SigNoz dashboard
          WorkflowMetricsUtil.recordServiceRequest('WorkflowCompleted');
          
          console.log('Workflow completed with result:', result);
          
          // Record successful workflow execution in spans
          executeWorkflowSpan.setAttribute('workflow.result', result);
          executeWorkflowSpan.setStatus({ code: SpanStatusCode.OK });
          startWorkflowSpan.setAttribute('workflow.completed', true);
          
          // Record workflow completion and success metrics
          workflowCompletionCounter.add(1);
          WorkflowMetricsUtil.recordSuccess(workflow, workflowId, workflowId, namespace);
          
          // Record additional operations for more complete metrics
        } catch (error: any) {
          console.error('Workflow execution failed:', error);
          
          // Record workflow failure in spans
          executeWorkflowSpan.recordException(error);
          executeWorkflowSpan.setStatus({ code: SpanStatusCode.ERROR });
          startWorkflowSpan.setAttribute('workflow.completed', false);
          
          // Record workflow failure metric
          workflowCompletionCounter.add(1);
          WorkflowMetricsUtil.recordFailure(workflow, workflowId, runId, namespace);
          
          if (error.name === 'TimeoutError') {
            WorkflowMetricsUtil.recordTimeout(workflow, workflowId, runId, namespace);
            WorkflowMetricsUtil.recordTimeoutError();
          } else {
            WorkflowMetricsUtil.recordSystemError();
          }
          
          throw error;
        } finally {
          // End the ExecuteWorkflow span
          executeWorkflowSpan.end();
        }
      } catch (error: any) {
        console.error('Error during workflow execution:', error);
        startWorkflowSpan.recordException(error);
        startWorkflowSpan.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      }
    });
  } catch (error) {
    console.error('Error in workflow starter:', error);
    startWorkflowSpan.setStatus({ code: SpanStatusCode.ERROR });
    startWorkflowSpan.recordException(error as Error);
  } finally {
    // End the StartWorkflow span
    startWorkflowSpan.end();
    
    // Allow more time for metrics to be exported
    console.log('Waiting for telemetry to be exported...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop the dashboard metrics timer
    stopMetrics();
    
    // Force export of any pending spans
    console.log('Forcing export of pending spans...');
    await forceSpanExport();
    
    // Clean up metrics resources
    WorkflowMetricsUtil.cleanup();
    
    console.log('Workflow execution complete');
  }
}

// Run the workflow
run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 