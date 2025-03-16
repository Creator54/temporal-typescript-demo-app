/**
 * Greeting Activities Interface
 * 
 * Defines the contract for activities related to creating personalized greetings.
 * Each activity represents a discrete step in the greeting generation process.
 */
export interface GreetingActivities {
    /**
     * Formats a name for consistent display
     * @param name The raw input name
     * @returns The properly formatted name
     */
    formatName(name: string): Promise<string>;
    
    /**
     * Generates a greeting with the formatted name
     * @param formattedName The properly formatted name
     * @returns A greeting message that includes the name
     */
    generateGreeting(formattedName: string): Promise<string>;
    
    /**
     * Adds a timestamp to a greeting message
     * @param greeting The greeting message
     * @returns The greeting with a timestamp added
     */
    addTimestamp(greeting: string): Promise<string>;
}

// Function type definitions for Temporal activity registration
// These are exported directly rather than using the export type {...} syntax
export type formatName = (name: string) => Promise<string>;
export type generateGreeting = (formattedName: string) => Promise<string>;
export type addTimestamp = (greeting: string) => Promise<string>; 