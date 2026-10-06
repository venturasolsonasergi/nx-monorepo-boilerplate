import {
  runContractTests,
  validateArchitecture,
  validateDomainPurity,
  checkDomainInvariants,
  checkPackageVersions,
} from '../commands';
import { runCommand } from '../utils/runtime';

export function verify(service?: string): void {
  validateArchitecture();
  validateDomainPurity();
  checkDomainInvariants();
  checkPackageVersions();
  runContractTests(service);
}

export function codeReview(service?: string): void {
  runCommand('pnpm', ['lint']);
  verify(service);
}
