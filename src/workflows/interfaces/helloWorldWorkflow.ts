/**
 * HelloWorld Workflow Interface
 * 
 * Defines the contract for the greeting workflow with proper typing.
 */
export interface HelloWorldWorkflow {
    /**
     * Creates a personalized greeting with timestamp
     * @param name The name to include in the greeting
     * @returns A formatted greeting with timestamp
     */
    sayHello(name: string): Promise<string>;
} 