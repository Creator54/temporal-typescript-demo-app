import { Connection, Client } from '@temporalio/client';
import { initOpenTelemetry } from '../config/opentelemetryConfig';
import { forceSpanExport, getTracer, getMeter } from '../config/signozTelemetryUtils';
import { DEFAULT_TASK_QUEUE, getClientOptions } from '../config/temporalConfig';
import { trace, SpanKind, context, AttributeValue } from '@opentelemetry/api';
import { HelloWorldWorkflow } from '../workflows/interfaces/helloWorldWorkflow';

/**
 * Workflow Starter Application
 * 
 * This module demonstrates how to:
 * 1. Initialize OpenTelemetry for a Temporal client application
 * 2. Create and manage spans for workflow execution tracking
 * 3. Execute a workflow with proper instrumentation
 * 4. Handle the workflow result with appropriate telemetry
 */
async function run() {
    // Initialize OpenTelemetry with the same service name as Java
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
            console.log('[STARTER] Connecting to Temporal server...');
            const connection = await Connection.connect();
            const client = new Client({
                connection
            });
            console.log('[STARTER] Connected to Temporal server successfully');

            // Record workflow start in metrics
            workflowCounter.add(1, {
                workflow: 'HelloWorldWorkflow',
                status: 'started'
            });

            // Prepare workflow inputs
            const name = 'Temporal';
            const workflowId = `hello-world-${Date.now()}`;
            console.log(`[STARTER] Starting workflow with ID: ${workflowId}`);

            // Update span with workflow-specific details for better tracing
            startWorkflowSpan.setAttributes({
                'workflow.id': workflowId,
                'workflow.name': 'HelloWorldWorkflow',
                'workflow.task_queue': DEFAULT_TASK_QUEUE,
                'workflow.input': name,
            });
            
            // Create "StartWorkflow:HelloWorldWorkflow" span - matches Java naming convention
            const startWorkflowHelloWorldSpan = tracer.startSpan('StartWorkflow:HelloWorldWorkflow', {
                kind: SpanKind.INTERNAL,
                attributes: {
                    'workflow.id': workflowId,
                    'workflow.name': 'HelloWorldWorkflow',
                    'workflow.task_queue': DEFAULT_TASK_QUEUE,
                    'service.name': 'temporal-hello-world',
                    'temporal.component': 'starter',
                    'temporal.workflow.type': 'HelloWorldWorkflow',
                }
            });

            // Create "ExecuteWorkflow" span to track the actual workflow execution
            const executeSpan = tracer.startSpan('ExecuteWorkflow', {
                kind: SpanKind.INTERNAL,
                attributes: {
                    'workflow.id': workflowId,
                    'workflow.name': 'HelloWorldWorkflow',
                    'workflow.task_queue': DEFAULT_TASK_QUEUE,
                    'service.name': 'temporal-hello-world',
                    'temporal.component': 'starter',
                    'temporal.workflow.type': 'HelloWorldWorkflow',
                }
            });

            try {
                // Set execute span as active for workflow execution context
                const executeContext = trace.setSpan(context.active(), executeSpan);
                
                // Set status to 'starting' before executing the workflow
                executeSpan.setAttributes({
                    'workflow.status': 'starting',
                    'temporal.status': 'starting',
                });
                
                // Execute the workflow with the specified parameters
                const result = await context.with(executeContext, () => 
                    client.workflow.execute('sayHello', {
                        taskQueue: DEFAULT_TASK_QUEUE,
                        workflowId: workflowId,
                        args: [name],
                    })
                );

                // Record successful workflow completion in metrics
                workflowCounter.add(1, {
                    workflow: 'HelloWorldWorkflow',
                    status: 'completed'
                });

                // Update execute span with successful completion attributes
                executeSpan.setAttributes({
                    'workflow.result': result as string,
                    'workflow.status': 'completed',
                    'temporal.status': 'completed',
                });
                
                // Update workflow-specific span with completion details
                startWorkflowHelloWorldSpan.setAttributes({
                    'workflow.result': result as string,
                    'workflow.status': 'completed',
                    'temporal.status': 'completed',
                });

                console.log('[STARTER] Workflow completed successfully');
                console.log('[STARTER] Result:', result);
            } catch (err) {
                // Record workflow error in both spans for complete tracing
                executeSpan.recordException(err as Error);
                startWorkflowHelloWorldSpan.recordException(err as Error);
                startWorkflowHelloWorldSpan.setStatus({ code: 2 }); // ERROR status code
                executeSpan.setStatus({ code: 2 }); // ERROR status code
                
                console.error('[STARTER] Workflow failed:', err);
                
                // Record workflow failure in metrics
                workflowCounter.add(1, {
                    workflow: 'HelloWorldWorkflow',
                    status: 'failed'
                });
            } finally {
                // Always end spans to prevent leaks
                executeSpan.end();
                startWorkflowHelloWorldSpan.end();
            }
        });
    } catch (err) {
        // Record any errors at the starter level in the main span
        startWorkflowSpan.recordException(err as Error);
        startWorkflowSpan.setStatus({ code: 2 }); // ERROR status code
        console.error('[STARTER] Fatal error in starter application:', err);
    } finally {
        // Always end the main span and ensure telemetry is exported
        startWorkflowSpan.end();
        console.log('[STARTER] Forcing export of telemetry data...');
        await forceSpanExport();
        console.log('[STARTER] Telemetry export completed');
    }
}

/**
 * Main entry point with error handling
 * 
 * Executes the workflow starter and handles any uncaught exceptions
 * to ensure proper error reporting and clean shutdown.
 */
if (require.main === module) {
    run().catch(err => {
        console.error('[STARTER] Unhandled error:', err);
        process.exit(1);
    });
}

// Export for testing or programmatic use
export { run }; 