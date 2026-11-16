import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { AIProviderStatus, Language } from "../types.ts";
import { fetchAIProviderStatus } from "../services/aiClient.ts";
import {
  Settings,
  Shield,
  Smartphone,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Mail,
  Calendar,
  CheckSquare,
  HardDrive,
  Users,
  FileQuestion,
  Cpu,
  Mic,
  RefreshCw,
} from "lucide-react";

interface SettingsViewProps {
  user: User | null;
  hasGoogleToken: boolean;
  onLogin: () => void;
  onLogout: () => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  hasGoogleToken,
  onLogin,
  onLogout,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
}) => {
  const [aiStatus, setAiStatus] = useState<AIProviderStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const loadAiStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await fetchAIProviderStatus();
      setAiStatus(status);
    } catch {
      setAiStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadAiStatus();
  }, []);

  const connectedServices = [
    { name: "Gmail", icon: Mail, scope: "gmail.readonly, gmail.compose, gmail.send", status: hasGoogleToken ? "Authorized" : "Disconnected" },
    { name: "Google Calendar", icon: Calendar, scope: "calendar.events, calendar.readonly", status: hasGoogleToken ? "Authorized" : "Disconnected" },
    { name: "Google Tasks", icon: CheckSquare, scope: "tasks", status: hasGoogleToken ? "Authorized" : "Disconnected" },
    { name: "Google Drive", icon: HardDrive, scope: "drive.file, drive.readonly", status: hasGoogleToken ? "Authorized" : "Disconnected" },
    { name: "Google Contacts", icon: Users, scope: "contacts.readonly, contacts", status: hasGoogleToken ? "Authorized" : "Disconnected" },
    { name: "Google Forms", icon: FileQuestion, scope: "forms.body", status: hasGoogleToken ? "Authorized" : "Disconnected" },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* 1. Header */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "सेटिंग्स व प्राइवेसी" : "Settings, Permissions & Android"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "गूगल वर्कस्पेस अनुमतियां, भाषा, थीम और सुरक्षा नियंत्रण"
                : "Manage Google Workspace authorizations, privacy settings, and PWA/APK setup"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. User Profile & Account */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          User Profile & Authentication
        </h2>
        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-4">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-12 h-12 rounded-full border border-violet-500/40"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-lg">
                  {user.displayName?.[0] || user.email?.[0] || "U"}
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-white">{user.displayName || "Google Account User"}</h3>
                <p className="text-xs text-slate-400">{user.email}</p>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {hasGoogleToken ? "Firebase & Google OAuth 2.0 Connected" : "Signed in (Token renewal required)"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-medium transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect Account</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-300">
              Sign in with your Google account to grant JIYA access to your authorized Google Workspace services.
            </p>
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-md transition"
            >
              <LogIn className="w-4 h-4 text-indigo-600" />
              <span>Sign in with Google</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Connected Google Workspace Permissions */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Connected Google Workspace APIs
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">OAuth 2.0 Least Privilege</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {connectedServices.map((srv, idx) => {
            const Icon = srv.icon;
            const isConn = srv.status === "Authorized";
            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-slate-300">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">{srv.name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[160px]">
                      {srv.scope}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConn ? "bg-emerald-500" : "bg-slate-600"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      isConn ? "text-emerald-400" : "text-slate-500"
                    }`}
                  >
                    {srv.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3b. Server AI Provider & Voice Engine Status */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {language === "hi"
                ? "AI प्रोवाइडर व वॉइस इंजन (शून्य-लागत सेटअप)"
                : "AI Providers & Voice Engine (Zero-Cost Setup)"}
            </h2>
          </div>
          <button
            onClick={loadAiStatus}
            disabled={loadingStatus}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingStatus ? "animate-spin" : ""}`} />
            <span>{language === "hi" ? "रिफ्रेश" : "Refresh"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              name: "OpenRouter API (Required)",
              envVar: "OPENROUTER_API_KEY",
              active: Boolean(aiStatus?.providers?.openrouter?.configured),
              required: true,
              desc: "Free OpenRouter AI models (only required secret)",
              icon: Cpu,
            },
            {
              name: "Browser Voice (Web Speech + TTS)",
              envVar: "Built-in Browser APIs (No Key Needed)",
              active:
                typeof window !== "undefined" &&
                ("speechSynthesis" in window ||
                  Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)),
              required: false,
              desc:
                typeof window !== "undefined" &&
                Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) &&
                "speechSynthesis" in window
                  ? "Voice Input & SpeechSynthesis Ready"
                  : "Partial or text-only browser fallback",
              icon: Mic,
            },
            {
              name: "WeatherAPI.com (Optional)",
              envVar: "WEATHERAPI_KEY",
              active: Boolean(aiStatus?.tools?.weatherApiConfigured),
              required: false,
              desc: aiStatus?.tools?.weatherApiConfigured
                ? "Live Weather, Forecast & Astronomy Active"
                : "Add WEATHERAPI_KEY in Secrets for live weather",
              icon: Cpu,
            },
            {
              name: "Unified Assistant Tools (Text & Voice)",
              envVar: "Default: Muzaffarpur, Bihar (Asia/Kolkata)",
              active: true,
              required: false,
              desc: "Live System Clock, Internet Search, Distance & Routing",
              icon: Cpu,
            },
            {
              name: "OpenAI / Custom API (Optional)",
              envVar: "OPENAI_API_KEY / OPENAI_COMPATIBLE_*",
              active: Boolean(aiStatus?.providers?.openai?.configured || aiStatus?.providers?.custom?.configured),
              required: false,
              desc: "Optional paid GPT or custom endpoints",
              icon: Cpu,
            },
            {
              name: "Dedicated Cloud Voice (Optional)",
              envVar: "STT_API_KEY / TTS_API_KEY / VOICE_PROVIDER_API_KEY",
              active: Boolean(
                aiStatus?.voice?.serverSttConfigured ||
                  aiStatus?.voice?.serverTtsConfigured ||
                  aiStatus?.voice?.realtimeProviderConfigured
              ),
              required: false,
              desc:
                aiStatus?.voice?.serverSttConfigured ||
                aiStatus?.voice?.serverTtsConfigured ||
                aiStatus?.voice?.realtimeProviderConfigured
                  ? `Active Engine: ${aiStatus?.voice?.activeVoiceEngine}`
                  : "Not needed — using built-in browser speech",
              icon: Mic,
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            const statusText = item.active
              ? "Active"
              : item.required
              ? "Required (Not Set)"
              : "Optional (Not Set)";
            const dotClass = item.active
              ? "bg-emerald-500"
              : item.required
              ? "bg-amber-500"
              : "bg-slate-600";
            const textClass = item.active
              ? "text-emerald-400"
              : item.required
              ? "text-amber-400"
              : "text-slate-400";

            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-violet-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                    <span className="text-[10px] text-slate-400 block truncate">{item.desc}</span>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">
                      {item.envVar}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                  <span className={`text-[11px] font-medium ${textClass}`}>{statusText}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          {language === "hi"
            ? "जीरो-कॉस्ट सेटअप के लिए केवल OPENROUTER_API_KEY आवश्यक है। अन्य सभी API Keys वैकल्पिक हैं और सभी गुप्त Keys केवल सर्वर Secrets में सुरक्षित रहती हैं।"
            : "Only OPENROUTER_API_KEY is required for a zero-cost setup. All other API keys are optional, and all secrets remain strictly server-side."}
        </p>
      </div>

      {/* 4. Preferences: Language & Theme */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Language & Appearance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white">Assistant Language</span>
              <p className="text-[11px] text-slate-400">English / हिंदी द्विभाषी समर्थन</p>
            </div>
            <button
              onClick={onToggleLanguage}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              {language === "en" ? "English (EN)" : "हिंदी (HI)"}
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white">Theme Interface</span>
              <p className="text-[11px] text-slate-400">Dark Navy / Clean Light</p>
            </div>
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              {theme === "dark" ? <Moon className="w-3.5 h-3.5 text-violet-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Android APK & PWA Build Instructions */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Smartphone className="w-5 h-5" />
          <h2 className="text-sm font-bold text-white">
            Android Application & APK Build Path
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          JIYA is built as an installable Progressive Web App (PWA) with full standalone support and can be packaged into an Android APK using Capacitor or Trusted Web Activities (TWA):
        </p>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-[11px] font-mono text-slate-300">
          <div className="text-slate-500">// Quick Android APK build steps:</div>
          <div>1. npm run build</div>
          <div>2. npx @capacitor/cli init "JIYA" "com.jiya.assistant"</div>
          <div>3. npx cap add android</div>
          <div>4. npx cap sync android</div>
          <div>5. npx cap open android (Build APK in Android Studio)</div>
        </div>
      </div>

      {/* 6. Security & Privacy Notice */}
      <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <Shield className="w-4 h-4" />
          <h3 className="text-xs font-bold text-slate-200">Security & Privacy Governance</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          JIYA strictly adheres to official Google Workspace API User Data Policy. OAuth access tokens are retained strictly in-memory during active sessions and never stored in persistent browser storage. Any mutating or destructive action (sending emails, modifying calendar events, deleting tasks) mandates explicit user confirmation.
        </p>
      </div>
    </div>
  );
};
