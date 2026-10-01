import {
  archiveArchitecture,
  checkDependencies,
  checkDomainInvariants,
  prismaGenerate,
  prismaMigrate,
  runContractTests,
  validateArchitecture,
  validateDomainPurity,
} from './commands';
import { codeReview, publish, verify } from './workflows';
import { parsePassThroughArgs, parseServiceArg } from './utils/services';

const command = process.argv[2];
const args = process.argv.slice(3);

const handlers: Record<string, () => void> = {
  'validate:architecture': validateArchitecture,
  'validate:domain': validateDomainPurity,
  'check:domain-invariants': checkDomainInvariants,
  'check:dependencies': checkDependencies,
  'test:contract': () => runContractTests(parseServiceArg(args)),
  'prisma:generate': () => prismaGenerate(parseServiceArg(args)),
  'prisma:migrate': () =>
    prismaMigrate(parseServiceArg(args), parsePassThroughArgs(args)),
  verify: () => verify(parseServiceArg(args)),
  code_review: () => codeReview(parseServiceArg(args)),
  'archive:architecture': archiveArchitecture,
  publish,
};

function main(): void {
  const handler = command ? handlers[command] : undefined;
  if (!handler) {
    throw new Error(
      `Unknown command: ${command ?? '<none>'}. Use one of ${Object.keys(handlers).join(', ')}.`,
    );
  }

  handler();
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
