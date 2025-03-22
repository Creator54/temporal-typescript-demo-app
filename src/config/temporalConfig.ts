import { WorkerOptions } from '@temporalio/worker';
import { WorkflowClientOptions } from '@temporalio/client';
import * as WorkflowMetricsUtil from './workflowMetricsUtil';
import { diag } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PayloadConverter, ValueError, Payload } from '@temporalio/common';

// Add type declaration for globalThis
declare global {
  var __dashboardMetricsInterval: NodeJS.Timeout | undefined;
  var __dashboardMetricsInitialTimer: NodeJS.Timeout | undefined;
}

/**
 * Default payload converter implementation
 * 
 * This is a minimal implementation that just uses JSON.stringify and JSON.parse
 * Similar to the default in the Temporal SDK
 */
export class DefaultPayloadConverter implements PayloadConverter {
  // Convert a value to a serialized payload
  public toPayload<T>(value: T): Payload {
    if (value === undefined) {
      return { metadata: {}, data: new Uint8Array(0) };
    }

    try {
      const jsonString = JSON.stringify(value);
      // Use TextEncoder instead of Buffer for workflow compatibility
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonString);
      
      return {
        metadata: {
          encoding: encoder.encode('json/plain'),
          'content-type': encoder.encode('application/json'),
        },
        data
      };
    } catch (e) {
      throw new ValueError(`Failed to serialize value: ${e}`);
    }
  }

  // Convert a serialized payload back to a value
  public fromPayload<T>(payload: Payload): T {
    try {
      if (!payload.data || payload.data.length === 0) {
        return undefined as unknown as T;
      }
      
      // Use TextDecoder instead of Buffer for workflow compatibility
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload.data);
      return JSON.parse(jsonString) as T;
    } catch (e) {
      throw new ValueError(`Failed to deserialize payload: ${e}`);
    }
  }
}

// Export the converter with the name expected by Temporal
export const payloadConverter = new DefaultPayloadConverter();

/**
 * Temporal Configuration
 * 
 * This module provides configuration options for Temporal clients and workers
 * with a focus on OpenTelemetry integration for monitoring.
 */

/**
 * Default task queue used across the application
 */
export const DEFAULT_TASK_QUEUE = 'hello-world';

/**
 * Get Temporal worker options with OpenTelemetry configuration
 * 
 * Provides the necessary configuration to enable tracing in Temporal workers.
 * These options should be merged with your existing worker options.
 * 
 * @returns Partial WorkerOptions with telemetry configuration
 */
export function getWorkerOptions(): Partial<WorkerOptions> {
    return {
        taskQueue: DEFAULT_TASK_QUEUE,
        // Add any additional worker options here
    };
}

/**
 * Get Temporal client options with OpenTelemetry configuration
 * 
 * Provides the necessary configuration to enable tracing in Temporal clients.
 * These options should be merged with your existing client options.
 * 
 * @returns Partial WorkflowClientOptions with telemetry configuration
 */
export function getClientOptions(): Partial<WorkflowClientOptions> {
    return {
        // Add any client-specific options here
    };
}

/**
 * Configure Temporal-related environment variables
 * 
 * Sets up environment variables related to Temporal server connection
 * and namespace configuration.
 * 
 * @param options Optional configuration parameters
 */
export function configureTemporalEnvironment(options?: { 
    namespace?: string,
    serverUrl?: string 
}): void {
    // Set default or provided Temporal environment variables
    process.env.TEMPORAL_SERVER_URL = options?.serverUrl || 'localhost:7233';
    process.env.TEMPORAL_NAMESPACE = options?.namespace || 'default';
}

/**
 * Register periodic dashboard metrics
 * 
 * Creates a timer that runs periodically to emit metrics for dashboard visualization.
 * This emits simulated metrics for all workflow states for testing and development.
 * 
 * @param options Optional configuration parameters
 * @param options.initialDelayMs Initial delay before first metrics emission (default: 1000)
 * @param options.intervalMs Interval between metrics emissions (default: 1000)
 * @returns A function that can be called to stop the metrics timer
 */
