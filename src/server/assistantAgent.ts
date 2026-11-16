import {
  createChatCompletion,
  streamChatCompletion,
} from "./aiProviders.js";
import {
  DEFAULT_ASSISTANT_LOCATION,
  executeNamedTool,
  planToolsForPrompt,
  type PlannedToolCall,
  type ToolExecutionResult,
  type ToolName,
} from "./tools.js";
import type {
  AIProviderId,
  AssistantToolStep,
  GroundingSource,
  Language,
} from "../types.js";

export interface UnifiedAgentParams {
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: AIProviderId;
  model?: string;
  language?: Language;
  mode: "text" | "voice";
  enableThinking?: boolean;
  enableSearch?: boolean;
  enableMaps?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  signal?: AbortSignal;
}

export interface UnifiedAgentCallbacks {
  onStatus?: (step: AssistantToolStep, labelEn: string, labelHi: string) => void;
  onSlowTool?: () => void;
  onToken?: (token: string) => void;
  onGrounding?: (sources: GroundingSource[]) => void;
}

export interface UnifiedAgentResult {
  reply: string;
  modelUsed: string;
  providerUsed: AIProviderId;
  groundingSources: GroundingSource[];
  toolsUsed: ToolExecutionResult[];
}

function extractMapsSourcesFromText(
  text: string,
  enableMaps?: boolean,
  prompt?: string
): GroundingSource[] {
  if (!enableMaps) return [];
  const sources: GroundingSource[] = [];
  const urlRegex = /https:\/\/(?:www\.)?google\.com\/maps[^\s)]+/g;
  const matches = text.match(urlRegex) || [];
  for (const url of matches.slice(0, 5)) {
    if (!sources.some((s) => s.url === url)) {
      sources.push({
        title: "Open Location in Google Maps",
        url,
        type: "maps",
      });
    }
  }
  if (sources.length === 0 && prompt) {
    const query = encodeURIComponent(prompt.slice(0, 100));
    sources.push({
      title: "Search Places on Google Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${query}`,
      type: "maps",
    });
  }
  return sources;
}

