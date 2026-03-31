'use client'

import { useState, useEffect, useCallback } from 'react'

export interface InstagramAccount {
  id: string
  ig_user_id: string
  username: string | null
  label: string
  is_active: boolean
  token_expires_at: string | null
  created_at: string
  updated_at: string | null
}

const STORAGE_KEY = 'dashig_current_account'

function getStoredAccountId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeAccountId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // localStorage may be unavailable
  }
}

export function useCurrentAccount() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([])
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/accounts')
      if (!res.ok) return

      const data = (await res.json()) as InstagramAccount[]
      setAccounts(data)

      const activeAccounts = data.filter((a) => a.is_active)
      const storedId = getStoredAccountId()

      // If stored ID matches an active account, use it
      if (storedId && activeAccounts.some((a) => a.id === storedId)) {
        setCurrentAccountId(storedId)
      } else if (activeAccounts.length > 0) {
        // Default to first active account
        const firstId = activeAccounts[0].id
        setCurrentAccountId(firstId)
        storeAccountId(firstId)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const setCurrentAccount = useCallback(
    (id: string) => {
      setCurrentAccountId(id)
      storeAccountId(id)
    },
    []
  )

  const currentAccount = accounts.find((a) => a.id === currentAccountId) ?? null

  return {
    accounts,
    currentAccount,
    currentAccountId,
    setCurrentAccount,
    loading,
    refetch: fetchAccounts,
  }
}
