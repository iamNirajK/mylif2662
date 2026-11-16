import React, { useState } from "react";
import { GoogleFormItem, createGoogleForm } from "../services/workspace.ts";
import { Language } from "../types.ts";
import {
  FileQuestion,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface FormsViewProps {
  language: Language;
  hasGoogleToken: boolean;
  onLogin: () => void;
}

export const FormsView: React.FC<FormsViewProps> = ({
  language,
  hasGoogleToken,
  onLogin,
}) => {
  const [createdForms, setCreatedForms] = useState<GoogleFormItem[]>([]);
  const [formTitle, setFormTitle] = useState("Physics Revision Test");
  const [formDescription, setFormDescription] = useState(
    "Test your conceptual understanding of kinematics, dynamics, and energy."
  );
  const [questions, setQuestions] = useState<
    Array<{
      title: string;
      type: "RADIO" | "CHECKBOX" | "TEXT";
      options: string[];
    }>
  >([
    {
      title: "What is the SI unit of acceleration?",
      type: "RADIO",
      options: ["m/s", "m/s²", "Newton", "Joule"],
    },
    {
      title: "Which of the following are scalar quantities?",
      type: "CHECKBOX",
      options: ["Speed", "Velocity", "Mass", "Force"],
    },
    {
      title: "State Newton's Second Law of Motion in your own words.",
      type: "TEXT",
      options: [],
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        title: `Question ${prev.length + 1}`,
        type: "RADIO",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = val;
        return { ...q, options: newOpts };
      })
    );
  };

  const handleCreateLiveGoogleForm = async () => {
    if (!formTitle.trim()) {
      alert("Please provide a form title.");
      return;
    }
    setIsCreating(true);
    try {
      const created = await createGoogleForm(formTitle, formDescription, questions);
      setCreatedForms((prev) => [created, ...prev]);
      alert("Google Form successfully created and deployed to your Google account!");
    } catch (err: any) {
      alert(`Failed to create Google Form: ${err?.message || "Unknown error"}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/15 text-emerald-400 flex items-center justify-center">
            <FileQuestion className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "गूगल फॉर्म्स स्टूडियो" : "Google Forms Studio & Generator"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "प्राकृतिक भाषा से वास्तविक गूगल फॉर्म बनाएं और उत्तर एकत्रित करें"
                : "Create genuine live Google Forms directly on your Google Account with AI"}
            </p>
          </div>
        </div>

        {!hasGoogleToken && (
          <button
            onClick={onLogin}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold transition"
          >
            Connect Google Account
          </button>
        )}
      </div>

      {/* 2. Created Live Forms List */}
      {createdForms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Live Google Forms Created
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {createdForms.map((f) => (
              <div
                key={f.formId}
                className="p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{f.title}</h3>
                    <span className="text-[11px] text-slate-400">
                      {f.questionCount} Questions configured
                    </span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between">
                    <a
                      href={f.responderUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5"
                    >
                      <span>Public Form URL</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleCopy(f.responderUri)}
                      className="text-slate-400 hover:text-white"
                      title="Copy Link"
                    >
                      {copiedUrl === f.responderUri ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <a
                      href={f.editUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
                    >
                      <span>Edit in Google Forms</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleCopy(f.editUri)}
                      className="text-slate-400 hover:text-white"
                      title="Copy Link"
                    >
                      {copiedUrl === f.editUri ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Form Builder & Questions Editor */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Form Document Title *</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-semibold focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description / Instructions</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Questions ({questions.length})
            </h3>
            <button
              onClick={handleAddQuestion}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setQuestions((prev) =>
                        prev.map((item, i) => (i === qIdx ? { ...item, title: newTitle } : item))
                      );
                    }}
                    placeholder={`Question ${qIdx + 1} prompt`}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-violet-500 font-medium"
                  />

                  <select
                    value={q.type}
                    onChange={(e) => {
                      const newType = e.target.value as "RADIO" | "CHECKBOX" | "TEXT";
                      setQuestions((prev) =>
                        prev.map((item, i) => (i === qIdx ? { ...item, type: newType } : item))
                      );
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                  >
                    <option value="RADIO">Multiple Choice</option>
                    <option value="CHECKBOX">Checkboxes</option>
                    <option value="TEXT">Short Answer</option>
                  </select>

                  <button
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    title="Remove Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Multiple choice options */}
                {q.type !== "TEXT" && (
                  <div className="space-y-1.5 pl-3 border-l-2 border-slate-800">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2 text-xs">
                        <span className="text-[10px] text-slate-500 font-mono w-4">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                          className="flex-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Live Google Form Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={handleCreateLiveGoogleForm}
            disabled={isCreating || !formTitle.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-900/30 transition disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isCreating ? "Creating on Google..." : "Deploy Live Google Form"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
