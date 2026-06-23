// ✅ Correct blob URL (NO <a href> — just plain string)
const BASE_URL = "https://worldcuppredictions.blob.core.windows.net/worldcuppredictions/";

// ✅ Files you want to load
const FILES = [
  "cup_finals.txt",
  "teams.txt",
  "matches.txt"
];

// ✅ Load files from blob storage
async function loadAllFiles() {
  const data = {};

  for (const file of FILES) {
    try {
      // cache-busting added so it always updates
      const response = await fetch(BASE_URL + file + "?cache=" + Date.now());

      if (!response.ok) {
        throw new Error(`Failed to load ${file}`);
      }

      data[file] = await response.text();

    } catch (error) {
      console.error(error);
      data[file] = "Error loading file.";
    }
  }

  return data;
}

// ✅ Display data
async function displayData() {
  const container = document.getElementById("matches-list");

  container.innerHTML = "Loading...";

  const data = await loadAllFiles();

  container.innerHTML = "";

  for (const file in data) {
    const section = document.createElement("div");

    section.innerHTML = `
      <h4>${file}</h4>
      <pre>${data[file]}</pre>
    `;

    container.appendChild(section);
  }
}

// ✅ Run when page loads
window.onload = displayData;
