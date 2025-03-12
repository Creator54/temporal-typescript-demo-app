import { log } from '@temporalio/activity';

/** A simple activity that returns a greeting */
export async function sayHello(name: string): Promise<string> {
  log.info('Starting activity execution', { name });
  const greeting = `Hello ${name}!`;
  log.info('Activity completed', { greeting });
  return greeting;
} 