import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { AppView, ClockTimeData, Language, WeatherIntelligenceData } from "../types.ts";
import {
  CalendarEventItem,
  GoogleTaskItem,
  GmailMessageSummary,
  DriveFileItem,
} from "../services/workspace.ts";
import {
  fetchWeatherByCity,
  fetchWeatherByCoordinates,
  getLocalDeviceClock,
  getLocationIfAlreadyGranted,
} from "../services/clockWeatherClient.ts";
import {
  Sparkles,
  Calendar,
  CheckSquare,
  Mail,
  HardDrive,
  Plus,
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Clock,
  FileQuestion,
  CheckCircle2,
  Circle,
  LogIn,
  MapPin,
  CloudSun,
  Droplets,
  Wind,
} from "lucide-react";

interface DashboardViewProps {
  user: User | null;
  hasGoogleToken: boolean;
  onLogin: () => void;
  language: Language;
  setCurrentView: (view: AppView) => void;
  events: CalendarEventItem[];
  tasks: GoogleTaskItem[];
  emails: GmailMessageSummary[];
  driveFiles: DriveFileItem[];
  loadingWorkspace: boolean;
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onQuickPrompt: (prompt: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  hasGoogleToken,
  onLogin,
  language,
  setCurrentView,
  events,
  tasks,
  emails,
  driveFiles,
  loadingWorkspace,
  onToggleTask,
  onQuickPrompt,
}) => {
  // Determine greeting based on local time
  const hour = new Date().getHours();
  const greetingEn = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greetingHi = hour < 12 ? "सुप्रभात" : hour < 17 ? "शुभ दोपहर" : "शुभ संध्या";
  const greeting = language === "hi" ? greetingHi : greetingEn;
  const displayName = user?.displayName?.split(" ")[0] || (language === "hi" ? "साथी" : "there");

  // Live Device Clock & Weather Quick Summary
  const [liveClock, setLiveClock] = useState<ClockTimeData>(() => getLocalDeviceClock(language));
  const [quickWeather, setQuickWeather] = useState<WeatherIntelligenceData | null>(null);

  useEffect(() => {
    setLiveClock(getLocalDeviceClock(language));
    const timer = window.setInterval(() => {
      setLiveClock(getLocalDeviceClock(language));
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const granted = await getLocationIfAlreadyGranted();
        const data = granted
          ? await fetchWeatherByCoordinates(granted.latitude, granted.longitude, language, false, "Current Location")
          : await fetchWeatherByCity("Delhi", language, false);
        if (!cancelled) setQuickWeather(data);
      } catch {
        // Silently ignore on dashboard summary if offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Summary counts
  const pendingTasks = tasks.filter((t) => t.status === "needsAction");
  const unreadEmails = emails.filter((e) => e.isUnread);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Welcome & AI Daily Briefing Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-400 uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>{language === "hi" ? "दैनिक बुद्धिमत्ता ब्रीफिंग" : "Daily Intelligence Briefing"}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-['Outfit']">
              {greeting}, {displayName}!
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {hasGoogleToken ? (
                language === "hi" ? (
                  `आज आपके कैलेंडर में ${events.length} इवेंट्स, ${pendingTasks.length} लंबित टास्क और ${unreadEmails.length} अनपढ़े ईमेल हैं। जिया आपके दिन को सुव्यवस्थित रखने के लिए तैयार है।`
                ) : (
                  `You have ${events.length} events scheduled, ${pendingTasks.length} pending tasks, and ${unreadEmails.length} unread priority emails. JIYA is ready to organize your day.`
                )
              ) : (
                language === "hi" ? (
                  "गूगल वर्कस्पेस से कनेक्ट करें ताकि जिया सीधे आपके ईमेल, शेड्यूल, ड्राइव फाइल्स और टास्क को संभाल सके।"
                ) : (
                  "Connect your Google Workspace account to let JIYA organize your emails, schedule, Drive files, and study tasks in real-time."
                )
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {hasGoogleToken ? (
              <button
                onClick={() => onQuickPrompt("Prepare my personalized daily productivity plan for today based on my schedule and tasks")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-900/30 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>{language === "hi" ? "आज का प्लान बनाएं" : "Generate Daily Plan"}</span>
              </button>
            ) : (
              <button
                onClick={onLogin}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-lg transition"
              >
                <LogIn className="w-4 h-4 text-indigo-600" />
                <span>{language === "hi" ? "गूगल से कनेक्ट करें" : "Connect Google Account"}</span>
              </button>
            )}
            <button
              onClick={() => setCurrentView("chat")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <span>{language === "hi" ? "जिया से पूछें" : "Ask JIYA Anything"}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </section>

      {/* 1b. Live Clock & Weather Intelligence Quick Strip */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => setCurrentView("weather")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setCurrentView("weather")}
          className="cursor-pointer rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 p-5 flex items-center justify-between gap-4 transition"
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>{language === "hi" ? "लाइव समय व दिनांक" : "Live Device Clock"}</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] normal-case">
                {language === "hi" ? liveClock.periodLabelHi : liveClock.periodLabelEn}
              </span>
            </div>
            <div className="text-2xl font-extrabold text-white font-['Outfit'] tabular-nums">
              {liveClock.formattedTime}
            </div>
            <div className="text-xs text-slate-300 truncate">{liveClock.formattedDate}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {liveClock.timezone} · {liveClock.utcOffset}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
        </div>

        <div
          onClick={() => setCurrentView("weather")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setCurrentView("weather")}
          className="cursor-pointer rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 p-5 flex items-center justify-between gap-4 transition"
        >
          {quickWeather ? (
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-400 uppercase tracking-wider truncate">
                  <CloudSun className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{quickWeather.locationName}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {quickWeather.lastUpdatedDisplay}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-extrabold text-white font-['Outfit']">
                  {Math.round(quickWeather.current.temperatureC)}°C
                </span>
                <span className="text-xs text-cyan-300 font-medium truncate">
                  {language === "hi"
                    ? quickWeather.current.conditionHi
                    : quickWeather.current.conditionEn}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-400" />
                  {quickWeather.current.humidity}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-indigo-400" />
                  {quickWeather.current.windSpeedKmh} km/h
                </span>
                <span>
                  Feels {Math.round(quickWeather.current.apparentTemperatureC)}°C
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <CloudSun className="w-4 h-4" />
                <span>{language === "hi" ? "मौसम व विश्व घड़ी खोलें" : "Open Weather & World Clock"}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {language === "hi"
                  ? "शहर के अनुसार लाइव मौसम और 7-दिन का पूर्वानुमान देखें"
                  : "Check live Open-Meteo forecasts and worldwide IANA timezones"}
              </p>
            </div>
          )}
          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
        </div>
      </section>

      {/* 2. Quick Action Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {language === "hi" ? "त्वरित कार्य (Quick Actions)" : "Quick Actions"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setCurrentView("chat")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-violet-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "जिया चैट" : "Ask JIYA"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">OpenRouter · Voice AI</span>
          </button>

          <button
            onClick={() => setCurrentView("tasks")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "टास्क जोड़ें" : "Add Task"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Google Tasks</span>
          </button>

          <button
            onClick={() => setCurrentView("calendar")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "शेड्यूल इवेंट" : "New Event"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Google Calendar</span>
          </button>

          <button
            onClick={() => setCurrentView("gmail")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-600/10 text-rose-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "ईमेल कंपोज़" : "Send Email"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Gmail API</span>
          </button>

          <button
            onClick={() => setCurrentView("drive")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 text-amber-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <HardDrive className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "फाइल अपलोड" : "Upload File"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Google Drive</span>
          </button>

          <button
            onClick={() => setCurrentView("forms")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <FileQuestion className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "गूगल फॉर्म बनाएं" : "Create Form"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Google Forms</span>
          </button>

          <button
            onClick={() => setCurrentView("maps")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-200">
              {language === "hi" ? "गूगल मैप्स" : "Google Maps"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Places & Directions</span>
          </button>
        </div>
      </section>

      {/* 3. Core Dashboard Grid: Calendar, Tasks, Gmail & Study */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Calendar Events (2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Calendar Widget */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-sm text-white font-['Outfit']">
                  {language === "hi" ? "आज व आगामी शेड्यूल" : "Upcoming Schedule"}
                </h3>
              </div>
              <button
                onClick={() => setCurrentView("calendar")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>{language === "hi" ? "सब देखें" : "View Calendar"}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loadingWorkspace ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading Google Calendar events...</div>
            ) : events.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  {hasGoogleToken ? "No upcoming events scheduled." : "Connect Google Calendar to see your schedule."}
                </p>
                <button
                  onClick={() => setCurrentView("calendar")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 text-xs hover:bg-indigo-600/30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === "hi" ? "इवेंट जोड़ें" : "Schedule Event"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {events.slice(0, 4).map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-200">{evt.summary}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(evt.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {evt.location && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[200px]">{evt.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {evt.htmlLink && (
                      <a
                        href={evt.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-500 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                        title="Open in Google Calendar"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Tasks Widget */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm text-white font-['Outfit']">
                  {language === "hi" ? "प्राथमिकता वाले कार्य (Google Tasks)" : "Priority Tasks"}
                </h3>
              </div>
              <button
                onClick={() => setCurrentView("tasks")}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <span>{language === "hi" ? "सभी टास्क" : "View All"}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loadingWorkspace ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading Google Tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  {hasGoogleToken ? "No tasks currently on your list." : "Connect Google Tasks to manage your todos."}
                </p>
                <button
                  onClick={() => setCurrentView("tasks")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs hover:bg-emerald-600/30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === "hi" ? "नया टास्क जोड़ें" : "Add Task"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((t) => {
                  const isDone = t.status === "completed";
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onToggleTask(t.id, t.status)}
                          className="text-slate-400 hover:text-emerald-400 transition"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <span className={`text-xs font-medium ${isDone ? "line-through text-slate-500" : "text-slate-200"}`}>
                          {t.title}
                        </span>
                      </div>
                      {t.due && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Due {new Date(t.due).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Gmail and Study Focus */}
        <div className="space-y-6">
          {/* Gmail Inbox Preview */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-sm text-white font-['Outfit']">
                  {language === "hi" ? "हाल के ईमेल" : "Recent Emails"}
                </h3>
              </div>
              <button
                onClick={() => setCurrentView("gmail")}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
              >
                <span>{language === "hi" ? "जीमेल खोलें" : "Inbox"}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loadingWorkspace ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading emails...</div>
            ) : emails.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {hasGoogleToken ? "No recent emails found in inbox." : "Connect Gmail to view messages."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {emails.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                        {m.sender.split("<")[0].replace(/"/g, "")}
                      </span>
                      <span className="text-[10px] text-slate-400">{m.date}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium truncate">{m.subject}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{m.snippet}</p>
                    {m.link && (
                      <div className="pt-1 flex justify-end">
                        <a
                          href={m.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300"
                        >
                          <span>Open in Gmail</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Study Center Card */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-sm text-white font-['Outfit']">
                  {language === "hi" ? "एआई स्टडी सेंटर" : "Study Center"}
                </h3>
              </div>
              <button
                onClick={() => setCurrentView("study")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                {language === "hi" ? "अध्ययन योजना" : "Open Hub"}
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Track your subjects, generate practice questions from uploaded PDFs, and get intelligent revision reminders.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setCurrentView("study")}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === "hi" ? "अध्ययन सत्र शुरू करें" : "Start Study Session"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
