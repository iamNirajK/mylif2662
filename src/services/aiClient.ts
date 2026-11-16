import type {
  AIModelInfo,
  AIProviderId,
  AIProviderStatus,
  AssistantToolStep,
  ChatMessage,
  GroundingSource,
  Language,
} from "../types.ts";

export interface SendMessageOptions {
  prompt: string;
  history?: ChatMessage[];
  provider?: AIProviderId;
  model?: string;
  enableThinking?: boolean;
  enableSearch?: boolean;
  enableMaps?: boolean;
  language?: Language;
  signal?: AbortSignal;
}

export interface ChatResponsePayload {
  reply: string;
  groundingSources: GroundingSource[];
  modelUsed: string;
  providerUsed: AIProviderId;
  thinkingUsed: boolean;
}

export async function fetchAIProviderStatus(): Promise<AIProviderStatus> {
  const res = await fetch("/api/ai/status");
  if (!res.ok) {
    throw new Error("Failed to fetch AI provider status.");
  }
  return await res.json();
}

export async function fetchAvailableModels(
  provider?: AIProviderId,
  refresh = false,
  freeOnly = true
): Promise<{ models: AIModelInfo[]; status: AIProviderStatus }> {
  const params = new URLSearchParams();
  if (provider) params.set("provider", provider);
  if (refresh) params.set("refresh", "true");
  if (freeOnly) params.set("freeOnly", "true");
  const res = await fetch(`/api/ai/models?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Failed to fetch available AI models.");
  }
  return await res.json();
}

async function resolveUserLocation(enableMaps?: boolean): Promise<{ latitude: number; longitude: number } | null> {
  if (!enableMaps || typeof navigator === "undefined" || !navigator.geolocation) {
    return null;
  }
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 4000,
        maximumAge: 60000,
      });
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return null;
  }
}

export async function sendChatMessageStream(
  options: SendMessageOptions,
  onDelta: (partialText: string, groundingSources?: GroundingSource[]) => void,
  onStatus?: (status: { step: AssistantToolStep; labelEn: string; labelHi: string }) => void
): Promise<ChatResponsePayload> {
  const userLocation = await resolveUserLocation(options.enableMaps);

  const messages = (options.history || [])
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      prompt: options.prompt,
      messages,
      provider: options.provider || "openrouter",
      model: options.model,
      enableThinking: options.enableThinking ?? false,
      enableSearch: options.enableSearch ?? false,
      enableMaps: options.enableMaps ?? false,
      userLocation,
      language: options.language ?? "en",
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Request failed with status ${res.status}`);
  }

  if (!res.body) {
    return await sendChatMessage(options);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulatedText = "";
  let finalPayload: ChatResponsePayload | null = null;
  let currentSources: GroundingSource[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const block of events) {
      const lines = block.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (parsed.type === "status" && parsed.step) {
          onStatus?.({
            step: parsed.step,
            labelEn: parsed.labelEn || "Processing...",
            labelHi: parsed.labelHi || "प्रोसेस कर रही हूँ...",
          });
        } else if (parsed.type === "token" && typeof parsed.token === "string") {
          accumulatedText += parsed.token;
          onDelta(accumulatedText, currentSources);
        } else if (parsed.type === "grounding" && Array.isArray(parsed.groundingSources)) {
          currentSources = parsed.groundingSources;
          onDelta(accumulatedText, currentSources);
        } else if (parsed.type === "error") {
          throw new Error(parsed.error || "Streaming response failed.");
        } else if (parsed.type === "done") {
          finalPayload = {
            reply: parsed.reply || accumulatedText,
            groundingSources: parsed.groundingSources || currentSources,
            modelUsed: parsed.modelUsed || options.model || "openrouter/free",
            providerUsed: parsed.providerUsed || options.provider || "openrouter",
            thinkingUsed: Boolean(parsed.thinkingUsed),
          };
        }
      }
    }
  }

  if (!finalPayload) {
    return {
      reply: accumulatedText || "No response received from AI provider.",
      groundingSources: currentSources,
      modelUsed: options.model || "openrouter/free",
      providerUsed: options.provider || "openrouter",
      thinkingUsed: Boolean(options.enableThinking),
    };
  }

  return finalPayload;
}

export async function sendChatMessage(options: SendMessageOptions): Promise<ChatResponsePayload> {
  const userLocation = await resolveUserLocation(options.enableMaps);

  const messages = (options.history || [])
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      prompt: options.prompt,
      messages,
      provider: options.provider || "openrouter",
      model: options.model,
      enableThinking: options.enableThinking ?? false,
      enableSearch: options.enableSearch ?? false,
      enableMaps: options.enableMaps ?? false,
      userLocation,
      language: options.language ?? "en",
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Request failed with status ${res.status}`);
  }

  return await res.json();
}

export async function analyzeFileWithAI(params: {
  fileBase64: string;
  mimeType: string;
  fileName: string;
  prompt?: string;
  language?: Language;
  provider?: AIProviderId;
  model?: string;
}): Promise<{ analysis: string; modelUsed: string; providerUsed?: AIProviderId }> {
  const res = await fetch("/api/analyze-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64: params.fileBase64,
      mimeType: params.mimeType,
      fileName: params.fileName,
      prompt: params.prompt,
      language: params.language || "en",
      provider: params.provider || "openrouter",
      model: params.model,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || "Failed to analyze document");
  }

  return await res.json();
}
