/**
 * Production-safe logger utility
 *
 * In development: All logs are shown
 * In production: Only errors are logged, debug/info/warn are silenced
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Some debug info:', data);
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message:', error);
 */

const isDevelopment = import.meta.env.DEV;

// No-op function for production
const noop = () => {};

export const logger = {
  /**
   * Debug level - only shown in development
   * Use for verbose debugging information
   */
  debug: isDevelopment
    ? (...args: unknown[]) => console.log(...args)
    : noop,

  /**
   * Info level - only shown in development
   * Use for general informational messages
   */
  info: isDevelopment
    ? (...args: unknown[]) => console.info(...args)
    : noop,

  /**
   * Warn level - only shown in development
   * Use for warnings that don't need user attention in production
   */
  warn: isDevelopment
    ? (...args: unknown[]) => console.warn(...args)
    : noop,

  /**
   * Error level - always shown
   * Use for actual errors that need attention
   */
  error: (...args: unknown[]) => console.error(...args),
};

export default logger;
