const SUPABASE_URL = "https://kdrhyhrumrzmrwdkgnyj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_J2LMtqJMzzte7YYxUSlsCA_bEJuaZZH";
const PASSWORD = "zhao01092008";

const SUBJECTS = ["chinese", "english", "math", "science", "society", "other"];

const subjectLabels = {
  chinese: "國文",
  english: "英文",
  math: "數學",
  science: "自然",
  society: "社會",
  other: "其他"
};

let db = null;
let currentView = "month";
let currentTime = "";
let currentSubject = "chinese";
let controlsBound = false;

window.addEventListener("load", () => {
  bindLogin();
});

function bindLogin() {
  const loginBtn = document.getElementById("loginBtn");
  const passwordInput = document.getElementById("passwordInput");

  if (!loginBtn || !passwordInput) {
    console.error("登入元件不存在");
    return;
  }

  loginBtn.addEventListener("click", tryLogin);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      tryLogin();
    }
  });
}

async function tryLogin() {
  const passwordInput = document.getElementById("passwordInput");
  const loginError = document.getElementById("loginError");
  const loginScreen = document.getElementById("loginScreen");
  const appShell = document.getElementById("appShell");

  if (passwordInput.value !== PASSWORD) {
    loginError.textContent = "密碼錯誤";
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  try {
    if (!window.supabase) {
      throw new Error("Supabase CDN 沒有載入成功");
    }

    const { createClient } = window.supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error(err);
    loginError.textContent = "Supabase 初始化失敗，請檢查 URL / KEY / CDN";
    return;
  }

  loginError.textContent = "";
  loginScreen.classList.add("hidden");
  loginScreen.style.display = "none";
  appShell.style.display = "block";

  await initEditorApp();
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function initEditorApp() {
  setTodayDefault();
  bindControls();
  applyUrlParams();
  syncControlsFromState();
  renderGrid();
  await loadCellToEditorFromState();
}

function setTodayDefault() {
  const now = new Date();
  currentTime = formatMonthKey(now);
}

function bindControls() {
  if (controlsBound) return;
  controlsBound = true;

  document.getElementById("viewSelect").addEventListener("change", async (e) => {
    currentView = e.target.value;
    currentTime = getDefaultTimeByView(currentView);
    syncControlsFromState();
    renderGrid();
    await loadCellToEditorFromState();
  });

  document.getElementById("timeSelect").addEventListener("change", async (e) => {
    currentTime = e.target.value;
    renderGrid();
    await loadCellToEditorFromState();
  });

  document.getElementById("subjectSelect").addEventListener("change", async (e) => {
    currentSubject = e.target.value;
    highlightSelectedCell();
    await loadCellToEditorFromState();
  });

  document.getElementById("saveBtn").addEventListener("click", saveCurrentCell);
  document.getElementById("deleteBtn").addEventListener("click", deleteCurrentCell);
  document.getElementById("duplicateBtn").addEventListener("click", duplicateCurrentPeriod);
  document.getElementById("templateBtn").addEventListener("click", createTemplatesForCurrentPeriod);
  document.getElementById("clearPeriodBtn").addEventListener("click", clearCurrentPeriod);
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const time = params.get("time");
  const subject = params.get("subject");

  if (view && ["day", "week", "month"].includes(view)) {
    currentView = view;
  }

  if (time) {
    currentTime = time;
  } else {
    currentTime = getDefaultTimeByView(currentView);
  }

  if (subject && SUBJECTS.includes(subject)) {
    currentSubject = subject;
  }
}

function syncControlsFromState() {
  const viewSelect = document.getElementById("viewSelect");
  const timeSelect = document.getElementById("timeSelect");
  const subjectSelect = document.getElementById("subjectSelect");

  viewSelect.value = currentView;
  populateTimeOptions();
  timeSelect.value = currentTime;
  subjectSelect.value = currentSubject;
}

function populateTimeOptions() {
  const timeSelect = document.getElementById("timeSelect");
  const options = getTimeOptions(currentView);

  timeSelect.innerHTML = options
    .map(item => `<option value="${item.value}">${item.label}</option>`)
    .join("");

  if (!options.some(item => item.value === currentTime)) {
    currentTime = options[0]?.value || "";
    timeSelect.value = currentTime;
  }
}

function getTimeOptions(view) {
  const now = new Date();
  if (view === "day") return buildDayOptions(now, 30);
  if (view === "week") return buildWeekOptions(now, 20);
  return buildMonthOptions(now, 18);
}

function buildDayOptions(baseDate, count) {
  const arr = [];
  for (let i = -7; i < count - 7; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    arr.push({
      value: formatDayKey(d),
      label: formatDayLabel(d)
    });
  }
  return arr;
}

function buildWeekOptions(baseDate, count) {
  const arr = [];
  const monday = getMonday(baseDate);

  for (let i = -4; i < count - 4; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    arr.push({
      value: formatWeekKey(d),
      label: formatWeekLabel(d)
    });
  }
  return arr;
}

function buildMonthOptions(baseDate, count) {
  const arr = [];
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  for (let i = -6; i < count - 6; i++) {
    const d = new Date(year, month + i, 1);
    arr.push({
      value: formatMonthKey(d),
      label: formatMonthLabel(d)
    });
  }
  return arr;
}

function getDefaultTimeByView(view) {
  const now = new Date();
  if (view === "day") return formatDayKey(now);
  if (view === "week") return formatWeekKey(getMonday(now));
  return formatMonthKey(now);
}

function renderGrid() {
  const grid = document.getElementById("planGrid");
  grid.innerHTML = "";

  const slots = getSlotsByView(currentView, currentTime);

  slots.forEach(slot => {
    const cell = document.createElement("button");
    cell.className = "plan-cell";
    cell.type = "button";
    cell.dataset.view = currentView;
    cell.dataset.time = currentTime;
    cell.dataset.subject = slot.subject;
    cell.innerHTML = `
      <div class="cell-time">${slot.label}</div>
      <div class="cell-subject">${subjectLabels[slot.subject] || slot.subject}</div>
    `;

    cell.addEventListener("click", async () => {
      currentSubject = slot.subject;
      document.getElementById("subjectSelect").value = currentSubject;
      highlightSelectedCell();
      await loadCellToEditorFromState();
    });

    grid.appendChild(cell);
  });

  highlightSelectedCell();
}

function getSlotsByView(view, timeKey) {
  if (view === "day") {
    return SUBJECTS.map(subject => ({
      label: timeKey,
      subject
    }));
  }

  if (view === "week") {
    const days = getDaysFromWeekKey(timeKey);
    const result = [];
    days.forEach(day => {
      SUBJECTS.forEach(subject => {
        result.push({
          label: day,
          subject
        });
      });
    });
    return result;
  }

  return SUBJECTS.map(subject => ({
    label: timeKey,
    subject
  }));
}

function highlightSelectedCell() {
  const cells = document.querySelectorAll(".plan-cell");
  cells.forEach(cell => {
    const active =
      cell.dataset.view === currentView &&
      cell.dataset.time === currentTime &&
      cell.dataset.subject === currentSubject;

    cell.classList.toggle("active", active);
  });
}

async function loadCellToEditorFromState() {
  document.getElementById("editorTitle").textContent =
    `${getViewLabel(currentView)}｜${currentTime}｜${subjectLabels[currentSubject] || currentSubject}`;

  const { data, error } = await db
    .from("study_plan_cells")
    .select("content")
    .eq("view_mode", currentView)
    .eq("time_key", currentTime)
    .eq("subject_key", currentSubject)
    .limit(1);

  if (error) {
    alert("讀取失敗：" + error.message);
    return;
  }

  const row = data && data.length > 0 ? data[0] : null;
  document.getElementById("contentInput").value = row?.content || "";
}

async function saveCurrentCell() {
  const content = document.getElementById("contentInput").value.trim();

  const payload = {
    view_mode: currentView,
    time_key: currentTime,
    subject_key: currentSubject,
    content
  };

  const { error } = await db
    .from("study_plan_cells")
    .upsert(payload, { onConflict: "view_mode,time_key,subject_key" });

  if (error) {
    alert("儲存失敗：" + error.message);
    return;
  }

  alert("儲存成功");
}

async function deleteCurrentCell() {
  const ok = confirm(`確定刪除 ${currentTime} 的 ${subjectLabels[currentSubject]} 內容？`);
  if (!ok) return;

  const { error } = await db
    .from("study_plan_cells")
    .delete()
    .eq("view_mode", currentView)
    .eq("time_key", currentTime)
    .eq("subject_key", currentSubject);

  if (error) {
    alert("刪除失敗：" + error.message);
    return;
  }

  document.getElementById("contentInput").value = "";
  alert("刪除成功");
}

async function duplicateCurrentPeriod() {
  const targetTime = getNextTimeKey(currentView, currentTime);
  if (!targetTime) return alert("找不到下一個時間單位");

  const ok = confirm(`把 ${currentTime} 的全部科目複製到 ${targetTime}？`);
  if (!ok) return;

  const { data, error } = await db
    .from("study_plan_cells")
    .select("subject_key, content")
    .eq("view_mode", currentView)
    .eq("time_key", currentTime);

  if (error) return alert("讀取來源失敗：" + error.message);
  if (!data || data.length === 0) return alert("目前這個時間單位沒有資料可複製");

  const rows = data.map(item => ({
    view_mode: currentView,
    time_key: targetTime,
    subject_key: item.subject_key,
    content: item.content
  }));

  const { error: upsertError } = await db
    .from("study_plan_cells")
    .upsert(rows, { onConflict: "view_mode,time_key,subject_key" });

  if (upsertError) return alert("批次複製失敗：" + upsertError.message);

  alert(`已複製到 ${targetTime}`);
}

async function createTemplatesForCurrentPeriod() {
  const ok = confirm(`為 ${currentTime} 建立全部科目的空白模板？`);
  if (!ok) return;

  const rows = SUBJECTS.map(subject => ({
    view_mode: currentView,
    time_key: currentTime,
    subject_key: subject,
    content: ""
  }));

  const { error } = await db
    .from("study_plan_cells")
    .upsert(rows, { onConflict: "view_mode,time_key,subject_key" });

  if (error) return alert("建立模板失敗：" + error.message);

  alert("模板建立完成");
}

async function clearCurrentPeriod() {
  const ok = confirm(`確定清空 ${currentTime} 的全部科目內容？`);
  if (!ok) return;

  const { error } = await db
    .from("study_plan_cells")
    .delete()
    .eq("view_mode", currentView)
    .eq("time_key", currentTime);

  if (error) return alert("清空失敗：" + error.message);

  document.getElementById("contentInput").value = "";
  alert("已清空這個時間單位");
}

function getNextTimeKey(view, timeKey) {
  if (view === "day") {
    const d = parseDayKey(timeKey);
    d.setDate(d.getDate() + 1);
    return formatDayKey(d);
  }

  if (view === "week") {
    const d = parseWeekKey(timeKey);
    d.setDate(d.getDate() + 7);
    return formatWeekKey(d);
  }

  const d = parseMonthKey(timeKey);
  d.setMonth(d.getMonth() + 1);
  return formatMonthKey(d);
}

function getViewLabel(view) {
  if (view === "day") return "日";
  if (view === "week") return "週";
  return "月";
}

function formatDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate() + 0).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function formatMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}/${m}`;
}

function formatWeekKey(date) {
  return formatDayKey(getMonday(date));
}

function parseDayKey(str) {
  const [y, m, d] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function parseWeekKey(str) {
  return parseDayKey(str);
}

function parseMonthKey(str) {
  const [y, m] = str.split("/").map(Number);
  return new Date(y, m - 1, 1);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDaysFromWeekKey(weekKey) {
  const monday = parseWeekKey(weekKey);
  const arr = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    arr.push(formatDayKey(d));
  }
  return arr;
}

function formatDayLabel(date) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${formatDayKey(date)}（週${weekdays[date.getDay()]}）`;
}

function formatWeekLabel(mondayDate) {
  const start = new Date(mondayDate);
  const end = new Date(mondayDate);
  end.setDate(start.getDate() + 6);
  return `${formatDayKey(start)} ~ ${formatDayKey(end)}`;
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}
