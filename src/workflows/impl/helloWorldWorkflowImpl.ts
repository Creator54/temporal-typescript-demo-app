import * as wf from '@temporalio/workflow';
import WorkflowMetricsUtil from '../../config/workflowMetricsUtil';

/**
 * The HelloWorld Workflow Implementation.
 * This is a direct port of the Java implementation.
 */
export class HelloWorldWorkflowImpl {
  /**
   * Creates a greeting message for the given name.
   * This implementation simply concatenates "Hello" with the name.
   * 
   * @param name Name to include in greeting
   * @return Formatted greeting message
   */
  async sayHello(name: string): Promise<string> {
    // Record workflow initialization verification
    WorkflowMetricsUtil.recordInitVerification();

    return "Hello " + name + "!";
  }
}

/**
 * Temporal workflow function that creates a greeting
 * 
 * This is the function that Temporal will execute, which delegates
 * to the workflow implementation class.
 * 
 * @param name The name to include in the greeting
 * @returns A simple greeting message
 */
export async function sayHello(name: string): Promise<string> {
    const workflow = new HelloWorldWorkflowImpl();
    return workflow.sayHello(name);
} 