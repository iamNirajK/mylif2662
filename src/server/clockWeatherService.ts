import type {
  ClockTimeData,
  Language,
  WeatherDailyItem,
  WeatherHourlyItem,
  WeatherIntelligenceData,
} from "../types.js";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

// In-memory TTL caches to avoid unnecessary API requests
interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GEO_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

const weatherCache = new Map<string, CacheEntry<WeatherIntelligenceData>>();
const geoCache = new Map<string, CacheEntry<GeoLocationResult>>();

export interface GeoLocationResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

// Hindi-to-English city transliteration helper for Open-Meteo Geocoding & IANA timezone lookup
const HINDI_CITY_ALIASES: Record<string, string> = {
  "दिल्ली": "Delhi",
  "नई दिल्ली": "New Delhi",
  "पटना": "Patna",
  "मुंबई": "Mumbai",
  "बेंगलुरु": "Bengaluru",
  "बैंगलोर": "Bangalore",
  "कोलकाता": "Kolkata",
  "चेन्नई": "Chennai",
  "हैदराबाद": "Hyderabad",
  "पुणे": "Pune",
  "जयपुर": "Jaipur",
  "लखनऊ": "Lucknow",
  "वाराणसी": "Varanasi",
  "बनारस": "Varanasi",
  "अहमदाबाद": "Ahmedabad",
  "चंडीगढ़": "Chandigarh",
  "भोपाल": "Bhopal",
  "इंदौर": "Indore",
  "रांची": "Ranchi",
  "गया": "Gaya",
  "सूरत": "Surat",
  "कानपुर": "Kanpur",
  "आगरा": "Agra",
  "नोएडा": "Noida",
  "लंदन": "London",
  "न्यूयॉर्क": "New York",
  "न्यू यॉर्क": "New York",
  "टोक्यो": "Tokyo",
  "दुबई": "Dubai",
  "पेरिस": "Paris",
  "सिंगापुर": "Singapore",
  "सिडनी": "Sydney",
  "टोरंटो": "Toronto",
  "बर्लिन": "Berlin",
  "मास्को": "Moscow",
  "काठमांडू": "Kathmandu",
  "ढाका": "Dhaka",
};

