import React, { useEffect, useMemo, useState } from "react";

// ---- Utilities ----
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const fmtDate = (d) => new Date(d).toLocaleDateString();
const uid = () => Math.random().toString(36).slice(2, 10);

const CATEGORIES = [
  "Listening",
  "Reading",
  "Vocab",
  "Grammar",
  "Writing",
  "Speaking",
  "Misc",
];

const DEFAULT_DAILY = [
  { label: "Listening 30m", category: "Listening" },
  { label: "Reading 2 artikel", category: "Reading" },
  { label: "Anki 100 kartu", category: "Vocab" },
  { label: "Grammar 1 pola", category: "Grammar" },
  { label: "Esai 5 kalimat", category: "Writing" },
  { label: "Shadowing 10 menit", category: "Speaking" },
];

// ---- Persistence (localStorage) ----
const load = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---- Types ----
// Task: { id, date, label, done, category }
// LogEntry: { id, date, title, type, mins, notes, tags: ["..." ] }

export default function App() {
  const [date, setDate] = useState(todayKey());
  const [tasksByDate, setTasksByDate] = useState(() => load("tasksByDate", {}));
  const [logs, setLogs] = useState(() => load("studyLogs", []));
  const [newTask, setNewTask] = useState({ label: "", category: "Misc" });
  const [newLog, setNewLog] = useState({
    title: "",
    type: "Reading",
    mins: 30,
    notes: "",
    tags: "",
  });

  // seed today once if empty
  useEffect(() => {
    if (!tasksByDate[todayKey()]) {
      const seeded = DEFAULT_DAILY.map((t) => ({
        id: uid(),
        date: todayKey(),
        label: t.label,
        category: t.category,
        done: false,
      }));
      const next = { ...tasksByDate, [todayKey()]: seeded };
      setTasksByDate(next);
      save("tasksByDate", next);
    }
  }, []); // eslint-disable-line

  // persist
  useEffect(() => save("tasksByDate", tasksByDate), [tasksByDate]);
  useEffect(() => save("studyLogs", logs), [logs]);

  const tasks = tasksByDate[date] || [];

  const toggleTask = (id) => {
    const list = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    const next = { ...tasksByDate, [date]: list };
    setTasksByDate(next);
  };

  const addTask = () => {
    if (!newTask.label.trim()) return;
    const list = [
      ...(tasksByDate[date] || []),
      { id: uid(), date, label: newTask.label.trim(), category: newTask.category, done: false },
    ];
    const next = { ...tasksByDate, [date]: list };
    setTasksByDate(next);
    setNewTask({ label: "", category: newTask.category });
  };

  const removeTask = (id) => {
    const list = (tasksByDate[date] || []).filter((t) => t.id !== id);
    const next = { ...tasksByDate, [date]: list };
    setTasksByDate(next);
  };

  const addLog = () => {
    if (!newLog.title.trim()) return;
    const entry = {
      id: uid(),
      date,
      title: newLog.title.trim(),
      type: newLog.type,
      mins: Number(newLog.mins) || 0,
      notes: newLog.notes.trim(),
      tags: newLog.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    setLogs([entry, ...logs]);
    setNewLog({ title: "", type: newLog.type, mins: 30, notes: "", tags: "" });
  };

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.date === date),
    [logs, date]
  );

  const completed = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  // streak: consecutive days with >= 1 task completed OR >= 20 mins logged
  const streak = useMemo(() => {
    let s = 0;
    let d = new Date();
    const hasActivity = (key) => {
      const tt = tasksByDate[key] || [];
      const didTasks = tt.some((t) => t.done);
      const didMins = logs
        .filter((l) => l.date === key)
        .reduce((a, b) => a + (b.mins || 0), 0) >= 20;
      return didTasks || didMins;
    };
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (hasActivity(key)) {
        s += 1;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return s;
  }, [tasksByDate, logs]);

  // weekly totals by category
  const weekAgg = useMemo(() => {
    const now = new Date(date);
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // Sunday start
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const inWeek = (key) => {
      const d = new Date(key);
      return d >= start && d < end;
    };
    const out = Object.fromEntries(CATEGORIES.map((c) => [c, { mins: 0, count: 0 }]));
    logs.forEach((l) => {
      if (inWeek(l.date)) {
        out[l.type] = out[l.type] || { mins: 0, count: 0 };
        out[l.type].mins += l.mins || 0;
        out[l.type].count += 1;
      }
    });
    return { start, end, out };
  }, [logs, date]);

  // export / import
  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ tasksByDate, logs }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topik-tracker-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.tasksByDate && data.logs) {
          setTasksByDate(data.tasksByDate);
          setLogs(data.logs);
        }
      } catch (e) {
        alert("File tidak valid");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto grid gap-6">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">TOPIK Study Tracker</h1>
            <p className="text-sm text-slate-600">
              Checklist harian + riwayat belajar. Data tersimpan di browser kamu.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              onClick={() => setDate(todayKey())}
              className="px-3 py-2 rounded-xl bg-slate-800 text-white"
            >
              Hari ini
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-2 rounded-xl bg-white border"
            >
              Export
            </button>
            <label className="px-3 py-2 rounded-xl bg-white border cursor-pointer">
              Import
              <input
                type="file"
                accept="application/json"
                onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm text-slate-500">Progress hari ini</div>
            <div className="text-2xl font-semibold mt-1">{progress}%</div>
            <div className="w-full h-2 bg-slate-200 rounded-full mt-3">
              <div
                className="h-2 bg-slate-800 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs mt-2">
              {completed}/{tasks.length} tugas selesai
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm text-slate-500">Streak</div>
            <div className="text-2xl font-semibold mt-1">{streak} hari</div>
            <div className="text-xs mt-2">Aktivitas beruntun (tugas selesai atau ≥20 menit).</div>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm text-slate-500">Akumulasi minggu ini</div>
            <div className="text-xs mt-1">
              {fmtDate(weekAgg.start)} → {fmtDate(weekAgg.end)}
            </div>
            <ul className="text-sm mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {CATEGORIES.map((c) => (
                <li key={c} className="flex justify-between">
                  <span>{c}</span>
                  <span className="tabular-nums">{weekAgg.out[c]?.mins || 0} m</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Checklist */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Checklist {fmtDate(date)}</h2>
            <button
              onClick={() => {
                const seeded = DEFAULT_DAILY.map((t) => ({
                  id: uid(),
                  date,
                  label: t.label,
                  category: t.category,
                  done: false,
                }));
                setTasksByDate({ ...tasksByDate, [date]: seeded });
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 border"
            >
              Reset ke default
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {tasks.length === 0 && (
              <div className="text-sm text-slate-500">Belum ada tugas — tambah di bawah.</div>
            )}
            {tasks.map((t) => (
              <label key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border ${t.done ? "bg-green-50 border-green-200" : "bg-white"}`}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                  className="mt-1 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-slate-500">{t.category}</div>
                </div>
                <button onClick={() => removeTask(t.id)} className="text-xs text-slate-500 hover:underline">hapus</button>
              </label>
            ))}
          </div>
          <div className="mt-4 grid sm:grid-cols-[1fr_160px_120px] gap-2">
            <input
              placeholder="Tambah tugas (mis. 20 kata baru)"
              value={newTask.label}
              onChange={(e) => setNewTask((s) => ({ ...s, label: e.target.value }))}
              className="border rounded-xl px-3 py-2"
            />
            <select
              className="border rounded-xl px-3 py-2"
              value={newTask.category}
              onChange={(e) => setNewTask((s) => ({ ...s, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button onClick={addTask} className="px-3 py-2 rounded-xl bg-slate-800 text-white">Tambah</button>
          </div>
        </section>

        {/* Study Log */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold">Riwayat Belajar ({fmtDate(date)})</h2>
          <div className="mt-3 grid sm:grid-cols-[2fr_160px_120px] gap-2">
            <input
              placeholder="Judul / materi (mis. Yonhap: ekonomi)"
              value={newLog.title}
              onChange={(e) => setNewLog((s) => ({ ...s, title: e.target.value }))}
              className="border rounded-xl px-3 py-2"
            />
            <select
              className="border rounded-xl px-3 py-2"
              value={newLog.type}
              onChange={(e) => setNewLog((s) => ({ ...s, type: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              className="border rounded-xl px-3 py-2"
              value={newLog.mins}
              onChange={(e) => setNewLog((s) => ({ ...s, mins: e.target.value }))}
              placeholder="menit"
            />
            <textarea
              placeholder="Catatan singkat / poin grammar / kosakata baru"
              value={newLog.notes}
              onChange={(e) => setNewLog((s) => ({ ...s, notes: e.target.value }))}
              className="border rounded-xl px-3 py-2 sm:col-span-3"
            />
            <input
              placeholder="Tag (pisah dengan koma, mis. Naver, TTMIK)"
              value={newLog.tags}
              onChange={(e) => setNewLog((s) => ({ ...s, tags: e.target.value }))}
              className="border rounded-xl px-3 py-2 sm:col-span-2"
            />
            <button onClick={addLog} className="px-3 py-2 rounded-xl bg-slate-800 text-white">Catat</button>
          </div>

          <div className="mt-4 grid gap-2">
            {filteredLogs.length === 0 && (
              <div className="text-sm text-slate-500">Belum ada catatan hari ini.</div>
            )}
            {filteredLogs.map((l) => (
              <div key={l.id} className="p-3 border rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{l.title}</div>
                  <div className="text-xs text-slate-500">{l.type} • {l.mins} menit</div>
                </div>
                {l.tags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.tags.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {l.notes && <p className="text-sm mt-2 whitespace-pre-wrap">{l.notes}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Insights */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold">Insight & Target</h2>
          <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
            <li>Target mingguan: minimal 300 menit total belajar, dengan 5 hari aktif.</li>
            <li>Distribusi seimbang: Listening/Reading/Vocab/Grammar/Writing/Speaking.</li>
            <li>Gunakan tag untuk menandai sumber (TTMIK, Yonhap, Naver, KBS).</li>
            <li>Setiap Minggu malam: review kosakata & tulis ringkasan kemajuan.</li>
          </ul>
        </section>

        <footer className="text-xs text-slate-500 text-center pb-6">
          Buat oleh kamu. Simpan sebagai PWA atau deploy ke GitHub Pages untuk akses lintas perangkat.
        </footer>
      </div>
    </div>
  );
}
