import type { Aggregator, Model, AgentType } from '@ai-agg-agg/aaa-sdk'
import { httpGet, cacheSet, cacheGet, cacheStaleGet, isCacheFresh, resolveAuth, log } from '@ai-agg-agg/aaa-sdk'

const CACHE_KEY = 'provodai/models'

export class ProvodAIAggregator implements Aggregator {
  readonly name = 'provodai'
  readonly apiBase: string

  constructor() {
    this.apiBase = process.env.PROVODAI_API_BASE ?? 'https://api.provod.ai/v1'
  }

  async auth(): Promise<string> {
    return resolveAuth(this.name, 'PROVODAI_API_KEY', `${Bun.env.HOME ?? '~'}/.authinfo.gpg`)
  }

  async fetchModels(): Promise<Model[]> {
    if (await isCacheFresh(CACHE_KEY)) {
      const cached = await cacheGet(CACHE_KEY)
      if (cached) return JSON.parse(cached) as Model[]
    }

    const token = await this.auth()
    try {
      const body = await httpGet(
        `${this.apiBase}/models`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const raw = JSON.parse(body)
      const items = (raw.data ?? raw) as Array<Record<string, unknown>>

      const models: Model[] = items.map((item) => {
        const id = item.id as string
        // Try custom pricing fields (some OpenAI-compatible gateways include them)
        const pricing = item.pricing as Record<string, string | number> | undefined
        const promptPrice = pricing?.prompt ?? pricing?.input ?? pricing?.prompt_per_million ?? 0
        const completionPrice = pricing?.completion ?? pricing?.output ?? pricing?.completion_per_million ?? 0

        return {
          id,
          providers: [],
          top_provider: {
            name: inferProvider(id),
            context_length: (item.context_length ?? 0) as number,
            max_completion_tokens: (item.max_completion_tokens ?? 0) as number,
            pricing: {
              prompt_per_million: parseFloat(String(promptPrice)),
              completion_per_million: parseFloat(String(completionPrice)),
              currency: 'RUB',
            },
          },
          _aggregator: 'provod.ai',
        }
      })

      await cacheSet(CACHE_KEY, JSON.stringify(models))
      return models
    } catch {
      const stale = await cacheStaleGet(CACHE_KEY)
      if (stale) return JSON.parse(stale) as Model[]
      throw new Error('Failed to fetch provod.ai models')
    }
  }

  async getBalance(): Promise<number> {
    try {
      const token = await this.auth()
      const body = await httpGet(
        `${this.apiBase}/balance`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return parseFloat(JSON.parse(body).amount)
    } catch {
      log.warn('provod.ai balance endpoint unavailable — check app.provod.ai')
      return 0
    }
  }

  async getUsage(): Promise<string> {
    return '0'
  }

  filterModels(models: Model[], agentType: AgentType): Model[] {
    if (agentType === 'any') return models
    const regex = agentType === 'claude' ? /claude|anthropic/i : /gpt|openai|o\d/i
    return models.filter(
      (m) => m.providers.some((p) => regex.test(p.name)) || regex.test(m.id),
    )
  }
}

function inferProvider(modelId: string): string {
  if (/claude|anthropic/i.test(modelId)) return 'anthropic'
  if (/gpt|openai|o\d/i.test(modelId)) return 'openai'
  if (/gemini/i.test(modelId)) return 'google'
  if (/deepseek/i.test(modelId)) return 'deepseek'
  if (/qwen/i.test(modelId)) return 'alibaba'
  if (/kimi/i.test(modelId)) return 'moonshot'
  if (/grok/i.test(modelId)) return 'xai'
  if (/glm/i.test(modelId)) return 'zhipu'
  if (/minimax/i.test(modelId)) return 'minimax'
  if (/mimo/i.test(modelId)) return 'xiaomi'
  if (/llama|meta/i.test(modelId)) return 'meta'
  if (/mistral/i.test(modelId)) return 'mistral'
  const parts = modelId.split('/')
  return parts.length > 1 ? (parts[0] ?? '?') : '?'
}