// Direct IANA timezone dictionary for fast, zero-latency worldwide city time lookup
const CITY_TIMEZONE_MAP: Record<string, { city: string; timezone: string }> = {
  delhi: { city: "Delhi", timezone: "Asia/Kolkata" },
  "new delhi": { city: "New Delhi", timezone: "Asia/Kolkata" },
  patna: { city: "Patna", timezone: "Asia/Kolkata" },
  mumbai: { city: "Mumbai", timezone: "Asia/Kolkata" },
  bombay: { city: "Mumbai", timezone: "Asia/Kolkata" },
  bengaluru: { city: "Bengaluru", timezone: "Asia/Kolkata" },
  bangalore: { city: "Bengaluru", timezone: "Asia/Kolkata" },
  kolkata: { city: "Kolkata", timezone: "Asia/Kolkata" },
  calcutta: { city: "Kolkata", timezone: "Asia/Kolkata" },
  chennai: { city: "Chennai", timezone: "Asia/Kolkata" },
  hyderabad: { city: "Hyderabad", timezone: "Asia/Kolkata" },
  pune: { city: "Pune", timezone: "Asia/Kolkata" },
  jaipur: { city: "Jaipur", timezone: "Asia/Kolkata" },
  lucknow: { city: "Lucknow", timezone: "Asia/Kolkata" },
  varanasi: { city: "Varanasi", timezone: "Asia/Kolkata" },
  ahmedabad: { city: "Ahmedabad", timezone: "Asia/Kolkata" },
  chandigarh: { city: "Chandigarh", timezone: "Asia/Kolkata" },
  bhopal: { city: "Bhopal", timezone: "Asia/Kolkata" },
  indore: { city: "Indore", timezone: "Asia/Kolkata" },
  ranchi: { city: "Ranchi", timezone: "Asia/Kolkata" },
  noida: { city: "Noida", timezone: "Asia/Kolkata" },
  india: { city: "India (IST)", timezone: "Asia/Kolkata" },
  london: { city: "London", timezone: "Europe/London" },
  uk: { city: "London (UK)", timezone: "Europe/London" },
  "new york": { city: "New York", timezone: "America/New_York" },
  nyc: { city: "New York", timezone: "America/New_York" },
  washington: { city: "Washington, D.C.", timezone: "America/New_York" },
  boston: { city: "Boston", timezone: "America/New_York" },
  miami: { city: "Miami", timezone: "America/New_York" },
  chicago: { city: "Chicago", timezone: "America/Chicago" },
  dallas: { city: "Dallas", timezone: "America/Chicago" },
  denver: { city: "Denver", timezone: "America/Denver" },
  "los angeles": { city: "Los Angeles", timezone: "America/Los_Angeles" },
  la: { city: "Los Angeles", timezone: "America/Los_Angeles" },
  "san francisco": { city: "San Francisco", timezone: "America/Los_Angeles" },
  seattle: { city: "Seattle", timezone: "America/Los_Angeles" },
  toronto: { city: "Toronto", timezone: "America/Toronto" },
  vancouver: { city: "Vancouver", timezone: "America/Vancouver" },
  tokyo: { city: "Tokyo", timezone: "Asia/Tokyo" },
  osaka: { city: "Osaka", timezone: "Asia/Tokyo" },
  dubai: { city: "Dubai", timezone: "Asia/Dubai" },
  "abu dhabi": { city: "Abu Dhabi", timezone: "Asia/Dubai" },
  riyadh: { city: "Riyadh", timezone: "Asia/Riyadh" },
  doha: { city: "Doha", timezone: "Asia/Qatar" },
  singapore: { city: "Singapore", timezone: "Asia/Singapore" },
  "hong kong": { city: "Hong Kong", timezone: "Asia/Hong_Kong" },
  beijing: { city: "Beijing", timezone: "Asia/Shanghai" },
  shanghai: { city: "Shanghai", timezone: "Asia/Shanghai" },
  seoul: { city: "Seoul", timezone: "Asia/Seoul" },
  bangkok: { city: "Bangkok", timezone: "Asia/Bangkok" },
  jakarta: { city: "Jakarta", timezone: "Asia/Jakarta" },
  kathmandu: { city: "Kathmandu", timezone: "Asia/Kathmandu" },
  dhaka: { city: "Dhaka", timezone: "Asia/Dhaka" },
  karachi: { city: "Karachi", timezone: "Asia/Karachi" },
  lahore: { city: "Lahore", timezone: "Asia/Karachi" },
  colombo: { city: "Colombo", timezone: "Asia/Colombo" },
  paris: { city: "Paris", timezone: "Europe/Paris" },
  berlin: { city: "Berlin", timezone: "Europe/Berlin" },
  frankfurt: { city: "Frankfurt", timezone: "Europe/Berlin" },
  rome: { city: "Rome", timezone: "Europe/Rome" },
  madrid: { city: "Madrid", timezone: "Europe/Madrid" },
  amsterdam: { city: "Amsterdam", timezone: "Europe/Amsterdam" },
  zurich: { city: "Zurich", timezone: "Europe/Zurich" },
  moscow: { city: "Moscow", timezone: "Europe/Moscow" },
  istanbul: { city: "Istanbul", timezone: "Europe/Istanbul" },
  cairo: { city: "Cairo", timezone: "Africa/Cairo" },
  nairobi: { city: "Nairobi", timezone: "Africa/Nairobi" },
  johannesburg: { city: "Johannesburg", timezone: "Africa/Johannesburg" },
  sydney: { city: "Sydney", timezone: "Australia/Sydney" },
  melbourne: { city: "Melbourne", timezone: "Australia/Melbourne" },
  auckland: { city: "Auckland", timezone: "Pacific/Auckland" },
  "sao paulo": { city: "São Paulo", timezone: "America/Sao_Paulo" },
  "mexico city": { city: "Mexico City", timezone: "America/Mexico_City" },
};

export function normalizeCityName(raw: string): string {
  const trimmed = raw.trim().replace(/[?.!,।]+$/g, "").trim();
  if (HINDI_CITY_ALIASES[trimmed]) {
    return HINDI_CITY_ALIASES[trimmed];
  }
  return trimmed;
}

