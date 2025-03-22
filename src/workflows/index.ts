// Export the HelloWorldWorkflow implementation
export * from './impl/helloWorldWorkflowImpl';

// Export the workflow function under the name expected by Temporal
export { sayHello as HelloWorldWorkflow } from './impl/helloWorldWorkflowImpl'; 