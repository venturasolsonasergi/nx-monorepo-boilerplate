import {
  runContractTests,
  validateArchitecture,
  validateDomainPurity,
  checkDomainInvariants,
  checkPackageVersions,
  verifyOpenApiArtifact,
} from '../commands';
import { runCommand } from '../utils/runtime';

export async function verify(service?: string): Promise<void> {
  validateArchitecture();
  validateDomainPurity();
  checkDomainInvariants();
  checkPackageVersions();
  await verifyOpenApiArtifact();
  runContractTests(service);
}

export async function codeReview(service?: string): Promise<void> {
  runCommand('pnpm', ['lint']);
  await verify(service);
}