export function decodeWmoWeatherCode(code: number): { en: string; hi: string } {
  const map: Record<number, { en: string; hi: string }> = {
    0: { en: "Clear sky", hi: "साफ़ आसमान" },
    1: { en: "Mainly clear", hi: "मुख्यतः साफ़" },
    2: { en: "Partly cloudy", hi: "आंशिक बादल" },
    3: { en: "Overcast", hi: "घने बादल" },
    45: { en: "Fog", hi: "कोहरा" },
    48: { en: "Depositing rime fog", hi: "घना कोहरा" },
    51: { en: "Light drizzle", hi: "हल्की बूंदाबांदी" },
    53: { en: "Moderate drizzle", hi: "मध्यम बूंदाबांदी" },
    55: { en: "Dense drizzle", hi: "तेज़ बूंदाबांदी" },
    56: { en: "Light freezing drizzle", hi: "हल्की बर्फीली बूंदाबांदी" },
    57: { en: "Dense freezing drizzle", hi: "तेज़ बर्फीली बूंदाबांदी" },
    61: { en: "Slight rain", hi: "हल्की बारिश" },
    63: { en: "Moderate rain", hi: "मध्यम बारिश" },
    65: { en: "Heavy rain", hi: "भारी बारिश" },
    66: { en: "Light freezing rain", hi: "हल्की बर्फीली बारिश" },
    67: { en: "Heavy freezing rain", hi: "भारी बर्फीली बारिश" },
    71: { en: "Slight snowfall", hi: "हल्की बर्फबारी" },
    73: { en: "Moderate snowfall", hi: "मध्यम बर्फबारी" },
    75: { en: "Heavy snowfall", hi: "भारी बर्फबारी" },
    77: { en: "Snow grains", hi: "बर्फ के कण" },
    80: { en: "Slight rain showers", hi: "हल्की बौछारें" },
    81: { en: "Moderate rain showers", hi: "मध्यम बौछारें" },
    82: { en: "Violent rain showers", hi: "तेज़ मूसलाधार बौछारें" },
    85: { en: "Slight snow showers", hi: "हल्की बर्फीली बौछारें" },
    86: { en: "Heavy snow showers", hi: "भारी बर्फीली बौछारें" },
    95: { en: "Thunderstorm", hi: "गरज के साथ तूफ़ान" },
    96: { en: "Thunderstorm with slight hail", hi: "ओलों व गरज के साथ तूफ़ान" },
    99: { en: "Thunderstorm with heavy hail", hi: "भारी ओलावृष्टि व तूफ़ान" },
  };
  return map[code] || { en: "Variable weather", hi: "बदलता मौसम" };
}

function getPeriodOfDay(hour24: number): {
  periodOfDay: ClockTimeData["periodOfDay"];
  periodLabelEn: string;
  periodLabelHi: string;
} {
  if (hour24 >= 5 && hour24 < 12) {
    return { periodOfDay: "morning", periodLabelEn: "Morning", periodLabelHi: "सुबह" };
  }
  if (hour24 >= 12 && hour24 < 17) {
    return { periodOfDay: "afternoon", periodLabelEn: "Afternoon", periodLabelHi: "दोपहर" };
  }
  if (hour24 >= 17 && hour24 < 21) {
    return { periodOfDay: "evening", periodLabelEn: "Evening", periodLabelHi: "शाम" };
  }
  return { periodOfDay: "night", periodLabelEn: "Night", periodLabelHi: "रात" };
}

export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatClockForTimezone(params: {
  timezone: string;
  city?: string;
  date?: Date;
  language?: Language;
}): ClockTimeData {
  const now = params.date || new Date();
  const tz = isValidIanaTimezone(params.timezone) ? params.timezone : "UTC";
  const locale = params.language === "hi" ? "hi-IN" : "en-US";

  const partsEn = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(now);

  const getPart = (type: string) => partsEn.find((p) => p.type === type)?.value || "";

  let hour24 = Number(getPart("hour"));
  if (hour24 === 24) hour24 = 0;
  const dayNumber = Number(getPart("day"));
  const year = Number(getPart("year"));

  const formattedTime = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  const formattedTime24 = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "long",
  }).format(now);

  const monthName = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    month: "long",
  }).format(now);

  const formattedDate = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  let utcOffset = "UTC";
  try {
    const offsetParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    utcOffset = offsetParts.find((p) => p.type === "timeZoneName")?.value || "UTC";
  } catch {}

  const period = getPeriodOfDay(hour24);

  return {
    city: params.city,
    timezone: tz,
    isoTimestamp: now.toISOString(),
    formattedTime,
    formattedTime24,
    formattedDate,
    weekday,
    dayNumber,
    monthName,
    year,
    hour24,
    ...period,
    utcOffset,
  };
}

