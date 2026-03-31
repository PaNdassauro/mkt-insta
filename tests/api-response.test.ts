import { describe, it, expect, vi } from 'vitest'
import { apiSuccess, apiError, getErrorMessage, withErrorHandler } from '@/lib/api-response'

describe('apiSuccess', () => {
  it('returns JSON response with data and default 200 status', async () => {
    const res = apiSuccess({ items: [1, 2, 3] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ items: [1, 2, 3] })
  })

  it('returns JSON response with custom status', async () => {
    const res = apiSuccess({ created: true }, 201)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ created: true })
  })

  it('handles null data', async () => {
    const res = apiSuccess(null)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })
})

describe('apiError', () => {
  it('returns error response with message and default 500 status', async () => {
    const res = apiError('Something went wrong')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Something went wrong' })
  })

  it('returns error response with custom status', async () => {
    const res = apiError('Not found', 404)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('includes details when provided', async () => {
    const res = apiError('Validation failed', 400, 'field "name" is required')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBe('field "name" is required')
  })

  it('omits details when not provided', async () => {
    const res = apiError('Fail', 500)
    const body = await res.json()
    expect(body.details).toBeUndefined()
  })
})

describe('getErrorMessage', () => {
  it('extracts message from Error objects', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns string errors as-is', () => {
    expect(getErrorMessage('string error')).toBe('string error')
  })

  it('returns default message for unknown types', () => {
    expect(getErrorMessage(42)).toBe('Internal server error')
    expect(getErrorMessage(null)).toBe('Internal server error')
    expect(getErrorMessage(undefined)).toBe('Internal server error')
    expect(getErrorMessage({ foo: 'bar' })).toBe('Internal server error')
  })
})

describe('withErrorHandler', () => {
  it('passes through successful responses', async () => {
    const handler = withErrorHandler(async () => {
      return apiSuccess({ ok: true })
    })

    const req = new Request('http://localhost/api/test')
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('catches errors and returns 500', async () => {
    const { logger } = await import('@/lib/logger')
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    const handler = withErrorHandler(async () => {
      throw new Error('handler exploded')
    })

    const req = new Request('http://localhost/api/test')
    const res = await handler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('handler exploded')

    logSpy.mockRestore()
  })

  it('calls logger.error with label context', async () => {
    const { logger } = await import('@/lib/logger')
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    const handler = withErrorHandler(async () => {
      throw new Error('fail')
    }, 'MyRoute')

    const req = new Request('http://localhost/api/test')
    await handler(req)

    expect(logSpy).toHaveBeenCalledWith('Unhandled error', 'MyRoute', expect.objectContaining({ error: expect.any(Error) }))
    logSpy.mockRestore()
  })

  it('uses default API context when no label', async () => {
    const { logger } = await import('@/lib/logger')
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    const handler = withErrorHandler(async () => {
      throw new Error('fail')
    })

    const req = new Request('http://localhost/api/test')
    await handler(req)

    expect(logSpy).toHaveBeenCalledWith('Unhandled error', 'API', expect.objectContaining({ error: expect.any(Error) }))
    logSpy.mockRestore()
  })
})
