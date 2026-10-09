import { z } from 'zod';

export interface ValidationErrorDetail {
  field: string;
  code: string;
  message: string;
}

export function formatZodValidationErrors(
  error: z.ZodError,
): ValidationErrorDetail[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((field) => ({
        field,
        code: 'unrecognized_keys',
        message: `${field} is not allowed`,
      }));
    }

    const field = issue.path.join('.') || 'body';
    const code = getStableValidationCode(issue);

    return [
      {
        field,
        code,
        message:
          issue.code === 'custom'
            ? issue.message
            : getValidationMessage(field, code),
      },
    ];
  });
}

function getStableValidationCode(issue: z.ZodIssue): string {
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    return 'required';
  }

  if (issue.code === 'invalid_format' && issue.format === 'email') {
    return 'invalid_format';
  }

  return issue.code;
}

function getValidationMessage(field: string, code: string): string {
  switch (code) {
    case 'required':
      return `${field} is required`;
    case 'invalid_type':
      return `${field} has an invalid type`;
    case 'too_small':
      return `${field} cannot be empty`;
    case 'invalid_format':
      return `${field} has an invalid format`;
    default:
      return `${field} is invalid`;
  }
}
