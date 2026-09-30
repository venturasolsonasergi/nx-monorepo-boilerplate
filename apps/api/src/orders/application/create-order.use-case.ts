import type { OrderRepository } from './order.repository';

export interface CreateOrderInput {
  id: string;
}

export interface CreateOrderOutput {
  id: string;
}

export class CreateOrderUseCase {
  constructor(private readonly repository: OrderRepository) {}

  execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    void this.repository;
    return Promise.resolve({ id: input.id });
  }
}
