import React, { useMemo, useState } from "react";

const initialUsers = [
  { id: 1, name: "Sam", email: "sam@example.com", team: "Workshop", role: "employee", basePoints: 1480 },
  { id: 2, name: "Jess", email: "jess@example.com", team: "Warehouse", role: "employee", basePoints: 1395 },
  { id: 3, name: "Mike", email: "mike@example.com", team: "Installers", role: "employee", basePoints: 1260 },
  { id: 4, name: "Aroha", email: "aroha@example.com", team: "Office", role: "employee", basePoints: 1195 },
  { id: 99, name: "Richie", email: "richie@manualhandling.nz", team: "Admin", role: "admin", basePoints: 0 },
];

const pointValues = { nutrition: 10, water: 10, sleep: 10, steps: 10, workout: 20 };
const defaultLogs = { nutrition: false, water: false, sleep: false, steps: false, workout: false };

const habits = [
  { key: "nutrition", label: "Nutrition", icon: "🥗", target: "Plan meals / protein / whole foods" },
  { key: "water", label: "Hydration", icon: "💧", target: "2L+ water" },
  { key: "sleep", label: "Sleep", icon: "🌙", target: "7+ hours" },
  { key: "steps", label: "Steps", icon: "👟", target: "8,000+ steps" },
  { key: "workout", label: "Workout", icon: "🏋️", target: "Complete workout" },
];

const workouts = [
  { title: "10 min mobility reset", type: "Mobility", duration: "10 min", points: 15 },
  { title: "Team walk", type: "Cardio", duration: "25 min", points: 25 },
  { title: "Beginner HIIT", type: "Workout", duration: "18 min", points: 30 },
  { title: "Stretch and reset", type: "Recovery", duration: "12 min", points: 15 },
];

const weekPlan = [
  "Kickoff and habits", "Team walk / run", "Nutrition deep-dive", "Team HIIT", "Mid-point scan",
  "Walk / run group", "Mindset and sleep", "Team HIIT", "Final push", "Final scan and prizegiving",
];

function getToday() { return new Date().toISOString().slice(0, 10); }

function getStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function csvDownload(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => '"' + String(cell ?? "").replace(/"/g, '""') + '"').join(","))
    .join(String.fromCharCode(10));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function App() {
  const today = getToday();
  const [users, setUsers] = useState(() => getStored("mh_users", initialUsers));
  const [currentUser, setCurrentUser] = useState(() => getStored("mh_current_user", null));
  const [allLogs, setAllLogs] = useState(() => getStored("mh_logs", {}));
  const [submittedDays, setSubmittedDays] = useState(() => getStored("mh_submitted", {}));
  const [tab, setTab] = useState("today");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", team: "Workshop", code: "MATT2026" });
  const [settings, setSettings] = useState(() => getStored("mh_settings", {
    company: "Workplace Challenge Demo",
    title: "Biggest Loser With a Twist",
    joinCode: "MATT2026",
    startDate: "11 May 2026",
    endDate: "19 July 2026",
    status: "live",
  }));
  const [announcement, setAnnouncement] = useState(() => getStored("mh_announcement", {
    title: "Welcome to week 1",
    body: "Start simple: water, steps, sleep and one nutrition habit.",
  }));

  const isAdmin = currentUser?.role === "admin";
  const userLogKey = currentUser ? `${currentUser.id}_${today}` : "";
  const todayLogs = allLogs[userLogKey] || defaultLogs;
  const daySubmitted = submittedDays[userLogKey] || false;
  const challengeLive = settings.status === "live";

  const todayPoints = useMemo(() => {
    return Object.entries(todayLogs).reduce((total, [key, value]) => total + (value ? pointValues[key] : 0), 0);
  }, [todayLogs]);

  const completedHabits = Object.values(todayLogs).filter(Boolean).length;

  const leaderboard = useMemo(() => {
    return users
      .filter((user) => user.role !== "admin")
      .map((user) => {
        const key = `${user.id}_${today}`;
        const log = allLogs[key] || defaultLogs;
        const extra = Object.entries(log).reduce((total, [habit, done]) => total + (done ? pointValues[habit] : 0), 0);
        return { ...user, points: (user.basePoints || 0) + extra, todayPoints: extra, submitted: Boolean(submittedDays[key]) };
      })
      .sort((a, b) => b.points - a.points);
  }, [users, allLogs, submittedDays, today]);

  const teamLeaderboard = useMemo(() => {
    const teams = {};
    leaderboard.forEach((user) => {
      if (!teams[user.team]) teams[user.team] = { team: user.team, total: 0, count: 0 };
      teams[user.team].total += user.points;
      teams[user.team].count += 1;
    });
    return Object.values(teams)
      .map((team) => ({ ...team, average: Math.round(team.total / team.count) }))
      .sort((a, b) => b.average - a.average);
  }, [leaderboard]);

  function saveUsers(nextUsers) { setUsers(nextUsers); setStored("mh_users", nextUsers); }
  function saveLogs(nextLogs) { setAllLogs(nextLogs); setStored("mh_logs", nextLogs); }
  function saveSubmitted(nextSubmitted) { setSubmittedDays(nextSubmitted); setStored("mh_submitted", nextSubmitted); }

  function login(event) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const found = users.find((user) => user.email.toLowerCase() === email);
    if (!found) {
      alert("No account found. Use Sign up first, or demo login sam@example.com / richie@manualhandling.nz");
      return;
    }
    setCurrentUser(found);
    setStored("mh_current_user", found);
  }

  function signup(event) {
    event.preventDefault();
    if (form.code.trim().toUpperCase() !== settings.joinCode) {
      alert("Incorrect join code. Demo code is " + settings.joinCode);
      return;
    }
    const email = form.email.trim().toLowerCase();
    const existing = users.find((user) => user.email.toLowerCase() === email);
    if (existing) {
      setCurrentUser(existing);
      setStored("mh_current_user", existing);
      return;
    }
    const newUser = {
      id: Date.now(),
      name: form.name.trim() || email.split("@")[0],
      email,
      team: form.team,
      role: "employee",
      basePoints: 0,
    };
    const nextUsers = [...users, newUser];
    saveUsers(nextUsers);
    setCurrentUser(newUser);
    setStored("mh_current_user", newUser);
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem("mh_current_user");
  }

  function toggleHabit(key) {
    if (!challengeLive || daySubmitted) return;
    const next = { ...allLogs, [userLogKey]: { ...todayLogs, [key]: !todayLogs[key] } };
    saveLogs(next);
  }

  function submitDay() {
    if (!challengeLive || daySubmitted) return;
    saveSubmitted({ ...submittedDays, [userLogKey]: true });
  }

  function exportLeaderboard() {
    csvDownload("leaderboard.csv", [
      ["Rank", "Name", "Email", "Team", "Total points", "Today", "Submitted"],
      ...leaderboard.map((user, index) => [index + 1, user.name, user.email, user.team, user.points, user.todayPoints, user.submitted ? "Yes" : "No"]),
    ]);
  }

  function exportLogs() {
    const rows = [["Date", "Name", "Email", "Team", "Nutrition", "Water", "Sleep", "Steps", "Workout", "Submitted"]];
    Object.entries(allLogs).forEach(([key, log]) => {
      const [userId, date] = key.split("_");
      const user = users.find((item) => String(item.id) === String(userId));
      if (!user) return;
      rows.push([date, user.name, user.email, user.team, log.nutrition ? "Yes" : "No", log.water ? "Yes" : "No", log.sleep ? "Yes" : "No", log.steps ? "Yes" : "No", log.workout ? "Yes" : "No", submittedDays[key] ? "Yes" : "No"]);
    });
    csvDownload("daily-logs.csv", rows);
  }

  function saveSettings(event) {
    event.preventDefault();
    setStored("mh_settings", settings);
    alert("Settings saved");
  }

  function saveAnnouncement(event) {
    event.preventDefault();
    setStored("mh_announcement", announcement);
    alert("Announcement saved");
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 p-5 text-slate-900">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl md:grid-cols-2">
          <div className="bg-slate-950 p-8 text-white md:p-12">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">Manual Handling NZ</div>
            <h1 className="text-5xl font-black leading-none md:text-7xl">{settings.title}</h1>
            <p className="mt-5 max-w-md text-lg text-slate-300">Online workplace wellbeing challenge for logging habits, scoring points, team competition and employer reporting.</p>
            <div className="mt-8 grid gap-3 text-sm font-bold text-slate-200">
              <div className="rounded-2xl bg-white/10 p-4">Company: {settings.company}</div>
              <div className="rounded-2xl bg-white/10 p-4">Starts: {settings.startDate}</div>
              <div className="rounded-2xl bg-white/10 p-4">Join code: {settings.joinCode}</div>
            </div>
          </div>
          <div className="p-8 md:p-12">
            <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-2">
              <button onClick={() => setAuthMode("login")} className={`rounded-xl py-3 font-black ${authMode === "login" ? "bg-white shadow" : "text-slate-500"}`}>Login</button>
              <button onClick={() => setAuthMode("signup")} className={`rounded-xl py-3 font-black ${authMode === "signup" ? "bg-white shadow" : "text-slate-500"}`}>Sign up</button>
            </div>
            <form onSubmit={authMode === "login" ? login : signup} className="space-y-4">
              {authMode === "signup" && (
                <input className="w-full rounded-2xl border p-4 font-semibold" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              )}
              <input className="w-full rounded-2xl border p-4 font-semibold" type="email" required placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              {authMode === "signup" && (
                <>
                  <select className="w-full rounded-2xl border p-4 font-semibold" value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })}>
                    <option>Workshop</option>
                    <option>Warehouse</option>
                    <option>Installers</option>
                    <option>Office</option>
                  </select>
                  <input className="w-full rounded-2xl border p-4 font-semibold" placeholder="Join code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
                </>
              )}
              <button className="w-full rounded-2xl bg-emerald-500 p-4 text-lg font-black text-white">{authMode === "login" ? "Login" : "Join challenge"}</button>
            </form>
            <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-600">Demo employee: sam@example.com<br />Demo admin: richie@manualhandling.nz</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900">
      <div className="mx-auto max-w-6xl bg-slate-100 pb-20 shadow-2xl md:min-h-screen">
        <header className="rounded-b-[2rem] bg-slate-950 p-6 text-white md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">Manual Handling NZ Challenge Platform</div>
              <h1 className="text-4xl font-black leading-none md:text-6xl">{settings.title}</h1>
              <p className="mt-4 max-w-2xl text-slate-300">Welcome, {currentUser.name}. {challengeLive ? "Log healthy habits and help your team climb the leaderboard." : "This challenge is currently read-only."}</p>
            </div>
            <button onClick={logout} className="rounded-2xl bg-white/10 px-4 py-3 font-black">Logout</button>
          </div>
        </header>

        <nav className="sticky top-0 z-10 mx-auto -mt-5 flex max-w-3xl justify-center px-4">
          <div className="grid w-full grid-cols-4 rounded-2xl bg-white p-2 shadow-lg md:grid-cols-5">
            {["today", "leaderboard", "workouts", "admin", "settings"].filter((item) => isAdmin || !["admin", "settings"].includes(item)).map((item) => (
              <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-2 py-3 text-sm font-black capitalize ${tab === item ? "bg-emerald-500 text-white" : "text-slate-500"}`}>{item}</button>
            ))}
          </div>
        </nav>

        <main className="p-5 pt-8 md:p-10">
          {tab === "today" && (
            <section>
              <div className="mb-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Today</div><div className="text-3xl font-black text-emerald-600">{todayPoints} pts</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Habits</div><div className="text-3xl font-black">{completedHabits}/5</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Status</div><div className="text-2xl font-black">{daySubmitted ? "Submitted" : "Open"}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Team</div><div className="text-2xl font-black">{currentUser.team}</div></div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {habits.map((habit) => (
                  <button key={habit.key} onClick={() => toggleHabit(habit.key)} className={`rounded-3xl border p-4 text-left shadow-sm ${todayLogs[habit.key] ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                    <div className="text-3xl">{habit.icon}</div>
                    <div className="mt-3 text-lg font-black">{habit.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{habit.target}</div>
                    <div className="mt-3 font-black text-emerald-600">+{pointValues[habit.key]} pts</div>
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">Submit your day</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Once submitted, today's log is locked.</p>
                  <button onClick={submitDay} disabled={daySubmitted || !challengeLive} className={`mt-4 w-full rounded-2xl p-4 font-black text-white ${daySubmitted ? "bg-slate-400" : "bg-emerald-500"}`}>{daySubmitted ? "Submitted" : "Submit Day"}</button>
                </div>
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">Latest message</h3>
                  <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                    <div className="font-black">{announcement.title}</div>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{announcement.body}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "leaderboard" && (
            <section>
              <h2 className="mb-4 text-3xl font-black">Leaderboard</h2>
              <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-xl font-black">Team leaderboard</h3>
                <div className="grid gap-3 md:grid-cols-4">
                  {teamLeaderboard.map((team, index) => (
                    <div key={team.team} className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm font-black uppercase text-slate-400">#{index + 1}</div>
                      <div className="text-xl font-black">{team.team}</div>
                      <div className="text-2xl font-black text-emerald-600">{team.average}</div>
                      <div className="text-xs font-bold text-slate-400">avg points</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                {leaderboard.map((user, index) => (
                  <div key={user.id} className="flex items-center gap-4 border-b p-4 last:border-b-0">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 font-black">{index + 1}</div>
                    <div className="flex-1"><div className="font-black">{user.name}</div><div className="text-sm font-semibold text-slate-500">{user.team} · today +{user.todayPoints} · {user.submitted ? "submitted" : "not submitted"}</div></div>
                    <div className="text-right"><div className="text-2xl font-black text-emerald-600">{user.points}</div><div className="text-xs font-bold text-slate-400">points</div></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "workouts" && (
            <section>
              <h2 className="mb-4 text-3xl font-black">Simple workouts</h2>
              <div className="grid gap-4 md:grid-cols-4">
                {workouts.map((workout) => (
                  <div key={workout.title} className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="text-3xl">🏋️</div>
                    <h3 className="mt-3 text-xl font-black">{workout.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{workout.type} · {workout.duration}</p>
                    <div className="mt-5 rounded-2xl bg-slate-100 p-4 font-black">+{workout.points} points</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "admin" && isAdmin && (
            <section>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-3xl font-black">Admin dashboard</h2><p className="text-slate-500">Export results and manage the pilot challenge.</p></div>
                <div className="flex gap-2"><button onClick={exportLeaderboard} className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Export leaderboard</button><button onClick={exportLogs} className="rounded-2xl bg-slate-900 px-4 py-3 font-black text-white">Export logs</button></div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Participants</div><div className="text-3xl font-black">{users.filter((u) => u.role !== "admin").length}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Logs</div><div className="text-3xl font-black">{Object.keys(allLogs).length}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Top logger</div><div className="text-3xl font-black">{leaderboard[0]?.name || "—"}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Join code</div><div className="text-3xl font-black">{settings.joinCode}</div></div>
              </div>
              <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm"><h3 className="mb-4 text-xl font-black">10-week plan</h3><div className="grid gap-3 md:grid-cols-2">{weekPlan.map((item, index) => (<div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">{index + 1}</div><div className="font-bold">{item}</div></div>))}</div></div>
            </section>
          )}

          {tab === "settings" && isAdmin && (
            <section>
              <h2 className="mb-4 text-3xl font-black">Settings</h2>
              <div className="grid gap-6 md:grid-cols-2">
                <form onSubmit={saveSettings} className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-xl font-black">Challenge settings</h3>
                  <div className="grid gap-3">
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.company} onChange={(event) => setSettings({ ...settings, company: event.target.value })} placeholder="Company" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} placeholder="Title" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.joinCode} onChange={(event) => setSettings({ ...settings, joinCode: event.target.value.toUpperCase() })} placeholder="Join code" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.startDate} onChange={(event) => setSettings({ ...settings, startDate: event.target.value })} placeholder="Start date" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.endDate} onChange={(event) => setSettings({ ...settings, endDate: event.target.value })} placeholder="End date" />
                    <select className="rounded-2xl border p-3 font-semibold" value={settings.status} onChange={(event) => setSettings({ ...settings, status: event.target.value })}><option value="pre">Pre-start</option><option value="live">Live</option><option value="complete">Complete</option></select>
                    <button className="rounded-2xl bg-emerald-500 p-4 font-black text-white">Save settings</button>
                  </div>
                </form>
                <form onSubmit={saveAnnouncement} className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-xl font-black">Announcement</h3>
                  <div className="grid gap-3">
                    <input className="rounded-2xl border p-3 font-semibold" value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} placeholder="Title" />
                    <textarea className="min-h-[140px] rounded-2xl border p-3 font-semibold" value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} placeholder="Message" />
                    <button className="rounded-2xl bg-slate-900 p-4 font-black text-white">Save announcement</button>
                  </div>
                </form>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

