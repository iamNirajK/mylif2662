import { Router } from "express";
import {
  createChatCompletion,
  getAvailableModels,
  getProviderStatus,
} from "./aiProviders.js";
import {
  runUnifiedAssistantTurn,
  streamUnifiedAssistantTurn,
} from "./assistantAgent.js";
import {
  executeCurrentTimeTool,
  executeDistanceTool,
  executeInternetSearchTool,
  executeWeatherTool,
} from "./tools.js";
import { createRateLimiter } from "./rateLimit.js";
import {
  synthesizeSpeechBuffer,
  transcribeAudioBuffer,
} from "./voiceService.js";
import type { AIProviderId, Language } from "../types.js";

export const apiRouter = Router();

const chatRateLimiter = createRateLimiter({
  name: "ai-chat",
  windowMs: 60 * 1000,
  maxRequests: 30,
});

const fileRateLimiter = createRateLimiter({
  name: "ai-file",
  windowMs: 60 * 1000,
  maxRequests: 15,
});

const voiceRateLimiter = createRateLimiter({
  name: "voice-api",
  windowMs: 60 * 1000,
  maxRequests: 40,
});

// Health check endpoint
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    appName: "JIYA – Personal AI Life Assistant",
    aiProviders: getProviderStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Provider & Voice configuration status (strictly booleans, never exposes keys)
apiRouter.get("/ai/status", (_req, res) => {
  res.json(getProviderStatus());
});

// Dynamically fetch available AI models (prioritizes OpenRouter free models)
apiRouter.get("/ai/models", async (req, res) => {
  try {
    const provider = req.query.provider as AIProviderId | undefined;
    const forceRefresh = req.query.refresh === "true";
    const freeOnly = req.query.freeOnly === "true";
    if (forceRefresh && (!provider || provider === "openrouter")) {
      const { fetchOpenRouterModels } = await import("./aiProviders.js");
      await fetchOpenRouterModels(true);
    }
    const models = await getAvailableModels(provider, freeOnly);
    res.json({ models, status: getProviderStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load AI models." });
  }
});

// Direct Backend Tool Endpoints (Also invoked automatically by Unified Agent in both Text & Voice)
apiRouter.get("/tools/time", async (req, res) => {
  const location = typeof req.query.location === "string" ? req.query.location : undefined;
  const format = (req.query.format as "12h" | "24h" | "both") || "both";
  const result = await executeCurrentTimeTool({ location, format });
  res.json(result);
});

apiRouter.get("/tools/weather", async (req, res) => {
  const location = typeof req.query.location === "string" ? req.query.location : undefined;
  const days = req.query.days ? Number(req.query.days) : 3;
  const result = await executeWeatherTool({ location, days });
  res.status(result.ok ? 200 : result.errorCode === "API_KEY_MISSING" ? 503 : 400).json(result);
});

apiRouter.get("/tools/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const language: Language = req.query.language === "hi" ? "hi" : "en";
  const result = await executeInternetSearchTool({ query, language });
  res.status(result.ok ? 200 : result.errorCode === "CLARIFICATION_NEEDED" ? 400 : 502).json(result);
});

apiRouter.get("/tools/distance", async (req, res) => {
  const origin = typeof req.query.origin === "string" ? req.query.origin : undefined;
  const destination = typeof req.query.destination === "string" ? req.query.destination : "";
  const result = await executeDistanceTool({ origin, destination });
  res.status(result.ok ? 200 : result.errorCode === "CLARIFICATION_NEEDED" ? 400 : 404).json(result);
});

function extractHistoryMessages(messages: any[]): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-20)
    .map((msg) => ({
      role: msg?.role === "user" ? ("user" as const) : ("assistant" as const),
      content: String(msg?.content || msg?.text || "").trim(),
    }))
    .filter((m) => m.content.length > 0);
}

