export type AppView =
  | "dashboard"
  | "chat"
  | "weather"
  | "gmail"
  | "calendar"
  | "tasks"
  | "drive"
  | "study"
  | "forms"
  | "contacts"
  | "maps"
  | "reports"
  | "settings";

export type Language = "en" | "hi";

export type AIProviderId = "openrouter" | "openai" | "custom";

export interface AIModelInfo {
  id: string;
  name: string;
  provider: AIProviderId;
  isFree: boolean;
  contextLength?: number;
  supportsVision?: boolean;
  supportsReasoning?: boolean;
  description?: string;
}

export interface AIProviderStatus {
  defaultProvider: AIProviderId;
  providers: {
    openrouter: {
      configured: boolean;
      label: string;
      endpoint: string;
    };
    openai: {
      configured: boolean;
      label: string;
      endpoint: string;
    };
    custom: {
      configured: boolean;
      label: string;
      endpointConfigured: boolean;
    };
  };
  voice: {
    serverSttConfigured: boolean;
    serverTtsConfigured: boolean;
    realtimeProviderConfigured: boolean;
    activeVoiceEngine: "cloud-realtime" | "cloud-stt-tts" | "browser-hybrid-openrouter";
  };
  tools?: {
    timeToolReady: boolean;
    weatherApiConfigured: boolean;
    internetSearchReady: boolean;
    distanceToolReady: boolean;
    defaultLocation: string;
    defaultTimeZone: string;
  };
}

export type VoiceSessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "muted"
  | "interrupted"
  | "error";

export type AssistantToolStep =
  | "understanding"
  | "checking_time"
  | "checking_weather"
  | "searching_web"
  | "calculating_distance"
  | "preparing";

export interface GroundingSource {
  title: string;
  url: string;
  type: "web" | "maps";
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  content: string;
  timestamp: string;
  groundingSources?: GroundingSource[];
  thinkingUsed?: boolean;
  modelUsed?: string;
  providerUsed?: AIProviderId;
  actionProposal?: ActionProposal;
}

export interface ActionProposal {
  type: "send_email" | "create_event" | "delete_event" | "create_task" | "delete_task" | "create_form";
  title: string;
  details: Record<string, any>;
  confirmed?: boolean;
  executed?: boolean;
}

export interface StudySubject {
  id: string;
  name: string;
  color: string;
  completedChapters: number;
  totalChapters: number;
  dailyGoalMinutes: number;
  studiedMinutesToday: number;
  nextRevisionDate?: string;
}

export interface DailyPlanItem {
  id: string;
  timeSlot: string;
  title: string;
  category: "calendar" | "task" | "study" | "break";
  completed: boolean;
}

export interface UserPreferences {
  language: Language;
  theme: "dark" | "light";
  enableThinkingByDefault: boolean;
  enableSearchByDefault: boolean;
  enableMapsByDefault: boolean;
  voiceAutoSpeak: boolean;
  notificationsEnabled: boolean;
}

export interface ClockTimeData {
  city?: string;
  timezone: string;
  isoTimestamp: string;
  formattedTime: string;
  formattedTime24: string;
  formattedDate: string;
  weekday: string;
  dayNumber: number;
  monthName: string;
  year: number;
  hour24: number;
  periodOfDay: "morning" | "afternoon" | "evening" | "night";
  periodLabelEn: string;
  periodLabelHi: string;
  utcOffset: string;
}

export interface WeatherHourlyItem {
  time: string;
  hourLabel: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidity: number;
  precipitationProbability: number;
  precipitationMm: number;
  windSpeedKmh: number;
  weatherCode: number;
  conditionEn: string;
  conditionHi: string;
}

export interface WeatherDailyItem {
  date: string;
  dayLabel: string;
  tempMaxC: number;
  tempMinC: number;
  apparentTempMaxC: number;
  apparentTempMinC: number;
  precipitationSumMm: number;
  precipitationProbabilityMax: number;
  windSpeedMaxKmh: number;
  sunrise?: string;
  sunset?: string;
  weatherCode: number;
  conditionEn: string;
  conditionHi: string;
}

export interface WeatherIntelligenceData {
  locationName: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  lastUpdatedIso: string;
  lastUpdatedDisplay: string;
  cached: boolean;
  current: {
    temperatureC: number;
    apparentTemperatureC: number;
    humidity: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    precipitationMm: number;
    cloudCoverPct: number;
    isDay: boolean;
    weatherCode: number;
    conditionEn: string;
    conditionHi: string;
  };
  hourly: WeatherHourlyItem[];
  daily: WeatherDailyItem[];
}
