import { Counter, Meter } from '@opentelemetry/api';
import { getMeter } from './signozTelemetryUtils';
import { diag } from '@opentelemetry/api';

/**
 * WorkflowMetricsUtil
 * 
 * Utility class for tracking and reporting workflow metrics.
 * Provides counters for different workflow completion states.
 * Direct port of the Java implementation.
 */

// Attribute constants - exactly matching Java implementation
export const WORKFLOW_TYPE = 'workflow_type';
export const WORKFLOW_ID = 'workflow_id';
export const RUN_ID = 'run_id';
export const NAMESPACE = 'namespace';
export const OPERATION = 'operation';
export const SERVICE_TYPE = 'temporal_service_type';
export const ERROR_TYPE = 'error_type';

// OpenTelemetry counters for workflow states
let workflowSuccessCounter: Counter | null = null;
let workflowFailedCounter: Counter | null = null;
let workflowTimeoutCounter: Counter | null = null;
let workflowTerminateCounter: Counter | null = null;
let workflowCancelCounter: Counter | null = null;

// Dashboard-specific operation counters
let serviceRequestsCounter: Counter | null = null;
let serviceErrorsCounter: Counter | null = null;
let serviceErrorWithTypeCounter: Counter | null = null;
let restartsCounter: Counter | null = null;

// Private fields for timeout metrics
let scheduleToStartTimeoutCounter: Counter | null = null;
let startToCloseTimeoutCounter: Counter | null = null;

// Flag to track initialization
let initialized = false;

/**
 * Initializes all workflow metrics counters.
 * Should be called during application startup.
 */
export function initializeMetrics(): void {
    if (initialized) {
        return;
    }

    const meter = getMeter();
    
    // Create counters for workflow completion states
    workflowSuccessCounter = meter.createCounter('workflow_success', {
        description: 'Count of successfully completed workflow executions',
        unit: '{execution}'
    });
    
    workflowFailedCounter = meter.createCounter('workflow_failed', {
        description: 'Count of failed workflow executions',
        unit: '{execution}'
    });
    
    workflowTimeoutCounter = meter.createCounter('workflow_timeout', {
        description: 'Count of timed out workflow executions', 
        unit: '{execution}'
    });
    
    workflowTerminateCounter = meter.createCounter('workflow_terminate', {
        description: 'Count of terminated workflow executions',
        unit: '{execution}'
    });
    
    workflowCancelCounter = meter.createCounter('workflow_cancel', {
        description: 'Count of canceled workflow executions',
        unit: '{execution}'
    });
    
    // Initialize service_requests counter
    serviceRequestsCounter = meter.createCounter('service_requests', {
        description: 'Count of service requests',
        unit: '{request}'
    });
    
    // Initialize service_errors counter
    serviceErrorsCounter = meter.createCounter('service_errors', {
        description: 'Count of service errors',
        unit: '{error}'
    });
    
    // Initialize service_error_with_type counter
    serviceErrorWithTypeCounter = meter.createCounter('service_error_with_type', {
        description: 'Count of service errors with type',
        unit: '{error}'
    });
    
    // Initialize restart counter
    restartsCounter = meter.createCounter('restarts', {
        description: 'Count of service restarts',
        unit: '{restart}'
    });
    
    // Initialize timeout counters
    scheduleToStartTimeoutCounter = meter.createCounter('schedule_to_start_timeout', {
        description: 'Count of schedule to start timeouts',
        unit: '{timeout}'
    });
    
    startToCloseTimeoutCounter = meter.createCounter('start_to_close_timeout', {
        description: 'Count of start to close timeouts',
        unit: '{timeout}'
    });
    
    initialized = true;
    diag.info('[METRICS] Workflow metrics initialized');
}

/**
 * Records a successful workflow completion.
 * 
 * @param workflowType Type of the workflow
 * @param workflowId Workflow instance ID
 * @param runId Specific execution run ID
 * @param namespace Temporal namespace
 */
export function recordSuccess(workflowType: string, workflowId: string, runId: string, namespace: string): void {
    if (!workflowSuccessCounter) {
        initializeMetrics();
    }
    
    workflowSuccessCounter?.add(1, {
        [WORKFLOW_TYPE]: workflowType,
        [WORKFLOW_ID]: workflowId,
        [RUN_ID]: runId,
        [NAMESPACE]: namespace
    });
}

/**
 * Records a failed workflow execution.
 * 
 * @param workflowType Type of the workflow
 * @param workflowId Workflow instance ID
 * @param runId Specific execution run ID
 * @param namespace Temporal namespace
 */
