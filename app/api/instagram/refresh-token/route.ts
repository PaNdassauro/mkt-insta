import { NextResponse } from 'next/server'
import { getAccessToken, refreshLongLivedToken } from '@/lib/meta-client'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentToken = await getAccessToken()
    const { token, expiresAt } = await refreshLongLivedToken(currentToken)

    return NextResponse.json({
      success: true,
      expires_at: expiresAt.toISOString(),
      token_preview: `${token.slice(0, 10)}...`,
    })
  } catch (err) {
    console.error('[DashIG Refresh Token] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
