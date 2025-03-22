import { workflowInfo, log } from '@temporalio/workflow';
import type { 
  WorkflowInboundCallsInterceptor, 
  WorkflowExecuteInput, 
  Next 
} from '@temporalio/workflow';

/**
 * This interceptor creates a RunWorkflow span to match Java implementation.
 * It's a lightweight custom interceptor since we're not using the OpenTelemetry workflow interceptors.
 */
class RunWorkflowInterceptor implements WorkflowInboundCallsInterceptor {
  constructor() {
    // Get workflow info when the interceptor is created
    const info = workflowInfo();
    // Log the start of the workflow with details
    log.info(`RunWorkflow:${info.workflowType} started`, {
      'workflow.id': info.workflowId,
      'workflow.runId': info.runId,
      'workflow.taskQueue': info.taskQueue,
      'workflow.namespace': info.namespace
    });
  }

  async execute(
    input: WorkflowExecuteInput, 
    next: Next<WorkflowInboundCallsInterceptor, 'execute'>
  ): Promise<unknown> {
    const info = workflowInfo();
    try {
      // Execute the workflow
      const result = await next(input);
      // Log successful completion
      log.info(`RunWorkflow:${info.workflowType} completed successfully`);
      return result;
    } catch (error: unknown) {
      // Log error
      log.error(`RunWorkflow:${info.workflowType} failed`, { 
        error: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : 'No stack trace available'
      });
      throw error;
    }
  }
}

/**
 * Export the interceptors function that will create our custom RunWorkflow span.
 * This is the format required by Temporal.
 */
export const interceptors = () => ({
  inbound: [new RunWorkflowInterceptor()],
  outbound: [], // No outbound interceptors needed
}); 