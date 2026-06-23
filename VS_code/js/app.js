// ✅ 1. constants at the top
const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

const FILES = [
  "cup_finals.txt",
  "cup.txt",
  "cup_stadiums.csv",
  "quali_playoffs.txt"
];

// ✅ 2. functions
async function loadData() {
  const response = await fetch(BASE_URL + "cup_finals.txt?cache=" + Date.now());
  const text = await response.text();

  return parseMatches(text);  // ✅ using parser
}

async function displayData() {
  const container = document.getElementById("matches-list");

  container.innerHTML = "Loading...";

  const matches = await loadData();

  container.innerHTML = "";

  matches.forEach(match => {
    const div = document.createElement("div");

    div.style.padding = "10px";
    div.style.marginBottom = "8px";
    div.style.borderRadius = "6px";

    div.style.background = match.played ? "#d4edda" : "#f8d7da";

    div.innerHTML = `
      <strong>${match.text}</strong><br>
      <small>${match.location}</small>
    `;

    container.appendChild(div);
  });
}

// ✅ 3. parser function (can be at bottom ✅)
function parseMatches(text) {
  const lines = text.split("\n");

  const matches = [];

  lines.forEach(line => {
    if (line.includes("@") && line.includes("v")) {
      const parts = line.split("@");

      matches.push({
        text: parts[0].trim(),
        location: parts[1].trim(),
        played: /\d+-\d+/.test(line)
      });
    }
  });

  return matches;
}

// ✅ 4. run app
window.onload = displayData;
``
