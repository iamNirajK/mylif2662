import type { AssistantToolStep, GroundingSource, Language } from "../types.js";

export const DEFAULT_ASSISTANT_LOCATION = {
  district: "Muzaffarpur",
  state: "Bihar",
  country: "India",
  label: "Muzaffarpur, Bihar, India",
  timeZone: "Asia/Kolkata",
  utcOffset: "+05:30",
  latitude: 26.1209,
  longitude: 85.3647,
};

export type ToolName =
  | "get_current_time"
  | "get_weather"
  | "internet_search"
  | "calculate_distance";

export interface ToolExecutionResult {
  tool: ToolName;
  ok: boolean;
  errorCode?:
    | "API_KEY_MISSING"
    | "API_KEY_INVALID"
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "LOCATION_NOT_FOUND"
    | "CLARIFICATION_NEEDED"
    | "SEARCH_FAILED";
  error?: string;
  data?: Record<string, any>;
  groundingSources?: GroundingSource[];
}

export interface PlannedToolCall {
  tool: ToolName;
  args: Record<string, any>;
  step: AssistantToolStep;
  labelEn: string;
  labelHi: string;
}

const WEATHERAPI_BASE = "https://api.weatherapi.com/v1";

// Reference coordinates for common Bihar/India cities used only as a fallback if Nominatim is rate-limited
const KNOWN_INDIA_CITIES: Array<{
  keys: string[];
  displayName: string;
  lat: number;
  lng: number;
  timeZone: string;
}> = [
  {
    keys: ["muzaffarpur", "मुजफ्फरपुर", "मुज़फ़्फ़रपुर"],
    displayName: "Muzaffarpur, Bihar, India",
    lat: 26.1209,
    lng: 85.3647,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["patna", "पटना"],
    displayName: "Patna, Bihar, India",
    lat: 25.5941,
    lng: 85.1376,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["bihar", "बिहार"],
    displayName: "Bihar, India (Patna)",
    lat: 25.5941,
    lng: 85.1376,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["darbhanga", "दरभंगा"],
    displayName: "Darbhanga, Bihar, India",
    lat: 26.1542,
    lng: 85.8918,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["gaya", "गया"],
    displayName: "Gaya, Bihar, India",
    lat: 24.7914,
    lng: 85.0002,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["bhagalpur", "भागलपुर"],
    displayName: "Bhagalpur, Bihar, India",
    lat: 25.2425,
    lng: 86.9842,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["samastipur", "समस्तीपुर"],
    displayName: "Samastipur, Bihar, India",
    lat: 25.8629,
    lng: 85.781,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["hajipur", "हाजीपुर"],
    displayName: "Hajipur, Bihar, India",
    lat: 25.6858,
    lng: 85.2146,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["sitamarhi", "सीतामढ़ी"],
    displayName: "Sitamarhi, Bihar, India",
    lat: 26.5887,
    lng: 85.5013,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["motihari", "मोतिहारी"],
    displayName: "Motihari, Bihar, India",
    lat: 26.647,
    lng: 84.916,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["begusarai", "बेगूसराय"],
    displayName: "Begusarai, Bihar, India",
    lat: 25.4182,
    lng: 86.1272,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["delhi", "new delhi", "दिल्ली", "नई दिल्ली"],
    displayName: "New Delhi, Delhi, India",
    lat: 28.6139,
    lng: 77.209,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["mumbai", "मुंबई"],
    displayName: "Mumbai, Maharashtra, India",
    lat: 19.076,
    lng: 72.8777,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["kolkata", "कोलकाता"],
    displayName: "Kolkata, West Bengal, India",
    lat: 22.5726,
    lng: 88.3639,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["bengaluru", "bangalore", "बेंगलुरु"],
    displayName: "Bengaluru, Karnataka, India",
    lat: 12.9716,
    lng: 77.5946,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["varanasi", "वाराणसी", "बनारस"],
    displayName: "Varanasi, Uttar Pradesh, India",
    lat: 25.3176,
    lng: 82.9739,
    timeZone: "Asia/Kolkata",
  },
  {
    keys: ["lucknow", "लखनऊ"],
    displayName: "Lucknow, Uttar Pradesh, India",
    lat: 26.8467,
    lng: 80.9462,
    timeZone: "Asia/Kolkata",
  },
];

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number; externalSignal?: AbortSignal } = {}
): Promise<Response> {
  const { timeoutMs = 8000, externalSignal, ...fetchOpts } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    return await fetch(url, { ...fetchOpts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

function normalizeDefaultLocationQuery(raw?: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return DEFAULT_ASSISTANT_LOCATION.label;
  const lower = trimmed.toLowerCase();
  if (
    [
      "here",
      "my location",
      "current location",
      "bihar",
      "muzaffarpur",
      "muzaffarpur bihar",
      "बिहार",
      "मुजफ्फरपुर",
      "मुज़फ़्फ़रपुर",
      "यहाँ",
      "यहां",
      "अभी",
    ].includes(lower)
  ) {
    return DEFAULT_ASSISTANT_LOCATION.label;
  }
  return trimmed;
}

/**
 * TOOL 1: Live System Clock & Asia/Kolkata (Muzaffarpur, Bihar) Time Tool
 * Never guesses from training data and never requires internet search.
 */
export async function executeCurrentTimeTool(
  args: { location?: string; format?: "12h" | "24h" | "both" } = {},
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const now = new Date();
  const requestedLoc = normalizeDefaultLocationQuery(args.location);
  let timeZone = DEFAULT_ASSISTANT_LOCATION.timeZone;
  let resolvedLocation = requestedLoc;
  let weatherApiTimeZoneMeta: Record<string, any> | undefined;

  // Optional WeatherAPI /timezone.json lookup if user asked about another place AND key is set
  const weatherKey = process.env.WEATHERAPI_KEY?.trim();
  const isDefaultIndia =
    requestedLoc === DEFAULT_ASSISTANT_LOCATION.label ||
    KNOWN_INDIA_CITIES.some((c) => c.keys.some((k) => requestedLoc.toLowerCase().includes(k)));

  if (weatherKey && !isDefaultIndia) {
    try {
      const tzRes = await fetchWithTimeout(
        `${WEATHERAPI_BASE}/timezone.json?key=${encodeURIComponent(weatherKey)}&q=${encodeURIComponent(requestedLoc)}`,
        { timeoutMs: 4000, externalSignal: signal }
      );
      if (tzRes.ok) {
        const tzData = (await tzRes.json()) as any;
        if (tzData?.location?.tz_id) {
          timeZone = tzData.location.tz_id;
          resolvedLocation = [tzData.location.name, tzData.location.region, tzData.location.country]
            .filter(Boolean)
            .join(", ");
          weatherApiTimeZoneMeta = {
            tz_id: tzData.location.tz_id,
            localtime: tzData.location.localtime,
          };
        }
      }
    } catch {
      // Fall back safely to live system clock
    }
  } else if (weatherKey && requestedLoc === DEFAULT_ASSISTANT_LOCATION.label) {
    // Non-blocking optional timezone enrichment when configured
    try {
      const tzRes = await fetchWithTimeout(
        `${WEATHERAPI_BASE}/timezone.json?key=${encodeURIComponent(weatherKey)}&q=${encodeURIComponent("Muzaffarpur")}`,
        { timeoutMs: 2500, externalSignal: signal }
      );
      if (tzRes.ok) {
        const tzData = (await tzRes.json()) as any;
        if (tzData?.location) {
          weatherApiTimeZoneMeta = {
            tz_id: tzData.location.tz_id,
            localtime: tzData.location.localtime,
          };
        }
      }
    } catch {
      // Live system clock always succeeds independently
    }
  }

  const time12h = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  const time24h = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const dateEn = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const dateHi = new Intl.DateTimeFormat("hi-IN", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const dayEn = new Intl.DateTimeFormat("en-IN", { timeZone, weekday: "long" }).format(now);
  const dayHi = new Intl.DateTimeFormat("hi-IN", { timeZone, weekday: "long" }).format(now);

  return {
    tool: "get_current_time",
    ok: true,
    data: {
      location: resolvedLocation,
      defaultLocation: DEFAULT_ASSISTANT_LOCATION.label,
      timeZone,
      utcOffset: timeZone === "Asia/Kolkata" ? "+05:30" : undefined,
      formatRequested: args.format || "both",
      time12h,
      time24h,
      dateEn,
      dateHi,
      dayOfWeekEn: dayEn,
      dayOfWeekHi: dayHi,
      isoUtc: now.toISOString(),
      source: "Live Server System Clock (Asia/Kolkata)",
      weatherApiTimeZoneMeta,
    },
  };
}

/**
 * TOOL 2: WeatherAPI.com Integration (current.json + forecast.json + timezone.json)
 */
export async function executeWeatherTool(
  args: { location?: string; days?: number } = {},
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const apiKey = process.env.WEATHERAPI_KEY?.trim();
  if (!apiKey) {
    return {
      tool: "get_weather",
      ok: false,
      errorCode: "API_KEY_MISSING",
      error:
        "WEATHERAPI_KEY is not configured in server environment variables. Please add your WeatherAPI.com API key in Secrets to access live weather and forecasts.",
    };
  }

  const locationQuery = normalizeDefaultLocationQuery(args.location);
  const days = Math.min(3, Math.max(1, Number(args.days || 3)));

  try {
    const url = `${WEATHERAPI_BASE}/forecast.json?key=${encodeURIComponent(
      apiKey
    )}&q=${encodeURIComponent(locationQuery)}&days=${days}&aqi=no&alerts=yes`;

    const res = await fetchWithTimeout(url, { timeoutMs: 8500, externalSignal: signal });
    const json = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      const apiMsg = json?.error?.message || `WeatherAPI returned HTTP ${res.status}`;
      const apiCode = json?.error?.code;

      if (res.status === 401 || res.status === 403 || apiCode === 2006 || apiCode === 2008) {
        return {
          tool: "get_weather",
          ok: false,
          errorCode: "API_KEY_INVALID",
          error: `WeatherAPI authentication failed: ${apiMsg}`,
        };
      }
      if (res.status === 400 || apiCode === 1006) {
        return {
          tool: "get_weather",
          ok: false,
          errorCode: "LOCATION_NOT_FOUND",
          error: `Location "${locationQuery}" was not found by WeatherAPI. Please ask the user to clarify the city or district name.`,
        };
      }
      return {
        tool: "get_weather",
        ok: false,
        errorCode: "NETWORK_ERROR",
        error: apiMsg,
      };
    }

    const loc = json.location || {};
    const curr = json.current || {};
    const forecastDays = Array.isArray(json.forecast?.forecastday)
      ? json.forecast.forecastday.map((d: any) => ({
          date: d.date,
          maxTempC: d.day?.maxtemp_c,
          minTempC: d.day?.mintemp_c,
          avgTempC: d.day?.avgtemp_c,
          condition: d.day?.condition?.text,
          chanceOfRainPercent: d.day?.daily_chance_of_rain,
          willItRain: Boolean(d.day?.daily_will_it_rain),
          totalPrecipMm: d.day?.totalprecip_mm,
          sunrise: d.astro?.sunrise,
          sunset: d.astro?.sunset,
        }))
      : [];

    const todayAstro = json.forecast?.forecastday?.[0]?.astro || {};

    return {
      tool: "get_weather",
      ok: true,
      data: {
        provider: "WeatherAPI.com",
        location: {
          name: loc.name,
          region: loc.region,
          country: loc.country,
          timeZone: loc.tz_id,
          localtime: loc.localtime,
          lat: loc.lat,
          lon: loc.lon,
        },
        current: {
          tempC: curr.temp_c,
          tempF: curr.temp_f,
          feelsLikeC: curr.feelslike_c,
          condition: curr.condition?.text,
          humidityPercent: curr.humidity,
          windKph: curr.wind_kph,
          windMph: curr.wind_mph,
          windDir: curr.wind_dir,
          precipMm: curr.precip_mm,
          cloudPercent: curr.cloud,
          uv: curr.uv,
          lastUpdated: curr.last_updated,
        },
        todayRainProbabilityPercent: forecastDays[0]?.chanceOfRainPercent ?? null,
        astronomy: {
          sunrise: todayAstro.sunrise || null,
          sunset: todayAstro.sunset || null,
        },
        forecast: forecastDays,
      },
      groundingSources: [
        {
          title: `WeatherAPI Forecast: ${loc.name || locationQuery}`,
          url: `https://www.weatherapi.com/weather/q/${encodeURIComponent(
            String(loc.name || locationQuery).toLowerCase().replace(/\s+/g, "-")
          )}`,
          type: "web",
        },
      ],
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    return {
      tool: "get_weather",
      ok: false,
      errorCode: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      error: isAbort
        ? "WeatherAPI request timed out. Please try again."
        : `Network error contacting WeatherAPI.com: ${err?.message || "Unknown error"}`,
    };
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchDuckDuckGoHtml(query: string, signal?: AbortSignal) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, {
    timeoutMs: 8000,
    externalSignal: signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const items: Array<{ title: string; url: string; snippet: string }> = [];

  const resultBlocks = html.split(/class="result__body"/g).slice(1, 8);
  for (const block of resultBlocks) {
    const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    let href = decodeHtmlEntities(linkMatch[1]);
    if (href.includes("uddg=")) {
      try {
        const parsed = new URL(href.startsWith("//") ? `https:${href}` : href);
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) href = uddg;
      } catch {}
    } else if (href.startsWith("//")) {
      href = `https:${href}`;
    }
    if (!href.startsWith("http")) continue;

    const title = decodeHtmlEntities(linkMatch[2]);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/);
    const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1]) : "";
    if (title) {
      items.push({ title, url: href, snippet });
    }
  }
  return items;
}

async function searchGoogleNewsRss(query: string, language: Language, signal?: AbortSignal) {
  const hl = language === "hi" ? "hi" : "en-IN";
  const ceid = language === "hi" ? "IN:hi" : "IN:en";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=${hl}&gl=IN&ceid=${ceid}`;

  const res = await fetchWithTimeout(url, {
    timeoutMs: 7500,
    externalSignal: signal,
    headers: { "User-Agent": "JIYA-ProfessorAssistant/1.0" },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items: Array<{ title: string; url: string; snippet: string; pubDate?: string }> = [];

  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of matches) {
    if (items.length >= 6) break;
    const itemXml = m[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
    const link = linkMatch ? decodeHtmlEntities(linkMatch[1]) : "";
    const pubDate = pubDateMatch ? decodeHtmlEntities(pubDateMatch[1]) : "";
    const source = sourceMatch ? decodeHtmlEntities(sourceMatch[1]) : "";

    if (title && link) {
      items.push({
        title,
        url: link,
        snippet: [source, pubDate].filter(Boolean).join(" · "),
        pubDate,
      });
    }
  }
  return items;
}

async function searchWikipediaOpenSearch(
  query: string,
  language: Language,
  signal?: AbortSignal
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const cleaned = query
    .replace(
      /(search the internet for|search internet for|search web for|look up|google search|इंटरनेट पर|इंटरनेट से|खोजो|सर्च करो|बताओ|के बारे में|जानकारी)/gi,
      " "
    )
    .replace(/[?!।.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 2) return [];

  const langHost = language === "hi" ? "hi.wikipedia.org" : "en.wikipedia.org";
  const url = `https://${langHost}/w/api.php?action=opensearch&search=${encodeURIComponent(
    cleaned
  )}&limit=4&namespace=0&format=json`;

  const res = await fetchWithTimeout(url, {
    timeoutMs: 5000,
    externalSignal: signal,
    headers: { "User-Agent": "JIYA-ProfessorAssistant/1.0" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as any[];
  if (!Array.isArray(data) || !Array.isArray(data[1]) || !Array.isArray(data[3])) return [];

  const titles = data[1] as string[];
  const descriptions = Array.isArray(data[2]) ? (data[2] as string[]) : [];
  const urls = data[3] as string[];

  const items: Array<{ title: string; url: string; snippet: string }> = [];
  for (let i = 0; i < titles.length; i++) {
    if (titles[i] && urls[i]) {
      items.push({
        title: `${titles[i]} - Wikipedia`,
        url: urls[i],
        snippet: descriptions[i] || `Wikipedia entry for ${titles[i]}`,
      });
    }
  }
  return items;
}

/**
 * TOOL 3: Real-Time Internet Search (Works identically in Text Mode and Voice Mode)
 */
export async function executeInternetSearchTool(
  args: { query: string; language?: Language },
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const rawQuery = (args.query || "").trim();
  const query = rawQuery
    .replace(
      /^(please\s+)?(search\s+(the\s+)?(internet|web)\s+(for|about)\s+|look\s+up\s+|google\s+|इंटरनेट\s+(पर|से)\s+)/i,
      ""
    )
    .replace(/\s+(खोजो|सर्च\s+करो)$/i, "")
    .trim() || rawQuery;

  if (!query) {
    return {
      tool: "internet_search",
      ok: false,
      errorCode: "CLARIFICATION_NEEDED",
      error: "Search query is empty.",
    };
  }

  const language: Language = args.language === "hi" ? "hi" : "en";
  const isNewsLike =
    /(news|latest|today|breaking|headline|india|bihar|exam|notification|result|खबर|समाचार|ताज़ा|ताजा|आज|भारत|परीक्षा|रिजल्ट|नोटिफिकेशन)/i.test(
      query
    );

  try {
    const [ddgResults, newsResults, wikiResults] = await Promise.all([
      searchDuckDuckGoHtml(query, signal).catch(() => []),
      isNewsLike ? searchGoogleNewsRss(query, language, signal).catch(() => []) : Promise.resolve([]),
      !isNewsLike ? searchWikipediaOpenSearch(query, language, signal).catch(() => []) : Promise.resolve([]),
    ]);

    const combined = [...newsResults, ...ddgResults, ...wikiResults];

    // If general query returned nothing from DDG & Wikipedia, fall back to Google News RSS
    if (combined.length === 0 && !isNewsLike) {
      const backupNews = await searchGoogleNewsRss(query, language, signal).catch(() => []);
      combined.push(...backupNews);
    }

    if (combined.length === 0) {
      return {
        tool: "internet_search",
        ok: false,
        errorCode: "SEARCH_FAILED",
        error:
          "Live internet search did not return usable results right now. Do not fabricate information; inform the user transparently.",
      };
    }

    const deduped: Array<{ title: string; url: string; snippet: string }> = [];
    for (const item of combined) {
      if (!deduped.some((x) => x.url === item.url)) {
        deduped.push(item);
      }
      if (deduped.length >= 6) break;
    }

    return {
      tool: "internet_search",
      ok: true,
      data: {
        query,
        fetchedAtUtc: new Date().toISOString(),
        resultCount: deduped.length,
        results: deduped,
      },
      groundingSources: deduped.map((r) => ({
        title: r.title,
        url: r.url,
        type: "web",
        snippet: r.snippet,
      })),
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    return {
      tool: "internet_search",
      ok: false,
      errorCode: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      error: isAbort
        ? "Internet search timed out."
        : `Internet search network failure: ${err?.message || "Unknown error"}`,
    };
  }
}

async function geocodePlace(
  placeName: string,
  signal?: AbortSignal
): Promise<{ displayName: string; lat: number; lng: number } | null> {
  const cleaned = placeName.trim();
  if (!cleaned) return null;

  // Query Nominatim OpenStreetMap Geocoder for accurate coordinates
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      cleaned
    )}`;
    const res = await fetchWithTimeout(url, {
      timeoutMs: 6500,
      externalSignal: signal,
      headers: {
        "User-Agent": "JIYA-ProfessorAssistant/1.0 (personal-assistant)",
        "Accept-Language": "en",
      },
    });
    if (res.ok) {
      const arr = (await res.json()) as any[];
      if (Array.isArray(arr) && arr.length > 0 && arr[0].lat && arr[0].lon) {
        return {
          displayName: String(arr[0].display_name || cleaned),
          lat: Number(arr[0].lat),
          lng: Number(arr[0].lon),
        };
      }
    }
  } catch {
    // Fallback to known India city dictionary if Nominatim is temporarily unreachable
  }

  const lower = cleaned.toLowerCase();
  const known = KNOWN_INDIA_CITIES.find((c) =>
    c.keys.some((k) => lower === k || lower.includes(k))
  );
  if (known) {
    return {
      displayName: known.displayName,
      lat: known.lat,
      lng: known.lng,
    };
  }

  return null;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatDurationMinutes(totalMinutes: number): { en: string; hi: string } {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hours === 0) {
    return { en: `${mins} minutes`, hi: `${mins} मिनट` };
  }
  if (mins === 0) {
    return { en: `${hours} hour${hours > 1 ? "s" : ""}`, hi: `${hours} घंटे` };
  }
  return {
    en: `${hours} hour${hours > 1 ? "s" : ""} ${mins} minutes`,
    hi: `${hours} घंटे ${mins} मिनट`,
  };
}

