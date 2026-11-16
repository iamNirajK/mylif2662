import React, { useState, useRef } from "react";
import { DriveFileItem, uploadDriveFile } from "../services/workspace.ts";
import { Language } from "../types.ts";
import {
  HardDrive,
  Search,
  Upload,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface DriveViewProps {
  files: DriveFileItem[];
  loading: boolean;
  onRefresh: () => void;
  language: Language;
  hasGoogleToken: boolean;
  onLogin: () => void;
  onAnalyzeWithJIYA: (file: DriveFileItem) => void;
}

export const DriveView: React.FC<DriveViewProps> = ({
  files,
  loading,
  onRefresh,
  language,
  hasGoogleToken,
  onLogin,
  onAnalyzeWithJIYA,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel")) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (mimeType.includes("image")) {
      return <Image className="w-5 h-5 text-cyan-400" />;
    }
    if (mimeType.includes("document") || mimeType.includes("word") || mimeType.includes("pdf")) {
      return <FileText className="w-5 h-5 text-indigo-400" />;
    }
    return <FileCode className="w-5 h-5 text-amber-400" />;
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter === "docs") return f.mimeType.includes("document") || f.mimeType.includes("text");
    if (typeFilter === "sheets") return f.mimeType.includes("spreadsheet");
    if (typeFilter === "pdf") return f.mimeType.includes("pdf");
    if (typeFilter === "images") return f.mimeType.includes("image");
    return true;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFeedback(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          await uploadDriveFile(file.name, file.type || "application/octet-stream", content);
          setUploadFeedback(`"${file.name}" uploaded successfully to your Google Drive!`);
          setTimeout(() => setUploadFeedback(null), 4000);
          onRefresh();
        } catch (err: any) {
          alert(`Failed to upload to Drive: ${err?.message || "Unknown error"}`);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    } catch (e: any) {
      alert(`Upload error: ${e?.message}`);
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-600/15 text-amber-400 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "गूगल ड्राइव वॉल्ट" : "Google Drive Vault"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "दस्तावेज़, अध्ययन नोट्स और फ़ाइलें सुरक्षित रूप से ब्राउज़ व विश्लेषण करें"
                : "Browse, upload, and conversationally analyze your Drive documents"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Files"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {hasGoogleToken ? (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? "Uploading..." : language === "hi" ? "फाइल अपलोड करें" : "Upload to Drive"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold transition"
            >
              <span>Connect Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {uploadFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{uploadFeedback}</span>
        </div>
      )}

      {/* 2. Search & Type Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === "hi" ? "ड्राइव फाइल्स खोजें..." : "Search files in your Google Drive..."
            }
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800 shrink-0">
          {[
            { id: "all", label: "All" },
            { id: "docs", label: "Docs" },
            { id: "sheets", label: "Sheets" },
            { id: "pdf", label: "PDFs" },
            { id: "images", label: "Images" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                typeFilter === t.id
                  ? "bg-slate-800 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Files Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            Loading Google Drive files...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
            <HardDrive className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              {hasGoogleToken ? "No files found matching criteria." : "Connect Google Drive to browse your files."}
            </p>
          </div>
        ) : (
          filteredFiles.map((file) => (
            <div
              key={file.id}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 border border-slate-800">
                  {getFileIcon(file.mimeType)}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h3 className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    {file.size && <span>{file.size}</span>}
                    {file.modifiedTime && (
                      <>
                        <span>·</span>
                        <span>{file.modifiedTime}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & Links */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {file.webViewLink && (
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={() => onAnalyzeWithJIYA(file)}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300 font-semibold transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
