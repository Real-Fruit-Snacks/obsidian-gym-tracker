import {
	App,
	ItemView,
	Modal,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
	normalizePath
} from "obsidian";

const VIEW_TYPE_GYM_TRACKER = "gym-tracker-view";

type WeightUnit = "lb" | "kg";
type SetKind = "warmup" | "working" | "drop" | "failure";
type GymTrackerTab = "workout" | "insights" | "calendar" | "routines" | "library" | "history";
type WorkoutMode = "strength" | "ruck";

interface GymTrackerSettings {
	autoCreateExerciseNotes: boolean;
	autoExportWorkouts: boolean;
	defaultExercises: string;
	defaultRestSeconds: number;
	exerciseFolder: string;
	defaultWorkoutType: string;
	exportFolder: string;
	linkExerciseNotes: boolean;
	weightUnit: WeightUnit;
}

interface WorkoutSetEntry {
	id: string;
	rir: number;
	reps: number;
	rpe: number;
	weight: number;
	type: SetKind;
	completed: boolean;
	notes: string;
}

interface ExerciseEntry {
	id: string;
	name: string;
	notes: string;
	sets: WorkoutSetEntry[];
}

interface RuckEntry {
	distance: number;
	distanceUnit: "mi" | "km";
	elevationGain: number;
	elevationUnit: "ft" | "m";
	packWeight: number;
	route: string;
	rpe: number;
}

interface WorkoutEntry {
	id: string;
	date: string;
	mode: WorkoutMode;
	type: string;
	durationMinutes: number;
	notes: string;
	ruck: RuckEntry;
	exercises: ExerciseEntry[];
	createdAt: string;
	updatedAt: string;
}

interface RoutineSetTemplate {
	id: string;
	rir: number;
	reps: number;
	rpe: number;
	weight: number;
	type: SetKind;
}

interface RoutineExerciseTemplate {
	id: string;
	name: string;
	notes: string;
	sets: RoutineSetTemplate[];
}

interface RoutineTemplate {
	id: string;
	name: string;
	type: string;
	durationMinutes: number;
	notes: string;
	exercises: RoutineExerciseTemplate[];
	createdAt: string;
	updatedAt: string;
}

interface ExerciseDefinition {
	id: string;
	name: string;
	primaryMuscle: string;
	equipment: string;
	category: string;
	notes: string;
}

interface GymTrackerData {
	exerciseLibrary: ExerciseDefinition[];
	routines: RoutineTemplate[];
	workouts: WorkoutEntry[];
}

interface PersonalRecord {
	date: string;
	exercise: string;
	kind: string;
	unit: string;
	value: number;
	workoutId: string;
}

interface ExerciseHistoryEntry {
	bestReps: number;
	bestWeight: number;
	date: string;
	estimatedOneRepMax: number;
	sets: number;
	volume: number;
	workoutId: string;
}

interface GpxImportSummary {
	distanceKilometers: number;
	durationMinutes: number;
	elevationGainMeters: number;
	name: string;
	startDate: string;
}

const DEFAULT_SETTINGS: GymTrackerSettings = {
	autoCreateExerciseNotes: false,
	autoExportWorkouts: false,
	defaultExercises: "Squat\nBench Press\nDeadlift\nOverhead Press\nBarbell Row\nPull-up",
	defaultRestSeconds: 120,
	exerciseFolder: "Gym/Exercises",
	defaultWorkoutType: "Strength",
	exportFolder: "Gym/Workouts",
	linkExerciseNotes: true,
	weightUnit: "lb"
};

const DEFAULT_EXERCISE_LIBRARY: ExerciseDefinition[] = [
	{ id: "squat", name: "Squat", primaryMuscle: "Quads", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "front-squat", name: "Front Squat", primaryMuscle: "Quads", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "goblet-squat", name: "Goblet Squat", primaryMuscle: "Quads", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "bulgarian-split-squat", name: "Bulgarian Split Squat", primaryMuscle: "Quads", equipment: "Dumbbell", category: "Unilateral", notes: "" },
	{ id: "walking-lunge", name: "Walking Lunge", primaryMuscle: "Quads", equipment: "Dumbbell", category: "Unilateral", notes: "" },
	{ id: "bench-press", name: "Bench Press", primaryMuscle: "Chest", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "incline-bench-press", name: "Incline Bench Press", primaryMuscle: "Chest", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "dumbbell-bench-press", name: "Dumbbell Bench Press", primaryMuscle: "Chest", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "incline-dumbbell-press", name: "Incline Dumbbell Press", primaryMuscle: "Chest", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "dumbbell-fly", name: "Dumbbell Fly", primaryMuscle: "Chest", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "deadlift", name: "Deadlift", primaryMuscle: "Posterior chain", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "romanian-deadlift", name: "Romanian Deadlift", primaryMuscle: "Hamstrings", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "dumbbell-romanian-deadlift", name: "Dumbbell Romanian Deadlift", primaryMuscle: "Hamstrings", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "hip-thrust", name: "Hip Thrust", primaryMuscle: "Glutes", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "overhead-press", name: "Overhead Press", primaryMuscle: "Shoulders", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", primaryMuscle: "Shoulders", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "arnold-press", name: "Arnold Press", primaryMuscle: "Shoulders", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "lateral-raise", name: "Lateral Raise", primaryMuscle: "Shoulders", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "rear-delt-fly", name: "Rear Delt Fly", primaryMuscle: "Rear delts", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "barbell-row", name: "Barbell Row", primaryMuscle: "Back", equipment: "Barbell", category: "Compound", notes: "" },
	{ id: "one-arm-dumbbell-row", name: "One-Arm Dumbbell Row", primaryMuscle: "Back", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "chest-supported-row", name: "Chest-Supported Row", primaryMuscle: "Back", equipment: "Dumbbell", category: "Compound", notes: "" },
	{ id: "barbell-curl", name: "Barbell Curl", primaryMuscle: "Biceps", equipment: "Barbell", category: "Isolation", notes: "" },
	{ id: "dumbbell-curl", name: "Dumbbell Curl", primaryMuscle: "Biceps", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "hammer-curl", name: "Hammer Curl", primaryMuscle: "Biceps", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "skull-crusher", name: "Skull Crusher", primaryMuscle: "Triceps", equipment: "Barbell", category: "Isolation", notes: "" },
	{ id: "dumbbell-triceps-extension", name: "Dumbbell Triceps Extension", primaryMuscle: "Triceps", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "calf-raise", name: "Calf Raise", primaryMuscle: "Calves", equipment: "Dumbbell", category: "Isolation", notes: "" },
	{ id: "leg-press", name: "Leg Press", primaryMuscle: "Quads", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "hack-squat", name: "Hack Squat", primaryMuscle: "Quads", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "leg-extension", name: "Leg Extension", primaryMuscle: "Quads", equipment: "Machine", category: "Isolation", notes: "" },
	{ id: "seated-leg-curl", name: "Seated Leg Curl", primaryMuscle: "Hamstrings", equipment: "Machine", category: "Isolation", notes: "" },
	{ id: "lying-leg-curl", name: "Lying Leg Curl", primaryMuscle: "Hamstrings", equipment: "Machine", category: "Isolation", notes: "" },
	{ id: "machine-chest-press", name: "Machine Chest Press", primaryMuscle: "Chest", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "pec-deck", name: "Pec Deck", primaryMuscle: "Chest", equipment: "Machine", category: "Isolation", notes: "" },
	{ id: "lat-pulldown", name: "Lat Pulldown", primaryMuscle: "Back", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "seated-cable-row", name: "Seated Cable Row", primaryMuscle: "Back", equipment: "Cable", category: "Compound", notes: "" },
	{ id: "machine-row", name: "Machine Row", primaryMuscle: "Back", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "machine-shoulder-press", name: "Machine Shoulder Press", primaryMuscle: "Shoulders", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "cable-lateral-raise", name: "Cable Lateral Raise", primaryMuscle: "Shoulders", equipment: "Cable", category: "Isolation", notes: "" },
	{ id: "face-pull", name: "Face Pull", primaryMuscle: "Rear delts", equipment: "Cable", category: "Isolation", notes: "" },
	{ id: "cable-curl", name: "Cable Curl", primaryMuscle: "Biceps", equipment: "Cable", category: "Isolation", notes: "" },
	{ id: "triceps-pushdown", name: "Triceps Pushdown", primaryMuscle: "Triceps", equipment: "Cable", category: "Isolation", notes: "" },
	{ id: "cable-crunch", name: "Cable Crunch", primaryMuscle: "Abs", equipment: "Cable", category: "Core", notes: "" },
	{ id: "assisted-pull-up", name: "Assisted Pull-up", primaryMuscle: "Back", equipment: "Machine", category: "Compound", notes: "" },
	{ id: "pull-up", name: "Pull-up", primaryMuscle: "Back", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "chin-up", name: "Chin-up", primaryMuscle: "Back", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "push-up", name: "Push-up", primaryMuscle: "Chest", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "dip", name: "Dip", primaryMuscle: "Triceps", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "inverted-row", name: "Inverted Row", primaryMuscle: "Back", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "bodyweight-squat", name: "Bodyweight Squat", primaryMuscle: "Quads", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "glute-bridge", name: "Glute Bridge", primaryMuscle: "Glutes", equipment: "Bodyweight", category: "Compound", notes: "" },
	{ id: "plank", name: "Plank", primaryMuscle: "Abs", equipment: "Bodyweight", category: "Core", notes: "" },
	{ id: "hanging-leg-raise", name: "Hanging Leg Raise", primaryMuscle: "Abs", equipment: "Bodyweight", category: "Core", notes: "" }
];

const SET_TYPES: Array<{ label: string; value: SetKind }> = [
	{ label: "Working", value: "working" },
	{ label: "Warm-up", value: "warmup" },
	{ label: "Drop", value: "drop" },
	{ label: "Failure", value: "failure" }
];

const TRACKER_TABS: Array<{ id: GymTrackerTab; label: string }> = [
	{ id: "workout", label: "Workout" },
	{ id: "insights", label: "Insights" },
	{ id: "calendar", label: "Calendar" },
	{ id: "routines", label: "Routines" },
	{ id: "library", label: "Library" },
	{ id: "history", label: "History" }
];

export default class GymTrackerPlugin extends Plugin {
	settings: GymTrackerSettings = DEFAULT_SETTINGS;
	data: GymTrackerData = createDefaultTrackerData();

	async onload() {
		await this.loadSettings();
		await this.loadWorkoutData();

		this.registerView(
			VIEW_TYPE_GYM_TRACKER,
			(leaf) => new GymTrackerView(leaf, this)
		);

		this.addRibbonIcon("dumbbell", "Open Gym Tracker", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-gym-tracker",
			name: "Open gym tracker",
			callback: () => {
				void this.activateView();
			}
		});

		this.addCommand({
			id: "export-latest-workout",
			name: "Export latest workout to note",
			callback: () => {
				void this.exportLatestWorkout();
			}
		});

		this.addCommand({
			id: "export-tracker-backup",
			name: "Export tracker backup JSON",
			callback: () => {
				void this.exportTrackerBackup();
			}
		});

		this.addCommand({
			id: "load-demo-data",
			name: "Load demo data",
			callback: () => {
				this.confirmLoadDemoData();
			}
		});

		this.addCommand({
			id: "clear-tracker-data",
			name: "Clear tracker data",
			callback: () => {
				this.confirmClearTrackerData();
			}
		});

		this.addSettingTab(new GymTrackerSettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_GYM_TRACKER);
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_GYM_TRACKER);
		const leaf = Platform.isMobileApp ? this.app.workspace.getLeaf(false) : this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_GYM_TRACKER, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const loaded = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...(isRecord(loaded?.settings) ? loaded.settings : {})
		};
	}

	async saveSettings() {
		await this.savePluginState();
	}

	async loadWorkoutData() {
		const loaded = await this.loadData();
		this.data = normalizeTrackerData(loaded?.data);
		this.sortData();
	}

	async saveWorkout(workout: WorkoutEntry) {
		const now = new Date().toISOString();
		const cleanWorkout: WorkoutEntry = {
			...workout,
			mode: normalizeWorkoutMode(workout.mode),
			type: workout.type.trim() || this.settings.defaultWorkoutType,
			notes: workout.notes.trim(),
			durationMinutes: Math.max(0, Number(workout.durationMinutes) || 0),
			ruck: normalizeDraftRuck(workout.ruck),
			exercises: workout.exercises
				.map(normalizeDraftExercise)
				.filter((exercise) => exercise.name.length > 0 && exercise.sets.length > 0),
			updatedAt: now
		};

		if (cleanWorkout.mode === "strength" && cleanWorkout.exercises.length === 0) {
			new Notice("Add at least one exercise before saving.");
			return false;
		}

		if (cleanWorkout.mode === "ruck" && (cleanWorkout.ruck.distance <= 0 || cleanWorkout.durationMinutes <= 0)) {
			new Notice("Add ruck distance and duration before saving.");
			return false;
		}

		const existingIndex = this.data.workouts.findIndex((entry) => entry.id === cleanWorkout.id);
		if (existingIndex >= 0) {
			this.data.workouts[existingIndex] = cleanWorkout;
		} else {
			this.data.workouts.unshift(cleanWorkout);
		}

		this.sortData();
		await this.savePluginState();

		if (this.settings.autoExportWorkouts) {
			await this.exportWorkout(cleanWorkout, true);
		}

		if (this.settings.autoCreateExerciseNotes) {
			await this.createExerciseNotesForWorkout(cleanWorkout);
		}

		this.refreshViews();
		new Notice("Workout saved.");
		return true;
	}

	async saveRoutineFromWorkout(workout: WorkoutEntry, name: string) {
		const cleanName = name.trim();
		if (!cleanName) {
			new Notice("Name the routine before saving.");
			return false;
		}

		const now = new Date().toISOString();
		const existingIndex = this.data.routines.findIndex(
			(routine) => routine.name.toLowerCase() === cleanName.toLowerCase()
		);
		const existing = existingIndex >= 0 ? this.data.routines[existingIndex] : null;
		const routine: RoutineTemplate = {
			id: existing?.id ?? createId(),
			name: cleanName,
			type: workout.type.trim() || this.settings.defaultWorkoutType,
			durationMinutes: Math.max(0, Number(workout.durationMinutes) || 0),
			notes: workout.notes.trim(),
			exercises: workout.exercises
				.map((exercise) => ({
					id: createId(),
					name: exercise.name.trim(),
					notes: exercise.notes.trim(),
					sets: exercise.sets
						.map((set) => ({
							id: createId(),
							rir: Math.max(0, Number(set.rir) || 0),
							reps: Math.max(0, Number(set.reps) || 0),
							rpe: Math.max(0, Number(set.rpe) || 0),
							weight: Math.max(0, Number(set.weight) || 0),
							type: normalizeSetKind(set.type)
						}))
						.filter((set) => set.reps > 0 || set.weight > 0)
				}))
				.filter((exercise) => exercise.name.length > 0 && exercise.sets.length > 0),
			createdAt: existing?.createdAt ?? now,
			updatedAt: now
		};

		if (routine.exercises.length === 0) {
			new Notice("Add at least one exercise before saving a routine.");
			return false;
		}

		if (existingIndex >= 0) {
			this.data.routines[existingIndex] = routine;
		} else {
			this.data.routines.push(routine);
		}

		this.sortData();
		await this.savePluginState();
		this.refreshViews();
		new Notice("Routine saved.");
		return true;
	}

	async saveExerciseDefinition(exercise: ExerciseDefinition) {
		const clean: ExerciseDefinition = {
			id: exercise.id || createId(),
			name: exercise.name.trim(),
			primaryMuscle: exercise.primaryMuscle.trim(),
			equipment: exercise.equipment.trim(),
			category: exercise.category.trim(),
			notes: exercise.notes.trim()
		};

		if (!clean.name) {
			new Notice("Name the exercise before saving.");
			return false;
		}

		const existingIndex = this.data.exerciseLibrary.findIndex(
			(entry) => entry.id === clean.id || entry.name.toLowerCase() === clean.name.toLowerCase()
		);

		if (existingIndex >= 0) {
			clean.id = this.data.exerciseLibrary[existingIndex].id;
			this.data.exerciseLibrary[existingIndex] = clean;
		} else {
			this.data.exerciseLibrary.push(clean);
		}

		this.sortData();
		await this.savePluginState();
		this.refreshViews();
		new Notice("Exercise saved.");
		return true;
	}

	async deleteExerciseDefinition(exerciseId: string) {
		this.data.exerciseLibrary = this.data.exerciseLibrary.filter((exercise) => exercise.id !== exerciseId);
		await this.savePluginState();
		this.refreshViews();
		new Notice("Exercise deleted.");
	}

	async deleteRoutine(routineId: string) {
		this.data.routines = this.data.routines.filter((routine) => routine.id !== routineId);
		await this.savePluginState();
		this.refreshViews();
		new Notice("Routine deleted.");
	}

	async deleteWorkout(workoutId: string) {
		this.data.workouts = this.data.workouts.filter((workout) => workout.id !== workoutId);
		await this.savePluginState();
		this.refreshViews();
		new Notice("Workout deleted.");
	}

	async exportLatestWorkout() {
		const latestWorkout = this.getSortedWorkouts()[0];
		if (!latestWorkout) {
			new Notice("No workouts to export yet.");
			return;
		}

		await this.exportWorkout(latestWorkout);
	}

	async exportTrackerBackup() {
		const folder = normalizePath(this.settings.exportFolder.trim() || "Gym/Workouts");
		await this.ensureFolder(folder);

		const path = normalizePath(`${folder}/gym-tracker-backup-${getTodayDate()}.json`);
		const backup = JSON.stringify(
			{
				exportedAt: new Date().toISOString(),
				settings: this.settings,
				data: this.data
			},
			null,
			2
		);
		const existing = this.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, backup);
		} else {
			await this.app.vault.create(path, backup);
		}

		new Notice(`Exported ${path}`);
	}

	async exportWorkout(workout: WorkoutEntry, silent = false) {
		const folder = normalizePath(this.settings.exportFolder.trim() || "Gym/Workouts");
		await this.ensureFolder(folder);

		const safeType = workout.type.replace(/[\\/#^|[\]:]/g, "").trim() || "Workout";
		const path = normalizePath(`${folder}/${workout.date} ${safeType}.md`);
		const markdown = this.formatWorkoutMarkdown(workout);
		const existing = this.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, markdown);
		} else {
			await this.app.vault.create(path, markdown);
		}

		if (!silent) {
			new Notice(`Exported ${path}`);
		}
	}

	formatWorkoutMarkdown(workout: WorkoutEntry) {
		const volume = calculateWorkoutVolume(workout);
		const exerciseNames = workout.exercises.map((exercise) => exercise.name);
		const records = collectPersonalRecords(this.getSortedWorkouts()).filter(
			(record) => record.workoutId === workout.id
		);
		const pace = calculateRuckPace(workout);
		if (workout.mode === "ruck") {
			return [
				"---",
				"record_type: workout",
				"workout_mode: ruck",
				`date: ${workout.date}`,
				`workout_type: ${quoteYaml(workout.type)}`,
				`duration_minutes: ${workout.durationMinutes}`,
				`distance: ${workout.ruck.distance}`,
				`distance_unit: ${workout.ruck.distanceUnit}`,
				`pack_weight: ${workout.ruck.packWeight}`,
				`elevation_gain: ${workout.ruck.elevationGain}`,
				`elevation_unit: ${workout.ruck.elevationUnit}`,
				`pace_minutes_per_${workout.ruck.distanceUnit}: ${pace}`,
				`route: ${quoteYaml(workout.ruck.route)}`,
				`rpe: ${workout.ruck.rpe}`,
				"tags:",
				"  - gym/workout",
				"  - gym/ruck",
				"---",
				"",
				`# ${workout.date} ${workout.type}`,
				"",
				`Duration: ${workout.durationMinutes} minutes`,
				`Distance: ${workout.ruck.distance} ${workout.ruck.distanceUnit}`,
				`Pack weight: ${workout.ruck.packWeight} ${this.settings.weightUnit}`,
				`Pace: ${pace} min/${workout.ruck.distanceUnit}`,
				`Elevation: ${workout.ruck.elevationGain} ${workout.ruck.elevationUnit}`,
				`Route: ${workout.ruck.route || "-"}`,
				`RPE: ${workout.ruck.rpe || "-"}`,
				`Load distance: ${calculateRuckLoadDistance(workout)} ${this.settings.weightUnit}-${workout.ruck.distanceUnit}`,
				"",
				"## Notes",
				"",
				workout.notes || "-"
			].join("\n");
		}

		const rows = workout.exercises.flatMap((exercise) =>
			exercise.sets.map((set, index) => {
				const setVolume = calculateSetVolume(set);
				return `| ${escapeTableCell(this.formatExerciseLink(exercise.name))} | ${index + 1} | ${formatSetKind(set.type)} | ${set.reps} | ${set.weight} ${this.settings.weightUnit} | ${set.rpe || ""} | ${set.rir || ""} | ${setVolume} | ${set.completed ? "yes" : "no"} | ${escapeTableCell(set.notes || exercise.notes)} |`;
			})
		);

		return [
			"---",
			"record_type: workout",
			`workout_mode: ${workout.mode}`,
			`date: ${workout.date}`,
			`workout_type: ${quoteYaml(workout.type)}`,
			`duration_minutes: ${workout.durationMinutes}`,
			`volume: ${volume}`,
			`set_count: ${countCompletedSets(workout)}`,
			`exercise_count: ${workout.exercises.length}`,
			"exercises:",
			...exerciseNames.map((name) => `  - ${quoteYaml(name)}`),
			"tags:",
			"  - gym/workout",
			"---",
			"",
			`# ${workout.date} ${workout.type}`,
			"",
			`Duration: ${workout.durationMinutes} minutes`,
			`Volume: ${volume} ${this.settings.weightUnit}`,
			`Completed sets: ${countCompletedSets(workout)}`,
			"",
			"## Exercises",
			"",
			"| Exercise | Set | Type | Reps | Weight | RPE | RIR | Volume | Done | Notes |",
			"| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
			...rows,
			"",
			"## Records",
			"",
			...(records.length
				? records.map((record) => `- ${record.exercise}: ${record.kind} ${record.value} ${record.unit}`)
				: ["-"]),
			"",
			"## Notes",
			"",
			workout.notes || "-"
		].join("\n");
	}

	formatExerciseLink(name: string) {
		return this.settings.linkExerciseNotes ? `[[${name}]]` : name;
	}

	getSortedRoutines() {
		return [...this.data.routines].sort((a, b) => a.name.localeCompare(b.name));
	}

	getSortedExerciseLibrary() {
		return [...this.data.exerciseLibrary].sort((a, b) => a.name.localeCompare(b.name));
	}

	getSortedWorkouts() {
		return [...this.data.workouts].sort(compareWorkoutsDesc);
	}

	async loadDemoData() {
		this.data = createDemoTrackerData(this.settings.weightUnit);
		this.sortData();
		await this.savePluginState();
		this.refreshViews();
		new Notice(`Loaded ${this.data.workouts.length} demo workouts and ${this.data.routines.length} routines.`);
	}

	async clearTrackerData() {
		this.data = createDefaultTrackerData();
		await this.savePluginState();
		this.refreshViews();
		new Notice("Tracker data cleared.");
	}

	confirmLoadDemoData(onComplete?: () => void) {
		new ConfirmModal(
			this.app,
			"Load demo data?",
			"This will replace current workouts and routines with fake chart-testing data.",
			() => {
				void this.loadDemoData().then(() => onComplete?.());
			},
			"Load demo"
		).open();
	}

	confirmClearTrackerData(onComplete?: () => void) {
		new ConfirmModal(
			this.app,
			"Clear tracker data?",
			"This will remove workouts and routines, then restore the default exercise library.",
			() => {
				void this.clearTrackerData().then(() => onComplete?.());
			},
			"Clear"
		).open();
	}

	refreshViews() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_GYM_TRACKER).forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof GymTrackerView) {
				view.render();
			}
		});
	}

	private sortData() {
		this.data.workouts.sort(compareWorkoutsDesc);
		this.data.routines.sort((a, b) => a.name.localeCompare(b.name));
		this.data.exerciseLibrary.sort((a, b) => a.name.localeCompare(b.name));
	}

	private async savePluginState() {
		await this.saveData({
			settings: this.settings,
			data: this.data
		});
	}

	private async ensureFolder(folderPath: string) {
		const parts = folderPath.split("/").filter(Boolean);
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (!existing) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private async createExerciseNotesForWorkout(workout: WorkoutEntry) {
		const folder = normalizePath(this.settings.exerciseFolder.trim() || DEFAULT_SETTINGS.exerciseFolder);
		await this.ensureFolder(folder);
		const uniqueExercises = uniqueStrings(workout.exercises.map((exercise) => exercise.name));

		for (const exerciseName of uniqueExercises) {
			const path = normalizePath(`${folder}/${sanitizeFileName(exerciseName)}.md`);
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing) {
				continue;
			}

			await this.app.vault.create(path, formatExerciseNote(exerciseName, this.data.exerciseLibrary, this.settings.exportFolder));
		}
	}
}

