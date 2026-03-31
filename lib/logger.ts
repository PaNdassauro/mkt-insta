/**
 * Structured logging module for DashIG.
 *
 * - Production (NODE_ENV === 'production'): JSON output (one line per entry),
 *   compatible with Vercel Log Drain.
 * - Development: human-readable format with ANSI colors.
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  timestamp: string
  data?: Record<string, unknown>
}

const isProduction = process.env.NODE_ENV === 'production'

// ANSI color codes
const COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

function formatDev(entry: LogEntry): string {
  const color = COLORS[entry.level]
  const levelTag = `${color}${BOLD}${entry.level.toUpperCase().padEnd(5)}${RESET}`
  const time = `${DIM}${entry.timestamp}${RESET}`
  const ctx = entry.context ? ` ${DIM}[${entry.context}]${RESET}` : ''
  const dataStr = entry.data
    ? `\n${DIM}${JSON.stringify(entry.data, serializer, 2)}${RESET}`
    : ''
  return `${levelTag} ${time}${ctx} ${entry.message}${dataStr}`
}

/**
 * Custom replacer that handles Error objects and other non-serializable values.
 */
function serializer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  return value
}

function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    data,
  }

  const output = isProduction
    ? JSON.stringify(entry, serializer)
    : formatDev(entry)

  switch (level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

export const logger = {
  info(message: string, context?: string, data?: Record<string, unknown>) {
    log('info', message, context, data)
  },
  warn(message: string, context?: string, data?: Record<string, unknown>) {
    log('warn', message, context, data)
  },
  error(message: string, context?: string, data?: Record<string, unknown>) {
    log('error', message, context, data)
  },
}
