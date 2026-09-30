export interface OrderEntityProps {
  id: string;
}

export class OrderEntity {
  constructor(public readonly props: OrderEntityProps) {}
}
