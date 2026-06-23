// ===============================
// World Cup Predictor - app.js
// ===============================

// Azure Blob Storage base URL
const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

// Files loaded from Azure Blob
const DATA_FILES = [
  {
    file: "cup.txt",
    label: "Group Stage"
  },
  {
    file: "cup_finals.txt",
    label: "Knockout Stage"
  }
];

// App state
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
  sortAllMatches();
  populateGameDays();
  renderMatches();
  renderLeaderboard();
}

// ===============================
// Load match files from Azure Blob
// ===============================
async function loadMatches() {
  const matchesList = document.getElementById("matches-list");

  if (matchesList) {
    matchesList.innerHTML = "Loading matches...";
  }

  try {
    const loadedFiles = await Promise.all(
      DATA_FILES.map(async item => {
        const response = await fetch(BASE_URL + item.file + "?cache=" + Date.now());

        if (!response.ok) {
          throw new Error(`Could not load ${item.file}`);
        }

        const text = await response.text();

        return {
          label: item.label,
          text
        };
      })
    );

    allMatches = [];

    loadedFiles.forEach(file => {
      const matches = parseMatches(file.text, file.label);
      allMatches = allMatches.concat(matches);
      console.log(`${file.label} matches loaded:`, matches.length);
    });

    console.log("Total matches loaded:", allMatches.length);

  } catch (error) {
    console.error(error);

    if (matchesList) {
      matchesList.innerHTML = `
        <p style="color:red;">
          Error loading match data. Open the browser console with F12 to see the exact issue.
        </p>
      `;
    }
  }
}

// ===============================
// Sort matches chronologically
// ===============================
function sortAllMatches() {
  allMatches.sort((a, b) => {
    const dateA = a.dateObj instanceof Date && !isNaN(a.dateObj) ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.dateObj instanceof Date && !isNaN(b.dateObj) ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    const idA = Number(String(a.id).replace(/\D/g, "")) || 0;
    const idB = Number(String(b.id).replace(/\D/g, "")) || 0;

    return idA - idB;
  });
}

// ===============================
// Parse cup.txt and cup_finals.txt
// ===============================
function parseMatches(text, defaultStage) {
  const lines = text.split("\n");

  const matches = [];

  let currentStage = defaultStage;
  let currentDayLabel = "";
  let fallbackMatchNumber = 1;

  lines.forEach(line => {
    let cleanLine = line.trim();

    if (!cleanLine) return;

    cleanLine = cleanLine
      .replace(/^ï»¿/g, "")
      .replace(/^â.=*/g, "")
      .trim();

    // Detect dates anywhere in the line.
    // Examples:
    // Thu Jun 11
    // Thu June 11
    // ▪ Group A Thu June 11
    // Matchday 1 | Thu Jun 11
    const detectedDay = extractDayLabel(cleanLine);

    if (detectedDay) {
      currentDayLabel = detectedDay;
    }

    // Detect group list lines:
    // Group A | Mexico South Africa South Korea Czech Republic
    const groupListMatch = cleanLine.match(/^Group\s+([A-Z])\s*\|/i);

    if (groupListMatch) {
      currentStage = `Group ${groupListMatch[1].toUpperCase()}`;
      return;
    }

    // Detect bullet group date lines:
    // ▪ Group A Thu June 11
    const bulletGroupMatch = cleanLine.match(/^▪?\s*Group\s+([A-Z])/i);

    if (bulletGroupMatch && detectedDay) {
      currentStage = `Group ${bulletGroupMatch[1].toUpperCase()}`;
      return;
    }

    // Detect headings:
    // = World Cup 2026
    // = Round of 32
    // = Final
    if (cleanLine.startsWith("=")) {
      const heading = cleanLine.replace(/=/g, "").trim();

      if (heading) {
        currentStage = heading;
      }

      return;
    }

    // Detect plain knockout headings
    if (
      /^Round of/i.test(cleanLine) ||
      /^Quarter-final/i.test(cleanLine) ||
      /^Semi-final/i.test(cleanLine) ||
      /^Final/i.test(cleanLine) ||
      /^Match for third place/i.test(cleanLine)
    ) {
      currentStage = cleanLine;
      return;
    }

    // Match lines normally contain:
    // time + teams/result + @ location
    if (cleanLine.includes("@") && /\d{1,2}:\d{2}\s+UTC[+-]\d+/i.test(cleanLine)) {
      const match = parseMatchLine(
        cleanLine,
        currentDayLabel,
        currentStage,
        fallbackMatchNumber
      );

      if (match) {
        matches.push(match);
        fallbackMatchNumber++;
      }
    }
  });

  return matches;
}

