import { Client, Connection } from '@temporalio/client';
import * as fs from 'fs';
import * as path from 'path';
import { initOpenTelemetry } from './config/opentelemetryConfig';
import { forceSpanExport, getTracer, getMeter } from './config/signozTelemetryUtils';
import { DEFAULT_TASK_QUEUE } from './config/temporalConfig';
import { trace, SpanKind, context, SpanStatusCode, AttributeValue } from '@opentelemetry/api';

// Simple ID generator function to replace nanoid
function generateId(length = 8) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function run() {
  // Initialize OpenTelemetry
  console.log('[STARTER] Initializing OpenTelemetry...');
  await initOpenTelemetry('temporal-hello-world');
  console.log('[STARTER] OpenTelemetry initialized successfully');

  // Get tracer and meter instances for instrumentation
  const tracer = getTracer();
  const meter = getMeter();

  // Create workflow execution counter for monitoring workflow activity
  const workflowCounter = meter.createCounter('workflow.executions', {
    description: 'Number of workflow executions'
  });

  // Create main "StartWorkflow" span to track the entire workflow execution process
  const startWorkflowSpan = tracer.startSpan('StartWorkflow', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'workflow.type': 'temporal',
      'service.name': 'temporal-hello-world',
      'temporal.component': 'starter',
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
        
        connection = await Connection.connect({
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
        connection = await Connection.connect();
      }
      
      const client = new Client({
        connection,
        namespace,
      });

      const workflowId = `hello-world-${generateId()}`;
      console.log('Starting workflow with ID:', workflowId);

      // Create a child span for the specific workflow execution
      const executeWorkflowSpan = tracer.startSpan('ExecuteWorkflow', {
        kind: SpanKind.INTERNAL,
        attributes: {
          'workflow.id': workflowId,
          'workflow.name': 'HelloWorldWorkflow',
          'workflow.task_queue': taskQueue,
          'service.name': 'temporal-hello-world',
          'temporal.component': 'starter',
          'temporal.workflow.type': 'HelloWorldWorkflow'
        }
      });

      // Create another span for the specific workflow type
      const workflowTypeSpan = tracer.startSpan(`StartWorkflow:HelloWorldWorkflow`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          'workflow.id': workflowId,
          'workflow.name': 'HelloWorldWorkflow',
          'workflow.task_queue': taskQueue,
          'service.name': 'temporal-hello-world',
          'temporal.component': 'starter',
          'temporal.workflow.type': 'HelloWorldWorkflow'
        }
      });

      // Track the execution with our counter
      workflowCounter.add(1, {
        'workflow.name': 'HelloWorldWorkflow',
        'workflow.task_queue': taskQueue
      });

      try {
        console.log('Executing workflow...');
        const handle = await client.workflow.start('sayHello', {
          taskQueue: taskQueue,
          workflowId,
          args: ['Temporal'],
          workflowExecutionTimeout: '1 minute',
        });

        console.log('Waiting for workflow result...');
        const result = await handle.result();
        console.log('Workflow completed successfully!');
        console.log('Workflow result:', result);

        // Record successful outcome in our spans
        executeWorkflowSpan.setStatus({ code: SpanStatusCode.OK });
        executeWorkflowSpan.setAttribute('workflow.status', 'completed');
        executeWorkflowSpan.setAttribute('temporal.status', 'completed');
        executeWorkflowSpan.setAttribute('workflow.result', result);

        workflowTypeSpan.setStatus({ code: SpanStatusCode.OK });
        workflowTypeSpan.setAttribute('workflow.status', 'completed');
        workflowTypeSpan.setAttribute('temporal.status', 'completed');
        workflowTypeSpan.setAttribute('workflow.result', result);

        // End child spans
        executeWorkflowSpan.end();
        workflowTypeSpan.end();
      } catch (err) {
        console.error('Error running workflow:', err);
        
        // Record error in our spans
        executeWorkflowSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err)
        });
        executeWorkflowSpan.setAttribute('workflow.status', 'failed');
        executeWorkflowSpan.setAttribute('temporal.status', 'failed');
        
        workflowTypeSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err)
        });
        workflowTypeSpan.setAttribute('workflow.status', 'failed');
        workflowTypeSpan.setAttribute('temporal.status', 'failed');
        
        // End child spans
        executeWorkflowSpan.end();
        workflowTypeSpan.end();
        
        process.exit(1);
      } finally {
        await connection.close();
      }
    });
  } catch (err) {
    console.error('Error in workflow starter:', err);
    startWorkflowSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err)
    });
  } finally {
    // Always end the main span and force export
    startWorkflowSpan.end();
    console.log('[STARTER] Forcing export of telemetry data...');
    await forceSpanExport();
    console.log('[STARTER] Telemetry export completed');
  }
}

run(); 