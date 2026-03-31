import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable Supabase mock
const mockData: { data: any[]; error: any } = { data: [], error: null }
const mockOrder = vi.fn(() => mockData)
const mockGte = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ gte: mockGte }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/auth', () => ({
  validateDashboardRequest: () => null,
}))

// Import after mock
import { GET } from '@/app/api/instagram/comments/sentiment/route'

beforeEach(() => {
  vi.clearAllMocks()
  mockData.data = []
  mockData.error = null
  mockOrder.mockReturnValue(mockData)
  mockGte.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ gte: mockGte })
  mockFrom.mockReturnValue({ select: mockSelect })
})

describe('GET /api/instagram/comments/sentiment', () => {
  it('queries instagram_comments table', async () => {
    await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    expect(mockFrom).toHaveBeenCalledWith('instagram_comments')
    expect(mockSelect).toHaveBeenCalledWith('sentiment, timestamp')
  })

  it('returns empty series and zero totals for no data', async () => {
    mockData.data = []

    const res = await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    const body = await res.json()

    expect(body.series).toEqual([])
    expect(body.totals).toEqual({ POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, QUESTION: 0 })
  })

  it('groups comments by week correctly', async () => {
    // Two comments in the same week (2026-03-23 is a Monday)
    mockData.data = [
      { sentiment: 'POSITIVE', timestamp: '2026-03-23T10:00:00Z' },
      { sentiment: 'POSITIVE', timestamp: '2026-03-24T10:00:00Z' },
      { sentiment: 'NEGATIVE', timestamp: '2026-03-24T15:00:00Z' },
    ]

    const res = await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    const body = await res.json()

    expect(body.series).toHaveLength(1)
    expect(body.series[0].POSITIVE).toBe(2)
    expect(body.series[0].NEGATIVE).toBe(1)
    expect(body.series[0].NEUTRAL).toBe(0)
  })

  it('calculates totals across all data', async () => {
    mockData.data = [
      { sentiment: 'POSITIVE', timestamp: '2026-03-23T10:00:00Z' },
      { sentiment: 'POSITIVE', timestamp: '2026-03-23T11:00:00Z' },
      { sentiment: 'NEGATIVE', timestamp: '2026-03-23T12:00:00Z' },
      { sentiment: 'NEUTRAL', timestamp: '2026-03-23T13:00:00Z' },
      { sentiment: 'QUESTION', timestamp: '2026-03-23T14:00:00Z' },
    ]

    const res = await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    const body = await res.json()

    expect(body.totals).toEqual({ POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 1, QUESTION: 1 })
  })

  it('defaults null sentiment to NEUTRAL', async () => {
    mockData.data = [
      { sentiment: null, timestamp: '2026-03-23T10:00:00Z' },
    ]

    const res = await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    const body = await res.json()

    expect(body.totals.NEUTRAL).toBe(1)
  })

  it('returns error when supabase fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockData.error = new Error('DB connection failed')
    mockOrder.mockReturnValue(mockData)

    const res = await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('DB connection failed')
    consoleSpy.mockRestore()
  })

  it('sorts series by week ascending', async () => {
    mockData.data = [
      { sentiment: 'POSITIVE', timestamp: '2026-03-30T10:00:00Z' },
      { sentiment: 'NEGATIVE', timestamp: '2026-03-16T10:00:00Z' },
    ]

    const res = await GET(new Request('http://localhost/api/instagram/comments/sentiment'))
    const body = await res.json()

    // Should be sorted by week key ascending
    if (body.series.length >= 2) {
      expect(body.series[0].week < body.series[1].week).toBe(true)
    }
  })
})