// ===============================
// Extract day label from text
// ===============================
function extractDayLabel(line) {
  const dayNames = "(Sun|Mon|Tue|Wed|Thu|Fri|Sat)";
  const monthNames = "(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)";

  // Example:
  // Thu Jun 11
  // Thu June 11
  // Group A Thu June 11
  let match = line.match(new RegExp(`${dayNames}\\s+${monthNames}\\s+(\\d{1,2})`, "i"));

  if (match) {
    return `${normaliseDay(match[1])} ${normaliseMonth(match[2])} ${Number(match[3])}`;
  }

  // Example:
  // Thu 11 Jun
  // Thu 11 June
  match = line.match(new RegExp(`${dayNames}\\s+(\\d{1,2})\\s+${monthNames}`, "i"));

  if (match) {
    return `${normaliseDay(match[1])} ${normaliseMonth(match[3])} ${Number(match[2])}`;
  }

  return "";
}

function normaliseDay(day) {
  return day.slice(0, 1).toUpperCase() + day.slice(1, 3).toLowerCase();
}

function normaliseMonth(month) {
  const map = {
    january: "Jan",
    jan: "Jan",
    february: "Feb",
    feb: "Feb",
    march: "Mar",
    mar: "Mar",
    april: "Apr",
    apr: "Apr",
    may: "May",
    june: "Jun",
    jun: "Jun",
    july: "Jul",
    jul: "Jul",
    august: "Aug",
    aug: "Aug",
    september: "Sep",
    sep: "Sep",
    october: "Oct",
    oct: "Oct",
    november: "Nov",
    nov: "Nov",
    december: "Dec",
    dec: "Dec"
  };

  return map[month.toLowerCase()] || month;
}

// ===============================
// Parse one match line
// ===============================
function parseMatchLine(line, dayLabel, stage, fallbackMatchNumber) {
  const atParts = line.split("@");

  if (atParts.length < 2) {
    return null;
  }

  const leftSide = atParts[0].trim();
  const location = atParts.slice(1).join("@").trim();

  const matchNumberMatch = leftSide.match(/\((\d+)\)/);

  const matchNumber = matchNumberMatch
    ? matchNumberMatch[1]
    : `${stage.replace(/\s+/g, "-")}-${fallbackMatchNumber}`;

  const timeMatch = leftSide.match(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/i);

  let time = "";
  let utcOffset = 0;
  let teamsText = leftSide;

  if (timeMatch) {
    time = timeMatch[1];
    utcOffset = Number(timeMatch[2]);

    teamsText = leftSide
      .replace(/\((\d+)\)/, "")
      .replace(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/i, "")
      .trim();
  }

  let homeTeam = "";
  let awayTeam = "";
  let score = "";

  // Fixture format:
  // Team A v Team B
  // Team A vs Team B
  const fixtureSplit = teamsText.split(/\s+v\s+|\s+vs\s+/i);

  if (fixtureSplit.length >= 2) {
    homeTeam = fixtureSplit[0].trim();
    awayTeam = fixtureSplit.slice(1).join(" v ").trim();
  } else {
    // Result format:
    // Mexico 2-0 South Africa
    // Mexico 2-0 (1-0) South Africa
    const resultMatch = teamsText.match(/^(.+?)\s+(\d+\s*-\s*\d+)(?:\s+\([^)]+\))?\s+(.+)$/);

    if (resultMatch) {
      homeTeam = resultMatch[1].trim();
      score = resultMatch[2].replace(/\s+/g, "");
      awayTeam = resultMatch[3].trim();
    } else {
      return null;
    }
  }

  const dateObj = buildMatchDate(dayLabel, time, utcOffset);

  const hasScore = score !== "" || /\b\d+\s*-\s*\d+\b/.test(line);
  const hasStarted = dateObj ? dateObj <= new Date() : false;

  return {
    id: matchNumber,
    raw: line,
    day: dayLabel || "Unknown day",
    stage: stage || "Unknown stage",
    time,
    utcOffset,
    homeTeam,
    awayTeam,
    score,
    location,
    dateObj,
    played: hasScore || hasStarted
  };
}

