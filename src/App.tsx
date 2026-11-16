import React, { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { AppView, Language, ChatMessage } from "./types.ts";
import { initAuth, googleSignIn, logout, getAccessToken } from "./services/firebase.ts";
import {
  CalendarEventItem,
  GoogleTaskItem,
  GmailMessageSummary,
  DriveFileItem,
  ContactItem,
  listCalendarEvents,
  listGoogleTasks,
  updateGoogleTaskStatus,
  listGmailMessages,
  listDriveFiles,
  listGoogleContacts,
} from "./services/workspace.ts";

import { Header } from "./components/Header.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { DashboardView } from "./views/DashboardView.tsx";
import { ChatView } from "./views/ChatView.tsx";
import { GmailView } from "./views/GmailView.tsx";
import { CalendarView } from "./views/CalendarView.tsx";
import { TasksView } from "./views/TasksView.tsx";
import { DriveView } from "./views/DriveView.tsx";
import { StudyCenterView } from "./views/StudyCenterView.tsx";
import { FormsView } from "./views/FormsView.tsx";
import { ContactsView } from "./views/ContactsView.tsx";
import { LifeReportsView } from "./views/LifeReportsView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";
import { MapsView } from "./views/MapsView.tsx";
import { ClockWeatherView } from "./views/ClockWeatherView.tsx";

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const signInGuardRef = useRef(false);

  // Google Maps Platform Quota Defense State
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener("gmp-quota-exceeded", handleQuota);
    return () => window.removeEventListener("gmp-quota-exceeded", handleQuota);
  }, []);

  // Google Workspace Data
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [emails, setEmails] = useState<GmailMessageSummary[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialChatPrompt, setInitialChatPrompt] = useState<string | undefined>(undefined);

  // Sync theme with document element
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Initialize Firebase Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser, token) => {
        setUser(firebaseUser);
        const activeToken = token || (await getAccessToken());
        setHasGoogleToken(!!activeToken);
        if (activeToken) {
          loadAllWorkspaceData();
        }
      },
      () => {
        setUser(null);
        setHasGoogleToken(false);
        setEvents([]);
        setTasks([]);
        setEmails([]);
        setDriveFiles([]);
        setContacts([]);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch all Google Workspace data
  const loadAllWorkspaceData = async () => {
    setLoadingWorkspace(true);
    try {
      const [eventsData, tasksData, emailsData, filesData, contactsData] =
        await Promise.allSettled([
          listCalendarEvents(),
          listGoogleTasks(),
          listGmailMessages("label:INBOX", 15),
          listDriveFiles("trashed = false", 20),
          listGoogleContacts(),
        ]);

      if (eventsData.status === "fulfilled") setEvents(eventsData.value);
      if (tasksData.status === "fulfilled") setTasks(tasksData.value);
      if (emailsData.status === "fulfilled") setEmails(emailsData.value);
      if (filesData.status === "fulfilled") setDriveFiles(filesData.value);
      if (contactsData.status === "fulfilled") setContacts(contactsData.value);
    } catch (e) {
      console.error("Error loading workspace data:", e);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  // Google Sign-in Handler
  const handleLogin = async () => {
    if (signInGuardRef.current) return;
    signInGuardRef.current = true;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasGoogleToken(true);
        loadAllWorkspaceData();
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/cancelled-popup-request" || code === "auth/popup-closed-by-user") {
        return;
      }
      if (code === "auth/popup-blocked") {
        setAuthError(
          language === "hi"
            ? "ब्राउज़र ने Google Sign-In पॉपअप को ब्लॉक किया है। कृपया इस साइट के लिए पॉपअप अनुमति दें और फिर प्रयास करें।"
            : "Your browser blocked the Google Sign-In popup. Please allow popups for this site and try again."
        );
      } else {
        setAuthError(
          err?.message ||
            (language === "hi"
              ? "Google Sign-In पूरा नहीं हो सका। कृपया पुनः प्रयास करें।"
              : "Google Sign-In could not be completed. Please try again.")
        );
      }
    } finally {
      signInGuardRef.current = false;
      setIsLoggingIn(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setHasGoogleToken(false);
    setEvents([]);
    setTasks([]);
    setEmails([]);
    setDriveFiles([]);
    setContacts([]);
  };

  // Toggle Task Status with optimistic update
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const isNowComplete = currentStatus !== "completed";
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: isNowComplete ? "completed" : "needsAction" } : t))
    );

    try {
      await updateGoogleTaskStatus(taskId, isNowComplete);
    } catch (err) {
      console.error("Failed to update task status:", err);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: currentStatus as any } : t))
      );
    }
  };

  // Quick prompt router to chat
  const handleQuickPrompt = (prompt: string) => {
    setInitialChatPrompt(prompt);
    setCurrentView("chat");
  };

  // Document analysis router from Drive
  const handleAnalyzeDriveFile = (file: DriveFileItem) => {
    setInitialChatPrompt(`Please analyze this Google Drive file: "${file.name}" (Type: ${file.mimeType}, Link: ${file.webViewLink}) and extract key study summaries.`);
    setCurrentView("chat");
  };

  // Generate quiz router from Study Center
  const handleGenerateStudyQuiz = (subjectName: string) => {
    setInitialChatPrompt(`Generate an interactive practice quiz with 5 conceptual multiple-choice questions for ${subjectName}. Format with clear options, answer explanations, and revision insights.`);
    setCurrentView("chat");
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Google Maps Platform Quota Exceeded Sticky Notice Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{" "}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{" "}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="flex-1 flex min-w-0">
        {/* Sidebar Navigation */}
        <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        language={language}
        hasGoogleToken={hasGoogleToken}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          currentView={currentView}
          setCurrentView={setCurrentView}
          user={user}
          hasGoogleToken={hasGoogleToken}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isLoggingIn={isLoggingIn}
          language={language}
          onToggleLanguage={() => setLanguage((prev) => (prev === "en" ? "hi" : "en"))}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {authError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs md:text-sm text-amber-200">
              <span>{authError}</span>
              <button
                onClick={() => setAuthError(null)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
              >
                {language === "hi" ? "बंद करें" : "Dismiss"}
              </button>
            </div>
          )}
          {currentView === "dashboard" && (
            <DashboardView
              user={user}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
              language={language}
              setCurrentView={setCurrentView}
              events={events}
              tasks={tasks}
              emails={emails}
              driveFiles={driveFiles}
              loadingWorkspace={loadingWorkspace}
              onToggleTask={handleToggleTask}
              onQuickPrompt={handleQuickPrompt}
            />
          )}

          {currentView === "chat" && (
            <ChatView
              messages={messages}
              setMessages={setMessages}
              language={language}
              hasGoogleToken={hasGoogleToken}
              initialPrompt={initialChatPrompt}
              onClearInitialPrompt={() => setInitialChatPrompt(undefined)}
              onRefreshWorkspaceData={loadAllWorkspaceData}
            />
          )}

          {currentView === "weather" && (
            <ClockWeatherView
              language={language}
              onQuickPrompt={handleQuickPrompt}
            />
          )}

          {currentView === "gmail" && (
            <GmailView
              emails={emails}
              loading={loadingWorkspace}
              onRefresh={loadAllWorkspaceData}
              language={language}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
            />
          )}

          {currentView === "calendar" && (
            <CalendarView
              events={events}
              loading={loadingWorkspace}
              onRefresh={loadAllWorkspaceData}
              language={language}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
            />
          )}

          {currentView === "tasks" && (
            <TasksView
              tasks={tasks}
              loading={loadingWorkspace}
              onRefresh={loadAllWorkspaceData}
              language={language}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
              onToggleTask={handleToggleTask}
            />
          )}

          {currentView === "drive" && (
            <DriveView
              files={driveFiles}
              loading={loadingWorkspace}
              onRefresh={loadAllWorkspaceData}
              language={language}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
              onAnalyzeWithJIYA={handleAnalyzeDriveFile}
            />
          )}

          {currentView === "study" && (
            <StudyCenterView
              language={language}
              onGenerateStudyQuiz={handleGenerateStudyQuiz}
            />
          )}

          {currentView === "forms" && (
            <FormsView
              language={language}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
            />
          )}

          {currentView === "contacts" && (
            <ContactsView
              contacts={contacts}
              loading={loadingWorkspace}
              onRefresh={loadAllWorkspaceData}
              language={language}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
            />
          )}

          {currentView === "maps" && (
            <MapsView language={language} />
          )}

          {currentView === "reports" && (
            <LifeReportsView
              language={language}
              events={events}
              tasks={tasks}
              emails={emails}
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              user={user}
              hasGoogleToken={hasGoogleToken}
              onLogin={handleLogin}
              onLogout={handleLogout}
              language={language}
              onToggleLanguage={() => setLanguage((prev) => (prev === "en" ? "hi" : "en"))}
              theme={theme}
              onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            />
          )}
        </main>
      </div>
    </div>
  </div>
  );
}
