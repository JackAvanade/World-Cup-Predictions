# World Cup Predictor (Static)

A simple static app to track World Cup predictions and score players based on results.

Scoring rules:
- 2 points for an exact scoreline match
- 1 point for the correct result (win/draw/loss)

Run locally (recommended via a static server):

```bash
# install a tiny static server if you don't have one
npm install -g lite-server
lite-server
```

Or open `index.html` directly in a browser (some browsers restrict local fetch of JSON files).

Importing JSON
- You can import games or predictor prediction JSON from the app's background import folder when available.
- Games format example: `[{"id":1,"home":"Brazil","away":"Argentina","scoreHome":2,"scoreAway":1}]`
- Predictor format example: `[{"name":"Alice","predictions":[{"matchId":1,"home":2,"away":1}]}]`

