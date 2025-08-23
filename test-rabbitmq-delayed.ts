#!/usr/bin/env node
/**
 * Test script for the RabbitMQ service with delayed message exchange.
 * This script tests the delayed message functionality.
 */

import { publishTask, republishTaskWithDelay, initializeRabbitMQ, closeRabbitMQConnection } from './apps/api/src/services/rabbitmq';

async function testRabbitMQDelayed() {
  console.log('Testing RabbitMQ service with delayed message exchange...');
  
  const testTaskId = 'test-task-002';
  
  try {
    // Initialize RabbitMQ connection
    console.log('Initializing RabbitMQ connection...');
    await initializeRabbitMQ();
    
    // Test publishing a task
    console.log('Publishing task...');
    await publishTask(testTaskId);
    console.log(`Task ${testTaskId} published successfully`);
    
    // Test republishing with delay
    console.log('Republishing task with 5-second delay...');
    await republishTaskWithDelay(testTaskId, 5000);
    console.log(`Task ${testTaskId} republished with delay`);
    
    // Test exponential backoff
    console.log('Testing exponential backoff...');
    const delays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff sequence
    for (let i = 0; i < delays.length; i++) {
      console.log(`Republishing with ${delays[i]}ms delay (attempt ${i + 1})`);
      await republishTaskWithDelay(testTaskId, delays[i]);
    }
    
    console.log('RabbitMQ delayed message test completed successfully');
  } catch (error) {
    console.error('Error during RabbitMQ delayed message test:', error);
  } finally {
    // Close RabbitMQ connection
    console.log('Closing RabbitMQ connection...');
    await closeRabbitMQConnection();
  }
}

// Run the test
testRabbitMQDelayed();