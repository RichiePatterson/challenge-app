import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "./supabase";

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
  const [users, setUsers] = useState([]);
  const [pointsData, setPointsData] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [todayLogs, setTodayLogs] = useState(defaultLogs);
  const [tab, setTab] = useState("today");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", team: "Workshop", code: "" });
  const [settings, setSettings] = useState(() => getStored("mh_settings", {
    company: "Workplace Challenge Demo",
    title: "Biggest Loser With a Twist",
    joinCode: "",
    startDate: "11 May 2026",
    endDate: "19 July 2026",
    status: "live",
    is_active: true,
  }));
  const [announcement, setAnnouncement] = useState(() => getStored("mh_announcement", {
    title: "Welcome to week 1",
    body: "Start simple: water, steps, sleep and one nutrition habit.",
  }));
  const [statusMessage, setStatusMessage] = useState("");
  const [statusMessageType, setStatusMessageType] = useState("success");
  const [authError, setAuthError] = useState("");
  const [passwordResetStage, setPasswordResetStage] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupTeams, setSignupTeams] = useState(["Workshop", "Warehouse", "Installers", "Office"]);
  const [activities, setActivities] = useState([]);

  function clearPasswordResetState() {
    setPasswordResetStage(null);
    setResetEmail("");
    setResetMessage("");
    setResetError("");
    setNewPassword("");
    setConfirmPassword("");
  }
  const [activityEdits, setActivityEdits] = useState([]);
  const [challengeSettings, setChallengeSettings] = useState({});
  const [company, setCompany] = useState(null);
  const [teamFilter, setTeamFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [adminBuilderMessage, setAdminBuilderMessage] = useState("");
  const [adminBuilderMessageType, setAdminBuilderMessageType] = useState("success");

  function parseChallengeDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  }

  function formatDaysBetween(from, to) {
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function getDateKey(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  function buildStreakMetrics(dateKeys, todayKey) {
    const dates = Array.from(new Set(dateKeys.filter(Boolean))).sort();
    const dateSet = new Set(dates);
    let current = 0;
    let cursor = new Date(todayKey);
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    let longest = 0;
    dates.forEach((date) => {
      const currentDate = new Date(date);
      const previous = new Date(currentDate);
      previous.setDate(previous.getDate() - 1);
      const previousKey = previous.toISOString().slice(0, 10);
      if (!dateSet.has(previousKey)) {
        let streak = 1;
        const next = new Date(currentDate);
        while (true) {
          next.setDate(next.getDate() + 1);
          if (dateSet.has(next.toISOString().slice(0, 10))) {
            streak += 1;
          } else {
            break;
          }
        }
        longest = Math.max(longest, streak);
      }
    });
    return {
      currentStreak: current,
      longestStreak: longest,
      totalDays: dates.length,
    };
  }

  async function loadCurrentUserByEmail(email) {
    const { data: userData, error } = await supabase
      .from("Users")
      .select("*")
      .eq("email", email)
      .single();
    console.log("user loaded", email, userData, error);
    if (error) return null;
    setCurrentUser(userData);
    return userData;
  }

  async function authRequestWithTimeout(requestPromise, timeoutMs = 8000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Auth request timed out")), timeoutMs);
    });
    try {
      return await Promise.race([requestPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function loadActivities(companyId) {
    if (!companyId) {
      setActivities([]);
      setActivityEdits([]);
      return [];
    }

    const { data, error } = await supabase
      .from("challenge_activities")
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("challenge activities load error", error);
      setActivities([]);
      setActivityEdits([]);
      return [];
    }

    setActivities(data || []);
    setActivityEdits(data || []);
    return data || [];
  }

  async function loadCompanyData(companyId) {
    if (!companyId) return null;
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();
    if (error) {
      console.error("company load error", error);
      return null;
    }
    setCompany(data);
    return data;
  }

  async function loadChallengeSettings() {
    if (!currentUser?.company_id) {
      console.warn("Cannot load challenge settings: no company_id");
      return null;
    }

    const { data, error } = await supabase
      .from("challenge_settings")
      .select("*")
      .eq("company_id", currentUser.company_id);
    if (error) {
      console.error("challenge settings load error", error);
      return null;
    }
    const settingsObj = {};
    const announcementObj = {};
    data.forEach((item) => {
      if (item.key === "is_active") {
        settingsObj[item.key] = item.value === true || String(item.value).toLowerCase() === "true";
      } else if (item.key === "team_colors") {
        try {
          settingsObj[item.key] = JSON.parse(item.value || "{}");
        } catch {
          settingsObj[item.key] = {};
        }
      } else if (item.key === "teams") {
        settingsObj[item.key] = item.value || "Workshop, Warehouse, Installers, Office";
      } else if (item.key === "announcement_title") {
        announcementObj.title = item.value || "";
      } else if (item.key === "announcement_body") {
        announcementObj.body = item.value || "";
      } else {
        settingsObj[item.key] = item.value;
      }
    });
    if (announcementObj.title || announcementObj.body) {
      setAnnouncement((prev) => ({ ...prev, ...announcementObj }));
    }
    setChallengeSettings(settingsObj);
    setSettings((prev) => ({ ...prev, ...settingsObj }));
    return settingsObj;
  }

  function getActivityKey(activity) {
    return activity.activity_key || activity.activity_type || activity.key || String(activity.id);
  }

  function getActivityLabel(activityType) {
    const activity = activities.find((item) => getActivityKey(item) === activityType);
    if (activity) return activity.activity_name || activity.label || activity.description || activityType;
    const habit = habits.find((item) => item.key === activityType);
    return habit?.label || activityType;
  }

  useEffect(() => {
    async function loadData() {
      // Detect Supabase password recovery return flow
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const type = searchParams.get("type") || hashParams.get("type");
      const accessToken = searchParams.get("access_token") || hashParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token") || hashParams.get("refresh_token");
      const code = searchParams.get("code") || hashParams.get("code");
      const recovery = type === "recovery" || accessToken || refreshToken || code;

      if (recovery) {
        console.log("password recovery detected", { type, accessToken, refreshToken, code });
        try {
          if (typeof supabase.auth.exchangeCodeForSession === "function") {
            await supabase.auth.exchangeCodeForSession(window.location.href);
          }
        } catch (exchangeError) {
          console.warn("password recovery exchange failed", exchangeError);
        }

        const { data: { session: recoverySession } } = await supabase.auth.getSession();
        console.log("password recovery session", recoverySession);
        if (recoverySession?.user) {
          setPasswordResetStage("confirm");
          setResetEmail(recoverySession.user.email || resetEmail);
        } else {
          clearPasswordResetState();
          setAuthMode("login");
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Check auth session
      const { data: { session } } = await supabase.auth.getSession();
      console.log("auth session restored", session);
      if (session?.user) {
        const user = await loadCurrentUserByEmail(session.user.email);
        if (user?.company_id) {
          await loadCompanyData(user.company_id);
          await loadActivities(user.company_id);
        }
      }

      await loadChallengeSettings();

      // Load users with points
      const { data: usersData, error: usersError } = await supabase
        .from("Users")
        .select("*");

      if (usersError) {
        console.error(usersError);
        return;
      }

      // Load points_log and calculate totals
      const { data: pointsData, error: pointsError } = await supabase
        .from("points_log")
        .select("user_id, points, created_at, log_date, activity_type, activity_name");

      if (pointsError) {
        console.error(pointsError);
        setUsers(usersData.map(u => ({ ...u, points: 0 })));
        setPointsData([]);
        return;
      }

      setPointsData(pointsData);

      const pointsMap = {};
      pointsData.forEach(p => {
        pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + p.points;
      });

      const usersWithPoints = usersData.map(u => ({
        ...u,
        points: pointsMap[u.id] || 0
      })).sort((a, b) => b.points - a.points);

      setUsers(usersWithPoints);
    }

    loadData();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("auth state changed", event, session);
      if (session?.user) {
        const user = await loadCurrentUserByEmail(session.user.email);
        if (user?.company_id) {
          await loadCompanyData(user.company_id);
          await loadActivities(user.company_id);
        }
      } else {
        setCurrentUser(null);
        setCompany(null);
        setActivities([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const activityDefaults = useMemo(() => {
    if (!activities.length) return defaultLogs;
    const defaults = {};
    activities.forEach((activity) => {
      const key = activity.activity_key || activity.activity_type || activity.key || String(activity.id);
      defaults[key] = false;
    });
    return defaults;
  }, [activities]);

  const activityPoints = useMemo(() => {
    if (!activities.length) return pointValues;
    const pointsMap = {};
    activities.forEach((activity) => {
      const key = activity.activity_key || activity.activity_type || activity.key || String(activity.id);
      pointsMap[key] = activity.points || 10;
    });
    return pointsMap;
  }, [activities]);

  const habitActivities = useMemo(() => {
    if (activities.length) {
      return activities.filter((activity) => !activity.activity_type || activity.activity_type === "habit" || activity.activity_type === "daily");
    }
    return habits.map((habit, index) => ({
      id: `fallback-${index}`,
      activity_key: habit.key,
      activity_type: "habit",
      activity_name: habit.key,
      description: habit.target,
      points: pointValues[habit.key] || 10,
      is_active: true,
      sort_order: index,
    }));
  }, [activities]);

  const workoutActivities = useMemo(() => {
    if (activities.length) {
      return activities.filter((activity) => activity.activity_type === "workout");
    }
    return workouts.map((workout, index) => ({
      id: `fallback-w-${index}`,
      activity_key: `workout-${index}`,
      activity_type: "workout",
      activity_name: `workout-${index}`,
      description: `${workout.type} · ${workout.duration}`,
      points: workout.points,
      is_active: true,
      sort_order: index,
    }));
  }, [activities]);

  useEffect(() => {
    if (!currentUser) {
      setTodayLogs(activityDefaults);
      return;
    }

    if (pointsData.length > 0) {
      const userTodayPoints = pointsData.filter((p) => p.user_id === currentUser.id && p.log_date === today);
      const logs = { ...activityDefaults };
      userTodayPoints.forEach((p) => {
        if (Object.prototype.hasOwnProperty.call(logs, p.activity_name)) {
          logs[p.activity_name] = true;
        }
      });
      setTodayLogs(logs);
    }
  }, [currentUser, pointsData, today, activityDefaults]);

  const runtimeSettings = { ...settings, ...(challengeSettings || {}) };
  const isAdmin = currentUser?.role === "admin";
  const startDateObj = parseChallengeDate(runtimeSettings.startDate);
  const endDateObj = parseChallengeDate(runtimeSettings.endDate);
  const todayDate = new Date(today);
  todayDate.setHours(0, 0, 0, 0);
  const challengeActive = runtimeSettings.is_active !== false;
  const beforeChallenge = Boolean(startDateObj && todayDate < startDateObj);
  const afterChallenge = Boolean(endDateObj && todayDate > endDateObj);
  const challengeLive = challengeActive && !afterChallenge;
  const challengeStatusMessage = beforeChallenge
    ? `Challenge begins in ${formatDaysBetween(todayDate, startDateObj)} day${formatDaysBetween(todayDate, startDateObj) === 1 ? "" : "s"}`
    : afterChallenge
      ? "Challenge completed"
      : !challengeActive
        ? "Challenge is currently paused"
        : "";

  const alreadySubmittedToday = useMemo(() => {
    if (!currentUser) return false;
    return pointsData.some((p) => p.user_id === currentUser.id && p.log_date === today);
  }, [pointsData, currentUser, today]);

  const activityEditLocked = !challengeLive || alreadySubmittedToday;

  const todayPoints = useMemo(() => {
    if (!currentUser) return 0;
    return pointsData.filter(p => p.user_id === currentUser.id && p.log_date === today).reduce((sum, p) => sum + p.points, 0);
  }, [pointsData, currentUser, today]);

  const currentUserDates = useMemo(() => {
    if (!currentUser) return [];
    const dates = Array.from(new Set(
      pointsData
        .filter((p) => p.user_id === currentUser.id)
        .map((p) => p.log_date)
    ));
    return dates.sort();
  }, [pointsData, currentUser]);

  const totalDaysCompleted = useMemo(() => currentUserDates.length, [currentUserDates]);

  const currentStreak = useMemo(() => {
    if (!currentUserDates.length) return 0;
    const dateSet = new Set(currentUserDates);
    let streak = 0;
    let current = new Date(todayDate);
    while (true) {
      const dateKey = current.toISOString().slice(0, 10);
      if (dateSet.has(dateKey)) {
        streak += 1;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [currentUserDates, todayDate]);

  const longestStreak = useMemo(() => {
    if (!currentUserDates.length) return 0;
    const dateSet = new Set(currentUserDates);
    let longest = 0;
    currentUserDates.forEach((date) => {
      const current = new Date(date);
      const previous = new Date(current);
      previous.setDate(current.getDate() - 1);
      const previousKey = previous.toISOString().slice(0, 10);
      if (!dateSet.has(previousKey)) {
        let streak = 1;
        const next = new Date(current);
        while (true) {
          next.setDate(next.getDate() + 1);
          if (dateSet.has(next.toISOString().slice(0, 10))) {
            streak += 1;
          } else {
            break;
          }
        }
        longest = Math.max(longest, streak);
      }
    });
    return longest;
  }, [currentUserDates]);

  const weeklyCompletion = useMemo(() => {
    if (!currentUser) return 0;
    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekDates = new Set(
      pointsData
        .filter((p) => p.user_id === currentUser.id && new Date(p.log_date) >= weekStart)
        .map((p) => p.log_date)
    );
    return Math.round((weekDates.size / 7) * 100);
  }, [pointsData, currentUser, todayDate]);

  const completedHabits = useMemo(() => {
    if (!currentUser) return 0;
    const userTodayPoints = pointsData.filter(p => p.user_id === currentUser.id && p.log_date === today);
    const loggedHabits = new Set(userTodayPoints.map(p => p.activity_type));
    return loggedHabits.size;
  }, [pointsData, currentUser, today]);

  const pointsByUser = useMemo(() => {
    const map = {};
    pointsData.forEach((p) => {
      map[p.user_id] = (map[p.user_id] || 0) + p.points;
    });
    return map;
  }, [pointsData]);

  const leaderboard = useMemo(() => {
    return (users || [])
      .filter((user) => user.role !== "admin")
      .map((user) => {
        const totalPoints = pointsByUser[user.id] || 0;
        const todayPoints = (pointsData || []).filter(p => p.user_id === user.id && p.log_date === today).reduce((sum, p) => sum + p.points, 0);
        const dateKeys = (pointsData || []).filter((p) => p.user_id === user.id).map((p) => p.log_date);
        const streaks = buildStreakMetrics(dateKeys, today);
        const weeklyStart = new Date(today);
        weeklyStart.setDate(weeklyStart.getDate() - 6);
        const weeklyCount = new Set(
          (pointsData || []).filter((p) => p.user_id === user.id && new Date(p.log_date) >= weeklyStart).map((p) => p.log_date)
        ).size;
        return {
          ...user,
          points: totalPoints,
          todayPoints,
          currentStreak: streaks.currentStreak,
          longestStreak: streaks.longestStreak,
          completedDays: streaks.totalDays,
          weeklyCompletion: Math.round((weeklyCount / 7) * 100),
        };
      })
      .sort((a, b) => b.points - a.points);
  }, [users, pointsByUser, pointsData, today]);

  const teamLeaderboard = useMemo(() => {
    const teams = {};
    (users || []).forEach((user) => {
      const totalPoints = pointsByUser[user.id] || 0;
      const teamName = user.team || user.Team;
      if (!teams[teamName]) teams[teamName] = { team: teamName, total: 0 };
      teams[teamName].total += totalPoints;
    });
    return Object.values(teams)
      .sort((a, b) => b.total - a.total);
  }, [users, pointsByUser]);

  const totalPointsLogged = useMemo(() => pointsData.reduce((sum, p) => sum + p.points, 0), [pointsData]);
  const todayHabitsSubmitted = useMemo(() => pointsData.filter((p) => p.log_date === today).length, [pointsData, today]);
  const activeUsersCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Set(pointsData.filter((p) => new Date(p.created_at) >= sevenDaysAgo).map((p) => p.user_id)).size;
  }, [pointsData]);
  const teamTotals = useMemo(() => {
    const teams = {};
    (users || []).forEach((user) => {
      const total = pointsByUser[user.id] || 0;
      const teamName = user.team || user.Team;
      if (!teams[teamName]) teams[teamName] = { team: teamName, total: 0, count: 0 };
      teams[teamName].total += total;
      teams[teamName].count += 1;
    });
    return Object.values(teams)
      .map((team) => ({ ...team, average: team.count ? Math.round(team.total / team.count) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [users, pointsByUser]);
  const teamCount = useMemo(() => new Set(users.map((user) => user.team || user.Team)).size, [users]);
  const topTeam = teamTotals[0]?.team || "—";
  const teamColors = runtimeSettings.team_colors || {};
  const teamOptions = useMemo(() => {
    const teams = new Set(users.map((user) => user.team || user.Team).filter(Boolean));
    return ["All", ...Array.from(teams).sort()];
  }, [users]);
  const employeeRows = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return (users || [])
      .filter((user) => user.role !== "admin")
      .map((user) => {
        const userPoints = pointsByUser[user.id] || 0;
        const todayPoints = (pointsData || []).filter((p) => p.user_id === user.id && p.log_date === today).reduce((sum, p) => sum + p.points, 0);
        const userLogs = (pointsData || []).filter((p) => p.user_id === user.id);
        const lastActivityEntry = userLogs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const lastActivityDate = lastActivityEntry ? new Date(lastActivityEntry.created_at).toLocaleString() : "—";
        const isActive = lastActivityEntry ? new Date(lastActivityEntry.created_at) >= sevenDaysAgo : false;
        const userDates = Array.from(new Set(userLogs.map((p) => p.log_date))).sort();
        let current = 0;
        const dateSet = new Set(userDates);
        let cursor = new Date(today);
        while (dateSet.has(cursor.toISOString().slice(0, 10))) {
          current += 1;
          cursor.setDate(cursor.getDate() - 1);
        }
        return {
          ...user,
          totalPoints: userPoints,
          todayPoints,
          status: isActive ? "Active" : "Inactive",
          lastActivityDate,
          completedDays: userDates.length,
          currentStreak: current,
          teamColor: teamColors[user.team || user.Team] || "#94a3b8",
        };
      });
  }, [users, pointsData, pointsByUser, today, teamColors]);
  const filteredEmployeeRows = useMemo(() => {
    return (employeeRows || []).filter((user) => teamFilter === "All" || (user.team || user.Team) === teamFilter);
  }, [employeeRows, teamFilter]);

  const recentActivity = useMemo(() => {
    return (pointsData || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map((entry) => ({
        ...entry,
        userName: (users || []).find((u) => u.id === entry.user_id)?.name || "Unknown",
      }));
  }, [pointsData, users]);

  const activityCount = useMemo(() => activities.length, [activities]);
  const activeActivityCount = useMemo(
    () => activities.filter((activity) => activity.is_active !== false).length,
    [activities]
  );

  async function login(event) {
    event.preventDefault();
    setAuthError("");

    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();

    try {
      console.log("login auth start", email);
      const { data, error } = await authRequestWithTimeout(supabase.auth.signInWithPassword({ email, password }));
      console.log("login auth end", email, { error });

      if (error) {
        setAuthError(String(error.message || "Login failed."));
        return;
      }

      const authUser = data?.user;
      if (!authUser) {
        setAuthError("Login failed: no user returned.");
        return;
      }

      const { data: user, error: lookupError } = await supabase
        .from("Users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (lookupError) {
        setAuthError(String(lookupError.message));
        return;
      }

      let profile = user;
      if (!profile) {
        const name = email.split("@")[0];
        const payload = { id: authUser.id, email, name, Team: "Office", role: "employee" };

        const { data: insertData, error: insertError } = await supabase
          .from("Users")
          .insert([payload])
          .select()
          .single();

        if (insertError) {
          setAuthError(String(insertError.message));
          return;
        }

        profile = insertData;
      }

      if (profile?.company_id) {
        await loadCompanyData(profile.company_id);
        await loadActivities(profile.company_id);
      }

      setCurrentUser(profile);
      setAuthMode("login");
      setAuthError("");
    } catch (error) {
      console.error("Login error", error);
      setAuthError(String(error?.message || "Login failed. Please try again."));
    }
  }

  async function signup(event) {
    event.preventDefault();

    const joinCode = form.code.trim().toUpperCase();
    if (!joinCode) {
      setAuthError("Incorrect join code. Please check with your challenge organiser.");
      return;
    }

    const { data: companyRecord, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("join_code", joinCode)
      .single();

    if (companyError || !companyRecord) {
      setAuthError("Incorrect join code. Please check with your challenge organiser.");
      return;
    }

    // Load teams for this company
    const { data: teamsData } = await supabase
      .from("challenge_settings")
      .select("value")
      .eq("company_id", companyRecord.id)
      .eq("key", "teams")
      .maybeSingle();

    let teams = ["Workshop", "Warehouse", "Installers", "Office"];
    if (teamsData && teamsData.value) {
      teams = teamsData.value.split(",").map(t => t.trim());
    }
    setSignupTeams(teams);

    // Set default team if current selection is not valid
    if (!teams.includes(form.team)) {
      setForm({ ...form, team: teams[0] });
    }

    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();
    const name = form.name.trim() || email.split("@")[0];

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    try {
      console.log("signup auth start", email);
      let data, error;
      try {
        ({ data, error } = await authRequestWithTimeout(supabase.auth.signUp({ email: email, password })));
      } catch (timeoutError) {
        console.log("signup auth timeout", email, timeoutError);
        setAuthError("Auth request timed out");
        return;
      }
      console.log("signup auth end", email, { error });

      if (error) {
        const message = String(error.message || "Signup failed.");
        setAuthError(message);
        if (/rate limit/i.test(message)) {
          return;
        }
        if (/already.*exists|already.*registered|duplicate/i.test(message)) {
          setAuthMode("login");
          return;
        }
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        setAuthError("Account created! Please check your email and then login.");
        setAuthMode("login");
        return;
      }

      const { data: existingUser, error: existingError } = await supabase
        .from("Users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (existingError) {
        setAuthError(String(existingError.message));
        return;
      }

      if (!existingUser) {
        const payload = { id: userId, email: email, name, Team: form.team, role: "employee", company_id: companyRecord.id, is_active: true };

        const { data: insertData, error: insertError } = await supabase
          .from("Users")
          .insert([payload])
          .select()
          .single();

        if (insertError) {
          console.error("Profile insert error", insertError);
          setAuthError(String(insertError.message));
          return;
        }
      }

      setAuthError("Account created successfully! Please login using your email and password.");
      setAuthMode("login");
    } catch (error) {
      console.error("Signup error", error);
      setAuthError(String(error?.message || "Signup failed. Please try again."));
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");
    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      setResetError("Please enter your email address.");
      return;
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setResetError(error.message || "Failed to send password reset email.");
      return;
    }

    setResetMessage("Password reset email sent. Please check your inbox.");
  }

  async function submitNewPassword(event) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!newPassword || !confirmPassword) {
      setResetError("Please enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.message?.includes("Auth session missing")) {
        setResetError("This reset link has expired or is no longer valid. Please request a new password reset email.");
      } else {
        setResetError(error.message || "Failed to update password.");
      }
      return;
    }

    setResetMessage("Password updated. You can now log in.");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordResetStage(null);
    setAuthMode("login");
  }

  function logout() {
    setCurrentUser(null);
    clearPasswordResetState();
    setAuthMode("login");
    setAuthError("");
    supabase.auth.signOut();
  }

  async function toggleHabit(key) {
    if (activityEditLocked || !currentUser) return;

    const wasDone = todayLogs[key];
    const next = { ...todayLogs, [key]: !wasDone };
    setTodayLogs(next);
  }

  async function submitDay() {
    if (!currentUser) return;
    if (!challengeLive) {
      setStatusMessageType("error");
      setStatusMessage(challengeStatusMessage || "Submissions are currently locked.");
      return;
    }
    if (alreadySubmittedToday) {
      setStatusMessageType("info");
      setStatusMessage("Today already submitted.");
      return;
    }
    setStatusMessage("");

    const selectedHabits = Object.entries(todayLogs)
      .filter(([, value]) => value)
      .map(([key]) => key);

    console.log("selected habits", selectedHabits);

    if (!selectedHabits.length) {
      setStatusMessageType("error");
      setStatusMessage("Select at least one habit before submitting.");
      return;
    }

    const existingToday = new Set(
      pointsData.filter((p) => p.user_id === currentUser.id && p.log_date === today).map((p) => p.activity_name)
    );

    const newHabits = selectedHabits.filter((key) => !existingToday.has(key));

    if (!newHabits.length) {
      setStatusMessageType("info");
      setStatusMessage("You've already submitted these habits today.");
      return;
    }

    const payload = newHabits.map((key) => {
      const activity = activities.find((item) => getActivityKey(item) === key);
      const activityType = activity?.activity_type || "habit";
      return {
        user_id: currentUser.id,
        activity_type: activityType,
        activity_name: key,
        points: activityPoints[key] || 10,
        log_date: today,
      };
    });

    console.log("insert payload", payload);

    const { data: insertData, error: insertError } = await supabase
      .from("points_log")
      .insert(payload)
      .select();

    console.log("insert response", insertData, insertError);

    if (insertError) {
      console.error("insert error", insertError);
      if (insertError.code === "23505" || String(insertError.message).toLowerCase().includes("duplicate")) {
        setStatusMessageType("info");
        setStatusMessage("You've already submitted these habits today.");
      } else {
        setStatusMessageType("error");
        setStatusMessage("Submit failed: " + insertError.message);
      }
      const { data: newPoints } = await supabase
        .from("points_log")
        .select("user_id, points, created_at, log_date, activity_type, activity_name");
      if (newPoints) setPointsData(newPoints);
      return;
    }

    const { data: newPoints, error: newPointsError } = await supabase
      .from("points_log")
      .select("user_id, points, created_at, log_date, activity_type, activity_name");

    if (newPointsError) {
      console.error("reload points error", newPointsError);
      setStatusMessageType("error");
      setStatusMessage("Submit succeeded, but failed to refresh totals.");
      return;
    }

    setPointsData(newPoints);
    setStatusMessageType("success");
    setStatusMessage("Day submitted successfully.");
  }

  function exportLeaderboard() {
    csvDownload("leaderboard.csv", [
      ["Rank", "Name", "Email", "Team", "Total points", "Today"],
      ...leaderboard.map((user, index) => [index + 1, user.name, user.email, user.team || user.Team, user.points, user.todayPoints]),
    ]);
  }

  function exportUsersCsv() {
    csvDownload("users.csv", [
      ["Name", "Email", "Team", "Role", "Total points", "Today points", "Status", "Last activity"],
      ...employeeRows.map((user) => [user.name, user.email, user.team || user.Team, user.role, user.totalPoints, user.todayPoints, user.status, user.lastActivityDate]),
    ]);
  }

  function exportPointsLogCsv() {
    csvDownload("points_log.csv", [
      ["User", "Email", "Team", "Activity", "Points", "Log date", "Created at"],
      ...(pointsData || []).map((entry) => [
        (users || []).find((u) => u.id === entry.user_id)?.name || "Unknown",
        (users || []).find((u) => u.id === entry.user_id)?.email || "",
        (users || []).find((u) => u.id === entry.user_id)?.team || (users || []).find((u) => u.id === entry.user_id)?.Team || "",
        entry.activity_name,
        entry.points,
        entry.log_date,
        entry.created_at,
      ]),
    ]);
  }

  function exportLogs() {
    csvDownload("daily_logs.csv", [
      ["Date", "Name", "Email", "Team", "Activity type", "Activity name", "Points"],
      ...(pointsData || []).map((entry) => {
        const user = (users || []).find((u) => u.id === entry.user_id) || {};
        return [
          entry.log_date,
          user.name || "Unknown",
          user.email || "",
          user.team || "",
          entry.activity_type || "",
          entry.activity_name || "",
          entry.points,
        ];
      }),
    ]);
  }

  function exportLeaderboardCsv() {
    csvDownload("leaderboard.csv", [
      ["Rank", "Name", "Email", "Team", "Points", "Today points", "Current streak", "Completed days", "Weekly %"],
      ...leaderboard.map((user, index) => [
        index + 1,
        user.name,
        user.email,
        user.team,
        user.points,
        user.todayPoints,
        user.currentStreak || 0,
        user.completedDays || 0,
        user.weeklyCompletion || 0,
      ]),
    ]);
  }

  function exportStreakCsv() {
    csvDownload("streaks.csv", [
      ["Name", "Email", "Team", "Current streak", "Longest streak", "Total days completed", "Weekly completion %"],
      ...users.filter((user) => user.role !== "admin").map((user) => {
        const userLogs = pointsData.filter((p) => p.user_id === user.id);
        const dates = Array.from(new Set(userLogs.map((p) => p.log_date))).sort();
        const current = (() => {
          const set = new Set(dates);
          let count = 0;
          let cursor = new Date(today);
          while (set.has(cursor.toISOString().slice(0, 10))) {
            count += 1;
            cursor.setDate(cursor.getDate() - 1);
          }
          return count;
        })();
        const longest = (() => {
          if (!dates.length) return 0;
          const set = new Set(dates);
          let best = 0;
          dates.forEach((date) => {
            const currentDate = new Date(date);
            const prev = new Date(currentDate);
            prev.setDate(prev.getDate() - 1);
            if (!set.has(prev.toISOString().slice(0, 10))) {
              let streak = 1;
              const next = new Date(currentDate);
              while (true) {
                next.setDate(next.getDate() + 1);
                if (set.has(next.toISOString().slice(0, 10))) {
                  streak += 1;
                } else {
                  break;
                }
              }
              best = Math.max(best, streak);
            }
          });
          return best;
        })();
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6);
        const weeklyDates = new Set(userLogs.filter((p) => new Date(p.log_date) >= weekStart).map((p) => p.log_date));
        return [
          user.name,
          user.email,
          user.team,
          current,
          longest,
          dates.length,
          Math.round((weeklyDates.size / 7) * 100),
        ];
      } ),
    ]);
  }

  async function saveSettings(event) {
    event.preventDefault();
    setStored("mh_settings", settings);

    if (!currentUser?.company_id) {
      alert("Error: No company associated with this account.");
      return;
    }

    // Upsert challenge_settings
    const keysToSave = ["company", "title", "joinCode", "startDate", "endDate", "status", "is_active", "team_colors", "teams"];
    const upsertData = keysToSave.map(key => ({
      company_id: currentUser.company_id,
      key,
      value: key === "is_active"
        ? String(settings.is_active === true)
        : key === "team_colors"
          ? JSON.stringify(settings.team_colors || {})
          : settings[key] || "",
    }));

    console.log("Saving settings:", upsertData);
    const { data, error } = await supabase
      .from("challenge_settings")
      .upsert(upsertData, { onConflict: ["company_id", "key"] });

    if (error) {
      console.error("save challenge settings error:", error.message, error);
      alert(`Settings saved locally, but database update failed: ${error.message}`);
      return;
    }

    console.log("Settings saved to database:", data);
    alert("Settings saved.");
    await loadChallengeSettings(); // Reload to sync
  }

  function updateActivityField(index, field, value) {
    setActivityEdits((current) => current.map((activity, idx) => idx === index ? { ...activity, [field]: value } : activity));
  }

  function addActivityRow() {
    setActivityEdits((current) => [
      ...current,
      {
        activity_key: "",
        activity_type: "habit",
        activity_name: "",
        description: "",
        points: 10,
        is_active: true,
        sort_order: current.length + 1,
        company_id: currentUser?.company_id,
      },
    ]);
  }

  function removeActivityRow(index) {
    setActivityEdits((current) => current.filter((_, idx) => idx !== index));
  }

  function resetActivityDefaults() {
    setActivityEdits(habits.map((habit, index) => ({
      activity_key: habit.key,
      activity_name: habit.label,
      activity_type: "habit",
      description: habit.target,
      points: 10,
      is_active: true,
      sort_order: index + 1,
      company_id: currentUser?.company_id,
    })));
    setAdminBuilderMessageType("info");
    setAdminBuilderMessage("Reset to default habits locally. Click Save activities to persist.");
  }

  async function saveActivities(event) {
    event.preventDefault();
    setAdminBuilderMessage("");

    if (!currentUser?.company_id) {
      setAdminBuilderMessageType("error");
      setAdminBuilderMessage("You need a company assigned to save activities.");
      return;
    }

    // Validation
    const keys = activityEdits.map((a) => String(a.activity_key || "").trim());
    const labels = activityEdits.map((a) => String(a.label || "").trim());

    if (keys.some((key) => !key)) {
      setAdminBuilderMessageType("error");
      setAdminBuilderMessage("All activities must have a unique key.");
      return;
    }

    if (new Set(keys).size !== keys.length) {
      setAdminBuilderMessageType("error");
      setAdminBuilderMessage("All activity keys must be unique.");
      return;
    }

    if (labels.some((label) => !label)) {
      setAdminBuilderMessageType("error");
      setAdminBuilderMessage("All activities must have a label.");
      return;
    }

    const payload = activityEdits.map((activity, index) => {
      const basePayload = {
        company_id: currentUser.company_id,
        activity_key: String(activity.activity_key || "").trim(),
        label: String(activity.label || "").trim(),
        description: String(activity.description || "").trim(),
        activity_type: String(activity.activity_type || "habit").trim(),
        is_active: activity.is_active !== false,
        points: Number(activity.points) || 10,
        sort_order: Number.isNaN(Number(activity.sort_order)) ? index : Number(activity.sort_order),
      };
      return activity.id ? { id: activity.id, ...basePayload } : basePayload;
    });

    console.log("saveActivities payload", payload);

    const existingRows = payload.filter((item) => item.id != null);
    const newRows = payload.filter((item) => item.id == null);
    let savedActivities = [];

    if (existingRows.length) {
      const updateResponses = await Promise.all(existingRows.map(async (item) => {
        const { data, error } = await supabase
          .from("challenge_activities")
          .update({
            activity_key: item.activity_key,
            label: item.label,
            description: item.description,
            activity_type: item.activity_type,
            is_active: item.is_active,
            points: item.points,
            sort_order: item.sort_order,
          })
          .eq("id", item.id)
          .select()
          .single();
        console.log("update activity response", { item, data, error });
        return { data, error, item };
      }));

      const updateErrors = updateResponses.filter((response) => response.error);
      if (updateErrors.length) {
        const message = updateErrors[0].error.message || "Failed to update challenge activities.";
        console.error("save activities update error", updateErrors);
        setAdminBuilderMessageType("error");
        setAdminBuilderMessage(message);
        return;
      }
      savedActivities.push(...updateResponses.map((response) => response.data));
    }

    if (newRows.length) {
      const { data, error } = await supabase
        .from("challenge_activities")
        .insert(newRows)
        .select();
      console.log("insert activity response", { data, error });
      if (error) {
        const message = error.message || "Failed to insert challenge activities.";
        console.error("save activities insert error", error);
        setAdminBuilderMessageType("error");
        setAdminBuilderMessage(message);
        return;
      }
      savedActivities.push(...(data || []));
    }

    const finalActivities = savedActivities.length ? savedActivities : payload;
    setActivities(finalActivities);
    setActivityEdits(finalActivities);
    setAdminBuilderMessageType("success");
    setAdminBuilderMessage("Activities saved successfully.");
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    setStored("mh_announcement", announcement);

    if (!currentUser?.company_id) {
      alert("Error: No company associated with this account.");
      return;
    }

    const upsertData = [
      { company_id: currentUser.company_id, key: "announcement_title", value: announcement.title || "" },
      { company_id: currentUser.company_id, key: "announcement_body", value: announcement.body || "" },
    ];

    console.log("Saving announcement:", upsertData);
    const { data, error } = await supabase
      .from("challenge_settings")
      .upsert(upsertData, { onConflict: ["company_id", "key"] });

    if (error) {
      console.error("save announcement error:", error.message, error);
      alert(`Announcement saved locally, but database update failed: ${error.message}`);
      return;
    }

    console.log("Announcement saved to database:", data);
    setToast("Announcement saved.");
  }

  async function refreshUsers() {
    const { data: usersData, error } = await supabase
      .from("Users")
      .select("*");
    if (error) {
      console.error("refresh users error", error);
      return;
    }
    const pointsMap = {};
    pointsData.forEach((p) => {
      pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + p.points;
    });
    const usersWithPoints = usersData.map((u) => ({
      ...u,
      points: pointsMap[u.id] || 0,
    })).sort((a, b) => b.points - a.points);
    setUsers(usersWithPoints);
  }

  async function updateUser(userId, updates) {
    const { data, error } = await supabase
      .from("Users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) {
      console.error("update user error", error);
      alert("Failed to update user: " + error.message);
      return null;
    }
    await refreshUsers();
    return data;
  }

  async function resetUserPoints(userId) {
    if (!window.confirm("Reset points for this user? This cannot be undone.")) return;
    const { error } = await supabase
      .from("points_log")
      .delete()
      .eq("user_id", userId);
    if (error) {
      console.error("reset user points error", error);
      alert("Failed to reset points: " + error.message);
      return;
    }
    const { data: newPoints, error: newPointsError } = await supabase
      .from("points_log")
      .select("user_id, points, created_at, log_date, activity_type, activity_name");
    if (!newPointsError) setPointsData(newPoints);
    await refreshUsers();
    setToast("User points reset.");
  }

  async function deleteUser(userId) {
    if (!window.confirm("Delete this user and their points? This cannot be undone.")) return;
    const { error: deletePointsError } = await supabase
      .from("points_log")
      .delete()
      .eq("user_id", userId);
    if (deletePointsError) {
      console.error("delete user points error", deletePointsError);
      alert("Failed to delete user points: " + deletePointsError.message);
      return;
    }
    const { error } = await supabase
      .from("Users")
      .delete()
      .eq("id", userId);
    if (error) {
      console.error("delete user error", error);
      alert("Failed to delete user: " + error.message);
      return;
    }
    await refreshUsers();
    setToast("User deleted.");
  }

  async function toggleUserRole(user) {
    const newRole = user.role === "admin" ? "employee" : "admin";
    if (!window.confirm(`Change role for ${user.name} to ${newRole}?`)) return;
    await updateUser(user.id, { role: newRole });
    setToast(`User role updated to ${newRole}.`);
  }

  async function toggleUserActive(user) {
    const newRole = user.role === "inactive" ? "employee" : "inactive";
    if (!window.confirm(`${newRole === "inactive" ? "Deactivate" : "Reactivate"} ${user.name}?`)) return;
    await updateUser(user.id, { role: newRole });
    setToast(`User ${newRole === "inactive" ? "deactivated" : "reactivated"}.`);
  }

  async function moveUserTeam(userId, team) {
    await updateUser(userId, { team });
    setToast("User team updated.");
  }

  function addTeam(name, color) {
    const teamColors = settings.team_colors || {};
    const next = { ...teamColors, [name]: color };
    setSettings({ ...settings, team_colors: next });
    setToast("Team saved.");
  }

  function setTeamColor(team, color) {
    const teamColors = settings.team_colors || {};
    setSettings({ ...settings, team_colors: { ...teamColors, [team]: color } });
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 p-5 text-slate-900">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl md:grid-cols-2">
          <div className="bg-slate-950 p-8 text-white md:p-12">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">Manual Handling NZ</div>
            <h1 className="text-5xl font-black leading-none md:text-7xl">{runtimeSettings.title}</h1>
            <p className="mt-5 max-w-md text-lg text-slate-300">Online workplace wellbeing challenge for logging habits, scoring points, team competition and employer reporting.</p>
          </div>
          <div className="p-8 md:p-12">
            <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-2">
              <button onClick={() => setAuthMode("login")} className={`rounded-xl py-3 font-black ${authMode === "login" ? "bg-white shadow" : "text-slate-500"}`}>Login</button>
              <button onClick={() => setAuthMode("signup")} className={`rounded-xl py-3 font-black ${authMode === "signup" ? "bg-white shadow" : "text-slate-500"}`}>Sign up</button>
            </div>
            <form className="space-y-4">
              {authMode === "signup" && (
                <input className="w-full rounded-2xl border p-4 font-semibold" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              )}
              <input className="w-full rounded-2xl border p-4 font-semibold" type="email" required placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              {passwordResetStage !== "confirm" && (
                <input className="w-full rounded-2xl border p-4 font-semibold" type="password" required placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              )}

              {authMode === "login" && !passwordResetStage && (
                <div className="text-right">
                  <button type="button" className="text-sm font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => {
                    setPasswordResetStage("request");
                    setResetEmail(form.email.trim().toLowerCase());
                    setResetError("");
                    setResetMessage("");
                    setAuthError("");
                  }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {!passwordResetStage && resetMessage && (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{resetMessage}</div>
              )}

              {authError && authMode === "login" && !passwordResetStage && (
                <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{authError}</div>
              )}

              {passwordResetStage === "request" && authMode === "login" && (
                <>
                  <input className="w-full rounded-2xl border p-4 font-semibold" type="email" required placeholder="Email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
                  {resetError && (
                    <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{resetError}</div>
                  )}
                  {resetMessage && (
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{resetMessage}</div>
                  )}
                  <button type="button" onClick={requestPasswordReset} className="w-full rounded-2xl bg-emerald-500 p-4 text-lg font-black text-white">Send reset email</button>
                  <button type="button" onClick={clearPasswordResetState} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-lg font-black text-slate-700">Back to login</button>
                </>
              )}

              {passwordResetStage === "confirm" && authMode === "login" && (
                <>
                  <input className="w-full rounded-2xl border p-4 font-semibold" type="password" required placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  <input className="w-full rounded-2xl border p-4 font-semibold" type="password" required placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  {resetError && (
                    <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{resetError}</div>
                  )}
                  {resetMessage && (
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{resetMessage}</div>
                  )}
                  <button type="button" onClick={submitNewPassword} className="w-full rounded-2xl bg-emerald-500 p-4 text-lg font-black text-white">Set new password</button>
                </>
              )}

              {authMode === "signup" && (
                <>
                  <select className="w-full rounded-2xl border p-4 font-semibold" value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })}>
                    {signupTeams.map(team => <option key={team}>{team}</option>)}
                  </select>
                  <input className="w-full rounded-2xl border p-4 font-semibold" placeholder="Enter join code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
                  {authError && authMode === "signup" && (
                    <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{authError}</div>
                  )}
                </>
              )}

              {passwordResetStage !== "request" && passwordResetStage !== "confirm" && (
                <button type="button" onClick={(event) => { setAuthError(""); if (authMode === "login") login(event); else signup(event); }} className="w-full rounded-2xl bg-emerald-500 p-4 text-lg font-black text-white">{authMode === "login" ? "Login" : "Join challenge"}</button>
              )}
            </form>
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
              <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">Manual Handling NZ Challenge Platform</div>
              <h1 className="text-4xl font-black leading-none md:text-6xl">{runtimeSettings.title}</h1>
              <p className="mt-4 max-w-2xl text-slate-300">Welcome, {currentUser.name}. {challengeLive ? "Log healthy habits and help your team climb the leaderboard." : "This challenge is currently read-only."}</p>
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
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Status</div><div className="text-2xl font-black">{challengeStatusMessage || (challengeLive ? "Active" : "Paused")}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Team</div><div className="text-2xl font-black">{currentUser.team || currentUser.Team}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Streak</div><div className="text-2xl font-black">{currentStreak} days</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Completed days</div><div className="text-2xl font-black">{totalDaysCompleted}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Weekly %</div><div className="text-2xl font-black">{weeklyCompletion}%</div></div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {habitActivities.map((activity) => {
                  const key = getActivityKey(activity);
                  const isDone = todayLogs[key];
                  return (
                    <button key={key} onClick={() => toggleHabit(key)} disabled={activityEditLocked || activity.is_active === false} className={`rounded-3xl border p-4 text-left shadow-sm ${isDone ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"} ${activity.is_active === false ? "opacity-50" : ""}`}>
                      <div className="text-3xl">{activity.icon || "✅"}</div>
                      <div className="mt-3 text-lg font-black">{activity.label || "Activity"}</div>
                      <div className="mt-1 text-sm text-slate-500">{activity.description || activity.target || "Complete this healthy habit."}</div>
                      <div className="mt-3 font-black text-emerald-600">+{activityPoints[key] || 10} pts</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">Submit your day</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Once submitted, today's log is locked.</p>
                  <button onClick={submitDay} disabled={activityEditLocked} className={`mt-4 w-full rounded-2xl p-4 font-black text-white ${activityEditLocked ? "bg-slate-400" : "bg-emerald-500"}`}>Submit Day</button>
                  {(statusMessage || challengeStatusMessage || alreadySubmittedToday) && (
                    <div className={`mt-4 rounded-2xl p-4 text-sm font-semibold ${statusMessageType === "error" ? "bg-red-50 text-red-700" : statusMessageType === "info" ? "bg-slate-50 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {statusMessage || (alreadySubmittedToday ? "Today already submitted." : challengeStatusMessage)}
                    </div>
                  )}
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
                      <div className="text-2xl font-black text-emerald-600">{team.total}</div>
                      <div className="text-xs font-bold text-slate-400">team points</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                {leaderboard.map((user, index) => (
                  <div key={user.id} className="flex items-center gap-4 border-b p-4 last:border-b-0">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 font-black">{index + 1}</div>
                    <div className="flex-1"><div className="font-black">{user.name}</div><div className="text-sm font-semibold text-slate-500">{user.team} · today +{user.todayPoints}</div></div>
                    <div className="text-right"><div className="text-2xl font-black text-emerald-600">{user.points}</div><div className="text-xs font-bold text-slate-400">points</div></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "workouts" && (
            <section>
              <h2 className="mb-4 text-3xl font-black">Workouts</h2>
              <div className="grid gap-4 md:grid-cols-4">
                {workoutActivities.map((activity) => {
                  const key = getActivityKey(activity);
                  const isDone = todayLogs[key];
                  return (
                    <button key={key} onClick={() => toggleHabit(key)} disabled={activityEditLocked || activity.is_active === false} className={`rounded-3xl border p-5 text-left shadow-sm ${isDone ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"} ${activity.is_active === false ? "opacity-50" : ""}`}>
                      <div className="text-3xl">{activity.icon || "🏋️"}</div>
                      <h3 className="mt-3 text-xl font-black">{activity.label || "Workout"}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{activity.description || activity.target || "Workout session"}</p>
                      <div className="mt-5 rounded-2xl bg-slate-100 p-4 font-black">+{activity.points || activityPoints[key] || 10} points</div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "admin" && isAdmin && (
            <section>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-3xl font-black">Admin dashboard</h2><p className="text-slate-500">Read-only challenge metrics.</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={exportUsersCsv} className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Export Users CSV</button>
                  <button onClick={exportPointsLogCsv} className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Export Points Log CSV</button>
                  <button onClick={exportLeaderboardCsv} className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Export Leaderboard CSV</button>
                  <button onClick={exportStreakCsv} className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Export Streak CSV</button>
                  <button onClick={exportLogs} className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Export Daily Logs</button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Total users</div><div className="text-3xl font-black">{users.length}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Active users</div><div className="text-3xl font-black">{activeUsersCount}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Total points logged</div><div className="text-3xl font-black">{totalPointsLogged}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Habits today</div><div className="text-3xl font-black">{todayHabitsSubmitted}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Number of teams</div><div className="text-3xl font-black">{teamCount}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Top team</div><div className="text-3xl font-black">{topTeam}</div></div>
              </div>
              <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xl font-black">Employee management</h3>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <label className="text-sm font-bold text-slate-700">Filter team:</label>
                  <select className="rounded-2xl border p-3 text-sm" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                    {teamOptions.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-700">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3">Name</th>
                        <th className="border-b border-slate-200 px-4 py-3">Email</th>
                        <th className="border-b border-slate-200 px-4 py-3">Team</th>
                        <th className="border-b border-slate-200 px-4 py-3">Role</th>
                        <th className="border-b border-slate-200 px-4 py-3">Total points</th>
                        <th className="border-b border-slate-200 px-4 py-3">Today points</th>
                        <th className="border-b border-slate-200 px-4 py-3">Days</th>
                        <th className="border-b border-slate-200 px-4 py-3">Status</th>
                        <th className="border-b border-slate-200 px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployeeRows.map((user) => (
                        <tr key={user.id} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-black">{user.name}</td>
                          <td className="px-4 py-3 text-slate-500">{user.email}</td>
                          <td className="px-4 py-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: user.teamColor }} />{user.team}</td>
                          <td className="px-4 py-3">{user.role}</td>
                          <td className="px-4 py-3 font-black">{user.totalPoints}</td>
                          <td className="px-4 py-3">{user.todayPoints}</td>
                          <td className="px-4 py-3">{user.completedDays || 0}</td>
                          <td className="px-4 py-3">{user.status}</td>
                          <td className="px-4 py-3 space-y-2">
                            <button onClick={() => toggleUserRole(user)} className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-black text-white">{user.role === "admin" ? "Demote" : "Promote"}</button>
                            <button onClick={() => toggleUserActive(user)} className="rounded-2xl bg-slate-500 px-3 py-2 text-xs font-black text-white">{user.role === "inactive" ? "Reactivate" : "Deactivate"}</button>
                            <button onClick={() => resetUserPoints(user.id)} className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-black text-white">Reset points</button>
                            <button onClick={() => deleteUser(user.id)} className="rounded-2xl bg-red-500 px-3 py-2 text-xs font-black text-white">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xl font-black">Team breakdown</h3>
                <div className="grid gap-3 md:grid-cols-4">
                  {teamTotals.map((team) => (
                    <div key={team.team} className="rounded-2xl bg-slate-50 p-4">
                      <div className="font-black">{team.team}</div>
                      <div className="mt-2 text-3xl font-black text-emerald-600">{team.total}</div>
                      <div className="text-xs font-bold text-slate-400">{team.count} users · avg {team.average}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xl font-black">Recent points activity</h3>
                <div className="space-y-3">
                  {recentActivity.map((item, index) => (
                    <div key={`${item.user_id}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                      <div className="font-black">{item.userName}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.activity_name} · +{item.points} pts · {new Date(item.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "settings" && isAdmin && (
            <section>
              <h2 className="mb-4 text-3xl font-black">Settings</h2>
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Company</div><div className="text-3xl font-black">{company?.name || runtimeSettings.company}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Join code</div><div className="text-3xl font-black">{runtimeSettings.joinCode}</div></div>
                <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm font-black uppercase text-slate-400">Activities</div><div className="text-3xl font-black">{activityCount} / {activeActivityCount}</div></div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <form onSubmit={saveSettings} className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-xl font-black">Challenge settings</h3>
                  <div className="grid gap-3">
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.company} onChange={(event) => setSettings({ ...settings, company: event.target.value })} placeholder="Company" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} placeholder="Title" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.joinCode} onChange={(event) => setSettings({ ...settings, joinCode: event.target.value.toUpperCase() })} placeholder="Join code" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.teams} onChange={(event) => setSettings({ ...settings, teams: event.target.value })} placeholder="Teams (comma-separated)" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.startDate} onChange={(event) => setSettings({ ...settings, startDate: event.target.value })} placeholder="Start date" />
                    <input className="rounded-2xl border p-3 font-semibold" value={settings.endDate} onChange={(event) => setSettings({ ...settings, endDate: event.target.value })} placeholder="End date" />
                    <select className="rounded-2xl border p-3 font-semibold" value={settings.status} onChange={(event) => setSettings({ ...settings, status: event.target.value })}><option value="pre">Pre-start</option><option value="live">Live</option><option value="complete">Complete</option></select>
                    <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input type="checkbox" checked={settings.is_active !== false} onChange={(event) => setSettings({ ...settings, is_active: event.target.checked })} />
                      Challenge active
                    </label>
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
              <form onSubmit={saveActivities} className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xl font-black">Challenge activity builder</h3>
                <p className="mb-4 text-sm text-slate-500">Changes affect employee cards after save.</p>
                <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs font-black uppercase text-slate-500 md:grid-cols-8">
                  <div>Key</div>
                  <div>Label</div>
                  <div>Description</div>
                  <div>Points</div>
                  <div>Type</div>
                  <div>Active</div>
                  <div>Order</div>
                  <div>Action</div>
                </div>
                <div className="space-y-4 mt-4">
                  {activityEdits.map((activity, index) => (
                    <div key={activity.id || index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-8">
                      <input className="rounded-2xl border p-3 font-semibold" value={activity.activity_key || ""} onChange={(event) => updateActivityField(index, "activity_key", event.target.value)} placeholder="e.g. nutrition" />
                      <input className="rounded-2xl border p-3 font-semibold" value={activity.label || ""} onChange={(event) => updateActivityField(index, "label", event.target.value)} placeholder="e.g. Nutrition" />
                      <input className="rounded-2xl border p-3 font-semibold" value={activity.description || ""} onChange={(event) => updateActivityField(index, "description", event.target.value)} placeholder="Description" />
                      <input className="rounded-2xl border p-3 font-semibold" type="number" value={activity.points || 0} onChange={(event) => updateActivityField(index, "points", Number(event.target.value))} placeholder="Points" />
                      <select className="rounded-2xl border p-3 font-semibold" value={activity.activity_type || "habit"} onChange={(event) => updateActivityField(index, "activity_type", event.target.value)}>
                        <option value="habit">Habit</option>
                        <option value="workout">Workout</option>
                      </select>
                      <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <input type="checkbox" checked={activity.is_active !== false} onChange={(event) => updateActivityField(index, "is_active", event.target.checked)} />
                        Active
                      </label>
                      <input className="rounded-2xl border p-3 font-semibold" type="number" value={activity.sort_order || 0} onChange={(event) => updateActivityField(index, "sort_order", Number(event.target.value))} placeholder="Order" />
                      <button type="button" className="rounded-2xl bg-red-500 px-4 py-3 font-black text-white" onClick={() => removeActivityRow(index)}>Remove</button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={addActivityRow} className="rounded-2xl bg-slate-900 px-4 py-3 font-black text-white">Add activity</button>
                    <button type="button" onClick={resetActivityDefaults} className="rounded-2xl bg-slate-500 px-4 py-3 font-black text-white">Reset to defaults</button>
                    <button type="submit" className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white">Save activities</button>
                  </div>
                  {adminBuilderMessage && (
                    <div className={`rounded-2xl p-4 text-sm font-semibold ${adminBuilderMessageType === "error" ? "bg-red-50 text-red-700" : adminBuilderMessageType === "info" ? "bg-slate-50 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {adminBuilderMessage}
                    </div>
                  )}
                </div>
              </form>
              {activityEdits.length > 0 && (
                <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-xl font-black">Employee preview</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {activityEdits.map((activity, index) => (
                      <div key={activity.id || index} className="rounded-2xl bg-slate-50 p-4">
                        <div className="font-black">{activity.label || "Untitled activity"}</div>
                        <div className="mt-2 text-sm text-slate-500">{activity.description || "No description provided."}</div>
                        <div className="mt-3 text-sm font-black text-emerald-600">+{Number(activity.points) || 10} pts</div>
                        <div className="mt-1 text-xs uppercase text-slate-400">{activity.activity_type || "habit"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

