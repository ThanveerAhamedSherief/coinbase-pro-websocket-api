import type { ProductId } from '../../shared/types';

export interface UserSession {
  id: string;
  subscriptions: Set<ProductId>;
  connectedAt: string;
}