export function registerDashboardMetrics(options?: {
    initialDelayMs?: number,
    intervalMs?: number
}): () => void {
    const initialDelayMs = options?.initialDelayMs || 1000;
    const intervalMs = options?.intervalMs || 5000; // Match Java default (5000ms)
    
    diag.info(`[METRICS] Registering dashboard metrics with interval ${intervalMs}ms and initial delay ${initialDelayMs}ms`);
    console.log(`[METRICS] Registering dashboard metrics with interval ${intervalMs}ms and initial delay ${initialDelayMs}ms`);
    
    // Record a service restart event
    WorkflowMetricsUtil.recordServiceRestart("worker");
    
    // Set initial timer
    const initialTimer = setTimeout(() => {
        // Send initial metrics
        diag.debug('[METRICS] Sending initial dashboard metrics');
        console.log('[METRICS] Sending initial dashboard metrics');
        
        // Generate sample workflow IDs and run IDs for metrics
        const workflowId = 'sample-workflow-id';
        const runId = 'sample-run-id';
        const namespace = 'default';
        
        // Emit initial metrics
        emitPeriodicMetrics(workflowId, runId, namespace);
        
        // Then set up interval
        const interval = setInterval(() => {
            diag.debug('[METRICS] Sending periodic dashboard metrics');
            console.log('[METRICS] Sending periodic dashboard metrics');
            emitPeriodicMetrics(workflowId, runId, namespace);
        }, intervalMs);
        
        // Store interval for cleanup
        globalThis.__dashboardMetricsInterval = interval;
    }, initialDelayMs);
    
    // Store the initial timer for cleanup
    globalThis.__dashboardMetricsInitialTimer = initialTimer;
    
    // Return a function to stop sending metrics
    return () => {
        diag.info('[METRICS] Dashboard metrics registration stopped');
        console.log('[METRICS] Dashboard metrics registration stopped');
        
        if (globalThis.__dashboardMetricsInitialTimer) {
            clearTimeout(globalThis.__dashboardMetricsInitialTimer);
            delete globalThis.__dashboardMetricsInitialTimer;
        }
        
        if (globalThis.__dashboardMetricsInterval) {
            clearInterval(globalThis.__dashboardMetricsInterval);
            delete globalThis.__dashboardMetricsInterval;
        }
    };
}

/**
 * Configure Temporal SDK tracing
 * 
 * This ensures Temporal SDK generates the expected span names
 * that match the Java implementation (StartWorkflow:HelloWorldWorkflow,
 * RunWorkflow:HelloWorldWorkflow, etc.)
 * 
 * Note: The Temporal SDK uses OpenTracing-compatible naming by default
 */
export function configureTemporalTracing(): void {
    // In TypeScript SDK, tracing is enabled by default
    // Just need to ensure environment variables are set for consistency

    // Ensure trace sampling is always on
    process.env.OTEL_TRACES_SAMPLER = 'always_on';
    
    diag.info('[TELEMETRY] Temporal tracing configured with always_on sampling');
}

/**
 * Emit periodic metrics for dashboard visualization
 * 
 * @param workflowId Workflow ID to use for metrics
 * @param runId Run ID to use for metrics
 * @param namespace Namespace to use for metrics
 */
export function emitPeriodicMetrics(workflowId: string, runId: string, namespace: string): void {
    // Workflow types to emit metrics for
    const workflowTypes = [
        'HelloWorldWorkflow',
        'GreetingWorkflow',
        'ProcessingWorkflow'
    ];
    
    console.log(`[METRICS] Emitting metrics for workflow ID ${workflowId}, run ID ${runId}, namespace ${namespace}`);
    
    // Emit metrics for each workflow type
    workflowTypes.forEach(workflowType => {
        // Workflow state metrics
        WorkflowMetricsUtil.recordSuccess(workflowType, `${workflowId}-success`, runId, namespace);
        WorkflowMetricsUtil.recordFailure(workflowType, `${workflowId}-failure`, runId, namespace);
        WorkflowMetricsUtil.recordTimeout(workflowType, `${workflowId}-timeout`, runId, namespace);
        WorkflowMetricsUtil.recordTermination(workflowType, `${workflowId}-termination`, runId, namespace);
        WorkflowMetricsUtil.recordCancellation(workflowType, `${workflowId}-cancellation`, runId, namespace);
        
        // Service request metrics
        WorkflowMetricsUtil.recordAddActivityTask();
        WorkflowMetricsUtil.recordRecordActivityTaskStarted();
        WorkflowMetricsUtil.recordResponseActivityCompleted();
        WorkflowMetricsUtil.recordRespondActivityTaskFailed();
        WorkflowMetricsUtil.recordRespondActivityTaskCanceled();
        WorkflowMetricsUtil.recordAddWorkflowTask();
        WorkflowMetricsUtil.recordRecordWorkflowTaskStarted();
        WorkflowMetricsUtil.recordRespondWorkflowTaskCompleted();
        WorkflowMetricsUtil.recordRespondWorkflowTaskFailed();
        WorkflowMetricsUtil.recordTimerActiveTaskWorkflowTimeout();
        
        // Service error metrics
        WorkflowMetricsUtil.recordAddActivityTaskError();
        WorkflowMetricsUtil.recordRecordActivityTaskStartedError();
        WorkflowMetricsUtil.recordRespondActivityTaskCompletedError();
        WorkflowMetricsUtil.recordValidationError();
        WorkflowMetricsUtil.recordTimeoutError();
        WorkflowMetricsUtil.recordBusinessRuleError();
        WorkflowMetricsUtil.recordSystemError();
        
        // Timeout metrics
        WorkflowMetricsUtil.recordScheduleToStartWorkflowTimeout();
        WorkflowMetricsUtil.recordStartToCloseWorkflowTimeout();
    });
    
    // Service metrics
    WorkflowMetricsUtil.recordServiceRestart('worker');
    WorkflowMetricsUtil.recordServiceRestart('frontend');
    
    console.log('[METRICS] Finished emitting periodic metrics for dashboard visualization');
    diag.debug('[METRICS] Emitted periodic metrics for dashboard visualization');
}