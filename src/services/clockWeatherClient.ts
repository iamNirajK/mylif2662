import type { ClockTimeData, Language, WeatherIntelligenceData } from "../types.ts";

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function resolvePeriodOfDay(hour24: number): {
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

export function getLocalDeviceClock(
  language: Language,
  timezone?: string,
  city?: string
): ClockTimeData {
  const now = new Date();
  const tz = timezone || getDeviceTimeZone();
  const locale = language === "hi" ? "hi-IN" : "en-US";

  let validTz = tz;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: validTz });
  } catch {
    validTz = "UTC";
  }

  const partsEn = new Intl.DateTimeFormat("en-US", {
    timeZone: validTz,
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
    timeZone: validTz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  const formattedTime24 = new Intl.DateTimeFormat("en-GB", {
    timeZone: validTz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone: validTz,
    weekday: "long",
  }).format(now);

  const monthName = new Intl.DateTimeFormat(locale, {
    timeZone: validTz,
    month: "long",
  }).format(now);

  const formattedDate = new Intl.DateTimeFormat(locale, {
    timeZone: validTz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  let utcOffset = "UTC";
  try {
    const offsetParts = new Intl.DateTimeFormat("en-US", {
      timeZone: validTz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    utcOffset = offsetParts.find((p) => p.type === "timeZoneName")?.value || "UTC";
  } catch {}

  const period = resolvePeriodOfDay(hour24);

  return {
    city,
    timezone: validTz,
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

export async function fetchCityClock(city: string, language: Language): Promise<ClockTimeData> {
  const params = new URLSearchParams({ city, language });
  const res = await fetch(`/api/clock?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Could not resolve timezone for "${city}".`);
  }
  return await res.json();
}

export async function fetchWeatherByCity(
  city: string,
  language: Language,
  forceRefresh = false
): Promise<WeatherIntelligenceData> {
  const params = new URLSearchParams({
    city,
    language,
    refresh: forceRefresh ? "true" : "false",
  });
  const res = await fetch(`/api/weather?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Could not fetch weather for "${city}".`);
  }
  return await res.json();
}

export async function fetchWeatherByCoordinates(
  latitude: number,
  longitude: number,
  language: Language,
  forceRefresh = false,
  label?: string
): Promise<WeatherIntelligenceData> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    language,
    refresh: forceRefresh ? "true" : "false",
  });
  if (label) params.set("label", label);
  const res = await fetch(`/api/weather?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Could not fetch weather for your coordinates.");
  }
  return await res.json();
}

export async function requestBrowserLocationPermission(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser.");
  }

  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Location permission was denied. Please search by city name instead."));
        } else {
          reject(new Error("Unable to detect your location. Please search by city name."));
        }
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
    );
  });
}

export async function getLocationIfAlreadyGranted(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  try {
    if (navigator.permissions && typeof navigator.permissions.query === "function") {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (status.state !== "granted") {
        return null;
      }
      return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 3000, maximumAge: 300000 }
        );
      });
    }
  } catch {
    return null;
  }
  return null;
}
