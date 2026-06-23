// ===============================
// World Cup Predictor - app.js
// ===============================

// ✅ Azure Blob Storage base URL
const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

// ✅ Load BOTH group stage and knockout files
const DATA_FILES = [
  "cup.txt",
  "cup_finals.txt",
  "cup_stadiums.csv",
  "quali_playoffs.txt"
];

// ✅ Main app state
let allMatches = [];
let currentFilter = "all";
let currentDay = "";

// ===============================
// Start app
// ===============================
window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  setupButtons();
  await loadMatches();
  populateGameDays();
  renderMatches();
  renderLeaderboard();
}

// ===============================
// Load files from Azure Blob
// ===============================
async function loadMatches() {
  const matchesList = document.getElementById("matches-list");

  if (matchesList) {
    matchesList.innerHTML = "Loading matches...";
  }

  try {
    const responses = await Promise.all(
      DATA_FILES.map(file =>
        fetch(BASE_URL + file + "?cache=" + Date.now())
      )
    );

    for (const response of responses) {
      if (!response.ok) {
        throw new Error("Could not load one of the data files.");
      }
    }

    const texts = await Promise.all(responses.map(response => response.text()));

    const cupMatches = parseMatches(texts[0], "Group Stage");
    const finalsMatches = parseMatches(texts[1], "Knockout Stage");

    allMatches = [...cupMatches, ...finalsMatches];

  } catch (error) {
    console.error(error);

    if (matchesList) {
      matchesList.innerHTML = "Error loading match data.";
    }
  }
}

// ===============================
// Parse cup.txt and cup_finals.txt
// ===============================
function parseMatches(text, defaultStage) {
  const lines = text.split("\n");

  const matches = [];

  let currentStage = defaultStage;
  let currentDayLabel = "";

  lines.forEach(line => {
    const cleanLine = line.trim();

    if (!cleanLine) return;

    // Detect stage headings like:
    // = Round of 32
    // = Final
    if (cleanLine.startsWith("=")) {
      currentStage = cleanLine.replace(/=/g, "").trim();
      return;
    }

    // Detect game day lines like:
    // Sun Jun 28
    // Mon Jun 29
    if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+[A-Z][a-z]{2}\s+\d{1,2}/.test(cleanLine)) {
      currentDayLabel = cleanLine;
      return;
    }

    // Match lines look roughly like:
    // (73) 12:00 UTC-7 2A v 2B @ Los Angeles (Inglewood)
    if (cleanLine.includes("@") && cleanLine.includes(" v ")) {
      const match = parseMatchLine(cleanLine, currentDayLabel, currentStage);

      if (match) {
        matches.push(match);
      }
    }
  });

  return matches;
}

// ===============================
// Parse a single match line
// ===============================
function parseMatchLine(line, dayLabel, stage) {
  const regex = /^\((\d+)\)\s+(\d{1,2}:\d{2})\s+UTC([+-]\d+)\s+(.+?)\s+@\s+(.+)$/;
  const result = line.match(regex);

  if (!result) {
    return null;
  }

  const matchNumber = result[1];
  const time = result[2];
  const utcOffset = Number(result[3]);
  const teamsText = result[4].trim();
  const location = result[5].trim();

  const teams = teamsText.split(/\s+v\s+/);

  const homeTeam = teams[0] ? teams[0].trim() : "Team A";
  const awayTeam = teams[1] ? teams[1].trim() : "Team B";

  const dateObj = buildMatchDate(dayLabel, time, utcOffset);

  // ✅ Played if score exists OR match has already started
  const hasScore = /\d+\s*-\s*\d+/.test(line);
  const hasStarted = dateObj ? dateObj <= new Date() : false;

  return {
    id: matchNumber,
    raw: line,
    day: dayLabel || "Unknown day",
    stage,
    time,
    utcOffset,
    homeTeam,
    awayTeam,
    location,
    dateObj,
    played: hasScore || hasStarted
  };
}

// ===============================
// Convert schedule text into Date
// ===============================
function buildMatchDate(dayLabel, time, utcOffset) {
  if (!dayLabel || !time) return null;

  const parts = dayLabel.split(" ");

  // Example: Sun Jun 28
  if (parts.length < 3) return null;

  const monthText = parts[1];
  const dayNumber = Number(parts[2]);

  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
  };

  const month = monthMap[monthText];

  if (month === undefined) return null;

  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  // World Cup 2026
  const year = 2026;

  // If match says 12:00 UTC-7, UTC time is 19:00.
  const utcHour = hour - utcOffset;

  return new Date(Date.UTC(year, month, dayNumber, utcHour, minute));
}

// ===============================
// Populate game day dropdown
// ===============================
function populateGameDays() {
  const select = document.getElementById("game-day-select");

  if (!select) return;

  const days = [...new Set(allMatches.map(match => match.day))];

  select.innerHTML = `<option value="">All game days</option>`;

  days.forEach(day => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    currentDay = select.value;
    renderMatches();
  });
}

