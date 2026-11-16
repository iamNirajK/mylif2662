import type http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { getProviderStatus } from "./aiProviders.js";
import { streamUnifiedAssistantTurn } from "./assistantAgent.js";
import type { AIProviderId, Language } from "../types.js";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB limit

export function getVoiceCapabilities() {
  const status = getProviderStatus();
  return status.voice;
}

export async function transcribeAudioBuffer(params: {
  audioBuffer: Buffer;
  mimeType: string;
  language?: Language;
  signal?: AbortSignal;
}): Promise<{ text: string; engine: string }> {
  const sttKey =
    process.env.STT_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!sttKey) {
    throw new Error(
      "Server STT API key (STT_API_KEY or OPENAI_API_KEY) is not configured."
    );
  }

  if (!params.audioBuffer || params.audioBuffer.length === 0) {
    throw new Error("Audio buffer is empty.");
  }
  if (params.audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new Error("Audio payload exceeds 10 MB size limit.");
  }

  const baseUrl = (
    process.env.STT_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");

  const ext = params.mimeType.includes("wav")
    ? "wav"
    : params.mimeType.includes("mp4") || params.mimeType.includes("m4a")
    ? "m4a"
    : params.mimeType.includes("ogg")
    ? "ogg"
    : "webm";

  const form = new FormData();
  const uint8 = new Uint8Array(params.audioBuffer);
  const blob = new Blob([uint8], { type: params.mimeType || "audio/webm" });
  form.append("file", blob, `speech.${ext}`);
  form.append("model", process.env.STT_MODEL?.trim() || "whisper-1");
  if (params.language) {
    form.append("language", params.language === "hi" ? "hi" : "en");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const onAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sttKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", onAbort);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let msg = `STT service returned HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {}
      throw new Error(msg);
    }

    const data = (await res.json()) as { text?: string };
    return {
      text: (data?.text || "").trim(),
      engine: "cloud-whisper",
    };
  } catch (err: any) {
    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", onAbort);
    throw err;
  }
}