function buildUnifiedSystemPrompt(params: {
  language: Language;
  mode: "text" | "voice";
  enableMaps?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  toolResults: ToolExecutionResult[];
  allowToolProtocol: boolean;
}): string {
  const isHindi = params.language === "hi";
  const langInstruction = isHindi
    ? "You are JIYA (जिया — Professor Assistant), an intelligent, warm, and highly capable Personal AI Life Assistant. Respond naturally in clear Hindi (or Hinglish for technical terms)."
    : "You are JIYA (Professor Assistant), an intelligent, warm, and highly capable Personal AI Life Assistant. Tagline: 'Your Life. Your Assistant. Your Intelligence.' Respond clearly in natural English (matching the active English language setting even if earlier turns used another language).";

  const modeFormatting =
    params.mode === "voice"
      ? "VOICE MODE OUTPUT RULES: Your reply will be spoken aloud via Text-to-Speech AND shown in chat. Speak warmly and clearly in 2-4 concise natural sentences (or slightly more when summarizing search/weather/distance details). NEVER include raw URLs or Markdown links like [Title](https://...) in your text because source cards are already displayed separately in the UI."
      : "TEXT MODE OUTPUT RULES: Format with clean Markdown, bullet points when helpful, and clear actionable details.";

  const locationContext = params.userLocation
    ? `Default User Location: ${DEFAULT_ASSISTANT_LOCATION.label} (Time Zone: ${DEFAULT_ASSISTANT_LOCATION.timeZone}, UTC ${DEFAULT_ASSISTANT_LOCATION.utcOffset}). Browser GPS also provided: lat ${params.userLocation.latitude.toFixed(5)}, lng ${params.userLocation.longitude.toFixed(5)}.`
    : `Default User Location: ${DEFAULT_ASSISTANT_LOCATION.label} (State: Bihar, District: Muzaffarpur, Country: India, Time Zone: Asia/Kolkata, UTC +05:30). Always use Muzaffarpur, Bihar as the default location whenever the user asks about 'here', 'my city', 'Bihar', or omits a city for time/weather/origin.`;

  const mapsInstruction = params.enableMaps
    ? "Maps mode is active: include clear place names and direct Google Maps links (https://www.google.com/maps/search/?api=1&query=...) when recommending places."
    : "";

  const toolCapabilityRule = `UNIFIED TOOL CAPABILITIES (IDENTICAL IN BOTH TEXT & VOICE MODES):
You have full access to all backend tools in BOTH Text Mode and Voice Mode:
1. get_current_time — Live System Clock (Asia/Kolkata, 12h & 24h formats, date, day of week).
2. get_weather — WeatherAPI.com live current weather, forecast, humidity, wind speed, rain probability, sunrise/sunset, timezone.
3. internet_search — Live internet web & news search with real sources and links.
4. calculate_distance — Geocoding + Straight-Line (Haversine) distance + Driving road distance & travel time.

CRITICAL HONESTY & GROUNDING RULES:
- NEVER say "I don't have access to tools / live data / time / weather / internet search / distance in voice mode".
- NEVER guess or estimate the current time, date, weather, news, or distance from old training data.
- Base your response strictly on the LIVE TOOL RESULTS below.
- If a tool returned ok: false (for example, API_KEY_MISSING, NETWORK_ERROR, TIMEOUT, LOCATION_NOT_FOUND, CLARIFICATION_NEEDED), clearly and honestly tell the user the exact error or ask for clarification—do NOT invent fake data.
- For calculate_distance, if both drivingDistance and straightLineDistance are provided, clearly state both and explain the difference (road route vs straight-line air distance).`;

  const agenticProtocol = params.allowToolProtocol
    ? `\nIf you strictly need one of these live tools and no result for it appears below yet, respond ONLY with a single line in this exact format:
[[TOOL:tool_name|{"arg":"value"}]]
Valid tool names: get_current_time, get_weather, internet_search, calculate_distance.
Example: [[TOOL:get_weather|{"location":"Patna, Bihar, India"}]]`
    : "";

  const toolResultsBlock =
    params.toolResults.length > 0
      ? `\n\n=== LIVE BACKEND TOOL RESULTS (AUTHORITATIVE REAL-TIME DATA) ===\n${JSON.stringify(
          params.toolResults,
          null,
          2
        )}\n=== END TOOL RESULTS ===`
      : "";

  return [
    langInstruction,
    modeFormatting,
    locationContext,
    mapsInstruction,
    toolCapabilityRule,
    agenticProtocol,
    "Workspace Support: You also assist with Gmail, Google Calendar, Google Drive, Google Tasks, Contacts, Google Forms, study planning, and daily productivity.",
    toolResultsBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function executePlannedTools(
  planned: PlannedToolCall[],
  language: Language,
  callbacks: UnifiedAgentCallbacks,
  signal?: AbortSignal
): Promise<{ results: ToolExecutionResult[]; sources: GroundingSource[] }> {
  if (planned.length === 0) {
    return { results: [], sources: [] };
  }

  // Emit primary tool status immediately
  const primary = planned[0];
  callbacks.onStatus?.(primary.step, primary.labelEn, primary.labelHi);

  // If a remote network tool takes > 1.8s, trigger slow-tool notice (e.g. spoken "एक सेकंड...")
  const hasRemoteTool = planned.some((p) => p.tool !== "get_current_time");
  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  if (hasRemoteTool && callbacks.onSlowTool) {
    slowTimer = setTimeout(() => {
      if (!signal?.aborted) {
        callbacks.onSlowTool?.();
      }
    }, 1800);
  }

  try {
    const results = await Promise.all(
      planned.map((call) => executeNamedTool(call.tool, call.args, language, signal))
    );

    const sources: GroundingSource[] = [];
    for (const r of results) {
      if (r.groundingSources) {
        for (const s of r.groundingSources) {
          if (!sources.some((x) => x.url === s.url)) {
            sources.push(s);
          }
        }
      }
    }

    if (sources.length > 0) {
      callbacks.onGrounding?.(sources);
    }

    return { results, sources };
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
  }
}

function parseInlineToolDirective(text: string): { tool: ToolName; args: Record<string, any> } | null {
  const match = text.trim().match(/^\[\[TOOL:(get_current_time|get_weather|internet_search|calculate_distance)\|([\s\S]*?)\]\]$/);
  if (!match) return null;
  try {
    const args = JSON.parse(match[2] || "{}");
    return { tool: match[1] as ToolName, args };
  } catch {
    return { tool: match[1] as ToolName, args: {} };
  }
}

function mapToolToStatusMeta(tool: ToolName): {
  step: AssistantToolStep;
  labelEn: string;
  labelHi: string;
} {
  switch (tool) {
    case "get_current_time":
      return {
        step: "checking_time",
        labelEn: "Checking Current Time...",
        labelHi: "वर्तमान समय देख रही हूँ...",
      };
    case "get_weather":
      return {
        step: "checking_weather",
        labelEn: "Checking Weather...",
        labelHi: "मौसम की जानकारी ले रही हूँ...",
      };
    case "internet_search":
      return {
        step: "searching_web",
        labelEn: "Searching the Internet...",
        labelHi: "इंटरनेट पर खोज रही हूँ...",
      };
    case "calculate_distance":
      return {
        step: "calculating_distance",
        labelEn: "Calculating Distance...",
        labelHi: "दूरी और रूट की गणना कर रही हूँ...",
      };
  }
}

/**
 * Streaming Unified Assistant Turn (Shared identically by Text SSE & Voice WebSocket)
 */
export async function streamUnifiedAssistantTurn(
  params: UnifiedAgentParams,
  callbacks: UnifiedAgentCallbacks = {}
): Promise<UnifiedAgentResult> {
  const language: Language = params.language === "hi" ? "hi" : "en";
  const provider: AIProviderId = params.provider || "openrouter";

  callbacks.onStatus?.("understanding", "Understanding...", "समझ रही हूँ...");

  // Stage 1: Unified Intent Detection & Parallel Backend Tool Execution
  const planned = planToolsForPrompt({
    prompt: params.prompt,
    enableSearch: params.enableSearch,
    enableMaps: params.enableMaps,
  });

  const { results: toolResults, sources: allSources } = await executePlannedTools(
    planned,
    language,
    callbacks,
    params.signal
  );

  if (params.signal?.aborted) {
    throw new Error("Request aborted.");
  }

  callbacks.onStatus?.("preparing", "Preparing Answer...", "जवाब तैयार कर रही हूँ...");

  const historyMsgs = (params.history || [])
    .slice(-16)
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: String(m.content || "").slice(0, 8000),
    }))
    .filter((m) => m.content.length > 0);

  const allowToolProtocol = toolResults.length === 0;
  const systemPrompt = buildUnifiedSystemPrompt({
    language,
    mode: params.mode,
    enableMaps: params.enableMaps,
    userLocation: params.userLocation,
    toolResults,
    allowToolProtocol,
  });

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...historyMsgs,
    { role: "user" as const, content: params.prompt.trim().slice(0, 12000) },
  ];

  // Buffer first ~40 chars only when allowToolProtocol is true so [[TOOL:...]] isn't spoken/rendered
  let probeBuffer = "";
  let passedProbe = !allowToolProtocol;
  let interceptedDirective: { tool: ToolName; args: Record<string, any> } | null = null;

  const firstPass = await streamChatCompletion(
    {
      provider,
      model: params.model,
      messages,
      enableSearch: Boolean(params.enableSearch && provider === "openrouter"),
      enableReasoning: Boolean(params.enableThinking),
      signal: params.signal,
    },
    {
      onToken: (token) => {
        if (passedProbe) {
          callbacks.onToken?.(token);
          return;
        }
        probeBuffer += token;
        if (probeBuffer.startsWith("[[TOOL:")) {
          const directive = parseInlineToolDirective(probeBuffer);
          if (directive) {
            interceptedDirective = directive;
            return;
          }
          if (probeBuffer.length < 220) {
            return; // wait for closing ]]
          }
        }
        if (probeBuffer.length >= 12 || !probeBuffer.startsWith("[")) {
          passedProbe = true;
          callbacks.onToken?.(probeBuffer);
          probeBuffer = "";
        }
      },
      onGrounding: (sources) => {
        for (const s of sources) {
          if (!allSources.some((x) => x.url === s.url)) {
            allSources.push(s);
          }
        }
        if (allSources.length > 0) {
          callbacks.onGrounding?.([...allSources]);
        }
      },
    }
  );

  // Flush any remaining probe buffer if not a tool directive
  if (!passedProbe && probeBuffer && !interceptedDirective) {
    const maybeDirective = parseInlineToolDirective(probeBuffer);
    if (maybeDirective) {
      interceptedDirective = maybeDirective;
    } else {
      callbacks.onToken?.(probeBuffer);
    }
  }

  // Stage 2: If model itself requested a secondary tool via [[TOOL:...]], execute it and re-stream!
  if (interceptedDirective || parseInlineToolDirective(firstPass.fullText)) {
    const directive = interceptedDirective || parseInlineToolDirective(firstPass.fullText)!;
    const statusMeta = mapToolToStatusMeta(directive.tool);
    callbacks.onStatus?.(statusMeta.step, statusMeta.labelEn, statusMeta.labelHi);

    const extraResult = await executeNamedTool(
      directive.tool,
      directive.args,
      language,
      params.signal
    );
    toolResults.push(extraResult);
    if (extraResult.groundingSources) {
      for (const s of extraResult.groundingSources) {
        if (!allSources.some((x) => x.url === s.url)) {
          allSources.push(s);
        }
      }
      if (allSources.length > 0) {
        callbacks.onGrounding?.([...allSources]);
      }
    }

    callbacks.onStatus?.("preparing", "Preparing Answer...", "जवाब तैयार कर रही हूँ...");

    const secondSystem = buildUnifiedSystemPrompt({
      language,
      mode: params.mode,
      enableMaps: params.enableMaps,
      userLocation: params.userLocation,
      toolResults,
      allowToolProtocol: false,
    });

    const secondPass = await streamChatCompletion(
      {
        provider,
        model: params.model,
        messages: [
          { role: "system", content: secondSystem },
          ...historyMsgs,
          { role: "user", content: params.prompt.trim().slice(0, 12000) },
        ],
        enableReasoning: Boolean(params.enableThinking),
        signal: params.signal,
      },
      {
        onToken: (token) => {
          callbacks.onToken?.(token);
        },
      }
    );

    const mapsSources = extractMapsSourcesFromText(
      secondPass.fullText,
      params.enableMaps,
      params.prompt
    );
    for (const s of mapsSources) {
      if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
    }

    return {
      reply: secondPass.fullText,
      modelUsed: secondPass.modelUsed,
      providerUsed: secondPass.providerUsed,
      groundingSources: allSources,
      toolsUsed: toolResults,
    };
  }

  const mapsSources = extractMapsSourcesFromText(
    firstPass.fullText,
    params.enableMaps,
    params.prompt
  );
  for (const s of mapsSources) {
    if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
  }

  return {
    reply: firstPass.fullText,
    modelUsed: firstPass.modelUsed,
    providerUsed: firstPass.providerUsed,
    groundingSources: allSources,
    toolsUsed: toolResults,
  };
}

