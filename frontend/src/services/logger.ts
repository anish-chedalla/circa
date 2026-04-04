/**
 * Simple logger utility that respects the current environment.
 *
 * - In production only error-level messages are emitted.
 * - In development all levels (debug, info, warn, error) are emitted.
 */

type LogFn = (...args: unknown[]) => void;

interface Logger {
  /** Log debug-level messages (dev only). */
  debug: LogFn;
  /** Log informational messages (dev only). */
  info: LogFn;
  /** Log warning messages (dev only). */
  warn: LogFn;
  /** Log error messages (always). */
  error: LogFn;
}

const noop: LogFn = () => {
  /* intentionally empty */
};

const isProd = import.meta.env.PROD;

/**
 * Application-wide logger instance.
 * Replaces raw `console.log` calls with environment-aware logging.
 */
const logger: Logger = {
  /* eslint-disable no-console */
  debug: isProd ? noop : (...args: unknown[]) => console.debug('[DEBUG]', ...args),
  info: isProd ? noop : (...args: unknown[]) => console.info('[INFO]', ...args),
  warn: isProd ? noop : (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  /* eslint-enable no-console */
};

export default logger;
