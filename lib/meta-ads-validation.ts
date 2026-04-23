import type {
  BoostObjective,
  BoostGender,
  BoostPlacement,
  BoostCta,
  BoostBudgetType,
  BoostAudience,
} from './meta-ads-client'

export const OBJECTIVES: BoostObjective[] = ['AWARENESS', 'TRAFFIC', 'ENGAGEMENT']
export const GENDERS: BoostGender[] = ['ALL', 'MALE', 'FEMALE']
export const PLACEMENTS: BoostPlacement[] = ['stream', 'story', 'explore', 'reels']
export const CTAS: BoostCta[] = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'CONTACT_US',
  'BOOK_TRAVEL',
  'GET_OFFER',
  'SEND_MESSAGE',
  'APPLY_NOW',
]
export const BUDGET_TYPES: BoostBudgetType[] = ['daily', 'lifetime']

export interface BoostConfigBody {
  dailyBudgetBRL?: number
  durationDays?: number
  launchImmediately?: boolean
  objective?: BoostObjective
  destinationUrl?: string
  cta?: BoostCta
  budgetType?: BoostBudgetType
  totalBudgetBRL?: number
  startDate?: string
  urlTags?: string
  // The validator enforces required keys on cities[].key, regions[].key, interests[].{id,name}.
  // Typing them as the strict BoostAudience shape avoids casts downstream; validator rejects malformed input.
  audience?: BoostAudience
}

/**
 * Valida o payload de configuração de boost. Retorna mensagem de erro (string)
 * ou null se válido. Uma única fonte de verdade usada por /posts/[id]/boost e
 * /calendar/[id]/publish-boost.
 */
export function validateBoostConfig(body: BoostConfigBody): string | null {
  const budgetType: BoostBudgetType = body.budgetType ?? 'daily'
  if (!BUDGET_TYPES.includes(budgetType)) {
    return `budgetType deve ser um de: ${BUDGET_TYPES.join(', ')}`
  }

  if (budgetType === 'daily') {
    const d = Number(body.dailyBudgetBRL)
    if (!Number.isFinite(d) || d < 6) {
      return 'Orcamento diario deve ser >= R$ 6,00'
    }
  } else {
    const t = Number(body.totalBudgetBRL)
    if (!Number.isFinite(t) || t < 6) {
      return 'Orcamento total deve ser >= R$ 6,00'
    }
  }

  const durationDays = Number(body.durationDays)
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
    return 'Duracao deve ser um inteiro entre 1 e 30 dias'
  }

  if (body.objective !== undefined && !OBJECTIVES.includes(body.objective)) {
    return `objective deve ser um de: ${OBJECTIVES.join(', ')}`
  }
  if (body.cta !== undefined && !CTAS.includes(body.cta)) {
    return `cta deve ser um de: ${CTAS.join(', ')}`
  }

  if (body.startDate) {
    const ts = Date.parse(body.startDate)
    if (!Number.isFinite(ts)) return 'startDate invalido (use ISO: YYYY-MM-DD ou data+hora)'
  }

  if (body.urlTags !== undefined) {
    if (typeof body.urlTags !== 'string' || body.urlTags.length > 1000) {
      return 'urlTags invalido'
    }
  }

  const audience = body.audience
  if (audience) {
    if (audience.gender !== undefined && !GENDERS.includes(audience.gender)) {
      return `gender deve ser um de: ${GENDERS.join(', ')}`
    }
    if (audience.placements !== undefined) {
      if (!Array.isArray(audience.placements) || audience.placements.length === 0) {
        return 'placements deve ter ao menos 1 posicionamento'
      }
      for (const p of audience.placements) {
        if (!PLACEMENTS.includes(p)) return `placement invalido: ${p}`
      }
    }
    if (audience.countries !== undefined) {
      if (!Array.isArray(audience.countries)) return 'countries deve ser array'
      for (const c of audience.countries) {
        if (typeof c !== 'string' || !/^[A-Z]{2}$/.test(c)) {
          return `country invalido: ${c} (use ISO-2, ex: BR, US)`
        }
      }
    }
    if (audience.cities !== undefined) {
      if (!Array.isArray(audience.cities)) return 'cities deve ser array'
      for (const c of audience.cities) {
        if (!c || typeof c.key !== 'string' || !c.key) return 'city sem key'
        if (c.radiusKm !== undefined && (typeof c.radiusKm !== 'number' || c.radiusKm < 1 || c.radiusKm > 80)) {
          return 'radiusKm deve estar entre 1 e 80'
        }
      }
    }
    if (audience.regions !== undefined) {
      if (!Array.isArray(audience.regions)) return 'regions deve ser array'
      for (const r of audience.regions) {
        if (!r || typeof r.key !== 'string' || !r.key) return 'region sem key'
      }
    }
    if (audience.ageMin !== undefined || audience.ageMax !== undefined) {
      const min = audience.ageMin ?? 18
      const max = audience.ageMax ?? 65
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 13 || max > 65 || min > max) {
        return 'ageMin/ageMax invalidos (13-65, min <= max)'
      }
    }
    if (audience.interests !== undefined) {
      if (!Array.isArray(audience.interests)) return 'interests deve ser array'
      for (const i of audience.interests) {
        if (!i || typeof i.id !== 'string' || !i.id) return 'interest sem id'
        if (typeof i.name !== 'string' || !i.name) return 'interest sem name'
      }
    }
  }

  return null
}
