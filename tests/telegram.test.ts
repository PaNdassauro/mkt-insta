import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot-token')
  vi.stubEnv('TELEGRAM_CHAT_ID', '123456')
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({ ok: true })
  // Reset modules so each test gets a fresh import with current env vars
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendTelegramMessage', () => {
  it('sends correct payload to Telegram API', async () => {
    const { sendTelegramMessage } = await import('@/lib/telegram')
    await sendTelegramMessage('Hello world')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bottest-bot-token/sendMessage')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(options.body)
    expect(body.chat_id).toBe('123456')
    expect(body.text).toBe('Hello world')
    expect(body.parse_mode).toBe('HTML')
    expect(body.disable_web_page_preview).toBe(true)
  })

  it('respects custom parse_mode', async () => {
    const { sendTelegramMessage } = await import('@/lib/telegram')
    await sendTelegramMessage('Hello', 'Markdown')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.parse_mode).toBe('Markdown')
  })

  it('silently skips when env vars are not set', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    vi.stubEnv('TELEGRAM_CHAT_ID', '')
    vi.resetModules()
    const { sendTelegramMessage } = await import('@/lib/telegram')

    await sendTelegramMessage('Hello')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('logs warning on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Bad Request' })

    const { sendTelegramMessage } = await import('@/lib/telegram')
    const { logger } = await import('@/lib/logger')
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    await sendTelegramMessage('test')

    expect(warnSpy).toHaveBeenCalledWith('Failed to send message', 'Telegram', expect.objectContaining({ response: 'Bad Request' }))
    warnSpy.mockRestore()
  })

  it('logs warning on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { sendTelegramMessage } = await import('@/lib/telegram')
    const { logger } = await import('@/lib/logger')
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    await sendTelegramMessage('test')

    expect(warnSpy).toHaveBeenCalledWith('Error sending message', 'Telegram', expect.objectContaining({ error: expect.any(Error) }))
    warnSpy.mockRestore()
  })
})

describe('alertTokenExpiring', () => {
  it('sends formatted token expiry message', async () => {
    const { alertTokenExpiring } = await import('@/lib/telegram')
    await alertTokenExpiring(5)

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('Token Expirando')
    expect(body.text).toContain('5 dias')
  })
})

describe('alertCampaignApproved', () => {
  it('sends formatted campaign approved message', async () => {
    const { alertCampaignApproved } = await import('@/lib/telegram')
    await alertCampaignApproved('Summer Vibes', 3)

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('Campanha Aprovada')
    expect(body.text).toContain('Summer Vibes')
    expect(body.text).toContain('3 post(s)')
  })
})

describe('alertEngagementAnomaly', () => {
  it('sends drop message with correct icon and label', async () => {
    const { alertEngagementAnomaly } = await import('@/lib/telegram')
    await alertEngagementAnomaly('drop', 'Reach', 500, 1000)

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('📉')
    expect(body.text).toContain('Queda')
    expect(body.text).toContain('Reach')
    expect(body.text).toContain('50%')
  })

  it('sends spike message with correct icon and label', async () => {
    const { alertEngagementAnomaly } = await import('@/lib/telegram')
    await alertEngagementAnomaly('spike', 'Engagement', 2000, 1000)

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('📈')
    expect(body.text).toContain('Pico')
    expect(body.text).toContain('Engagement')
    expect(body.text).toContain('100%')
  })
})

describe('alertSyncCompleted', () => {
  it('sends sync completed message with post and reel counts', async () => {
    const { alertSyncCompleted } = await import('@/lib/telegram')
    await alertSyncCompleted(10, 5)

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('Sync Concluido')
    expect(body.text).toContain('Posts: 10')
    expect(body.text).toContain('Reels: 5')
  })
})
