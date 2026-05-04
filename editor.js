const SUPABASE_URL = "https://kdrhyhrumrzmrwdkgnyj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_J2LMtqJMzzte7YYxUSlsCA_bEJuaZZH";
const PASSWORD = "zhao01092008";
const VIEWER_URL = "./";

const subjectLabelMap = {
  chinese: "國文",
  mathA: "數學A",
  science: "自然",
  english: "英文",
  social: "社會",
  other: "其他"
};

const START_DATE = new Date(2026, 4, 1);
const END_DATE = new Date(2027, 0, 18);

let db = null;
let currentView = "month";
let currentRecord = null;
let selectedTimeKey = "";
let calendarCursor = new Date(2026, 4, 1);
let selectedDateForCalendar = null;

window.addEventListener("load", () => {
  bindLogin();
});

function bindLogin() {
  const loginBtn = document.getElementById("loginBtn");
  const passwordInput = document.getElementById("passwordInput");

  loginBtn.addEventListener("click", tryLogin);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
}

function tryLogin() {
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

  if (!window.supabase) {
    loginError.textContent = "找不到 Supabase CDN";
    return;
  }

  const { createClient } = window.supabase;
  db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  loginError.textContent = "";
  loginScreen.classList.add("hidden");
  loginScreen.style.display = "none";
  appShell.style.display = "block";

  initEditorApp();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDate(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayKey(date) {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function formatMonthKey(date) {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}`;
}

function parseDayKey(str) {
  const [y, m, d] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function parseMonthKey(str) {
  const [y, m] = str.split("/").map(Number);
  return new Date(y, m - 1, 1);
}

function getMonday(date) {
  const d = cloneDate(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getThursday(date) {
  const monday = getMonday(date);
  monday.setDate(monday.getDate() + 3);
  return monday;
}

function isDateInRange(date) {
  const d = cloneDate(date);
  return d >= START_DATE && d <= END_DATE;
}

function getMonthList() {
  const result = [];
  let y = START_DATE.getFullYear();
  let m = START_DATE.getMonth();

  while (
    y < END_DATE.getFullYear() ||
    (y === END_DATE.getFullYear() && m <= END_DATE.getMonth())
  ) {
    result.push(`${y}/${pad2(m + 1)}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return result;
}

function getWeekKeyFromDate(date) {
  const thursday = getThursday(date);
  const monthKey = formatMonthKey(thursday);

  let monday = getMonday(START_DATE);
  let count = 0;

  while (monday <= END_DATE) {
    const thisThursday = getThursday(monday);
    const thisMonthKey = formatMonthKey(thisThursday);

    if (thisMonthKey === monthKey) {
      count += 1;
    }

    if (sameDate(monday, getMonday(date))) {
      return `${monthKey} W${count}`;
    }

    monday.setDate(monday.getDate() + 7);
  }

  return `${monthKey} W1`;
}

function getWeekDates(date) {
  const monday = getMonday(date);
  const arr = [];
  for (let i = 0; i < 7; i++) {
    const d = cloneDate(monday);
    d.setDate(monday.getDate() + i);
    arr.push(d);
  }
  return arr;
}

function monthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getSubjectLabel(key) {
  return subjectLabelMap[key] || key;
}

function initEditorApp() {
  document.getElementById("viewerLink").href = VIEWER_URL;

  bindControls();
  renderMonthCards();
  applyUrlParams();
  syncPickerVisibility();
  syncSelectedSummary();
  syncCurrentCellLabel();
  setStatus("尚未儲存");
}

function bindControls() {
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view;
      clearCurrentRecord();
      syncPickerVisibility();
      syncSelectedSummary();
      syncCurrentCellLabel();
      updateDateHint();
    });
  });

  document.getElementById("subjectSelect").addEventListener("change", () => {
    clearCurrentRecord(false);
    syncSelectedSummary();
    syncCurrentCellLabel();
  });

  document.getElementById("loadCellBtn").addEventListener("click", loadCell);
  document.getElementById("editForm").addEventListener("submit", saveCell);
  document.getElementById("deleteBtn").addEventListener("click", deleteCell);

  document.getElementById("progressInput").addEventListener("input", (e) => {
    document.getElementById("progressLabel").textContent = `${e.target.value}%`;
  });

  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    const next = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    if (next < new Date(START_DATE.getFullYear(), START_DATE.getMonth(), 1)) return;
    calendarCursor = next;
    renderCalendar();
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    const next = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    const maxMonth = new Date(END_DATE.getFullYear(), END_DATE.getMonth(), 1);
    if (next > maxMonth) return;
    calendarCursor = next;
    renderCalendar();
  });
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const time = params.get("time");
  const subject = params.get("subject");

  if (view && ["month", "week", "day"].includes(view)) {
    currentView = view;
    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }

  if (subject) {
    const subjectSelect = document.getElementById("subjectSelect");
    if (subjectSelect.querySelector(`option[value="${subject}"]`)) {
      subjectSelect.value = subject;
    }
  }

  if (time) {
    selectedTimeKey = time;

    if (currentView === "month") {
      const parsedMonth = parseMonthKey(time);
      calendarCursor = parsedMonth;
    }

    if (currentView === "day") {
      selectedDateForCalendar = parseDayKey(time);
      calendarCursor = new Date(
        selectedDateForCalendar.getFullYear(),
        selectedDateForCalendar.getMonth(),
        1
      );
    }

    if (currentView === "week") {
      const match = time.match(/^(\d{4})\/(\d{2}) W(\d+)$/);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]) - 1;
        const weekNum = Number(match[3]);

        const monday = findMondayByMonthWeek(y, m, weekNum);
        if (monday) {
          selectedDateForCalendar = monday;
          calendarCursor = new Date(monday.getFullYear(), monday.getMonth(), 1);
        }
      }
    }
  }

  updateDateHint();
  renderMonthCards();
  renderCalendar();
}

