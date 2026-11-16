import type { AIModelInfo, AIProviderId, AIProviderStatus, GroundingSource } from "../types.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

// Curated fallback list of OpenRouter free models (used as priority ordering & if public catalog is unreachable)
export const RECOMMENDED_FREE_OPENROUTER_MODELS: AIModelInfo[] = [
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router (Auto Best Free Model)",
    provider: "openrouter",
    isFree: true,
    contextLength: 128000,
    supportsVision: true,
    supportsReasoning: true,
    description: "Automatically routes to the best available free model on OpenRouter.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Meta Llama 3.3 70B Instruct (Free)",
    provider: "openrouter",
    isFree: true,
    contextLength: 131072,
    supportsReasoning: true,
  },
  {
    id: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B IT (Free)",
    provider: "openrouter",
    isFree: true,
    contextLength: 96000,
    supportsVision: true,
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1 24B (Free)",
    provider: "openrouter",
    isFree: true,
    contextLength: 128000,
    supportsVision: true,
  },
  {
    id: "qwen/qwen3-32b:free",
    name: "Qwen 3 32B (Free)",
    provider: "openrouter",
    isFree: true,
    contextLength: 40960,
    supportsReasoning: true,
  },
  {
    id: "deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1 Reasoning (Free)",
    provider: "openrouter",
    isFree: true,
    contextLength: 65536,
    supportsReasoning: true,
  },
];

const OPENAI_CATALOG_MODELS: AIModelInfo[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini (OpenAI)",
    provider: "openai",
    isFree: false,
    contextLength: 128000,
    supportsVision: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o (OpenAI)",
    provider: "openai",
    isFree: false,
    contextLength: 128000,
    supportsVision: true,
  },
  {
    id: "o4-mini",
    name: "o4-mini Reasoning (OpenAI)",
    provider: "openai",
    isFree: false,
    contextLength: 200000,
    supportsReasoning: true,
  },
];

// 5-minute TTL cache for dynamically fetched OpenRouter models
let cachedOpenRouterModels: { models: AIModelInfo[]; fetchedAt: number } | null = null;
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

