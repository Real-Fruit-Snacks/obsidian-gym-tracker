# Gym Tracker

Gym Tracker is a mobile and desktop Obsidian plugin for logging strength workouts and rucks without leaving your vault. It keeps structured workout data inside Obsidian, provides routines and progress views, and can export sessions as Markdown notes.

## Features

- Log strength workouts with exercises, sets, reps, weight, RPE, RIR, completion state, and notes.
- Track rucks with distance, duration, pack weight, elevation gain, route, RPE, pace, and load-distance.
- Import GPX files to fill ruck date, distance, duration, elevation gain, and route name.
- Save routines, edit them later, and load them into a new workout.
- Browse workouts by month in Calendar and add a workout for any selected date.
- Review weekly volume, workout totals, ruck mileage, streaks, exercise progress, and personal records.
- Search a built-in exercise library and jump directly from an exercise to its history.
- Use a configurable rest timer during workouts.
- Export workouts to Dataview-friendly Markdown with YAML frontmatter and optional exercise wiki links.
- Export a full JSON backup from the command palette.
- Load and clear demo data for desktop and mobile layout testing.
- Use responsive layouts designed for Obsidian desktop and mobile.

## Views

- **Workout**: Build a strength or ruck draft, load routines, import GPX files, run the rest timer, and save the session.
- **Insights**: Review totals, weekly trends, exercise progress, progression suggestions, and records.
- **Calendar**: Browse workouts by date and create a workout for a selected day.
- **Routines**: Start, edit, or delete reusable workout templates.
- **Library**: Filter exercises and add, inspect history, edit, or delete entries.
- **History**: Review, edit, export, or delete saved workouts.

## Installation

### From a GitHub release

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create `<vault>/.obsidian/plugins/gym-tracker/`.
3. Place all three files in that folder.
4. Reload Obsidian.
5. Enable **Gym Tracker** under **Settings -> Community plugins**.

### From source

```bash
git clone https://github.com/Real-Fruit-Snacks/obsidian-gym-tracker.git
cd obsidian-gym-tracker
npm install
npm run build
```

Copy or symlink the repository into `<vault>/.obsidian/plugins/gym-tracker/`, then reload Obsidian and enable the plugin.

## GPX import

Switch a workout to **Ruck** mode and select **Import GPX**. Gym Tracker calculates route distance using GPX track points, elevation gain from positive elevation changes, and elapsed duration from the first and last timestamps.

GPX files do not normally contain pack weight or RPE. Enter those values after import to calculate load-distance and preserve how the ruck felt.

## Data and privacy

Workout data is stored through Obsidian's plugin data storage. GPX files are read locally in the Obsidian app. Gym Tracker does not send workout or location data to an external service.

Use **Gym Tracker: Export tracker backup JSON** from the command palette to create a portable backup in your configured workout export folder.

## Dataview examples

Recent workouts:

```dataview
TABLE date, workout_type, duration_minutes, volume, set_count
FROM "Gym/Workouts"
WHERE record_type = "workout"
SORT date DESC
```

Rucks:

```dataview
TABLE date, distance, distance_unit, duration_minutes, pack_weight, pace_minutes_per_mi
FROM "Gym/Workouts"
WHERE workout_mode = "ruck"
SORT date DESC
```

Bench press sessions:

```dataview
TABLE date, volume, set_count
FROM "Gym/Workouts"
WHERE contains(exercises, "Bench Press")
SORT date DESC
```

## Development

```bash
npm install
npm run dev
```

Create a production bundle with:

```bash
npm run build
```

The production bundle is written to `main.js`.

## Releases

The release workflow builds the plugin when a version tag is pushed and creates a draft GitHub release containing the required Obsidian assets:

- `main.js`
- `manifest.json`
- `styles.css`

Obsidian release tags must use the exact version number without a `v` prefix, for example `0.1.0`.

## License

[MIT](LICENSE)
