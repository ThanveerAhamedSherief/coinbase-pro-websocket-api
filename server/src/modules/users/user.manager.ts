import WebSocket from 'ws';
import { logger } from '../../logger';
import type { ProductId, ServerToClientMessage } from '../../shared/types';
import type { UserSession } from './user.types';

export class UserManager {
  private users: Map<string, { session: UserSession; ws: WebSocket }> = new Map();
  private productSubscribers: Map<ProductId, Set<string>> = new Map();

  addUser(userId: string, ws: WebSocket): void {
    const session: UserSession = {
      id:           userId,
      subscriptions: new Set<ProductId>(),
      connectedAt:  new Date().toISOString(),
    };
    this.users.set(userId, { session, ws });
    logger.info({ userId, total: this.users.size }, 'user connected');
  }

  removeUser(userId: string): Set<ProductId> {
    const entry = this.users.get(userId);
    if (!entry) return new Set();

    const abandonedProducts = new Set<ProductId>();
    for (const productId of entry.session.subscriptions) {
      const subs = this.productSubscribers.get(productId);
      if (subs) {
        subs.delete(userId);
        if (subs.size === 0) {
          this.productSubscribers.delete(productId);
          abandonedProducts.add(productId);
        }
      }
    }

    this.users.delete(userId);
    logger.info({ userId, total: this.users.size }, 'user disconnected');
    return abandonedProducts;
  }

  subscribeUser(userId: string, productId: ProductId): boolean {
    const entry = this.users.get(userId);
    if (!entry) {
      logger.warn({ userId }, 'subscribeUser: unknown userId');
      return false;
    }

    entry.session.subscriptions.add(productId);
    const isFirst = !this.productSubscribers.get(productId)?.size;

    if (!this.productSubscribers.has(productId)) {
      this.productSubscribers.set(productId, new Set());
    }
    this.productSubscribers.get(productId)!.add(userId);

    logger.info({ userId, productId, total: this.productSubscribers.get(productId)!.size }, 'user subscribed');
    return isFirst;
  }

  unsubscribeUser(userId: string, productId: ProductId): boolean {
    const entry = this.users.get(userId);
    if (!entry) {
      logger.warn({ userId }, 'unsubscribeUser: unknown userId');
      return false;
    }

    entry.session.subscriptions.delete(productId);
    const subs = this.productSubscribers.get(productId);
    if (!subs) return false;

    subs.delete(userId);
    const isEmpty = subs.size === 0;
    if (isEmpty) this.productSubscribers.delete(productId);

    logger.info({ userId, productId, remaining: subs.size }, 'user unsubscribed');
    return isEmpty;
  }

  broadcastToProduct(productId: ProductId, message: ServerToClientMessage): void {
    const subs = this.productSubscribers.get(productId);
    if (!subs?.size) return;

    const payload = JSON.stringify(message);
    for (const userId of subs) {
      const entry = this.users.get(userId);
      if (entry?.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(payload, (err) => {
          if (err) logger.error({ userId, err: err.message }, 'send failed');
        });
      }
    }
  }

  sendToUser(userId: string, message: ServerToClientMessage): void {
    const entry = this.users.get(userId);
    if (!entry || entry.ws.readyState !== WebSocket.OPEN) return;
    entry.ws.send(JSON.stringify(message), (err) => {
      if (err) logger.error({ userId, err: err.message }, 'send failed');
    });
  }

  broadcastToAll(message: ServerToClientMessage): void {
    const payload = JSON.stringify(message);
    for (const [userId, { ws }] of this.users) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload, (err) => {
          if (err) logger.error({ userId, err: err.message }, 'broadcast failed');
        });
      }
    }
  }

  getProductSubscriberCount(productId: ProductId): number {
    return this.productSubscribers.get(productId)?.size ?? 0;
  }

  isUserSubscribed(userId: string, productId: ProductId): boolean {
    return this.users.get(userId)?.session.subscriptions.has(productId) ?? false;
  }

  getUserSubscriptions(userId: string): ProductId[] {
    const entry = this.users.get(userId);
    return entry ? Array.from(entry.session.subscriptions) : [];
  }

  getSubscribedProducts(): ProductId[] {
    return Array.from(this.productSubscribers.keys());
  }

  get userCount(): number { return this.users.size; }
}
