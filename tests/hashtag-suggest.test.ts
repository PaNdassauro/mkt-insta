import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable Supabase mock
const postsResult: { data: any[]; error: any } = { data: [], error: null }
const reelsResult: { data: any[]; error: any } = { data: [], error: null }

const mockPostsGte = vi.fn(() => postsResult)
const mockPostsNot = vi.fn(() => ({ gte: mockPostsGte }))
const mockPostsSelect = vi.fn(() => ({ not: mockPostsNot }))

const mockReelsGte = vi.fn(() => reelsResult)
const mockReelsNot = vi.fn(() => ({ gte: mockReelsGte }))
const mockReelsSelect = vi.fn(() => ({ not: mockReelsNot }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'instagram_posts') {
    return { select: mockPostsSelect }
  }
  return { select: mockReelsSelect }
})

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/auth', () => ({
  validateDashboardRequest: () => null,
}))

import { GET } from '@/app/api/instagram/hashtags/suggest/route'

function makeRequest(caption = '') {
  return new Request(`http://localhost/api/instagram/hashtags/suggest?caption=${encodeURIComponent(caption)}`)
}

function makeMedia(hashtags: string[], reach: number, likes: number, comments = 0, saves = 0, shares = 0) {
  return { hashtags, reach, likes, comments, saves, shares }
}

beforeEach(() => {
  vi.clearAllMocks()
  postsResult.data = []
  postsResult.error = null
  reelsResult.data = []
  reelsResult.error = null

  mockPostsGte.mockReturnValue(postsResult)
  mockPostsNot.mockReturnValue({ gte: mockPostsGte })
  mockPostsSelect.mockReturnValue({ not: mockPostsNot })

  mockReelsGte.mockReturnValue(reelsResult)
  mockReelsNot.mockReturnValue({ gte: mockReelsGte })
  mockReelsSelect.mockReturnValue({ not: mockReelsNot })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'instagram_posts') {
      return { select: mockPostsSelect }
    }
    return { select: mockReelsSelect }
  })
})

describe('GET /api/instagram/hashtags/suggest', () => {
  it('queries both posts and reels tables', async () => {
    await GET(makeRequest())

    expect(mockFrom).toHaveBeenCalledWith('instagram_posts')
    expect(mockFrom).toHaveBeenCalledWith('instagram_reels')
  })

  it('returns empty suggestions for no data', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.suggestions).toEqual([])
  })

  it('ranks hashtags by impact score', async () => {
    postsResult.data = [
      // "beach" appears in 2 posts with high reach and engagement
      makeMedia(['beach'], 5000, 200, 50, 100, 50),
      makeMedia(['beach'], 4000, 150, 40, 80, 30),
      // "sunset" appears in 2 posts with lower metrics
      makeMedia(['sunset'], 1000, 20, 5, 5, 2),
      makeMedia(['sunset'], 800, 15, 3, 3, 1),
    ]

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.suggestions.length).toBeGreaterThanOrEqual(2)
    expect(body.suggestions[0].hashtag).toBe('beach')
    expect(body.suggestions[1].hashtag).toBe('sunset')
  })

  it('applies 2x boost for hashtags present in caption', async () => {
    postsResult.data = [
      // Both tags have identical stats (2 uses each)
      makeMedia(['beach'], 1000, 50, 10, 20, 10),
      makeMedia(['beach'], 1000, 50, 10, 20, 10),
      makeMedia(['sunset'], 1000, 50, 10, 20, 10),
      makeMedia(['sunset'], 1000, 50, 10, 20, 10),
    ]

    // Caption mentions #beach, so beach gets 2x boost
    const res = await GET(makeRequest('A lovely day at the #beach'))
    const body = await res.json()

    const beach = body.suggestions.find((s: any) => s.hashtag === 'beach')
    const sunset = body.suggestions.find((s: any) => s.hashtag === 'sunset')

    expect(beach.in_caption).toBe(true)
    expect(sunset.in_caption).toBe(false)
    expect(beach.impact).toBe(sunset.impact * 2)
  })

  it('filters out hashtags with fewer than 2 uses', async () => {
    postsResult.data = [
      // "beach" used only once - should be filtered
      makeMedia(['beach'], 5000, 200, 50, 100, 50),
      // "sunset" used twice - should appear
      makeMedia(['sunset'], 1000, 20, 5, 5, 2),
      makeMedia(['sunset'], 800, 15, 3, 3, 1),
    ]

    const res = await GET(makeRequest())
    const body = await res.json()

    const hashtags = body.suggestions.map((s: any) => s.hashtag)
    expect(hashtags).not.toContain('beach')
    expect(hashtags).toContain('sunset')
  })

  it('limits results to 15', async () => {
    // Create 20 distinct hashtags each used 2 times
    const media: any[] = []
    for (let i = 0; i < 20; i++) {
      const tag = `tag${i}`
      media.push(makeMedia([tag], 1000, 50, 10, 10, 10))
      media.push(makeMedia([tag], 1000, 50, 10, 10, 10))
    }
    postsResult.data = media

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.suggestions.length).toBeLessThanOrEqual(15)
  })

  it('combines posts and reels data', async () => {
    postsResult.data = [
      makeMedia(['travel'], 2000, 100, 20, 30, 10),
    ]
    reelsResult.data = [
      makeMedia(['travel'], 3000, 150, 30, 50, 20),
    ]

    const res = await GET(makeRequest())
    const body = await res.json()

    // "travel" should appear because 1 post + 1 reel = 2 uses
    const travel = body.suggestions.find((s: any) => s.hashtag === 'travel')
    expect(travel).toBeDefined()
    expect(travel.count).toBe(2)
  })

  it('handles null data gracefully', async () => {
    postsResult.data = null as any
    reelsResult.data = null as any

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.suggestions).toEqual([])
  })

  it('includes avg_reach and avg_engagement in results', async () => {
    postsResult.data = [
      makeMedia(['beach'], 2000, 100, 20, 30, 10),
      makeMedia(['beach'], 4000, 200, 40, 60, 20),
    ]

    const res = await GET(makeRequest())
    const body = await res.json()

    const beach = body.suggestions.find((s: any) => s.hashtag === 'beach')
    expect(beach.avg_reach).toBe(3000)
    expect(beach.avg_engagement).toBe(240) // (100+20+30+10 + 200+40+60+20) / 2
  })
})
