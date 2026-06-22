const gamesUrl = 'data/games.json';

let games = [];
let predictors = [];
let currentPredictorName = '';
let matchFilter = 'all';
let selectedGameDay = '';

async function fetchData() {
  const gRes = await fetch(gamesUrl);
  games = await gRes.json();
  // load persisted results if present
  const savedGames = localStorage.getItem('wc_games');
  if (savedGames) {
    try { const parsed = JSON.parse(savedGames); games = parsed; } catch(e){}
  }
  // load persisted predictor entries if present
  const savedPredictors = localStorage.getItem('wc_predictors');
  if (savedPredictors) {
    try { predictors = JSON.parse(savedPredictors); } catch(e){}
  }
  render();
}

function render() {
  populateGameDaySelect();
  renderMatches();
  computeAndRenderLeaderboard();
}

function populateGameDaySelect(){
  const sel = document.getElementById('game-day-select');
  if (!sel) return;
  // compute keys like in renderMatches
  const groups = {};
  games.forEach(match=>{
    if (matchFilter === 'played' && (match.scoreHome == null || match.scoreAway == null)) return;
    if (matchFilter === 'unplayed' && (match.scoreHome != null && match.scoreAway != null)) return;
    const key = match.date || match.round || 'TBD';
    if (!groups[key]) groups[key]=true;
  });
  const keys = Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  // preserve selection if possible
  const prev = selectedGameDay;
  sel.innerHTML = '<option value="">Select a game day...</option>';
  keys.forEach(k=>{
    const opt = document.createElement('option'); opt.value = k; opt.textContent = k; sel.appendChild(opt);
  });
  if (prev && keys.includes(prev)) sel.value = prev; else { selectedGameDay = ''; sel.value = ''; }
}

function renderMatches(){
  const container = document.getElementById('matches-list');
  container.innerHTML = '';
  // group matches by date (game day). fallback to round or 'TBD'
  const groups = {};
  games.forEach(match=>{
    if (matchFilter === 'played' && (match.scoreHome == null || match.scoreAway == null)) return;
    if (matchFilter === 'unplayed' && (match.scoreHome != null && match.scoreAway != null)) return;
    const key = match.date || match.round || 'TBD';
    if (!groups[key]) groups[key]=[];
    groups[key].push(match);
  });

  const keys = Object.keys(groups).sort((a,b)=> a.localeCompare(b));

  // if no day selected, show placeholder
  if (!selectedGameDay){
    const msg = document.createElement('div'); msg.className='muted'; msg.style.padding='8px'; msg.innerText = 'Select a game day to view matches and enter scorelines.';
    container.appendChild(msg);
    return;
  }

  if (!groups[selectedGameDay]){
    const msg = document.createElement('div'); msg.className='muted'; msg.style.padding='8px'; msg.innerText = 'No matches for the selected day.';
    container.appendChild(msg);
    return;
  }

  const predictor = currentPredictorName ? predictors.find(p => p.name === currentPredictorName) : null;
  const playerName = predictor ? predictor.name : currentPredictorName;
  const header = document.createElement('div'); header.className='match-header';
  header.innerHTML = `<strong>${selectedGameDay}</strong>${playerName ? `<span class="player-name">Predictions for ${playerName}</span>` : ''}`;
  container.appendChild(header);
  groups[selectedGameDay].forEach(match=>{
    const existingPrediction = predictor ? (predictor.predictions.find(pr => pr.matchId === match.id) || {matchId: match.id, home: null, away: null}) : {matchId: match.id, home: null, away: null};
    const el = document.createElement('div'); el.className='match';
    const left = document.createElement('div'); left.innerText = `${match.home} vs ${match.away}`;

    const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='12px';
    const predictionBox = document.createElement('div'); predictionBox.className='prediction-inputs';
    const predLabel = document.createElement('span'); predLabel.innerText = 'Prediction:';
    const predHome = document.createElement('input'); predHome.type='number'; predHome.min=0; predHome.value = existingPrediction.home != null ? existingPrediction.home : '';
    const predAway = document.createElement('input'); predAway.type='number'; predAway.min=0; predAway.value = existingPrediction.away != null ? existingPrediction.away : '';
    predHome.disabled = !currentPredictorName.trim();
    predAway.disabled = !currentPredictorName.trim();
    predictionBox.appendChild(predLabel);
    predictionBox.appendChild(predHome);
    predictionBox.appendChild(document.createTextNode(' - '));
    predictionBox.appendChild(predAway);
    right.appendChild(predictionBox);
    
    [predHome, predAway].forEach(inp=>inp.addEventListener('change', ()=>{
      if (!currentPredictorName.trim()) return;
      let target = predictors.find(p => p.name === currentPredictorName);
      if (!target){
        target = {name: currentPredictorName, predictions: []};
        predictors.push(target);
      }
      let predObj = target.predictions.find(pr => pr.matchId === match.id);
      if (!predObj){
        predObj = {matchId: match.id, home: null, away: null};
        target.predictions.push(predObj);
      }
      predObj.home = predHome.value === '' ? null : parseInt(predHome.value,10);
      predObj.away = predAway.value === '' ? null : parseInt(predAway.value,10);
      localStorage.setItem('wc_predictors', JSON.stringify(predictors));
      computeAndRenderLeaderboard();
    }));

    el.appendChild(left); el.appendChild(right);
    container.appendChild(el);
  });
}