/**
 * TOOL 4: Real-Time Distance & Routing Calculator (Straight-Line vs Driving Distance & Travel Time)
 */
export async function executeDistanceTool(
  args: { origin?: string; destination?: string },
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const originInput = normalizeDefaultLocationQuery(args.origin);
  const destinationInput = (args.destination || "").trim();

  if (!destinationInput) {
    return {
      tool: "calculate_distance",
      ok: false,
      errorCode: "CLARIFICATION_NEEDED",
      error:
        "Destination location is missing. Ask the user which city or place they want to measure the distance to.",
    };
  }

  try {
    const [originGeo, destGeo] = await Promise.all([
      geocodePlace(originInput, signal),
      geocodePlace(destinationInput, signal),
    ]);

    if (!originGeo) {
      return {
        tool: "calculate_distance",
        ok: false,
        errorCode: "LOCATION_NOT_FOUND",
        error: `Could not locate origin "${originInput}". Please ask the user to clarify the starting city/place.`,
      };
    }

    if (!destGeo) {
      return {
        tool: "calculate_distance",
        ok: false,
        errorCode: "LOCATION_NOT_FOUND",
        error: `Could not locate destination "${destinationInput}". Please ask the user to clarify the destination city/place.`,
      };
    }

    const straightLineKm = haversineDistanceKm(
      originGeo.lat,
      originGeo.lng,
      destGeo.lat,
      destGeo.lng
    );
    const straightLineMiles = Math.round(straightLineKm * 0.621371 * 10) / 10;

    let drivingDistanceKm: number | null = null;
    let drivingDistanceMiles: number | null = null;
    let drivingDurationEn: string | null = null;
    let drivingDurationHi: string | null = null;
    let routingNote = "";

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=false`;
      const osrmRes = await fetchWithTimeout(osrmUrl, {
        timeoutMs: 7500,
        externalSignal: signal,
        headers: { "User-Agent": "JIYA-ProfessorAssistant/1.0" },
      });

      if (osrmRes.ok) {
        const osrmData = (await osrmRes.json()) as any;
        const route = osrmData?.routes?.[0];
        if (route && typeof route.distance === "number" && typeof route.duration === "number") {
          drivingDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
          drivingDistanceMiles = Math.round(drivingDistanceKm * 0.621371 * 10) / 10;
          const dur = formatDurationMinutes(route.duration / 60);
          drivingDurationEn = dur.en;
          drivingDurationHi = dur.hi;
        }
      }
    } catch {
      routingNote =
        "Live road routing service timed out; only exact straight-line (air) distance could be computed.";
    }

    const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      originInput
    )}&destination=${encodeURIComponent(destinationInput)}`;

    return {
      tool: "calculate_distance",
      ok: true,
      data: {
        origin: {
          query: originInput,
          resolvedName: originGeo.displayName,
          lat: originGeo.lat,
          lng: originGeo.lng,
        },
        destination: {
          query: destinationInput,
          resolvedName: destGeo.displayName,
          lat: destGeo.lat,
          lng: destGeo.lng,
        },
        straightLineDistance: {
          km: straightLineKm,
          miles: straightLineMiles,
        },
        drivingDistance:
          drivingDistanceKm !== null
            ? {
                km: drivingDistanceKm,
                miles: drivingDistanceMiles,
                estimatedDurationEn: drivingDurationEn,
                estimatedDurationHi: drivingDurationHi,
              }
            : null,
        differenceNote:
          drivingDistanceKm !== null
            ? `Driving distance (${drivingDistanceKm} km) follows highways/roads and is longer than the straight-line (air) distance (${straightLineKm} km) by ${
                Math.round((drivingDistanceKm - straightLineKm) * 10) / 10
              } km.`
            : routingNote,
        googleMapsDirectionsUrl: mapsDirectionsUrl,
      },
      groundingSources: [
        {
          title: `Directions: ${originInput} to ${destinationInput}`,
          url: mapsDirectionsUrl,
          type: "maps",
        },
      ],
    };
  } catch (err: any) {
    return {
      tool: "calculate_distance",
      ok: false,
      errorCode: err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      error: `Failed to calculate distance: ${err?.message || "Unknown error"}`,
    };
  }
}

