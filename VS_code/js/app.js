// ===============================
// World Cup Predictor - app.js
// ===============================

// Azure Blob Storage base URL
const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

// Azure Function URL for AI predictions
const AI_FUNCTION_URL = "https://worldcuppredicition-eahrg4fggbdaeffn.ukwest-01.azurewebsites.net/api/runAI";

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
let aiPredictionsText = "";

// ===============================
// Start app
// ===============================
window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  setupButtons();

  await loadMatches();
  sortAllMatches();
  populateGameDays();

  await loadAIPredictions();

  renderMatches();
  renderLeaderboard();
}

// ===============================
// Load AI predictions from Azure Function
// ===============================
async function loadAIPredictions() {
  aiPredictionsText = "Loading AI predictions...";

  try {
    if (!AI_FUNCTION_URL || AI_FUNCTION_URL === "PASTE_YOUR_FUNCTION_URL_HERE") {
      aiPredictionsText = "AI Function URL has not been set yet.";
      return;
    }

    const response = await fetch(AI_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`AI function failed with status ${response.status}`);
    }

    const data = await response.json();

    aiPredictionsText = data.answer || "AI returned no prediction text.";
    
    saveAIPredictionsToLeaderboard(aiPredictionsText);
    renderLeaderboard();

    console.log("AI predictions loaded:", aiPredictionsText);

  } catch (error) {
    console.error("AI prediction error:", error);
    aiPredictionsText = "AI predictions are currently unavailable.";
  

  }
}

// ===============================
// Render AI predictions block
// ===============================
//function renderAIPredictionsBlock(container) {
//  const aiBlock = document.createElement("div");

 // aiBlock.style.padding = "16px";
  //aiBlock.style.marginBottom = "18px";
 // aiBlock.style.borderRadius = "10px";
  //aiBlock.style.border = "2px solid #6b5cff";
  //aiBlock.style.background = "#f4f2ff";
 // aiBlock.style.whiteSpace = "pre-line";

//  aiBlock.innerHTML = `
  //  <div style="font-size:20px;font-weight:700;margin-bottom:8px;">
    //  AI Match Predictions
   // </div>

   // <div style="font-size:14px;line-height:1.5;color:#222;">
    //  ${escapeHtml(aiPredictionsText)}
   // </div>
  // `;

 // container.appendChild(aiBlock);
