import { IdentityEntity } from './identity.entity';

export class IdentityDomainService {
  canAuthenticate(identity: IdentityEntity): boolean {
    return identity.props.emailVerified;
  }
}
