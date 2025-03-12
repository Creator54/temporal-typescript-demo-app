import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  let worker: Worker | undefined;
  try {
    const connection = await NativeConnection.connect({
      address: 'localhost:7233'
    });

    worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'hello-world-task-queue',
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    console.log('Worker connected, starting...');
    
    // Graceful shutdown
    process.once('SIGINT', async () => {
      console.log('\nGracefully shutting down worker...');
      await worker?.shutdown();
      process.exit(0);
    });
    process.once('SIGTERM', async () => {
      console.log('\nGracefully shutting down worker...');
      await worker?.shutdown();
      process.exit(0);
    });

    await worker.run();
  } catch (err) {
    console.error('Error running worker:', err);
    process.exit(1);
  }
}

run(); 