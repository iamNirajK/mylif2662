import type {
  AIProviderId,
  AIProviderStatus,
  AssistantToolStep,
  ChatMessage,
  GroundingSource,
  Language,
  VoiceSessionStatus,
} from "../types.ts";

export interface VoiceSessionCallbacks {
  onStatusChange: (status: VoiceSessionStatus) => void;
  onToolStatus?: (status: { step: AssistantToolStep; labelEn: string; labelHi: string } | null) => void;
  onUserTranscript: (text: string, isFinal: boolean) => void;
  onAIToken: (fullPartialText: string) => void;
  onAIGrounding?: (sources: GroundingSource[]) => void;
  onAIComplete: (payload: {
    fullText: string;
    modelUsed: string;
    providerUsed: AIProviderId;
    groundingSources?: GroundingSource[];
  }) => void;
  onWaveform: (bars: number[]) => void;
  onProviderCapabilities?: (status: AIProviderStatus) => void;
  onCompatibilityNotice?: (message: string | null) => void;
  onError: (message: string) => void;
}

export interface VoiceSessionConfig {
  provider: AIProviderId;
  model?: string;
  language: Language;
  history: ChatMessage[];
  voiceName?: string;
  enableSearch?: boolean;
  enableMaps?: boolean;
  serverSttConfigured?: boolean;
  serverTtsConfigured?: boolean;
  realtimeProviderConfigured?: boolean;
}

export interface BrowserSpeechCapabilities {
  speechRecognitionSupported: boolean;
  speechSynthesisSupported: boolean;
  microphoneSupported: boolean;
  voiceInputSupported: boolean;
  voiceOutputSupported: boolean;
  getCompatibilityMessage: (language: Language) => string | null;
}

export function getBrowserSpeechCapabilities(
  serverSttConfigured = false,
  serverTtsConfigured = false
): BrowserSpeechCapabilities {
  const hasWindow = typeof window !== "undefined";
  const speechRecognitionSupported = Boolean(
    hasWindow && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
  const speechSynthesisSupported = Boolean(hasWindow && "speechSynthesis" in window);
  const microphoneSupported = Boolean(
    typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
  );

  const voiceInputSupported = speechRecognitionSupported || serverSttConfigured;
  const voiceOutputSupported = speechSynthesisSupported || serverTtsConfigured;

  const getCompatibilityMessage = (language: Language): string | null => {
    if (!microphoneSupported) {
      return language === "hi"
        ? "इस ब्राउज़र में माइक्रोफ़ोन एक्सेस उपलब्ध नहीं है (HTTPS आवश्यक है)। आप नीचे टेक्स्ट चैट का उपयोग कर सकते हैं।"
        : "Microphone access is not available in this browser or context (HTTPS required). You can continue using text chat below.";
    }
    if (!voiceInputSupported && !voiceOutputSupported) {
      return language === "hi"
        ? "आपका वर्तमान ब्राउज़र Web Speech API (वॉइस इनपुट व स्पीच आउटपुट) को सपोर्ट नहीं करता है। कृपया Google Chrome, Microsoft Edge या Safari आज़माएं, या टेक्स्ट चैट जारी रखें।"
        : "Your current browser does not support built-in Web Speech voice input or SpeechSynthesis output. Please use Google Chrome, Microsoft Edge, or Safari for voice features, or continue with text chat.";
    }
    if (!voiceInputSupported) {
      return language === "hi"
        ? "आपका ब्राउज़र बिल्ट-इन Web Speech Recognition (वॉइस इनपुट) को सपोर्ट नहीं करता है। वॉइस इनपुट के लिए Chrome या Edge उपयोग करें, या नीचे टाइप करें।"
        : "Your browser does not support built-in Web Speech Recognition for voice input. Try Google Chrome, Microsoft Edge, or Safari, or type your message below.";
    }
    if (!voiceOutputSupported) {
      return language === "hi"
        ? "इस ब्राउज़र में SpeechSynthesis (वॉइस आउटपुट) उपलब्ध नहीं है। जिया के जवाब टेक्स्ट के रूप में दिखेंगे।"
        : "Browser SpeechSynthesis voice output is unsupported here. Voice input still works and AI replies will be shown as text.";
    }
    return null;
  };

  return {
    speechRecognitionSupported,
    speechSynthesisSupported,
    microphoneSupported,
    voiceInputSupported,
    voiceOutputSupported,
    getCompatibilityMessage,
  };
}

interface SpeechQueueItem {
  text: string;
  audioBase64: string | null;
  mimeType: string | null;
}

function pickBestBrowserVoice(language: Language): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  if (language === "hi") {
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith("hi") && /google|swara|natural|neural/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
      voices.find((v) => v.lang.toLowerCase().includes("in")) ||
      null
    );
  }

  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("en") && /natural|neural|google us|samantha|aria|jenny/i.test(v.name)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en-us")) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    null
  );
}

