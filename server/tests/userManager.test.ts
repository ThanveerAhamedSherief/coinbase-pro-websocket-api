import WebSocket from 'ws';
import { UserManager } from '../src/modules/users/user.manager';
import { ServerToClientMessage } from '../src/shared/types';

/** Create a mock WebSocket that records sent messages and has OPEN state. */
function createMockWs(): WebSocket & { sentMessages: string[] } {
  const sentMessages: string[] = [];
  const ws = {
    readyState: WebSocket.OPEN,
    send: jest.fn((data: string, _cb?: (err?: Error) => void) => {
      sentMessages.push(data);
      if (_cb) _cb(undefined);
    }),
    sentMessages,
  } as unknown as WebSocket & { sentMessages: string[] };
  return ws;
}

const MOCK_MSG: ServerToClientMessage = {
  type: 'system_status',
  channels: [],
  server_time: new Date().toISOString(),
};

describe('UserManager', () => {
  let manager: UserManager;

  beforeEach(() => {
    manager = new UserManager();
  });

  describe('addUser', () => {
    it('should increment userCount', () => {
      const ws = createMockWs();
      manager.addUser('user-1', ws);
      expect(manager.userCount).toBe(1);
    });

    it('should track multiple users', () => {
      manager.addUser('user-1', createMockWs());
      manager.addUser('user-2', createMockWs());
      expect(manager.userCount).toBe(2);
    });
  });

  describe('removeUser', () => {
    it('should decrement userCount', () => {
      manager.addUser('user-1', createMockWs());
      manager.removeUser('user-1');
      expect(manager.userCount).toBe(0);
    });

    it('should return an empty set for an unknown userId', () => {
      const abandoned = manager.removeUser('ghost');
      expect(abandoned.size).toBe(0);
    });

    it('should return products that have no remaining subscribers', () => {
      manager.addUser('user-1', createMockWs());
      manager.subscribeUser('user-1', 'BTC-USD');
      const abandoned = manager.removeUser('user-1');
      expect(abandoned.has('BTC-USD')).toBe(true);
    });

    it('should NOT include products that still have other subscribers', () => {
      manager.addUser('user-1', createMockWs());
      manager.addUser('user-2', createMockWs());
      manager.subscribeUser('user-1', 'BTC-USD');
      manager.subscribeUser('user-2', 'BTC-USD');

      const abandoned = manager.removeUser('user-1');
      expect(abandoned.has('BTC-USD')).toBe(false);
    });
  });

  describe('subscribeUser', () => {
    beforeEach(() => {
      manager.addUser('user-1', createMockWs());
    });

    it('should return true when user is the first subscriber', () => {
      const isFirst = manager.subscribeUser('user-1', 'BTC-USD');
      expect(isFirst).toBe(true);
    });

    it('should return false when another user is already subscribed', () => {
      manager.addUser('user-2', createMockWs());
      manager.subscribeUser('user-1', 'BTC-USD');
      const isFirst = manager.subscribeUser('user-2', 'BTC-USD');
      expect(isFirst).toBe(false);
    });

    it('should track subscription for the user', () => {
      manager.subscribeUser('user-1', 'ETH-USD');
      expect(manager.isUserSubscribed('user-1', 'ETH-USD')).toBe(true);
    });

    it('should not duplicate subscriptions on double-subscribe', () => {
      manager.subscribeUser('user-1', 'BTC-USD');
      manager.subscribeUser('user-1', 'BTC-USD');
      expect(manager.getProductSubscriberCount('BTC-USD')).toBe(1);
    });

    it('should return false for unknown userId', () => {
      const result = manager.subscribeUser('ghost', 'BTC-USD');
      expect(result).toBe(false);
    });
  });

  describe('unsubscribeUser', () => {
    beforeEach(() => {
      manager.addUser('user-1', createMockWs());
      manager.addUser('user-2', createMockWs());
      manager.subscribeUser('user-1', 'BTC-USD');
      manager.subscribeUser('user-2', 'BTC-USD');
    });

    it('should return false when another subscriber still exists', () => {
      const isEmpty = manager.unsubscribeUser('user-1', 'BTC-USD');
      expect(isEmpty).toBe(false);
    });

    it('should return true when the last subscriber leaves', () => {
      manager.unsubscribeUser('user-1', 'BTC-USD');
      const isEmpty = manager.unsubscribeUser('user-2', 'BTC-USD');
      expect(isEmpty).toBe(true);
    });

    it('should remove the product from user subscriptions', () => {
      manager.unsubscribeUser('user-1', 'BTC-USD');
      expect(manager.isUserSubscribed('user-1', 'BTC-USD')).toBe(false);
    });

    it('should return false for unknown userId', () => {
      const result = manager.unsubscribeUser('ghost', 'BTC-USD');
      expect(result).toBe(false);
    });

    it('should return false when user was not subscribed', () => {
      manager.addUser('user-3', createMockWs());
      const result = manager.unsubscribeUser('user-3', 'BTC-USD');
      expect(result).toBe(false);
    });
  });

  describe('getProductSubscriberCount', () => {
    it('should return 0 for a product with no subscribers', () => {
      expect(manager.getProductSubscriberCount('XRP-USD')).toBe(0);
    });

    it('should count correctly as users subscribe', () => {
      manager.addUser('user-1', createMockWs());
      manager.addUser('user-2', createMockWs());
      manager.subscribeUser('user-1', 'LTC-USD');
      manager.subscribeUser('user-2', 'LTC-USD');
      expect(manager.getProductSubscriberCount('LTC-USD')).toBe(2);
    });
  });

  describe('broadcastToProduct', () => {
    it('should only send to subscribed users', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.addUser('user-1', ws1);
      manager.addUser('user-2', ws2);
      manager.subscribeUser('user-1', 'BTC-USD');
      // user-2 NOT subscribed to BTC-USD

      manager.broadcastToProduct('BTC-USD', MOCK_MSG);

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should send correct JSON payload', () => {
      const ws1 = createMockWs();
      manager.addUser('user-1', ws1);
      manager.subscribeUser('user-1', 'ETH-USD');

      manager.broadcastToProduct('ETH-USD', MOCK_MSG);

      const received = JSON.parse(ws1.sentMessages[0] as string);
      expect(received.type).toBe('system_status');
    });

    it('should not throw when there are no subscribers', () => {
      expect(() => manager.broadcastToProduct('LTC-USD', MOCK_MSG)).not.toThrow();
    });

    it('should skip users with a non-OPEN socket', () => {
      const ws1 = createMockWs();
      // Simulate closed socket
      (ws1 as unknown as Record<string, unknown>).readyState = WebSocket.CLOSED;
      manager.addUser('user-1', ws1);
      manager.subscribeUser('user-1', 'BTC-USD');

      manager.broadcastToProduct('BTC-USD', MOCK_MSG);
      expect(ws1.send).not.toHaveBeenCalled();
    });
  });

  describe('sendToUser', () => {
    it('should send only to the specified user', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.addUser('user-1', ws1);
      manager.addUser('user-2', ws2);

      manager.sendToUser('user-1', MOCK_MSG);

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should not throw for an unknown userId', () => {
      expect(() => manager.sendToUser('ghost', MOCK_MSG)).not.toThrow();
    });
  });

  describe('broadcastToAll', () => {
    it('should send to every connected user', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const ws3 = createMockWs();
      manager.addUser('user-1', ws1);
      manager.addUser('user-2', ws2);
      manager.addUser('user-3', ws3);

      manager.broadcastToAll(MOCK_MSG);

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
      expect(ws3.send).toHaveBeenCalledTimes(1);
    });

    it('should not throw when no users are connected', () => {
      expect(() => manager.broadcastToAll(MOCK_MSG)).not.toThrow();
    });
  });

  describe('introspection helpers', () => {
    it('getSubscribedProducts returns unique products with subscribers', () => {
      manager.addUser('user-1', createMockWs());
      manager.addUser('user-2', createMockWs());
      manager.subscribeUser('user-1', 'BTC-USD');
      manager.subscribeUser('user-2', 'ETH-USD');

      const products = manager.getSubscribedProducts();
      expect(products).toContain('BTC-USD');
      expect(products).toContain('ETH-USD');
      expect(products).toHaveLength(2);
    });

    it('getUserSubscriptions returns an empty array for an unknown user', () => {
      expect(manager.getUserSubscriptions('ghost')).toEqual([]);
    });

    it('getUserSubscriptions returns the correct products', () => {
      manager.addUser('user-1', createMockWs());
      manager.subscribeUser('user-1', 'BTC-USD');
      manager.subscribeUser('user-1', 'LTC-USD');

      const subs = manager.getUserSubscriptions('user-1');
      expect(subs).toContain('BTC-USD');
      expect(subs).toContain('LTC-USD');
    });
  });
});
