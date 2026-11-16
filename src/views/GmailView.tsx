import React, { useState } from "react";
import { GmailMessageSummary, sendGmailEmail, createGmailDraft } from "../services/workspace.ts";
import { Language } from "../types.ts";
import {
  Mail,
  Search,
  RefreshCw,
  Send,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  FileEdit,
  X,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";

interface GmailViewProps {
  emails: GmailMessageSummary[];
  loading: boolean;
  onRefresh: () => void;
  language: Language;
  hasGoogleToken: boolean;
  onLogin: () => void;
}

export const GmailView: React.FC<GmailViewProps> = ({
  emails,
  loading,
  onRefresh,
  language,
  hasGoogleToken,
  onLogin,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<GmailMessageSummary | null>(null);

  // Compose State
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Confirmation Modal
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  // Filtered emails
  const filteredEmails = emails.filter(
    (e) =>
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      alert("Please provide recipient email address and subject.");
      return;
    }
    setIsSending(true);
    try {
      await sendGmailEmail({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      setShowConfirmSend(false);
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setSendSuccessMessage("Email sent successfully via Gmail API!");
      setTimeout(() => setSendSuccessMessage(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to send email: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      alert("Please provide recipient email address and subject.");
      return;
    }
    setIsSending(true);
    try {
      await createGmailDraft({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setSendSuccessMessage("Draft saved to your Gmail account!");
      setTimeout(() => setSendSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to save draft: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600/15 text-rose-400 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "जीमेल हब" : "Gmail Inbox & AI Intelligence"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "आधिकारिक जीमेल एपीआई से सुरक्षित ईमेल प्रबंधन"
                : "Secure email management via official Gmail API"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Inbox"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {hasGoogleToken ? (
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition"
            >
              <FileEdit className="w-4 h-4" />
              <span>{language === "hi" ? "ईमेल लिखें" : "Compose Email"}</span>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold transition"
            >
              <span>Connect Gmail</span>
            </button>
          )}
        </div>
      </div>

      {sendSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{sendSuccessMessage}</span>
        </div>
      )}

      {/* 2. Search & Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            language === "hi"
              ? "ईमेल, प्रेषक या विषय खोजें..."
              : "Search emails by sender, subject or keyword..."
          }
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* 3. Email List & Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Email Cards List */}
        <div className="lg:col-span-7 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading inbox messages...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
              <Mail className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                {hasGoogleToken ? "No messages found matching criteria." : "Connect Google Account to view your emails."}
              </p>
            </div>
          ) : (
            filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                  selectedEmail?.id === email.id
                    ? "bg-violet-950/20 border-violet-500/50"
                    : email.isUnread
                    ? "bg-slate-900/90 border-slate-700/80"
                    : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold truncate max-w-[220px] ${email.isUnread ? "text-white" : "text-slate-300"}`}>
                    {email.sender.split("<")[0].replace(/"/g, "")}
                  </span>
                  <span className="text-[10px] text-slate-400">{email.date}</span>
                </div>
                <h4 className={`text-xs truncate ${email.isUnread ? "font-bold text-slate-100" : "font-medium text-slate-300"}`}>
                  {email.subject}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {email.snippet}
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-mono">ID: {email.id.substring(0, 10)}</span>
                  <a
                    href={email.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-rose-400 hover:text-rose-300"
                  >
                    <span>Open in Gmail</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Email Detail Panel */}
        <div className="lg:col-span-5">
          {selectedEmail ? (
            <div className="sticky top-20 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 shadow-xl">
              <div className="space-y-1 pb-3 border-b border-slate-800">
                <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">
                  Email Details
                </span>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {selectedEmail.subject}
                </h3>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500 font-medium">From: </span>
                  <span className="text-slate-200">{selectedEmail.sender}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Date: </span>
                  <span>{selectedEmail.date}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                {selectedEmail.snippet}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  href={selectedEmail.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                  <span>Open Full Thread in Gmail</span>
                </a>

                <button
                  onClick={() => {
                    setComposeTo(selectedEmail.sender);
                    setComposeSubject(`Re: ${selectedEmail.subject}`);
                    setShowCompose(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Draft Quick Reply</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-64 rounded-3xl bg-slate-900/30 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
              Select an email from the left to view details and quick reply
            </div>
          )}
        </div>
      </div>

      {/* 4. Compose Email Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-sm text-white">Compose Email (Gmail API)</h3>
              </div>
              <button
                onClick={() => setShowCompose(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">To Recipient</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Message Body</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={6}
                  placeholder="Write your email content..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSending}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Save as Draft
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmSend(true)}
                  disabled={!composeTo || !composeSubject || isSending}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-40"
                >
                  Send with Confirmation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Explicit Send Confirmation Modal */}
      {showConfirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-600/50 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Confirm Sending Email</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to send this email to <strong className="text-white">{composeTo}</strong>?
            </p>
            <div className="p-3 rounded-xl bg-slate-950 text-[11px] text-slate-400 space-y-1">
              <div>Subject: <span className="text-slate-200">{composeSubject}</span></div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmSend(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSending}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Yes, Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
