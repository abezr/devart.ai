import amqp from 'amqplib';

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

/**
 * Get a RabbitMQ connection and channel
 * @returns Object containing the connection and channel
 */
async function getRabbitMQConnection() {
  if (!connection || !channel) {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    
    // Assert the tasks queue to ensure it exists
    const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
    await channel.assertQueue(queueName, { durable: true });
  }
  
  return { connection, channel };
}

/**
 * Publish a task to the RabbitMQ queue
 * @param taskId The ID of the task to publish
 */
export async function publishTask(taskId: string): Promise<void> {
  try {
    const { channel } = await getRabbitMQConnection();
    const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
    
    // Publish the task ID as a message to the queue
    channel.sendToQueue(queueName, Buffer.from(taskId), {
      persistent: true // Make the message persistent
    });
    
    console.log(`Published task ${taskId} to queue ${queueName}`);
  } catch (error) {
    console.error('Failed to publish task to RabbitMQ:', error);
    throw new Error(`Failed to publish task ${taskId} to RabbitMQ: ${error}`);
  }
}

/**
 * Republish a task to the RabbitMQ queue with a delay
 * @param taskId The ID of the task to republish
 * @param delayMs The delay in milliseconds before the task should be processed
 */
export async function republishTaskWithDelay(taskId: string, delayMs: number = 5000): Promise<void> {
  try {
    const { channel } = await getRabbitMQConnection();
    const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
    
    // For delayed messaging, we would typically use RabbitMQ's delayed message exchange plugin
    // For simplicity in this implementation, we'll just publish the task with a timestamp
    // and let the consumer handle the delay logic
    const message = JSON.stringify({
      taskId,
      delayUntil: Date.now() + delayMs
    });
    
    channel.sendToQueue(queueName, Buffer.from(message), {
      persistent: true,
      headers: {
        'x-delay': delayMs // This would work with the delayed message exchange plugin
      }
    });
    
    console.log(`Republished task ${taskId} to queue ${queueName} with delay ${delayMs}ms`);
  } catch (error) {
    console.error('Failed to republish task to RabbitMQ:', error);
    throw new Error(`Failed to republish task ${taskId} to RabbitMQ: ${error}`);
  }
}

/**
 * Close the RabbitMQ connection
 */
export async function closeRabbitMQConnection(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  
  if (connection) {
    await connection.close();
    connection = null;
  }
}

/**
 * Initialize RabbitMQ connection at startup
 */
export async function initializeRabbitMQ(): Promise<void> {
  try {
    await getRabbitMQConnection();
    console.log('RabbitMQ connection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RabbitMQ connection:', error);
    throw new Error(`Failed to initialize RabbitMQ connection: ${error}`);
  }
}