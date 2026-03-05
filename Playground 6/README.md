# Training & Recovery Tracker

Simple offline web app for tracking daily training and recovery metrics, with trend charts, custom metric support, dashboards, and exercise/PR logging.

## Features

- Daily entries for weight, sleep, resting HR, readiness, training load, soreness, mood, and notes
- Custom metric definitions (name, unit, decimals) and custom metric trend charts
- Exercise-level logging per day (sets/reps/weight/RPE)
- PR logging per day plus automatic "Best PRs" summary table
- Weekly or monthly dashboard view with previous-period comparison
- Direct `.FIT` file import (Garmin/Coros/Wahoo style exports) for automatic training session ingestion
- Flexible CSV import for both app-export CSVs and generic activity CSVs (date/type/duration/distance/etc.)
- Training type visual badges with icons for swim, strength, run, and cycle
- Local storage persistence (no account or backend required)
- Editable history table
- 7-entry rolling averages
- CSV import/export for spreadsheet workflows (includes custom/exercise/PR data in JSON columns)

## Run

Open `index.html` in your browser.

## Install As Mobile App (PWA)

PWA install works only when served from `http://localhost` or `https` (not `file://`).

### Local preview

From this folder, run one of these:

- `python3 -m http.server 8080`
- `ruby -run -e httpd . -p 8080`

Then open `http://localhost:8080`.

### Install on iPhone

1. Open the hosted URL in Safari.
2. Tap Share.
3. Tap `Add to Home Screen`.

### Install on Android

1. Open the hosted URL in Chrome.
2. Tap menu.
3. Tap `Install app` or `Add to Home screen`.

## Suggested workflow

1. Define any custom metrics you care about (HRV, steps, calories, stress, etc.).
2. Log one entry per day, including exercise details and any PRs.
3. Use `Import FIT` or `Import CSV` to ingest activity files directly.
4. Review weekly/monthly dashboard deltas, trend charts, and training type badges.
5. Export CSV periodically as backup or for deeper spreadsheet analysis.
