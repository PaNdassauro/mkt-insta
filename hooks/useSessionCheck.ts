'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

const CHECK_INTERVAL_MS = 60_000

export function useSessionCheck() {
  const router = useRouter()
  const redirectingRef = useRef(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    async function checkSession() {
      if (redirectingRef.current) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        redirectingRef.current = true
        toast.error('Sessao expirada — redirecionando para login')
        router.push('/login')
      }
    }

    // Check immediately, then on interval
    checkSession()
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [router])
}
