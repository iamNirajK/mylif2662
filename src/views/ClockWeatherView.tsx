import React, { useEffect, useState } from "react";
import type { ClockTimeData, Language, WeatherIntelligenceData } from "../types.ts";
import {
  fetchCityClock,
  fetchWeatherByCity,
  fetchWeatherByCoordinates,
  getLocalDeviceClock,
  getLocationIfAlreadyGranted,
  requestBrowserLocationPermission,
} from "../services/clockWeatherClient.ts";
import {
  Clock,
  CloudRain,
  Compass,
  Droplets,
  Globe,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  AlertCircle,
  CalendarDays,
} from "lucide-react";

interface ClockWeatherViewProps {
  language: Language;
  onQuickPrompt: (prompt: string) => void;
}

const WORLD_CITIES: Array<{ label: string; tz: string }> = [
  { label: "Delhi (IST)", tz: "Asia/Kolkata" },
  { label: "London (UK)", tz: "Europe/London" },
  { label: "New York (US)", tz: "America/New_York" },
  { label: "Tokyo (JP)", tz: "Asia/Tokyo" },
  { label: "Dubai (UAE)", tz: "Asia/Dubai" },
  { label: "Singapore", tz: "Asia/Singapore" },
];

export const ClockWeatherView: React.FC<ClockWeatherViewProps> = ({
  language,
  onQuickPrompt,
}) => {
  const [localClock, setLocalClock] = useState<ClockTimeData>(() =>
    getLocalDeviceClock(language)
  );
  const [worldClocks, setWorldClocks] = useState<ClockTimeData[]>(() =>
    WORLD_CITIES.map((c) => getLocalDeviceClock(language, c.tz, c.label))
  );

  // Custom world city time lookup
  const [cityClockInput, setCityClockInput] = useState("");
  const [customCityClock, setCustomCityClock] = useState<ClockTimeData | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockError, setClockError] = useState<string | null>(null);

  // Weather state
  const [cityQuery, setCityQuery] = useState("Delhi");
  const [weather, setWeather] = useState<WeatherIntelligenceData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [coordsUsed, setCoordsUsed] = useState<{ lat: number; lon: number } | null>(null);

  // Live 1-second real-time clock tick
  useEffect(() => {
    const updateTicks = () => {
      setLocalClock(getLocalDeviceClock(language));
      setWorldClocks(WORLD_CITIES.map((c) => getLocalDeviceClock(language, c.tz, c.label)));
      setCustomCityClock((prev) =>
        prev ? getLocalDeviceClock(language, prev.timezone, prev.city) : null
      );
    };
    updateTicks();
    const id = window.setInterval(updateTicks, 1000);
    return () => clearInterval(id);
  }, [language]);

  // Load initial weather (check already-granted permission first without prompting; otherwise default to Delhi)
  useEffect(() => {
    let cancelled = false;
    const initWeather = async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const grantedLoc = await getLocationIfAlreadyGranted();
        if (grantedLoc && !cancelled) {
          setCoordsUsed({ lat: grantedLoc.latitude, lon: grantedLoc.longitude });
          const w = await fetchWeatherByCoordinates(
            grantedLoc.latitude,
            grantedLoc.longitude,
            language,
            false,
            "Current Location"
          );
          if (!cancelled) setWeather(w);
        } else {
          const w = await fetchWeatherByCity("Delhi", language, false);
          if (!cancelled) setWeather(w);
        }
      } catch (err: any) {
        if (!cancelled) setWeatherError(err?.message || "Failed to load initial weather.");
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };
    initWeather();
    return () => {
      cancelled = true;
    };
  }, [language]);

  const handleSearchCityWeather = async (targetCity?: string, forceRefresh = false) => {
    const name = (targetCity ?? cityQuery).trim();
    if (!name) return;
    setWeatherLoading(true);
    setWeatherError(null);
    setCoordsUsed(null);
    try {
      const data = await fetchWeatherByCity(name, language, forceRefresh);
      setWeather(data);
      setCityQuery(data.locationName);
    } catch (err: any) {
      setWeatherError(err?.message || `Could not fetch weather for "${name}".`);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleUseMyLocation = async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const loc = await requestBrowserLocationPermission();
      setCoordsUsed({ lat: loc.latitude, lon: loc.longitude });
      const data = await fetchWeatherByCoordinates(
        loc.latitude,
        loc.longitude,
        language,
        true,
        language === "hi" ? "आपका वर्तमान स्थान" : "Your Current Location"
      );
      setWeather(data);
    } catch (err: any) {
      setWeatherError(err?.message || "Location access denied or unavailable.");
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleRefreshWeather = async () => {
    if (coordsUsed) {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const data = await fetchWeatherByCoordinates(
          coordsUsed.lat,
          coordsUsed.lon,
          language,
          true,
          language === "hi" ? "आपका वर्तमान स्थान" : "Your Current Location"
        );
        setWeather(data);
      } catch (err: any) {
        setWeatherError(err?.message || "Failed to refresh weather.");
      } finally {
        setWeatherLoading(false);
      }
    } else {
      await handleSearchCityWeather(weather?.locationName || cityQuery, true);
    }
  };

  const handleLookupCityTime = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = cityClockInput.trim();
    if (!q) return;
    setClockLoading(true);
    setClockError(null);
    try {
      const data = await fetchCityClock(q, language);
      setCustomCityClock(data);
    } catch (err: any) {
      setClockError(err?.message || `Could not find timezone for "${q}".`);
    } finally {
      setClockLoading(false);
    }
  };

  const quickCityButtons = ["Patna", "Delhi", "Mumbai", "London", "New York"];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-14">
      {/* 1. Live Device Clock & World Timezones */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Real-Time Clock Card */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 border border-slate-800 p-6 flex flex-col justify-between gap-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>{language === "hi" ? "लाइव डिवाइस घड़ी" : "Live Device Clock"}</span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-medium">
              {language === "hi" ? localClock.periodLabelHi : localClock.periodLabelEn}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white font-['Outfit'] tabular-nums">
              {localClock.formattedTime}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <CalendarDays className="w-3.5 h-3.5 text-violet-400" />
              <span>{localClock.formattedDate}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400">
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="block text-[10px] text-slate-500">Day</span>
                <span className="font-semibold text-slate-200">{localClock.weekday}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="block text-[10px] text-slate-500">Month</span>
                <span className="font-semibold text-slate-200">{localClock.monthName}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="block text-[10px] text-slate-500">Year</span>
                <span className="font-semibold text-slate-200">{localClock.year}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="truncate">{localClock.timezone}</span>
            <span className="text-indigo-300 shrink-0">{localClock.utcOffset}</span>
          </div>
        </div>

        {/* Worldwide IANA Clocks & City Time Search */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <div>
                <h2 className="text-sm font-bold text-white font-['Outfit']">
                  {language === "hi" ? "विश्व समय (IANA टाइमज़ोन)" : "World Clocks & IANA Timezones"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {language === "hi"
                    ? "दुनिया के किसी भी शहर का वास्तविक समय देखें"
                    : "Real-time clocks across global IANA timezones"}
                </p>
              </div>
            </div>

            <form onSubmit={handleLookupCityTime} className="flex items-center gap-2">
              <input
                type="text"
                value={cityClockInput}
                onChange={(e) => setCityClockInput(e.target.value)}
                placeholder={language === "hi" ? "शहर खोजें (जैसे Tokyo)..." : "Check any city time..."}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-44"
              />
              <button
                type="submit"
                disabled={clockLoading}
                className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 text-xs font-semibold transition disabled:opacity-50"
              >
                {clockLoading ? "..." : language === "hi" ? "खोजें" : "Check"}
              </button>
            </form>
          </div>

          {clockError && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{clockError}</span>
            </div>
          )}

          {customCityClock && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-600/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-cyan-300">{customCityClock.city}</span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  {customCityClock.timezone} · {customCityClock.utcOffset}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white tabular-nums">
                  {customCityClock.formattedTime}
                </div>
                <span className="text-[11px] text-slate-300">
                  {customCityClock.formattedDate} ·{" "}
                  {language === "hi" ? customCityClock.periodLabelHi : customCityClock.periodLabelEn}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {worldClocks.map((wc, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200 truncate">{wc.city}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                    {wc.utcOffset}
                  </span>
                </div>
                <div className="text-base font-bold text-white tabular-nums">{wc.formattedTime}</div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{wc.weekday}</span>
                  <span>{language === "hi" ? wc.periodLabelHi : wc.periodLabelEn}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Open-Meteo Weather Intelligence System */}
      <section className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-6">
        {/* Search & Location Permission Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/15 text-cyan-400 flex items-center justify-center">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit']">
                {language === "hi" ? "मौसम बुद्धिमत्ता (Open-Meteo)" : "Weather Intelligence (Open-Meteo)"}
              </h2>
              <p className="text-xs text-slate-400">
                {language === "hi"
                  ? "बिना API Key के सटीक लाइव मौसम, प्रति घंटा व 7-दिन का पूर्वानुमान"
                  : "No API key required · Live conditions, 24h hourly & 7-day forecasts"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchCityWeather();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder={language === "hi" ? "शहर लिखें (जैसे Patna)..." : "Enter city (e.g. Patna)..."}
                  className="pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-48"
                />
              </div>
              <button
                type="submit"
                disabled={weatherLoading}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {language === "hi" ? "मौसम देखें" : "Search"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={weatherLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-semibold transition disabled:opacity-50"
              title="Request permission to detect your current location weather"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{language === "hi" ? "मेरा स्थान" : "Use My Location"}</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshWeather}
              disabled={weatherLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
              title="Force refresh live weather data"
            >
              <RefreshCw className={`w-4 h-4 ${weatherLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Quick City Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400 mr-1">
            {language === "hi" ? "प्रमुख शहर:" : "Quick Cities:"}
          </span>
          {quickCityButtons.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => handleSearchCityWeather(city)}
              className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition"
            >
              {city}
            </button>
          ))}
        </div>

        {weatherError && (
          <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{weatherError}</span>
          </div>
        )}

        {weatherLoading && !weather && (
          <div className="py-12 text-center text-xs text-slate-400">
            Fetching live forecast from Open-Meteo...
          </div>
        )}

        {weather && (
          <div className="space-y-6">
            {/* Current Weather Summary Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-950/90 via-slate-950/70 to-cyan-950/30 border border-slate-800 grid grid-cols-1 lg:grid-cols-4 gap-5 items-center">
              <div className="lg:col-span-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white text-sm">
                    {[weather.locationName, weather.admin1, weather.country].filter(Boolean).join(", ")}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {weather.timezone}
                  </span>
                </div>

                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-extrabold text-white font-['Outfit']">
                    {Math.round(weather.current.temperatureC)}°C
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-cyan-300 block">
                      {language === "hi" ? weather.current.conditionHi : weather.current.conditionEn}
                    </span>
                    <span className="text-xs text-slate-400 block">
                      {language === "hi"
                        ? `महसूस तापमान: ${Math.round(weather.current.apparentTemperatureC)}°C`
                        : `Feels like ${Math.round(weather.current.apparentTemperatureC)}°C`}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 pt-1">
                  <span>
                    {language === "hi" ? "अंतिम अपडेट:" : "Last updated:"}{" "}
                    <strong className="text-slate-200">{weather.lastUpdatedDisplay}</strong>
                  </span>
                  <span>·</span>
                  <span className={weather.cached ? "text-amber-300" : "text-emerald-400"}>
                    {weather.cached ? "Cached (10m TTL)" : "Live Open-Meteo"}
                  </span>
                </div>
              </div>

              {/* Telemetry Metrics Grid */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{language === "hi" ? "नमी" : "Humidity"}</span>
                  </div>
                  <div className="text-base font-bold text-white">{weather.current.humidity}%</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Wind className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{language === "hi" ? "हवा" : "Wind"}</span>
                  </div>
                  <div className="text-base font-bold text-white">
                    {weather.current.windSpeedKmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    <span>{language === "hi" ? "वर्षा" : "Precip."}</span>
                  </div>
                  <div className="text-base font-bold text-white">
                    {weather.current.precipitationMm} <span className="text-[10px] font-normal text-slate-400">mm</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === "hi" ? "बादल" : "Clouds"}</span>
                  </div>
                  <div className="text-base font-bold text-white">{weather.current.cloudCoverPct}%</div>
                </div>
              </div>
            </div>

            {/* Hourly Forecast Strip (Next 24 Hours) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === "hi" ? "अगले 24 घंटे का पूर्वानुमान" : "Hourly Forecast (Next 24 Hours)"}
              </h3>
              <div className="flex gap-2.5 overflow-x-auto pb-2">
                {weather.hourly.slice(0, 12).map((hr, idx) => (
                  <div
                    key={idx}
                    className="min-w-[92px] p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center space-y-1 shrink-0"
                  >
                    <span className="text-[11px] font-mono text-slate-400 block">{hr.hourLabel}</span>
                    <div className="text-sm font-bold text-white">{Math.round(hr.temperatureC)}°C</div>
                    <div className="text-[10px] text-cyan-300 truncate">
                      {language === "hi" ? hr.conditionHi : hr.conditionEn}
                    </div>
                    <div className="text-[10px] text-sky-400">
                      💧 {hr.precipitationProbability}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-Day Forecast Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === "hi" ? "7-दिवसीय मौसम पूर्वानुमान" : "7-Day Forecast"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                {weather.daily.map((day, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>{day.dayLabel}</span>
                      <span className="text-[10px] text-sky-400">💧 {day.precipitationProbabilityMax}%</span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {language === "hi" ? day.conditionHi : day.conditionEn}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-amber-300 font-bold flex items-center gap-0.5">
                        <Thermometer className="w-3 h-3" />
                        {Math.round(day.tempMaxC)}°
                      </span>
                      <span className="text-slate-400">{Math.round(day.tempMinC)}° min</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Rain: {day.precipitationSumMm} mm · Wind {Math.round(day.windSpeedMaxKmh)} km/h
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask JIYA Weather & Clock Prompts */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                {language === "hi" ? "जिया से पूछें:" : "Ask JIYA:"}
              </span>
              {[
                `What's the weather in ${weather.locationName}?`,
                `Will it rain tomorrow in ${weather.locationName}?`,
                `How hot will it be today in ${weather.locationName}?`,
                "What time is it in Delhi, London or New York?",
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onQuickPrompt(q)}
                  className="px-3 py-1.5 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 text-violet-200 text-[11px] font-medium transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