export function getProviderStatus(): AIProviderStatus {
  const openrouterConfigured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const customEndpointConfigured = Boolean(process.env.OPENAI_COMPATIBLE_BASE_URL?.trim());
  const customConfigured = Boolean(
    customEndpointConfigured && process.env.OPENAI_COMPATIBLE_API_KEY?.trim()
  );

  const serverSttConfigured = Boolean(
    process.env.STT_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
  const serverTtsConfigured = Boolean(
    process.env.TTS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
  const realtimeProviderConfigured = Boolean(
    process.env.VOICE_PROVIDER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );

  let activeVoiceEngine: AIProviderStatus["voice"]["activeVoiceEngine"] =
    "browser-hybrid-openrouter";
  if (realtimeProviderConfigured && process.env.VOICE_PROVIDER_API_KEY?.trim()) {
    activeVoiceEngine = "cloud-realtime";
  } else if (serverSttConfigured || serverTtsConfigured) {
    activeVoiceEngine = "cloud-stt-tts";
  }

  return {
    defaultProvider: "openrouter",
    providers: {
      openrouter: {
        configured: openrouterConfigured,
        label: "OpenRouter (Default)",
        endpoint: OPENROUTER_CHAT_URL,
      },
      openai: {
        configured: openaiConfigured,
        label: "OpenAI",
        endpoint: OPENAI_CHAT_URL,
      },
      custom: {
        configured: customConfigured,
        label: "Custom OpenAI-Compatible",
        endpointConfigured: customEndpointConfigured,
      },
    },
    voice: {
      serverSttConfigured,
      serverTtsConfigured,
      realtimeProviderConfigured,
      activeVoiceEngine,
    },
    tools: {
      timeToolReady: true,
      weatherApiConfigured: Boolean(process.env.WEATHERAPI_KEY?.trim()),
      internetSearchReady: true,
      distanceToolReady: true,
      defaultLocation: "Muzaffarpur, Bihar, India",
      defaultTimeZone: "Asia/Kolkata",
    },
  };
}

export async function fetchOpenRouterModels(forceRefresh = false): Promise<AIModelInfo[]> {
  if (
    !forceRefresh &&
    cachedOpenRouterModels &&
    Date.now() - cachedOpenRouterModels.fetchedAt < MODELS_CACHE_TTL_MS
  ) {
    return cachedOpenRouterModels.models;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.OPENROUTER_API_KEY?.trim()) {
      headers["Authorization"] = `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`;
    }

    const res = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`OpenRouter models API status ${res.status}`);
    }

    const data = (await res.json()) as { data?: any[] };
    const rawList = Array.isArray(data?.data) ? data.data : [];

    const mapped: AIModelInfo[] = rawList.map((m: any) => {
      const promptPrice = Number(m?.pricing?.prompt ?? 1);
      const completionPrice = Number(m?.pricing?.completion ?? 1);
      const isFree =
        m?.id === "openrouter/free" ||
        String(m?.id || "").endsWith(":free") ||
        (promptPrice === 0 && completionPrice === 0);

      const modality = String(m?.architecture?.modality || "");
      const supportsVision =
        modality.includes("image") ||
        (Array.isArray(m?.architecture?.input_modalities) &&
          m.architecture.input_modalities.includes("image"));

      const supportsReasoning =
        String(m?.id || "").includes("r1") ||
        String(m?.id || "").includes("thinking") ||
        String(m?.id || "").includes("qwen3") ||
        String(m?.id || "").includes("reasoning");

      return {
        id: String(m.id),
        name: String(m.name || m.id),
        provider: "openrouter" as const,
        isFree,
        contextLength: typeof m.context_length === "number" ? m.context_length : undefined,
        supportsVision,
        supportsReasoning,
      };
    });

    // Ensure openrouter/free router is available at the top if not present
    if (!mapped.some((m) => m.id === "openrouter/free")) {
      mapped.unshift(RECOMMENDED_FREE_OPENROUTER_MODELS[0]);
    }

    // Sort: openrouter/free first, then all other free models alphabetically, then paid models
    mapped.sort((a, b) => {
      if (a.id === "openrouter/free") return -1;
      if (b.id === "openrouter/free") return 1;
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    cachedOpenRouterModels = {
      models: mapped,
      fetchedAt: Date.now(),
    };
    return mapped;
  } catch (err: any) {
    console.info("[OpenRouter] Using recommended free models fallback catalog:", err?.message || err);
    return RECOMMENDED_FREE_OPENROUTER_MODELS;
  }
}

export async function getAvailableModels(
  provider?: AIProviderId,
  freeOnly = false
): Promise<AIModelInfo[]> {
  const status = getProviderStatus();
  const results: AIModelInfo[] = [];

  if (!provider || provider === "openrouter") {
    const orModels = await fetchOpenRouterModels();
    results.push(...(freeOnly ? orModels.filter((m) => m.isFree) : orModels));
  }

  // Only include OpenAI models when OPENAI_API_KEY is genuinely configured on server
  if ((!provider || provider === "openai") && status.providers.openai.configured) {
    results.push(...OPENAI_CATALOG_MODELS);
  }

  // Include custom OpenAI-compatible model if configured
  if ((!provider || provider === "custom") && status.providers.custom.configured) {
    const customModelId = process.env.OPENAI_COMPATIBLE_MODEL?.trim() || "default";
    results.push({
      id: customModelId,
      name: `${customModelId} (Custom OpenAI-Compatible)`,
      provider: "custom",
      isFree: false,
    });
  }

  return results;
}

export interface ChatCompletionParams {
  provider?: AIProviderId;
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: any }>;
  enableSearch?: boolean;
  enableReasoning?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}

function resolveProviderCredentials(provider: AIProviderId): {
  endpoint: string;
  apiKey: string;
  headers: Record<string, string>;
  providerName: string;
} {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw new Error(
        "OpenAI API key is not configured. Add OPENAI_API_KEY to your server environment secrets or switch to OpenRouter."
      );
    }
    return {
      endpoint: OPENAI_CHAT_URL,
      apiKey: key,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      providerName: "OpenAI",
    };
  }

  if (provider === "custom") {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim().replace(/\/+$/, "");
    const key = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
    if (!baseUrl || !key) {
      throw new Error(
        "Custom OpenAI-compatible provider is not configured. Set OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY on the server."
      );
    }
    return {
      endpoint: `${baseUrl}/chat/completions`,
      apiKey: key,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      providerName: "Custom OpenAI-Compatible",
    };
  }

  // Default: OpenRouter
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured in server environment variables. Please add your OpenRouter API key in Settings > Secrets."
    );
  }

  const appUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  return {
    endpoint: OPENROUTER_CHAT_URL,
    apiKey: key,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": appUrl,
      "X-Title": "JIYA - Personal AI Life Assistant",
    },
    providerName: "OpenRouter",
  };
}

