import { Client, Connection } from '@temporalio/client';
import { OpenTelemetryWorkflowClientInterceptor } from '@temporalio/interceptors-opentelemetry';
import { randomUUID } from 'crypto';
import { greetUser } from './workflows';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  console.log('Creating Temporal client...');
  
  // Check for Temporal Cloud environment variables
  const host = process.env.TEMPORAL_HOST_URL || 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
  
  let connection;
  
  // If connecting to Temporal Cloud
  if (process.env.TEMPORAL_HOST_URL) {
    console.log(`Connecting to Temporal Cloud at ${host} with namespace ${namespace}`);
    
    // Verify that TLS cert and key are available
    const tlsCert = process.env.TEMPORAL_TLS_CERT;
    const tlsKey = process.env.TEMPORAL_TLS_KEY;
    
    if (!tlsCert || !tlsKey) {
      throw new Error('TEMPORAL_TLS_CERT and TEMPORAL_TLS_KEY must be set for Temporal Cloud connection');
    }
    
    // Check if the files exist
    const certPath = path.resolve(process.cwd(), tlsCert);
    const keyPath = path.resolve(process.cwd(), tlsKey);
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`TLS certificates not found at ${certPath} or ${keyPath}`);
    }
    
    connection = await Connection.connect({
      address: host,
      tls: {
        serverNameOverride: host.split(':')[0],
        clientCertPair: {
          crt: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        },
      },
    });
  } else {
    // Connect to local Temporal server
    console.log('Connecting to local Temporal server at localhost:7233');
    connection = await Connection.connect();
  }
  
  const client = new Client({
    connection,
    namespace,
    // Registers OpenTelemetry Tracing interceptor for Client calls
    interceptors: {
      workflow: [new OpenTelemetryWorkflowClientInterceptor()],
    },
  });

  const workflowId = `hello-world-${randomUUID()}`;
  console.log('Starting workflow with ID:', workflowId);

  try {
    console.log('Executing workflow...');
    const result = await client.workflow.execute(greetUser, {
      taskQueue: 'hello-world-task-queue',
      workflowId,
      args: ['Temporal'],
      workflowExecutionTimeout: '1 minute',
    });

    console.log('Waiting for workflow result...');
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