let activeOneShotAudio: HTMLAudioElement | null = null;
let activeOneShotResolver: (() => void) | null = null;

export function stopBrowserSpeech() {
  if (activeOneShotAudio) {
    try {
      activeOneShotAudio.pause();
      activeOneShotAudio.src = "";
    } catch {}
    activeOneShotAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  if (activeOneShotResolver) {
    const resolve = activeOneShotResolver;
    activeOneShotResolver = null;
    resolve();
  }
}

export async function speakMessageOnce(
  text: string,
  language: Language,
  options?: { serverTtsConfigured?: boolean }
): Promise<{ played: boolean; supported: boolean }> {
  const cleanText = text.replace(/[*_`#>\[\]]/g, "").trim();
  if (!cleanText) return { played: false, supported: true };

  stopBrowserSpeech();

  // Attempt server Cloud TTS only if configured on server (modular upgrade path)
  if (options?.serverTtsConfigured) {
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText.slice(0, 3500), language }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.configured && data?.audioBase64) {
          await new Promise<void>((resolve) => {
            const audio = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.audioBase64}`);
            activeOneShotAudio = audio;
            activeOneShotResolver = resolve;
            const finish = () => {
              if (activeOneShotAudio === audio) activeOneShotAudio = null;
              if (activeOneShotResolver === resolve) activeOneShotResolver = null;
              resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
          });
          return { played: true, supported: true };
        }
      }
    } catch {
      // Fallback cleanly to browser SpeechSynthesis
    }
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    await new Promise<void>((resolve) => {
      activeOneShotResolver = resolve;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = language === "hi" ? "hi-IN" : "en-US";
      const voice = pickBestBrowserVoice(language);
      if (voice) utterance.voice = voice;
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      const safetyTimer = window.setTimeout(() => {
        if (activeOneShotResolver === resolve) activeOneShotResolver = null;
        resolve();
      }, Math.max(10000, cleanText.length * 110));

      const finish = () => {
        clearTimeout(safetyTimer);
        if (activeOneShotResolver === resolve) activeOneShotResolver = null;
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
    return { played: true, supported: true };
  }

  return { played: false, supported: false };
}

export class VoiceConversationManager {
  private callbacks: VoiceSessionCallbacks;
  private config: VoiceSessionConfig;
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadFrameId: number | null = null;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecordingFallback = false;

  private status: VoiceSessionStatus = "idle";
  private isMuted = false;
  private isActive = false;
  private isSpeaking = false;
  private isPausedForSpeech = false;
  private isStreamFinished = true;
  private currentAIText = "";

  // Speech queue
  private speechQueue: SpeechQueueItem[] = [];
  private isPlayingQueue = false;
  private activeAudioEl: HTMLAudioElement | null = null;

  // VAD & End-of-speech timers
  private bargeInHighFrames = 0;
  private lastSpeechDetectedAt = 0;
  private silenceFinalizeTimer: number | null = null;
  private pendingTranscript = "";
  private pingTimer: number | null = null;

  constructor(config: VoiceSessionConfig, callbacks: VoiceSessionCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  private setStatus(next: VoiceSessionStatus) {
    this.status = next;
    this.callbacks.onStatusChange(next);
  }

  public updateConfig(partial: Partial<VoiceSessionConfig>) {
    this.config = { ...this.config, ...partial };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "session:start",
          provider: this.config.provider,
          model: this.config.model,
          language: this.config.language,
          voiceName: this.config.voiceName || "nova",
        })
      );
    }
    if (this.recognition) {
      this.recognition.lang = this.config.language === "hi" ? "hi-IN" : "en-US";
    }
  }

  public async start(): Promise<void> {
    if (this.isActive) return;

    const caps = getBrowserSpeechCapabilities(
      Boolean(this.config.serverSttConfigured),
      Boolean(this.config.serverTtsConfigured)
    );

    // Pre-flight check: if voice input is unsupported by both browser and server, show friendly compatibility notice
    if (!caps.microphoneSupported || !caps.voiceInputSupported) {
      this.setStatus("error");
      this.callbacks.onError(
        caps.getCompatibilityMessage(this.config.language) ||
          "Voice input is not supported in this browser."
      );
      return;
    }

    if (!caps.voiceOutputSupported) {
      this.callbacks.onCompatibilityNotice?.(
        caps.getCompatibilityMessage(this.config.language)
      );
    } else {
      this.callbacks.onCompatibilityNotice?.(null);
    }

    this.isActive = true;
    this.isMuted = false;
    this.isPausedForSpeech = false;
    this.setStatus("connecting");

    // Preload browser voices
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    // 1. Request microphone permission cleanly
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      this.isActive = false;
      this.setStatus("error");
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        this.callbacks.onError(
          this.config.language === "hi"
            ? "माइक्रोफ़ोन की अनुमति अस्वीकार कर दी गई है। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन एक्सेस की अनुमति दें और पुनः प्रयास करें।"
            : "Microphone permission denied. Please allow microphone access in your browser settings and try again."
        );
      } else if (err?.name === "NotFoundError") {
        this.callbacks.onError(
          this.config.language === "hi"
            ? "कोई माइक्रोफ़ोन डिवाइस नहीं मिला। कृपया एक माइक्रोफ़ोन कनेक्ट करें।"
            : "No microphone device detected. Please connect a microphone."
        );
      } else {
        this.callbacks.onError(`Could not access microphone: ${err?.message || "Unknown error"}`);
      }
      return;
    }

    // 2. Initialize Web Audio Analyser for Waveform & optional VAD
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.75;
      source.connect(this.analyser);
    } catch (err: any) {
      console.warn("AudioContext init warning:", err);
    }

    // 3. Connect Voice Transport WebSocket (/ws/voice)
    try {
      await this.connectWebSocket();
    } catch (err: any) {
      this.stop();
      this.setStatus("error");
      this.callbacks.onError(err?.message || "Failed to connect to Voice WebSocket server.");
      return;
    }

    // 4. Start Waveform/VAD loop and Web Speech Recognition
    this.startVadAndWaveformLoop();
    this.startSpeechCapture();
    this.setStatus("listening");
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${proto}://${window.location.host}/ws/voice`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const connectTimeout = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("Voice WebSocket connection timed out."));
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        ws.send(
          JSON.stringify({
            type: "session:start",
            provider: this.config.provider,
            model: this.config.model,
            language: this.config.language,
            voiceName: this.config.voiceName || "nova",
            history: this.config.history.map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
          })
        );

        this.pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 20000);

        resolve();
      };

      ws.onerror = () => {
        clearTimeout(connectTimeout);
        if (this.status === "connecting") {
          reject(new Error("Voice WebSocket connection failed."));
        }
      };

      ws.onclose = () => {
        clearTimeout(connectTimeout);
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        if (this.isActive) {
          this.isActive = false;
          this.setStatus("idle");
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch {}
      };
    });
  }

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case "session:ready":
      case "session:configured": {
        if (msg.status) {
          this.config.serverSttConfigured = Boolean(msg.status.voice?.serverSttConfigured);
          this.config.serverTtsConfigured = Boolean(msg.status.voice?.serverTtsConfigured);
          this.config.realtimeProviderConfigured = Boolean(
            msg.status.voice?.realtimeProviderConfigured
          );
          if (this.callbacks.onProviderCapabilities) {
            this.callbacks.onProviderCapabilities(msg.status);
          }
        }
        break;
      }
      case "stt:transcript": {
        if (msg.text) {
          this.callbacks.onUserTranscript(msg.text, true);
        }
        break;
      }
      case "ai:thinking": {
        this.currentAIText = "";
        this.isStreamFinished = false;
        this.clearAudioQueue();
        this.callbacks.onToolStatus?.({
          step: "understanding",
          labelEn: "Understanding...",
          labelHi: "समझ रही हूँ...",
        });
        this.setStatus("processing");
        break;
      }
      case "ai:status": {
        if (msg.step) {
          this.callbacks.onToolStatus?.({
            step: msg.step as AssistantToolStep,
            labelEn: msg.labelEn || "Processing...",
            labelHi: msg.labelHi || "प्रोसेस कर रही हूँ...",
          });
        }
        break;
      }
      case "ai:grounding": {
        if (Array.isArray(msg.groundingSources)) {
          this.callbacks.onAIGrounding?.(msg.groundingSources);
        }
        break;
      }
      case "ai:token": {
        if (typeof msg.token === "string") {
          this.currentAIText += msg.token;
          this.callbacks.onAIToken(this.currentAIText);
        }
        break;
      }
      case "ai:sentence": {
        if (typeof msg.text === "string" && msg.text.trim()) {
          this.enqueueSpeech({
            text: msg.text,
            audioBase64: msg.audioBase64 || null,
            mimeType: msg.mimeType || null,
          });
        }
        break;
      }
      case "ai:done": {
        this.isStreamFinished = true;
        this.callbacks.onToolStatus?.(null);
        this.callbacks.onAIComplete({
          fullText: msg.fullText || this.currentAIText,
          modelUsed: msg.modelUsed || this.config.model || "openrouter",
          providerUsed: msg.providerUsed || this.config.provider,
          groundingSources: Array.isArray(msg.groundingSources) ? msg.groundingSources : undefined,
        });
        if (!this.isPlayingQueue && this.speechQueue.length === 0 && this.isActive) {
          this.resumeListeningState();
        }
        break;
      }
      case "ai:interrupted": {
        this.clearAudioQueue();
        this.callbacks.onToolStatus?.(null);
        this.isStreamFinished = true;
        if (this.isActive) {
          this.resumeListeningState();
        }
        break;
      }
      case "ai:error": {
        this.clearAudioQueue();
        this.callbacks.onToolStatus?.(null);
        this.isStreamFinished = true;
        this.callbacks.onError(msg.error || "Voice assistant error.");
        if (this.isActive) {
          this.resumeListeningState();
        }
        break;
      }
    }
  }

  private resumeListeningState() {
    if (!this.isActive) return;
    if (this.isMuted) {
      this.setStatus("muted");
    } else {
      this.setStatus("listening");
    }
  }

  private startVadAndWaveformLoop() {
    if (!this.analyser) return;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const tick = () => {
      if (!this.isActive || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Compute 16 waveform bars normalized 0..1
      const barCount = 16;
      const step = Math.max(1, Math.floor(bufferLength / barCount));
      const bars: number[] = [];
      let sum = 0;

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] || 0;
        const norm = this.isMuted ? 0.05 : Math.min(1, val / 180);
        bars.push(norm);
        sum += val;
      }

      // If AI is speaking, add gentle organic animation fallback if mic is quiet
      if (this.isSpeaking) {
        const t = Date.now() / 160;
        const aiBars = bars.map((b, idx) =>
          Math.max(b, 0.22 + 0.35 * Math.abs(Math.sin(t + idx * 0.55)))
        );
        this.callbacks.onWaveform(aiBars);
      } else {
        this.callbacks.onWaveform(bars);
      }

      // Voice Activity Detection (RMS energy)
      // Note: Browser speech is turn-based (not full-duplex echo-cancelled), so only run mic barge-in
      // when a dedicated full-duplex realtime voice provider is configured.
      const avgEnergy = sum / barCount;
      const speechThreshold = 26;
      const bargeInThreshold = 42;
      const allowFullDuplexBargeIn = Boolean(this.config.realtimeProviderConfigured);

      if (!this.isMuted) {
        if (this.isSpeaking) {
          if (allowFullDuplexBargeIn && avgEnergy > bargeInThreshold) {
            this.bargeInHighFrames++;
            if (this.bargeInHighFrames >= 8) {
              this.bargeInHighFrames = 0;
              this.interruptAI();
            }
          } else {
            this.bargeInHighFrames = Math.max(0, this.bargeInHighFrames - 1);
          }
        } else if (avgEnergy > speechThreshold) {
          this.lastSpeechDetectedAt = Date.now();
          // Start MediaRecorder chunk only if server STT is configured and browser SpeechRecognition is unavailable
          if (
            !this.recognition &&
            this.config.serverSttConfigured &&
            !this.isRecordingFallback &&
            this.status === "listening"
          ) {
            this.startFallbackMediaRecording();
          }
        } else if (
          !this.recognition &&
          this.config.serverSttConfigured &&
          this.isRecordingFallback &&
          Date.now() - this.lastSpeechDetectedAt > 1100
        ) {
          this.stopAndSendFallbackRecording();
        }
      }

      this.vadFrameId = requestAnimationFrame(tick);
    };

    this.vadFrameId = requestAnimationFrame(tick);
  }

  private startSpeechCapture() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Browser does not have Web Speech STT -> rely on MediaRecorder + VAD + Server Whisper STT
      this.recognition = null;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.config.language === "hi" ? "hi-IN" : "en-US";

    recognition.onresult = (event: any) => {
      if (!this.isActive || this.isMuted || this.isPausedForSpeech) return;

      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0]?.transcript || "";
        if (res.isFinal) {
          finalChunk += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      // Only trigger voice barge-in if dedicated full-duplex realtime voice is active
      if (
        this.config.realtimeProviderConfigured &&
        (interim.trim().length > 3 || finalChunk.trim().length > 1) &&
        this.isSpeaking
      ) {
        this.interruptAI();
      }

      if (finalChunk.trim()) {
        this.pendingTranscript = `${this.pendingTranscript} ${finalChunk}`.trim();
      }

      const displayLive = `${this.pendingTranscript} ${interim}`.trim();
      if (displayLive) {
        this.callbacks.onUserTranscript(displayLive, false);
      }

      // Reset end-of-speech silence timer (950ms natural pause sends utterance)
      if (this.silenceFinalizeTimer) {
        clearTimeout(this.silenceFinalizeTimer);
      }

      if (this.pendingTranscript || interim.trim()) {
        this.silenceFinalizeTimer = window.setTimeout(() => {
          const textToSend = (this.pendingTranscript || interim).trim();
          this.pendingTranscript = "";
          if (textToSend && this.isActive && !this.isMuted && !this.isPausedForSpeech) {
            this.sendUserUtteranceText(textToSend);
          }
        }, 950);
      }
    };

    recognition.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        this.callbacks.onError(
          this.config.language === "hi"
            ? "स्पीच रिकग्निशन के लिए माइक्रोफ़ोन अनुमति अवरुद्ध है।"
            : "Microphone permission blocked for speech recognition."
        );
      }
      // Ignore 'no-speech' and 'aborted' during normal turn-based cycling
    };

    recognition.onend = () => {
      // Automatically resume listening after turn ends when active, unmuted, and not paused for AI speech
      if (this.isActive && !this.isMuted && !this.isPausedForSpeech) {
        try {
          recognition.lang = this.config.language === "hi" ? "hi-IN" : "en-US";
          recognition.start();
        } catch {}
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {}
  }

  private startFallbackMediaRecording() {
    if (!this.mediaStream || this.isRecordingFallback) return;
    try {
      this.recordedChunks = [];
      const recorder = new MediaRecorder(this.mediaStream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };
      recorder.onstop = async () => {
        this.isRecordingFallback = false;
        if (!this.isActive || this.recordedChunks.length === 0) return;
        const blob = new Blob(this.recordedChunks, { type: recorder.mimeType || "audio/webm" });
        this.recordedChunks = [];
        if (blob.size < 1500) return; // ignore tiny clicks

        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          if (base64 && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: "user:utterance",
                audioBase64: base64,
                mimeType: blob.type || "audio/webm",
                language: this.config.language,
                provider: this.config.provider,
                model: this.config.model,
                enableSearch: Boolean(this.config.enableSearch),
                enableMaps: Boolean(this.config.enableMaps),
              })
            );
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      this.mediaRecorder = recorder;
      this.isRecordingFallback = true;
    } catch {}
  }

  private stopAndSendFallbackRecording() {
    if (this.mediaRecorder && this.isRecordingFallback && this.mediaRecorder.state === "recording") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
  }

  public sendUserUtteranceText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.callbacks.onUserTranscript(cleaned, true);
    this.ws.send(
      JSON.stringify({
        type: "user:utterance",
        text: cleaned,
        language: this.config.language,
        provider: this.config.provider,
        model: this.config.model,
        enableSearch: Boolean(this.config.enableSearch),
        enableMaps: Boolean(this.config.enableMaps),
      })
    );
  }

  private enqueueSpeech(item: SpeechQueueItem) {
    this.speechQueue.push(item);
    if (!this.isPlayingQueue) {
      this.processSpeechQueue();
    }
  }

  private pauseRecognitionForSpeech() {
    if (this.config.realtimeProviderConfigured) return;
    this.isPausedForSpeech = true;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  private resumeRecognitionAfterSpeech() {
    this.isPausedForSpeech = false;
    if (this.isActive && !this.isMuted && this.recognition) {
      try {
        this.recognition.lang = this.config.language === "hi" ? "hi-IN" : "en-US";
        this.recognition.start();
      } catch {}
    }
  }

  private async processSpeechQueue() {
    if (this.isPlayingQueue) return;
    this.isPlayingQueue = true;
    this.pauseRecognitionForSpeech();

    while (this.speechQueue.length > 0 && this.isActive) {
      const next = this.speechQueue.shift()!;
      this.isSpeaking = true;
      this.setStatus("speaking");

      if (next.audioBase64) {
        await this.playBase64Audio(next.audioBase64, next.mimeType || "audio/mpeg");
      } else {
        await this.speakWithBrowserSynthesis(next.text);
      }
    }

    this.isPlayingQueue = false;
    this.isSpeaking = false;

    if (this.isActive && this.isStreamFinished) {
      this.resumeRecognitionAfterSpeech();
      this.resumeListeningState();
    } else if (this.isActive && !this.isMuted) {
      this.resumeRecognitionAfterSpeech();
    }
  }

  private playBase64Audio(base64: string, mimeType: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isActive) {
        resolve();
        return;
      }
      const audio = new Audio(`data:${mimeType};base64,${base64}`);
      this.activeAudioEl = audio;
      const done = () => {
        if (this.activeAudioEl === audio) this.activeAudioEl = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });
  }

  private speakWithBrowserSynthesis(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (
        !this.isActive ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.config.language === "hi" ? "hi-IN" : "en-US";
      const voice = pickBestBrowserVoice(this.config.language);
      if (voice) utterance.voice = voice;
      utterance.rate = 1.03;
      utterance.pitch = 1.0;

      // Safety timeout in case browser speechSynthesis stalls on long strings
      const safetyTimer = window.setTimeout(() => resolve(), Math.max(8000, text.length * 110));

      utterance.onend = () => {
        clearTimeout(safetyTimer);
        resolve();
      };
      utterance.onerror = () => {
        clearTimeout(safetyTimer);
        resolve();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        clearTimeout(safetyTimer);
        resolve();
      }
    });
  }

  private clearAudioQueue() {
    this.speechQueue = [];
    this.isPlayingQueue = false;
    this.isSpeaking = false;

    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.src = "";
      } catch {}
      this.activeAudioEl = null;
    }

    stopBrowserSpeech();
  }

  public interruptAI() {
    this.clearAudioQueue();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "user:interrupt" }));
    }
    this.setStatus("interrupted");
    this.resumeRecognitionAfterSpeech();
    window.setTimeout(() => {
      if (this.isActive && this.status === "interrupted") {
        this.resumeListeningState();
      }
    }, 250);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    if (this.isMuted) {
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {}
      }
      this.setStatus("muted");
    } else {
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch {}
      }
      this.setStatus(this.isSpeaking ? "speaking" : "listening");
    }
    return this.isMuted;
  }

  public stop() {
    this.isActive = false;
    this.clearAudioQueue();

    if (this.silenceFinalizeTimer) {
      clearTimeout(this.silenceFinalizeTimer);
      this.silenceFinalizeTimer = null;
    }

    if (this.vadFrameId !== null) {
      cancelAnimationFrame(this.vadFrameId);
      this.vadFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    if (this.mediaRecorder && this.isRecordingFallback) {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.isRecordingFallback = false;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
      this.analyser = null;
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "session:stop" }));
        }
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.callbacks.onWaveform(new Array(16).fill(0));
    this.setStatus("idle");
  }
}