function findMondayByMonthWeek(year, monthIndex, weekNum) {
  let monday = getMonday(START_DATE);
  let count = 0;

  while (monday <= END_DATE) {
    const thursday = getThursday(monday);
    if (thursday.getFullYear() === year && thursday.getMonth() === monthIndex) {
      count += 1;
      if (count === weekNum) return cloneDate(monday);
    }
    monday.setDate(monday.getDate() + 7);
  }

  return null;
}

function clearCurrentRecord(clearForm = true) {
  currentRecord = null;
  setStatus("尚未儲存");
  if (clearForm) fillForm(null);
  document.getElementById("debugBox").textContent = "尚未載入";
}

function syncPickerVisibility() {
  const monthPickerSection = document.getElementById("monthPickerSection");
  const calendarSection = document.getElementById("calendarSection");

  if (currentView === "month") {
    monthPickerSection.style.display = "block";
    calendarSection.style.display = "none";
    renderMonthCards();
  } else {
    monthPickerSection.style.display = "none";
    calendarSection.style.display = "block";
    renderCalendar();
  }

  updateDateHint();
}

function updateDateHint() {
  const hint = document.getElementById("dateHint");
  if (currentView === "day") {
    hint.textContent = "日模式：點某一天，time_key 會是 YYYY/MM/DD。";
  } else if (currentView === "week") {
    hint.textContent = "週模式：點某一天後，會自動轉成該週的 YYYY/MM Wn。";
  } else {
    hint.textContent = "月模式：點月份卡片，time_key 會是 YYYY/MM。";
  }
}

function renderMonthCards() {
  const grid = document.getElementById("monthCardGrid");
  const months = getMonthList();

  grid.innerHTML = months.map(month => {
    const active = selectedTimeKey === month && currentView === "month" ? "active" : "";
    return `<button type="button" class="month-card ${active}" data-month="${month}">${month}</button>`;
  }).join("");

  grid.querySelectorAll(".month-card").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTimeKey = btn.dataset.month;
      clearCurrentRecord();
      renderMonthCards();
      syncSelectedSummary();
      syncCurrentCellLabel();
    });
  });
}

function renderCalendar() {
  const title = document.getElementById("calendarTitle");
  const grid = document.getElementById("calendarGrid");
  title.textContent = monthTitle(calendarCursor);
  grid.innerHTML = "";

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const firstGridDate = new Date(year, month, 1 - startWeekday);

  const today = new Date();

  for (let i = 0; i < 42; i++) {
    const d = new Date(firstGridDate.getFullYear(), firstGridDate.getMonth(), firstGridDate.getDate() + i);
    const inMonth = d.getMonth() === month;
    const inRange = isDateInRange(d);

    const isToday = sameDate(d, today);
    const isSelectedDay = currentView === "day" && selectedDateForCalendar && sameDate(d, selectedDateForCalendar);

    let isWeekSelected = false;
    if (currentView === "week" && selectedDateForCalendar) {
      const weekDates = getWeekDates(selectedDateForCalendar);
      isWeekSelected = weekDates.some(x => sameDate(x, d));
    }

    const classes = [
      "calendar-day",
      inMonth ? "" : "muted",
      isToday ? "today" : "",
      isSelectedDay ? "selected" : "",
      isWeekSelected ? "week-selected" : ""
    ].filter(Boolean).join(" ");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = classes;
    btn.innerHTML = `<span class="day-number">${d.getDate()}</span>`;
    btn.disabled = !inRange;
    if (!inRange) btn.classList.add("muted");

    btn.addEventListener("click", () => {
      if (!inRange) return;

      selectedDateForCalendar = cloneDate(d);

      if (currentView === "day") {
        selectedTimeKey = formatDayKey(d);
      } else if (currentView === "week") {
        selectedTimeKey = getWeekKeyFromDate(d);
      }

      clearCurrentRecord();
      renderCalendar();
      syncSelectedSummary();
      syncCurrentCellLabel();
    });

    grid.appendChild(btn);
  }
}

