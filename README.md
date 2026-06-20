<div align="center">

  # Gym Tracker

  **Mobile and desktop Obsidian plugin for logging strength workouts and rucks without leaving your vault.**

  [![License: MIT](https://img.shields.io/badge/License-MIT-cba6f7.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/version-0.1.2-89b4fa)](https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker/releases)
  
  [Documentation](https://Real-Fruit-Snacks.github.io/obsidian-gym-tracker/) • [Report Issue](https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker/issues) • [Request Feature](https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker/issues)

</div>

---

## Overview

Gym Tracker keeps structured workout data inside Obsidian, provides routines and progress views, and can export sessions as Markdown notes. It is designed with responsive layouts for both Obsidian desktop and mobile.

### Key Features

- **Detailed Logging**: Log strength workouts with exercises, sets, reps, weight, RPE, RIR, completion state, and notes.
- **Ruck Tracking**: Track rucks with distance, duration, pack weight, elevation gain, route, RPE, pace, and load-distance.
- **GPX Import**: Import GPX files to automatically fill ruck date, distance, duration, elevation gain, and route name.
- **Routines**: Save routines, edit them later, and load them into a new workout.
- **Insights & Calendar**: Review weekly volume, workout totals, ruck mileage, streaks, exercise progress, and personal records. Browse workouts by month in the Calendar.
- **Library**: Search a built-in exercise library and jump directly from an exercise to its history.
- **Export & Backup**: Export workouts to Dataview-friendly Markdown with YAML frontmatter. Export a full JSON backup via the command palette.

---

## Getting Started

### Installation

**From a GitHub release:**
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create `<vault>/.obsidian/plugins/gym-tracker/`.
3. Place all three files in that folder.
4. Reload Obsidian.
5. Enable **Gym Tracker** under **Settings -> Community plugins**.

**From source:**
```bash
git clone https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker.git
cd obsidian-gym-tracker
npm install
npm run build
```
Copy or symlink the repository into `<vault>/.obsidian/plugins/gym-tracker/`, then reload Obsidian and enable the plugin.

---

## Usage

### Views
- **Workout**: Build a strength or ruck draft, load routines, import GPX files, run the rest timer, and save the session.
- **Insights**: Review totals, weekly trends, exercise progress, progression suggestions, and records.
- **Calendar**: Browse workouts by date and create a workout for a selected day.
- **Routines**: Start, edit, or delete reusable workout templates.
- **Library**: Filter exercises and add, inspect history, edit, or delete entries.
- **History**: Review, edit, export, or delete saved workouts.

### GPX Import
Switch a workout to **Ruck** mode and select **Import GPX**. Gym Tracker calculates route distance using GPX track points, elevation gain from positive elevation changes, and elapsed duration from the first and last timestamps.

Enter pack weight or RPE manually after import to calculate load-distance and preserve how the ruck felt.

### Data and Privacy
Workout data is stored through Obsidian's plugin data storage. GPX files are read locally in the Obsidian app. Gym Tracker **does not** send workout or location data to an external service.

Use **Gym Tracker: Export tracker backup JSON** from the command palette to create a portable backup in your configured workout export folder.

### Dataview Examples

**Recent workouts:**
```dataview
TABLE date, workout_type, duration_minutes, volume, set_count
FROM "Gym/Workouts"
WHERE record_type = "workout"
SORT date DESC
```

**Rucks:**
```dataview
TABLE date, distance, distance_unit, duration_minutes, pack_weight, pace_minutes_per_mi
FROM "Gym/Workouts"
WHERE workout_mode = "ruck"
SORT date DESC
```

**Bench press sessions:**
```dataview
TABLE date, volume, set_count
FROM "Gym/Workouts"
WHERE contains(exercises, "Bench Press")
SORT date DESC
```

---

## Architecture / File Structure

```text
obsidian-gym-tracker/
├── main.js              # Compiled plugin entry
├── manifest.json        # Obsidian plugin manifest
├── styles.css           # Compiled plugin styles
├── esbuild.config.mjs   # Build configuration
└── src/                 # TypeScript source code
```

---

## Contributing

Contributions from the community are highly encouraged. Whether it's adding new features, improving the layout, or fixing bugs, your help is appreciated.

Please refer to the `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` files for full guidelines on how to submit pull requests and report issues.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Contact

Real-Fruit-Snacks - [https://github.com/Real-Fruit-Snacks](https://github.com/Real-Fruit-Snacks)

Project Link: [https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker](https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker)
