/**
 * Wrapper de fetch que adiciona o header X-Account-Id automaticamente.
 * Usa o account_id do localStorage (mesmo que o hook useCurrentAccount).
 */
export function fetchWithAccount(url: string, options?: RequestInit): Promise<Response> {
  const accountId = typeof window !== 'undefined'
    ? localStorage.getItem('dashig_current_account')
    : null

  const headers = new Headers(options?.headers)
  if (accountId) {
    headers.set('X-Account-Id', accountId)
  }

  return fetch(url, { ...options, headers })
}