export function recordFailure(workflowType: string, workflowId: string, runId: string, namespace: string): void {
    if (!workflowFailedCounter) {
        initializeMetrics();
    }
    
    workflowFailedCounter?.add(1, {
        [WORKFLOW_TYPE]: workflowType,
        [WORKFLOW_ID]: workflowId,
        [RUN_ID]: runId,
        [NAMESPACE]: namespace
    });
}

/**
 * Records a workflow timeout.
 * 
 * @param workflowType Type of the workflow
 * @param workflowId Workflow instance ID
 * @param runId Specific execution run ID
 * @param namespace Temporal namespace
 */
export function recordTimeout(workflowType: string, workflowId: string, runId: string, namespace: string): void {
    if (!workflowTimeoutCounter) {
        initializeMetrics();
    }
    
    workflowTimeoutCounter?.add(1, {
        [WORKFLOW_TYPE]: workflowType,
        [WORKFLOW_ID]: workflowId,
        [RUN_ID]: runId,
        [NAMESPACE]: namespace
    });
}

/**
 * Records a workflow termination.
 * 
 * @param workflowType Type of the workflow
 * @param workflowId Workflow instance ID
 * @param runId Specific execution run ID
 * @param namespace Temporal namespace
 */
export function recordTermination(workflowType: string, workflowId: string, runId: string, namespace: string): void {
    if (!workflowTerminateCounter) {
        initializeMetrics();
    }
    
    workflowTerminateCounter?.add(1, {
        [WORKFLOW_TYPE]: workflowType,
        [WORKFLOW_ID]: workflowId,
        [RUN_ID]: runId,
        [NAMESPACE]: namespace
    });
}

/**
 * Records a workflow cancellation.
 * 
 * @param workflowType Type of the workflow
 * @param workflowId Workflow instance ID
 * @param runId Specific execution run ID
 * @param namespace Temporal namespace
 */
export function recordCancellation(workflowType: string, workflowId: string, runId: string, namespace: string): void {
    if (!workflowCancelCounter) {
        initializeMetrics();
    }
    
    workflowCancelCounter?.add(1, {
        [WORKFLOW_TYPE]: workflowType,
        [WORKFLOW_ID]: workflowId,
        [RUN_ID]: runId,
        [NAMESPACE]: namespace
    });
}

/**
 * Records a service request.
 * 
 * @param operation The operation being performed
 */
export function recordServiceRequest(operation: string): void {
    if (!serviceRequestsCounter) {
        initializeMetrics();
    }
    
    serviceRequestsCounter?.add(1, {
        [OPERATION]: operation
    });
}

/**
 * Records a service error, optionally with error type.
 * 
 * @param operation The operation that experienced an error
 * @param errorType Optional type of error that occurred
 */
export function recordServiceError(operation: string, errorType?: string): void {
    if (!serviceErrorsCounter || !serviceErrorWithTypeCounter) {
        initializeMetrics();
    }
    
    // Record basic error
    serviceErrorsCounter?.add(1, {
        [OPERATION]: operation
    });
    
    // If error type is provided, record with type
    if (errorType) {
        serviceErrorWithTypeCounter?.add(1, {
            [OPERATION]: operation,
            [ERROR_TYPE]: errorType
        });
    }
}

/**
 * Records a service restart event.
 * 
 * @param serviceType Type of service being restarted
 */
export function recordServiceRestart(serviceType: string): void {
    if (!restartsCounter) {
        initializeMetrics();
    }
    
    restartsCounter?.add(1, {
        [SERVICE_TYPE]: serviceType
    });
}

/**
 * Records a schedule to start timeout.
 * 
 * @param operation The operation that timed out
 */
export function recordScheduleToStartTimeout(operation: string): void {
    if (!scheduleToStartTimeoutCounter) {
        initializeMetrics();
    }
    
    scheduleToStartTimeoutCounter?.add(1, {
        [OPERATION]: operation
    });
}

/**
 * Records a start to close timeout.
 * 
 * @param operation The operation that timed out
 */
export function recordStartToCloseTimeout(operation: string): void {
    if (!startToCloseTimeoutCounter) {
        initializeMetrics();
    }
    
    startToCloseTimeoutCounter?.add(1, {
        [OPERATION]: operation
    });
}

// Activity task metrics
export function recordAddActivityTask(): void {
    recordServiceRequest('AddActivityTask');
}

export function recordRecordActivityTaskStarted(): void {
    recordServiceRequest('RecordActivityTaskStarted');
}

export function recordResponseActivityCompleted(): void {
    recordServiceRequest('RespondActivityTaskCompleted');
}

export function recordRespondActivityTaskFailed(): void {
    recordServiceRequest('RespondActivityTaskFailed');
}

export function recordRespondActivityTaskCanceled(): void {
    recordServiceRequest('RespondActivityTaskCanceled');
}

// Activity task error metrics
export function recordAddActivityTaskError(): void {
    recordServiceError('AddActivityTask');
}

