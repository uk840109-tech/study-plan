document.addEventListener("DOMContentLoaded", () => {
  const SUPABASE_URL = "https://kdrhyhrumrzmrwdkgnyj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_J2LMtqJMzzte7YYxUSlsCA_bEJuaZZH";

  // ★★★ 這裡換成你的實際 editor GitHub Pages 網址 ★★★
  const EDITOR_URL = "https://uk840109-tech.github.io/study-plan/editor.html";

  if (typeof supabase === "undefined") {
    console.error("找不到 supabase，請先在頁面載入 CDN。");
    return;
  }

  const { createClient } = supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const subjectMeta = [
    { key: "chinese", label: "國文", sub: "" },
    { key: "mathA", label: "數學A", sub: "" },
    { key: "science", label: "自然", sub: "物理 / 化學 / 生物 / 地科" },
    { key: "english", label: "英文", sub: "" },
    { key: "social", label: "社會", sub: "歷史 / 地理 / 公民" },
    { key: "other", label: "其他", sub: "" }
  ];

  const START_DATE = new Date(2026, 4, 1);
  const END_DATE = new Date(2027, 0, 18);
  const EXAM_START = new Date(2027, 0, 16);
  const EXAM_END = new Date(2027, 0, 18);

  let currentView = "month";
  let rowsData = [];
  let lastAutoScrolledView = null;

  const today = new Date();
  const tableHead = document.getElementById("tableHead");
  const tableBody = document.getElementById("tableBody");
  const rangeLabel = document.getElementById("rangeLabel");
  const currentModeLabel = document.getElementById("currentModeLabel");
  const filledCount = document.getElementById("filledCount");
  const avgProgress = document.getElementById("avgProgress");
  const dataStatus = document.getElementById("dataStatus");
  const lastUpdated = document.getElementById("lastUpdated");
  const editorLink = document.getElementById("editorLink");
  const viewButtons = document.querySelectorAll(".view-btn");
  const todayLabelEl = document.getElementById("todayLabel");
  const examCountdownEl = document.getElementById("examCountdown");

  if (!tableHead || !tableBody) {
    console.error("tableHead 或 tableBody 沒找到，請確認 HTML 的 id 有沒有對。");
    return;
  }

  if (editorLink) {
    editorLink.href = EDITOR_URL;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function cloneDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatDayKey(date) {
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  }

  function formatMonthKey(date) {
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}`;
  }

  function parseDayKey(key) {
    const [y, m, d] = key.split("/").map(Number);
    return new Date(y, m - 1, d);
  }

  function isSameDate(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isBetweenInclusive(date, start, end) {
    return date >= start && date <= end;
  }

  function getMonday(date) {
    const d = cloneDate(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function getSunday(date) {
    const monday = getMonday(date);
    const sunday = cloneDate(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  }

  function getMonthRows() {
    const rows = [];
    let y = START_DATE.getFullYear();
    let m = START_DATE.getMonth();

    while (
      y < END_DATE.getFullYear() ||
      (y === END_DATE.getFullYear() && m <= END_DATE.getMonth())
    ) {
      rows.push(`${y}/${pad2(m + 1)}`);

      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }

    return rows;
  }

  function getDayRows() {
    const rows = [];
    const d = cloneDate(START_DATE);

    while (d <= END_DATE) {
      rows.push(formatDayKey(d));
      d.setDate(d.getDate() + 1);
    }

    return rows;
  }

  function buildWeekRows() {
    const rows = [];
    const weekCounters = {};
    let monday = getMonday(START_DATE);

    while (monday <= END_DATE) {
      const reference = cloneDate(monday);
      reference.setDate(reference.getDate() + 3);
      const monthKey = `${reference.getFullYear()}/${pad2(reference.getMonth() + 1)}`;

      if (!weekCounters[monthKey]) {
        weekCounters[monthKey] = 1;
      } else {
        weekCounters[monthKey] += 1;
      }

      const weekIndex = weekCounters[monthKey];
      rows.push(`${monthKey} W${weekIndex}`);

      monday.setDate(monday.getDate() + 7);
    }

    return rows;
  }

  function getRowsByView(view) {
    if (view === "month") return getMonthRows();
    if (view === "week") return buildWeekRows();
    return getDayRows();
  }

  function getRangeText(view) {
    if (view === "month") return "2026/05 → 2027/01（月）";
    if (view === "week") return "2026/05 → 2027/01/18（週）";
    return "2026/05/01 → 2027/01/18（日）";
  }

  function getModeText(view) {
    if (view === "month") return "月計畫";
    if (view === "week") return "週計畫";
    return "日計畫";
  }

  function getTodayDayKey() {
    return formatDayKey(today);
  }

  function getTodayMonthKey() {
    return formatMonthKey(today);
  }

  function getTodayWeekKey() {
    const monday = getMonday(today);
    const weekCounters = {};
    let cursor = getMonday(START_DATE);

    while (cursor <= END_DATE) {
      const reference = cloneDate(cursor);
      reference.setDate(reference.getDate() + 3);
      const monthKey = `${reference.getFullYear()}/${pad2(reference.getMonth() + 1)}`;

      if (!weekCounters[monthKey]) {
        weekCounters[monthKey] = 1;
      } else {
        weekCounters[monthKey] += 1;
      }

      const weekKey = `${monthKey} W${weekCounters[monthKey]}`;

      if (isSameDate(cursor, monday)) {
        return weekKey;
      }

      cursor.setDate(cursor.getDate() + 7);
    }

    return "";
  }

  function renderHead() {
    tableHead.innerHTML = `
      <tr>
        <th class="time-col">時間</th>
        ${subjectMeta.map(subject => `
          <th class="subject-head">
            <strong>${subject.label}</strong>
            <span>${subject.sub || "—"}</span>
          </th>
        `).join("")}
      </tr>
    `;
  }

  function renderBody() {
    const rows = getRowsByView(currentView);
    const map = new Map(rowsData.map(item => [`${item.time_key}|${item.subject_key}`, item]));

    const todayDayKey = getTodayDayKey();
    const todayMonthKey = getTodayMonthKey();
    const todayWeekKey = getTodayWeekKey();

    tableBody.innerHTML = rows.map(row => {
      let rowClass = "";
      let rowLabel = row;

      if (currentView === "day" && row === todayDayKey) {
        rowClass += " time-row-today";
      }

      if (currentView === "month" && row === todayMonthKey) {
        rowClass += " time-row-today";
      }

      if (currentView === "week" && row === todayWeekKey) {
        rowClass += " time-row-today";
      }

      if (currentView === "day") {
        const rowDate = parseDayKey(row);
        if (isBetweenInclusive(rowDate, EXAM_START, EXAM_END)) {
          rowClass += " exam-row";

          const examDayNumber =
            Math.floor((rowDate - EXAM_START) / (1000 * 60 * 60 * 24)) + 1;
          rowLabel = `${row}｜學測 Day ${examDayNumber}`;
        }
      }

      const cells = subjectMeta.map(subject => {
        const item = map.get(`${row}|${subject.key}`);
        const title = item?.title || "未安排";
        const note = item?.note || "尚未填入進度";
        const progress = item?.progress || 0;

        return `
          <td 
            class="plan-cell"
            data-view="${currentView}"
            data-time="${row}"
            data-subject="${subject.key}"
          >
            <div class="cell-card">
              <div class="cell-title">${title}</div>
              <div class="cell-note">${note}</div>
              <div class="cell-progress"><span style="width:${progress}%"></span></div>
            </div>
          </td>
        `;
      }).join("");

      return `
        <tr class="${rowClass.trim()}">
          <th class="time-col time-stamp">${rowLabel}</th>
          ${cells}
        </tr>
      `;
    }).join("");
  }

  function renderStats() {
    const count = rowsData.length;
    const average = count
      ? Math.round(rowsData.reduce((sum, item) => sum + (item.progress || 0), 0) / count)
      : 0;

    if (rangeLabel) rangeLabel.textContent = getRangeText(currentView);
    if (currentModeLabel) currentModeLabel.textContent = getModeText(currentView);
    if (filledCount) filledCount.textContent = count;
    if (avgProgress) avgProgress.textContent = `${average}%`;

    const latest = rowsData
      .map(item => item.updated_at)
      .filter(Boolean)
      .sort()
      .pop();

    if (lastUpdated) {
      lastUpdated.textContent = `最後更新：${latest ? latest.replace("T", " ").slice(0, 16) : "--"}`;
    }

    const todayStr = formatDayKey(today);
    const diffMs = EXAM_START - cloneDate(today);
    const diffDays = diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;

    if (todayLabelEl) {
      todayLabelEl.textContent = `今天：${todayStr}`;
    }

    if (examCountdownEl) {
      examCountdownEl.textContent = `距離學測剩 ${diffDays} 日`;
    }
  }

  function scrollToCurrentRow(force = false) {
    const tableWrap = document.querySelector(".table-wrap");
    if (!tableWrap) return;

    if (!force && lastAutoScrolledView === currentView) return;

    const targetRow = tableWrap.querySelector("tr.time-row-today");
    if (!targetRow) return;

    const rowTop = targetRow.offsetTop;
    const rowHeight = targetRow.offsetHeight;
    const wrapHeight = tableWrap.clientHeight;

    tableWrap.scrollTop = rowTop - wrapHeight / 2 + rowHeight / 2;
    lastAutoScrolledView = currentView;
  }

  function bindEditorLinks() {
    const cells = document.querySelectorAll(".plan-cell");

    cells.forEach(cell => {
      cell.addEventListener("dblclick", () => {
        const view = cell.dataset.view;
        const time = cell.dataset.time;
        const subject = cell.dataset.subject;

        const url = `${EDITOR_URL}?view=${encodeURIComponent(view)}&time=${encodeURIComponent(time)}&subject=${encodeURIComponent(subject)}`;

        console.log("準備跳轉到：", url);
        window.open(url, "_blank");
      });
    });
  }

  function renderAll(forceScroll = false) {
    renderHead();
    renderBody();
    renderStats();
    bindEditorLinks();

    requestAnimationFrame(() => {
      scrollToCurrentRow(forceScroll);
    });
  }

  async function loadRows(forceScroll = false) {
    if (dataStatus) {
      dataStatus.textContent = "載入中";
      dataStatus.classList.remove("warn");
    }

    const { data, error } = await db
      .from("study_plan_cells")
      .select("*")
      .eq("view_mode", currentView);

    console.log("目前 view:", currentView);
    console.log("查詢結果:", data);
    console.log("查詢錯誤:", error);

    if (error) {
      rowsData = [];
      if (dataStatus) {
        dataStatus.textContent = "載入失敗";
        dataStatus.classList.add("warn");
      }
      renderAll(forceScroll);
      return;
    }

    rowsData = data || [];

    if (dataStatus) {
      dataStatus.textContent = rowsData.length ? "已同步資料" : "查無資料";
      if (!rowsData.length) dataStatus.classList.add("warn");
    }

    renderAll(forceScroll);
  }

  viewButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      viewButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view;
      lastAutoScrolledView = null;

      renderAll(true);
      await loadRows(true);
    });
  });

  renderAll(true);
  loadRows(true);
});
