// Simplified SM-2 spaced repetition algorithm.

const SRS_STORAGE_KEY = "permiso-armas-progress-v1";

function srsDefaultState(id) {
  return { id, ef: 2.5, interval: 0, reps: 0, due: Date.now(), lapses: 0 };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(progress));
}

function getCardState(progress, id) {
  return progress[id] || srsDefaultState(id);
}

// quality: 0 = again/incorrect, 3 = hard, 4 = good, 5 = easy
function gradeCard(state, quality) {
  const next = { ...state };
  if (quality < 3) {
    next.lapses += 1;
    next.reps = 0;
    next.interval = 0;
    next.ef = Math.max(1.3, next.ef - 0.2);
    next.due = Date.now() + 60 * 1000; // retry soon (1 min)
    return next;
  }

  next.ef = Math.max(1.3, next.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  next.reps += 1;

  if (next.reps === 1) {
    next.interval = 1;
  } else if (next.reps === 2) {
    next.interval = 6;
  } else {
    next.interval = Math.round(next.interval * next.ef);
  }

  next.due = Date.now() + next.interval * 24 * 60 * 60 * 1000;
  return next;
}

function isDue(state) {
  return state.due <= Date.now();
}