export async function geocodeCity(rawCity: string): Promise<GeoLocationResult> {
  const normalized = normalizeCityName(rawCity);
  if (!normalized) {
    throw new Error("City name is required.");
  }

  const cacheKey = normalized.toLowerCase();
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL_MS) {
    return cached.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(normalized)}&count=5&language=en&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Open-Meteo Geocoding returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { results?: any[] };
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    if (!first) {
      throw new Error(`Could not find location "${normalized}".`);
    }

    const geo: GeoLocationResult = {
      name: String(first.name),
      admin1: first.admin1 ? String(first.admin1) : undefined,
      country: first.country ? String(first.country) : undefined,
      latitude: Number(first.latitude),
      longitude: Number(first.longitude),
      timezone: String(first.timezone || "UTC"),
    };

    geoCache.set(cacheKey, { value: geo, cachedAt: Date.now() });
    return geo;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new Error(`Location lookup timed out for "${normalized}".`);
    }
    throw err;
  }
}

export async function getTimeForCityOrTimezone(params: {
  city?: string;
  timezone?: string;
  language?: Language;
}): Promise<ClockTimeData> {
  const lang = params.language || "en";
  if (params.timezone && isValidIanaTimezone(params.timezone)) {
    return formatClockForTimezone({
      timezone: params.timezone,
      city: params.city,
      language: lang,
    });
  }

  if (params.city) {
    const cleanCity = normalizeCityName(params.city);
    const mapEntry = CITY_TIMEZONE_MAP[cleanCity.toLowerCase()];
    if (mapEntry) {
      return formatClockForTimezone({
        timezone: mapEntry.timezone,
        city: mapEntry.city,
        language: lang,
      });
    }

    // Dynamic worldwide fallback via Open-Meteo Geocoding IANA timezone field
    const geo = await geocodeCity(cleanCity);
    const displayCity = geo.country ? `${geo.name}, ${geo.country}` : geo.name;
    return formatClockForTimezone({
      timezone: geo.timezone,
      city: displayCity,
      language: lang,
    });
  }

  const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return formatClockForTimezone({
    timezone: fallbackTz,
    language: lang,
  });
}

