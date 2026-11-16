import React, { useState } from "react";
import { ContactItem, createGoogleContact } from "../services/workspace.ts";
import { Language } from "../types.ts";
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface ContactsViewProps {
  contacts: ContactItem[];
  loading: boolean;
  onRefresh: () => void;
  language: Language;
  hasGoogleToken: boolean;
  onLogin: () => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  loading,
  onRefresh,
  language,
  hasGoogleToken,
  onLogin,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!givenName.trim()) {
      alert("Please provide at least a first name.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createGoogleContact({
        givenName,
        familyName,
        email: email || undefined,
        phone: phone || undefined,
      });

      setShowAddModal(false);
      setGivenName("");
      setFamilyName("");
      setEmail("");
      setPhone("");
      setFeedback("Contact added to your Google Contacts!");
      setTimeout(() => setFeedback(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to add contact: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "गूगल संपर्क (Contacts)" : "Google Contacts & People Directory"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "गूगल पीपल एपीआई के माध्यम से संपर्क खोजें और प्रबंधित करें"
                : "Search and organize connections via official Google People API"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Contacts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {hasGoogleToken ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "hi" ? "नया संपर्क" : "Add Contact"}</span>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold transition"
            >
              Connect Contacts
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 2. Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            language === "hi" ? "संपर्क नाम, ईमेल या फ़ोन खोजें..." : "Search contacts by name, email or phone..."
          }
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* 3. Contacts Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              {hasGoogleToken ? "No contacts found matching search." : "Connect Google Account to view your contacts."}
            </p>
          </div>
        ) : (
          filtered.map((c, i) => (
            <div
              key={c.resourceName || i}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition space-y-2.5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-700/30 text-violet-300 flex items-center justify-center font-bold text-sm border border-violet-500/20">
                  {c.name[0]?.toUpperCase() || "U"}
                </div>
                <div className="truncate">
                  <h3 className="text-xs font-semibold text-white truncate">{c.name}</h3>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                {c.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Add Contact to Google Contacts</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">First Name *</label>
                  <input
                    type="text"
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md transition disabled:opacity-40"
                >
                  {isSubmitting ? "Saving..." : "Save to Google Contacts"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
