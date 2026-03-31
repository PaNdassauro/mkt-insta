import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'

describe('logActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('inserts correct data into activity_log', async () => {
    await logActivity({
      userId: 'u1',
      userEmail: 'test@example.com',
      action: 'login',
      entityType: 'session',
      entityId: 's1',
      details: { ip: '127.0.0.1' },
    })

    expect(mockFrom).toHaveBeenCalledWith('activity_log')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      user_email: 'test@example.com',
      action: 'login',
      entity_type: 'session',
      entity_id: 's1',
      details: { ip: '127.0.0.1' },
    })
  })

  it('handles missing optional fields by inserting null', async () => {
    await logActivity({ action: 'page_view' })

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: null,
      user_email: null,
      action: 'page_view',
      entity_type: null,
      entity_id: null,
      details: null,
    })
  })

  it('does not throw on Supabase error, logs warning instead', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'db down' } })

    await expect(logActivity({ action: 'test' })).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'Falha ao registrar atividade',
      'ActivityLog',
      expect.objectContaining({ action: 'test', error: 'db down' }),
    )
  })

  it('includes all fields when provided', async () => {
    const params = {
      userId: 'u2',
      userEmail: 'u2@ex.com',
      action: 'delete_post',
      entityType: 'post',
      entityId: 'p123',
      details: { reason: 'spam' },
    }

    await logActivity(params)

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'u2',
      user_email: 'u2@ex.com',
      action: 'delete_post',
      entity_type: 'post',
      entity_id: 'p123',
      details: { reason: 'spam' },
    })
  })

  it('calls supabase.from("activity_log").insert(...)', async () => {
    await logActivity({ action: 'any_action' })

    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('activity_log')
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('handles unexpected exceptions without throwing', async () => {
    mockInsert.mockRejectedValue(new Error('network failure'))

    await expect(logActivity({ action: 'crash' })).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'Erro inesperado ao registrar atividade',
      'ActivityLog',
      expect.objectContaining({ action: 'crash', error: 'network failure' }),
    )
  })
})