export async function getWeatherIntelligence(params: {
  city?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  forceRefresh?: boolean;
  language?: Language;
}): Promise<WeatherIntelligenceData> {
  let geo: GeoLocationResult;

  if (params.city && params.city.trim().length > 0) {
    geo = await geocodeCity(params.city);
  } else if (
    typeof params.latitude === "number" &&
    typeof params.longitude === "number" &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude)
  ) {
    geo = {
      name: params.locationLabel?.trim() || "Current Location",
      latitude: params.latitude,
      longitude: params.longitude,
      timezone: "auto",
    };
  } else {
    throw new Error("Please provide a city name or grant location permission.");
  }

  const cacheKey = `${geo.latitude.toFixed(2)},${geo.longitude.toFixed(2)}`;
  const cachedEntry = weatherCache.get(cacheKey);
  if (
    !params.forceRefresh &&
    cachedEntry &&
    Date.now() - cachedEntry.cachedAt < WEATHER_CACHE_TTL_MS
  ) {
    return {
      ...cachedEntry.value,
      locationName: geo.name !== "Current Location" ? geo.name : cachedEntry.value.locationName,
      cached: true,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const query = new URLSearchParams({
      latitude: String(geo.latitude),
      longitude: String(geo.longitude),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m",
      hourly:
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
      timezone: "auto",
      forecast_days: "7",
      forecast_hours: "24",
    });

    const res = await fetch(`${OPEN_METEO_FORECAST_URL}?${query.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Open-Meteo Forecast API returned HTTP ${res.status}`);
    }

    const raw = (await res.json()) as any;
    if (!raw?.current) {
      throw new Error("Weather data was unavailable in Open-Meteo response.");
    }

    const resolvedTz = String(raw.timezone || geo.timezone || "UTC");
    const now = new Date();
    const lastUpdatedDisplay = new Intl.DateTimeFormat(
      params.language === "hi" ? "hi-IN" : "en-US",
      {
        timeZone: isValidIanaTimezone(resolvedTz) ? resolvedTz : "UTC",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    ).format(now);

    const currentCode = Number(raw.current.weather_code ?? 0);
    const currentCond = decodeWmoWeatherCode(currentCode);

    const hourlyTimes: string[] = Array.isArray(raw.hourly?.time) ? raw.hourly.time : [];
    const hourly: WeatherHourlyItem[] = hourlyTimes.slice(0, 24).map((t, idx) => {
      const code = Number(raw.hourly?.weather_code?.[idx] ?? 0);
      const cond = decodeWmoWeatherCode(code);
      const hourPart = t.split("T")[1] || t;
      return {
        time: t,
        hourLabel: hourPart.slice(0, 5),
        temperatureC: Number(raw.hourly?.temperature_2m?.[idx] ?? 0),
        apparentTemperatureC: Number(raw.hourly?.apparent_temperature?.[idx] ?? 0),
        humidity: Number(raw.hourly?.relative_humidity_2m?.[idx] ?? 0),
        precipitationProbability: Number(raw.hourly?.precipitation_probability?.[idx] ?? 0),
        precipitationMm: Number(raw.hourly?.precipitation?.[idx] ?? 0),
        windSpeedKmh: Number(raw.hourly?.wind_speed_10m?.[idx] ?? 0),
        weatherCode: code,
        conditionEn: cond.en,
        conditionHi: cond.hi,
      };
    });

    const dailyDates: string[] = Array.isArray(raw.daily?.time) ? raw.daily.time : [];
    const daily: WeatherDailyItem[] = dailyDates.slice(0, 7).map((d, idx) => {
      const code = Number(raw.daily?.weather_code?.[idx] ?? 0);
      const cond = decodeWmoWeatherCode(code);
      const parsedDate = new Date(`${d}T12:00:00Z`);
      const dayLabel =
        idx === 0
          ? params.language === "hi"
            ? "आज"
            : "Today"
          : idx === 1
          ? params.language === "hi"
            ? "कल"
            : "Tomorrow"
          : new Intl.DateTimeFormat(params.language === "hi" ? "hi-IN" : "en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(parsedDate);

      return {
        date: d,
        dayLabel,
        tempMaxC: Number(raw.daily?.temperature_2m_max?.[idx] ?? 0),
        tempMinC: Number(raw.daily?.temperature_2m_min?.[idx] ?? 0),
        apparentTempMaxC: Number(raw.daily?.apparent_temperature_max?.[idx] ?? 0),
        apparentTempMinC: Number(raw.daily?.apparent_temperature_min?.[idx] ?? 0),
        precipitationSumMm: Number(raw.daily?.precipitation_sum?.[idx] ?? 0),
        precipitationProbabilityMax: Number(raw.daily?.precipitation_probability_max?.[idx] ?? 0),
        windSpeedMaxKmh: Number(raw.daily?.wind_speed_10m_max?.[idx] ?? 0),
        sunrise: raw.daily?.sunrise?.[idx],
        sunset: raw.daily?.sunset?.[idx],
        weatherCode: code,
        conditionEn: cond.en,
        conditionHi: cond.hi,
      };
    });

    const result: WeatherIntelligenceData = {
      locationName: geo.name,
      admin1: geo.admin1,
      country: geo.country,
      latitude: Number(raw.latitude ?? geo.latitude),
      longitude: Number(raw.longitude ?? geo.longitude),
      timezone: resolvedTz,
      lastUpdatedIso: now.toISOString(),
      lastUpdatedDisplay,
      cached: false,
      current: {
        temperatureC: Number(raw.current.temperature_2m ?? 0),
        apparentTemperatureC: Number(raw.current.apparent_temperature ?? 0),
        humidity: Number(raw.current.relative_humidity_2m ?? 0),
        windSpeedKmh: Number(raw.current.wind_speed_10m ?? 0),
        windDirectionDeg: Number(raw.current.wind_direction_10m ?? 0),
        precipitationMm: Number(raw.current.precipitation ?? 0),
        cloudCoverPct: Number(raw.current.cloud_cover ?? 0),
        isDay: Boolean(raw.current.is_day),
        weatherCode: currentCode,
        conditionEn: currentCond.en,
        conditionHi: currentCond.hi,
      },
      hourly,
      daily,
    };

    weatherCache.set(cacheKey, { value: result, cachedAt: Date.now() });
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new Error("Open-Meteo weather request timed out.");
    }
    throw err;
  }
}