function markActiveFilter(){
  const allBtn = document.getElementById('filter-all');
  const playedBtn = document.getElementById('filter-played');
  const unplayedBtn = document.getElementById('filter-unplayed');
  if (allBtn) allBtn.classList.toggle('active', matchFilter === 'all');
  if (playedBtn) playedBtn.classList.toggle('active', matchFilter === 'played');
  if (unplayedBtn) unplayedBtn.classList.toggle('active', matchFilter === 'unplayed');
}

function setMatchFilter(f){
  matchFilter = f;
  populateGameDaySelect();
  renderMatches();
  markActiveFilter();
}

function alignPredictorPredictions(list){
  return list.map(it => {
    const preds = Array.isArray(it.predictions) ? it.predictions : [];
    const predMap = {};
    preds.forEach(pr => { if (typeof pr.matchId !== 'undefined') predMap[pr.matchId] = {matchId: pr.matchId, home: pr.home ?? null, away: pr.away ?? null}; });
    const aligned = games.map(g => predMap[g.id] ? predMap[g.id] : {matchId: g.id, home: null, away: null});
    return {name: it.name, predictions: aligned};
  });
}

// Background importer: polls data/imports/ for games.json and predictors.json (legacy players.json supported)
async function fetchBackgroundImports(){
  try{
    // try fetching games import and predictor prediction imports
    const [gRes, predictorsRes, playersRes] = await Promise.allSettled([
      fetch('data/imports/games.json'),
      fetch('data/imports/predictors.json'),
      fetch('data/imports/players.json')
    ]);
    const pRes = (predictorsRes.status === 'fulfilled' && predictorsRes.value.ok)
      ? predictorsRes
      : playersRes;

    if (gRes.status === 'fulfilled' && gRes.value.ok){
      const data = await gRes.value.json();
      if (Array.isArray(data)){
        // basic validation
        let valid = true;
        data.forEach(it=>{ if (typeof it.id === 'undefined' || !it.home || !it.away) valid = false; });
        if (valid){
          const newGames = data.map(it=>({id:it.id, home:it.home, away:it.away, scoreHome: typeof it.scoreHome !== 'undefined' ? it.scoreHome : null, scoreAway: typeof it.scoreAway !== 'undefined' ? it.scoreAway : null}));
          // check if changed
          if (JSON.stringify(newGames) !== JSON.stringify(games)){
            games = newGames;
            predictors = alignPredictorPredictions(predictors);
            localStorage.setItem('wc_games', JSON.stringify(games));
            localStorage.setItem('wc_predictors', JSON.stringify(predictors));
            render();
          }
        }
      }
    }

    if (pRes.status === 'fulfilled' && pRes.value.ok){
      const data = await pRes.value.json();
      if (Array.isArray(data)){
        let valid = true;
        data.forEach(it=>{ if (!it.name) valid = false; });
        if (valid){
          const newPredictors = alignPredictorPredictions(data);
          if (JSON.stringify(newPredictors) !== JSON.stringify(predictors)){
            predictors = newPredictors;
            localStorage.setItem('wc_predictors', JSON.stringify(predictors));
            computeAndRenderLeaderboard();
          }
        }
      }
    }
    // fallback: fetch official openfootball worldcup.json raw file for 2026
    try{
      const rawUrl = 'https://raw.githubusercontent.com/openfootball/worldcup.json/720d6a25421955d75e2dd2ba48a40435b515a267/2026/worldcup.json';
      const r = await fetch(rawUrl);
      if (r.ok){
        const doc = await r.json();
        if (doc && Array.isArray(doc.matches)){
          // transform matches into our simple games format
          const newGames = doc.matches.map((m, i)=>{
            const score = m.score && Array.isArray(m.score.ft) ? m.score.ft : null;
            return { id: i+1, home: m.team1, away: m.team2, scoreHome: score ? score[0] : null, scoreAway: score ? score[1] : null, date: m.date, round: m.round };
          });
          if (JSON.stringify(newGames) !== JSON.stringify(games)){
            games = newGames;
            predictors = alignPredictorPredictions(predictors);
            localStorage.setItem('wc_games', JSON.stringify(games));
            localStorage.setItem('wc_predictors', JSON.stringify(predictors));
            render();
          }
        }
      }
    }catch(e){
      // ignore fallback errors
    }
  }catch(e){
    // silent fail; background import shouldn't interrupt UI
    console.warn('Background import failed', e);
  }
}

