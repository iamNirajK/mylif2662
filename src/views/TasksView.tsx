import React, { useState } from "react";
import { GoogleTaskItem, createGoogleTask, updateGoogleTaskStatus, deleteGoogleTask } from "../services/workspace.ts";
import { Language } from "../types.ts";
import {
  CheckSquare,
  Plus,
  Circle,
  CheckCircle2,
  Trash2,
  Clock,
  RefreshCw,
  AlertTriangle,
  X,
  Sparkles,
} from "lucide-react";

interface TasksViewProps {
  tasks: GoogleTaskItem[];
  loading: boolean;
  onRefresh: () => void;
  language: Language;
  hasGoogleToken: boolean;
  onLogin: () => void;
  onToggleTask: (taskId: string, currentStatus: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  loading,
  onRefresh,
  language,
  hasGoogleToken,
  onLogin,
  onToggleTask,
}) => {
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Task deletion confirmation
  const [taskToDelete, setTaskToDelete] = useState<GoogleTaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return t.status === "needsAction";
    if (filter === "completed") return t.status === "completed";
    return true;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const dueTimestamp = newTaskDue ? new Date(newTaskDue).toISOString() : undefined;
      await createGoogleTask({
        title: newTaskTitle,
        notes: newTaskNotes || undefined,
        due: dueTimestamp,
      });

      setNewTaskTitle("");
      setNewTaskNotes("");
      setNewTaskDue("");
      setShowAddForm(false);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to create task: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await deleteGoogleTask(taskToDelete.id);
      setTaskToDelete(null);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to delete task: ${err?.message || "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/15 text-emerald-400 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "गूगल टास्क व रिमाइंडर" : "Google Tasks & Action Items"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "दैनिक कार्य, अध्ययन रिमाइंडर और लक्ष्य प्रबंधन"
                : "Daily to-dos, study revisions, and priority checklists"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Tasks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {hasGoogleToken ? (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? "Close Form" : language === "hi" ? "नया टास्क" : "New Task"}</span>
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold transition"
            >
              <span>Connect Google Tasks</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. New Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTask}
          className="p-5 rounded-3xl bg-slate-900 border border-slate-700 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {language === "hi" ? "नया गूगल टास्क जोड़ें" : "Add Task to Google Tasks"}
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="e.g. Revise Physics Chapter 4 at 7:00 PM"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              type="text"
              value={newTaskNotes}
              onChange={(e) => setNewTaskNotes(e.target.value)}
              placeholder="Notes or study material link..."
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="datetime-local"
              value={newTaskDue}
              onChange={(e) => setNewTaskDue(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !newTaskTitle.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-40"
            >
              {isSubmitting ? "Adding..." : "Add to Google Tasks"}
            </button>
          </div>
        </form>
      )}

      {/* 3. Filter Segmented Controls */}
      <div className="flex items-center gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setFilter("pending")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            filter === "pending"
              ? "bg-slate-800 text-white shadow-xs font-semibold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {language === "hi" ? "लंबित (Pending)" : "Pending"}
        </button>
        <button
          onClick={() => setFilter("completed")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            filter === "completed"
              ? "bg-slate-800 text-white shadow-xs font-semibold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {language === "hi" ? "पूर्ण (Completed)" : "Completed"}
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            filter === "all"
              ? "bg-slate-800 text-white shadow-xs font-semibold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {language === "hi" ? "सभी (All)" : "All"}
        </button>
      </div>

      {/* 4. Tasks List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading Google Tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
            <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              {hasGoogleToken ? "No tasks found in this view." : "Connect Google Tasks to view your tasks."}
            </p>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isDone = t.status === "completed";
            return (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                  <button
                    onClick={() => onToggleTask(t.id, t.status)}
                    className="text-slate-400 hover:text-emerald-400 transition shrink-0"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                  <div className="space-y-0.5 truncate">
                    <h4
                      className={`text-xs md:text-sm font-semibold truncate ${
                        isDone ? "line-through text-slate-500" : "text-slate-200"
                      }`}
                    >
                      {t.title}
                    </h4>
                    {t.notes && <p className="text-[11px] text-slate-400 line-clamp-1">{t.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {t.due && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(t.due).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    </div>
                  )}

                  <button
                    onClick={() => setTaskToDelete(t)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Delete Task Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-800/60 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Delete Task</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete <strong className="text-white">"{taskToDelete.title}"</strong> from Google Tasks?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