// Standard JSON Chat endpoint (Unified Agent + OpenRouter default + Tools)
apiRouter.post("/chat", chatRateLimiter, async (req, res) => {
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const {
      messages = [],
      prompt = "",
      provider = "openrouter",
      model,
      enableThinking = false,
      enableSearch = false,
      enableMaps = false,
      userLocation = null,
      language = "en",
    } = req.body || {};

    const history = extractHistoryMessages(messages);
    const cleanPrompt = String(prompt || "").trim();

    if (!cleanPrompt && history.length === 0) {
      return res.status(400).json({ error: "No prompt or messages provided." });
    }

    const effectivePrompt = cleanPrompt || history[history.length - 1]?.content || "";
    const effectiveHistory = cleanPrompt ? history : history.slice(0, -1);

    const result = await runUnifiedAssistantTurn({
      prompt: effectivePrompt,
      history: effectiveHistory,
      provider: provider as AIProviderId,
      model: typeof model === "string" && model.trim() ? model.trim() : undefined,
      language: language === "hi" ? "hi" : "en",
      mode: "text",
      enableThinking: Boolean(enableThinking),
      enableSearch: Boolean(enableSearch),
      enableMaps: Boolean(enableMaps),
      userLocation,
      signal: abortController.signal,
    });

    res.json({
      reply: result.reply,
      groundingSources: result.groundingSources,
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      thinkingUsed: Boolean(enableThinking),
      toolsUsed: result.toolsUsed.map((t) => ({ tool: t.tool, ok: t.ok, errorCode: t.errorCode })),
    });
  } catch (error: any) {
    const message = error?.message || "Failed to generate AI response.";
    const statusCode = message.includes("not configured") ? 503 : 500;
    res.status(statusCode).json({ error: message });
  }
});

