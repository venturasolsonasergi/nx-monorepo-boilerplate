import { OrderEntity } from '../domain/order.entity';

export interface OrderRepository {
  findById(id: string): Promise<OrderEntity | null>;
  save(entity: OrderEntity): Promise<void>;
}
