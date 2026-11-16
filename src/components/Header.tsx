import React, { useEffect, useState } from "react";
import { AppView, Language } from "../types.ts";
import { PWAInstallButton } from "./PWAInstallButton.tsx";
import { getLocalDeviceClock } from "../services/clockWeatherClient.ts";
import { User } from "firebase/auth";
import {
  Sparkles,
  Globe,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Menu,
  Clock,
} from "lucide-react";

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  user: User | null;
  hasGoogleToken: boolean;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  language: Language;
  onToggleLanguage: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  user,
  hasGoogleToken,
  onLogin,
  onLogout,
  isLoggingIn,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
}) => {
  const [liveTime, setLiveTime] = useState(() => getLocalDeviceClock(language));

  useEffect(() => {
    setLiveTime(getLocalDeviceClock(language));
    const timer = window.setInterval(() => {
      setLiveTime(getLocalDeviceClock(language));
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between gap-4 md:gap-8 transition-colors dark:border-slate-800/80 dark:bg-slate-950/80">
      {/* Zone 1: Wordmark & Mobile Trigger */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => setCurrentView("dashboard")}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-0.5 shadow-md shadow-violet-900/30 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-white font-['Outfit']">
              JIYA
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline -mt-1 font-medium tracking-wide">
              {language === "hi" ? "आपकी जिंदगी. आपकी बुद्धिमत्ता." : "Life. Assistant. Intelligence."}
            </span>
          </div>
        </button>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300">
        <button
          onClick={() => setCurrentView("dashboard")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "dashboard" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "डैशबोर्ड" : "Dashboard"}
        </button>
        <button
          onClick={() => setCurrentView("chat")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "chat" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "एआई कमांड" : "AI Assistant"}
        </button>
        <button
          onClick={() => setCurrentView("study")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "study" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "स्टडी सेंटर" : "Study Center"}
        </button>
        <button
          onClick={() => setCurrentView("calendar")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "calendar" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "कैलेंडर" : "Calendar"}
        </button>
        <button
          onClick={() => setCurrentView("tasks")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "tasks" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "टास्क" : "Tasks"}
        </button>
        <button
          onClick={() => setCurrentView("maps")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "maps" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "गूगल मैप्स" : "Google Maps"}
        </button>
        <button
          onClick={() => setCurrentView("reports")}
          className={`transition-colors whitespace-nowrap hover:text-white ${
            currentView === "reports" ? "text-violet-400 font-semibold" : ""
          }`}
        >
          {language === "hi" ? "लाइफ रिपोर्ट्स" : "Life Reports"}
        </button>
      </nav>

      {/* Zone 3: Live Clock, Controls, Install & Auth */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Live Device Clock Quick Button */}
        <button
          onClick={() => setCurrentView("weather")}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition tabular-nums ${
            currentView === "weather"
              ? "bg-cyan-600/20 border-cyan-500/40 text-cyan-200"
              : "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
          }`}
          title={`${liveTime.formattedDate} (${liveTime.timezone}) — Open Clock & Weather`}
        >
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{liveTime.formattedTime}</span>
        </button>

        {/* Language Switcher */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 bg-slate-900/80 border border-slate-800 hover:text-white hover:border-slate-700 transition"
          title={language === "en" ? "हिंदी में बदलें" : "Switch to English"}
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{language === "en" ? "EN" : "HI"}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

        {/* Install PWA Button */}
        <PWAInstallButton compact />

        {/* Google Auth Status / Action */}
        {user ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
            <div className="relative">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-violet-500/40 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-violet-700/60 text-white flex items-center justify-center text-xs font-bold">
                  {user.displayName?.[0] || user.email?.[0] || "U"}
                </div>
              )}
              {hasGoogleToken ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950"
                  title="Google Workspace Connected"
                />
              ) : (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-slate-950"
                  title="Session active, token renewal recommended"
                />
              )}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 shadow-sm transition disabled:opacity-50 whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isLoggingIn ? "Signing In..." : "Sign in with Google"}</span>
          </button>
        )}
      </div>
    </header>
  );
};
