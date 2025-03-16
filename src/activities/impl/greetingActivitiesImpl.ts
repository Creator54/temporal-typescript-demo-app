import { GreetingActivities } from '../interfaces/greetingActivities';
import { Context } from '@temporalio/activity';

/**
 * Greeting Activities Implementation
 * 
 * Provides concrete implementations of the greeting activities without
 * OpenTelemetry instrumentation.
 */
export class GreetingActivitiesImpl implements GreetingActivities {
    /**
     * Formats a name with proper capitalization
     * 
     * @param name The raw input name
     * @returns The properly formatted name
     */
    async formatName(name: string): Promise<string> {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Activity implementation
        return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
    }
    
    /**
     * Generates a randomized greeting with the name
     * 
     * @param formattedName The properly formatted name
     * @returns A complete greeting message with the name
     */
    async generateGreeting(formattedName: string): Promise<string> {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Activity implementation
        const greetings = ['Hello', 'Hi', 'Hey', 'Greetings', 'Welcome'];
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        return `${randomGreeting}, ${formattedName}!`;
    }
    
    /**
     * Adds an ISO timestamp to a greeting
     * 
     * @param greeting The greeting message
     * @returns The greeting with a timestamp added
     */
    async addTimestamp(greeting: string): Promise<string> {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Activity implementation
        const now = new Date();
        return `[${now.toISOString()}] ${greeting}`;
    }
    
    /**
     * Alternative simple implementation without processing delay
     * Formats the provided name by just trimming it
     * 
     * @param name The input name to format
     * @returns The trimmed name
     */
    async simpleTrimName(name: string): Promise<string> {
        return name.trim();
    }
    
    /**
     * Alternative simple implementation without processing delay
     * Creates a basic hello greeting
     * 
     * @param name The name to include in the greeting
     * @returns A simple greeting message
     */
    async simpleHello(name: string): Promise<string> {
        return `Hello ${name}!`;
    }
    
    /**
     * Alternative simple implementation without processing delay
     * Adds a timestamp in a different format
     * 
     * @param text The input text to append a timestamp to
     * @returns The text with a timestamp appended
     */
    async simpleTimestamp(text: string): Promise<string> {
        const timestamp = new Date().toISOString();
        return `${text} (at ${timestamp})`;
    }
}

// Export singleton activity functions for Temporal
export const formatName = async (name: string): Promise<string> => {
    return new GreetingActivitiesImpl().formatName(name);
};

export const generateGreeting = async (formattedName: string): Promise<string> => {
    return new GreetingActivitiesImpl().generateGreeting(formattedName);
};

export const addTimestamp = async (greeting: string): Promise<string> => {
    return new GreetingActivitiesImpl().addTimestamp(greeting);
}; 