// ============================================================================
// AI TOOL-CALLING SYSTEM (OpenAI-format tool definitions + universal resolver)
// ============================================================================

export const CLOCK_AND_WEATHER_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description:
        "Get real-time clock, date, day, month, year, timezone, and morning/afternoon/evening/night period for the user's device timezone or any worldwide city.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City name worldwide (e.g., Delhi, London, New York, Patna). Leave empty for user's local device timezone.",
          },
          timezone: {
            type: "string",
            description: "Optional IANA timezone (e.g., Asia/Kolkata, Europe/London).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather_forecast",
      description:
        "Fetch live current weather, feels-like temperature, humidity, wind speed, precipitation, hourly forecast, and 7-day forecast using Open-Meteo for a city or coordinates.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City name (e.g., Patna, Delhi, London, New York).",
          },
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
      },
    },
  },
];

function extractCitiesFromPrompt(prompt: string): string[] {
  const found: string[] = [];
  const lower = prompt.toLowerCase();

  // 1. Check Hindi city names directly
  for (const [hiName, enName] of Object.entries(HINDI_CITY_ALIASES)) {
    if (prompt.includes(hiName) && !found.includes(enName)) {
      found.push(enName);
    }
  }

  // 2. Check known worldwide dictionary cities directly
  for (const [key, entry] of Object.entries(CITY_TIMEZONE_MAP)) {
    if (key.length <= 2 && key !== "uk" && key !== "la") continue;
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lower) && !found.includes(entry.city)) {
      found.push(entry.city);
    }
  }

  // 3. Extract generic "<preposition> <City>" patterns (e.g., "weather in Reykjavik", "time in zurich")
  const pattern =
    /\b(?:in|at|for|of)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)(?=\s*(?:[?,!.]|\band\b|\bor\b|\btoday\b|\btomorrow\b|\bnow\b|\bright\b|$))/gi;
  let match: RegExpExecArray | null;
  const stopWords = new Set([
    "today",
    "tomorrow",
    "now",
    "english",
    "hindi",
    "morning",
    "afternoon",
    "evening",
    "night",
    "google",
    "gmail",
    "calendar",
    "drive",
    "weather",
    "time",
    "what",
    "will",
    "how",
    "is",
    "me",
    "my",
    "here",
    "there",
    "the",
    "this",
    "that",
    "city",
    "area",
  ]);
  while ((match = pattern.exec(prompt)) !== null) {
    const candidate = match[1].trim();
    if (
      candidate.length > 2 &&
      !stopWords.has(candidate.toLowerCase()) &&
      !found.some((c) => c.toLowerCase() === candidate.toLowerCase())
    ) {
      found.push(candidate);
    }
  }

  // 4. Hindi "<City> में" / "<City> का मौसम" pattern
  const hiPattern = /([^\s,?.!]+)\s+(?:में|का|की|के)\s+(?:मौसम|बारिश|तापमान|समय|टाइम|बजे|गर्मी|ठंड)/g;
  while ((match = hiPattern.exec(prompt)) !== null) {
    const candidate = normalizeCityName(match[1]);
    if (
      candidate.length > 1 &&
      !["आज", "कल", "अभी", "यहाँ", "वहाँ", "भारत"].includes(candidate) &&
      !found.some((c) => c.toLowerCase() === candidate.toLowerCase())
    ) {
      found.push(candidate);
    }
  }

  return found.slice(0, 5);
}