class GymTrackerView extends ItemView {
	private activeTab: GymTrackerTab = "workout";
	private plugin: GymTrackerPlugin;
	private activeWorkout: WorkoutEntry;
	private routineDraftName = "";
	private selectedRoutineId = "";
	private selectedExerciseName = "";
	private calendarCursor = getStartOfMonth(new Date());
	private selectedCalendarDate = getTodayDate();
	private libraryFilter = "";
	private timerInterval: number | null = null;
	private timerRemainingSeconds = 0;
	private timerRunning = false;
	private timerPanelEl: HTMLElement | null = null;
	private timerStateEl: HTMLElement | null = null;
	private timerTextEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GymTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.activeWorkout = createEmptyWorkout(this.plugin);
		this.timerRemainingSeconds = this.plugin.settings.defaultRestSeconds;
	}

	getViewType() {
		return VIEW_TYPE_GYM_TRACKER;
	}

	getDisplayText() {
		return "Gym Tracker";
	}

	getIcon() {
		return "dumbbell";
	}

	async onOpen() {
		this.render();
	}

	async onClose() {
		this.stopTimerInterval();
	}

	render() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("gym-tracker-view");

		const shell = containerEl.createDiv({ cls: "gym-shell" });
		this.renderHeader(shell);
		this.renderTabs(shell);

		const content = shell.createDiv({ cls: `gym-tab-content gym-tab-${this.activeTab}` });

		if (this.activeTab === "workout") {
			const grid = content.createDiv({ cls: "gym-grid gym-workout-grid" });
			const formPane = grid.createDiv({ cls: "gym-panel gym-form-panel" });
			const side = grid.createDiv({ cls: "gym-side gym-workout-side" });
			this.renderWorkoutForm(formPane);
			this.renderRestTimer(side);
			this.renderStats(side);
			return;
		}

		if (this.activeTab === "insights") {
			const grid = content.createDiv({ cls: "gym-panel-grid" });
			this.renderStats(grid);
			this.renderTrends(grid);
			this.renderExerciseInsights(grid);
			this.renderRecords(grid);
			return;
		}

		if (this.activeTab === "calendar") {
			this.renderCalendar(content);
			return;
		}

		if (this.activeTab === "routines") {
			this.renderRoutines(content);
			return;
		}

		if (this.activeTab === "library") {
			this.renderExerciseLibrary(content);
			return;
		}

		this.renderHistory(content);
	}

	private renderHeader(parent: HTMLElement) {
		const header = parent.createDiv({ cls: "gym-header" });
		const titleGroup = header.createDiv();
		titleGroup.createEl("h2", { text: "Gym Tracker" });
		titleGroup.createEl("p", { text: "Log sets, routines, records, and notes without leaving your vault." });

		const actions = header.createDiv({ cls: "gym-header-actions" });
		const newButton = actions.createEl("button", { text: "New workout", cls: "mod-cta" });
		newButton.addEventListener("click", () => {
			this.activeWorkout = createEmptyWorkout(this.plugin);
			this.routineDraftName = "";
			this.render();
		});

		const exportButton = actions.createEl("button", { text: "Export latest" });
		exportButton.addEventListener("click", () => {
			void this.plugin.exportLatestWorkout();
		});
	}

	private renderTabs(parent: HTMLElement) {
		const tabs = parent.createDiv({ cls: "gym-tabs" });
		TRACKER_TABS.forEach((tab) => {
			const button = tabs.createEl("button", {
				text: tab.label,
				cls: tab.id === this.activeTab ? "gym-tab is-active" : "gym-tab"
			});
			button.setAttr("aria-pressed", String(tab.id === this.activeTab));
			button.addEventListener("click", () => {
				this.activeTab = tab.id;
				this.render();
			});
		});
	}

	private renderWorkoutForm(parent: HTMLElement) {
		const form = parent.createDiv({ cls: "gym-workout-form" });
		const heading = form.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Workout" });
		heading.createEl("span", { text: this.routineDraftName ? `Editing ${this.routineDraftName}` : "Draft" });

		this.renderRoutinePicker(form);

		const fields = form.createDiv({ cls: "gym-field-grid" });
		const modeSelect = createLabeledSelect(fields, "Mode", this.activeWorkout.mode, [
			{ label: "Strength", value: "strength" },
			{ label: "Ruck", value: "ruck" }
		]);
		modeSelect.addEventListener("change", () => {
			this.activeWorkout.mode = normalizeWorkoutMode(modeSelect.value);
			if (this.activeWorkout.mode === "ruck" && this.activeWorkout.type === this.plugin.settings.defaultWorkoutType) {
				this.activeWorkout.type = "Ruck";
			}
			this.render();
		});

		const dateInput = createLabeledInput(fields, "Date", "date", this.activeWorkout.date);
		dateInput.addEventListener("input", () => {
			this.activeWorkout.date = dateInput.value;
		});

		const typeInput = createLabeledInput(fields, "Type", "text", this.activeWorkout.type);
		typeInput.placeholder = "Strength, Push, Legs...";
		typeInput.addEventListener("input", () => {
			this.activeWorkout.type = typeInput.value;
		});

		const durationInput = createLabeledInput(fields, "Minutes", "number", String(this.activeWorkout.durationMinutes));
		durationInput.min = "0";
		durationInput.inputMode = "numeric";
		durationInput.addEventListener("input", () => {
			this.activeWorkout.durationMinutes = Number(durationInput.value) || 0;
		});

		const notesLabel = form.createEl("label", { cls: "gym-label" });
		notesLabel.createSpan({ text: "Notes" });
		const notes = notesLabel.createEl("textarea", { cls: "gym-textarea" });
		notes.placeholder = "Energy, soreness, PRs, form cues...";
		notes.value = this.activeWorkout.notes;
		notes.addEventListener("input", () => {
			this.activeWorkout.notes = notes.value;
		});

		if (this.activeWorkout.mode === "ruck") {
			this.renderRuckFields(form);
			this.renderWorkoutFooter(form, false);
			return;
		}

		const exerciseHeader = form.createDiv({ cls: "gym-section-heading" });
		exerciseHeader.createEl("h3", { text: "Exercises" });
		const addButton = exerciseHeader.createEl("button", { text: "Add exercise" });
		addButton.addEventListener("click", () => {
			this.activeWorkout.exercises.push(createEmptyExercise(this.getNextDefaultExercise()));
			this.render();
		});

		const exerciseList = form.createDiv({ cls: "gym-exercise-list" });
		const datalist = form.createEl("datalist");
		datalist.id = "gym-default-exercises";
		getDefaultExercises(this.plugin).forEach((exerciseName) => {
			datalist.createEl("option", { attr: { value: exerciseName } });
		});

		this.activeWorkout.exercises.forEach((exercise, index) => {
			this.renderExerciseCard(exerciseList, exercise, index);
		});

		this.renderWorkoutFooter(form, true);
	}

	private renderRuckFields(parent: HTMLElement) {
		const heading = parent.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Ruck Details" });
		const importGpx = heading.createEl("button", { text: "Import GPX", cls: "gym-action-export" });
		importGpx.addEventListener("click", () => {
			this.importGpxFile();
		});

		const fields = parent.createDiv({ cls: "gym-ruck-grid" });
		const distance = createLabeledInput(fields, "Distance", "number", String(this.activeWorkout.ruck.distance || ""));
		distance.min = "0";
		distance.step = "0.01";
		distance.inputMode = "decimal";
		distance.addEventListener("input", () => {
			this.activeWorkout.ruck.distance = Number(distance.value) || 0;
			updateRuckSummary();
		});

		const distanceUnit = createLabeledSelect(fields, "Distance unit", this.activeWorkout.ruck.distanceUnit, [
			{ label: "Miles", value: "mi" },
			{ label: "Kilometers", value: "km" }
		]);
		distanceUnit.addEventListener("change", () => {
			this.activeWorkout.ruck.distanceUnit = distanceUnit.value === "km" ? "km" : "mi";
			updateRuckSummary();
		});

		const packWeight = createLabeledInput(fields, `Pack weight (${this.plugin.settings.weightUnit})`, "number", String(this.activeWorkout.ruck.packWeight || ""));
		packWeight.min = "0";
		packWeight.step = "0.5";
		packWeight.inputMode = "decimal";
		packWeight.addEventListener("input", () => {
			this.activeWorkout.ruck.packWeight = Number(packWeight.value) || 0;
			updateRuckSummary();
		});

		const elevation = createLabeledInput(fields, "Elevation gain", "number", String(this.activeWorkout.ruck.elevationGain || ""));
		elevation.min = "0";
		elevation.step = "1";
		elevation.inputMode = "numeric";
		elevation.addEventListener("input", () => {
			this.activeWorkout.ruck.elevationGain = Number(elevation.value) || 0;
		});

		const elevationUnit = createLabeledSelect(fields, "Elevation unit", this.activeWorkout.ruck.elevationUnit, [
			{ label: "Feet", value: "ft" },
			{ label: "Meters", value: "m" }
		]);
		elevationUnit.addEventListener("change", () => {
			this.activeWorkout.ruck.elevationUnit = elevationUnit.value === "m" ? "m" : "ft";
		});

		const rpe = createLabeledInput(fields, "RPE", "number", this.activeWorkout.ruck.rpe ? String(this.activeWorkout.ruck.rpe) : "");
		rpe.min = "0";
		rpe.max = "10";
		rpe.step = "0.5";
		rpe.inputMode = "decimal";
		rpe.addEventListener("input", () => {
			this.activeWorkout.ruck.rpe = clampNumber(Number(rpe.value) || 0, 0, 10);
		});

		const routeLabel = parent.createEl("label", { cls: "gym-label" });
		routeLabel.createSpan({ text: "Route" });
		const route = routeLabel.createEl("textarea", { cls: "gym-textarea gym-ruck-route" });
		route.placeholder = "Trail, neighborhood loop, treadmill incline...";
		route.value = this.activeWorkout.ruck.route;
		route.addEventListener("input", () => {
			this.activeWorkout.ruck.route = route.value;
		});

		const summary = parent.createDiv({ cls: "gym-ruck-summary" });
		const paceValue = createStat(summary, "Pace", "");
		const loadDistanceValue = createStat(summary, "Load distance", "");
		const updateRuckSummary = () => {
			paceValue.setText(`${calculateRuckPace(this.activeWorkout) || 0} min/${this.activeWorkout.ruck.distanceUnit}`);
			loadDistanceValue.setText(`${calculateRuckLoadDistance(this.activeWorkout)} ${this.plugin.settings.weightUnit}-${this.activeWorkout.ruck.distanceUnit}`);
		};
		updateRuckSummary();
	}

	private renderWorkoutFooter(form: HTMLElement, allowRoutine: boolean) {
		const footer = form.createDiv({ cls: "gym-form-footer" });
		const volume = footer.createDiv({ cls: "gym-volume-chip" });
		volume.createSpan({ text: this.activeWorkout.mode === "ruck" ? "Distance" : "Volume" });
		volume.createEl("strong", {
			text: this.activeWorkout.mode === "ruck"
				? `${this.activeWorkout.ruck.distance || 0} ${this.activeWorkout.ruck.distanceUnit}`
				: `${calculateWorkoutVolume(this.activeWorkout)} ${this.plugin.settings.weightUnit}`
		});

		const footerActions = footer.createDiv({ cls: "gym-footer-actions" });
		if (allowRoutine) {
			const routineButton = footerActions.createEl("button", { text: this.routineDraftName ? "Update routine" : "Save routine" });
			routineButton.addEventListener("click", () => {
				this.openRoutineModal();
			});
		}

		const saveButton = footerActions.createEl("button", { text: "Save workout", cls: "mod-cta" });
		saveButton.addEventListener("click", async () => {
			const saved = await this.plugin.saveWorkout(this.activeWorkout);
			if (saved) {
				this.activeWorkout = createEmptyWorkout(this.plugin);
				this.routineDraftName = "";
				this.render();
			}
		});
	}

	private renderRoutinePicker(parent: HTMLElement) {
		const routines = this.plugin.getSortedRoutines();
		const bar = parent.createDiv({ cls: "gym-routine-bar" });

		if (!routines.some((routine) => routine.id === this.selectedRoutineId)) {
			this.selectedRoutineId = "";
		}

		const select = createLabeledSelect(
			bar,
			"Routine",
			this.selectedRoutineId,
			routines.length > 0
				? [
					{ label: "Load routine...", value: "" },
					...routines.map((routine) => ({ label: routine.name, value: routine.id }))
				]
				: [{ label: "No routines saved", value: "" }]
		);
		select.disabled = routines.length === 0;
		select.addEventListener("change", () => {
			this.selectedRoutineId = select.value;
		});

		const actions = bar.createDiv({ cls: "gym-routine-actions" });
		const load = actions.createEl("button", { text: "Load" });
		load.disabled = routines.length === 0;
		load.addEventListener("click", () => {
			const routine = routines.find((entry) => entry.id === this.selectedRoutineId);
			if (!routine) {
				new Notice("Choose a routine to load.");
				return;
			}

			const loadRoutine = () => {
				this.activeWorkout = createWorkoutFromRoutine(this.plugin, routine);
				this.routineDraftName = "";
				this.render();
			};

			if (isWorkoutDraftDirty(this.activeWorkout, this.plugin)) {
				new ConfirmModal(
					this.app,
					"Load routine?",
					"Your current workout draft will be replaced.",
					loadRoutine,
					"Load"
				).open();
			} else {
				loadRoutine();
			}
		});

		const create = actions.createEl("button", { text: "New routine" });
		create.addEventListener("click", () => {
			this.startRoutineDraft();
		});

		if (routines.length === 0) {
			return;
		}
	}

	private renderExerciseCard(parent: HTMLElement, exercise: ExerciseEntry, index: number) {
		const row = parent.createDiv({ cls: "gym-exercise-card" });
		const top = row.createDiv({ cls: "gym-exercise-top" });
		top.createEl("span", { text: `#${index + 1}`, cls: "gym-exercise-number" });

		const removeButton = top.createEl("button", { text: "Remove", cls: "gym-action-remove" });
		removeButton.addEventListener("click", () => {
			const exerciseName = exercise.name.trim() || `exercise #${index + 1}`;
			this.confirmDelete("Remove exercise?", `${exerciseName} and its sets will be removed from this draft.`, () => {
				this.activeWorkout.exercises = this.activeWorkout.exercises.filter((entry) => entry.id !== exercise.id);
				this.render();
			}, "Remove");
		});

		const fields = row.createDiv({ cls: "gym-exercise-meta" });
		const name = createLabeledInput(fields, "Exercise", "text", exercise.name);
		name.setAttr("list", "gym-default-exercises");
		name.addEventListener("input", () => {
			exercise.name = name.value;
		});

		const exerciseNotes = createLabeledInput(fields, "Exercise notes", "text", exercise.notes);
		exerciseNotes.placeholder = "Cues, machine setting, soreness...";
		exerciseNotes.addEventListener("input", () => {
			exercise.notes = exerciseNotes.value;
		});

		const setHeader = row.createDiv({ cls: "gym-set-heading" });
		setHeader.createEl("strong", { text: "Sets" });
		const addSetButton = setHeader.createEl("button", { text: "Add set" });
		addSetButton.addEventListener("click", () => {
			exercise.sets.push(cloneSetTemplate(exercise.sets[exercise.sets.length - 1]));
			this.render();
		});

		const setList = row.createDiv({ cls: "gym-set-list" });
		exercise.sets.forEach((set, setIndex) => {
			this.renderSetRow(setList, exercise, set, setIndex);
		});
	}

	private renderSetRow(parent: HTMLElement, exercise: ExerciseEntry, set: WorkoutSetEntry, index: number) {
		const row = parent.createDiv({ cls: "gym-set-row" });
		row.createEl("span", { text: `Set ${index + 1}`, cls: "gym-set-number" });

		const typeSelect = createLabeledSelect(row, "Type", set.type, SET_TYPES);
		typeSelect.addEventListener("change", () => {
			set.type = normalizeSetKind(typeSelect.value);
		});

		const reps = createLabeledInput(row, "Reps", "number", String(set.reps));
		reps.min = "0";
		reps.inputMode = "numeric";
		reps.addEventListener("input", () => {
			set.reps = Number(reps.value) || 0;
		});

		const weight = createLabeledInput(row, `Weight (${this.plugin.settings.weightUnit})`, "number", String(set.weight));
		weight.min = "0";
		weight.step = "0.5";
		weight.inputMode = "decimal";
		weight.addEventListener("input", () => {
			set.weight = Number(weight.value) || 0;
		});

		const rpe = createLabeledInput(row, "RPE", "number", set.rpe ? String(set.rpe) : "");
		rpe.min = "0";
		rpe.max = "10";
		rpe.step = "0.5";
		rpe.inputMode = "decimal";
		rpe.addEventListener("input", () => {
			set.rpe = clampNumber(Number(rpe.value) || 0, 0, 10);
		});

		const rir = createLabeledInput(row, "RIR", "number", set.rir ? String(set.rir) : "");
		rir.min = "0";
		rir.max = "10";
		rir.step = "1";
		rir.inputMode = "numeric";
		rir.addEventListener("input", () => {
			set.rir = clampNumber(Number(rir.value) || 0, 0, 10);
		});

		const completed = row.createEl("label", { cls: "gym-check-label" });
		completed.createSpan({ text: "Done" });
		const checkbox = completed.createEl("input", { type: "checkbox" });
		checkbox.checked = set.completed;
		checkbox.addEventListener("change", () => {
			set.completed = checkbox.checked;
		});

		const notes = createLabeledInput(row, "Set notes", "text", set.notes);
		notes.placeholder = "RPE, spotter, form...";
		notes.addEventListener("input", () => {
			set.notes = notes.value;
		});

		const setActions = row.createDiv({ cls: "gym-set-actions" });
		const restButton = setActions.createEl("button", {
			text: "Rest",
			cls: "gym-compact-button gym-set-rest"
		});
		restButton.setAttr("aria-label", "Start rest timer");
		restButton.setAttr("title", "Start rest timer");
		restButton.addEventListener("click", () => {
			this.startRestTimer();
			this.render();
			this.scrollToRestTimer();
		});

		const removeButton = setActions.createEl("button", {
			text: "Remove",
			cls: "gym-compact-button gym-set-remove"
		});
		removeButton.setAttr("aria-label", "Remove set");
		removeButton.setAttr("title", "Remove set");
		removeButton.addEventListener("click", () => {
			this.confirmDelete("Remove set?", `Set ${index + 1} will be removed from ${exercise.name || "this exercise"}.`, () => {
				exercise.sets = exercise.sets.filter((entry) => entry.id !== set.id);
				if (exercise.sets.length === 0) {
					exercise.sets.push(createEmptySet());
				}
				this.render();
			}, "Remove");
		});
	}

	private renderRestTimer(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-timer-panel" });
		this.timerPanelEl = panel;
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Rest Timer" });
		this.timerStateEl = heading.createEl("span", { text: this.timerRunning ? "Running" : "Ready" });

		const timer = panel.createDiv({ cls: "gym-timer-display" });
		this.timerTextEl = timer.createEl("strong");

		const controls = panel.createDiv({ cls: "gym-timer-controls" });
		const minus = controls.createEl("button", { text: "-15s" });
		minus.addEventListener("click", () => {
			this.timerRemainingSeconds = Math.max(0, this.timerRemainingSeconds - 15);
			this.updateTimerDisplay();
		});

		const start = controls.createEl("button", { text: this.timerRunning ? "Pause" : "Start", cls: "mod-cta" });
		start.addEventListener("click", () => {
			if (this.timerRunning) {
				this.pauseRestTimer();
			} else {
				this.startRestTimer(this.timerRemainingSeconds || this.plugin.settings.defaultRestSeconds);
			}
			this.render();
		});

		const plus = controls.createEl("button", { text: "+15s" });
		plus.addEventListener("click", () => {
			this.timerRemainingSeconds += 15;
			this.updateTimerDisplay();
		});

		const reset = controls.createEl("button", { text: "Reset" });
		reset.addEventListener("click", () => {
			this.resetRestTimer();
			this.render();
		});

		this.updateTimerDisplay();
	}

	private renderStats(parent: HTMLElement) {
		const stats = getStats(this.plugin.data.workouts);
		const panel = parent.createDiv({ cls: "gym-panel gym-stats-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Progress" });

		const statGrid = panel.createDiv({ cls: "gym-stat-grid" });
		createStat(statGrid, "Workouts", String(stats.totalWorkouts));
		createStat(statGrid, "This week", `${stats.weekVolume} ${this.plugin.settings.weightUnit}`);
		createStat(statGrid, "Ruck miles", String(stats.ruckDistance));
		createStat(statGrid, "Sets", String(stats.completedSets));
		createStat(statGrid, "Streak", `${stats.streakDays} days`);
	}

	private renderTrends(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-trends-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Trends" });

		const weeklyVolumes = getWeeklyVolumes(this.plugin.data.workouts, 8);
		const hasTrendData = weeklyVolumes.some((week) => week.volume > 0);
		if (!hasTrendData) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: "Trends will appear after saved workouts."
			});
			return;
		}

		const maxVolume = Math.max(...weeklyVolumes.map((week) => week.volume), 1);
		const chart = panel.createDiv({ cls: "gym-bar-chart" });

		weeklyVolumes.forEach((week) => {
			const row = chart.createDiv({ cls: "gym-bar-row" });
			row.createSpan({ text: week.label, cls: "gym-bar-label" });
			const track = row.createDiv({ cls: "gym-bar-track" });
			const fillWidth = week.volume > 0 ? Math.max(4, (week.volume / maxVolume) * 100) : 0;
			track.createDiv({
				cls: "gym-bar-fill",
				attr: { style: `width: ${fillWidth}%;` }
			});
			row.createSpan({
				text: `${week.volume} ${this.plugin.settings.weightUnit}`,
				cls: "gym-bar-value"
			});
		});

		const topExercises = getTopExerciseVolumes(this.plugin.data.workouts, 3);
		if (topExercises.length > 0) {
			const topList = panel.createDiv({ cls: "gym-top-list" });
			topExercises.forEach((entry) => {
				const item = topList.createDiv({ cls: "gym-top-item" });
				item.createSpan({ text: entry.name });
				item.createEl("strong", { text: `${entry.volume} ${this.plugin.settings.weightUnit}` });
			});
		}
	}

	private renderExerciseInsights(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-exercise-insights-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Exercise Progress" });

		const exerciseNames = getTrackedExerciseNames(this.plugin.data.workouts);
		if (exerciseNames.length === 0 && !this.selectedExerciseName) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: "Exercise progress will appear after saved workouts."
			});
			return;
		}

		if (!this.selectedExerciseName) {
			this.selectedExerciseName = exerciseNames[0];
		}

		const selectOptions = uniqueStrings([this.selectedExerciseName, ...exerciseNames])
			.filter(Boolean)
			.map((name) => ({ label: name, value: name }));

		const select = createLabeledSelect(
			panel,
			"Exercise",
			this.selectedExerciseName,
			selectOptions
		);
		select.addEventListener("change", () => {
			this.selectedExerciseName = select.value;
			this.render();
		});

		const history = getExerciseHistory(this.plugin.data.workouts, this.selectedExerciseName);
		if (history.length === 0) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: `No saved history for ${this.selectedExerciseName} yet.`
			});
			return;
		}

		const latest = history[0];
		const best = getBestExercisePerformance(history);
		const guidance = getProgressionGuidance(history, this.plugin.settings.weightUnit);

		const summary = panel.createDiv({ cls: "gym-insight-grid" });
		createStat(summary, "Latest", latest ? `${latest.bestWeight} ${this.plugin.settings.weightUnit} x ${latest.bestReps}` : "-");
		createStat(summary, "Best 1RM", best.estimatedOneRepMax ? `${best.estimatedOneRepMax} ${this.plugin.settings.weightUnit}` : "-");
		createStat(summary, "Best volume", best.volume ? `${best.volume} ${this.plugin.settings.weightUnit}` : "-");
		createStat(summary, "Suggestion", guidance);

		const list = panel.createDiv({ cls: "gym-exercise-history-list" });
		history.slice(0, 5).forEach((entry) => {
			const item = list.createDiv({ cls: "gym-exercise-history-item" });
			item.createEl("strong", { text: entry.date });
			item.createSpan({
				text: `${entry.sets} sets - ${entry.volume} ${this.plugin.settings.weightUnit} - best ${entry.bestWeight} x ${entry.bestReps}`
			});
		});
	}

	private renderRecords(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-records-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Records" });

		const records = collectPersonalRecords(this.plugin.getSortedWorkouts()).slice(0, 6);
		if (records.length === 0) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: "Records will appear after saved workouts."
			});
			return;
		}

		const list = panel.createDiv({ cls: "gym-record-list" });
		records.forEach((record) => {
			const item = list.createDiv({ cls: "gym-record-item" });
			item.createEl("strong", { text: record.exercise });
			item.createSpan({ text: `${record.kind}: ${record.value} ${record.unit}` });
			item.createSpan({ text: record.date, cls: "gym-record-date" });
		});
	}

	private renderCalendar(parent: HTMLElement) {
		const layout = parent.createDiv({ cls: "gym-calendar-layout" });
		const calendarPanel = layout.createDiv({ cls: "gym-panel gym-calendar-panel" });
		const detailPanel = layout.createDiv({ cls: "gym-panel gym-calendar-detail-panel" });
		const workouts = this.plugin.getSortedWorkouts();
		const workoutsByDate = groupWorkoutsByDate(workouts);

		const heading = calendarPanel.createDiv({ cls: "gym-calendar-heading" });
		const previous = heading.createEl("button", { text: "Prev", cls: "gym-compact-button" });
		previous.addEventListener("click", () => {
			this.calendarCursor = addMonths(this.calendarCursor, -1);
			this.selectedCalendarDate = formatDate(this.calendarCursor);
			this.render();
		});

		const titleGroup = heading.createDiv({ cls: "gym-calendar-title" });
		titleGroup.createEl("h3", { text: formatMonthTitle(this.calendarCursor) });
		titleGroup.createSpan({ text: `${workouts.filter((workout) => isSameMonth(parseLocalDate(workout.date), this.calendarCursor)).length} workouts` });

		const controls = heading.createDiv({ cls: "gym-calendar-controls" });
		const today = controls.createEl("button", { text: "Today", cls: "gym-compact-button" });
		today.addEventListener("click", () => {
			const now = new Date();
			this.calendarCursor = getStartOfMonth(now);
			this.selectedCalendarDate = getTodayDate();
			this.render();
		});
		const next = controls.createEl("button", { text: "Next", cls: "gym-compact-button" });
		next.addEventListener("click", () => {
			this.calendarCursor = addMonths(this.calendarCursor, 1);
			this.selectedCalendarDate = formatDate(this.calendarCursor);
			this.render();
		});

		const weekdays = calendarPanel.createDiv({ cls: "gym-calendar-weekdays" });
		["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day) => {
			weekdays.createSpan({ text: day });
		});

		const grid = calendarPanel.createDiv({ cls: "gym-calendar-grid" });
		getCalendarDates(this.calendarCursor).forEach((date) => {
			const dateKey = formatDate(date);
			const dayWorkouts = workoutsByDate.get(dateKey) ?? [];
			const classes = [
				"gym-calendar-day",
				isSameMonth(date, this.calendarCursor) ? "" : "is-muted",
				dateKey === getTodayDate() ? "is-today" : "",
				dateKey === this.selectedCalendarDate ? "is-selected" : "",
				dayWorkouts.length > 0 ? "has-workout" : ""
			].filter(Boolean).join(" ");
			const day = grid.createEl("button", { cls: classes });
			day.addEventListener("click", () => {
				this.selectedCalendarDate = dateKey;
				this.calendarCursor = getStartOfMonth(date);
				this.render();
			});
			day.createSpan({ text: String(date.getDate()), cls: "gym-calendar-day-number" });

			if (dayWorkouts.length > 0) {
				const marker = day.createSpan({ cls: "gym-calendar-marker" });
				marker.createSpan({ text: formatCalendarMarker(dayWorkouts), cls: "gym-calendar-marker-full" });
				marker.createSpan({ text: formatCalendarMarker(dayWorkouts, true), cls: "gym-calendar-marker-short" });
			}
		});

		this.renderCalendarDetails(detailPanel, workoutsByDate.get(this.selectedCalendarDate) ?? []);
	}

	private renderCalendarDetails(parent: HTMLElement, workouts: WorkoutEntry[]) {
		const heading = parent.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: formatReadableDate(this.selectedCalendarDate) });
		const detailActions = heading.createDiv({ cls: "gym-calendar-detail-actions" });
		detailActions.createEl("span", { text: workouts.length === 1 ? "1 workout" : `${workouts.length} workouts` });
		const addWorkout = detailActions.createEl("button", { text: "Add workout", cls: "gym-action-add" });
		addWorkout.addEventListener("click", () => {
			this.startWorkoutForDate(this.selectedCalendarDate);
		});

		if (workouts.length === 0) {
			parent.createDiv({
				cls: "gym-empty-state",
				text: "No workout saved for this day."
			});
			return;
		}

		const recordsByWorkout = getRecordCountsByWorkout(this.plugin.getSortedWorkouts());
		const list = parent.createDiv({ cls: "gym-history-list" });
		workouts.forEach((workout) => {
			const item = list.createDiv({ cls: "gym-history-item" });
			const main = item.createDiv({ cls: "gym-history-main" });
			main.createEl("strong", { text: workout.type });
			const prCount = recordsByWorkout.get(workout.id) ?? 0;
			main.createEl("span", {
				text: formatWorkoutSummary(workout, this.plugin.settings.weightUnit, prCount)
			});
			createChipRow(main, [
				workout.mode === "ruck" ? "Ruck" : "Strength",
				...(prCount > 0 ? [`${prCount} PR${prCount === 1 ? "" : "s"}`] : [])
			]);

			const actions = item.createDiv({ cls: "gym-history-actions" });
			const edit = actions.createEl("button", { text: "Edit", cls: "gym-action-edit" });
			edit.addEventListener("click", () => {
				this.activeWorkout = cloneWorkout(workout);
				this.routineDraftName = "";
				this.activeTab = "workout";
				this.render();
			});

			const exportButton = actions.createEl("button", { text: "Export", cls: "gym-action-export" });
			exportButton.addEventListener("click", () => {
				void this.plugin.exportWorkout(workout);
			});

			const remove = actions.createEl("button", { text: "Delete", cls: "gym-danger-button gym-action-delete" });
			remove.addEventListener("click", () => {
				this.confirmDelete("Delete workout?", `${workout.date} ${workout.type} will be removed.`, () => {
					void this.plugin.deleteWorkout(workout.id);
				});
			});
		});
	}

	private renderExerciseLibrary(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-library-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Exercise Library" });
		const add = heading.createEl("button", { text: "Add exercise" });
		add.addEventListener("click", () => {
			this.openExerciseModal();
		});

		const exercises = this.plugin.getSortedExerciseLibrary();
		if (exercises.length === 0) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: "Add exercises with muscle group and equipment."
			});
			return;
		}

		const filterBar = panel.createDiv({ cls: "gym-library-filter" });
		const filter = createLabeledInput(filterBar, "Filter exercises", "search", this.libraryFilter);
		filter.placeholder = "Name, muscle, equipment, category...";
		const resultCount = filterBar.createDiv({ cls: "gym-library-count" });
		const list = panel.createDiv({ cls: "gym-library-list" });
		const renderList = () => {
			const filteredExercises = exercises.filter((exercise) => matchesExerciseFilter(exercise, this.libraryFilter));
			list.empty();
			resultCount.setText(`${filteredExercises.length} of ${exercises.length}`);

			if (filteredExercises.length === 0) {
				list.createDiv({
					cls: "gym-empty-state",
					text: "No exercises match that filter."
				});
				return;
			}

			filteredExercises.forEach((exercise) => {
				const item = list.createDiv({ cls: "gym-library-item" });
				const main = item.createDiv({ cls: "gym-history-main" });
				main.createEl("strong", { text: exercise.name });
				createChipRow(main, [exercise.primaryMuscle, exercise.equipment, exercise.category].filter(Boolean));

				const actions = item.createDiv({ cls: "gym-history-actions" });
				const addToWorkout = actions.createEl("button", { text: "Add", cls: "gym-action-add" });
				addToWorkout.addEventListener("click", () => {
					this.addLibraryExerciseToWorkout(exercise);
				});

				const history = actions.createEl("button", { text: "History", cls: "gym-action-export" });
				history.addEventListener("click", () => {
					this.showExerciseHistory(exercise.name);
				});

				const edit = actions.createEl("button", { text: "Edit", cls: "gym-action-edit" });
				edit.addEventListener("click", () => {
					this.openExerciseModal(exercise);
				});

				const remove = actions.createEl("button", { text: "Delete", cls: "gym-danger-button gym-action-delete" });
				remove.addEventListener("click", () => {
					this.confirmDelete("Delete exercise?", `${exercise.name} will be removed from the exercise library.`, () => {
						void this.plugin.deleteExerciseDefinition(exercise.id);
					});
				});
			});
		};

		filter.addEventListener("input", () => {
			this.libraryFilter = filter.value;
			renderList();
		});
		renderList();
	}

	private renderRoutines(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-routines-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "Routines" });
		const add = heading.createEl("button", { text: "New routine", cls: "gym-action-add" });
		add.addEventListener("click", () => {
			this.startRoutineDraft();
		});

		const routines = this.plugin.getSortedRoutines();
		if (routines.length === 0) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: "Saved routines will show up here. Start a new routine draft to build your first one."
			});
			return;
		}

		const list = panel.createDiv({ cls: "gym-routine-list" });
		routines.forEach((routine) => {
			const item = list.createDiv({ cls: "gym-routine-item" });
			const main = item.createDiv({ cls: "gym-history-main" });
			main.createEl("strong", { text: routine.name });
			createChipRow(main, [`${routine.exercises.length} exercises`, `${countRoutineSets(routine)} sets`]);

			const actions = item.createDiv({ cls: "gym-history-actions" });
			const start = actions.createEl("button", { text: "Start", cls: "gym-action-add" });
			start.addEventListener("click", () => {
				this.activeWorkout = createWorkoutFromRoutine(this.plugin, routine);
				this.routineDraftName = "";
				this.activeTab = "workout";
				this.render();
			});

			const edit = actions.createEl("button", { text: "Edit", cls: "gym-action-edit" });
			edit.addEventListener("click", () => {
				this.activeWorkout = createWorkoutFromRoutine(this.plugin, routine);
				this.routineDraftName = routine.name;
				this.activeTab = "workout";
				this.render();
				new Notice("Edit the routine draft, then choose Update routine.");
			});

			const remove = actions.createEl("button", { text: "Delete", cls: "gym-danger-button gym-action-delete" });
			remove.addEventListener("click", () => {
				this.confirmDelete("Delete routine?", `${routine.name} will be removed from your routines.`, () => {
					void this.plugin.deleteRoutine(routine.id);
				});
			});
		});
	}

	private renderHistory(parent: HTMLElement) {
		const panel = parent.createDiv({ cls: "gym-panel gym-history-panel" });
		const heading = panel.createDiv({ cls: "gym-section-heading" });
		heading.createEl("h3", { text: "History" });

		const workouts = this.plugin.getSortedWorkouts();
		if (workouts.length === 0) {
			panel.createDiv({
				cls: "gym-empty-state",
				text: "Your saved workouts will show up here."
			});
			return;
		}

		const recordsByWorkout = getRecordCountsByWorkout(workouts);
		const list = panel.createDiv({ cls: "gym-history-list" });
		workouts.slice(0, 20).forEach((workout) => {
			const item = list.createDiv({ cls: "gym-history-item" });
			const main = item.createDiv({ cls: "gym-history-main" });
			main.createEl("strong", { text: `${workout.date} - ${workout.type}` });
			const prCount = recordsByWorkout.get(workout.id) ?? 0;
			main.createEl("span", {
				text: formatWorkoutSummary(workout, this.plugin.settings.weightUnit, prCount)
			});
			createChipRow(main, [
				workout.mode === "ruck" ? "Ruck" : "Strength",
				...(prCount > 0 ? [`${prCount} PR${prCount === 1 ? "" : "s"}`] : [])
			]);

			const actions = item.createDiv({ cls: "gym-history-actions" });
			const edit = actions.createEl("button", { text: "Edit", cls: "gym-action-edit" });
			edit.addEventListener("click", () => {
				this.activeWorkout = cloneWorkout(workout);
				this.routineDraftName = "";
				this.render();
			});

			const exportButton = actions.createEl("button", { text: "Export", cls: "gym-action-export" });
			exportButton.addEventListener("click", () => {
				void this.plugin.exportWorkout(workout);
			});

			const remove = actions.createEl("button", { text: "Delete", cls: "gym-danger-button gym-action-delete" });
			remove.addEventListener("click", () => {
				this.confirmDelete("Delete workout?", `${workout.date} ${workout.type} will be removed.`, () => {
					void this.plugin.deleteWorkout(workout.id);
				});
			});
		});
	}

	private getNextDefaultExercise() {
		const defaults = getDefaultExercises(this.plugin);
		const used = new Set(this.activeWorkout.exercises.map((exercise) => exercise.name));
		return defaults.find((name) => !used.has(name)) ?? "";
	}

	private openRoutineModal() {
		const defaultName = this.routineDraftName || `${this.activeWorkout.type || this.plugin.settings.defaultWorkoutType} Routine`;
		new RoutineNameModal(this.app, defaultName, async (name) => {
			const saved = await this.plugin.saveRoutineFromWorkout(this.activeWorkout, name);
			if (saved) {
				this.routineDraftName = "";
				this.activeTab = "routines";
				this.render();
			}
		}).open();
	}

	private startRoutineDraft() {
		this.activeWorkout = createEmptyWorkout(this.plugin);
		this.routineDraftName = "";
		this.activeTab = "workout";
		this.render();
		new Notice("Build the routine draft, then choose Save routine.");
	}

	private startWorkoutForDate(date: string) {
		this.activeWorkout = createEmptyWorkout(this.plugin);
		this.activeWorkout.date = date;
		this.routineDraftName = "";
		this.activeTab = "workout";
		this.render();
		new Notice(`New workout draft for ${date}.`);
	}

	private addLibraryExerciseToWorkout(exercise: ExerciseDefinition) {
		if (this.activeWorkout.mode === "ruck") {
			this.activeWorkout.mode = "strength";
			this.activeWorkout.type = this.plugin.settings.defaultWorkoutType;
		}

		this.activeWorkout.exercises.push(createEmptyExercise(exercise.name));
		this.activeTab = "workout";
		this.render();
		new Notice(`Added ${exercise.name} to current workout.`);
	}

	private importGpxFile() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".gpx,application/gpx+xml,text/xml,application/xml";
		input.addEventListener("change", async () => {
			const file = input.files?.[0];
			if (!file) {
				return;
			}

			try {
				const summary = parseGpxSummary(await file.text(), file.name);
				if (!summary) {
					new Notice("Could not find track points in that GPX file.");
					return;
				}

				this.applyGpxSummary(summary);
				new Notice(`Imported GPX: ${summary.distanceKilometers.toFixed(2)} km.`);
			} catch (error) {
				console.error("Gym Tracker GPX import failed", error);
				new Notice("Could not import that GPX file.");
			}
		}, { once: true });
		input.click();
	}

	private applyGpxSummary(summary: GpxImportSummary) {
		this.activeWorkout.mode = "ruck";
		this.activeWorkout.type = this.activeWorkout.type.trim() || "Ruck";

		if (summary.startDate) {
			this.activeWorkout.date = summary.startDate;
		}

		this.activeWorkout.ruck.distance = this.activeWorkout.ruck.distanceUnit === "km"
			? roundNumber(summary.distanceKilometers)
			: roundNumber(kilometersToMiles(summary.distanceKilometers));

		if (summary.durationMinutes > 0) {
			this.activeWorkout.durationMinutes = summary.durationMinutes;
		}

		this.activeWorkout.ruck.elevationGain = this.activeWorkout.ruck.elevationUnit === "m"
			? roundNumber(summary.elevationGainMeters)
			: roundNumber(metersToFeet(summary.elevationGainMeters));

		if (summary.name) {
			this.activeWorkout.ruck.route = summary.name;
		}

		this.render();
	}

	private showExerciseHistory(exerciseName: string) {
		this.selectedExerciseName = exerciseName;
		this.activeTab = "insights";
		this.render();

		if (getExerciseHistory(this.plugin.data.workouts, exerciseName).length === 0) {
			new Notice(`No saved history for ${exerciseName} yet.`);
		}

		this.scrollToExerciseProgress();
	}

	private openExerciseModal(exercise?: ExerciseDefinition) {
		new ExerciseDefinitionModal(this.app, exercise, (definition) => {
			void this.plugin.saveExerciseDefinition(definition);
		}).open();
	}

	private confirmDelete(title: string, message: string, onConfirm: () => void, confirmText = "Delete") {
		new ConfirmModal(this.app, title, message, onConfirm, confirmText).open();
	}

	private startRestTimer(seconds = this.plugin.settings.defaultRestSeconds) {
		this.timerRemainingSeconds = Math.max(0, Math.round(seconds));
		this.timerRunning = true;
		this.stopTimerInterval();
		this.timerInterval = window.setInterval(() => {
			this.timerRemainingSeconds = Math.max(0, this.timerRemainingSeconds - 1);
			this.updateTimerDisplay();

			if (this.timerRemainingSeconds === 0) {
				this.pauseRestTimer();
				new Notice("Rest complete.");
			}
		}, 1000);
		this.updateTimerDisplay();
	}

	private pauseRestTimer() {
		this.timerRunning = false;
		this.stopTimerInterval();
		this.updateTimerDisplay();
	}

	private resetRestTimer() {
		this.pauseRestTimer();
		this.timerRemainingSeconds = this.plugin.settings.defaultRestSeconds;
		this.updateTimerDisplay();
	}

	private stopTimerInterval() {
		if (this.timerInterval !== null) {
			window.clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	private updateTimerDisplay() {
		if (this.timerTextEl) {
			this.timerTextEl.setText(formatDuration(this.timerRemainingSeconds));
		}

		if (this.timerStateEl) {
			this.timerStateEl.setText(this.timerRunning ? "Running" : "Ready");
		}
	}

	private scrollToRestTimer() {
		window.requestAnimationFrame(() => {
			this.timerPanelEl?.scrollIntoView({
				behavior: "smooth",
				block: "center",
				inline: "nearest"
			});
		});
	}

	private scrollToExerciseProgress() {
		window.requestAnimationFrame(() => {
			this.containerEl.querySelector(".gym-exercise-insights-panel")?.scrollIntoView({
				behavior: "smooth",
				block: "start",
				inline: "nearest"
			});
		});
	}
}

class GymTrackerSettingTab extends PluginSettingTab {
	plugin: GymTrackerPlugin;

	constructor(app: App, plugin: GymTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Gym Tracker" });

		new Setting(containerEl)
			.setName("Demo data")
			.setDesc("Replace tracker data with fake workouts/routines for chart testing, or reset back to a blank tracker.")
			.addButton((button) => {
				button
					.setButtonText("Load demo data")
					.setCta()
					.onClick(() => {
						this.plugin.confirmLoadDemoData(() => this.display());
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Clear data")
					.setWarning()
					.onClick(() => {
						this.plugin.confirmClearTrackerData(() => this.display());
					});
			});

		new Setting(containerEl)
			.setName("Weight unit")
			.setDesc("Used for labels and exports.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("lb", "lb")
					.addOption("kg", "kg")
					.setValue(this.plugin.settings.weightUnit)
					.onChange(async (value) => {
						this.plugin.settings.weightUnit = value === "kg" ? "kg" : "lb";
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
			});

		new Setting(containerEl)
			.setName("Auto-export workouts")
			.setDesc("Create or update the Markdown workout note after each save.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoExportWorkouts)
					.onChange(async (value) => {
						this.plugin.settings.autoExportWorkouts = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Link exercise notes")
			.setDesc("Use Obsidian wiki links for exercises in exported workout notes.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.linkExerciseNotes)
					.onChange(async (value) => {
						this.plugin.settings.linkExerciseNotes = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Create exercise notes")
			.setDesc("Automatically create missing exercise notes when saving a workout.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoCreateExerciseNotes)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateExerciseNotes = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default rest timer")
			.setDesc("Default rest duration in seconds.")
			.addText((text) => {
				text
					.setPlaceholder("120")
					.setValue(String(this.plugin.settings.defaultRestSeconds))
					.onChange(async (value) => {
						this.plugin.settings.defaultRestSeconds = Math.max(0, Number(value) || DEFAULT_SETTINGS.defaultRestSeconds);
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
			});

		new Setting(containerEl)
			.setName("Default workout type")
			.setDesc("Pre-filled when you start a new workout.")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.defaultWorkoutType)
					.onChange(async (value) => {
						this.plugin.settings.defaultWorkoutType = value.trim() || DEFAULT_SETTINGS.defaultWorkoutType;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Export folder")
			.setDesc("Folder where exported workout notes are created.")
			.addText((text) => {
				text
					.setPlaceholder("Gym/Workouts")
					.setValue(this.plugin.settings.exportFolder)
					.onChange(async (value) => {
						this.plugin.settings.exportFolder = value.trim() || DEFAULT_SETTINGS.exportFolder;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Exercise folder")
			.setDesc("Folder where exercise notes are created.")
			.addText((text) => {
				text
					.setPlaceholder("Gym/Exercises")
					.setValue(this.plugin.settings.exerciseFolder)
					.onChange(async (value) => {
						this.plugin.settings.exerciseFolder = value.trim() || DEFAULT_SETTINGS.exerciseFolder;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default exercises")
			.setDesc("One exercise per line. These appear as suggestions in new exercise rows.")
			.addTextArea((text) => {
				text
					.setValue(this.plugin.settings.defaultExercises)
					.onChange(async (value) => {
						this.plugin.settings.defaultExercises = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 8;
				text.inputEl.addClass("gym-settings-textarea");
			});
	}
}

class RoutineNameModal extends Modal {
	private defaultName: string;
	private onSubmit: (name: string) => void;
	private value: string;

	constructor(app: App, defaultName: string, onSubmit: (name: string) => void) {
		super(app);
		this.defaultName = defaultName;
		this.value = defaultName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Save routine" });

		new Setting(contentEl)
			.setName("Name")
			.addText((text) => {
				text.setValue(this.defaultName);
				text.onChange((value) => {
					this.value = value;
				});
				text.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
					if (event.key === "Enter") {
						this.submit();
					}
				});
				window.setTimeout(() => text.inputEl.focus(), 50);
			});

		const actions = contentEl.createDiv({ cls: "gym-modal-actions" });
		const cancel = actions.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => {
			this.close();
		});

		const save = actions.createEl("button", { text: "Save", cls: "mod-cta" });
		save.addEventListener("click", () => {
			this.submit();
		});

	}

	onClose() {
		this.contentEl.empty();
	}

	private submit() {
		this.onSubmit(this.value);
		this.close();
	}
}

class ExerciseDefinitionModal extends Modal {
	private exercise: ExerciseDefinition;
	private onSubmit: (exercise: ExerciseDefinition) => void;

	constructor(app: App, exercise: ExerciseDefinition | undefined, onSubmit: (exercise: ExerciseDefinition) => void) {
		super(app);
		this.exercise = exercise ? { ...exercise } : createEmptyExerciseDefinition();
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Exercise" });

		new Setting(contentEl)
			.setName("Name")
			.addText((text) => {
				text.setValue(this.exercise.name);
				text.onChange((value) => {
					this.exercise.name = value;
				});
				window.setTimeout(() => text.inputEl.focus(), 50);
			});

		new Setting(contentEl)
			.setName("Primary muscle")
			.addText((text) => {
				text.setPlaceholder("Chest, Back, Quads...");
				text.setValue(this.exercise.primaryMuscle);
				text.onChange((value) => {
					this.exercise.primaryMuscle = value;
				});
			});

		new Setting(contentEl)
			.setName("Equipment")
			.addText((text) => {
				text.setPlaceholder("Barbell, Dumbbell, Machine...");
				text.setValue(this.exercise.equipment);
				text.onChange((value) => {
					this.exercise.equipment = value;
				});
			});

		new Setting(contentEl)
			.setName("Category")
			.addText((text) => {
				text.setPlaceholder("Compound, Isolation, Cardio...");
				text.setValue(this.exercise.category);
				text.onChange((value) => {
					this.exercise.category = value;
				});
			});

		new Setting(contentEl)
			.setName("Notes")
			.addTextArea((text) => {
				text.setValue(this.exercise.notes);
				text.onChange((value) => {
					this.exercise.notes = value;
				});
				text.inputEl.rows = 4;
			});

		const actions = contentEl.createDiv({ cls: "gym-modal-actions" });
		const cancel = actions.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => {
			this.close();
		});

		const save = actions.createEl("button", { text: "Save", cls: "mod-cta" });
		save.addEventListener("click", () => {
			this.onSubmit(this.exercise);
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

class ConfirmModal extends Modal {
	private confirmText: string;
	private title: string;
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, title: string, message: string, onConfirm: () => void, confirmText = "Delete") {
		super(app);
		this.confirmText = confirmText;
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		const actions = contentEl.createDiv({ cls: "gym-modal-actions" });
		const cancel = actions.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => {
			this.close();
		});

		const confirm = actions.createEl("button", {
			text: this.confirmText,
			cls: this.confirmText === "Delete" ? "mod-warning" : "mod-cta"
		});
		if (this.confirmText === "Delete") {
			confirm.addClass("gym-danger-button");
		}
		confirm.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

function createLabeledInput(parent: HTMLElement, label: string, type: string, value: string) {
	const wrapper = parent.createEl("label", { cls: "gym-label" });
	wrapper.createSpan({ text: label });
	const input = wrapper.createEl("input", { type, value, cls: "gym-input" });
	return input;
}

function createLabeledSelect(
	parent: HTMLElement,
	label: string,
	value: string,
	options: Array<{ label: string; value: string }>
) {
	const wrapper = parent.createEl("label", { cls: "gym-label" });
	wrapper.createSpan({ text: label });
	const select = wrapper.createEl("select", { cls: "gym-input gym-select" });
	options.forEach((option) => {
		select.createEl("option", {
			text: option.label,
			attr: { value: option.value }
		});
	});
	select.value = value;
	return select;
}

function createStat(parent: HTMLElement, label: string, value: string) {
	const item = parent.createDiv({ cls: "gym-stat" });
	item.createSpan({ text: label });
	return item.createEl("strong", { text: value });
}

function createChipRow(parent: HTMLElement, values: string[]) {
	const cleanValues = values.map((value) => value.trim()).filter(Boolean);
	if (cleanValues.length === 0) {
		parent.createSpan({ text: "No metadata", cls: "gym-muted-text" });
		return;
	}

	const row = parent.createDiv({ cls: "gym-chip-row" });
	cleanValues.forEach((value) => {
		row.createSpan({ text: value, cls: "gym-chip" });
	});
}

function parseGpxSummary(gpxText: string, fileName: string): GpxImportSummary | null {
	const document = new DOMParser().parseFromString(gpxText, "application/xml");
	if (document.querySelector("parsererror")) {
		return null;
	}

	const points = getGpxPoints(document);
	if (points.length < 2) {
		return null;
	}

	let distanceKilometers = 0;
	let elevationGainMeters = 0;
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1];
		const current = points[index];
		distanceKilometers += calculatePointDistanceKilometers(previous, current);

		if (Number.isFinite(previous.elevationMeters) && Number.isFinite(current.elevationMeters)) {
			const gain = current.elevationMeters - previous.elevationMeters;
			if (gain > 0) {
				elevationGainMeters += gain;
			}
		}
	}

	const timedPoints = points.filter((point) => point.time !== null);
	const firstTime = timedPoints[0]?.time ?? null;
	const lastTime = timedPoints[timedPoints.length - 1]?.time ?? null;
	const durationMinutes = firstTime && lastTime
		? Math.max(0, Math.round((lastTime.getTime() - firstTime.getTime()) / 60000))
		: 0;

	return {
		distanceKilometers: roundNumber(distanceKilometers),
		durationMinutes,
		elevationGainMeters: roundNumber(elevationGainMeters),
		name: getGpxName(document, fileName),
		startDate: firstTime ? formatDate(firstTime) : ""
	};
}

function getGpxPoints(document: Document) {
	return [
		...Array.from(document.getElementsByTagName("trkpt")),
		...Array.from(document.getElementsByTagName("rtept"))
	]
		.map((point) => {
			const lat = Number(point.getAttribute("lat"));
			const lon = Number(point.getAttribute("lon"));
			const elevationText = point.getElementsByTagName("ele")[0]?.textContent ?? "";
			const timeText = point.getElementsByTagName("time")[0]?.textContent ?? "";
			const time = timeText ? new Date(timeText) : null;

			return {
				elevationMeters: Number(elevationText),
				lat,
				lon,
				time: time && !Number.isNaN(time.getTime()) ? time : null
			};
		})
		.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function getGpxName(document: Document, fileName: string) {
	const trackName = document.getElementsByTagName("trk")[0]?.getElementsByTagName("name")[0]?.textContent;
	const routeName = document.getElementsByTagName("rte")[0]?.getElementsByTagName("name")[0]?.textContent;
	const metadataName = document.getElementsByTagName("metadata")[0]?.getElementsByTagName("name")[0]?.textContent;
	return (trackName || routeName || metadataName || fileName.replace(/\.gpx$/i, "")).trim();
}

function calculatePointDistanceKilometers(
	from: { lat: number; lon: number },
	to: { lat: number; lon: number }
) {
	const earthRadiusKilometers = 6371;
	const lat1 = degreesToRadians(from.lat);
	const lat2 = degreesToRadians(to.lat);
	const deltaLat = degreesToRadians(to.lat - from.lat);
	const deltaLon = degreesToRadians(to.lon - from.lon);
	const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return earthRadiusKilometers * c;
}

function degreesToRadians(value: number) {
	return value * Math.PI / 180;
}

function kilometersToMiles(value: number) {
	return value * 0.621371;
}

function metersToFeet(value: number) {
	return value * 3.28084;
}

function formatWorkoutSummary(workout: WorkoutEntry, unit: WeightUnit, prCount = 0) {
	if (workout.mode === "ruck") {
		return `${workout.ruck.distance} ${workout.ruck.distanceUnit} - ${workout.durationMinutes} min - ${calculateRuckPace(workout)} min/${workout.ruck.distanceUnit}`;
	}

	const prText = prCount > 0 ? ` - ${prCount} PR${prCount === 1 ? "" : "s"}` : "";
	return `${workout.exercises.length} exercises - ${countCompletedSets(workout)} sets - ${calculateWorkoutVolume(workout)} ${unit}${prText}`;
}

function groupWorkoutsByDate(workouts: WorkoutEntry[]) {
	const map = new Map<string, WorkoutEntry[]>();
	workouts.forEach((workout) => {
		const day = map.get(workout.date) ?? [];
		day.push(workout);
		map.set(workout.date, day);
	});
	return map;
}

function formatCalendarMarker(workouts: WorkoutEntry[], compact = false) {
	if (workouts.length > 1) {
		return compact ? `${workouts.length}x` : `${workouts.length} workouts`;
	}

	if (workouts[0]?.mode === "ruck") {
		return compact ? "R" : "Ruck";
	}

	return compact ? "S" : "Strength";
}

function createEmptyWorkout(plugin: GymTrackerPlugin): WorkoutEntry {
	const now = new Date().toISOString();
	return {
		id: createId(),
		date: getTodayDate(),
		mode: "strength",
		type: plugin.settings.defaultWorkoutType,
		durationMinutes: 60,
		notes: "",
		ruck: createEmptyRuck(),
		exercises: [createEmptyExercise(getDefaultExercises(plugin)[0] ?? "")],
		createdAt: now,
		updatedAt: now
	};
}

function createWorkoutFromRoutine(plugin: GymTrackerPlugin, routine: RoutineTemplate): WorkoutEntry {
	const now = new Date().toISOString();
	return {
		id: createId(),
		date: getTodayDate(),
		mode: "strength",
		type: routine.type || plugin.settings.defaultWorkoutType,
		durationMinutes: routine.durationMinutes || 60,
		notes: routine.notes,
		ruck: createEmptyRuck(),
		exercises: routine.exercises.map((exercise) => ({
			id: createId(),
			name: exercise.name,
			notes: exercise.notes,
			sets: exercise.sets.map((set) => ({
				id: createId(),
				rir: set.rir,
				reps: set.reps,
				rpe: set.rpe,
				weight: set.weight,
				type: set.type,
				completed: false,
				notes: ""
			}))
		})),
		createdAt: now,
		updatedAt: now
	};
}

function createEmptyRuck(): RuckEntry {
	return {
		distance: 0,
		distanceUnit: "mi",
		elevationGain: 0,
		elevationUnit: "ft",
		packWeight: 0,
		route: "",
		rpe: 0
	};
}

function createEmptyExercise(name = ""): ExerciseEntry {
	return {
		id: createId(),
		name,
		notes: "",
		sets: [createEmptySet(), createEmptySet(), createEmptySet()]
	};
}

function createEmptySet(): WorkoutSetEntry {
	return {
		id: createId(),
		rir: 0,
		reps: 8,
		rpe: 0,
		weight: 0,
		type: "working",
		completed: false,
		notes: ""
	};
}

function cloneSetTemplate(set?: WorkoutSetEntry): WorkoutSetEntry {
	return {
		id: createId(),
		rir: set?.rir ?? 0,
		reps: set?.reps ?? 8,
		rpe: set?.rpe ?? 0,
		weight: set?.weight ?? 0,
		type: set?.type ?? "working",
		completed: false,
		notes: ""
	};
}

function cloneWorkout(workout: WorkoutEntry): WorkoutEntry {
	return {
		...workout,
		exercises: workout.exercises.map((exercise) => ({
			...exercise,
			sets: exercise.sets.map((set) => ({ ...set }))
		}))
	};
}

function isWorkoutDraftDirty(workout: WorkoutEntry, plugin: GymTrackerPlugin) {
	if (workout.date !== getTodayDate()) {
		return true;
	}

	if (workout.type !== plugin.settings.defaultWorkoutType || workout.durationMinutes !== 60 || workout.notes.trim()) {
		return true;
	}

	if (workout.mode !== "strength" || workout.ruck.distance > 0 || workout.ruck.packWeight > 0 || workout.ruck.route.trim()) {
		return true;
	}

	if (workout.exercises.length !== 1) {
		return true;
	}

	const [exercise] = workout.exercises;
	if (!exercise) {
		return false;
	}

	const expectedName = getDefaultExercises(plugin)[0] ?? "";
	if (exercise.name !== expectedName || exercise.notes.trim() || exercise.sets.length !== 3) {
		return true;
	}

	return exercise.sets.some((set) =>
		set.reps !== 8 ||
		set.weight !== 0 ||
		set.rpe !== 0 ||
		set.rir !== 0 ||
		set.type !== "working" ||
		set.completed ||
		set.notes.trim().length > 0
	);
}

function getDefaultExercises(plugin: GymTrackerPlugin) {
	const settingExercises = plugin.settings.defaultExercises
		.split("\n")
		.map((entry) => entry.trim())
		.filter(Boolean);
	const libraryExercises = plugin.data.exerciseLibrary.map((exercise) => exercise.name);

	return uniqueStrings([...libraryExercises, ...settingExercises]);
}

function normalizeTrackerData(rawData: unknown): GymTrackerData {
	if (!isRecord(rawData)) {
		return createDefaultTrackerData();
	}

	const raw = rawData;
	const exerciseLibrary = Array.isArray(raw.exerciseLibrary) ? raw.exerciseLibrary : DEFAULT_EXERCISE_LIBRARY;
	const workouts = Array.isArray(raw.workouts) ? raw.workouts : [];
	const routines = Array.isArray(raw.routines) ? raw.routines : [];

	return {
		exerciseLibrary: exerciseLibrary
			.map(normalizeExerciseDefinition)
			.filter((exercise): exercise is ExerciseDefinition => exercise !== null),
		routines: routines
			.map(normalizeRoutine)
			.filter((routine): routine is RoutineTemplate => routine !== null),
		workouts: workouts
			.map(normalizeWorkout)
			.filter((workout): workout is WorkoutEntry => workout !== null)
	};
}

function createDefaultTrackerData(): GymTrackerData {
	return {
		exerciseLibrary: DEFAULT_EXERCISE_LIBRARY.map((exercise) => ({ ...exercise })),
		routines: [],
		workouts: []
	};
}

function createDemoTrackerData(unit: WeightUnit): GymTrackerData {
	const workouts: WorkoutEntry[] = [];

	for (let week = 7; week >= 0; week -= 1) {
		const progress = 7 - week;
		workouts.push(createDemoLowerWorkout(week * 7, progress, unit));
		workouts.push(createDemoRuckWorkout(week * 7 + 1, progress, unit, "Neighborhood hills"));
		workouts.push(createDemoUpperWorkout(week * 7 + 2, progress, unit));
		workouts.push(createDemoPullWorkout(week * 7 + 4, progress, unit));
		workouts.push(createDemoRuckWorkout(week * 7 + 5, progress, unit, "Park loop"));
	}

	return {
		exerciseLibrary: DEFAULT_EXERCISE_LIBRARY.map((exercise) => ({ ...exercise })),
		routines: createDemoRoutines(unit),
		workouts
	};
}

function createDemoRoutines(unit: WeightUnit): RoutineTemplate[] {
	const now = new Date().toISOString();
	return [
		createDemoRoutine("Lower Strength", "Strength", 70, "Squat focus with posterior chain accessories.", [
			createDemoRoutineExercise("Squat", "Top sets, leave one clean rep in reserve.", [
				createDemoRoutineSet(5, scaleDemoWeight(225, unit), 8, 2),
				createDemoRoutineSet(5, scaleDemoWeight(235, unit), 8, 2),
				createDemoRoutineSet(5, scaleDemoWeight(235, unit), 9, 1)
			]),
			createDemoRoutineExercise("Romanian Deadlift", "Controlled eccentric.", [
				createDemoRoutineSet(8, scaleDemoWeight(185, unit), 8, 2),
				createDemoRoutineSet(8, scaleDemoWeight(195, unit), 8, 2),
				createDemoRoutineSet(8, scaleDemoWeight(195, unit), 9, 1)
			]),
			createDemoRoutineExercise("Leg Press", "Full depth, steady tempo.", [
				createDemoRoutineSet(10, scaleDemoWeight(360, unit), 8, 2),
				createDemoRoutineSet(10, scaleDemoWeight(380, unit), 8, 2),
				createDemoRoutineSet(10, scaleDemoWeight(380, unit), 9, 1)
			])
		], now),
		createDemoRoutine("Upper Push", "Strength", 60, "Bench and shoulder volume.", [
			createDemoRoutineExercise("Bench Press", "Pause first rep.", [
				createDemoRoutineSet(5, scaleDemoWeight(175, unit), 8, 2),
				createDemoRoutineSet(5, scaleDemoWeight(185, unit), 8, 2),
				createDemoRoutineSet(5, scaleDemoWeight(185, unit), 9, 1)
			]),
			createDemoRoutineExercise("Overhead Press", "No layback.", [
				createDemoRoutineSet(6, scaleDemoWeight(105, unit), 8, 2),
				createDemoRoutineSet(6, scaleDemoWeight(110, unit), 8, 2),
				createDemoRoutineSet(6, scaleDemoWeight(110, unit), 9, 1)
			]),
			createDemoRoutineExercise("Lateral Raise", "Stop before traps take over.", [
				createDemoRoutineSet(12, scaleDemoWeight(20, unit), 7, 3),
				createDemoRoutineSet(12, scaleDemoWeight(20, unit), 8, 2),
				createDemoRoutineSet(12, scaleDemoWeight(25, unit), 9, 1)
			])
		], now),
		createDemoRoutine("Pull Strength", "Strength", 65, "Deadlift, rows, and pull-up work.", [
			createDemoRoutineExercise("Deadlift", "Reset each rep.", [
				createDemoRoutineSet(3, scaleDemoWeight(275, unit), 8, 2),
				createDemoRoutineSet(3, scaleDemoWeight(295, unit), 8, 2),
				createDemoRoutineSet(3, scaleDemoWeight(315, unit), 9, 1)
			]),
			createDemoRoutineExercise("Barbell Row", "Strict torso angle.", [
				createDemoRoutineSet(8, scaleDemoWeight(145, unit), 8, 2),
				createDemoRoutineSet(8, scaleDemoWeight(155, unit), 8, 2),
				createDemoRoutineSet(8, scaleDemoWeight(155, unit), 9, 1)
			]),
			createDemoRoutineExercise("Pull-up", "Full hang between reps.", [
				createDemoRoutineSet(8, 0, 8, 2),
				createDemoRoutineSet(7, 0, 8, 2),
				createDemoRoutineSet(6, 0, 9, 1)
			])
		], now)
	];
}

function createDemoRoutine(
	name: string,
	type: string,
	durationMinutes: number,
	notes: string,
	exercises: RoutineExerciseTemplate[],
	timestamp: string
): RoutineTemplate {
	return {
		id: createId(),
		name,
		type,
		durationMinutes,
		notes,
		exercises,
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

function createDemoRoutineExercise(name: string, notes: string, sets: RoutineSetTemplate[]): RoutineExerciseTemplate {
	return {
		id: createId(),
		name,
		notes,
		sets
	};
}

function createDemoRoutineSet(reps: number, weight: number, rpe: number, rir: number): RoutineSetTemplate {
	return {
		id: createId(),
		rir,
		reps,
		rpe,
		weight,
		type: "working"
	};
}

function createDemoLowerWorkout(daysAgo: number, progress: number, unit: WeightUnit): WorkoutEntry {
	const squat = scaleDemoWeight(205 + progress * 5, unit);
	const rdl = scaleDemoWeight(165 + progress * 5, unit);
	const legPress = scaleDemoWeight(320 + progress * 15, unit);

	return createDemoStrengthWorkout(daysAgo, "Lower Strength", 68 + (progress % 3) * 4, "Demo lower day: knees felt good, depth consistent.", [
		createDemoExercise("Squat", "Belt on top sets.", [
			createDemoSet(5, squat - getDemoJump(unit) * 2, 7, 3, "warmup"),
			createDemoSet(5, squat, 8, 2),
			createDemoSet(5, squat + getDemoJump(unit), 8, 2),
			createDemoSet(4 + (progress % 2), squat + getDemoJump(unit), 9, 1)
		]),
		createDemoExercise("Romanian Deadlift", "Hamstrings tight but moving well.", [
			createDemoSet(8, rdl, 8, 2),
			createDemoSet(8, rdl + getDemoJump(unit), 8, 2),
			createDemoSet(8, rdl + getDemoJump(unit), 9, 1)
		]),
		createDemoExercise("Leg Press", "Controlled reps.", [
			createDemoSet(10, legPress, 8, 2),
			createDemoSet(10, legPress + getDemoJump(unit) * 2, 8, 2),
			createDemoSet(12, legPress + getDemoJump(unit) * 2, 9, 1)
		])
	]);
}

function createDemoUpperWorkout(daysAgo: number, progress: number, unit: WeightUnit): WorkoutEntry {
	const bench = scaleDemoWeight(155 + progress * 5, unit);
	const press = scaleDemoWeight(95 + progress * 2.5, unit);
	const row = scaleDemoWeight(120 + progress * 5, unit);

	return createDemoStrengthWorkout(daysAgo, "Upper Push", 58 + (progress % 4) * 3, "Demo upper day: shoulder warm-up helped.", [
		createDemoExercise("Bench Press", "Paused first rep on each set.", [
			createDemoSet(5, bench - getDemoJump(unit), 7, 3, "warmup"),
			createDemoSet(5, bench, 8, 2),
			createDemoSet(5, bench + getDemoJump(unit), 8, 2),
			createDemoSet(6 + (progress % 2), bench, 9, 1)
		]),
		createDemoExercise("Overhead Press", "Kept bar path tight.", [
			createDemoSet(6, press, 8, 2),
			createDemoSet(6, press + getDemoJump(unit), 8, 2),
			createDemoSet(5 + (progress % 3), press + getDemoJump(unit), 9, 1)
		]),
		createDemoExercise("Seated Cable Row", "Squeezed each rep.", [
			createDemoSet(10, row, 7, 3),
			createDemoSet(10, row + getDemoJump(unit), 8, 2),
			createDemoSet(12, row + getDemoJump(unit), 8, 2)
		]),
		createDemoExercise("Lateral Raise", "Slow negatives.", [
			createDemoSet(12, scaleDemoWeight(15 + progress * 1.25, unit), 8, 2),
			createDemoSet(12, scaleDemoWeight(17.5 + progress * 1.25, unit), 8, 2),
			createDemoSet(15, scaleDemoWeight(17.5 + progress * 1.25, unit), 9, 1)
		])
	]);
}

function createDemoPullWorkout(daysAgo: number, progress: number, unit: WeightUnit): WorkoutEntry {
	const deadlift = scaleDemoWeight(255 + progress * 10, unit);
	const barbellRow = scaleDemoWeight(135 + progress * 5, unit);
	const curl = scaleDemoWeight(55 + progress * 2.5, unit);

	return createDemoStrengthWorkout(daysAgo, "Pull Strength", 62 + (progress % 3) * 5, "Demo pull day: grip stayed solid.", [
		createDemoExercise("Deadlift", "Reset every rep.", [
			createDemoSet(3, deadlift - getDemoJump(unit) * 4, 7, 3, "warmup"),
			createDemoSet(3, deadlift, 8, 2),
			createDemoSet(3, deadlift + getDemoJump(unit) * 2, 8, 2),
			createDemoSet(2 + (progress % 2), deadlift + getDemoJump(unit) * 3, 9, 1)
		]),
		createDemoExercise("Barbell Row", "No body English.", [
			createDemoSet(8, barbellRow, 8, 2),
			createDemoSet(8, barbellRow + getDemoJump(unit), 8, 2),
			createDemoSet(10, barbellRow + getDemoJump(unit), 9, 1)
		]),
		createDemoExercise("Pull-up", "Bodyweight reps.", [
			createDemoSet(6 + progress, 0, 8, 2),
			createDemoSet(5 + progress, 0, 8, 2),
			createDemoSet(4 + progress, 0, 9, 1)
		]),
		createDemoExercise("Barbell Curl", "Elbows pinned.", [
			createDemoSet(10, curl, 8, 2),
			createDemoSet(10, curl, 8, 2),
			createDemoSet(12, curl, 9, 1)
		])
	]);
}

function createDemoStrengthWorkout(
	daysAgo: number,
	type: string,
	durationMinutes: number,
	notes: string,
	exercises: ExerciseEntry[]
): WorkoutEntry {
	const timestamp = createDemoTimestamp(daysAgo);
	return {
		id: createId(),
		date: formatDate(addDays(new Date(), -daysAgo)),
		mode: "strength",
		type,
		durationMinutes,
		notes,
		ruck: createEmptyRuck(),
		exercises,
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

function createDemoRuckWorkout(daysAgo: number, progress: number, unit: WeightUnit, route: string): WorkoutEntry {
	const timestamp = createDemoTimestamp(daysAgo);
	const distance = roundNumber(2.4 + progress * 0.18 + (daysAgo % 2) * 0.35);
	const packWeight = scaleDemoWeight(25 + progress * 2.5, unit);
	const durationMinutes = Math.round(distance * (17 - Math.min(progress, 5) * 0.45));

	return {
		id: createId(),
		date: formatDate(addDays(new Date(), -daysAgo)),
		mode: "ruck",
		type: "Ruck",
		durationMinutes,
		notes: "Demo ruck: steady pace, nasal breathing for most of the route.",
		ruck: {
			distance,
			distanceUnit: "mi",
			elevationGain: 120 + progress * 20 + (route === "Park loop" ? 60 : 0),
			elevationUnit: "ft",
			packWeight,
			route,
			rpe: 5 + (progress % 3)
		},
		exercises: [],
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

function createDemoExercise(name: string, notes: string, sets: WorkoutSetEntry[]): ExerciseEntry {
	return {
		id: createId(),
		name,
		notes,
		sets
	};
}

function createDemoSet(
	reps: number,
	weight: number,
	rpe: number,
	rir: number,
	type: SetKind = "working"
): WorkoutSetEntry {
	return {
		id: createId(),
		rir,
		reps,
		rpe,
		weight: Math.max(0, roundNumber(weight)),
		type,
		completed: true,
		notes: ""
	};
}

function createDemoTimestamp(daysAgo: number) {
	const date = addDays(new Date(), -daysAgo);
	date.setHours(18, 30, 0, 0);
	return date.toISOString();
}

function scaleDemoWeight(weightInPounds: number, unit: WeightUnit) {
	if (unit === "lb") {
		return roundToNearest(weightInPounds, 5);
	}

	return roundToNearest(weightInPounds * 0.453592, 2.5);
}

function getDemoJump(unit: WeightUnit) {
	return unit === "kg" ? 2.5 : 5;
}

function roundToNearest(value: number, step: number) {
	return roundNumber(Math.round(value / step) * step);
}

function normalizeWorkout(raw: unknown): WorkoutEntry | null {
	if (!isRecord(raw)) {
		return null;
	}

	const now = new Date().toISOString();
	const exercises = Array.isArray(raw.exercises) ? raw.exercises : [];

	return {
		id: getString(raw.id, createId()),
		date: getString(raw.date, getTodayDate()),
		mode: normalizeWorkoutMode(getString(raw.mode, "strength")),
		type: getString(raw.type, DEFAULT_SETTINGS.defaultWorkoutType),
		durationMinutes: getNumber(raw.durationMinutes, 0),
		notes: getString(raw.notes, ""),
		ruck: normalizeRuck(raw.ruck),
		exercises: exercises
			.map(normalizeExercise)
			.filter((exercise): exercise is ExerciseEntry => exercise !== null),
		createdAt: getString(raw.createdAt, now),
		updatedAt: getString(raw.updatedAt, now)
	};
}

function normalizeDraftRuck(ruck: RuckEntry): RuckEntry {
	return {
		distance: Math.max(0, Number(ruck.distance) || 0),
		distanceUnit: ruck.distanceUnit === "km" ? "km" : "mi",
		elevationGain: Math.max(0, Number(ruck.elevationGain) || 0),
		elevationUnit: ruck.elevationUnit === "m" ? "m" : "ft",
		packWeight: Math.max(0, Number(ruck.packWeight) || 0),
		route: ruck.route.trim(),
		rpe: clampNumber(Number(ruck.rpe) || 0, 0, 10)
	};
}

function normalizeRuck(raw: unknown): RuckEntry {
	if (!isRecord(raw)) {
		return createEmptyRuck();
	}

	return {
		distance: getNumber(raw.distance, 0),
		distanceUnit: getString(raw.distanceUnit, "mi") === "km" ? "km" : "mi",
		elevationGain: getNumber(raw.elevationGain, 0),
		elevationUnit: getString(raw.elevationUnit, "ft") === "m" ? "m" : "ft",
		packWeight: getNumber(raw.packWeight, 0),
		route: getString(raw.route, ""),
		rpe: clampNumber(getNumber(raw.rpe, 0), 0, 10)
	};
}

function normalizeWorkoutMode(value: string): WorkoutMode {
	return value === "ruck" ? "ruck" : "strength";
}

function normalizeDraftExercise(exercise: ExerciseEntry): ExerciseEntry {
	return {
		id: exercise.id || createId(),
		name: exercise.name.trim(),
		notes: exercise.notes.trim(),
		sets: exercise.sets
			.map((set) => ({
				id: set.id || createId(),
				reps: Math.max(0, Number(set.reps) || 0),
				rir: clampNumber(Number(set.rir) || 0, 0, 10),
				rpe: clampNumber(Number(set.rpe) || 0, 0, 10),
				weight: Math.max(0, Number(set.weight) || 0),
				type: normalizeSetKind(set.type),
				completed: set.completed,
				notes: set.notes.trim()
			}))
			.filter((set) => set.reps > 0 || set.weight > 0 || set.notes.length > 0)
	};
}

function normalizeExercise(raw: unknown): ExerciseEntry | null {
	if (!isRecord(raw)) {
		return null;
	}

	const sets = Array.isArray(raw.sets) ? raw.sets : [];

	return {
		id: getString(raw.id, createId()),
		name: getString(raw.name, ""),
		notes: getString(raw.notes, ""),
		sets: sets
			.map(normalizeWorkoutSet)
			.filter((set): set is WorkoutSetEntry => set !== null)
	};
}

function normalizeWorkoutSet(raw: unknown): WorkoutSetEntry | null {
	if (!isRecord(raw)) {
		return null;
	}

	return {
		id: getString(raw.id, createId()),
		rir: clampNumber(getNumber(raw.rir, 0), 0, 10),
		reps: getNumber(raw.reps, 0),
		rpe: clampNumber(getNumber(raw.rpe, 0), 0, 10),
		weight: getNumber(raw.weight, 0),
		type: normalizeSetKind(getString(raw.type, "working")),
		completed: typeof raw.completed === "boolean" ? raw.completed : false,
		notes: getString(raw.notes, "")
	};
}

function normalizeRoutine(raw: unknown): RoutineTemplate | null {
	if (!isRecord(raw)) {
		return null;
	}

	const now = new Date().toISOString();
	const exercises = Array.isArray(raw.exercises) ? raw.exercises : [];

	return {
		id: getString(raw.id, createId()),
		name: getString(raw.name, "Routine"),
		type: getString(raw.type, DEFAULT_SETTINGS.defaultWorkoutType),
		durationMinutes: getNumber(raw.durationMinutes, 60),
		notes: getString(raw.notes, ""),
		exercises: exercises
			.map(normalizeRoutineExercise)
			.filter((exercise): exercise is RoutineExerciseTemplate => exercise !== null),
		createdAt: getString(raw.createdAt, now),
		updatedAt: getString(raw.updatedAt, now)
	};
}

function normalizeRoutineExercise(raw: unknown): RoutineExerciseTemplate | null {
	if (!isRecord(raw)) {
		return null;
	}

	const sets = Array.isArray(raw.sets) ? raw.sets : [];
	return {
		id: getString(raw.id, createId()),
		name: getString(raw.name, ""),
		notes: getString(raw.notes, ""),
		sets: sets
			.map(normalizeRoutineSet)
			.filter((set): set is RoutineSetTemplate => set !== null)
	};
}

function normalizeRoutineSet(raw: unknown): RoutineSetTemplate | null {
	if (!isRecord(raw)) {
		return null;
	}

	return {
		id: getString(raw.id, createId()),
		rir: clampNumber(getNumber(raw.rir, 0), 0, 10),
		reps: getNumber(raw.reps, 0),
		rpe: clampNumber(getNumber(raw.rpe, 0), 0, 10),
		weight: getNumber(raw.weight, 0),
		type: normalizeSetKind(getString(raw.type, "working"))
	};
}

function normalizeExerciseDefinition(raw: unknown): ExerciseDefinition | null {
	if (!isRecord(raw)) {
		return null;
	}

	const name = getString(raw.name, "").trim();
	if (!name) {
		return null;
	}

	return {
		id: getString(raw.id, createId()),
		name,
		primaryMuscle: getString(raw.primaryMuscle, ""),
		equipment: getString(raw.equipment, ""),
		category: getString(raw.category, ""),
		notes: getString(raw.notes, "")
	};
}

function matchesExerciseFilter(exercise: ExerciseDefinition, filter: string) {
	const terms = filter
		.toLowerCase()
		.split(/\s+/)
		.map((term) => term.trim())
		.filter(Boolean);

	if (terms.length === 0) {
		return true;
	}

	const haystack = [
		exercise.name,
		exercise.primaryMuscle,
		exercise.equipment,
		exercise.category,
		exercise.notes
	].join(" ").toLowerCase();

	return terms.every((term) => haystack.includes(term));
}

function normalizeSetKind(value: string): SetKind {
	if (value === "warmup" || value === "drop" || value === "failure") {
		return value;
	}

	return "working";
}

function calculateSetVolume(set: WorkoutSetEntry) {
	if (!set.completed) {
		return 0;
	}

	return roundNumber(set.reps * set.weight);
}

function calculateExerciseVolume(exercise: ExerciseEntry) {
	return roundNumber(exercise.sets.reduce((sum, set) => sum + calculateSetVolume(set), 0));
}

function calculateWorkoutVolume(workout: WorkoutEntry) {
	return roundNumber(workout.exercises.reduce((sum, exercise) => sum + calculateExerciseVolume(exercise), 0));
}

function calculateRuckPace(workout: WorkoutEntry) {
	if (workout.mode !== "ruck" || workout.ruck.distance <= 0 || workout.durationMinutes <= 0) {
		return 0;
	}

	return roundNumber(workout.durationMinutes / workout.ruck.distance);
}

function calculateRuckLoadDistance(workout: WorkoutEntry) {
	if (workout.mode !== "ruck") {
		return 0;
	}

	return roundNumber(workout.ruck.packWeight * workout.ruck.distance);
}

function getRuckDistanceInMiles(workout: WorkoutEntry) {
	if (workout.mode !== "ruck") {
		return 0;
	}

	return workout.ruck.distanceUnit === "km"
		? roundNumber(workout.ruck.distance * 0.621371)
		: workout.ruck.distance;
}

function countCompletedSets(workout: WorkoutEntry) {
	return workout.exercises.reduce(
		(sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
		0
	);
}

function countRoutineSets(routine: RoutineTemplate) {
	return routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

function getStats(workouts: WorkoutEntry[]) {
	const sorted = [...workouts].sort(compareWorkoutsDesc);
	const startOfWeek = getStartOfWeek(new Date());
	const weekVolume = sorted
		.filter((workout) => parseLocalDate(workout.date) >= startOfWeek)
		.reduce((sum, workout) => sum + calculateWorkoutVolume(workout), 0);

	return {
		totalWorkouts: sorted.length,
		weekVolume: roundNumber(weekVolume),
		completedSets: sorted.reduce((sum, workout) => sum + countCompletedSets(workout), 0),
		ruckDistance: roundNumber(sorted.reduce((sum, workout) => sum + getRuckDistanceInMiles(workout), 0)),
		streakDays: calculateStreakDays(sorted)
	};
}

function getWeeklyVolumes(workouts: WorkoutEntry[], weekCount: number) {
	const currentWeek = getStartOfWeek(new Date());
	const weeks = Array.from({ length: weekCount }, (_, index) => {
		const start = addDays(currentWeek, (index - weekCount + 1) * 7);
		const weeksAgo = weekCount - index - 1;
		return {
			key: formatDate(start),
			label: formatWeekLabel(weeksAgo),
			volume: 0
		};
	});
	const weekMap = new Map(weeks.map((week) => [week.key, week]));

	workouts.forEach((workout) => {
		const workoutWeek = formatDate(getStartOfWeek(parseLocalDate(workout.date)));
		const week = weekMap.get(workoutWeek);
		if (week) {
			week.volume = roundNumber(week.volume + calculateWorkoutVolume(workout));
		}
	});

	return weeks;
}

function formatWeekLabel(weeksAgo: number) {
	if (weeksAgo === 0) {
		return "This week";
	}

	if (weeksAgo === 1) {
		return "Last week";
	}

	return `${weeksAgo}w ago`;
}

function getTopExerciseVolumes(workouts: WorkoutEntry[], limit: number) {
	const totals = new Map<string, number>();

	workouts.forEach((workout) => {
		workout.exercises.forEach((exercise) => {
			totals.set(exercise.name, roundNumber((totals.get(exercise.name) ?? 0) + calculateExerciseVolume(exercise)));
		});
	});

	return [...totals.entries()]
		.map(([name, volume]) => ({ name, volume }))
		.sort((a, b) => b.volume - a.volume)
		.slice(0, limit);
}

function getTrackedExerciseNames(workouts: WorkoutEntry[]) {
	return uniqueStrings(
		workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.name.trim()).filter(Boolean))
	).sort((a, b) => a.localeCompare(b));
}

function getExerciseHistory(workouts: WorkoutEntry[], exerciseName: string): ExerciseHistoryEntry[] {
	const target = exerciseName.toLowerCase();

	return workouts
		.flatMap((workout) =>
			workout.exercises
				.filter((exercise) => exercise.name.toLowerCase() === target)
				.map((exercise) => {
					const completedSets = exercise.sets.filter((set) => set.completed);
					const bestSet = completedSets.reduce<WorkoutSetEntry | null>((best, set) => {
						if (!best) {
							return set;
						}

						return estimateOneRepMax(set) > estimateOneRepMax(best) ? set : best;
					}, null);

					return {
						bestReps: bestSet?.reps ?? 0,
						bestWeight: bestSet?.weight ?? 0,
						date: workout.date,
						estimatedOneRepMax: bestSet ? estimateOneRepMax(bestSet) : 0,
						sets: completedSets.length,
						volume: calculateExerciseVolume(exercise),
						workoutId: workout.id
					};
				})
		)
		.sort((a, b) => b.date.localeCompare(a.date));
}

function getBestExercisePerformance(history: ExerciseHistoryEntry[]) {
	return history.reduce(
		(best, entry) => ({
			estimatedOneRepMax: Math.max(best.estimatedOneRepMax, entry.estimatedOneRepMax),
			volume: Math.max(best.volume, entry.volume)
		}),
		{ estimatedOneRepMax: 0, volume: 0 }
	);
}

function getProgressionGuidance(history: ExerciseHistoryEntry[], unit: WeightUnit) {
	const latest = history[0];
	if (!latest) {
		return "-";
	}

	if (latest.bestReps >= 10 && latest.bestWeight > 0) {
		return `Try ${roundNumber(latest.bestWeight + getSmallPlateJump(unit))} ${unit}`;
	}

	if (latest.bestWeight > 0) {
		return `Try ${latest.bestWeight} ${unit} x ${latest.bestReps + 1}`;
	}

	return "Add weight when ready";
}

function getSmallPlateJump(unit: WeightUnit) {
	return unit === "kg" ? 2.5 : 5;
}

function collectPersonalRecords(workouts: WorkoutEntry[]) {
	const sorted = [...workouts].sort(compareWorkoutsAsc);
	const bestVolume = new Map<string, number>();
	const bestOneRepMax = new Map<string, number>();
	const bestWeight = new Map<string, number>();
	const records: PersonalRecord[] = [];

	sorted.forEach((workout) => {
		workout.exercises.forEach((exercise) => {
			const exerciseKey = exercise.name.toLowerCase();
			const exerciseVolume = calculateExerciseVolume(exercise);
			if (exerciseVolume > (bestVolume.get(exerciseKey) ?? 0)) {
				bestVolume.set(exerciseKey, exerciseVolume);
				records.push({
					date: workout.date,
					exercise: exercise.name,
					kind: "Volume PR",
					unit: "volume",
					value: exerciseVolume,
					workoutId: workout.id
				});
			}

			exercise.sets.filter((set) => set.completed).forEach((set) => {
				const estimated = estimateOneRepMax(set);
				if (estimated > (bestOneRepMax.get(exerciseKey) ?? 0)) {
					bestOneRepMax.set(exerciseKey, estimated);
					records.push({
						date: workout.date,
						exercise: exercise.name,
						kind: "Est. 1RM PR",
						unit: "est. 1RM",
						value: estimated,
						workoutId: workout.id
					});
				}

				if (set.weight > (bestWeight.get(exerciseKey) ?? 0)) {
					bestWeight.set(exerciseKey, set.weight);
					records.push({
						date: workout.date,
						exercise: exercise.name,
						kind: "Weight PR",
						unit: "weight",
						value: set.weight,
						workoutId: workout.id
					});
				}
			});
		});
	});

	return records.sort((a, b) => b.date.localeCompare(a.date));
}

function getRecordCountsByWorkout(workouts: WorkoutEntry[]) {
	const map = new Map<string, number>();
	collectPersonalRecords(workouts).forEach((record) => {
		map.set(record.workoutId, (map.get(record.workoutId) ?? 0) + 1);
	});
	return map;
}

function estimateOneRepMax(set: WorkoutSetEntry) {
	if (!set.completed || set.weight <= 0 || set.reps <= 0) {
		return 0;
	}

	return roundNumber(set.weight * (1 + set.reps / 30));
}

function calculateStreakDays(workouts: WorkoutEntry[]) {
	const workoutDates = new Set(workouts.map((workout) => workout.date));
	let cursor = parseLocalDate(getTodayDate());
	let streak = 0;

	while (workoutDates.has(formatDate(cursor))) {
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}

	return streak;
}

function compareWorkoutsDesc(a: WorkoutEntry, b: WorkoutEntry) {
	return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);
}

function compareWorkoutsAsc(a: WorkoutEntry, b: WorkoutEntry) {
	return a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt);
}

function getTodayDate() {
	return formatDate(new Date());
}

function getStartOfMonth(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
	const copy = new Date(date.getFullYear(), date.getMonth(), 1);
	copy.setMonth(copy.getMonth() + months);
	return copy;
}

function getCalendarDates(month: Date) {
	const start = getStartOfWeek(getStartOfMonth(month));
	const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
	const end = addDays(getStartOfWeek(endOfMonth), 6);
	const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
	return Array.from({ length: dayCount }, (_, index) => addDays(start, index));
}

function isSameMonth(date: Date, month: Date) {
	return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function formatMonthTitle(date: Date) {
	return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatReadableDate(value: string) {
	return parseLocalDate(value).toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric"
	});
}

function formatDate(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function getStartOfWeek(date: Date) {
	const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const day = copy.getDay();
	const diff = day === 0 ? 6 : day - 1;
	copy.setDate(copy.getDate() - diff);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function addDays(date: Date, days: number) {
	const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	copy.setDate(copy.getDate() + days);
	return copy;
}

function createId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyExerciseDefinition(): ExerciseDefinition {
	return {
		id: createId(),
		name: "",
		primaryMuscle: "",
		equipment: "",
		category: "",
		notes: ""
	};
}

function roundNumber(value: number) {
	return Math.round(value * 100) / 100;
}

function clampNumber(value: number, min: number, max: number) {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.min(max, Math.max(min, value));
}

function formatDuration(totalSeconds: number) {
	const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
	const seconds = Math.max(0, totalSeconds) % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSetKind(value: SetKind) {
	return SET_TYPES.find((type) => type.value === value)?.label ?? "Working";
}

function uniqueStrings(values: string[]) {
	const seen = new Set<string>();
	const unique: string[] = [];

	values.forEach((value) => {
		const clean = value.trim();
		const key = clean.toLowerCase();
		if (!clean || seen.has(key)) {
			return;
		}

		seen.add(key);
		unique.push(clean);
	});

	return unique;
}

function sanitizeFileName(value: string) {
	return value.replace(/[\\/#^|[\]:]/g, "").trim() || "Exercise";
}

function formatExerciseNote(exerciseName: string, library: ExerciseDefinition[], workoutFolder: string) {
	const definition = library.find((exercise) => exercise.name.toLowerCase() === exerciseName.toLowerCase());

	return [
		"---",
		"record_type: exercise",
		`exercise: ${quoteYaml(exerciseName)}`,
		`primary_muscle: ${quoteYaml(definition?.primaryMuscle ?? "")}`,
		`equipment: ${quoteYaml(definition?.equipment ?? "")}`,
		`category: ${quoteYaml(definition?.category ?? "")}`,
		"tags:",
		"  - gym/exercise",
		"---",
		"",
		`# ${exerciseName}`,
		"",
		"## Notes",
		"",
		definition?.notes || "-",
		"",
		"## History",
		"",
		"```dataview",
		`TABLE date, workout_type, volume, set_count`,
		`FROM "${workoutFolder}"`,
		`WHERE contains(exercises, "${exerciseName.replace(/"/g, '\\"')}")`,
		"SORT date DESC",
		"```"
	].join("\n");
}

function escapeTableCell(value: string) {
	return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function quoteYaml(value: string) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getString(value: unknown, fallback: string) {
	return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback: number) {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}
