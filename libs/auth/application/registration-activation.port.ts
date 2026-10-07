export const REGISTRATION_ACTIVATION = Symbol('REGISTRATION_ACTIVATION');

export interface RegistrationActivationInput {
  tokenHash: string;
  password: string;
}

export interface RegistrationActivationResult {
  userId: string;
  email: string;
}

export interface RegistrationActivationPort {
  activate(
    input: RegistrationActivationInput,
  ): Promise<RegistrationActivationResult>;
}
