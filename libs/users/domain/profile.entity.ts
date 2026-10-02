export interface ProfileEntityProps {
  id?: number;
  authUserId: string;
  name: string;
  surname: string;
  address: string;
  phone: string;
}

export class ProfileEntity {
  constructor(public readonly props: ProfileEntityProps) {
    const requiredFields: Array<keyof Omit<ProfileEntityProps, 'id'>> = [
      'authUserId',
      'name',
      'surname',
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
      throw new Error('Profile id must be a positive integer');
    }
  }
}
