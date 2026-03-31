'use client'

import { useState, useEffect, useCallback } from 'react'

interface BadgesResponse {
  comments_unreplied: number
  campaigns_review: number
  messages_unread: number
  token_expiring: boolean
}

interface NotificationBadges {
  comments: number
  campaigns: number
  messages: number
  tokenExpiring: boolean
  loading: boolean
}

const POLL_INTERVAL_MS = 60_000

export function useNotificationBadges(): NotificationBadges {
  const [badges, setBadges] = useState<NotificationBadges>({
    comments: 0,
    campaigns: 0,
    messages: 0,
    tokenExpiring: false,
    loading: true,
  })

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/badges')
      if (!res.ok) return

      const json = await res.json() as BadgesResponse
      setBadges({
        comments: json.comments_unreplied,
        campaigns: json.campaigns_review,
        messages: json.messages_unread,
        tokenExpiring: json.token_expiring,
        loading: false,
      })
    } catch {
      // Silently fail — badges are non-critical
    }
  }, [])

  useEffect(() => {
    fetchBadges()

    const interval = setInterval(fetchBadges, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchBadges])

  return badges
}
