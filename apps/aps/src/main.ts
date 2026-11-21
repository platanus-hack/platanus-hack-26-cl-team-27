import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, USAGE, UsageError } from './args.ts';
import { check } from './check.ts';
import { ConfigError, readConfig } from './config.ts';
import { consoleOutput } from './io.ts';
import { publish } from './publish.ts';

const MODELS_FOLDER = fileURLToPath(new URL('../models/', import.meta.url));

const run = async (argv: readonly string[]): Promise<number> => {
  const command = parseArgs(argv);
  const config = readConfig(process.env);
  if (command.name === 'check') return check(config, consoleOutput);
  return publish(
    config,
    {
      folder: command.folder === null ? MODELS_FOLDER : resolve(command.folder),
      force: command.force,
    },
    consoleOutput,
  );
};

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    consoleOutput.err(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  } else if (error instanceof ConfigError) {
    consoleOutput.err(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
