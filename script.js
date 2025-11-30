(() => {
  "use strict";

  const panels = {
    landing: document.getElementById("panel-landing"),
    player: document.getElementById("panel-player"),
    mode: document.getElementById("panel-mode"),
    play: document.getElementById("panel-play"),
    summary: document.getElementById("panel-summary"),
  };

  const els = {
    start: document.getElementById("btn-start"),
    choosePlayer: document.getElementById("btn-choose-player"),
    backFromPlayer: document.getElementById("btn-back-from-player"),
    backFromMode: document.getElementById("btn-back-from-mode"),
    beginSession: document.getElementById("btn-begin-session"),
    replay: document.getElementById("btn-replay"),
    home: document.getElementById("btn-home"),
    playerSelect: document.getElementById("player-select"),
    addPlayerForm: document.getElementById("player-add-form"),
    newPlayerName: document.getElementById("new-player-name"),
    tableRange: document.getElementById("table-range"),
    tableValue: document.getElementById("table-value"),
    activePlayerChip: document.getElementById("active-player-chip"),
    answerInput: document.getElementById("answer-input"),
    submit: document.getElementById("btn-submit"),
    feedback: document.getElementById("feedback"),
    prompt: document.getElementById("prompt-text"),
    progress: document.getElementById("progress-label"),
    score: document.getElementById("score-label"),
    keypad: document.getElementById("keypad"),
    summaryText: document.getElementById("summary-text"),
    summaryCorrect: document.getElementById("summary-correct"),
    summaryWrong: document.getElementById("summary-wrong"),
    summaryAccuracy: document.getElementById("summary-accuracy"),
    soundToggle: document.getElementById("sound-toggle"),
    timerToggle: document.getElementById("timer-toggle"),
    timerLabel: document.getElementById("timer-label"),
  };

  const STORAGE_KEY = "space-times-store";
  const DEFAULT_TARGET = 15;
  const DEFAULT_TIMER_SECONDS = 15;

  let store = loadStore();
  let session = null;
  let lastSessionParams = null;
  let userInteracted = false;
  let audioCtx = null;

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          players: [],
          activePlayerId: null,
          settings: { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS },
        };
      }
      const parsed = JSON.parse(raw);
      parsed.players ||= [];
      parsed.settings ||= { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
      return parsed;
    } catch (e) {
      console.warn("Impossible de lire le stockage, réinitialisation.", e);
      return {
        players: [],
        activePlayerId: null,
        settings: { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS },
      };
    }
  }

  function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle("active", key === name);
      el.classList.toggle("hidden", key !== name);
    });
    if (name === "play") {
      els.answerInput.focus();
    }
  }

  function updatePlayerSelect() {
    const select = els.playerSelect;
    select.innerHTML = "";
    if (store.players.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Aucun joueur enregistré";
      select.appendChild(opt);
      return;
    }
    store.players.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    if (store.activePlayerId) {
      select.value = store.activePlayerId;
    }
  }

  function getActivePlayer() {
    return store.players.find((p) => p.id === store.activePlayerId) || null;
  }

  function setActivePlayer(playerId) {
    store.activePlayerId = playerId;
    saveStore();
    const player = getActivePlayer();
    if (player) {
      els.activePlayerChip.textContent = `Joueur : ${player.name}`;
      els.activePlayerChip.classList.remove("muted");
      const soundOn = player.settings?.soundOn ?? true;
      els.soundToggle.checked = soundOn;
    } else {
      els.activePlayerChip.textContent = "Joueur : aucun";
      els.activePlayerChip.classList.add("muted");
    }
    const timerOn = store.settings?.timerEnabled ?? true;
    els.timerToggle.checked = timerOn;
  }

  function addPlayer(name) {
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newPlayer = {
      id,
      name: name.trim(),
      factStreaks: {},
      lastSession: null,
      settings: { soundOn: true },
    };
    store.players.push(newPlayer);
    setActivePlayer(id);
    saveStore();
    updatePlayerSelect();
  }

  function buildDeck(mode, table, player) {
    const facts = [];
    if (mode === "single") {
      for (let a = 1; a <= 10; a++) {
        facts.push([a, table]);
      }
    } else {
      for (let a = 1; a <= 10; a++) {
        for (let b = 1; b <= 10; b++) {
          facts.push([a, b]);
        }
      }
      shuffleArray(facts);
      facts.splice(20); // limiter pour des sessions courtes et variées
    }
    return facts.map(([a, b]) => {
      const key = `${a}|${b}`;
      const stats = player?.factStreaks?.[key] || { streak: 0, misses: 0 };
      const base = Math.max(1, 5 - stats.streak + (stats.misses > 0 ? 1 : 0));
      return {
        a,
        b,
        streak: stats.streak || 0,
        dueWeight: base,
        seen: 0,
        lastResult: stats.misses > 0 ? "wrong" : undefined,
      };
    });
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function startSession(params) {
    const player = getActivePlayer();
    if (!player) {
      alert("Choisis ou crée un joueur avant de commencer.");
      return;
    }
    const deck = buildDeck(params.mode, params.table, player);
    shuffleArray(deck);
    session = {
      mode: params.mode,
      table: params.table,
      queue: deck,
      asked: 0,
      correct: 0,
      incorrect: 0,
      history: [],
      targetQuestions: DEFAULT_TARGET,
      timerEnabled: store.settings?.timerEnabled ?? true,
      timerSeconds: store.settings?.timerSeconds ?? DEFAULT_TIMER_SECONDS,
      timers: { tick: null, expiry: null },
      currentStart: null,
      currentDone: false,
    };
    lastSessionParams = { ...params };
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    nextCard();
    showPanel("play");
    renderSessionMeta();
  }

  function nextCard() {
    if (!session) return;
    if (session.asked >= session.targetQuestions || session.queue.length === 0) {
      endSession();
      return;
    }
    shuffleTail(session.queue, 4);
    session.current = session.queue.shift();
    session.currentDone = false;
    session.currentStart = Date.now();
    session.current.seen += 1;
    startCountdown();
    renderPrompt();
  }

  function shuffleTail(queue, windowSize) {
    if (queue.length <= 2) return;
    const tail = queue.splice(-windowSize);
    shuffleArray(tail);
    queue.push(...tail);
  }

  function renderPrompt() {
    if (!session?.current) return;
    const { a, b } = session.current;
    els.prompt.textContent = `${a} × ${b} = ?`;
    els.answerInput.value = "";
    els.answerInput.focus();
  }

  function renderSessionMeta() {
    els.progress.textContent = `Question ${session.asked} / ${session.targetQuestions}`;
    els.score.textContent = `Score : ${session.correct} ✓ / ${session.incorrect} ✗`;
  }

  function handleSubmit() {
    if (!session?.current) return;
    if (session.currentDone) return;
    const raw = els.answerInput.value.trim();
    if (raw === "") {
      els.feedback.textContent = "Entre une réponse pour valider.";
      els.feedback.className = "feedback";
      return;
    }
    const value = Number(raw);
    finalizeAttempt({ submittedAnswer: value });
  }

  function maybeReinsertCard(card) {
    if (!session) return;
    const needsMore = card.streak < 3 && session.asked < session.targetQuestions;
    if (!needsMore) return;
    const clone = { ...card };
    const insertAt = Math.min(session.queue.length, Math.floor(session.queue.length * 0.6) + 1);
    session.queue.splice(insertAt, 0, clone);
  }

  function requeueMiss(card) {
    if (!session) return;
    const cloneA = { ...card };
    const cloneB = { ...card };
    const firstSpot = Math.min(2, session.queue.length);
    session.queue.splice(firstSpot, 0, cloneA);
    const secondSpot = Math.min(4, session.queue.length);
    session.queue.splice(secondSpot, 0, cloneB);
  }

  function finalizeAttempt({ submittedAnswer = null, expired = false }) {
    if (!session?.current || session.currentDone) return;
    clearCountdown();
    session.currentDone = true;
    const card = session.current;
    const correctAnswer = card.a * card.b;
    const isCorrect = !expired && submittedAnswer === correctAnswer;
    const result = expired ? "timeout" : isCorrect ? "correct" : "wrong";
    const durationMs = Math.max(0, Date.now() - (session.currentStart || Date.now()));
    session.asked += 1;
    const attempt = {
      a: card.a,
      b: card.b,
      answer: submittedAnswer,
      correctAnswer,
      result,
      durationMs,
    };
    session.history.push(attempt);
    if (result === "correct") {
      session.correct += 1;
      els.feedback.textContent = "Bravo !";
      els.feedback.className = "feedback ok";
      playSound("ok");
      card.streak += 1;
      card.lastResult = "correct";
      maybeReinsertCard(card);
    } else {
      session.incorrect += 1;
      const message = expired
        ? `Temps écoulé ! Réponse : ${correctAnswer}`
        : `Raté ! La bonne réponse : ${correctAnswer}`;
      els.feedback.textContent = message;
      els.feedback.className = "feedback nope";
      playSound("nope");
      card.streak = 0;
      card.lastResult = "wrong";
      requeueMiss(card);
    }
    renderSessionMeta();
    if (result === "correct") {
      session.currentDone = false;
      nextCard();
    } else if (!expired) {
      // Laisser l'enfant retenter la même opération (mauvaise réponse)
      els.answerInput.value = "";
      session.currentDone = false;
      session.currentStart = Date.now();
      startCountdown();
    } else {
      // Timeout : rester sur la question sans relancer le chrono
      els.answerInput.value = "";
      session.currentDone = false;
      els.timerLabel.textContent = "Temps : expiré";
      els.timerLabel.classList.add("muted");
    }
  }

  function endSession() {
    const player = getActivePlayer();
    if (player && session) {
      clearCountdown();
      updatePlayerStats(player, session.history);
      player.lastSession = {
        asked: session.asked,
        correct: session.correct,
        incorrect: session.incorrect,
        mode: session.mode,
        table: session.table,
        finishedAt: new Date().toISOString(),
      };
      saveStore();
    }
    renderSummary();
    session = null;
    showPanel("summary");
  }

  function updatePlayerStats(player, history) {
    player.factStreaks ||= {};
    history.forEach((attempt) => {
      const key = `${attempt.a}|${attempt.b}`;
      const stats = player.factStreaks[key] || { streak: 0, misses: 0 };
      if (attempt.result === "correct") {
        stats.streak = (stats.streak || 0) + 1;
      } else {
        stats.streak = 0;
        stats.misses = (stats.misses || 0) + 1;
      }
      player.factStreaks[key] = stats;
    });
  }

  function renderSummary() {
    if (!session) return;
    const { correct, incorrect, targetQuestions } = session;
    const total = Math.max(1, correct + incorrect);
    const accuracy = Math.round((correct / total) * 100);
    els.summaryText.textContent = "Bien joué ! Voici ton résultat.";
    els.summaryCorrect.textContent = correct;
    els.summaryWrong.textContent = incorrect;
    els.summaryAccuracy.textContent = `${accuracy}%`;
    els.progress.textContent = `Question ${session.asked} / ${targetQuestions}`;
  }

  function startCountdown() {
    clearCountdown();
    if (!session.timerEnabled) {
      els.timerLabel.textContent = "Temps : ∞";
      els.timerLabel.classList.add("muted");
      return;
    }
    els.timerLabel.classList.remove("muted");
    const totalMs = (session.timerSeconds || DEFAULT_TIMER_SECONDS) * 1000;
    const endAt = Date.now() + totalMs;
    const update = () => {
      const remaining = Math.max(0, endAt - Date.now());
      const secs = Math.ceil(remaining / 1000);
      els.timerLabel.textContent = `Temps : ${secs}s`;
    };
    update();
    session.timers.tick = setInterval(update, 200);
    session.timers.expiry = setTimeout(() => {
      finalizeAttempt({ submittedAnswer: null, expired: true });
    }, totalMs);
  }

  function clearCountdown() {
    if (!session?.timers) return;
    if (session.timers.tick) clearInterval(session.timers.tick);
    if (session.timers.expiry) clearTimeout(session.timers.expiry);
    session.timers.tick = null;
    session.timers.expiry = null;
  }

  function playSound(kind) {
    if (!userInteracted) return;
    const player = getActivePlayer();
    const soundOn = player?.settings?.soundOn ?? true;
    if (!soundOn) return;
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "ok" ? 680 : 260;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  function ensureUserInteraction() {
    if (userInteracted) return;
    userInteracted = true;
  }

  // UI events
  els.start.addEventListener("click", () => {
    showPanel("player");
  });

  els.backFromPlayer.addEventListener("click", () => showPanel("landing"));
  els.backFromMode.addEventListener("click", () => showPanel("player"));

  els.addPlayerForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = els.newPlayerName.value.trim();
    if (!name) return;
    addPlayer(name);
    els.newPlayerName.value = "";
  });

  els.choosePlayer.addEventListener("click", () => {
    const selected = els.playerSelect.value;
    if (!selected) {
      alert("Ajoute ou sélectionne un joueur pour continuer.");
      return;
    }
    setActivePlayer(selected);
    showPanel("mode");
  });

  els.tableRange.addEventListener("input", (e) => {
    els.tableValue.textContent = e.target.value;
  });

  els.beginSession.addEventListener("click", () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const table = Number(els.tableRange.value);
    store.settings = store.settings || { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
    store.settings.timerEnabled = Boolean(els.timerToggle.checked);
    saveStore();
    startSession({ mode, table });
  });

  els.answerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ensureUserInteraction();
      handleSubmit();
    }
  });

  els.submit.addEventListener("click", () => {
    ensureUserInteraction();
    handleSubmit();
  });

  els.keypad.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-key]");
    if (!btn) return;
    ensureUserInteraction();
    const key = btn.dataset.key;
    if (key === "back") {
      els.answerInput.value = els.answerInput.value.slice(0, -1);
    } else {
      els.answerInput.value += key;
    }
    els.answerInput.focus();
  });

  els.home.addEventListener("click", () => {
    showPanel("landing");
  });

  els.replay.addEventListener("click", () => {
    if (lastSessionParams) {
      startSession(lastSessionParams);
    } else {
      showPanel("mode");
    }
  });

  els.soundToggle.addEventListener("change", () => {
    const player = getActivePlayer();
    if (!player) return;
    player.settings = player.settings || {};
    player.settings.soundOn = els.soundToggle.checked;
    saveStore();
  });

  els.timerToggle.addEventListener("change", () => {
    store.settings = store.settings || { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
    store.settings.timerEnabled = Boolean(els.timerToggle.checked);
    saveStore();
  });

  document.addEventListener("pointerdown", ensureUserInteraction, { once: true });

  // Initial paint
  updatePlayerSelect();
  setActivePlayer(store.activePlayerId);
  els.timerLabel.textContent = (store.settings?.timerEnabled ?? true)
    ? `Temps : ${DEFAULT_TIMER_SECONDS}s`
    : "Temps : ∞";
})();
