import React, { useState, useEffect } from "react";
import { StudySubject, Language } from "../types.ts";
import {
  GraduationCap,
  Plus,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  X,
} from "lucide-react";

interface StudyCenterViewProps {
  language: Language;
  onGenerateStudyQuiz: (subjectName: string) => void;
}

export const StudyCenterView: React.FC<StudyCenterViewProps> = ({
  language,
  onGenerateStudyQuiz,
}) => {
  // Default subjects
  const [subjects, setSubjects] = useState<StudySubject[]>([
    {
      id: "subj-1",
      name: "Physics (Mechanics & Waves)",
      color: "#6366f1",
      completedChapters: 6,
      totalChapters: 12,
      dailyGoalMinutes: 60,
      studiedMinutesToday: 45,
      nextRevisionDate: "Tomorrow",
    },
    {
      id: "subj-2",
      name: "Organic & Physical Chemistry",
      color: "#a855f7",
      completedChapters: 8,
      totalChapters: 14,
      dailyGoalMinutes: 60,
      studiedMinutesToday: 30,
      nextRevisionDate: "Thursday",
    },
    {
      id: "subj-3",
      name: "Mathematics (Calculus & Vectors)",
      color: "#38bdf8",
      completedChapters: 10,
      totalChapters: 15,
      dailyGoalMinutes: 90,
      studiedMinutesToday: 60,
      nextRevisionDate: "Friday",
    },
    {
      id: "subj-4",
      name: "Computer Science & Algorithms",
      color: "#10b981",
      completedChapters: 5,
      totalChapters: 8,
      dailyGoalMinutes: 45,
      studiedMinutesToday: 45,
      nextRevisionDate: "Today",
    },
  ]);

  // Pomodoro Focus Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");

  // New Subject Modal
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjName, setNewSubjName] = useState("");
  const [newSubjChapters, setNewSubjChapters] = useState(10);
  const [newSubjGoalMin, setNewSubjGoalMin] = useState(60);

  // Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
      if (timerMode === "focus") {
        alert("Focus session complete! Take a 5-minute restorative break.");
        setTimerMode("break");
        setTimerSeconds(5 * 60);
      } else {
        alert("Break ended! Ready for the next focus session?");
        setTimerMode("focus");
        setTimerSeconds(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, timerMode]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;

    const newSubj: StudySubject = {
      id: `subj-${Date.now()}`,
      name: newSubjName,
      color: "#818cf8",
      completedChapters: 0,
      totalChapters: newSubjChapters,
      dailyGoalMinutes: newSubjGoalMin,
      studiedMinutesToday: 0,
      nextRevisionDate: "Tomorrow",
    };

    setSubjects((prev) => [...prev, newSubj]);
    setNewSubjName("");
    setShowAddSubject(false);
  };

  const handleIncrementChapter = (id: string) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id && s.completedChapters < s.totalChapters ? { ...s, completedChapters: s.completedChapters + 1 } : s))
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "एआई स्टडी सेंटर" : "AI Study Center & Revision Intelligence"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "विषय प्रबंधन, अध्ययन लक्ष्य, पोमोडोरो टाइमर और एआई प्रैक्टिस प्रश्न"
                : "Curriculum tracking, target study hours, Pomodoro focus, and AI test generation"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddSubject(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>{language === "hi" ? "विषय जोड़ें" : "Add Subject"}</span>
        </button>
      </div>

      {/* 2. Pomodoro Focus Timer & Streak Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pomodoro Timer Card */}
        <div className="md:col-span-2 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-400 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>{timerMode === "focus" ? "Deep Focus Session" : "Restorative Break"}</span>
            </div>
            <div className="font-mono text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              {formatTimer(timerSeconds)}
            </div>
            <p className="text-xs text-slate-400">
              {timerMode === "focus"
                ? "Eliminate distractions. JIYA tracks your uninterrupted deep study."
                : "Relax your eyes, hydrate, and stretch before the next focus block."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-900/30 transition"
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isTimerRunning ? "Pause" : "Start Focus"}</span>
            </button>

            <button
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(timerMode === "focus" ? 25 * 60 : 5 * 60);
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Study Streak & Target */}
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Weekly Discipline
            </span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-white font-['Outfit']">7 Day Streak</div>
            <p className="text-xs text-emerald-400 font-medium">180 mins studied today</p>
          </div>
          <p className="text-[11px] text-slate-500">
            Consecutive study streak triggers automated life report rewards.
          </p>
        </div>
      </div>

      {/* 3. Subjects & Syllabus Progress Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {language === "hi" ? "सक्रिय विषय व पाठ्यक्रम प्रगति" : "Active Subjects & Curriculum Progress"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map((subj) => {
            const percent = Math.round((subj.completedChapters / subj.totalChapters) * 100);
            return (
              <div
                key={subj.id}
                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: `${subj.color}25`, color: subj.color }}
                    >
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{subj.name}</h3>
                      <span className="text-[11px] text-slate-400">
                        {subj.completedChapters} of {subj.totalChapters} chapters completed
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-300">{percent}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percent}%`, backgroundColor: subj.color }}
                  />
                </div>

                {/* Bottom Action Row */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <button
                    onClick={() => handleIncrementChapter(subj.id)}
                    className="text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mark Chapter Done</span>
                  </button>

                  <button
                    onClick={() => onGenerateStudyQuiz(subj.name)}
                    className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Practice Quiz</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Add Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Add New Study Subject</h3>
              <button
                onClick={() => setShowAddSubject(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Subject Name *</label>
                <input
                  type="text"
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  placeholder="e.g. Modern Physics & Optics"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Total Chapters</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newSubjChapters}
                    onChange={(e) => setNewSubjChapters(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Daily Goal (Mins)</label>
                  <input
                    type="number"
                    min={10}
                    max={360}
                    value={newSubjGoalMin}
                    onChange={(e) => setNewSubjGoalMin(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md transition"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