function buildFallbackModelList(requestedModel: string | undefined, provider: AIProviderId, enableReasoning?: boolean): string[] {
  if (provider === "openai") {
    return [requestedModel || (enableReasoning ? "o4-mini" : "gpt-4o-mini")];
  }
  if (provider === "custom") {
    return [requestedModel || process.env.OPENAI_COMPATIBLE_MODEL?.trim() || "default"];
  }

  // OpenRouter: prefer requested model, then openrouter/free auto-router, then curated free models
  const list: string[] = [];
  if (requestedModel) list.push(requestedModel);
  if (enableReasoning && !requestedModel) {
    list.push("deepseek/deepseek-r1-0528:free", "qwen/qwen3-32b:free");
  }
  list.push(
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "mistralai/mistral-small-3.1-24b-instruct:free"
  );
  return Array.from(new Set(list));
}

function sanitizeProviderError(message: string): string {
  return String(message || "Unknown AI provider error.")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(sk-or-v1-[A-Za-z0-9_-]+|sk-or-[A-Za-z0-9_-]+|sk-proj-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED]");
}

function extractErrorMessage(rawText: string, status: number): string {
  let msg = `Provider returned HTTP ${status}`;
  try {
    const parsed = JSON.parse(rawText);
    const rawMsg = parsed?.error?.message || parsed?.message;
    if (rawMsg) msg = String(rawMsg);
  } catch {}

  const clean = sanitizeProviderError(msg);
  if (status === 429) {
    return `Rate limit reached (HTTP 429). Please wait a few seconds or switch to another OpenRouter free model.`;
  }
  if (status === 404 || /model.*not\s*found|invalid\s*model|no\s*endpoints/i.test(clean)) {
    return `Selected AI model is currently unavailable or invalid. Please switch to another free model.`;
  }
  return clean;
}

function extractGroundingFromChoice(messageObj: any): GroundingSource[] {
  const sources: GroundingSource[] = [];
  const annotations = messageObj?.annotations;
  if (Array.isArray(annotations)) {
    for (const ann of annotations) {
      const citation = ann?.url_citation || ann;
      if (citation?.url) {
        sources.push({
          title: citation.title || citation.url,
          url: citation.url,
          type: "web",
        });
      }
    }
  }
  return sources;
}

