/**
 * Defines the contract for the Hello World workflow.
 * This interface demonstrates a simple Temporal workflow that:
 * 1. Takes a name as input
 * 2. Returns a greeting message
 * 
 * The workflow is:
 * - Durable: State is preserved despite process failures
 * - Observable: Progress can be tracked via Temporal UI
 * - Reliable: Automatically retried on failures
 */
export interface HelloWorldWorkflow {
    /**
     * Creates a greeting for the given name.
     * This is the main workflow method that will be executed.
     * 
     * @param name Name to greet
     * @return Greeting message
     */
    sayHello(name: string): Promise<string>;
}