// Streaming SSE Chat endpoint (Unified Agent + Real-Time Tool Statuses)
apiRouter.post("/chat/stream", chatRateLimiter, async (req, res) => {
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const {
    messages = [],
    prompt = "",
    provider = "openrouter",
    model,
    enableThinking = false,
    enableSearch = false,
    enableMaps = false,
    userLocation = null,
    language = "en",
  } = req.body || {};

  const history = extractHistoryMessages(messages);
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt && history.length === 0) {
    return res.status(400).json({ error: "No prompt or messages provided." });
  }

  const effectivePrompt = cleanPrompt || history[history.length - 1]?.content || "";
  const effectiveHistory = cleanPrompt ? history : history.slice(0, -1);

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (payload: Record<string, any>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    const result = await streamUnifiedAssistantTurn(
      {
        prompt: effectivePrompt,
        history: effectiveHistory,
        provider: provider as AIProviderId,
        model: typeof model === "string" && model.trim() ? model.trim() : undefined,
        language: language === "hi" ? "hi" : "en",
        mode: "text",
        enableThinking: Boolean(enableThinking),
        enableSearch: Boolean(enableSearch),
        enableMaps: Boolean(enableMaps),
        userLocation,
        signal: abortController.signal,
      },
      {
        onStatus: (step, labelEn, labelHi) => {
          sendEvent({ type: "status", step, labelEn, labelHi });
        },
        onToken: (token) => {
          sendEvent({ type: "token", token });
        },
        onGrounding: (sources) => {
          sendEvent({ type: "grounding", groundingSources: sources });
        },
      }
    );

    sendEvent({
      type: "done",
      reply: result.reply,
      groundingSources: result.groundingSources,
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      thinkingUsed: Boolean(enableThinking),
      toolsUsed: result.toolsUsed.map((t) => ({ tool: t.tool, ok: t.ok, errorCode: t.errorCode })),
    });
    res.end();
  } catch (error: any) {
    if (!abortController.signal.aborted) {
      sendEvent({
        type: "error",
        error: error?.message || "Streaming error occurred.",
      });
    }
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// File / Image / Document Analysis endpoint using OpenRouter Vision / Text models
apiRouter.post("/analyze-file", fileRateLimiter, async (req, res) => {
  try {
    const {
      fileBase64,
      mimeType = "application/octet-stream",
      fileName = "uploaded_file",
      prompt = "Analyze this file thoroughly and extract all important insights.",
      language = "en",
      provider = "openrouter",
      model,
    } = req.body || {};

    if (!fileBase64 || typeof fileBase64 !== "string") {
      return res.status(400).json({ error: "Missing fileBase64 payload." });
    }

    // Validate decoded size <= 15 MB
    const approxBytes = Math.ceil((fileBase64.length * 3) / 4);
    if (approxBytes > 15 * 1024 * 1024) {
      return res.status(413).json({ error: "Uploaded file exceeds 15 MB limit." });
    }

    const langInstruction =
      language === "hi"
        ? "कृपया हिंदी में विस्तृत विश्लेषण और मुख्य बिंदु प्रदान करें।"
        : "Provide a comprehensive analysis, structured key points, and action items in English.";

    const structuredPrompt = `File name: ${fileName}\n${prompt}\n${langInstruction}\n
Provide a structured summary with:
1. Executive Overview
2. Key Points & Extracted Data
3. Study Notes / Actionable Insights
4. 3 Suggested Follow-up Questions`;

    const isImage = String(mimeType).startsWith("image/");
    const isTextLike =
      String(mimeType).startsWith("text/") ||
      String(mimeType).includes("json") ||
      String(mimeType).includes("csv") ||
      /\.(txt|csv|md|json|xml|html|ts|js|py)$/i.test(fileName);

    let messages: Array<{ role: "system" | "user" | "assistant"; content: any }> = [];
    let selectedModel = typeof model === "string" && model.trim() ? model.trim() : undefined;

    if (isImage) {
      // Prioritize OpenRouter vision-capable free models when on OpenRouter
      if ((provider as AIProviderId) === "openrouter" && !selectedModel) {
        selectedModel = "google/gemma-3-27b-it:free";
      }
      messages = [
        {
          role: "system",
          content:
            "You are JIYA's Multimodal Image & Document Intelligence specialist. Extract accurate visible information and structured insights.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: structuredPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${fileBase64}`,
              },
            },
          ],
        },
      ];
    } else {
      // Extract UTF-8 / readable text for text, CSV, JSON, or text-layer PDFs
      const buf = Buffer.from(fileBase64, "base64");
      let extractedText = "";
      if (isTextLike) {
        extractedText = buf.toString("utf-8").slice(0, 60000);
      } else {
        // Basic printable ASCII/UTF-8 extraction for PDF/doc text streams
        const rawStr = buf.toString("latin1");
        const textChunks = rawStr.match(/[A-Za-z0-9\s.,;:!?'"()\-/%]{8,}/g) || [];
        extractedText = textChunks.join(" ").replace(/\s+/g, " ").slice(0, 40000);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        return res.status(400).json({
          error:
            "Could not extract readable text from this binary document. Please upload a text-based file (.txt, .csv, .md, .json) or an image/screenshot of the document.",
        });
      }

      messages = [
        {
          role: "system",
          content:
            "You are JIYA's Document Intelligence specialist. Analyze the provided document contents accurately.",
        },
        {
          role: "user",
          content: `${structuredPrompt}\n\n--- Document Content (${fileName}) ---\n${extractedText}`,
        },
      ];
    }

    const result = await createChatCompletion({
      provider: provider as AIProviderId,
      model: selectedModel,
      messages,
    });

    res.json({
      analysis: result.reply,
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      fileName,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to analyze document/image.";
    const statusCode = message.includes("not configured") ? 503 : 500;
    res.status(statusCode).json({ error: message });
  }
});

// Speech-to-Text endpoint (Whisper / Server STT adapter when configured)
apiRouter.post("/voice/stt", voiceRateLimiter, async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", language = "en" } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "Missing audioBase64 payload." });
    }
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const result = await transcribeAudioBuffer({
      audioBuffer,
      mimeType,
      language: language === "hi" ? "hi" : "en",
    });
    res.json(result);
  } catch (error: any) {
    const msg = error?.message || "STT failed.";
    const statusCode = msg.includes("not configured") ? 503 : 400;
    res.status(statusCode).json({ error: msg, configured: !msg.includes("not configured") });
  }
});

// Text-to-Speech endpoint (Natural Cloud TTS when configured, signals fallback cleanly otherwise)
apiRouter.post("/voice/tts", voiceRateLimiter, async (req, res) => {
  try {
    const { text, language = "en", voice = "nova" } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing text for speech synthesis." });
    }
    const result = await synthesizeSpeechBuffer({
      text: text.slice(0, 4000),
      language: language === "hi" ? "hi" : "en",
      voice,
    });
    if (!result) {
      return res.json({
        configured: false,
        fallback: "browser-tts",
      });
    }
    res.json({
      configured: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "TTS failed." });
  }
});