export async function executeNamedTool(
  tool: ToolName,
  args: Record<string, any>,
  language: Language,
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  switch (tool) {
    case "get_current_time":
      return executeCurrentTimeTool(args, signal);
    case "get_weather":
      return executeWeatherTool(args, signal);
    case "internet_search":
      return executeInternetSearchTool({ query: String(args.query || ""), language }, signal);
    case "calculate_distance":
      return executeDistanceTool(args, signal);
  }
}

function cleanExtractedPlace(raw: string): string {
  let cleaned = raw
    .replace(
      /^(?:.*?(?:^|\s)(?:and|aur|और|tell me|what is|calculate|check|बताओ|बताइए|जिया|अभी|जरा|कृपया|आज)\s+)/i,
      ""
    )
    .replace(/\s+(?:की|में|का|तक|है|हैं|कितनी|कितना)$/i, "")
    .trim();

  // If multiple words remain and a known city sits at the end (e.g., "अभी मुजफ्फरपुर"), prefer the city name
  const lower = cleaned.toLowerCase();
  for (const city of KNOWN_INDIA_CITIES) {
    for (const k of city.keys) {
      if (lower === k) return cleaned;
      if (lower.endsWith(` ${k}`)) {
        return cleaned.slice(cleaned.length - k.length).trim();
      }
    }
  }

  return cleaned;
}

