/**
 * Greeting Activity Collection
 * 
 * This module provides activities for the Hello World workflow that handle
 * different aspects of generating a personalized greeting.
 * 
 * Each activity is designed to be:
 * - Independently executable and testable
 * - Focused on a single responsibility
 * - Resilient to failures
 */

/**
 * Formats a user name for consistent display
 * 
 * This activity ensures names follow a consistent format by:
 * - Trimming whitespace
 * - Capitalizing the first letter
 * - Converting remaining letters to lowercase
 * 
 * @param name - The raw input name to format
 * @returns The properly formatted name
 */
export async function formatName(name: string): Promise<string> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
}

/**
 * Generates a randomized greeting with the provided name
 * 
 * This activity selects from a variety of greeting phrases and
 * combines it with the formatted name to create a personalized message.
 * 
 * @param formattedName - The properly formatted name to include in the greeting
 * @returns A complete greeting message with the name
 */
export async function generateGreeting(formattedName: string): Promise<string> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    const greetings = [
        'Hello',
        'Hi',
        'Hey',
        'Greetings',
        'Welcome'
    ];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    return `${randomGreeting}, ${formattedName}!`;
}

/**
 * Adds an ISO timestamp to a greeting message
 * 
 * This activity enhances the greeting by prepending a timestamp in ISO format,
 * which provides context about when the greeting was generated.
 * 
 * @param greeting - The greeting message to timestamp
 * @returns The greeting with an ISO timestamp prepended
 */
export async function addTimestamp(greeting: string): Promise<string> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    const now = new Date();
    return `[${now.toISOString()}] ${greeting}`;
} 