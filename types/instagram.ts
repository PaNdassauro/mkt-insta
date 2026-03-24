// ==========================================
// DashIG — Tipos TypeScript
// ==========================================

// --- Enums / Union Types ---

export type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'

export type ContentScore = 'VIRAL' | 'GOOD' | 'AVERAGE' | 'WEAK'

export type ContentType = 'REEL' | 'CAROUSEL' | 'IMAGE' | 'STORY'

export type CalendarStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'CANCELLED'

// --- Database Entities ---

export interface AccountSnapshot {
  id: string
  date: string
  followers_count: number | null
  following_count: number | null
  media_count: number | null
  reach_7d: number | null
  impressions_7d: number | null
  profile_views: number | null
  website_clicks: number | null
  created_at: string
}

export interface InstagramPost {
  id: string
  media_id: string
  media_type: MediaType
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  timestamp: string | null
  likes: number
  comments: number
  saves: number
  shares: number
  reach: number
  impressions: number
  engagement_rate: number | null
  content_score: ContentScore | null
  hashtags: string[] | null
  synced_at: string
}

export interface InstagramReel {
  id: string
  media_id: string
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  timestamp: string | null
  views: number
  likes: number
  comments: number
  saves: number
  shares: number
  reach: number
  completion_rate: number | null
  avg_watch_time_sec: number | null
  duration_sec: number | null
  content_score: ContentScore | null
  hashtags: string[] | null
  synced_at: string
}

export interface InstagramStory {
  id: string
  media_id: string
  timestamp: string | null
  expires_at: string | null
  reach: number
  impressions: number
  exits: number
  replies: number
  taps_forward: number
  taps_back: number
  synced_at: string
}

export interface AudienceSnapshot {
  id: string
  week_start: string
  age_ranges: Record<string, number> | null
  gender: Record<string, number> | null
  top_cities: Array<{ city: string; pct: number }> | null
  top_countries: Array<{ country: string; pct: number }> | null
  active_hours: Record<string, number> | null
  active_days: Record<string, number> | null
  created_at: string
}

export interface Competitor {
  id: string
  username: string
  display_name: string | null
  added_at: string
}

export interface CompetitorSnapshot {
  id: string
  competitor_id: string
  date: string
  followers_count: number | null
  posts_last_30d: number | null
  reels_last_30d: number | null
  avg_likes_last_10: number | null
  avg_comments_last_10: number | null
  created_at: string
}

export interface EditorialEntry {
  id: string
  scheduled_for: string | null
  content_type: ContentType | null
  topic: string | null
  caption_draft: string | null
  hashtags_plan: string[] | null
  status: CalendarStatus
  published_media_id: string | null
  created_at: string
}

export interface AppConfig {
  key: string
  value: string
  updated_at: string
}

// --- Meta Graph API Response Types ---

export interface AccountInfo {
  followers_count: number
  following_count: number
  media_count: number
}

export interface AccountInsights {
  reach: number
  impressions: number
  profile_views: number
  website_clicks: number
}

export interface MediaItem {
  id: string
  media_type: MediaType
  media_product_type?: string
  caption?: string
  permalink?: string
  thumbnail_url?: string
  timestamp: string
}

export interface MediaInsights {
  reach: number
  impressions: number
  saved: number
  shares: number
  likes: number
  comments: number
  views?: number
  avg_watch_time?: number
}

export interface StoryItem {
  id: string
  timestamp: string
}

export interface StoryInsights {
  reach: number
  impressions: number
  exits: number
  replies: number
  taps_forward: number
  taps_back: number
}

export interface AudienceInsights {
  age_gender: Record<string, number>
  cities: Record<string, number>
  countries: Record<string, number>
  online_followers: Record<string, number>
}
