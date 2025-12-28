/**
 * Message Router Service
 *
 * Determines delivery methods for messages based on source channel and interface.
 * Part of the omnichannel chat architecture.
 *
 * Routing Logic:
 * - telegram + bot → telegram_api
 * - telegram + webapp → realtime
 * - web + browser → realtime
 * - whatsapp + api → whatsapp_api (future)
 *
 * @module MessageRouter
 */

import { getLogger } from '../../core/logger.js';
import type { ChannelType, InterfaceType, RoutingContext } from '../../types/omnichannel.js';

/**
 * Delivery method type
 */
export type DeliveryMethod = 'telegram_api' | 'realtime' | 'whatsapp_api';

/**
 * Routing configuration map
 *
 * Format: {channel}:{interface} → deliveryMethod
 */
const ROUTING_MAP: Record<string, DeliveryMethod> = {
  'telegram:bot': 'telegram_api',
  'telegram:webapp': 'realtime',
  'web:browser': 'realtime',
  'whatsapp:api': 'whatsapp_api',
};

/**
 * Message Router Service
 *
 * Singleton service for routing messages to appropriate delivery channels.
 * Uses a simple map-based routing strategy for deterministic routing.
 *
 * @example
 * ```typescript
 * const router = MessageRouter.getInstance();
 * const routing = router.routeToChannel('telegram', 'bot');
 * console.log(routing.deliveryMethod); // 'telegram_api'
 * ```
 */
export class MessageRouter {
  private static instance: MessageRouter | null = null;
  private logger = getLogger().child({ module: 'message-router' });

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.logger.info('MessageRouter initialized');
  }

  /**
   * Get singleton instance
   *
   * @returns {MessageRouter} Singleton instance
   */
  public static getInstance(): MessageRouter {
    if (!MessageRouter.instance) {
      MessageRouter.instance = new MessageRouter();
    }
    return MessageRouter.instance;
  }

  /**
   * Route message to appropriate delivery channel
   *
   * Determines the delivery method based on the source channel and interface.
   * Logs routing decision for debugging and monitoring.
   *
   * @param {ChannelType} sourceChannel - Source channel (telegram, web, whatsapp, wechat)
   * @param {InterfaceType} sourceInterface - Source interface (bot, webapp, browser, api, miniprogram)
   * @returns {RoutingContext} Routing context with delivery method
   *
   * @example
   * ```typescript
   * const router = MessageRouter.getInstance();
   *
   * // Telegram bot message
   * const ctx1 = router.routeToChannel('telegram', 'bot');
   * // → { channel: 'telegram', interface: 'bot', deliveryMethod: 'telegram_api' }
   *
   * // Telegram webapp message
   * const ctx2 = router.routeToChannel('telegram', 'webapp');
   * // → { channel: 'telegram', interface: 'webapp', deliveryMethod: 'realtime' }
   *
   * // Web browser message
   * const ctx3 = router.routeToChannel('web', 'browser');
   * // → { channel: 'web', interface: 'browser', deliveryMethod: 'realtime' }
   * ```
   */
  public routeToChannel(
    sourceChannel: ChannelType,
    sourceInterface: InterfaceType
  ): RoutingContext {
    const deliveryMethod = this.getDeliveryMethod(sourceChannel, sourceInterface);

    const routingContext: RoutingContext = {
      channel: sourceChannel,
      interface: sourceInterface,
      deliveryMethod,
    };

    this.logger.debug(
      {
        sourceChannel,
        sourceInterface,
        deliveryMethod,
      },
      'Message routed to delivery channel'
    );

    return routingContext;
  }

  /**
   * Get delivery method for a channel/interface combination
   *
   * Uses a lookup map for deterministic routing.
   * Falls back to 'realtime' for unknown combinations.
   *
   * @param {ChannelType} channel - Channel type
   * @param {InterfaceType} interfaceType - Interface type
   * @returns {DeliveryMethod} Delivery method
   *
   * @example
   * ```typescript
   * const router = MessageRouter.getInstance();
   *
   * router.getDeliveryMethod('telegram', 'bot');
   * // → 'telegram_api'
   *
   * router.getDeliveryMethod('telegram', 'webapp');
   * // → 'realtime'
   *
   * router.getDeliveryMethod('web', 'browser');
   * // → 'realtime'
   *
   * router.getDeliveryMethod('wechat', 'miniprogram');
   * // → 'realtime' (fallback for unknown combinations)
   * ```
   */
  public getDeliveryMethod(
    channel: ChannelType,
    interfaceType: InterfaceType
  ): DeliveryMethod {
    const key = `${channel}:${interfaceType}`;
    const deliveryMethod = ROUTING_MAP[key];

    if (!deliveryMethod) {
      this.logger.warn(
        {
          channel,
          interfaceType,
          fallback: 'realtime',
        },
        'Unknown channel/interface combination, falling back to realtime'
      );
      return 'realtime';
    }

    return deliveryMethod;
  }

  /**
   * Check if a delivery method is available/supported
   *
   * Currently only 'whatsapp_api' is unsupported (future implementation).
   * All other delivery methods are available.
   *
   * @param {DeliveryMethod} deliveryMethod - Delivery method to check
   * @returns {boolean} True if delivery method is available
   *
   * @example
   * ```typescript
   * const router = MessageRouter.getInstance();
   *
   * router.isDeliveryMethodAvailable('telegram_api');
   * // → true
   *
   * router.isDeliveryMethodAvailable('realtime');
   * // → true
   *
   * router.isDeliveryMethodAvailable('whatsapp_api');
   * // → false (not yet implemented)
   * ```
   */
  public isDeliveryMethodAvailable(deliveryMethod: DeliveryMethod): boolean {
    // WhatsApp API not yet implemented
    if (deliveryMethod === 'whatsapp_api') {
      return false;
    }

    return true;
  }

  /**
   * Get all supported routing configurations
   *
   * Returns a list of all channel/interface combinations that have
   * explicit routing configurations.
   *
   * @returns {Array<{channel: ChannelType, interface: InterfaceType, deliveryMethod: DeliveryMethod}>}
   *
   * @example
   * ```typescript
   * const router = MessageRouter.getInstance();
   * const configs = router.getSupportedRoutes();
   * // [
   * //   { channel: 'telegram', interface: 'bot', deliveryMethod: 'telegram_api' },
   * //   { channel: 'telegram', interface: 'webapp', deliveryMethod: 'realtime' },
   * //   { channel: 'web', interface: 'browser', deliveryMethod: 'realtime' },
   * //   { channel: 'whatsapp', interface: 'api', deliveryMethod: 'whatsapp_api' }
   * // ]
   * ```
   */
  public getSupportedRoutes(): Array<{
    channel: ChannelType;
    interface: InterfaceType;
    deliveryMethod: DeliveryMethod;
  }> {
    return Object.entries(ROUTING_MAP).map(([key, deliveryMethod]) => {
      const [channel, interfaceType] = key.split(':') as [ChannelType, InterfaceType];
      return {
        channel,
        interface: interfaceType,
        deliveryMethod,
      };
    });
  }
}

/**
 * Singleton instance for convenient access
 *
 * @example
 * ```typescript
 * import { messageRouter } from './services/routing/MessageRouter.js';
 *
 * const routing = messageRouter.routeToChannel('telegram', 'bot');
 * console.log(routing.deliveryMethod); // 'telegram_api'
 * ```
 */
export const messageRouter = MessageRouter.getInstance();
