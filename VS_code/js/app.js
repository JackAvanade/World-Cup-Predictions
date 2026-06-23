// ===============================
// World Cup Predictor - FULL BUILD
// ===============================

const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

let allMatches = [];
let currentFilter = "all";
let currentDay = "";
let predictions = loadPredictions();

// ===============================
// INIT
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  setupButtons();
  await loadMatches();
  sortMatches();
  populateGameDays();
  renderMatches();
  renderLeaderboard();
});

// ===============================
// LOAD DATA
// ===============================
async function loadMatches() {
  const container = document.getElementById("matches-list");
  container.innerHTML = "Loading matches...";

  try {
    const [cupRes, finalsRes] = await Promise.all([
      fetch(BASE_URL + "cup.txt?cache=" + Date.now()),
      fetch(BASE_URL + "cup_finals.txt?cache=" + Date.now())
    ]);

    const cupText = await cupRes.text();
    const finalsText = await finalsRes.text();

    const groupMatches = parseMatches(cupText, "Group Stage");
    const knockoutMatches = parseMatches(finalsText, "Knockout");

    allMatches = [...groupMatches, ...knockoutMatches];

  } catch (err) {
    console.error(err);
    container.innerHTML = "Error loading matches";
  }
}

// ===============================
// SORT MATCHES
// ===============================
function sortMatches() {
  allMatches.sort((a, b) => {
    const t1 = a.dateObj ? a.dateObj.getTime() : Infinity;
    const t2 = b.dateObj ? b.dateObj.getTime() : Infinity;
    return t1 - t2;
  });
}

// ===============================
// PARSE MATCHES
// ===============================
function parseMatches(text, defaultStage) {
  const lines = text.split("\n");

  let stage = defaultStage;
  let day = "";

  const matches = [];

  lines.forEach(line => {
    const clean = line.trim();
    if (!clean) return;

    const d = clean.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\w+)\s+(\d{1,2})/i);
    if (d) {
      day = `${d[1]} ${d[2].substring(0,3)} ${d[3]}`;
    }

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
// PARSE SINGLE MATCH
// ===============================
function parseMatch(line, day, stage) {
  const parts = line.split("@");
  if (parts.length < 2) return null;

  const left = parts[0].trim();
  const location = parts[1].trim();

  const timeMatch = left.match(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/);

  let time = "";
  let offset = 0;
  let teams = left;

  if (timeMatch) {
    time = timeMatch[1];
    offset = Number(timeMatch[2]);

    teams = left
      .replace(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/, "")
      .replace(/\(\d+\)/, "")
      .trim();
  }

  const [home, away] = teams.split(/\s+v\s+|\s+vs\s+/i);

  const dateObj = buildDate(day, time, offset);

  return {
    id: Math.random().toString(36).slice(2),
    homeTeam: home?.trim(),
    awayTeam: away?.trim(),
    day,
    stage,
    time,
    utcOffset: offset,
    location,
    dateObj,
    played: dateObj ? dateObj <= new Date() : false
  };
}

// ===============================
// BUILD DATE
// ===============================
function buildDate(day, time, offset) {
  if (!day || !time) return null;

  const parts = day.split(" ");

  const months = {
    Jan:0, Feb:1, Mar:2, Apr:3, May:4,
    Jun:5, Jul:6, Aug:7, Sep:8,
    Oct:9, Nov:10, Dec:11
  };

  const [h,m] = time.split(":");

  return new Date(Date.UTC(
    2026,
    months[parts[1]],
    Number(parts[2]),
    Number(h) - offset,
    Number(m)
  ));
}

// ===============================
// UI - MATCH RENDER
// ===============================
function renderMatches() {
  const container = document.getElementById("matches-list");
  container.innerHTML = "";

  let matches = [...allMatches];

  // Filters
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
      ? `${match.time} UTC${match.utcOffset >= 0 ? "+"+match.utcOffset : match.utcOffset}`
      : "";

    const user = document.getElementById("predictor-name").value;

    const saved = predictions[user]?.[match.id] || {};

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:20px;">
        
        <div>
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
          <input value="${saved.home || ""}" type="number" data-id="${match.id}" data-side="home" style="width:50px;">
          <span>-</span>
          <input value="${saved.away || ""}" type="number" data-id="${match.id}" data-side="away" style="width:50px;">
        </div>

      </div>
    `;

    container.appendChild(card);
  });
}

// ===============================
// BUTTONS
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

  document.getElementById("save-predictions").onclick = savePredictions;
}

// ===============================
// PREDICTIONS
// ===============================
function savePredictions() {
  const name = document.getElementById("predictor-name").value;
  if (!name) return alert("Enter a name");

  if (!predictions[name]) predictions[name] = {};

  document.querySelectorAll("input[type=number]").forEach(input => {
    const id = input.dataset.id;
    const side = input.dataset.side;

    if (!predictions[name][id]) predictions[name][id] = {};

    predictions[name][id][side] = input.value;
  });

  localStorage.setItem("predictions", JSON.stringify(predictions));
  renderLeaderboard();
}

function loadPredictions() {
  return JSON.parse(localStorage.getItem("predictions") || "{}");
}

// ===============================
// LEADERBOARD
// ===============================
function renderLeaderboard() {
  const box = document.getElementById("leaderboard-list");

  const names = Object.keys(predictions);

  if (!names.length) {
    box.innerHTML = "No predictions yet.";
    return;
  }

  box.innerHTML = names.map(n => {
    const count = Object.keys(predictions[n]).length;
    return `<div><b>${n}</b> — ${count} predictions</div>`;
  }).join("");
}

// ===============================
// DROPDOWN
// ===============================
function populateGameDays() {
