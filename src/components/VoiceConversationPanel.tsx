import React from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Hand,
  AlertCircle,
} from "lucide-react";
import type { AIProviderStatus, AssistantToolStep, Language, VoiceSessionStatus } from "../types.ts";

interface VoiceConversationPanelProps {
  status: VoiceSessionStatus;
  toolStatus?: { step: AssistantToolStep; labelEn: string; labelHi: string } | null;
  language: Language;
  waveform: number[];
  liveUserTranscript: string;
  liveAIText: string;
  isMuted: boolean;
  providerStatus: AIProviderStatus | null;
  voiceError: string | null;
  compatibilityNotice?: string | null;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onClearError: () => void;
}

export const VoiceConversationPanel: React.FC<VoiceConversationPanelProps> = ({
  status,
  toolStatus,
  language,
  waveform,
  liveUserTranscript,
  liveAIText,
  isMuted,
  providerStatus,
  voiceError,
  compatibilityNotice,
  onStart,
  onStop,
  onToggleMute,
  onInterrupt,
  onClearError,
}) => {
  const isActive = status !== "idle" && status !== "error";
  const isCloudRealtime = Boolean(providerStatus?.voice.realtimeProviderConfigured);

  const statusMeta: Record<
    VoiceSessionStatus,
    { labelEn: string; labelHi: string; colorClass: string; badgeClass: string }
  > = {
    idle: {
      labelEn: "Voice Mode Ready",
      labelHi: "वॉइस मोड तैयार",
      colorClass: "text-slate-400",
      badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
    },
    connecting: {
      labelEn: "Connecting Voice Session...",
      labelHi: "वॉइस सेशन जुड़ रहा है...",
      colorClass: "text-amber-300",
      badgeClass: "bg-amber-950/60 text-amber-300 border-amber-700/50",
    },
    listening: {
      labelEn: "Listening...",
      labelHi: "सुन रही हूँ...",
      colorClass: "text-emerald-300",
      badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-600/50",
    },
    processing: {
      labelEn: toolStatus?.labelEn || "Understanding...",
      labelHi: toolStatus?.labelHi || "समझ रही हूँ...",
      colorClass: "text-cyan-300",
      badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-600/50",
    },
    speaking: {
      labelEn: isCloudRealtime
        ? "Speaking... (Speak to interrupt)"
        : "Speaking... (Tap Stop Speaking to interrupt)",
      labelHi: isCloudRealtime
        ? "बोल रही हूँ... (रोकने के लिए बोलें)"
        : "बोल रही हूँ... (रोकने के लिए 'बोलना रोकें' दबाएं)",
      colorClass: "text-violet-300",
      badgeClass: "bg-violet-950/60 text-violet-300 border-violet-500/50",
    },
    muted: {
      labelEn: "Microphone Muted",
      labelHi: "माइक्रोफ़ोन म्यूट है",
      colorClass: "text-amber-300",
      badgeClass: "bg-amber-950/60 text-amber-300 border-amber-600/50",
    },
    interrupted: {
      labelEn: "Interrupted — Listening again",
      labelHi: "रोका गया — फिर से सुन रही हूँ",
      colorClass: "text-cyan-300",
      badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-600/50",
    },
    error: {
      labelEn: "Voice Attention Needed",
      labelHi: "वॉइस त्रुटि",
      colorClass: "text-rose-300",
      badgeClass: "bg-rose-950/60 text-rose-300 border-rose-700/50",
    },
  };

  const currentMeta = statusMeta[status];

  const voiceEngineLabel = providerStatus?.voice.realtimeProviderConfigured
    ? "Cloud Realtime Voice Active"
    : providerStatus?.voice.serverSttConfigured || providerStatus?.voice.serverTtsConfigured
    ? "Cloud STT/TTS + OpenRouter"
    : language === "hi"
    ? "ब्राउज़र वेब स्पीच व स्पीच-सिंथेसिस (OpenRouter फ्री)"
    : "Browser Web Speech & SpeechSynthesis (Turn-Based · OpenRouter Free)";

  if (!isActive && !voiceError && !compatibilityNotice) {
    return null;
  }

  return (
    <div className="mb-4 p-4 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-violet-950/40 border border-violet-500/30 shadow-xl backdrop-blur-xl space-y-3">
      {/* Top Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Listening / Speaking Pulse Orb */}
          <div className="relative flex items-center justify-center w-10 h-10">
            {status === "listening" && (
              <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
            )}
            {status === "speaking" && (
              <span className="absolute inset-0 rounded-full bg-violet-500/35 animate-ping" />
            )}
            <div
              className={`relative w-10 h-10 rounded-full flex items-center justify-center border ${
                status === "speaking"
                  ? "bg-violet-600/30 border-violet-400 text-violet-200"
                  : status === "listening"
                  ? "bg-emerald-600/25 border-emerald-400 text-emerald-200"
                  : status === "muted"
                  ? "bg-amber-600/20 border-amber-500 text-amber-300"
                  : status === "processing"
                  ? "bg-cyan-600/20 border-cyan-400 text-cyan-200"
                  : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              {status === "speaking" ? (
                <Volume2 className="w-5 h-5 animate-pulse" />
              ) : status === "processing" ? (
                <Sparkles className="w-5 h-5 animate-spin" />
              ) : isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Radio className="w-5 h-5" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${currentMeta.colorClass}`}>
                {language === "hi" ? currentMeta.labelHi : currentMeta.labelEn}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${currentMeta.badgeClass}`}
              >
                {status.toUpperCase()}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {voiceEngineLabel}
            </span>
          </div>
        </div>

        {/* Real-Time Audio Waveform Bars */}
        <div
          className="flex items-center justify-center gap-1 h-9 px-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 min-w-[140px]"
          aria-label="Live Voice Waveform"
        >
          {waveform.map((level, idx) => {
            const heightPx = Math.max(4, Math.round(level * 28));
            return (
              <div
                key={idx}
                className={`w-1 rounded-full transition-all duration-75 ${
                  status === "speaking"
                    ? "bg-violet-400"
                    : status === "listening"
                    ? "bg-emerald-400"
                    : status === "processing"
                    ? "bg-cyan-400"
                    : "bg-slate-600"
                }`}
                style={{ height: `${heightPx}px` }}
              />
            );
          })}
        </div>

        {/* Voice Controls */}
        <div className="flex items-center gap-2">
          {/* Stop Speaking / Interrupt AI */}
          {(status === "speaking" || status === "processing") && (
            <button
              type="button"
              onClick={onInterrupt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition"
              title="Stop AI speech and resume listening"
            >
              {status === "speaking" ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Hand className="w-3.5 h-3.5" />
              )}
              <span>
                {status === "speaking"
                  ? language === "hi"
                    ? "बोलना रोकें"
                    : "Stop Speaking"
                  : language === "hi"
                  ? "रोकें"
                  : "Cancel"}
              </span>
            </button>
          )}

          {/* Mute / Unmute Mic */}
          {isActive && (
            <button
              type="button"
              onClick={onToggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                isMuted
                  ? "bg-amber-600/20 border-amber-500/40 text-amber-200"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? (language === "hi" ? "अनम्यूट" : "Unmute") : language === "hi" ? "म्यूट" : "Mute"}</span>
            </button>
          )}

          {/* Start / Stop Voice Conversation */}
          {isActive ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>{language === "hi" ? "वॉइस बंद करें" : "Stop Voice"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{language === "hi" ? "पुनः शुरू करें" : "Restart Voice"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Transcripts Preview */}
      {(liveUserTranscript || liveAIText) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/70">
          <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block mb-0.5">
              {language === "hi" ? "आप बोल रहे हैं" : "You (Live Speech)"}
            </span>
            <p className="text-slate-200 min-h-[1.25rem]">
              {liveUserTranscript || (language === "hi" ? "बोलने की प्रतीक्षा..." : "Waiting for speech...")}
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold block mb-0.5">
              {language === "hi" ? "जिया (आवाज़)" : "JIYA (Voice Reply)"}
            </span>
            <p className="text-slate-200 min-h-[1.25rem] line-clamp-3">
              {liveAIText || (language === "hi" ? "जवाब की प्रतीक्षा..." : "Ready to reply...")}
            </p>
          </div>
        </div>
      )}

      {/* Friendly Browser Speech Compatibility Notice */}
      {compatibilityNotice && !voiceError && (
        <div className="p-2.5 rounded-2xl bg-amber-950/50 border border-amber-700/50 flex items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{compatibilityNotice}</span>
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="text-xs text-amber-300 hover:text-white underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert Banner inside Voice Panel */}
      {voiceError && (
        <div className="p-2.5 rounded-2xl bg-rose-950/60 border border-rose-700/60 flex items-center justify-between gap-2 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{voiceError}</span>
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="text-xs text-rose-300 hover:text-white underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