// ===============================
// Render matches
// ===============================
function renderMatches() {
  const container = document.getElementById("matches-list");

  if (!container) return;

  container.innerHTML = "";

  let matches = [...allMatches];

  if (currentFilter === "played") {
    matches = matches.filter(match => match.played);
  }

  if (currentFilter === "unplayed") {
    matches = matches.filter(match => !match.played);
  }

  if (currentDay) {
    matches = matches.filter(match => match.day === currentDay);
  }

  if (matches.length === 0) {
    container.innerHTML = "<p>No matches found for this filter.</p>";
    return;
  }

  matches.forEach(match => {
    const savedPrediction = getPredictionForMatch(match.id);

    const card = document.createElement("div");
    card.className = "match-card";

    card.style.padding = "12px";
    card.style.marginBottom = "10px";
    card.style.borderRadius = "8px";
    card.style.border = "1px solid #ddd";
    card.style.background = match.played ? "#e6f4ea" : "#fff7e6";

    card.innerHTML = `
      <div style="font-size:12px;color:#666;margin-bottom:4px;">
        ${match.stage} • ${match.day} • ${match.time} UTC${match.utcOffset >= 0 ? "+" + match.utcOffset : match.utcOffset}
      </div>

      <div style="font-weight:700;margin-bottom:6px;">
        Match ${match.id}: ${match.homeTeam} v ${match.awayTeam}
      </div>

      <div style="font-size:13px;color:#555;margin-bottom:8px;">
        Location: ${match.location}
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label>
          ${match.homeTeam}
          <input
            type="number"
            min="0"
            class="prediction-input"
            data-match-id="${match.id}"
            data-side="home"
            value="${savedPrediction?.home ?? ""}"
            ${match.played ? "disabled" : ""}
            style="width:60px;padding:6px;margin-left:4px;"
          />
        </label>

        <span>-</span>

        <label>
          <input
            type="number"
            min="0"
            class="prediction-input"
            data-match-id="${match.id}"
            data-side="away"
            value="${savedPrediction?.away ?? ""}"
            ${match.played ? "disabled" : ""}
            style="width:60px;padding:6px;margin-right:4px;"
          />
          ${match.awayTeam}
        </label>

        <span style="font-size:12px;color:${match.played ? "#237a3b" : "#b56b00"};">
          ${match.played ? "Played / started" : "Unplayed"}
        </span>
      </div>
    `;

    container.appendChild(card);
  });
}

// ===============================
// Setup buttons
// ===============================
function setupButtons() {
  const allButton = document.getElementById("filter-all");
  const playedButton = document.getElementById("filter-played");
  const unplayedButton = document.getElementById("filter-unplayed");
  const savePredictionsButton = document.getElementById("save-predictions");
  const saveResultsButton = document.getElementById("save-results");

  if (allButton) {
    allButton.addEventListener("click", () => {
      currentFilter = "all";
      renderMatches();
    });
  }

  if (playedButton) {
    playedButton.addEventListener("click", () => {
      currentFilter = "played";
      renderMatches();
    });
  }

  if (unplayedButton) {
    unplayedButton.addEventListener("click", () => {
      currentFilter = "unplayed";
      renderMatches();
    });
  }

  if (savePredictionsButton) {
    savePredictionsButton.addEventListener("click", savePredictions);
  }

  if (saveResultsButton) {
    saveResultsButton.addEventListener("click", savePredictions);
  }
}

// ===============================
// Save predictions
// ===============================
function savePredictions() {
  const nameInput = document.getElementById("predictor-name");
  const predictorName = nameInput ? nameInput.value.trim() : "";

  if (!predictorName) {
    alert("Please enter your predictor name first.");
    return;
  }

  const inputs = document.querySelectorAll(".prediction-input");

  const predictions = getAllPredictions();

  if (!predictions[predictorName]) {
    predictions[predictorName] = {};
  }

  inputs.forEach(input => {
    const matchId = input.dataset.matchId;
    const side = input.dataset.side;
    const value = input.value;

    if (!predictions[predictorName][matchId]) {
      predictions[predictorName][matchId] = {};
    }

    predictions[predictorName][matchId][side] = value;
  });

  localStorage.setItem("worldCupPredictions", JSON.stringify(predictions));

  alert("Predictions saved.");
  renderLeaderboard();
}

// ===============================
// Get saved prediction for current user
// ===============================
function getPredictionForMatch(matchId) {
  const nameInput = document.getElementById("predictor-name");
  const predictorName = nameInput ? nameInput.value.trim() : "";

  if (!predictorName) return null;

  const predictions = getAllPredictions();

  return predictions[predictorName]?.[matchId] || null;
}

// ===============================
// Get all saved predictions
// ===============================
function getAllPredictions() {
  const saved = localStorage.getItem("worldCupPredictions");

  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

// ===============================
// Leaderboard
// ===============================
function renderLeaderboard() {
  const leaderboard = document.getElementById("leaderboard-list");

  if (!leaderboard) return;

  const predictions = getAllPredictions();
  const names = Object.keys(predictions);

  if (names.length === 0) {
    leaderboard.innerHTML = "<p>No predictions saved yet.</p>";
    return;
  }

  leaderboard.innerHTML = "";

  names.forEach(name => {
    const matchCount = Object.keys(predictions[name]).length;

    const row = document.createElement("div");
    row.style.padding = "8px";
    row.style.borderBottom = "1px solid #ddd";

    row.innerHTML = `
      <strong>${name}</strong>
      <span style="color:#666;"> — ${matchCount} prediction(s) saved</span>
    `;

    leaderboard.appendChild(row);
  });
}
``
