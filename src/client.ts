import { Client, Connection } from '@temporalio/client';
import { nanoid } from 'nanoid';

async function run() {
  console.log('Creating Temporal client...');
  const connection = await Connection.connect();
  const client = new Client({
    connection,
    namespace: 'default',
  });

  const workflowId = `hello-world-${nanoid()}`;
  console.log('Starting workflow with ID:', workflowId);

  try {
    console.log('Executing workflow...');
    const handle = await client.workflow.start('execute', {
      taskQueue: 'hello-world-task-queue',
      workflowId,
      args: ['Temporal'],
      workflowExecutionTimeout: '1 minute',
    });

    console.log('Waiting for workflow result...');
    const result = await handle.result();
    console.log('Workflow completed successfully!');
    console.log('Workflow result:', result);
  } catch (err) {
    console.error('Error running workflow:', err);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

run(); 