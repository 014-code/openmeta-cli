import select from '@inquirer/select';
import { isPromptAbortError, UserCancelledError } from './errors.js';

export interface SelectChoice<T> {
  name: string;
  value: T;
  description?: string;
  disabled?: boolean | string;
}

export async function selectPrompt<T>(options: {
  message: string;
  choices: SelectChoice<T>[];
  default?: T;
  pageSize?: number;
}): Promise<T> {
  try {
    return await select({
      message: options.message,
      choices: options.choices,
      default: options.default,
      pageSize: options.pageSize ?? 10,
    });
  } catch (error) {
    if (isPromptAbortError(error)) {
      throw new UserCancelledError();
    }
    throw error;
  }
}

