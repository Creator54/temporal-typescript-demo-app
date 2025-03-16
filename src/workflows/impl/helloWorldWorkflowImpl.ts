import { proxyActivities } from '@temporalio/workflow';
import { HelloWorldWorkflow } from '../interfaces/helloWorldWorkflow';

// Import directly from the implementation instead of the interface
// This ensures we get the actual exported activity functions
import * as activities from '../../activities/impl/greetingActivitiesImpl';

// Define activity stubs
const { formatName, generateGreeting, addTimestamp } = proxyActivities<typeof activities>({
    startToCloseTimeout: '1 minute',
});

/**
 * HelloWorld Workflow Implementation
 * 
 * Orchestrates a sequence of activities to create a personalized greeting.
 * This implementation follows the workflow interface contract and handles
 * the execution of each activity in sequence.
 */
export class HelloWorldWorkflowImpl implements HelloWorldWorkflow {
    /**
     * Creates a personalized greeting with timestamp
     * @param name The name to include in the greeting
     * @returns A formatted greeting with timestamp
     */
    async sayHello(name: string): Promise<string> {
        const formattedName = await formatName(name);
        const greeting = await generateGreeting(formattedName);
        const timestampedGreeting = await addTimestamp(greeting);
        return timestampedGreeting;
    }
}

/**
 * Temporal workflow function that creates a greeting
 * 
 * This is the function that Temporal will execute, which delegates
 * to the workflow implementation class.
 * 
 * @param name The name to include in the greeting
 * @returns A formatted greeting with timestamp
 */
export async function sayHello(name: string): Promise<string> {
    const workflow = new HelloWorldWorkflowImpl();
    return workflow.sayHello(name);
} 