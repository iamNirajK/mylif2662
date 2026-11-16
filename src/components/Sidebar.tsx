import React from "react";
import { AppView, Language } from "../types.ts";
import {
  LayoutDashboard,
  MessageSquareCode,
  Mail,
  Calendar,
  CheckSquare,
  HardDrive,
  GraduationCap,
  FileQuestion,
  Users,
  LineChart,
  Settings,
  ShieldCheck,
  Sparkles,
  MapPin,
  CloudSun,
  X,
} from "lucide-react";

interface SidebarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  language: Language;
  hasGoogleToken: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  isMobileOpen,
  onCloseMobile,
  language,
  hasGoogleToken,
}) => {
  const navItems: Array<{
    id: AppView;
    labelEn: string;
    labelHi: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: "dashboard", labelEn: "Dashboard", labelHi: "डैशबोर्ड", icon: LayoutDashboard },
    { id: "chat", labelEn: "AI Command", labelHi: "एआई कमांड", icon: MessageSquareCode, badge: "Voice AI" },
    { id: "weather", labelEn: "Clock & Weather", labelHi: "समय व मौसम", icon: CloudSun },
    { id: "gmail", labelEn: "Gmail", labelHi: "जीमेल", icon: Mail },
    { id: "calendar", labelEn: "Calendar", labelHi: "कैलेंडर", icon: Calendar },
    { id: "tasks", labelEn: "Google Tasks", labelHi: "गूगल टास्क", icon: CheckSquare },
    { id: "drive", labelEn: "Drive Vault", labelHi: "ड्राइव वॉल्ट", icon: HardDrive },
    { id: "study", labelEn: "Study Center", labelHi: "स्टडी सेंटर", icon: GraduationCap },
    { id: "forms", labelEn: "Google Forms", labelHi: "गूगल फॉर्म्स", icon: FileQuestion },
    { id: "contacts", labelEn: "Contacts", labelHi: "संपर्क", icon: Users },
    { id: "maps", labelEn: "Google Maps", labelHi: "गूगल मैप्स", icon: MapPin },
    { id: "reports", labelEn: "Life Reports", labelHi: "लाइफ रिपोर्ट्स", icon: LineChart },
    { id: "settings", labelEn: "Settings & Privacy", labelHi: "सेटिंग्स व प्राइवेसी", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-20 h-screen w-64 bg-slate-950/95 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header / Branding */}
        <div>
          <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-wider uppercase text-white font-['Outfit']">
                JIYA OS
              </span>
            </div>
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-xs"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"
                      }`}
                    />
                    <span>{language === "hi" ? item.labelHi : item.labelEn}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Integration Status Strip */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`w-4 h-4 ${hasGoogleToken ? "text-emerald-400" : "text-amber-400"}`}
              />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-200">
                  Google Workspace
                </span>
                <span className="text-[10px] text-slate-400">
                  {hasGoogleToken ? "Connected & Active" : "Sign in to Connect"}
                </span>
              </div>
            </div>
            <div
              className={`w-2 h-2 rounded-full ${
                hasGoogleToken ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-500"
              }`}
            />
          </div>
        </div>
      </aside>
    </>
  );
};