export function recordRecordActivityTaskStartedError(): void {
    recordServiceError('RecordActivityTaskStarted');
}

export function recordRespondActivityTaskCompletedError(): void {
    recordServiceError('RespondActivityTaskCompleted');
}

export function recordRespondActivityTaskFailedError(): void {
    recordServiceError('RespondActivityTaskFailed');
}

export function recordRespondActivityTaskCanceledError(): void {
    recordServiceError('RespondActivityTaskCanceled');
}

// Workflow task metrics
export function recordAddWorkflowTask(): void {
    recordServiceRequest('AddWorkflowTask');
}

export function recordRecordWorkflowTaskStarted(): void {
    recordServiceRequest('RecordWorkflowTaskStarted');
}

export function recordRespondWorkflowTaskCompleted(): void {
    recordServiceRequest('RespondWorkflowTaskCompleted');
}

export function recordRespondWorkflowTaskFailed(): void {
    recordServiceRequest('RespondWorkflowTaskFailed');
}

export function recordTimerActiveTaskWorkflowTimeout(): void {
    recordServiceRequest('TimerActiveTaskWorkflowTimeout');
}

// Workflow task error metrics
export function recordAddWorkflowTaskError(): void {
    recordServiceError('AddWorkflowTask');
}

export function recordRecordWorkflowTaskStartedError(): void {
    recordServiceError('RecordWorkflowTaskStarted');
}

export function recordRespondWorkflowTaskCompletedError(): void {
    recordServiceError('RespondWorkflowTaskCompleted');
}

export function recordRespondWorkflowTaskFailedError(): void {
    recordServiceError('RespondWorkflowTaskFailed');
}

// Workflow timeout metrics
export function recordScheduleToStartWorkflowTimeout(): void {
    recordScheduleToStartTimeout('workflow');
}

export function recordStartToCloseWorkflowTimeout(): void {
    recordStartToCloseTimeout('workflow');
}

// Error type metrics
export function recordErrorWithType(errorType: string): void {
    recordServiceError('ErrorWithType', errorType);
}

export function recordValidationError(): void {
    recordErrorWithType('validation');
}

export function recordTimeoutError(): void {
    recordErrorWithType('timeout');
}

export function recordBusinessRuleError(): void {
    recordErrorWithType('business_rule');
}

export function recordSystemError(): void {
    recordErrorWithType('system');
}

// Verification metric
export function recordInitVerification(): void {
    recordServiceRequest('InitVerification');
}

// Restart metric for workflow
export function recordRestart(): void {
    recordServiceRequest('Restart');
}

/**
 * Clean up metrics resources
 * 
 * Resets all counter references to null.
 * Used during application shutdown.
 */
export function cleanup(): void {
    if (!initialized) {
        return;
    }
    
    diag.info('[METRICS] Cleaning up metrics resources');
    
    // Reset workflow state metrics
    workflowSuccessCounter = null;
    workflowFailedCounter = null;
    workflowTimeoutCounter = null;
    workflowTerminateCounter = null;
    workflowCancelCounter = null;
    
    // Reset service metrics
    serviceRequestsCounter = null;
    serviceErrorsCounter = null;
    serviceErrorWithTypeCounter = null;
    restartsCounter = null;
    
    // Reset timeout metrics
    scheduleToStartTimeoutCounter = null;
    startToCloseTimeoutCounter = null;
    
    initialized = false;
}

// Export the default instance
export default {
    initializeMetrics,
    cleanup,
    recordSuccess,
    recordFailure,
    recordTimeout,
    recordTermination,
    recordCancellation,
    recordAddActivityTask,
    recordRecordActivityTaskStarted,
    recordResponseActivityCompleted,
    recordRespondActivityTaskFailed,
    recordRespondActivityTaskCanceled,
    recordAddActivityTaskError,
    recordRecordActivityTaskStartedError,
    recordRespondActivityTaskCompletedError,
    recordRespondActivityTaskFailedError,
    recordRespondActivityTaskCanceledError,
    recordAddWorkflowTask,
    recordRecordWorkflowTaskStarted,
    recordRespondWorkflowTaskCompleted,
    recordRespondWorkflowTaskFailed,
    recordTimerActiveTaskWorkflowTimeout,
    recordAddWorkflowTaskError,
    recordRecordWorkflowTaskStartedError,
    recordRespondWorkflowTaskCompletedError,
    recordRespondWorkflowTaskFailedError,
    recordScheduleToStartWorkflowTimeout,
    recordStartToCloseWorkflowTimeout,
    recordValidationError,
    recordTimeoutError,
    recordBusinessRuleError,
    recordSystemError,
    recordInitVerification,
    recordRestart
}; 