const fixturesList = document.getElementById('fixtures-list');
const matchSelect = document.getElementById('match-select');
const predictionForm = document.getElementById('prediction-form');
const feedback = document.getElementById('prediction-feedback');
const leaderboardEl = document.getElementById('leaderboard');
const generateAiButton = document.getElementById('generate-ai');
const aiPredictionsEl = document.getElementById('ai-predictions');

const FIXTURES_URL = 'data/upcoming-2026.json';
const STORAGE_KEY = 'wc2026-predictions';
const AI_KEY = 'wc2026-ai-predictions';

let fixtures = [];
let predictions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let aiPredictions = JSON.parse(localStorage.getItem(AI_KEY) || '[]');

function createDateLabel(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function loadFixtures() {
  return fetch(FIXTURES_URL)
    .then(response => response.json())
    .then(data => {
      fixtures = data.fixtures || [];
      renderFixtures();
      renderMatchOptions();
      renderLeaderboard();
    })
    .catch(error => {
      fixturesList.innerHTML = '<p class="feedback">Unable to load upcoming match data.</p>';
      console.error(error);
    });
}

function renderFixtures() {
  if (!fixtures.length) {
    fixturesList.innerHTML = '<p class="feedback">No upcoming fixtures available.</p>';
    return;
  }

  fixturesList.innerHTML = fixtures.map(fixture => {
    return `
      <article class="fixture-card">
        <div class="fixture-meta">
          <div class="fixture-group">Group ${fixture.group}</div>
          <div class="team-row">
            <span class="team-name">${fixture.homeTeam}</span>
            <span>vs</span>
            <span class="team-name">${fixture.awayTeam}</span>
          </div>
          <div class="match-date">${createDateLabel(fixture.date)}</div>
        </div>
        <div class="score-label">${fixture.location}</div>
      </article>
    `;
  }).join('');
}

function renderMatchOptions() {
  matchSelect.innerHTML = fixtures.map(fixture => `
    <option value="${fixture.id}">${fixture.homeTeam} vs ${fixture.awayTeam} — ${createDateLabel(fixture.date)}</option>
  `).join('');
}

function savePredictions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
}

function saveAIPredictions() {
  localStorage.setItem(AI_KEY, JSON.stringify(aiPredictions));
}

function getPredictionResult(homeScore, awayScore) {
  if (homeScore === awayScore) return 'Draw';
  return homeScore > awayScore ? 'Home win' : 'Away win';
}

function computeLeaderboardData() {
  const scores = predictions.reduce((map, prediction) => {
    const key = prediction.player.trim().toLowerCase();
    if (!map[key]) {
      map[key] = { name: prediction.player.trim(), entries: [], total: 0 };
    }
    map[key].entries.push(prediction);
    return map;
  }, {});

  const ranked = Object.values(scores).map(player => {
    player.total = player.entries.reduce((sum, entry) => sum + entry.homeScore + entry.awayScore, 0);
    return player;
  });

  ranked.sort((a, b) => b.total - a.total);
  return ranked;
}

function renderLeaderboard() {
  const leaderboard = computeLeaderboardData();
  if (!leaderboard.length) {
    leaderboardEl.innerHTML = '<p class="feedback">No predictions yet. Submit one to join the board.</p>';
    return;
  }

  leaderboardEl.innerHTML = leaderboard.map(player => `
    <div class="player-row">
      <div>
        <div class="player-name">${player.name}</div>
        <div class="team-name">${player.entries.length} predictions</div>
      </div>
      <div class="player-score">${player.total}</div>
    </div>
  `).join('');
}

function renderAIPredictions() {
  if (!aiPredictions.length) {
    aiPredictionsEl.innerHTML = '<p class="feedback">No AI predictions generated yet.</p>';
    return;
  }

  aiPredictionsEl.innerHTML = aiPredictions.map(prediction => `
    <article class="ai-card">
      <h3>${prediction.matchLabel}</h3>
      <p>Predicted score: <strong>${prediction.homeScore} - ${prediction.awayScore}</strong></p>
      <p>Result: <strong>${prediction.result}</strong></p>
      <p>Confidence: <strong>${prediction.confidence}%</strong></p>
    </article>
  `).join('');
}

function generateAIPredictions() {
  aiPredictions = fixtures.map(fixture => {
    const homeScore = Math.floor(Math.random() * 4);
    const awayScore = Math.floor(Math.random() * 4);
    const result = getPredictionResult(homeScore, awayScore);
    const confidence = Math.floor(60 + Math.random() * 35);

    return {
      fixtureId: fixture.id,
      matchLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      homeScore,
      awayScore,
      result,
      confidence
    };
  });

  saveAIPredictions();
  renderAIPredictions();
  feedback.textContent = 'AI predictions generated and recorded.';
}

predictionForm.addEventListener('submit', event => {
  event.preventDefault();
  const playerInput = document.getElementById('player-name');
  const homeScoreInput = document.getElementById('home-score');
  const awayScoreInput = document.getElementById('away-score');

  const player = playerInput.value.trim();
  const matchId = Number(matchSelect.value);
  const homeScore = Number(homeScoreInput.value);
  const awayScore = Number(awayScoreInput.value);

  if (!player) {
    feedback.textContent = 'Enter your name.';
    return;
  }

  const match = fixtures.find(item => item.id === matchId);
  if (!match) {
    feedback.textContent = 'Select a valid fixture.';
    return;
  }

  predictions.push({ player, fixtureId: matchId, homeScore, awayScore, matchLabel: `${match.homeTeam} vs ${match.awayTeam}` });
  savePredictions();
  renderLeaderboard();
  feedback.textContent = 'Prediction saved!';
  predictionForm.reset();
});

generateAiButton.addEventListener('click', generateAIPredictions);

loadFixtures();
renderAIPredictions();