// }

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

    const detectedDay = extractDayLabel(cleanLine);

    if (detectedDay) {
      currentDayLabel = detectedDay;
    }

    const groupListMatch = cleanLine.match(/^Group\s+([A-Z])\s*\|/i);

    if (groupListMatch) {
      currentStage = `Group ${groupListMatch[1].toUpperCase()}`;
      return;
    }

    const bulletGroupMatch = cleanLine.match(/^▪?\s*Group\s+([A-Z])/i);

    if (bulletGroupMatch && detectedDay) {
      currentStage = `Group ${bulletGroupMatch[1].toUpperCase()}`;
      return;
    }

    if (cleanLine.startsWith("=")) {
      const heading = cleanLine.replace(/=/g, "").trim();

      if (heading) {
        currentStage = heading;
      }

      return;
    }

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

  let match = line.match(new RegExp(`${dayNames}\\s+${monthNames}\\s+(\\d{1,2})`, "i"));

  if (match) {
    return `${normaliseDay(match[1])} ${normaliseMonth(match[2])} ${Number(match[3])}`;
  }

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

  const fixtureSplit = teamsText.split(/\s+v\s+|\s+vs\s+/i);

  if (fixtureSplit.length >= 2) {
    homeTeam = fixtureSplit[0].trim();
    awayTeam = fixtureSplit.slice(1).join(" v ").trim();
  } else {
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

    return dateA - dateB;
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
    container.innerHTML += "<p>No matches found for this filter.</p>";
    return;
  }

  matches.forEach(match => {
    const savedPrediction = getPredictionForMatch(match.id);

    const card = document.createElement("div");


    const timeText = match.time
      ? `${match.time} UTC${match.utcOffset >= 0 ? "+" + match.utcOffset : match.utcOffset}`
      : "";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">

        <div style="flex:1;min-width:250px;">
          <div style="font-size:12px;color:#666;">
            ${escapeHtml(match.stage)} • ${escapeHtml(match.day)}
          </div>

          <div style="font-size:18px;font-weight:700;margin:5px 0;">
            ${escapeHtml(match.homeTeam)} vs ${escapeHtml(match.awayTeam)}
          </div>

          <div style="font-size:12px;color:#666;">
            ${escapeHtml(timeText)} • ${escapeHtml(match.location)}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:6px;">
          <input
            type="number"
            min="0"
            class="prediction-input"
            data-match-id="${escapeHtml(match.id)}"
            data-side="home"
            value="${savedPrediction && savedPrediction.home ? escapeHtml(savedPrediction.home) : ""}"
            ${match.played ? "disabled" : ""}
            style="width:50px;padding:6px;text-align:center;"
          />

          <span>-</span>

          <input
            type="number"
            min="0"
            class="prediction-input"
            data-match-id="${escapeHtml(match.id)}"
            data-side="away"
            value="${savedPrediction && savedPrediction.away ? escapeHtml(savedPrediction.away) : ""}"
            ${match.played ? "disabled" : ""}
            style="width:50px;padding:6px;text-align:center;"
          />
        </div>

      </div>
      <div class="ai-box">
      <div class="ai-title">🤖 AI Bot</div>
      <div class="ai-text">
    ${getSimpleAIPrediction(match)}
  </div>
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
  const refreshAIButton = document.getElementById("refresh-ai");

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

  if (refreshAIButton) {
    refreshAIButton.addEventListener("click", async () => {
      aiPredictionsText = "Refreshing AI predictions...";
      renderMatches();
      await loadAIPredictions();
      renderMatches();
    });
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

  const leaderboardData = names.map(name => {
    const playerPredictions = predictions[name];

    let totalScore = 0;
    let scoredMatches = 0;
    let exactScores = 0;
    let correctWinners = 0;
    let correctGoalDifferences = 0;

    Object.keys(playerPredictions).forEach(matchId => {
      const match = allMatches.find(m => String(m.id) === String(matchId));

      if (!match || !match.score) {
        return;
      }

      const prediction = playerPredictions[matchId];

      const predictionHome = Number(prediction.home);
      const predictionAway = Number(prediction.away);

      if (
        Number.isNaN(predictionHome) ||
        Number.isNaN(predictionAway)
      ) {
        return;
      }

      const realScore = parseScore(match.score);

      if (!realScore) {
        return;
      }

      const result = scorePrediction(
        predictionHome,
        predictionAway,
        realScore.home,
        realScore.away
      );

      totalScore += result.points;
      scoredMatches++;

      if (result.correctWinner) correctWinners++;
      if (result.correctGoalDifference) correctGoalDifferences++;
      if (result.exactScore) exactScores++;
    });

    return {
      name,
      totalScore,
      scoredMatches,
      exactScores,
      correctWinners,
      correctGoalDifferences,
      predictionCount: Object.keys(playerPredictions).length
    };
  });

  leaderboardData.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }

    if (b.exactScores !== a.exactScores) {
      return b.exactScores - a.exactScores;
    }

    return b.correctWinners - a.correctWinners;
  });

  leaderboard.innerHTML = "";

  leaderboardData.forEach((player, index) => {
    const row = document.createElement("div");

    row.style.padding = "10px";
    row.style.borderBottom = "1px solid #ddd";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.gap = "12px";

    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" :
      `${index + 1}.`;

    row.innerHTML = `
      <div>
        <strong>${medal} ${escapeHtml(player.name)}</strong>
        <div style="font-size:12px;color:#666;">
          ${player.scoredMatches} scored match(es) •
          ${player.correctWinners} winner(s) •
          ${player.correctGoalDifferences} goal difference(s) •
          ${player.exactScores} exact score(s)
        </div>
      </div>

      <div style="font-size:18px;font-weight:700;">
        ${player.totalScore} pts
      </div>
    `;

    leaderboard.appendChild(row);
  });
}
function parseScore(scoreText) {
  if (!scoreText) return null;

  const match = String(scoreText).match(/(\d+)\s*-\s*(\d+)/);

  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function getResultType(homeScore, awayScore) {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function scorePrediction(predHome, predAway, realHome, realAway) {
  let points = 0;

  const predictedWinner = getResultType(predHome, predAway);
  const realWinner = getResultType(realHome, realAway);

  const predictedGoalDifference = predHome - predAway;
  const realGoalDifference = realHome - realAway;

  const correctWinner = predictedWinner === realWinner;
  const correctGoalDifference = predictedGoalDifference === realGoalDifference;
  const exactScore = predHome === realHome && predAway === realAway;

  if (correctWinner) {
    points += 1;
  }

  if (correctGoalDifference) {
    points += 1;
  }

  if (exactScore) {
    points += 1;
  }

  return {
    points,
    correctWinner,
    correctGoalDifference,
    exactScore
  };
}
function saveAIPredictionsToLeaderboard(aiText) {
  if (!aiText) return;

  const AI_NAME = "AI Bot";

  let predictions = getAllPredictions();

  if (!predictions[AI_NAME]) {
    predictions[AI_NAME] = {};
  }

  // Split by matches
  const sections = aiText.split("Match:");

  sections.forEach(section => {
    const scoreMatch = section.match(/Predicted score:\s*(\d+)\s*-\s*(\d+)/i);
    const teamsMatch = section.match(/(.+?)\s+vs\s+(.+)/i);

    if (!scoreMatch || !teamsMatch) return;

    const homeTeam = teamsMatch[1].trim();
    const awayTeam = teamsMatch[2].trim();

    const homeScore = scoreMatch[1];
    const awayScore = scoreMatch[2];

    // ✅ Find the match in your data
    const match = allMatches.find(m =>
      m.homeTeam === homeTeam &&
      m.awayTeam === awayTeam
    );

    if (!match) return;

    if (!predictions[AI_NAME][match.id]) {
      predictions[AI_NAME][match.id] = {};
    }

    predictions[AI_NAME][match.id] = {
      home: homeScore,
      away: awayScore
    };
  });

  localStorage.setItem("worldCupPredictions", JSON.stringify(predictions));

  console.log("AI predictions saved:", predictions[AI_NAME]);
}
function getSimpleAIPrediction(match) {
  if (!aiPredictionsText) return "Loading...";

  const sections = aiPredictionsText.split("Match:");

  for (const section of sections) {
    const lower = section.toLowerCase();

    if (
      lower.includes(match.homeTeam.toLowerCase()) &&
      lower.includes(match.awayTeam.toLowerCase())
    ) {
      const scoreMatch = section.match(/Predicted score:\s*(\d+)\s*-\s*(\d+)/i);
      const winnerMatch = section.match(/Predicted winner:\s*(.+)/i);
      const reasonMatch = section.match(/Reason:\s*(.+)/i);

      if (!scoreMatch) return "No prediction";

      let homeScore = Number(scoreMatch[1]);
      let awayScore = Number(scoreMatch[2]);

      const winner = winnerMatch ? winnerMatch[1].toLowerCase() : "";
      let reason = reasonMatch ? reasonMatch[1] : "";


      if (winner && winner.includes(match.awayTeam.toLowerCase())) {
        [homeScore, awayScore] = [awayScore, homeScore];
      }

      // shorten reason
      if (reason.includes(".")) {
        reason = reason.split(".")[0] + ".";
      }

      return `
        <strong>${homeScore}-${awayScore}</strong>
        ${reason ? `<span class="ai-reason">• ${reason}</span>` : ""}
      `;
    }
  }

  return "No prediction.";
}
``
// ===============================
// Escape HTML helper
// ===============================
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function scrollToSection(id) {
  const element = document.getElementById(id);

  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}