export async function createChatCompletion(params: ChatCompletionParams): Promise<{
  reply: string;
  modelUsed: string;
  providerUsed: AIProviderId;
  groundingSources: GroundingSource[];
}> {
  const provider: AIProviderId = params.provider || "openrouter";
  const creds = resolveProviderCredentials(provider);
  const candidates = buildFallbackModelList(params.model, provider, params.enableReasoning);

  let lastError = "Failed to generate response.";

  for (const modelId of candidates) {
    if (params.signal?.aborted) {
      throw new Error("Request aborted.");
    }

    const body: Record<string, any> = {
      model: modelId,
      messages: params.messages,
      stream: false,
    };

    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }

    // OpenRouter web search plugin when Search Grounding is enabled
    if (provider === "openrouter" && params.enableSearch) {
      body.plugins = [{ id: "web", max_results: 4 }];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const onExternalAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onExternalAbort);

    try {
      const res = await fetch(creds.endpoint, {
        method: "POST",
        headers: creds.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      params.signal?.removeEventListener("abort", onExternalAbort);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = extractErrorMessage(errText, res.status);
        if (res.status === 401) {
          throw new Error(`Invalid ${creds.providerName} API key. Please verify your server secret.`);
        }
        // Try fallback free model for transient/rate-limit/model-unavailable/credit statuses
        if (
          [400, 402, 404, 408, 429, 500, 502, 503, 504].includes(res.status) &&
          modelId !== candidates[candidates.length - 1]
        ) {
          console.info(`[AI Provider] ${modelId} unavailable (${res.status}), trying next free model...`);
          continue;
        }
        throw new Error(lastError);
      }

      const data = (await res.json()) as any;
      const choice = data?.choices?.[0];
      const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
      const groundingSources = extractGroundingFromChoice(choice?.message);

      if (!content.trim()) {
        lastError = "The AI model returned an empty response. Please try again or switch to another free model.";
        if (modelId !== candidates[candidates.length - 1]) {
          console.info(`[AI Provider] Empty response from ${modelId}, trying next free model...`);
          continue;
        }
        throw new Error(lastError);
      }

      return {
        reply: content,
        modelUsed: data?.model || modelId,
        providerUsed: provider,
        groundingSources,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      params.signal?.removeEventListener("abort", onExternalAbort);
      if (params.signal?.aborted) {
        throw new Error("Request aborted.");
      }
      lastError =
        err?.name === "AbortError"
          ? "Request to AI provider timed out. Please try again or select another model."
          : sanitizeProviderError(err?.message || "Network error contacting AI provider.");
      if (modelId === candidates[candidates.length - 1]) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(lastError);
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onGrounding?: (sources: GroundingSource[]) => void;
  onDone?: (info: { fullText: string; modelUsed: string; providerUsed: AIProviderId }) => void;
}

export async function streamChatCompletion(
  params: ChatCompletionParams,
  callbacks: StreamCallbacks
): Promise<{ fullText: string; modelUsed: string; providerUsed: AIProviderId; groundingSources: GroundingSource[] }> {
  const provider: AIProviderId = params.provider || "openrouter";
  const creds = resolveProviderCredentials(provider);
  const candidates = buildFallbackModelList(params.model, provider, params.enableReasoning);

  let lastError = "Streaming request failed.";

  for (const modelId of candidates) {
    if (params.signal?.aborted) {
      throw new Error("Request aborted.");
    }

    const body: Record<string, any> = {
      model: modelId,
      messages: params.messages,
      stream: true,
    };

    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }

    if (provider === "openrouter" && params.enableSearch) {
      body.plugins = [{ id: "web", max_results: 4 }];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const onExternalAbort = () => controller.abort();
    params.signal?.addEventListener("abort", onExternalAbort);

    try {
      const res = await fetch(creds.endpoint, {
        method: "POST",
        headers: creds.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        clearTimeout(timeoutId);
        params.signal?.removeEventListener("abort", onExternalAbort);
        const errText = await res.text().catch(() => "");
        lastError = extractErrorMessage(errText, res.status);
        if (res.status === 401) {
          throw new Error(`Invalid ${creds.providerName} API key. Please verify your server secret.`);
        }
        if (
          [400, 402, 404, 408, 429, 500, 502, 503, 504].includes(res.status) &&
          modelId !== candidates[candidates.length - 1]
        ) {
          console.info(`[AI Stream] ${modelId} unavailable (${res.status}), trying next free model...`);
          continue;
        }
        throw new Error(lastError);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullText = "";
      let resolvedModel = modelId;
      const allSources: GroundingSource[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data:")) continue;

          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]") {
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed?.model) resolvedModel = parsed.model;
            const delta = parsed?.choices?.[0]?.delta;
            const tokenText = delta?.content;
            if (typeof tokenText === "string" && tokenText.length > 0) {
              fullText += tokenText;
              callbacks.onToken(tokenText);
            }

            const msgAnnotations = parsed?.choices?.[0]?.delta?.annotations || parsed?.choices?.[0]?.message?.annotations;
            if (Array.isArray(msgAnnotations)) {
              const found = extractGroundingFromChoice({ annotations: msgAnnotations });
              for (const s of found) {
                if (!allSources.some((x) => x.url === s.url)) {
                  allSources.push(s);
                }
              }
              if (found.length > 0 && callbacks.onGrounding) {
                callbacks.onGrounding(allSources);
              }
            }
          } catch {
            // Partial JSON chunk ignored
          }
        }
      }

      clearTimeout(timeoutId);
      params.signal?.removeEventListener("abort", onExternalAbort);

      if (!fullText.trim()) {
        lastError = "The AI model returned an empty response. Please try again or switch to another free model.";
        if (modelId !== candidates[candidates.length - 1]) {
          console.info(`[AI Stream] Empty response from ${modelId}, trying next free model...`);
          continue;
        }
        throw new Error(lastError);
      }

      if (callbacks.onDone) {
        callbacks.onDone({
          fullText,
          modelUsed: resolvedModel,
          providerUsed: provider,
        });
      }

      return {
        fullText,
        modelUsed: resolvedModel,
        providerUsed: provider,
        groundingSources: allSources,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      params.signal?.removeEventListener("abort", onExternalAbort);

      if (params.signal?.aborted) {
        throw new Error("Request aborted.");
      }

      lastError =
        err?.name === "AbortError"
          ? "Streaming request timed out. Please try again or switch to another free model."
          : sanitizeProviderError(err?.message || "Streaming error contacting AI provider.");
      if (modelId === candidates[candidates.length - 1]) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(lastError);
}
