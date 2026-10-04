import {
  runContractTests,
  validateArchitecture,
  validateDomainPurity,
  checkDomainInvariants,
} from '../commands';
import { runCommand } from '../utils/runtime';

export function verify(service?: string): void {
  validateArchitecture();
  validateDomainPurity();
  checkDomainInvariants();
  runContractTests(service);
}

export function codeReview(service?: string): void {
  runCommand('pnpm', ['lint']);
  verify(service);
}