function computeResult(home, away){
  if (home == null || away == null) return null;
  if (home === away) return 'D';
  return home > away ? 'H' : 'A';
}

function computeAndRenderLeaderboard(){
  // calculate points per predictor
  const results = predictors.map(p => ({name:p.name, points:0}));

  predictors.forEach((p, idx) =>{
    let total = 0;
    p.predictions.forEach(pred =>{
      const match = games.find(m=>m.id===pred.matchId);
      if (!match) return;
      if (match.scoreHome == null || match.scoreAway == null) return;
      const actualRes = computeResult(match.scoreHome, match.scoreAway);
      const predRes = computeResult(pred.home, pred.away);
      if (pred.home === match.scoreHome && pred.away === match.scoreAway) {
        total += 2; // exact scoreline
      } else if (predRes && predRes === actualRes) {
        total += 1; // correct result
      }
    });
    results[idx].points = total;
  });

  // sort descending
  results.sort((a,b)=>b.points - a.points);

  const lb = document.getElementById('leaderboard-list'); lb.innerHTML='';
  results.forEach(r=>{
    const el = document.createElement('div'); el.className='player';
    el.innerHTML = `<strong>${r.name}</strong><span>${r.points} pts</span>`;
    lb.appendChild(el);
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('save-results').addEventListener('click', ()=>{
    localStorage.setItem('wc_games', JSON.stringify(games));
    computeAndRenderLeaderboard();
    alert('Results saved and leaderboard updated');
  });
  document.getElementById('filter-all').addEventListener('click', ()=>setMatchFilter('all'));
  document.getElementById('filter-played').addEventListener('click', ()=>setMatchFilter('played'));
  document.getElementById('filter-unplayed').addEventListener('click', ()=>setMatchFilter('unplayed'));
  const predictorInput = document.getElementById('predictor-name');
  if (predictorInput){
    predictorInput.addEventListener('input', (e)=>{
      currentPredictorName = e.target.value.trim();
      renderMatches();
    });
  }
  document.getElementById('save-predictions').addEventListener('click', ()=>{
    if (!currentPredictorName.trim()){
      alert('Enter a predictor name before saving predictions.');
      return;
    }
    localStorage.setItem('wc_predictors', JSON.stringify(predictors));
    alert(`Predictions saved for ${currentPredictorName}`);
  });

  // initial load
  fetchData();
  markActiveFilter();

  // run background import immediately and then poll every 5 minutes
  fetchBackgroundImports();
  const FIVE_MIN = 5 * 60 * 1000;
  setInterval(fetchBackgroundImports, FIVE_MIN);
  const gameDaySelect = document.getElementById('game-day-select');
  if (gameDaySelect) {
    gameDaySelect.addEventListener('change', (e)=>{
      selectedGameDay = e.target.value;
      renderMatches();
    });
  }
});
