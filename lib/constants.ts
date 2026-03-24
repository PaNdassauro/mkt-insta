// ==========================================
// DashIG — Constantes
// ==========================================

export const META_API_BASE_URL = 'https://graph.facebook.com/v21.0'

export const ITEMS_PER_PAGE = 20

// Pesos do QEI (Qualitative Engagement Index)
export const QEI_WEIGHTS = {
  likes: 1,
  comments: 2,
  saves: 4,
  shares: 5,
} as const

// Cores dos tiers de Content Score
export const CONTENT_SCORE_COLORS = {
  VIRAL: { text: 'text-orange-500', bg: 'bg-orange-50' },
  GOOD: { text: 'text-green-600', bg: 'bg-green-50' },
  AVERAGE: { text: 'text-yellow-600', bg: 'bg-yellow-50' },
  WEAK: { text: 'text-red-500', bg: 'bg-red-50' },
} as const

// Labels dos tiers de Content Score
export const CONTENT_SCORE_LABELS = {
  VIRAL: 'Viral',
  GOOD: 'Bom',
  AVERAGE: 'Medio',
  WEAK: 'Fraco',
} as const

// Cores primarias para graficos (Recharts)
export const CHART_COLORS = {
  primary: '#4F46E5',   // indigo
  secondary: '#06B6D4', // cyan
} as const

// Formatadores pt-BR
export const numberFormatter = new Intl.NumberFormat('pt-BR')
export const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})
export const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

// Alerta de expiracao do token (dias)
export const TOKEN_EXPIRY_ALERT_DAYS = 15