function syncSelectedSummary() {
  const box = document.getElementById("selectedSummary");
  const subjectKey = document.getElementById("subjectSelect").value;
  const subjectLabel = getSubjectLabel(subjectKey);

  if (!selectedTimeKey) {
    box.textContent = `目前：尚未選擇時間 / ${subjectLabel}`;
    return;
  }

  box.textContent = `目前選擇：${getViewLabel(currentView)} / ${selectedTimeKey} / ${subjectLabel}`;
}

function getViewLabel(view) {
  if (view === "day") return "日視圖";
  if (view === "week") return "週視圖";
  return "月視圖";
}

function syncCurrentCellLabel() {
  const label = document.getElementById("currentCellLabel");
  const subjectKey = document.getElementById("subjectSelect").value;
  const subjectLabel = getSubjectLabel(subjectKey);

  if (!selectedTimeKey) {
    label.textContent = "尚未選擇格子";
    return;
  }

  label.textContent = `${getViewLabel(currentView)} / ${selectedTimeKey} / ${subjectLabel}`;
}

function setStatus(text, type = "idle") {
  const chip = document.getElementById("saveStatus");
  chip.textContent = text;
  chip.classList.remove("warn", "ok");
  if (type === "warn") chip.classList.add("warn");
  if (type === "ok") chip.classList.add("ok");
}

function fillForm(data) {
  currentRecord = data;
  document.getElementById("titleInput").value = data?.title || "";
  document.getElementById("noteInput").value = data?.note || "";
  document.getElementById("levelInput").value = data?.level?.toString() || "1";
  document.getElementById("progressInput").value = data?.progress?.toString() || "0";
  document.getElementById("progressLabel").textContent = `${document.getElementById("progressInput").value}%`;
  document.getElementById("debugBox").textContent = data ? JSON.stringify(data, null, 2) : "尚未載入";
}

async function loadCell() {
  if (!selectedTimeKey) {
    alert("請先選擇日期 / 週次 / 月份。");
    return;
  }

  const subjectKey = document.getElementById("subjectSelect").value;

  setStatus("讀取中…");
  document.getElementById("debugBox").textContent = "讀取中…";

  const { data, error } = await db
    .from("study_plan_cells")
    .select("*")
    .eq("view_mode", currentView)
    .eq("time_key", selectedTimeKey)
    .eq("subject_key", subjectKey)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    setStatus("讀取失敗", "warn");
    document.getElementById("debugBox").textContent = "讀取失敗：\n" + JSON.stringify(error, null, 2);
    return;
  }

  syncCurrentCellLabel();

  if (!data) {
    setStatus("目前沒有資料（將會新增）", "warn");
    fillForm(null);
  } else {
    setStatus("已載入資料", "ok");
    fillForm(data);
  }
}

async function saveCell(e) {
  e.preventDefault();

  if (!selectedTimeKey) {
    alert("請先選擇日期 / 週次 / 月份。");
    return;
  }

  const subjectKey = document.getElementById("subjectSelect").value;
  const payload = {
    view_mode: currentView,
    time_key: selectedTimeKey,
    subject_key: subjectKey,
    title: document.getElementById("titleInput").value.trim() || null,
    note: document.getElementById("noteInput").value.trim() || null,
    level: Number(document.getElementById("levelInput").value) || 1,
    progress: Number(document.getElementById("progressInput").value) || 0
  };

  setStatus("儲存中…");
  document.getElementById("debugBox").textContent = "儲存中…";

  if (currentRecord && currentRecord.id) {
    const { data, error } = await db
      .from("study_plan_cells")
      .update(payload)
      .eq("id", currentRecord.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error(error);
      setStatus("儲存失敗", "warn");
      document.getElementById("debugBox").textContent = "儲存失敗：\n" + JSON.stringify(error, null, 2);
      return;
    }

    setStatus("已更新", "ok");
    fillForm(data);
  } else {
    const { data, error } = await db
      .from("study_plan_cells")
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.error(error);
      setStatus("新增失敗", "warn");
      document.getElementById("debugBox").textContent = "新增失敗：\n" + JSON.stringify(error, null, 2);
      return;
    }

    setStatus("新增成功", "ok");
    fillForm(data);
  }
}

async function deleteCell() {
  if (!selectedTimeKey) {
    alert("請先選擇要刪除的格子。");
    return;
  }

  const subjectKey = document.getElementById("subjectSelect").value;

  if (!confirm("確定要刪除此格資料嗎？")) return;

  setStatus("刪除中…");
  document.getElementById("debugBox").textContent = "刪除中…";

  const { error } = await db
    .from("study_plan_cells")
    .delete()
    .eq("view_mode", currentView)
    .eq("time_key", selectedTimeKey)
    .eq("subject_key", subjectKey);

  if (error) {
    console.error(error);
    setStatus("刪除失敗", "warn");
    document.getElementById("debugBox").textContent = "刪除失敗：\n" + JSON.stringify(error, null, 2);
    return;
  }

  setStatus("已刪除", "ok");
  fillForm(null);
}
