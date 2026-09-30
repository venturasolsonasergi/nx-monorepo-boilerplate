export class OrderIdValueObject {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('OrderId must be a non-empty string');
    }
  }
}
