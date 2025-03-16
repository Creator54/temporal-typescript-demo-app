import { WorkerOptions } from '@temporalio/worker';
import { WorkflowClientOptions } from '@temporalio/client';

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