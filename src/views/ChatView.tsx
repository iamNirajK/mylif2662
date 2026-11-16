import React, { useState, useRef, useEffect } from "react";
import type {
  AIModelInfo,
  AIProviderId,
  AIProviderStatus,
  ActionProposal,
  AssistantToolStep,
  ChatMessage,
  GroundingSource,
  Language,
  VoiceSessionStatus,
} from "../types.ts";
import {
  analyzeFileWithAI,
  fetchAIProviderStatus,
  fetchAvailableModels,
  sendChatMessageStream,
} from "../services/aiClient.ts";
import {
  VoiceConversationManager,
  getBrowserSpeechCapabilities,
  speakMessageOnce,
  stopBrowserSpeech,
} from "../services/voiceClient.ts";
import { VoiceConversationPanel } from "../components/VoiceConversationPanel.tsx";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Brain,
  Globe,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  FileText,
  X,
  Trash2,
  Radio,
  Volume2,
  VolumeX,
  Square,
  Cpu,
} from "lucide-react";
import { createGoogleForm } from "../services/workspace.ts";

interface ChatViewProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  language: Language;
  hasGoogleToken: boolean;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  onRefreshWorkspaceData?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  setMessages,
  language,
  initialPrompt,
  onClearInitialPrompt,
  onRefreshWorkspaceData,
}) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [enableThinking, setEnableThinking] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableMaps, setEnableMaps] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Provider & Dynamic Model selection state
  const [provider, setProvider] = useState<AIProviderId>("openrouter");
  const [selectedModel, setSelectedModel] = useState<string>("openrouter/free");
  const [models, setModels] = useState<AIModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);

  // One-shot TTS playback tracking for message bubbles
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // File upload state
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    base64: string;
    previewUrl?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick single-turn Speech Recognition dictation state
  const [isDictating, setIsDictating] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  // Voice Conversation state
  const [voiceStatus, setVoiceStatus] = useState<VoiceSessionStatus>("idle");
  const [voiceToolStatus, setVoiceToolStatus] = useState<{
    step: AssistantToolStep;
    labelEn: string;
    labelHi: string;
  } | null>(null);
  const [textToolStatus, setTextToolStatus] = useState<string | null>(null);
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>(new Array(16).fill(0.08));
  const [liveUserTranscript, setLiveUserTranscript] = useState("");
  const [liveAIText, setLiveAIText] = useState("");
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceCompatibilityNotice, setVoiceCompatibilityNotice] = useState<string | null>(null);
  const voiceManagerRef = useRef<VoiceConversationManager | null>(null);
  const voiceGroundingRef = useRef<GroundingSource[]>([]);

  // Sensitive action confirmation dialog
  const [activeConfirmation, setActiveConfirmation] = useState<ActionProposal | null>(null);
  const [actionExecuting, setActionExecuting] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const chatAbortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, liveAIText]);

  // Load AI provider status & dynamic models on mount and provider change (OpenRouter Free Models by default)
  const loadModels = async (targetProvider: AIProviderId, refresh = false) => {
    setLoadingModels(true);
    try {
      const data = await fetchAvailableModels(targetProvider, refresh, targetProvider === "openrouter");
      setModels(data.models);
      setProviderStatus(data.status);
      if (data.models.length > 0 && !data.models.some((m) => m.id === selectedModel)) {
        setSelectedModel(data.models[0].id);
      }
    } catch (e) {
      console.warn("Could not load AI models:", e);
      try {
        const status = await fetchAIProviderStatus();
        setProviderStatus(status);
      } catch {}
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    loadModels(provider);
  }, [provider]);

  // Sync voice session config when provider/model/language/toggles change
  useEffect(() => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.updateConfig({
        provider,
        model: selectedModel,
        language,
        enableSearch,
        enableMaps,
      });
    }
  }, [provider, selectedModel, language, enableSearch, enableMaps]);

  // Cleanup all streams, audio, and WebSocket on unmount
  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
      voiceManagerRef.current?.stop();
      stopBrowserSpeech();
    };
  }, []);

  // Handle initial prompt passed from dashboard or elsewhere
  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  // Initialize single-turn Speech Recognition dictation if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === "hi" ? "hi-IN" : "en-US";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsDictating(false);
      };

      recognition.onerror = () => {
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      speechRecognitionRef.current = recognition;
    }
  }, [language]);

  const toggleDictation = () => {
    if (voiceStatus !== "idle" && voiceStatus !== "error") {
      // If voice mode is already active, toggle mute instead
      handleToggleVoiceMute();
      return;
    }

    if (!speechRecognitionRef.current) {
      const caps = getBrowserSpeechCapabilities(
        Boolean(providerStatus?.voice.serverSttConfigured),
        Boolean(providerStatus?.voice.serverTtsConfigured)
      );
      setVoiceError(
        caps.getCompatibilityMessage(language) ||
          "Browser Speech Recognition is not supported here. Try Chrome, Edge, or Safari, or type your message."
      );
      return;
    }

    if (isDictating) {
      speechRecognitionRef.current.stop();
      setIsDictating(false);
    } else {
      speechRecognitionRef.current.lang = language === "hi" ? "hi-IN" : "en-US";
      speechRecognitionRef.current.start();
      setIsDictating(true);
    }
  };

  // Start Voice Conversation (Browser Web Speech + SpeechSynthesis, or Cloud Voice if configured)
  const handleStartVoiceSession = async () => {
    setVoiceError(null);
    setVoiceCompatibilityNotice(null);
    setLiveUserTranscript("");
    setLiveAIText("");
    setIsVoiceMuted(false);

    if (isDictating && speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      setIsDictating(false);
    }

    if (voiceManagerRef.current) {
      voiceManagerRef.current.stop();
    }

    voiceGroundingRef.current = [];
    setVoiceToolStatus(null);
    const manager = new VoiceConversationManager(
      {
        provider,
        model: selectedModel,
        language,
        history: messagesRef.current,
        enableSearch,
        enableMaps,
        serverSttConfigured: Boolean(providerStatus?.voice.serverSttConfigured),
        serverTtsConfigured: Boolean(providerStatus?.voice.serverTtsConfigured),
        realtimeProviderConfigured: Boolean(providerStatus?.voice.realtimeProviderConfigured),
      },
      {
        onStatusChange: (nextStatus) => {
          setVoiceStatus(nextStatus);
        },
        onToolStatus: (toolStatus) => {
          setVoiceToolStatus(toolStatus);
        },
        onProviderCapabilities: (status) => {
          setProviderStatus(status);
        },
        onCompatibilityNotice: (msg) => {
          setVoiceCompatibilityNotice(msg);
        },
        onWaveform: (bars) => {
          setVoiceWaveform(bars);
        },
        onUserTranscript: (text, isFinal) => {
          setLiveUserTranscript(text);
          if (isFinal && text.trim()) {
            voiceGroundingRef.current = [];
            const userMsg: ChatMessage = {
              id: `msg-v-u-${Date.now()}`,
              role: "user",
              content: text.trim(),
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, userMsg]);
          }
        },
        onAIToken: (fullPartialText) => {
          setLiveAIText(fullPartialText);
        },
        onAIGrounding: (sources) => {
          voiceGroundingRef.current = sources;
        },
        onAIComplete: (payload) => {
          setLiveAIText(payload.fullText);
          if (payload.fullText.trim()) {
            const sources = payload.groundingSources || voiceGroundingRef.current;
            const modelMsg: ChatMessage = {
              id: `msg-v-a-${Date.now()}`,
              role: "model",
              content: payload.fullText,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              modelUsed: payload.modelUsed,
              providerUsed: payload.providerUsed,
              groundingSources: sources.length > 0 ? sources : undefined,
            };
            setMessages((prev) => [...prev, modelMsg]);
          }
        },
        onError: (errMessage) => {
          setVoiceError(errMessage);
        },
      }
    );

    voiceManagerRef.current = manager;
    await manager.start();
  };

  const handleStopVoiceSession = () => {
    voiceManagerRef.current?.stop();
    voiceManagerRef.current = null;
    setVoiceStatus("idle");
    setIsVoiceMuted(false);
    setLiveUserTranscript("");
    setLiveAIText("");
  };

  const handleToggleVoiceMute = () => {
    if (!voiceManagerRef.current) return;
    const muted = voiceManagerRef.current.toggleMute();
    setIsVoiceMuted(muted);
  };

  const handleInterruptVoice = () => {
    voiceManagerRef.current?.interruptAI();
  };

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setVoiceError("File size exceeds 15MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      const previewUrl = file.type.startsWith("image/") ? result : undefined;

      setAttachedFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        base64,
        previewUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAbortStream = () => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setLoading(false);
    setStreamingMsgId(null);
  };

  // Send message (Streaming SSE or File Analysis)
  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? input).trim();
    if (!textToSend && !attachedFile) return;

    const userMessageId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: attachedFile ? `[Attached: ${attachedFile.name}]\n${textToSend}` : textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const historySnapshot = [...messagesRef.current];
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setLoading(true);
    setLastFailedPrompt(textToSend);

    try {
      // 1. If file attached, analyze via OpenRouter / OpenAI Multimodal or Text extraction
      if (attachedFile) {
        const fileToAnalyze = attachedFile;
        setAttachedFile(null);

        const fileResult = await analyzeFileWithAI({
          fileBase64: fileToAnalyze.base64,
          mimeType: fileToAnalyze.type,
          fileName: fileToAnalyze.name,
          prompt: textToSend || "Analyze this file thoroughly and extract all insights.",
          language,
          provider,
          model: selectedModel,
        });

        const modelMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "model",
          content: fileResult.analysis,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          modelUsed: fileResult.modelUsed,
          providerUsed: fileResult.providerUsed || provider,
        };

        setMessages((prev) => [...prev, modelMessage]);
        setLastFailedPrompt(null);
      } else {
        // 2. Real-Time Streaming Chat via OpenRouter / OpenAI-compatible API
        const abortController = new AbortController();
        chatAbortRef.current = abortController;

        const assistantId = `msg-${Date.now() + 1}`;
        setStreamingMsgId(assistantId);

        const placeholderMsg: ChatMessage = {
          id: assistantId,
          role: "model",
          content: "",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          modelUsed: selectedModel,
          providerUsed: provider,
          thinkingUsed: enableThinking,
        };
        setMessages((prev) => [...prev, placeholderMsg]);

        setTextToolStatus(language === "hi" ? "समझ रही हूँ..." : "Understanding...");
        const result = await sendChatMessageStream(
          {
            prompt: textToSend,
            history: historySnapshot,
            provider,
            model: selectedModel,
            enableThinking,
            enableSearch,
            enableMaps,
            language,
            signal: abortController.signal,
          },
          (partialText, partialSources) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: partialText,
                      groundingSources: partialSources && partialSources.length > 0 ? partialSources : m.groundingSources,
                    }
                  : m
              )
            );
          },
          (toolStatus) => {
            setTextToolStatus(language === "hi" ? toolStatus.labelHi : toolStatus.labelEn);
          }
        );

        let proposal: ActionProposal | undefined = undefined;
        const lowerPrompt = textToSend.toLowerCase();
        if (lowerPrompt.includes("send email to") || lowerPrompt.includes("compose email")) {
          proposal = {
            type: "send_email",
            title: "Send Gmail Email",
            details: { promptContext: textToSend },
          };
        } else if (lowerPrompt.includes("create a google form") || lowerPrompt.includes("create a form")) {
          proposal = {
            type: "create_form",
            title: "Create Google Form",
            details: {
              title: "Revision Quiz / Survey",
              description: "Generated by JIYA AI Assistant",
              questions: [
                { title: "Question 1", type: "RADIO", options: ["Option A", "Option B", "Option C", "Option D"] },
                { title: "Question 2", type: "RADIO", options: ["True", "False"] },
                { title: "Key Takeaways / Feedback", type: "TEXT" },
              ],
            },
          };
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: result.reply,
                  groundingSources: result.groundingSources,
                  thinkingUsed: result.thinkingUsed,
                  modelUsed: result.modelUsed,
                  providerUsed: result.providerUsed,
                  actionProposal: proposal,
                }
              : m
          )
        );
        setLastFailedPrompt(null);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message === "Request aborted.") {
        return;
      }
      console.warn("Chat notice:", err?.message || err);

      // Remove empty streaming placeholder if failed before first token
      setMessages((prev) => prev.filter((m) => !(m.id === streamingMsgId && !m.content)));

      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: "system",
        content: err?.message || "Failed to contact AI provider. Check API configuration or network.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      chatAbortRef.current = null;
      setLoading(false);
      setStreamingMsgId(null);
      setTextToolStatus(null);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleToggleSpeakMessage = async (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      stopBrowserSpeech();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(msg.id);
    const result = await speakMessageOnce(msg.content, language, {
      serverTtsConfigured: Boolean(providerStatus?.voice.serverTtsConfigured),
    });
    setSpeakingMessageId((prev) => (prev === msg.id ? null : prev));
    if (!result.supported) {
      setVoiceCompatibilityNotice(
        language === "hi"
          ? "आपका ब्राउज़र SpeechSynthesis (टेक्स्ट-टू-स्पीच) को सपोर्ट नहीं करता है।"
          : "Your browser does not support the built-in SpeechSynthesis API for voice output."
      );
    }
  };

  const handleExecuteAction = async () => {
    if (!activeConfirmation) return;
    setActionExecuting(true);
    setActionResult(null);

    try {
      if (activeConfirmation.type === "create_form") {
        const questions = activeConfirmation.details.questions || [];
        const form = await createGoogleForm(
          activeConfirmation.details.title || "JIYA Form",
          activeConfirmation.details.description || "Form generated by JIYA AI",
          questions
        );

        setActionResult(
          `Form created successfully! Form URL: ${form.responderUri} (Edit URL: ${form.editUri})`
        );
        if (onRefreshWorkspaceData) onRefreshWorkspaceData();
      } else {
        setActionResult("Action completed with your confirmation.");
      }
    } catch (err: any) {
      setActionResult(`Action failed: ${err?.message || "Unknown error"}`);
    } finally {
      setActionExecuting(false);
    }
  };

  const suggestedPrompts = [
    {
      titleEn: "Today's Schedule",
      titleHi: "आज का शेड्यूल",
      prompt: "What do I have planned on my schedule today? Summarize my upcoming calendar events and tasks.",
    },
    {
      titleEn: "Summarize Emails",
      titleHi: "ईमेल सारांश",
      prompt: "Summarize my most important unread emails from Gmail and suggest quick responses.",
    },
    {
      titleEn: "Nearby Libraries",
      titleHi: "आस-पास के पुस्तकालय",
      prompt: "Find top-rated libraries or quiet study spaces near me and show their Google Maps links.",
      requireMaps: true,
    },
    {
      titleEn: "Create Physics Quiz",
      titleHi: "फिजिक्स टेस्ट फॉर्म",
      prompt: "Create a 5-question multiple choice Physics test for high school mechanics.",
    },
    {
      titleEn: "Daily Study Plan",
      titleHi: "दैनिक अध्ययन योजना",
      prompt: "Prepare my personalized daily productivity and study report for today.",
    },
  ];

  const isVoiceActive = voiceStatus !== "idle" && voiceStatus !== "error";

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto">
      {/* 1. Header Control Bar */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-['Outfit']">
              JIYA Command Center
            </h2>
            <span className="text-[10px] text-slate-400 block truncate max-w-[210px]">
              {provider === "openrouter" ? "OpenRouter" : provider === "openai" ? "OpenAI" : "Custom"} ·{" "}
              {selectedModel}
            </span>
          </div>
        </div>

        {/* Provider, Model Selector, Intelligence Toggles & Live Voice */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Switcher */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AIProviderId)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-950/90 text-slate-200 border border-slate-800 focus:outline-none focus:border-violet-500/50"
            title="Select AI Provider"
          >
            <option value="openrouter">OpenRouter (Free Models)</option>
            <option value="openai" disabled={!providerStatus?.providers.openai.configured}>
              OpenAI {providerStatus?.providers.openai.configured ? "" : "(Optional · Not Set)"}
            </option>
            {providerStatus?.providers.custom.configured && (
              <option value="custom">Custom Compatible</option>
            )}
          </select>

          {/* Dynamic Model Switcher (Free Models Prioritized) */}
          <div className="flex items-center gap-1">
            <div className="relative flex items-center">
              <Cpu className="w-3.5 h-3.5 text-violet-400 absolute left-2 pointer-events-none" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={loadingModels || models.length === 0}
                className="pl-7 pr-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-950/90 text-slate-200 border border-slate-800 focus:outline-none focus:border-violet-500/50 max-w-[190px] truncate"
                title="Switch AI Model (Free models listed first)"
              >
                {models.length === 0 ? (
                  <option value={selectedModel}>{selectedModel}</option>
                ) : (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.isFree ? "★ Free: " : ""}
                      {m.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => loadModels(provider, true)}
              disabled={loadingModels}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition"
              title="Refresh live models catalog"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Reasoning / Deep Thinking Toggle */}
          <button
            onClick={() => {
              setEnableThinking(!enableThinking);
              if (!enableThinking) setEnableMaps(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
              enableThinking
                ? "bg-violet-600/20 text-violet-300 border-violet-500/40 shadow-xs"
                : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Prioritize reasoning-capable free models"
          >
            <Brain className="w-3.5 h-3.5 text-violet-400" />
            <span>Reasoning</span>
          </button>

          {/* Web Search Toggle */}
          <button
            onClick={() => {
              setEnableSearch(!enableSearch);
              if (!enableSearch) setEnableMaps(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
              enableSearch
                ? "bg-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-xs"
                : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Enable OpenRouter Web Search grounding"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Search</span>
          </button>

          {/* Maps / Location Toggle */}
          <button
            onClick={() => {
              setEnableMaps(!enableMaps);
              if (!enableMaps) {
                setEnableSearch(false);
                setEnableThinking(false);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
              enableMaps
                ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-xs"
                : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Include your location context & verified Google Maps links"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Maps</span>
          </button>

          {/* Start / Stop Voice Assistant Mode */}
          <button
            type="button"
            onClick={isVoiceActive ? handleStopVoiceSession : handleStartVoiceSession}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              isVoiceActive
                ? "bg-emerald-600/25 text-emerald-200 border-emerald-500/50 shadow-sm"
                : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-500/40 shadow-sm"
            }`}
            title={
              providerStatus?.voice.realtimeProviderConfigured
                ? "Start or stop Cloud Realtime Voice Conversation"
                : "Start or stop Voice Mode (Browser Web Speech + SpeechSynthesis)"
            }
          >
            <Radio className={`w-3.5 h-3.5 ${isVoiceActive ? "animate-pulse text-emerald-400" : ""}`} />
            <span>
              {isVoiceActive
                ? language === "hi"
                  ? "वॉइस सक्रिय"
                  : "Voice Active"
                : language === "hi"
                ? "वॉइस मोड"
                : "Voice Mode"}
            </span>
          </button>

          {/* Clear History */}
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear conversation history?")) setMessages([]);
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
              title="Clear Conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Honest Server API Key Setup Notice when OPENROUTER_API_KEY is missing */}
      {providerStatus && !providerStatus.providers[provider]?.configured && (
        <div className="mb-3 px-4 py-2.5 rounded-2xl bg-amber-950/50 border border-amber-700/50 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {provider === "openrouter"
                ? "OPENROUTER_API_KEY is not configured in server environment variables yet. Add it in Secrets to send live AI requests."
                : provider === "openai"
                ? "OPENAI_API_KEY is not configured on the server. Add it in Secrets or switch back to OpenRouter."
                : "Custom OpenAI-compatible credentials are not configured on the server."}
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-300 shrink-0">Server-Side Key Required</span>
        </div>
      )}

      {/* Voice Conversation Panel (renders cleanly when active or on compatibility/mic notice) */}
      <VoiceConversationPanel
        status={voiceStatus}
        toolStatus={voiceToolStatus}
        language={language}
        waveform={voiceWaveform}
        liveUserTranscript={liveUserTranscript}
        liveAIText={liveAIText}
        isMuted={isVoiceMuted}
        providerStatus={providerStatus}
        voiceError={voiceError}
        compatibilityNotice={voiceCompatibilityNotice}
        onStart={handleStartVoiceSession}
        onStop={handleStopVoiceSession}
        onToggleMute={handleToggleVoiceMute}
        onInterrupt={handleInterruptVoice}
        onClearError={() => {
          setVoiceError(null);
          setVoiceCompatibilityNotice(null);
        }}
      />

      {/* 2. Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 px-2 py-4 rounded-2xl">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-900/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-bold text-white font-['Outfit']">
                {language === "hi" ? "नमस्ते, मैं जिया हूँ।" : "Hello, I am JIYA."}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {language === "hi"
                  ? "आपकी व्यक्तिगत एआई लाइफ असिस्टेंट (OpenRouter फ्री मॉडल्स + ब्राउज़र वॉइस)। आप लिखकर या ऊपर 'वॉइस मोड' बटन से बोलकर बात कर सकते हैं।"
                  : "Your Personal AI Life Assistant powered by OpenRouter Free Models & Browser Voice. Type below or tap 'Voice Mode' for hands-free voice chat."}
              </p>
            </div>

            {/* Suggested Prompt Buttons */}
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {suggestedPrompts.map((sp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (sp.requireMaps) setEnableMaps(true);
                    handleSend(sp.prompt);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/40 text-xs text-slate-300 hover:text-white transition shadow-xs text-left"
                >
                  {language === "hi" ? sp.titleHi : sp.titleEn}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-3xl p-4 shadow-md leading-relaxed text-sm ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-xs"
                    : msg.role === "system"
                    ? "bg-rose-950/60 border border-rose-800/60 text-rose-200"
                    : "bg-slate-900/90 border border-slate-800 text-slate-100 rounded-bl-xs"
                }`}
              >
                {/* Meta Header for Assistant Responses */}
                {msg.role === "model" && (
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-2 pb-1.5 border-b border-slate-800/80 font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-violet-400 font-semibold">JIYA</span>
                      <span>·</span>
                      <span className="truncate">{msg.modelUsed || selectedModel}</span>
                      {msg.thinkingUsed && (
                        <>
                          <span>·</span>
                          <span className="text-indigo-400">Reasoning</span>
                        </>
                      )}
                    </div>
                    {msg.content && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeakMessage(msg)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition shrink-0 ${
                          speakingMessageId === msg.id
                            ? "bg-rose-950/70 text-rose-300 border border-rose-700/50"
                            : "text-slate-400 hover:text-violet-300 hover:bg-slate-800"
                        }`}
                        title={speakingMessageId === msg.id ? "Stop Speaking" : "Listen to reply"}
                      >
                        {speakingMessageId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-[10px]">Stop</span>
                          </>
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* System / Error Message Header */}
                {msg.role === "system" && (
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-rose-300 mb-2 pb-1.5 border-b border-rose-800/50">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>{language === "hi" ? "सूचना / त्रुटि" : "Assistant Notice"}</span>
                    </div>
                    <button
                      onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
                      className="p-1 text-rose-400 hover:text-white rounded-md hover:bg-rose-900/40 transition"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap font-sans text-xs md:text-sm">
                  {msg.content || (msg.id === streamingMsgId ? "..." : "")}
                </div>

                {/* System Message Recovery Actions */}
                {msg.role === "system" && lastFailedPrompt && (
                  <div className="mt-3 pt-2.5 border-t border-rose-800/40 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleSend(lastFailedPrompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{language === "hi" ? "पुनः प्रयास करें" : "Retry"}</span>
                    </button>
                  </div>
                )}

                {/* Grounding Sources (Web Search & Google Maps) */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{language === "hi" ? "सत्यापित स्रोत और लिंक:" : "Verified Sources & Locations:"}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.groundingSources.map((source, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition"
                        >
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 truncate max-w-[220px]"
                          >
                            {source.type === "maps" ? (
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            )}
                            <span className="truncate">{source.title}</span>
                          </a>

                          <button
                            onClick={() => handleCopy(source.url)}
                            className="p-1 text-slate-500 hover:text-slate-300 transition shrink-0"
                            title="Copy link"
                          >
                            {copiedLink === source.url ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Proposal Card */}
                {msg.actionProposal && !msg.actionProposal.executed && (
                  <div className="mt-4 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Action Confirmation Required: {msg.actionProposal.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      JIYA will execute this action on your authorized Google account upon your explicit approval.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setActiveConfirmation(msg.actionProposal!)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
                      >
                        Review & Confirm
                      </button>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`text-[9px] mt-2 text-right ${
                    msg.role === "user" ? "text-violet-200/80" : "text-slate-500"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex items-center gap-3 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl w-fit">
            <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
            <span>
              {textToolStatus
                ? textToolStatus
                : enableSearch
                ? "JIYA is searching web sources via OpenRouter..."
                : enableMaps
                ? "JIYA is preparing location results..."
                : "JIYA is streaming response..."}
            </span>
            {streamingMsgId && (
              <button
                type="button"
                onClick={handleAbortStream}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-[11px] font-medium border border-rose-800/60 transition"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Attachment Preview Tag */}
      {attachedFile && (
        <div className="mx-2 mb-2 p-2.5 rounded-xl bg-slate-900 border border-violet-500/40 flex items-center justify-between text-xs text-slate-200 shadow-md">
          <div className="flex items-center gap-2.5">
            {attachedFile.previewUrl ? (
              <img
                src={attachedFile.previewUrl}
                alt="Upload preview"
                className="w-8 h-8 rounded-lg object-cover border border-slate-700"
              />
            ) : (
              <FileText className="w-5 h-5 text-violet-400" />
            )}
            <div>
              <span className="font-semibold block truncate max-w-[240px]">
                {attachedFile.name}
              </span>
              <span className="text-[10px] text-slate-400">Ready for OpenRouter AI Analysis</span>
            </div>
          </div>
          <button
            onClick={() => setAttachedFile(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Bottom Input Bar */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* File Picker Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-slate-400 hover:text-violet-400 rounded-xl hover:bg-slate-800 transition shrink-0"
            title="Attach Image, PDF, or Text Document"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept="image/*,.pdf,.txt,.csv,.md,.json"
            className="hidden"
          />

          {/* Quick Dictation Mic Button */}
          <button
            type="button"
            onClick={toggleDictation}
            className={`p-2.5 rounded-xl transition shrink-0 ${
              isDictating
                ? "bg-rose-600 text-white animate-pulse"
                : "text-slate-400 hover:text-violet-400 hover:bg-slate-800"
            }`}
            title="Voice Dictation (Speech-to-Text)"
          >
            {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              language === "hi"
                ? "जिया से कुछ भी पूछें या 'वॉइस मोड' से बात करें..."
                : "Ask JIYA anything, manage emails, tasks, calendar, or start Voice Mode..."
            }
            className="flex-1 bg-transparent border-0 focus:ring-0 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!input.trim() && !attachedFile) || loading}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-900/30 transition disabled:opacity-40 disabled:hover:bg-violet-600 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 5. User Confirmation Modal */}
      {activeConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-sm text-white">
                  Confirm Action: {activeConfirmation.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveConfirmation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Per Google Workspace Security Standards, this operation modifies your account data and requires explicit confirmation.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
                {Object.entries(activeConfirmation.details).map(([key, value]) => (
                  <div key={key} className="truncate">
                    <span className="text-slate-500">{key}: </span>
                    <span className="text-slate-300">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {actionResult && (
              <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-xs text-indigo-200">
                {actionResult}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setActiveConfirmation(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={actionExecuting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30 transition disabled:opacity-50"
              >
                {actionExecuting ? "Executing..." : "Confirm & Execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
