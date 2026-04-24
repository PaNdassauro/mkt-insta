import type { AdRow } from '@/lib/meta-ads-client'

export interface AdsetGroup {
  id: string
  name: string
  status: string | null
  ads: AdRow[]
  totals: { spend: number; impressions: number; adCount: number }
}

export interface CampaignGroup {
  id: string
  name: string
  status: string | null
  objective: string | null
  adsets: AdsetGroup[]
  totals: { spend: number; impressions: number; adCount: number; adsetCount: number }
}

const NO_CAMPAIGN = '__no_campaign__'
const NO_ADSET = '__no_adset__'

/**
 * Agrupa uma lista plana de anuncios por campanha > conjunto. Mantem a ordem
 * original dos anuncios dentro de cada conjunto (nao reordena — o chamador ja
 * passou a lista ordenada/filtrada). Anuncios sem campanha/conjunto caem em
 * buckets sinteticos para nao serem perdidos.
 *
 * Nao somamos reach no nivel de grupo — reach e unique users, nao e aditivo
 * entre conjuntos/campanhas. Apenas spend e impressions rolam.
 */
export function groupAds(ads: AdRow[]): CampaignGroup[] {
  const campaignMap = new Map<string, CampaignGroup>()

  for (const ad of ads) {
    const campaignId = ad.campaign?.id ?? NO_CAMPAIGN
    const adsetId = ad.adset?.id ?? NO_ADSET

    let campaign = campaignMap.get(campaignId)
    if (!campaign) {
      campaign = {
        id: campaignId,
        name: ad.campaign?.name ?? 'Sem campanha',
        status: ad.campaign?.status ?? null,
        objective: ad.campaign?.objective ?? null,
        adsets: [],
        totals: { spend: 0, impressions: 0, adCount: 0, adsetCount: 0 },
      }
      campaignMap.set(campaignId, campaign)
    }

    let adset = campaign.adsets.find((a) => a.id === adsetId)
    if (!adset) {
      adset = {
        id: adsetId,
        name: ad.adset?.name ?? 'Sem conjunto',
        status: ad.adset?.status ?? null,
        ads: [],
        totals: { spend: 0, impressions: 0, adCount: 0 },
      }
      campaign.adsets.push(adset)
      campaign.totals.adsetCount++
    }

    adset.ads.push(ad)
    adset.totals.spend += ad.insights.spend
    adset.totals.impressions += ad.insights.impressions
    adset.totals.adCount++

    campaign.totals.spend += ad.insights.spend
    campaign.totals.impressions += ad.insights.impressions
    campaign.totals.adCount++
  }

  return Array.from(campaignMap.values())
}

/**
 * Achata uma arvore de grupos para extrair apenas os anuncios, preservando
 * a ordem (campanha → conjunto → anuncio). Util para passar ao mesmo renderer
 * da view flat quando o chamador ja tem a arvore em maos.
 */
export function flattenGroups(groups: CampaignGroup[]): AdRow[] {
  const out: AdRow[] = []
  for (const c of groups) {
    for (const a of c.adsets) {
      for (const ad of a.ads) out.push(ad)
    }
  }
  return out
}
