export interface IdentityEntityProps {
  id?: string;
  email: string;
  emailVerified: boolean;
}

export class IdentityEntity {
  constructor(public readonly props: IdentityEntityProps) {
    if (
      props.id !== undefined &&
      (typeof props.id !== 'string' || props.id.trim().length === 0)
    ) {
      throw new Error('Identity id must be a non-empty string');
    }

    if (!props.email || props.email.trim().length === 0) {
      throw new Error('Identity email must be a non-empty string');
    }
  }
}