export function detectClockAndWeatherIntents(prompt: string): {
  needsClock: boolean;
  needsWeather: boolean;
  cities: string[];
  clockCities: string[];
  weatherCities: string[];
} {
  const lower = prompt.toLowerCase();

  const isClockClause = (text: string) =>
    /\b(what time|current time|time now|time in|today'?s date|what date|what day|which day|which month|which year|morning|afternoon|evening|night|timezone|clock)\b/i.test(
      text.toLowerCase()
    ) ||
    /(अभी क्या समय|कितने बजे|आज की तारीख|आज क्या तारीख|कौन सा दिन|सुबह|दोपहर|शाम|रात|टाइम|समय क्या)/i.test(
      text
    );

  const isWeatherClause = (text: string) =>
    /\b(weather|forecast|temperature|temp|rain|raining|rainy|umbrella|hot|cold|humid|humidity|wind|climate|sunny|cloudy|storm|thunderstorm|snow|precipitation)\b/i.test(
      text.toLowerCase()
    ) ||
    /(मौसम|बारिश|तापमान|गर्मी|गरमी|ठंड|सर्दी|हवा|नमी|आसमान|धूप|बादल|तूफ़ान)/i.test(text);

  const needsClock = isClockClause(prompt);
  const needsWeather = isWeatherClause(prompt);

  const allCities = needsClock || needsWeather ? extractCitiesFromPrompt(prompt) : [];
  let clockCities = allCities;
  let weatherCities = allCities;

  if (needsClock && needsWeather) {
    const clauses = prompt.split(/[,;.?।\n]+|\band\b|\bऔर\b/i).map((c) => c.trim()).filter(Boolean);
    const matchedClock: string[] = [];
    const matchedWeather: string[] = [];

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const clauseCities = extractCitiesFromPrompt(clause);
      if (clauseCities.length === 0) continue;
      if (isWeatherClause(clause) && !isClockClause(clause)) {
        for (const c of clauseCities) if (!matchedWeather.includes(c)) matchedWeather.push(c);
      } else if (isClockClause(clause) && !isWeatherClause(clause)) {
        for (const c of clauseCities) if (!matchedClock.includes(c)) matchedClock.push(c);
      } else if (i > 0 && isClockClause(clauses[i - 1]) && !isWeatherClause(clauses[i - 1])) {
        // Handles "What time is it in Delhi and London, ..." where "London" follows "and"
        for (const c of clauseCities) if (!matchedClock.includes(c)) matchedClock.push(c);
      }
    }

    if (matchedClock.length > 0) clockCities = matchedClock;
    if (matchedWeather.length > 0) weatherCities = matchedWeather;
  }

  return { needsClock, needsWeather, cities: allCities, clockCities, weatherCities };
}

export interface AutoResolvedToolResult {
  clockResults: ClockTimeData[];
  weatherResults: WeatherIntelligenceData[];
  toolContextPrompt: string;
  toolErrors: string[];
}