// ===============================
// Convert text date/time to Date
// ===============================
function buildMatchDate(dayLabel, time, utcOffset) {
  if (!dayLabel || !time) return null;

  const parts = dayLabel.split(" ");

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

  const year = 2026;

  // Example:
  // 12:00 UTC-7 means 19:00 UTC
  const utcHour = hour - utcOffset;

  return new Date(Date.UTC(year, month, dayNumber, utcHour, minute));
}

// ===============================
// Populate game day dropdown
// ===============================
function populateGameDays() {
  const select = document.getElementById("game-day-select");

  if (!select) return;

  const days = [...new Set(allMatches.map(match => match.day))]
    .sort((a, b) => {
      const dateA = getDaySortDate(a);
      const dateB = getDaySortDate(b);
      return dateA - dateB;
    });

  select.innerHTML = `<option value="">All days</option>`;

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

function getDaySortDate(dayLabel) {
  if (!dayLabel || dayLabel === "Unknown day") {
    return Number.MAX_SAFE_INTEGER;
  }

  const parts = dayLabel.split(" ");

  if (parts.length < 3) {
    return Number.MAX_SAFE_INTEGER;
  }

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

  const month = monthMap[parts[1]];
  const day = Number(parts[2]);

  if (month === undefined || Number.isNaN(day)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return new Date(Date.UTC(2026, month, day)).getTime();
}

// ===============================
// Render matches
// ===============================
function renderMatches() {
  const container = document.getElementById("matches-list");

  if (!container) return;

  container.innerHTML = "";

  let matches = [...allMatches].sort((a, b) => {
    const dateA = a.dateObj instanceof Date && !isNaN(a.dateObj)
      ? a.dateObj.getTime()
      : Number.MAX_SAFE_INTEGER;

    const dateB = b.dateObj instanceof Date && !isNaN(b.dateObj)
      ? b.dateObj.getTime()
      : Number.MAX_SAFE_INTEGER;

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    const idA = Number(String(a.id).replace(/\D/g, "")) || 0;
    const idB = Number(String(b.id).replace(/\D/g, "")) || 0;

    return idA - idB;
  });

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

    const timeText = match.time
      ? `${match.time} UTC${match.utcOffset >= 0 ? "+" + match.utcOffset : match.utcOffset}`
      : "";

    const resultText = match.score
      ? `<div style="font-size:13px;color:#237a3b;margin-bottom:8px;">Result: ${match.homeTeam} ${match.score} ${match.awayTeam}</div>`
      : "";

    card.innerHTML = `
      <div style="font-size:12px;color:#666;margin-bottom:4px;">
        ${match.stage} • ${match.day} • ${timeText}
      </div>

      <div style="font-weight:700;margin-bottom:6px;">
        Match ${match.id}: ${match.homeTeam} v ${match.awayTeam}
      </div>

      ${resultText}

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
            value="${savedPrediction && savedPrediction.home ? savedPrediction.home : ""}"
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
            value="${savedPrediction && savedPrediction.away ? savedPrediction.away : ""}"
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

  if (!predictions[predictorName]) return null;

  return predictions[predictorName][matchId] || null;
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
    leaderboard.innerHTML = "<p>No predictions yet.</p>";
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
