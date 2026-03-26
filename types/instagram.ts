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
  campaign_id: string | null
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
  campaign_id: string | null
  synced_at: string
}

export interface InstagramStory {
  id: string
  media_id: string
  media_type: string | null
  media_url: string | null
  stored_media_url: string | null
  stored_video_url: string | null
  permalink: string | null
  timestamp: string | null
  expires_at: string | null
  reach: number
  impressions: number
  exits: number
  replies: number
  taps_forward: number
  taps_back: number
  navigation: number
  follows: number
  profile_visits: number
  shares: number
  total_interactions: number
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
  media_url: string | null
  carousel_urls: string[] | null
  published_at: string | null
  publish_error: string | null
  location_id: string | null
  user_tags: Array<{ username: string; x: number; y: number }> | null
  alt_text: string | null
  collaborators: string[] | null
  cover_url: string | null
  auto_publish: boolean
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
  media_type: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp: string
}

export interface StoryInsights {
  reach: number
  replies: number
  navigation: number
  follows: number
  profile_visits: number
  shares: number
  total_interactions: number
}

export interface AudienceInsights {
  age_gender: Record<string, number>
  cities: Record<string, number>
  countries: Record<string, number>
  online_followers: Record<string, number>
}

// ==========================================
// Campaign Studio — Types
// ==========================================

export type CampaignStatus = 'DRAFT' | 'GENERATING' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'ARCHIVED'

export type CampaignPostStatus = 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED'

export type PostFormat = 'REEL' | 'CAROUSEL' | 'IMAGE' | 'STORY'

export type DocumentSourceType = 'PDF' | 'WEBSITE' | 'MANUAL'

export interface KnowledgeDocument {
  id: string
  title: string
  source_type: DocumentSourceType
  source_url: string | null
  file_name: string | null
  description: string | null
  is_active: boolean
  chunk_count?: number
  indexed_at: string
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  token_count: number | null
  embedding: number[] | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, unknown> | null
  document_id: string
  similarity: number
}

export interface Campaign {
  id: string
  title: string
  status: CampaignStatus
  objective: string | null
  target_audience: string | null
  theme: string | null
  tone_notes: string | null
  duration_days: number | null
  start_date: string | null
  preferred_formats: PostFormat[] | null
  context_chunks_used: number | null
  model_used: string | null
  generation_time_ms: number | null
  generated_at: string | null
  campaign_summary: string | null
  strategic_rationale: string | null
  format_strategy: string | null
  timing_strategy: string | null
  expected_results: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CampaignReport {
  campaign: Campaign
  posts: CampaignPost[]
  linkedMedia: {
    posts: Array<{ media_id: string; likes: number; comments: number; saves: number; shares: number; reach: number; engagement_rate: number; content_score: string | null }>
    reels: Array<{ media_id: string; views: number; likes: number; comments: number; saves: number; shares: number; reach: number; content_score: string | null }>
  }
  totals: {
    reach: number
    likes: number
    comments: number
    saves: number
    shares: number
    engagement_rate_avg: number
    posts_count: number
    reels_count: number
  }
}

export interface CampaignPost {
  id: string
  campaign_id: string
  post_order: number
  format: PostFormat
  scheduled_for: string | null
  caption: string | null
  hashtags: string[] | null
  cta: string | null
  visual_brief: string | null
  reel_concept: string | null
  reel_duration: string | null
  audio_suggestion: string | null
  slides: Record<string, unknown>[] | null
  strategic_note: string | null
  caption_edited: string | null
  hashtags_edited: string[] | null
  visual_notes: string | null
  status: CampaignPostStatus
  analyst_notes: string | null
  calendar_entry_id: string | null
  created_at: string
  updated_at: string
}
