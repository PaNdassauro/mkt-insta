import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '@/lib/logger'

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logger.info outputs via console.log', () => {
    logger.info('test message')
    expect(logSpy).toHaveBeenCalledTimes(1)
    const output = logSpy.mock.calls[0][0] as string
    expect(output).toContain('test message')
  })

  it('logger.warn outputs via console.warn', () => {
    logger.warn('warning message')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const output = warnSpy.mock.calls[0][0] as string
    expect(output).toContain('warning message')
  })

  it('logger.error outputs via console.error', () => {
    logger.error('error message')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const output = errorSpy.mock.calls[0][0] as string
    expect(output).toContain('error message')
  })

  it('logger.info output contains INFO level tag', () => {
    logger.info('hello')
    const output = logSpy.mock.calls[0][0] as string
    expect(output.toUpperCase()).toContain('INFO')
  })

  it('includes timestamp in ISO format', () => {
    logger.info('timestamp test')
    const output = logSpy.mock.calls[0][0] as string
    // ISO 8601 pattern: YYYY-MM-DDTHH:MM:SS
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('includes context when provided', () => {
    logger.info('ctx test', 'MyContext')
    const output = logSpy.mock.calls[0][0] as string
    expect(output).toContain('MyContext')
  })

  it('includes data when provided', () => {
    logger.info('data test', undefined, { key: 'value' })
    const output = logSpy.mock.calls[0][0] as string
    expect(output).toContain('key')
    expect(output).toContain('value')
  })

  it('serializes Error objects with name, message, and stack', () => {
    const err = new Error('something broke')
    logger.error('err test', undefined, { err })
    const output = errorSpy.mock.calls[0][0] as string
    expect(output).toContain('something broke')
    expect(output).toContain('Error')
  })
})

describe('logger JSON output in production', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('outputs valid JSON in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()
    const { logger: prodLogger } = await import('@/lib/logger')

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    prodLogger.info('json test', 'Ctx', { foo: 'bar' })

    const output = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('json test')
    expect(parsed.context).toBe('Ctx')
    expect(parsed.data).toEqual({ foo: 'bar' })
    expect(parsed.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/)

    logSpy.mockRestore()
  })
})
