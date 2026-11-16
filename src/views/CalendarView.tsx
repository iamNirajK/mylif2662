import React, { useState } from "react";
import { CalendarEventItem, createCalendarEvent, deleteCalendarEvent } from "../services/workspace.ts";
import { Language } from "../types.ts";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  ExternalLink,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface CalendarViewProps {
  events: CalendarEventItem[];
  loading: boolean;
  onRefresh: () => void;
  language: Language;
  hasGoogleToken: boolean;
  onLogin: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  loading,
  onRefresh,
  language,
  hasGoogleToken,
  onLogin,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [eventToDelete, setEventToDelete] = useState<CalendarEventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      alert("Please provide an event title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const startDateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
      const endDateTime = new Date(
        new Date(`${startDate}T${startTime}:00`).getTime() + durationMinutes * 60000
      ).toISOString();

      await createCalendarEvent({
        summary,
        description,
        location,
        startDateTime,
        endDateTime,
      });

      setShowCreateModal(false);
      setSummary("");
      setDescription("");
      setLocation("");
      setFeedback("Event scheduled successfully on Google Calendar!");
      setTimeout(() => setFeedback(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to create event: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCalendarEvent(eventToDelete.id);
      setEventToDelete(null);
      setFeedback("Event cancelled successfully from Google Calendar.");
      setTimeout(() => setFeedback(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to delete event: ${err?.message || "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "गूगल कैलेंडर हब" : "Google Calendar & Scheduling"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "इवेंट्स देखें, शेड्यूल करें और समय प्रबंधित करें"
                : "View schedule, schedule meetings, and resolve time conflicts"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Calendar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {hasGoogleToken ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "hi" ? "इवेंट बनाएं" : "New Event"}</span>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold transition"
            >
              <span>Connect Calendar</span>
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

      {/* 2. Events Timeline List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
            <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Upcoming Events</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {hasGoogleToken
                ? "Your calendar is clear for the next two weeks. Add study blocks or meetings!"
                : "Connect your Google account to synchronize your real calendar."}
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const startDateObj = evt.start ? new Date(evt.start) : null;
            const endDateObj = evt.end ? new Date(evt.end) : null;

            return (
              <div
                key={evt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-800/40 flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase">
                      {startDateObj ? startDateObj.toLocaleDateString([], { month: "short" }) : "CAL"}
                    </span>
                    <span className="text-sm font-extrabold text-white">
                      {startDateObj ? startDateObj.getDate() : "--"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">{evt.summary}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {startDateObj?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                          - {endDateObj?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {evt.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[200px]">{evt.location}</span>
                        </div>
                      )}
                    </div>
                    {evt.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{evt.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {evt.htmlLink && (
                    <a
                      href={evt.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition"
                      title="Open in Google Calendar"
                    >
                      <span>Open Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => setEventToDelete(evt)}
                    className="p-2 rounded-xl hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition"
                    title="Cancel Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Create Google Calendar Event</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Event Summary *</label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Chemistry Revision & Problem Solving"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Duration (Minutes)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Location (Optional)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Library, Zoom, Google Meet, etc."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Notes or agenda..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md transition disabled:opacity-40"
                >
                  {isSubmitting ? "Creating..." : "Save to Google Calendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-800/60 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Cancel Calendar Event</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to cancel & delete <strong className="text-white">"{eventToDelete.summary}"</strong> from your Google Calendar?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setEventToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Keep Event
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
