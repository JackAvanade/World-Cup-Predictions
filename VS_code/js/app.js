// ===============================
// World Cup Predictor - app.js
// ===============================

// Azure Blob Storage base URL
const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

// Azure Function URL for AI predictions
// IMPORTANT: Replace this with your real Function URL from Azure.
// It should look like:
// https://your-function-app.azurewebsites.net/api/runAI?code=YOUR_FUNCTION_KEY
const AI_FUNCTION_URL = "PASTE_YOUR_FUNCTION_URL_HERE";

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

    console.log("AI predictions loaded:", aiPredictionsText);

  } catch (error) {
    console.error("AI prediction error:", error);
    aiPredictionsText = "AI predictions are currently unavailable.";
  }
}

// ===============================
// Render AI predictions block
// ===============================
function renderAIPredictionsBlock(container) {
  const aiBlock = document.createElement("div");

  aiBlock.style.padding = "16px";
  aiBlock.style.marginBottom = "18px";
  aiBlock.style.borderRadius = "10px";
  aiBlock.style.border = "2px solid #6b5cff";
  aiBlock.style.background = "#f4f2ff";
  aiBlock.style.whiteSpace = "pre-line";

  aiBlock.innerHTML = `
    <div style="font-size:20px;font-weight:700;margin-bottom:8px;">
      AI Match Predictions
    </div>

    <div style="font-size:14px;line-height:1.5;color:#222;">
      ${escapeHtml(aiPredictionsText)}
    </div>
  `;

  container.appendChild(aiBlock);
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