export async function synthesizeSpeechBuffer(params: {
  text: string;
  language?: Language;
  voice?: string;
  signal?: AbortSignal;
}): Promise<{ audioBase64: string; mimeType: string; engine: string } | null> {
  const ttsKey =
    process.env.TTS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!ttsKey) {
    return null;
  }

  const cleanText = params.text.replace(/[*_`#>\[\]]/g, "").trim();
  if (!cleanText) return null;

  const baseUrl = (
    process.env.TTS_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const onAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ttsKey}`,
      },
      body: JSON.stringify({
        model: process.env.TTS_MODEL?.trim() || "tts-1",
        input: cleanText.slice(0, 4000),
        voice: params.voice || "nova",
        response_format: "mp3",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", onAbort);

    if (!res.ok) {
      return null;
    }

    const arrBuf = await res.arrayBuffer();
    const audioBase64 = Buffer.from(arrBuf).toString("base64");
    return {
      audioBase64,
      mimeType: "audio/mpeg",
      engine: "cloud-tts",
    };
  } catch {
    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", onAbort);
    return null;
  }
}

interface VoiceSessionState {
  sessionId: string;
  provider: AIProviderId;
  model?: string;
  language: Language;
  voiceName: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  activeAbort: AbortController | null;
  utteranceTimestamps: number[];
}

function sendJson(ws: WebSocket, payload: Record<string, any>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function attachVoiceWebSocketServer(httpServer: http.Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 12 * 1024 * 1024 });

  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/ws/voice") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      }
    } catch {
      // Ignore malformed upgrade URLs
    }
  });

  wss.on("connection", (ws) => {
    const state: VoiceSessionState = {
      sessionId: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      provider: "openrouter",
      language: "en",
      voiceName: "nova",
      history: [],
      activeAbort: null,
      utteranceTimestamps: [],
    };

    const status = getProviderStatus();
    sendJson(ws, {
      type: "session:ready",
      sessionId: state.sessionId,
      status,
    });

    const abortActiveTurn = () => {
      if (state.activeAbort) {
        state.activeAbort.abort();
        state.activeAbort = null;
      }
    };

    ws.on("message", async (rawData) => {
      let msg: any;
      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        sendJson(ws, { type: "ai:error", error: "Invalid WebSocket JSON frame." });
        return;
      }

      if (msg.type === "ping") {
        sendJson(ws, { type: "pong", ts: Date.now() });
        return;
      }

      if (msg.type === "session:start") {
        state.provider = (msg.provider as AIProviderId) || "openrouter";
        state.model = typeof msg.model === "string" ? msg.model : undefined;
        state.language = msg.language === "hi" ? "hi" : "en";
        state.voiceName = typeof msg.voiceName === "string" ? msg.voiceName : "nova";
        if (Array.isArray(msg.history)) {
          state.history = msg.history
            .slice(-16)
            .map((h: any) => ({
              role: h.role === "user" ? ("user" as const) : ("assistant" as const),
              content: String(h.content || "").slice(0, 4000),
            }))
            .filter((h: any) => h.content.length > 0);
        }
        sendJson(ws, {
          type: "session:configured",
          sessionId: state.sessionId,
          status: getProviderStatus(),
        });
        return;
      }

      if (msg.type === "user:interrupt") {
        abortActiveTurn();
        sendJson(ws, { type: "ai:interrupted" });
        return;
      }

      if (msg.type === "session:stop") {
        abortActiveTurn();
        state.history = [];
        sendJson(ws, { type: "session:stopped" });
        return;
      }

      if (msg.type === "user:utterance") {
        // Rate limit per voice session: max 20 turns per minute
        const now = Date.now();
        state.utteranceTimestamps = state.utteranceTimestamps.filter((t) => now - t < 60000);
        if (state.utteranceTimestamps.length >= 20) {
          sendJson(ws, {
            type: "ai:error",
            error: "Voice session rate limit reached. Please pause briefly.",
          });
          return;
        }
        state.utteranceTimestamps.push(now);

        // Barge-in: immediately abort any previous turn
        abortActiveTurn();
        const abortController = new AbortController();
        state.activeAbort = abortController;

        const lang: Language =
          msg.language === "hi"
            ? "hi"
            : msg.language === "en"
            ? "en"
            : state.language;
        state.language = lang;
        if (msg.provider) state.provider = msg.provider;
        if (msg.model !== undefined) state.model = msg.model || undefined;

        try {
          let userText = typeof msg.text === "string" ? msg.text.trim() : "";

          // If raw audio was sent without browser transcript, try server STT adapter
          if (!userText && typeof msg.audioBase64 === "string" && msg.audioBase64.length > 0) {
            const audioBuf = Buffer.from(msg.audioBase64, "base64");
            const sttResult = await transcribeAudioBuffer({
              audioBuffer: audioBuf,
              mimeType: String(msg.mimeType || "audio/webm"),
              language: lang,
              signal: abortController.signal,
            });
            userText = sttResult.text;
            if (userText) {
              sendJson(ws, { type: "stt:transcript", text: userText, engine: sttResult.engine });
            }
          }

          if (!userText) {
            sendJson(ws, {
              type: "ai:error",
              error: "No speech detected in utterance.",
            });
            return;
          }

          sendJson(ws, { type: "ai:thinking", text: userText });

          let sentenceBuffer = "";
          let sentenceIndex = 0;

          const emitSentenceForSpeech = async (rawSentence: string) => {
            const cleanSentence = rawSentence
              .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
              .replace(/https?:\/\/\S+/g, "")
              .replace(/[*_`#\[\]]/g, "")
              .replace(/\(\s*\)/g, "")
              .replace(/\s+/g, " ")
              .trim();
            if (!cleanSentence || abortController.signal.aborted) return;

            const currentIndex = sentenceIndex++;
            const ttsAudio = await synthesizeSpeechBuffer({
              text: cleanSentence,
              language: lang,
              voice: state.voiceName,
              signal: abortController.signal,
            });

            if (abortController.signal.aborted) return;

            sendJson(ws, {
              type: "ai:sentence",
              index: currentIndex,
              text: cleanSentence,
              audioBase64: ttsAudio?.audioBase64 || null,
              mimeType: ttsAudio?.mimeType || null,
              engine: ttsAudio?.engine || "browser-tts",
            });
          };

          const ttsQueue: Promise<void>[] = [];

          // Execute unified agent turn (IDENTICAL backend tools: Time, WeatherAPI, Internet Search, Distance)
          const result = await streamUnifiedAssistantTurn(
            {
              prompt: userText,
              history: state.history,
              provider: state.provider,
              model: state.model,
              language: lang,
              mode: "voice",
              enableSearch: Boolean(msg.enableSearch),
              enableMaps: Boolean(msg.enableMaps),
              userLocation: msg.userLocation || null,
              signal: abortController.signal,
            },
            {
              onStatus: (step, labelEn, labelHi) => {
                sendJson(ws, { type: "ai:status", step, labelEn, labelHi });
              },
              onSlowTool: () => {
                const fillerText =
                  lang === "hi"
                    ? "एक सेकंड, मैं अभी लाइव जानकारी चेक कर रही हूँ।"
                    : "One second, I am checking the live information.";
                ttsQueue.push(emitSentenceForSpeech(fillerText));
              },
              onGrounding: (sources) => {
                sendJson(ws, { type: "ai:grounding", groundingSources: sources });
              },
              onToken: (token) => {
                if (abortController.signal.aborted) return;
                sendJson(ws, { type: "ai:token", token });
                sentenceBuffer += token;

                // Split on natural sentence endings (. ! ? । newline) when at least 18 chars
                const boundaryMatch = sentenceBuffer.match(/^([\s\S]{18,}?[.!?।\n])(\s+|$)([\s\S]*)$/);
                if (boundaryMatch) {
                  const readySentence = boundaryMatch[1];
                  sentenceBuffer = boundaryMatch[3] || "";
                  ttsQueue.push(emitSentenceForSpeech(readySentence));
                }
              },
            }
          );

          if (abortController.signal.aborted) {
            return;
          }

          if (sentenceBuffer.trim().length > 0) {
            const remaining = sentenceBuffer;
            sentenceBuffer = "";
            ttsQueue.push(emitSentenceForSpeech(remaining));
          }

          await Promise.allSettled(ttsQueue);

          if (abortController.signal.aborted) {
            return;
          }

          // Update conversation history on server
          state.history.push({ role: "user", content: userText });
          state.history.push({ role: "assistant", content: result.reply });
          if (state.history.length > 20) {
            state.history = state.history.slice(-20);
          }

          sendJson(ws, {
            type: "ai:done",
            fullText: result.reply,
            groundingSources: result.groundingSources,
            modelUsed: result.modelUsed,
            providerUsed: result.providerUsed,
            toolsUsed: result.toolsUsed.map((t) => ({ tool: t.tool, ok: t.ok, errorCode: t.errorCode })),
          });
        } catch (err: any) {
          if (abortController.signal.aborted) {
            return;
          }
          sendJson(ws, {
            type: "ai:error",
            error: err?.message || "Voice conversation error occurred.",
          });
        } finally {
          if (state.activeAbort === abortController) {
            state.activeAbort = null;
          }
        }
      }
    });

    ws.on("close", () => {
      abortActiveTurn();
      state.history = [];
    });
  });

  return wss;
}
