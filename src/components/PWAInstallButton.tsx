import React, { useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall.ts";
import { Download, Smartphone, X, CheckCircle2 } from "lucide-react";

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running as an installed PWA
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Installed</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <>
        <button
          onClick={async () => {
            const success = await install();
            if (success) setInstallSuccess(true);
          }}
          className={`flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-md shadow-violet-900/20 transition-all ${
            compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs"
          }`}
          title="Install JIYA as a native desktop or mobile app"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {installSuccess && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-emerald-900 text-emerald-100 px-4 py-2 rounded-xl border border-emerald-700 shadow-xl text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>JIYA installed successfully on your device!</span>
          </div>
        )}
      </>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium transition ${
            compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Install JIYA on iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-600/30 text-violet-300 flex items-center justify-center font-bold shrink-0">1</div>
                  <p>Tap the <strong>Share</strong> button (box with upward arrow) in the Safari bottom toolbar.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-600/30 text-violet-300 flex items-center justify-center font-bold shrink-0">2</div>
                  <p>Scroll down in the share menu and select <strong>"Add to Home Screen"</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-600/30 text-violet-300 flex items-center justify-center font-bold shrink-0">3</div>
                  <p>Tap <strong>Add</strong> in the top right. JIYA will now appear on your home screen with offline intelligence!</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      onClick={() => {
        // Universal install guide modal or prompt
        alert("To install JIYA: In Chrome/Edge, click the install icon in the address bar, or use browser Menu > 'Install JIYA'.");
      }}
      className={`hidden md:flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 font-medium transition ${
        compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs"
      }`}
      title="Installable Progressive Web App"
    >
      <Download className="w-3.5 h-3.5 text-violet-400" />
      <span>Install PWA</span>
    </button>
  );
};
