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
    
    // Handle connection errors
    connection.on('error', (err: any) => {
      console.error('RabbitMQ connection error:', err);
      connection = null;
      channel = null;
    });
    
    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      connection = null;
      channel = null;
    });
    
    channel = await connection.createChannel();
    
    // Assert the main tasks queue
    const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
    await channel.assertQueue(queueName, { 
      durable: true,
      deadLetterExchange: 'tasks.dlx' // Dead letter exchange for failed messages
    });
    
    // Assert delayed message exchange if using the plugin
    if (process.env.RABBITMQ_DELAYED_EXCHANGE === 'true') {
      await channel.assertExchange('tasks.delayed', 'x-delayed-message', {
        durable: true,
        arguments: { 'x-delayed-type': 'direct' }
      });
      
      // Bind the delayed exchange to the main queue
      await channel.bindQueue(queueName, 'tasks.delayed', 'task');
    }
    
    // Assert dead letter queue
    await channel.assertQueue('tasks.dead-letter', { durable: true });
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
    
    if (process.env.RABBITMQ_DELAYED_EXCHANGE === 'true') {
      // Use delayed message exchange plugin
      channel.publish('tasks.delayed', 'task', Buffer.from(taskId), {
        persistent: true,
        headers: {
          'x-delay': delayMs
        }
      });
    } else {
      // Fallback to simple delayed republishing
      const message = JSON.stringify({
        taskId,
        delayUntil: Date.now() + delayMs
      });
      
      const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
      channel.sendToQueue(queueName, Buffer.from(message), {
        persistent: true
      });
    }
    
    console.log(`Republished task ${taskId} with delay ${delayMs}ms`);
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