/**
 * Non-streaming Unified Assistant Turn (Used by JSON POST /api/chat)
 */
export async function runUnifiedAssistantTurn(
  params: UnifiedAgentParams
): Promise<UnifiedAgentResult> {
  const language: Language = params.language === "hi" ? "hi" : "en";
  const provider: AIProviderId = params.provider || "openrouter";

  const planned = planToolsForPrompt({
    prompt: params.prompt,
    enableSearch: params.enableSearch,
    enableMaps: params.enableMaps,
  });

  const { results: toolResults, sources: allSources } = await executePlannedTools(
    planned,
    language,
    {},
    params.signal
  );

  const historyMsgs = (params.history || [])
    .slice(-16)
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: String(m.content || "").slice(0, 8000),
    }))
    .filter((m) => m.content.length > 0);

  const allowToolProtocol = toolResults.length === 0;
  const systemPrompt = buildUnifiedSystemPrompt({
    language,
    mode: params.mode,
    enableMaps: params.enableMaps,
    userLocation: params.userLocation,
    toolResults,
    allowToolProtocol,
  });

  const firstPass = await createChatCompletion({
    provider,
    model: params.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...historyMsgs,
      { role: "user", content: params.prompt.trim().slice(0, 12000) },
    ],
    enableSearch: Boolean(params.enableSearch && provider === "openrouter"),
    enableReasoning: Boolean(params.enableThinking),
    signal: params.signal,
  });

  for (const s of firstPass.groundingSources) {
    if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
  }

  const directive = parseInlineToolDirective(firstPass.reply);
  if (directive) {
    const extraResult = await executeNamedTool(
      directive.tool,
      directive.args,
      language,
      params.signal
    );
    toolResults.push(extraResult);
    if (extraResult.groundingSources) {
      for (const s of extraResult.groundingSources) {
        if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
      }
    }

    const secondSystem = buildUnifiedSystemPrompt({
      language,
      mode: params.mode,
      enableMaps: params.enableMaps,
      userLocation: params.userLocation,
      toolResults,
      allowToolProtocol: false,
    });

    const secondPass = await createChatCompletion({
      provider,
      model: params.model,
      messages: [
        { role: "system", content: secondSystem },
        ...historyMsgs,
        { role: "user", content: params.prompt.trim().slice(0, 12000) },
      ],
      enableReasoning: Boolean(params.enableThinking),
      signal: params.signal,
    });

    const mapsSources = extractMapsSourcesFromText(
      secondPass.reply,
      params.enableMaps,
      params.prompt
    );
    for (const s of mapsSources) {
      if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
    }

    return {
      reply: secondPass.reply,
      modelUsed: secondPass.modelUsed,
      providerUsed: secondPass.providerUsed,
      groundingSources: allSources,
      toolsUsed: toolResults,
    };
  }

  const mapsSources = extractMapsSourcesFromText(
    firstPass.reply,
    params.enableMaps,
    params.prompt
  );
  for (const s of mapsSources) {
    if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
  }

  return {
    reply: firstPass.reply,
    modelUsed: firstPass.modelUsed,
    providerUsed: firstPass.providerUsed,
    groundingSources: allSources,
    toolsUsed: toolResults,
  };
}
