import { proxyActivities, log } from '@temporalio/workflow';
import type * as activities from './activities';

const { sayHello } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
});

/** A workflow that simply calls an activity */
export async function greetUser(name: string): Promise<string> {
  log.info('Starting workflow execution', { name });
  try {
    const result = await sayHello(name);
    log.info('Workflow completed successfully', { result });
    return result;
  } catch (err) {
    log.error('Workflow failed', { error: err });
    throw err;
  }
} 