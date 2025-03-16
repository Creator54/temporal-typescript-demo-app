import { Worker } from '@temporalio/worker';
import { initOpenTelemetry } from '../config/opentelemetryConfig';
import { forceSpanExport, getTracer } from '../config/signozTelemetryUtils';
import { DEFAULT_TASK_QUEUE, getWorkerOptions } from '../config/temporalConfig';
import * as activities from '../activities/impl/greetingActivitiesImpl';
import { trace, SpanKind, context } from '@opentelemetry/api';

/**
 * Hello World Worker
 * 
 * This module initializes and runs a Temporal worker that hosts the
 * HelloWorld workflow and its associated activities. It includes
 * OpenTelemetry instrumentation for observability.
 */

// Global worker state
let isShuttingDown = false;
let workerInstance: Worker | null = null;

/**
 * Main worker process execution function
 * 
 * This function initializes OpenTelemetry, creates and runs the worker,
 * and sets up proper instrumentation for observability.
 */
async function run() {
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
        try {
            console.log('[WORKER] Starting worker process...');
            
            // Create worker run span
            const runWorkflowSpan = tracer.startSpan('RunWorkflow:HelloWorldWorkflow', {
                kind: SpanKind.INTERNAL,
                attributes: {
                    'workflow.name': 'HelloWorldWorkflow',
                    'workflow.type': 'temporal',
                    'service.name': 'temporal-hello-world',
                    'workflow.task_queue': DEFAULT_TASK_QUEUE,
                    'temporal.component': 'worker',
                    'temporal.workflow.type': 'HelloWorldWorkflow'
                }
            });
            
            // Make run span active
            const runWorkflowContext = trace.setSpan(context.active(), runWorkflowSpan);
            
            try {
                await context.with(runWorkflowContext, async () => {
                    // Create the worker with configurations
                    const worker = await Worker.create({
                        ...getWorkerOptions(),
                        workflowsPath: require.resolve('../workflows/impl/helloWorldWorkflowImpl'),
                        activities,
                        taskQueue: DEFAULT_TASK_QUEUE,
                    });

                    // Store worker instance for graceful shutdown
                    workerInstance = worker;

                    console.log('[WORKER] Starting worker...');
                    
                    // Update span with starting status
                    runWorkflowSpan.setAttributes({
                        'workflow.status': 'starting',
                        'temporal.status': 'starting',
                    });
                    
                    // Run the worker (this is a blocking call)
                    await worker.run();
                    
                    console.log('[WORKER] Worker stopped');
                    
                    // Update span with completed status
                    runWorkflowSpan.setAttributes({
                        'workflow.status': 'completed',
                        'temporal.status': 'completed',
                    });
                });
            } catch (err) {
                // Record error in span
                runWorkflowSpan.recordException(err as Error);
                runWorkflowSpan.setStatus({ code: 2 }); // ERROR
                runWorkflowSpan.setAttributes({
                    'workflow.status': 'error',
                    'temporal.status': 'error',
                    'error.message': err instanceof Error ? err.message : 'Unknown error',
                });
                console.error('[WORKER] Worker failed:', err);
                throw err;
            } finally {
                // Always end the span
                runWorkflowSpan.end();
                console.log('[WORKER] RunWorkflow:HelloWorldWorkflow span ended');
            }
        } catch (err) {
            // Record error in main span
            executeWorkflowSpan.recordException(err as Error);
            executeWorkflowSpan.setStatus({ code: 2 }); // ERROR
            executeWorkflowSpan.setAttributes({
                'workflow.status': 'error',
                'temporal.status': 'error',
                'error.message': err instanceof Error ? err.message : 'Unknown error',
            });
            console.error('[WORKER] Error initializing worker:', err);
            throw err;
        } finally {
            if (!isShuttingDown) {
                // End the main span if not shutting down
                executeWorkflowSpan.end();
                console.log('[WORKER] ExecuteWorkflow span ended');
            }
        }
    });
}

/**
 * Graceful shutdown handler
 * 
 * Ensures worker is properly terminated and telemetry data is exported
 * before the process exits.
 */
const shutdown = async () => {
    if (isShuttingDown) {
        return;
    }
    
    isShuttingDown = true;
    console.log('[WORKER] Shutting down worker...');
    
    try {
        // Stop the worker if it's running
        if (workerInstance) {
            await workerInstance.shutdown();
            console.log('[WORKER] Worker shut down successfully');
        }
        
        // Force export any pending spans
        await forceSpanExport();
        console.log('[WORKER] Completed span export');
        
        process.exit(0);
    } catch (err) {
        console.error('[WORKER] Error during shutdown:', err);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (reason, promise) => {
    console.error('[WORKER] Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown();
});

// Start the worker
if (require.main === module) {
    run().catch(err => {
        console.error('[WORKER] Fatal error:', err);
        process.exit(1);
    });
} 