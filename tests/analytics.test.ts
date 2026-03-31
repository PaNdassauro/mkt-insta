import { describe, it, expect } from 'vitest'
import {
  extractHashtags,
  calcEngagementRate,
  calcQEI,
  calcContentScore,
  calcMeanAndStdDev,
  formatNumber,
  formatPercent,
  calcCompletionRate,
} from '@/lib/analytics'

describe('extractHashtags', () => {
  it('extracts hashtags from a normal caption', () => {
    const result = extractHashtags('Beautiful day #beach #sunset #travel')
    expect(result).toEqual(['beach', 'sunset', 'travel'])
  })

  it('returns empty array for null caption', () => {
    expect(extractHashtags(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(extractHashtags('')).toEqual([])
  })

  it('handles accented characters', () => {
    const result = extractHashtags('#férias #São_Paulo #açaí')
    expect(result).toEqual(['férias', 'são_paulo', 'açaí'])
  })

  it('returns empty array when no hashtags present', () => {
    expect(extractHashtags('Just a regular caption without hashtags')).toEqual([])
  })

  it('lowercases all hashtags', () => {
    const result = extractHashtags('#BEACH #Travel #SUNSET')
    expect(result).toEqual(['beach', 'travel', 'sunset'])
  })
})

describe('calcEngagementRate', () => {
  it('calculates engagement rate correctly', () => {
    // (10+5+3+2) / 1000 * 100 = 2.0
    const rate = calcEngagementRate(10, 5, 3, 2, 1000)
    expect(rate).toBe(2.0)
  })

  it('returns 0 when reach is zero', () => {
    expect(calcEngagementRate(10, 5, 3, 2, 0)).toBe(0)
  })

  it('handles all-zero metrics', () => {
    expect(calcEngagementRate(0, 0, 0, 0, 1000)).toBe(0)
  })
})

describe('calcQEI', () => {
  it('calculates QEI with weighted values', () => {
    // likes*1 + comments*2 + saves*4 + shares*5
    // 100*1 + 50*2 + 30*4 + 20*5 = 100 + 100 + 120 + 100 = 420
    // (420 / 1000) * 100 = 42
    const qei = calcQEI(100, 50, 30, 20, 1000)
    expect(qei).toBe(42)
  })

  it('returns 0 when reach is zero', () => {
    expect(calcQEI(100, 50, 30, 20, 0)).toBe(0)
  })

  it('weights saves and shares more heavily', () => {
    // Only saves: 10*4 = 40, (40/100)*100 = 40
    const savesOnly = calcQEI(0, 0, 10, 0, 100)
    // Only likes: 10*1 = 10, (10/100)*100 = 10
    const likesOnly = calcQEI(10, 0, 0, 0, 100)
    expect(savesOnly).toBeGreaterThan(likesOnly)
  })
})

describe('calcMeanAndStdDev', () => {
  it('calculates mean and stdDev correctly', () => {
    const { mean, stdDev } = calcMeanAndStdDev([2, 4, 4, 4, 5, 5, 7, 9])
    expect(mean).toBe(5)
    expect(stdDev).toBeCloseTo(2, 0)
  })

  it('returns zeros for empty array', () => {
    const { mean, stdDev } = calcMeanAndStdDev([])
    expect(mean).toBe(0)
    expect(stdDev).toBe(0)
  })

  it('returns zero stdDev for single element', () => {
    const { mean, stdDev } = calcMeanAndStdDev([42])
    expect(mean).toBe(42)
    expect(stdDev).toBe(0)
  })
})

describe('calcContentScore', () => {
  // mean = 5, stdDev = 2
  // VIRAL: >= 7, GOOD: >= 5, AVERAGE: >= 3, WEAK: < 3
  const mean = 5
  const stdDev = 2

  it('returns VIRAL for engagement above mean + stdDev', () => {
    expect(calcContentScore(7, mean, stdDev)).toBe('VIRAL')
    expect(calcContentScore(10, mean, stdDev)).toBe('VIRAL')
  })

  it('returns GOOD for engagement at or above mean', () => {
    expect(calcContentScore(5, mean, stdDev)).toBe('GOOD')
    expect(calcContentScore(6.9, mean, stdDev)).toBe('GOOD')
  })

  it('returns AVERAGE for engagement at or above mean - stdDev', () => {
    expect(calcContentScore(3, mean, stdDev)).toBe('AVERAGE')
    expect(calcContentScore(4, mean, stdDev)).toBe('AVERAGE')
  })

  it('returns WEAK for engagement below mean - stdDev', () => {
    expect(calcContentScore(2.9, mean, stdDev)).toBe('WEAK')
    expect(calcContentScore(0, mean, stdDev)).toBe('WEAK')
  })
})

describe('formatNumber', () => {
  it('formats numbers in Brazilian locale', () => {
    // pt-BR uses . for thousands separator
    const result = formatNumber(1234567)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('567')
  })

  it('formats small numbers without separator', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('formats percentage with decimal places', () => {
    const result = formatPercent(12.345)
    // Should contain "12,34" or "12,35" (pt-BR decimal comma) and %
    expect(result).toContain('%')
    expect(result).toContain('12')
  })

  it('formats zero percent', () => {
    const result = formatPercent(0)
    expect(result).toContain('0')
    expect(result).toContain('%')
  })
})

describe('calcCompletionRate', () => {
  it('calculates completion rate correctly', () => {
    // (15 / 30) * 100 = 50
    expect(calcCompletionRate(15, 30)).toBe(50)
  })

  it('returns null when avgWatchTime is null', () => {
    expect(calcCompletionRate(null, 30)).toBeNull()
  })

  it('returns null when duration is null', () => {
    expect(calcCompletionRate(15, null)).toBeNull()
  })

  it('returns null when duration is zero', () => {
    expect(calcCompletionRate(15, 0)).toBeNull()
  })

  it('can exceed 100% for replayed reels', () => {
    expect(calcCompletionRate(60, 30)).toBe(200)
  })
})
