import { describe, it, expect, vi } from 'vitest'
import { getUserRole, requireRole } from '@/lib/roles'

function createMockSupabase(returnData: unknown, returnError: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: returnData, error: returnError }),
        }),
      }),
    }),
  } as any
}

describe('getUserRole', () => {
  it('returns "viewer" when no role exists (error)', async () => {
    const supabase = createMockSupabase(null, { message: 'not found' })
    const role = await getUserRole(supabase, 'user-1')
    expect(role).toBe('viewer')
  })

  it('returns "viewer" when data is null', async () => {
    const supabase = createMockSupabase(null)
    const role = await getUserRole(supabase, 'user-1')
    expect(role).toBe('viewer')
  })

  it('returns stored role "admin"', async () => {
    const supabase = createMockSupabase({ role: 'admin' })
    const role = await getUserRole(supabase, 'user-1')
    expect(role).toBe('admin')
  })

  it('returns stored role "editor"', async () => {
    const supabase = createMockSupabase({ role: 'editor' })
    const role = await getUserRole(supabase, 'user-1')
    expect(role).toBe('editor')
  })
})

describe('requireRole', () => {
  it('returns true when user has sufficient role (admin >= editor)', async () => {
    const supabase = createMockSupabase({ role: 'admin' })
    const result = await requireRole(supabase, 'user-1', 'editor')
    expect(result).toBe(true)
  })

  it('returns false when user has insufficient role (viewer < editor)', async () => {
    const supabase = createMockSupabase({ role: 'viewer' })
    const result = await requireRole(supabase, 'user-1', 'editor')
    expect(result).toBe(false)
  })

  it('returns true when user role equals minimum required role', async () => {
    const supabase = createMockSupabase({ role: 'editor' })
    const result = await requireRole(supabase, 'user-1', 'editor')
    expect(result).toBe(true)
  })

  it('role hierarchy: admin > editor > viewer', async () => {
    const adminSupa = createMockSupabase({ role: 'admin' })
    const editorSupa = createMockSupabase({ role: 'editor' })
    const viewerSupa = createMockSupabase({ role: 'viewer' })

    // admin can do everything
    expect(await requireRole(adminSupa, 'u', 'admin')).toBe(true)
    expect(await requireRole(adminSupa, 'u', 'editor')).toBe(true)
    expect(await requireRole(adminSupa, 'u', 'viewer')).toBe(true)

    // editor cannot admin
    expect(await requireRole(editorSupa, 'u', 'admin')).toBe(false)
    expect(await requireRole(editorSupa, 'u', 'editor')).toBe(true)
    expect(await requireRole(editorSupa, 'u', 'viewer')).toBe(true)

    // viewer can only view
    expect(await requireRole(viewerSupa, 'u', 'admin')).toBe(false)
    expect(await requireRole(viewerSupa, 'u', 'editor')).toBe(false)
    expect(await requireRole(viewerSupa, 'u', 'viewer')).toBe(true)
  })

  it('defaults to viewer (insufficient) when no role found', async () => {
    const supabase = createMockSupabase(null, { message: 'not found' })
    expect(await requireRole(supabase, 'user-1', 'editor')).toBe(false)
    expect(await requireRole(supabase, 'user-1', 'viewer')).toBe(true)
  })
})