/**
 * Parses origin and destination from natural Hindi, Hinglish, or English distance queries.
 */
function extractDistanceEndpoints(prompt: string): { origin?: string; destination?: string } {
  const clean = prompt
    .replace(/[?!।.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Focus on the distance clause if the prompt combines multiple questions with "और" / "and"
  const clauses = clean
    .split(/\s+(?:और|and|तथा)\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const distanceClause =
    clauses.find((c) =>
      /(कितनी दूर|कितना दूर|दूरी|distance|how far|kitni door|kitna door|travel time|कितना समय|route|directions)/i.test(
        c
      )
    ) || clean;

  // Pattern 1 (English): "how far is <Dest> from <Origin>" / "distance of <Dest> from <Origin>"
  const enDestFromOrigin = distanceClause.match(
    /(?:how\s+far\s+is|distance\s+(?:of|to))\s+([A-Za-z\u0900-\u097F\s-]{2,35}?)\s+from\s+([A-Za-z\u0900-\u097F\s-]{2,35}?)(?:\s+(?:by road|now|today)|$)/i
  );
  if (enDestFromOrigin) {
    return {
      origin: cleanExtractedPlace(enDestFromOrigin[2]),
      destination: cleanExtractedPlace(enDestFromOrigin[1]),
    };
  }

  // Pattern 2 (English): "from <Origin> to <Dest>"
  const enFromTo = distanceClause.match(
    /\bfrom\s+([A-Za-z\u0900-\u097F\s-]{2,35}?)\s+to\s+([A-Za-z\u0900-\u097F\s-]{2,35}?)(?:\s+(?:distance|how far|travel|time|by road|km|kitni|kitna)|$)/i
  );
  if (enFromTo) {
    return {
      origin: cleanExtractedPlace(enFromTo[1]),
      destination: cleanExtractedPlace(enFromTo[2]),
    };
  }

  // Pattern 3 (English): "between <Origin> and <Dest>"
  const enBetween = clean.match(
    /\bbetween\s+([A-Za-z\u0900-\u097F\s-]{2,35}?)\s+and\s+([A-Za-z\u0900-\u097F\s-]{2,35}?)(?:\s+(?:by road|km|distance)|$)/i
  );
  if (enBetween) {
    return {
      origin: cleanExtractedPlace(enBetween[1]),
      destination: cleanExtractedPlace(enBetween[2]),
    };
  }

  // Pattern 4 (Hindi/Hinglish): "<Origin> से <Destination> की दूरी / कितनी दूर / तक / जाने में"
  const hiSeTo = distanceClause.match(
    /([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s-]{1,35}?)\s+(?:से|se)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s-]{1,35}?)(?:\s+(?:की\s+दूरी|कितनी\s+दूर|कितना\s+दूर|तक|जाने|ki\s+duri|kitni\s+door|kitna\s+samay|distance|how\s+far)|$)/i
  );
  if (hiSeTo) {
    const o = cleanExtractedPlace(hiSeTo[1]);
    const d = cleanExtractedPlace(hiSeTo[2]);
    if (o && d) return { origin: o, destination: d };
  }

  // Pattern 5: Single city mentioned with distance ("पटना कितनी दूर है", "how far is Patna")
  const singleDestEn = distanceClause.match(
    /(?:how far is|distance to)\s+(?:to\s+)?([A-Za-z\u0900-\u097F\s-]{2,35})/i
  );
  if (singleDestEn) {
    const dest = singleDestEn[1].replace(/\b(from here|by road|now)\b/gi, "").trim();
    if (dest) return { origin: DEFAULT_ASSISTANT_LOCATION.label, destination: dest };
  }

  const singleDestHi = distanceClause.match(
    /([A-Za-z\u0900-\u097F-]{2,30})\s+(?:कितनी\s+दूर|कितना\s+दूर|की\s+दूरी)/i
  );
  if (singleDestHi) {
    const dest = cleanExtractedPlace(singleDestHi[1]);
    if (dest) return { origin: DEFAULT_ASSISTANT_LOCATION.label, destination: dest };
  }

  return {};
}

/**
 * Extracts city/location from weather or time queries.
 */
function extractCityFromQuery(prompt: string): string | undefined {
  const lower = prompt.toLowerCase();
  for (const city of KNOWN_INDIA_CITIES) {
    if (city.keys.some((k) => lower.includes(k))) {
      return city.displayName;
    }
  }
  const inMatch = prompt.match(/\b(?:in|at|for|of)\s+([A-Za-z\u0900-\u097F\s]{2,35}?)(?:\s+(?:today|now|weather|time|tomorrow)|[?!।.,]|$)/i);
  if (inMatch) {
    const cand = inMatch[1].trim();
    if (!/^(12|24|hour|hours|format|hindi|english|india)$/i.test(cand)) {
      return cand;
    }
  }
  const hiMatch = prompt.match(/([A-Za-z\u0900-\u097F]{2,30})\s+(?:में|का|के)\s+(?:मौसम|तापमान|बारिश|समय|कितना बजा|कितने बजे)/i);
  if (hiMatch) {
    return hiMatch[1].trim();
  }
  return undefined;
}

/**
 * Unified Intent Detector & Multi-Tool Planner used identically by Text Mode and Voice Mode.
 */
export function planToolsForPrompt(params: {
  prompt: string;
  enableSearch?: boolean;
  enableMaps?: boolean;
}): PlannedToolCall[] {
  const prompt = (params.prompt || "").trim();
  const lower = prompt.toLowerCase();
  const planned: PlannedToolCall[] = [];

  // 1. Live System Clock / Date / Day Intent
  const asksTravelDurationOnly =
    /(कितना समय लगेगा|यात्रा में कितना समय|travel time|how long will it take|drive time)/i.test(
      prompt
    );
  const hasTimeIntent =
    !asksTravelDurationOnly &&
    /(कितना बजा|कितने बजे|क्या समय|अभी का समय|अभी समय|कौन[- ]?सी तारीख|आज की तारीख|कौन[- ]?सा दिन|आज क्या दिन|आज कौन सा वार|current time|what time|time is it|time in|what date|today'?s date|what day|kitna baja|kitne baje|kya samay|kya time|abhi time|abhi samay|aaj ki tarikh|aaj kaun sa din)/i.test(
      prompt
    );

  if (hasTimeIntent) {
    const format: "12h" | "24h" | "both" = /24[- ]?hour|24 घंटे|military/i.test(prompt)
      ? "24h"
      : /12[- ]?hour|12 घंटे/i.test(prompt)
      ? "12h"
      : "both";
    planned.push({
      tool: "get_current_time",
      args: {
        location: extractCityFromQuery(prompt),
        format,
      },
      step: "checking_time",
      labelEn: "Checking Current Time...",
      labelHi: "वर्तमान समय देख रही हूँ...",
    });
  }

  // 2. WeatherAPI Intent
  const hasWeatherIntent =
    /(मौसम|तापमान|बारिश|बरसात|नमी|हवा की गति|सूर्योदय|सूर्यास्त|weather|forecast|temperature|temp\b|humidity|wind speed|rain|rainfall|sunrise|sunset|mausam|barish|tapman)/i.test(
      prompt
    );

  if (hasWeatherIntent) {
    planned.push({
      tool: "get_weather",
      args: {
        location: extractCityFromQuery(prompt),
        days: /(tomorrow|kal|कल|week|forecast|अगले|आने वाले|पूरी)/i.test(prompt) ? 3 : 1,
      },
      step: "checking_weather",
      labelEn: "Checking Weather...",
      labelHi: "मौसम की जानकारी ले रही हूँ...",
    });
  }

  // 3. Distance / Routing Intent
  const hasDistanceIntent =
    /(कितनी दूर|कितना दूर|दूरी|distance|how far|kitni door|kitna door|travel time|कितना समय लगेगा|यात्रा में कितना समय|route from|directions from)/i.test(
      prompt
    );

  if (hasDistanceIntent) {
    const endpoints = extractDistanceEndpoints(prompt);
    planned.push({
      tool: "calculate_distance",
      args: {
        origin: endpoints.origin || DEFAULT_ASSISTANT_LOCATION.label,
        destination: endpoints.destination || "",
      },
      step: "calculating_distance",
      labelEn: "Calculating Distance...",
      labelHi: "दूरी और रूट की गणना कर रही हूँ...",
    });
  }

  // 4. Real-Time Internet Search Intent (always available in BOTH Text & Voice modes!)
  const explicitlyForcedSearch = Boolean(params.enableSearch);
  const hasSearchIntent =
    explicitlyForcedSearch ||
    /(latest news|breaking news|current news|today'?s news|search the internet|search internet|search web|look up|google search|exam notification|latest notification|admit card|result date|live score|stock price|current price|what is happening|ताज़ा खबर|ताजा खबर|आज की खबर|मुख्य समाचार|नया नोटिफिकेशन|नई नोटिफिकेशन|परीक्षा|रिजल्ट|इंटरनेट पर|इंटरनेट से|खोजो|सर्च करो|वेबसाइट|ताजा अपडेट|लेटेस्ट न्यूज़|लेटेस्ट अपडेट|भारत में अभी क्या हो रहा)/i.test(
      prompt
    );

  // Also catch general "latest / current / 2026" informational queries if not already purely covered by time/weather/distance
  const generalCurrentInfoIntent =
    !hasTimeIntent &&
    !hasWeatherIntent &&
    !hasDistanceIntent &&
    /(latest|recent|current|today|2025|2026|अभी क्या हो रहा|नवीनतम|ताजा)/i.test(lower);

  if (hasSearchIntent || generalCurrentInfoIntent) {
    planned.push({
      tool: "internet_search",
      args: { query: prompt },
      step: "searching_web",
      labelEn: "Searching the Internet...",
      labelHi: "इंटरनेट पर खोज रही हूँ...",
    });
  }

  return planned;
}