export async function resolveClockAndWeatherForPrompt(params: {
  prompt: string;
  language?: Language;
  deviceTimeZone?: string;
  userLocation?: { latitude: number; longitude: number } | null;
}): Promise<AutoResolvedToolResult> {
  const { needsClock, needsWeather, clockCities, weatherCities } = detectClockAndWeatherIntents(params.prompt);
  const clockResults: ClockTimeData[] = [];
  const weatherResults: WeatherIntelligenceData[] = [];
  const toolErrors: string[] = [];

  if (!needsClock && !needsWeather) {
    return { clockResults, weatherResults, toolContextPrompt: "", toolErrors };
  }

  const lang = params.language || "en";
  const localTz =
    params.deviceTimeZone && isValidIanaTimezone(params.deviceTimeZone)
      ? params.deviceTimeZone
      : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // 1. Execute Clock Tool(s)
  if (needsClock) {
    if (clockCities.length > 0) {
      const settled = await Promise.allSettled(
        clockCities.map((city) => getTimeForCityOrTimezone({ city, language: lang }))
      );
      for (let i = 0; i < settled.length; i++) {
        const item = settled[i];
        if (item.status === "fulfilled") {
          clockResults.push(item.value);
        } else {
          toolErrors.push(`Time lookup failed for ${clockCities[i]}: ${item.reason?.message || "Unknown error"}`);
        }
      }
    }
    // Always include the user's device timezone clock for local questions or comparison
    if (clockCities.length === 0 || !clockResults.some((c) => c.timezone === localTz)) {
      clockResults.unshift(
        formatClockForTimezone({
          timezone: localTz,
          city: "Your Device Local Time",
          language: lang,
        })
      );
    }
  }

  // 2. Execute Weather Tool(s)
  if (needsWeather) {
    if (weatherCities.length > 0) {
      const settled = await Promise.allSettled(
        weatherCities.map((city) => getWeatherIntelligence({ city, language: lang }))
      );
      for (let i = 0; i < settled.length; i++) {
        const item = settled[i];
        if (item.status === "fulfilled") {
          weatherResults.push(item.value);
        } else {
          toolErrors.push(
            `Weather lookup failed for "${weatherCities[i]}": ${item.reason?.message || "Service unavailable"}`
          );
        }
      }
    } else if (
      params.userLocation &&
      typeof params.userLocation.latitude === "number" &&
      typeof params.userLocation.longitude === "number"
    ) {
      try {
        const w = await getWeatherIntelligence({
          latitude: params.userLocation.latitude,
          longitude: params.userLocation.longitude,
          locationLabel: "Your Current Location",
          language: lang,
        });
        weatherResults.push(w);
      } catch (err: any) {
        toolErrors.push(`Weather lookup failed for your location: ${err?.message || "Service unavailable"}`);
      }
    } else {
      toolErrors.push(
        "No city name was specified and device location permission was not provided for weather lookup."
      );
    }
  }

  // Build strict factual tool-context instructions for the LLM
  const blocks: string[] = [];
  if (clockResults.length > 0) {
    blocks.push(
      `[LIVE CLOCK TOOL DATA (Real Device/IANA Time — NEVER invent time/date values)]:\n${JSON.stringify(
        clockResults,
        null,
        2
      )}`
    );
  }
  if (weatherResults.length > 0) {
    const compactWeather = weatherResults.map((w) => ({
      location: [w.locationName, w.admin1, w.country].filter(Boolean).join(", "),
      timezone: w.timezone,
      lastUpdated: w.lastUpdatedDisplay,
      lastUpdatedIso: w.lastUpdatedIso,
      cached: w.cached,
      current: w.current,
      today: w.daily[0],
      tomorrow: w.daily[1],
      next6Hours: w.hourly.slice(0, 6),
      sevenDayForecast: w.daily,
    }));
    blocks.push(
      `[LIVE OPEN-METEO WEATHER TOOL DATA (NEVER invent temperatures, rain, or forecasts)]:\n${JSON.stringify(
        compactWeather,
        null,
        2
      )}`
    );
  }
  if (toolErrors.length > 0) {
    blocks.push(`[TOOL NOTICE]: ${toolErrors.join(" | ")}`);
  }

  const toolContextPrompt =
    blocks.length > 0
      ? `\n\n--- VERIFIED LIVE TOOL OUTPUT ---\n${blocks.join(
          "\n\n"
        )}\nINSTRUCTIONS FOR TOOL RESULTS:\n1. Answer strictly using the verified tool data above. NEVER invent weather numbers, precipitation chances, or clock times.\n2. For weather answers, ALWAYS explicitly include the resolved Location name and the Last Updated time (${
          weatherResults[0]?.lastUpdatedDisplay || "from tool data"
        }).\n3. If a location was not provided and geolocation permission wasn't granted, politely ask the user to name a city or allow location access.\n4. Respond clearly in ${
          lang === "hi" ? "Hindi (हिंदी)" : "English"
        }.`
      : "";

  return {
    clockResults,
    weatherResults,
    toolContextPrompt,
    toolErrors,
  };
}

export async function executeClockWeatherTool(
  toolName: string,
  args: Record<string, any>,
  context?: { language?: Language; deviceTimeZone?: string; userLocation?: { latitude: number; longitude: number } | null }
): Promise<ClockTimeData | WeatherIntelligenceData> {
  const language = context?.language || "en";
  if (toolName === "get_current_time") {
    return await getTimeForCityOrTimezone({
      city: typeof args.city === "string" ? args.city : undefined,
      timezone: typeof args.timezone === "string" ? args.timezone : context?.deviceTimeZone,
      language,
    });
  }
  if (toolName === "get_weather_forecast") {
    return await getWeatherIntelligence({
      city: typeof args.city === "string" ? args.city : undefined,
      latitude: typeof args.latitude === "number" ? args.latitude : context?.userLocation?.latitude,
      longitude: typeof args.longitude === "number" ? args.longitude : context?.userLocation?.longitude,
      forceRefresh: Boolean(args.forceRefresh),
      language,
    });
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

