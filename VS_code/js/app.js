// ===============================
// World Cup Predictor - app.js
// ===============================

const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

let allMatches = [];
let currentFilter = "all";
let currentDay = "";

window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  setupButtons();
  await loadMatches();
  sortMatches();
  populateGameDays();
  renderMatches();
}

// ===============================
// Load matches
// ===============================
async function loadMatches() {
  const [cupRes, finalsRes] = await Promise.all([
    fetch(BASE_URL + "cup.txt"),
    fetch(BASE_URL + "cup_finals.txt")
  ]);

  const cupText = await cupRes.text();
  const finalsText = await finalsRes.text();

  allMatches = [
    ...parseMatches(cupText, "Group Stage"),
    ...parseMatches(finalsText, "Knockout")
  ];
}

// ===============================
// Sort matches safely
// ===============================
function sortMatches() {
  allMatches.sort((a, b) => {
    const aTime = a.dateObj ? a.dateObj.getTime() : Infinity;
    const bTime = b.dateObj ? b.dateObj.getTime() : Infinity;
    return aTime - bTime;
  });
}

// ===============================
// Parse matches
// ===============================
function parseMatches(text, defaultStage) {
  const lines = text.split("\n");

  let stage = defaultStage;
  let day = "";

  const matches = [];

  lines.forEach(line => {
    const clean = line.trim();
    if (!clean) return;

    // Detect day anywhere in line
    const dateMatch = clean.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\w+)\s+(\d{1,2})/i);
    if (dateMatch) {
      day = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`;
    }

    // Detect stage
    if (clean.startsWith("=")) {
      stage = clean.replace(/=/g, "").trim();
      return;
    }

    if (clean.includes("@") && (clean.includes(" v ") || /\d-\d/.test(clean))) {
      const match = parseMatch(clean, day, stage);
      if (match) matches.push(match);
    }
  });

  return matches;
}

// ===============================
// Parse one match
// ===============================
function parseMatch(line, day, stage) {
  const parts = line.split("@");
  if (parts.length < 2) return null;

  const left = parts[0].trim();
  const location = parts[1].trim();

  // time
  const timeMatch = left.match(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/);
  let time = "";
  let utcOffset = 0;
  let teamsText = left;

  if (timeMatch) {
    time = timeMatch[1];
    utcOffset = Number(timeMatch[2]);

    teamsText = left
      .replace(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/, "")
      .replace(/\(\d+\)/, "")
      .trim();
  }

  let home = "";
  let away = "";

  const vsSplit = teamsText.split(/\s+v\s+|\s+vs\s+/i);

  if (vsSplit.length >= 2) {
    home = vsSplit[0].trim();
    away = vsSplit[1].trim();
  }

  const dateObj = buildDate(day, time, utcOffset);

  return {
    id: Math.random().toString(36).slice(2),
    homeTeam: home,
    awayTeam: away,
    day,
    stage,
    time,
    utcOffset,
    location,
    dateObj,
    played: dateObj ? dateObj <= new Date() : false
  };
}

// ===============================
// Build Date
// ===============================
function buildDate(day, time, offset) {
  if (!day || !time) return null;

  const parts = day.split(" ");
  if (parts.length < 3) return null;

  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const month = monthMap[parts[1]];
  const dayNum = Number(parts[2]);

  const [h, m] = time.split(":");

  return new Date(Date.UTC(2026, month, dayNum, Number(h) - offset, Number(m)));
}

// ===============================
// Dropdown
// ===============================
function populateGameDays() {
  const select = document.getElementById("game-day-select");

  const days = [...new Set(allMatches.map(m => m.day))];

  select.innerHTML = `<option value="">All days</option>`;

  days.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });

  select.onchange = () => {
    currentDay = select.value;
    renderMatches();
  };
}

// ===============================
// Render matches (✅ NICE UI)
// ===============================
function renderMatches() {
  const container = document.getElementById("matches-list");
  container.innerHTML = "";

  let matches = [...allMatches];

  if (currentFilter === "played") {
    matches = matches.filter(m => m.played);
  } else if (currentFilter === "unplayed") {
    matches = matches.filter(m => !m.played);
  }

  if (currentDay) {
    matches = matches.filter(m => m.day === currentDay);
  }

  matches.forEach(match => {
    const card = document.createElement("div");

    card.style.padding = "16px";
    card.style.marginBottom = "10px";
    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "8px";
    card.style.background = match.played ? "#e6f4ea" : "#fff7e6";

    const timeText = match.time
      ? `${match.time} UTC${match.utcOffset >= 0 ? "+" + match.utcOffset : match.utcOffset}`
      : "";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;">
        
        <div style="flex:1;">
          <div style="font-size:12px;color:#666;">
            ${match.stage} • ${match.day}
          </div>

          <div style="font-size:20px;font-weight:bold;">
            ${match.homeTeam} vs ${match.awayTeam}
          </div>

          <div style="font-size:12px;color:#666;">
            ${timeText} • ${match.location}
          </div>
        </div>

        <div style="display:flex;gap:6px;">
          <input type="number" min="0" style="width:50px;text-align:center;">
          <span>-</span>
          <input type="number" min="0" style="width:50px;text-align:center;">
        </div>

      </div>
    `;

    container.appendChild(card);
  });
}

// ===============================
// Buttons
// ===============================
function setupButtons() {
  document.getElementById("filter-all").onclick = () => {
    currentFilter = "all";
    renderMatches();
  };

  document.getElementById("filter-played").onclick = () => {
    currentFilter = "played";
    renderMatches();
  };

  document.getElementById("filter-unplayed").onclick = () => {
    currentFilter = "unplayed";
    renderMatches();
  };
}
