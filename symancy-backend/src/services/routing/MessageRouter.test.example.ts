/**
 * MessageRouter Example Usage
 *
 * This file demonstrates the usage of MessageRouter.
 * Remove the .test.example.ts extension to run with a test runner.
 */

import { messageRouter, MessageRouter } from './MessageRouter.js';

/**
 * Example 1: Basic routing
 */
function exampleBasicRouting() {
  console.log('\n=== Example 1: Basic Routing ===');

  // Route telegram bot message
  const routing1 = messageRouter.routeToChannel('telegram', 'bot');
  console.log('Telegram bot:', routing1);
  // Output: { channel: 'telegram', interface: 'bot', deliveryMethod: 'telegram_api' }

  // Route telegram webapp message
  const routing2 = messageRouter.routeToChannel('telegram', 'webapp');
  console.log('Telegram webapp:', routing2);
  // Output: { channel: 'telegram', interface: 'webapp', deliveryMethod: 'realtime' }

  // Route web browser message
  const routing3 = messageRouter.routeToChannel('web', 'browser');
  console.log('Web browser:', routing3);
  // Output: { channel: 'web', interface: 'browser', deliveryMethod: 'realtime' }
}

/**
 * Example 2: Get delivery method only
 */
function exampleGetDeliveryMethod() {
  console.log('\n=== Example 2: Get Delivery Method ===');

  const method1 = messageRouter.getDeliveryMethod('telegram', 'bot');
  console.log('telegram + bot =', method1);
  // Output: 'telegram_api'

  const method2 = messageRouter.getDeliveryMethod('telegram', 'webapp');
  console.log('telegram + webapp =', method2);
  // Output: 'realtime'

  const method3 = messageRouter.getDeliveryMethod('web', 'browser');
  console.log('web + browser =', method3);
  // Output: 'realtime'
}

/**
 * Example 3: Check delivery method availability
 */
function exampleCheckAvailability() {
  console.log('\n=== Example 3: Check Availability ===');

  const isTelegramAvailable = messageRouter.isDeliveryMethodAvailable('telegram_api');
  console.log('telegram_api available:', isTelegramAvailable);
  // Output: true

  const isRealtimeAvailable = messageRouter.isDeliveryMethodAvailable('realtime');
  console.log('realtime available:', isRealtimeAvailable);
  // Output: true

  const isWhatsAppAvailable = messageRouter.isDeliveryMethodAvailable('whatsapp_api');
  console.log('whatsapp_api available:', isWhatsAppAvailable);
  // Output: false (not yet implemented)
}

/**
 * Example 4: Get all supported routes
 */
function exampleGetSupportedRoutes() {
  console.log('\n=== Example 4: Get Supported Routes ===');

  const routes = messageRouter.getSupportedRoutes();
  console.log('Supported routes:', JSON.stringify(routes, null, 2));
  // Output:
  // [
  //   { channel: 'telegram', interface: 'bot', deliveryMethod: 'telegram_api' },
  //   { channel: 'telegram', interface: 'webapp', deliveryMethod: 'realtime' },
  //   { channel: 'web', interface: 'browser', deliveryMethod: 'realtime' },
  //   { channel: 'whatsapp', interface: 'api', deliveryMethod: 'whatsapp_api' }
  // ]
}

/**
 * Example 5: Singleton pattern
 */
function exampleSingletonPattern() {
  console.log('\n=== Example 5: Singleton Pattern ===');

  const router1 = messageRouter;
  const router2 = MessageRouter.getInstance();

  console.log('router1 === router2:', router1 === router2);
  // Output: true

  console.log('Same instance:', Object.is(router1, router2));
  // Output: true
}

/**
 * Example 6: Fallback behavior (unknown combinations)
 */
function exampleFallbackBehavior() {
  console.log('\n=== Example 6: Fallback Behavior ===');

  // Unknown combination falls back to 'realtime'
  const routing = messageRouter.routeToChannel('wechat', 'miniprogram');
  console.log('WeChat miniprogram:', routing);
  // Output: { channel: 'wechat', interface: 'miniprogram', deliveryMethod: 'realtime' }
  // Logs warning: "Unknown channel/interface combination, falling back to realtime"
}

/**
 * Example 7: Integration with delivery logic
 */
function exampleIntegrationWithDelivery() {
  console.log('\n=== Example 7: Integration with Delivery ===');

  // Simulate message from different sources
  const sources = [
    { channel: 'telegram' as const, interface: 'bot' as const },
    { channel: 'telegram' as const, interface: 'webapp' as const },
    { channel: 'web' as const, interface: 'browser' as const },
  ];

  for (const source of sources) {
    const routing = messageRouter.routeToChannel(source.channel, source.interface);

    // Check if delivery method is available
    if (messageRouter.isDeliveryMethodAvailable(routing.deliveryMethod)) {
      console.log(`✅ Ready to deliver via ${routing.deliveryMethod}`);
      // Here you would call deliveryService.deliver(message, routing)
    } else {
      console.log(`❌ Delivery method ${routing.deliveryMethod} not available`);
      // Handle unavailable delivery method
    }
  }
}

/**
 * Run all examples
 */
function runAllExamples() {
  console.log('MessageRouter Examples');
  console.log('='.repeat(50));

  exampleBasicRouting();
  exampleGetDeliveryMethod();
  exampleCheckAvailability();
  exampleGetSupportedRoutes();
  exampleSingletonPattern();
  exampleFallbackBehavior();
  exampleIntegrationWithDelivery();

  console.log('\n' + '='.repeat(50));
  console.log('All examples completed!');
}

// Uncomment to run examples
// runAllExamples();

export {
  exampleBasicRouting,
  exampleGetDeliveryMethod,
  exampleCheckAvailability,
  exampleGetSupportedRoutes,
  exampleSingletonPattern,
  exampleFallbackBehavior,
  exampleIntegrationWithDelivery,
  runAllExamples,
};
