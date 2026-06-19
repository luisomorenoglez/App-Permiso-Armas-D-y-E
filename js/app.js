const EXAM_SIZE = 20;
const EXAM_PASS = 16;

let progress = loadProgress();
let questionsById = {};
QUESTIONS.forEach(q => { questionsById[q.id] = q; });

const TEMAS = [...new Set(QUESTIONS.map(q => q.tema))].sort((a, b) => a - b);

let session = null; // { queue: [Question], mode: 'review'|'study'|'exam', idx, results: [] }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dueQuestions(temaFilter) {
  return QUESTIONS.filter(q => {
    if (temaFilter && q.tema !== temaFilter) return false;
    return isDue(getCardState(progress, q.id));
  });
}

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById("view-" + name).classList.remove("hidden");
  document.querySelectorAll("#main-nav button").forEach(b => b.classList.remove("active"));
  const navBtn = document.querySelector(`#main-nav button[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add("active");
  if (name === "stats") renderStats();
}

function mistakeQuestions() {
  return QUESTIONS
    .filter(q => getCardState(progress, q.id).lapses > 0)
    .sort((a, b) => getCardState(progress, b.id).lapses - getCardState(progress, a.id).lapses);
}

function renderHome() {
  document.getElementById("due-count-all").textContent = `(${dueQuestions().length})`;
  document.getElementById("mistakes-count").textContent = `(${mistakeQuestions().length})`;
  const grid = document.getElementById("tema-grid");
  grid.innerHTML = "";
  TEMAS.forEach(t => {
    const due = dueQuestions(t).length;
    const total = QUESTIONS.filter(q => q.tema === t).length;
    const div = document.createElement("button");
    div.innerHTML = `Tema ${t}<br><span class="due-badge">${due} pendientes / ${total}</span>`;
    div.addEventListener("click", () => openTemaMenu(t));
    grid.appendChild(div);
  });
}

function openTemaMenu(tema) {
  const due = dueQuestions(tema);
  const all = QUESTIONS.filter(q => q.tema === tema);
  if (due.length > 0) {
    startSession(shuffle(due), "review");
  } else {
    if (confirm(`No hay pendientes en el Tema ${tema}. ¿Estudiar las ${all.length} preguntas de este tema de todas formas?`)) {
      startSession(shuffle(all), "study");
    }
  }
}

function startSession(queue, mode) {
  if (queue.length === 0) {
    showView("empty");
    return;
  }
  session = { queue, mode, idx: 0, results: [] };
  showView("study");
  renderStudyQuestion();
}

function renderStudyQuestion() {
  const q = session.queue[session.idx];
  document.getElementById("study-qmeta").textContent = `Tema ${q.tema} · Pregunta ${session.idx + 1} de ${session.queue.length}`;
  document.getElementById("study-qtext").textContent = q.q;
  document.getElementById("study-progress-bar").style.width = `${(session.idx / session.queue.length) * 100}%`;

  const optsDiv = document.getElementById("study-options");
  optsDiv.innerHTML = "";
  document.getElementById("study-grades").classList.add("hidden");
  document.getElementById("study-next-row").classList.add("hidden");

  q.opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => answerStudy(i));
    optsDiv.appendChild(btn);
  });
}

function answerStudy(selected) {
  const q = session.queue[session.idx];
  const correct = q.a;
  const buttons = document.querySelectorAll("#study-options .opt-btn");
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === correct) b.classList.add("correct");
    else if (i === selected) b.classList.add("incorrect");
  });

  const isCorrect = selected === correct;
  if (isCorrect) {
    document.getElementById("study-grades").classList.remove("hidden");
    document.getElementById("study-grades").dataset.answered = "1";
  } else {
    const state = getCardState(progress, q.id);
    progress[q.id] = gradeCard(state, 0);
    saveProgress(progress);
    document.getElementById("study-next-row").classList.remove("hidden");
  }
}

document.getElementById("study-grades").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-q]");
  if (!btn) return;
  const q = session.queue[session.idx];
  const quality = Number(btn.dataset.q);
  const state = getCardState(progress, q.id);
  progress[q.id] = gradeCard(state, quality);
  saveProgress(progress);
  document.getElementById("study-grades").classList.add("hidden");
  document.getElementById("study-next-row").classList.remove("hidden");
});

document.getElementById("study-next-btn").addEventListener("click", () => {
  session.idx++;
  if (session.idx >= session.queue.length) {
    showView("empty");
    renderHome();
  } else {
    renderStudyQuestion();
  }
});

function startExam() {
  const pool = shuffle(QUESTIONS).slice(0, Math.min(EXAM_SIZE, QUESTIONS.length));
  session = { queue: pool, mode: "exam", idx: 0, results: [] };
  showView("exam");
  renderExamQuestion();
}

function renderExamQuestion() {
  const q = session.queue[session.idx];
  document.getElementById("exam-qmeta").textContent = `Pregunta ${session.idx + 1} de ${session.queue.length}`;
  document.getElementById("exam-qtext").textContent = q.q;
  document.getElementById("exam-progress-bar").style.width = `${(session.idx / session.queue.length) * 100}%`;

  const optsDiv = document.getElementById("exam-options");
  optsDiv.innerHTML = "";
  document.getElementById("exam-next-row").classList.add("hidden");

  q.opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => answerExam(i));
    optsDiv.appendChild(btn);
  });
}

function answerExam(selected) {
  const q = session.queue[session.idx];
  const correct = q.a;
  const isCorrect = selected === correct;
  session.results.push(isCorrect);

  const buttons = document.querySelectorAll("#exam-options .opt-btn");
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === correct) b.classList.add("correct");
    else if (i === selected) b.classList.add("incorrect");
  });

  const state = getCardState(progress, q.id);
  progress[q.id] = gradeCard(state, isCorrect ? 4 : 0);
  saveProgress(progress);

  document.getElementById("exam-next-row").classList.remove("hidden");
}

document.getElementById("exam-next-btn").addEventListener("click", () => {
  session.idx++;
  if (session.idx >= session.queue.length) {
    finishExam();
  } else {
    renderExamQuestion();
  }
});

function finishExam() {
  const score = session.results.filter(Boolean).length;
  const passed = score >= EXAM_PASS;
  document.getElementById("exam-score").textContent = `${score} / ${session.queue.length}`;
  document.getElementById("exam-score").className = "score " + (passed ? "pass" : "fail");
  document.getElementById("exam-verdict").textContent = passed
    ? "✅ Aprobado"
    : `❌ No aprobado (mínimo ${EXAM_PASS}/${EXAM_SIZE})`;
  showView("exam-result");
}

document.getElementById("btn-review-all").addEventListener("click", () => startSession(shuffle(dueQuestions()), "review"));
document.getElementById("btn-review-mistakes").addEventListener("click", () => startSession(mistakeQuestions(), "mistakes"));
document.getElementById("btn-start-exam").addEventListener("click", startExam);
document.getElementById("btn-exam-again").addEventListener("click", () => { startExam(); });
document.getElementById("btn-exam-home").addEventListener("click", () => { showView("home"); renderHome(); });
document.getElementById("btn-empty-home").addEventListener("click", () => { showView("home"); renderHome(); });

document.getElementById("main-nav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  showView(btn.dataset.view);
  if (btn.dataset.view === "home") renderHome();
});

function renderStats() {
  const total = QUESTIONS.length;
  const states = QUESTIONS.map(q => getCardState(progress, q.id));
  const learned = states.filter(s => s.reps > 0).length;
  const due = states.filter(isDue).length;
  const lapses = states.reduce((sum, s) => sum + s.lapses, 0);

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-box"><div class="num">${total}</div><div class="label">Total preguntas</div></div>
    <div class="stat-box"><div class="num">${learned}</div><div class="label">Estudiadas</div></div>
    <div class="stat-box"><div class="num">${due}</div><div class="label">Pendientes hoy</div></div>
    <div class="stat-box"><div class="num">${lapses}</div><div class="label">Fallos totales</div></div>
  `;

  const byTema = document.getElementById("stats-by-tema");
  byTema.innerHTML = "";
  TEMAS.forEach(t => {
    const qs = QUESTIONS.filter(q => q.tema === t);
    const learnedT = qs.filter(q => getCardState(progress, q.id).reps > 0).length;
    const row = document.createElement("div");
    row.style.marginBottom = "10px";
    row.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span>Tema ${t}</span><span class="muted">${learnedT}/${qs.length}</span>
    </div>
    <div class="progressbar"><div style="width:${(learnedT / qs.length) * 100}%"></div></div>`;
    byTema.appendChild(row);
  });
}

document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `progreso-permiso-armas-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-import-trigger").addEventListener("click", () => {
  document.getElementById("btn-import").click();
});

document.getElementById("btn-import").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      progress = imported;
      saveProgress(progress);
      alert("Progreso importado correctamente.");
      renderHome();
    } catch (err) {
      alert("El archivo no es un JSON de progreso válido.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

renderHome();
