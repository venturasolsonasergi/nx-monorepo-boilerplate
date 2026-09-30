export interface UserEntityProps {
  id?: number;
  name: string;
  surname: string;
  email: string;
  address: string;
  phone: string;
}

export class UserEntity {
  constructor(public readonly props: UserEntityProps) {
    const requiredFields: Array<keyof Omit<UserEntityProps, 'id'>> = [
      'name',
      'surname',
      'email',
      'address',
      'phone',
    ];

    for (const field of requiredFields) {
      if (props[field].trim().length === 0) {
        throw new Error(`${field} must be a non-empty string`);
      }
    }

    if (
      props.id !== undefined &&
      (!Number.isInteger(props.id) || props.id <= 0)
    ) {
      throw new Error('User id must be a positive integer');
    }
  }
}
