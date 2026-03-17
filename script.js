(() => {
  "use strict";

  const panels = {
    landing: document.getElementById("panel-landing"),
    player: document.getElementById("panel-player"),
    mode: document.getElementById("panel-mode"),
    play: document.getElementById("panel-play"),
    summary: document.getElementById("panel-summary"),
    parent: document.getElementById("panel-parent"),
  };

  const els = {
    start: document.getElementById("btn-start"),
    startPlayer: document.getElementById("btn-start-player"),
    choosePlayer: document.getElementById("btn-choose-player"),
    backFromPlayer: document.getElementById("btn-back-from-player"),
    backFromMode: document.getElementById("btn-back-from-mode"),
    backToPlayer: document.getElementById("btn-back-to-player"),
    beginSession: document.getElementById("btn-begin-session"),
    replay: document.getElementById("btn-replay"),
    home: document.getElementById("btn-home"),
    parentBack: document.getElementById("btn-parent-back"),
    playerSelect: document.getElementById("player-select"),
    addPlayerForm: document.getElementById("player-add-form"),
    newPlayerName: document.getElementById("new-player-name"),
    tableCheckboxes: document.getElementById("table-checkboxes"),
    allTablesToggle: document.getElementById("all-tables-toggle"),
    activePlayerChip: document.getElementById("active-player-chip"),
    answerInput: document.getElementById("answer-input"),
    submit: document.getElementById("btn-submit"),
    playHome: document.getElementById("btn-play-home"),
    feedback: document.getElementById("feedback"),
    prompt: document.getElementById("prompt-text"),
    progress: document.getElementById("progress-label"),
    score: document.getElementById("score-label"),
    keypad: document.getElementById("keypad"),
    summaryText: document.getElementById("summary-text"),
    summaryCorrect: document.getElementById("summary-correct"),
    summaryWrong: document.getElementById("summary-wrong"),
    summaryAccuracy: document.getElementById("summary-accuracy"),
    summaryTarget: document.getElementById("summary-target"),
    summaryDelta: document.getElementById("summary-delta"),
    heatmapGrid: document.getElementById("heatmap-grid"),
    soundToggle: document.getElementById("sound-toggle"),
    timerToggle: document.getElementById("timer-toggle"),
    timerLabel: document.getElementById("timer-label"),
    timerSeconds: document.getElementById("timer-seconds"),
    hintToggle: document.getElementById("hint-toggle"),
    ttsToggle: document.getElementById("tts-toggle"),
    voiceInputToggle: document.getElementById("voice-input-toggle"),
    hintArea: document.getElementById("hint-area"),
    hintOptions: document.getElementById("hint-options"),
    opsGrid: document.getElementById("ops-grid"),
    voiceControls: document.getElementById("voice-controls"),
    speakPrompt: document.getElementById("btn-speak-prompt"),
    voiceAnswer: document.getElementById("btn-voice-answer"),
    voiceStatus: document.getElementById("voice-status"),
  };

  const STORAGE_KEY = "space-times-store";
  const DEFAULT_TARGET = 15;
  const DEFAULT_TIMER_SECONDS = 15;
  const MIN_WEIGHT = 1;
  const MAX_WEIGHT = 6;
  const HINT_LEAD_MS = 5000;
  const TARGET_SUCCESS_RATE = 0.8;

  let store = loadStore();
  let session = null;
  let lastSessionParams = null;
  let userInteracted = false;
  let audioCtx = null;
  let audioInitFailed = false;
  let voiceState = {
    ttsSupported: null,
    recognitionSupported: null,
    recognitionCtor: null,
    recognition: null,
    isListening: false,
    shouldAutoListen: false,
    autoListenTimer: null,
    ttsAvailable: true,
    recognitionAvailable: true,
  };

  function buildDefaultStore() {
    return {
      players: [],
      activePlayerId: null,
      settings: {
        timerEnabled: true,
        timerSeconds: DEFAULT_TIMER_SECONDS,
        hintEnabled: false,
      },
    };
  }

  function applyPlayerSettingDefaults(player) {
    player.sessions ||= [];
    player.settings ||= {};
    if (typeof player.settings.soundOn !== "boolean") {
      player.settings.soundOn = true;
    }
    if (typeof player.settings.ttsEnabled !== "boolean") {
      player.settings.ttsEnabled = false;
    }
    if (typeof player.settings.voiceInputEnabled !== "boolean") {
      player.settings.voiceInputEnabled = false;
    }
  }

  function clampTimer(value) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return Math.min(60, Math.max(5, Math.round(n)));
    }
    return DEFAULT_TIMER_SECONDS;
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return buildDefaultStore();
      }
      const parsed = JSON.parse(raw);
      parsed.players ||= [];
      parsed.players.forEach(applyPlayerSettingDefaults);
      parsed.settings ||= buildDefaultStore().settings;
      parsed.settings.timerSeconds = clampTimer(parsed.settings.timerSeconds);
      parsed.settings.hintEnabled = Boolean(parsed.settings.hintEnabled);
      return parsed;
    } catch (e) {
      console.warn("Impossible de lire le stockage, réinitialisation.", e);
      return buildDefaultStore();
    }
  }

  function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function showPanel(name) {
    if (name === "player") {
      updatePlayerSelect();
    }
    if (name !== "play") {
      stopSpeaking();
      stopVoiceRecognition();
    }
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
    } else if (store.players.length > 0) {
      setActivePlayer(store.players[0].id);
      select.value = store.activePlayerId;
    }
  }

  function getActivePlayer() {
    const player = store.players.find((p) => p.id === store.activePlayerId) || null;
    if (player) {
      applyPlayerSettingDefaults(player);
    }
    return player;
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
      els.ttsToggle.checked = Boolean(player.settings?.ttsEnabled);
      els.voiceInputToggle.checked = Boolean(player.settings?.voiceInputEnabled);
    } else {
      els.activePlayerChip.textContent = "Joueur : aucun";
      els.activePlayerChip.classList.add("muted");
      els.soundToggle.checked = true;
      els.ttsToggle.checked = false;
      els.voiceInputToggle.checked = false;
    }
    const timerOn = store.settings?.timerEnabled ?? true;
    els.timerToggle.checked = timerOn;
    els.timerSeconds.value = clampTimer(store.settings?.timerSeconds ?? DEFAULT_TIMER_SECONDS);
    els.hintToggle.checked = Boolean(store.settings?.hintEnabled);
  }

  function addPlayer(name) {
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newPlayer = {
      id,
      name: name.trim(),
      factStreaks: {},
      lastSession: null,
      settings: { soundOn: true, ttsEnabled: false, voiceInputEnabled: false },
    };
    store.players.push(newPlayer);
    setActivePlayer(id);
    saveStore();
    updatePlayerSelect();
  }

  function buildDeck(mode, table, player) {
    const facts = [];
    const tables = Array.isArray(mode) ? mode : [table];
    const allTables = tables.length === 10;
    if (allTables) {
      for (let a = 1; a <= 10; a++) {
        for (let b = 1; b <= 10; b++) {
          facts.push([a, b]);
        }
      }
    } else {
      tables.forEach((t) => {
        for (let a = 1; a <= 10; a++) {
          facts.push([a, t]);
        }
      });
    }
    const deckSize = allTables ? 20 : Math.min(25, facts.length);
    const attemptStats = collectAttemptStats(player);
    const scored = facts.map(([a, b]) => {
      const key = `${a}|${b}`;
      const streakStats = player?.factStreaks?.[key] || { streak: 0, misses: 0 };
      const predicted = estimateSuccessProbability(key, attemptStats);
      const selectionWeight = computeSelectionWeight(predicted);
      const baseWeight = clampWeight(5 - streakStats.streak + (streakStats.misses > 0 ? 1 : 0));
      let dueWeight = baseWeight;
      if (predicted < TARGET_SUCCESS_RATE - 0.15) {
        dueWeight += 2;
      } else if (predicted < TARGET_SUCCESS_RATE) {
        dueWeight += 1;
      } else if (predicted > TARGET_SUCCESS_RATE + 0.15) {
        dueWeight -= 1;
      }
      dueWeight = clampWeight(dueWeight);
      return {
        a,
        b,
        streak: streakStats.streak || 0,
        dueWeight,
        seen: 0,
        lastResult: streakStats.misses > 0 ? "wrong" : undefined,
        selectionWeight,
      };
    });
    const chosen = weightedSample(scored, deckSize);
    shuffleArray(chosen);
    return chosen;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function collectAttemptStats(player) {
    const stats = {};
    if (!player) return stats;
    (player.sessions || []).forEach((session) => {
      (session.attempts || []).forEach((att) => {
        const key = `${att.a}|${att.b}`;
        const entry = stats[key] || { success: 0, fail: 0 };
        if (att.result === "correct") {
          entry.success += 1;
        } else {
          entry.fail += 1;
        }
        stats[key] = entry;
      });
    });
    return stats;
  }

  function estimateSuccessProbability(key, attemptStats) {
    const stats = attemptStats[key] || { success: 0, fail: 0 };
    const total = stats.success + stats.fail;
    return (stats.success + 1) / (total + 2); // Laplace smoothing to avoid 0/1 extremes
  }

  function computeSelectionWeight(predictedSuccess) {
    const delta = TARGET_SUCCESS_RATE - predictedSuccess;
    const weight = 1 + delta * 3; // favor facts below target, mildly downweight easy ones
    return Math.max(0.2, weight);
  }

  function weightedSample(items, count) {
    const pool = items.slice();
    const chosen = [];
    while (chosen.length < count && pool.length > 0) {
      const total = pool.reduce((sum, item) => sum + item.selectionWeight, 0);
      if (total <= 0) break;
      let roll = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        roll -= pool[idx].selectionWeight;
        if (roll <= 0) break;
      }
      const pick = pool.splice(idx, 1)[0];
      chosen.push(pick);
    }
    return chosen.length > 0 ? chosen : items.slice(0, count);
  }

  function startSession(params) {
    const player = getActivePlayer();
    if (!player) {
      alert("Choisis ou crée un joueur avant de commencer.");
      return;
    }
    applyPlayerSettingDefaults(player);
    const deck = buildDeck(params.tables, null, player);
    shuffleArray(deck);
    session = {
      mode: params.tables.length === 10 ? "mixed" : params.tables.length > 1 ? "multi" : "single",
      table: params.tables.length === 1 ? params.tables[0] : null,
      tables: params.tables,
      queue: deck,
      asked: 0,
      correct: 0,
      incorrect: 0,
      history: [],
      targetQuestions: DEFAULT_TARGET,
      targetSuccessRate: TARGET_SUCCESS_RATE,
      timerEnabled: store.settings?.timerEnabled ?? true,
      timerSeconds: clampTimer(store.settings?.timerSeconds ?? DEFAULT_TIMER_SECONDS),
      hintEnabled: Boolean(store.settings?.hintEnabled),
      ttsEnabled: Boolean(player.settings?.ttsEnabled),
      voiceInputEnabled: Boolean(player.settings?.voiceInputEnabled),
      timers: { tick: null, expiry: null, hint: null },
      currentStart: null,
      currentDone: false,
      voice: {
        ttsAvailable: true,
        recognitionAvailable: true,
      },
    };
    lastSessionParams = { ...params };
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    ensureVoiceCapabilities();
    resetVoiceSessionState();
    applyInitialVoiceAvailability();
    nextCard();
    showPanel("play");
    renderSessionMeta();
  }

  function nextCard() {
    if (!session) return;
    stopSpeaking();
    stopVoiceRecognition();
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
    syncVoiceControls();
    playPromptVoiceLoop();
  }

  function shuffleTail(queue, windowSize) {
    if (queue.length <= 2) return;
    const tail = queue.splice(-Math.min(windowSize, queue.length));
    shuffleArray(tail);
    queue.push(...tail);
  }

  function showHintOptions() {
    if (!session?.current || session.currentDone) return;
    const totalMs = (session.timerSeconds || DEFAULT_TIMER_SECONDS) * 1000;
    if (!session.timerEnabled || totalMs <= HINT_LEAD_MS) return;
    const correct = session.current.a * session.current.b;
    const options = buildHintOptions(correct);
    els.hintOptions.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        ensureUserInteraction();
        finalizeAttempt({ submittedAnswer: opt, hintUsed: true });
      });
      els.hintOptions.appendChild(btn);
    });
    els.hintArea.classList.remove("hidden");
  }

  function buildHintOptions(correct) {
    const opts = new Set([correct]);
    while (opts.size < 3) {
      const delta = Math.floor(Math.random() * 5) + 1;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const candidate = Math.max(0, correct + sign * delta);
      opts.add(candidate === correct ? candidate + delta + 1 : candidate);
    }
    const arr = Array.from(opts);
    shuffleArray(arr);
    return arr;
  }

  function clearHint() {
    els.hintArea.classList.add("hidden");
    els.hintOptions.innerHTML = "";
    if (session?.timers?.hint) {
      clearTimeout(session.timers.hint);
      session.timers.hint = null;
    }
  }

  function renderPrompt() {
    if (!session?.current) return;
    const { a, b } = session.current;
    els.prompt.textContent = `${a} × ${b} = ?`;
    els.answerInput.value = "";
    const keepVoiceStatus = (session.ttsEnabled && !session.voice?.ttsAvailable) ||
      (session.voiceInputEnabled && !session.voice?.recognitionAvailable);
    if (!keepVoiceStatus) {
      setVoiceStatus("");
    }
    focusAnswer();
  }

  function renderSessionMeta() {
    els.progress.textContent = `Question ${session.asked} / ${session.targetQuestions}`;
    els.score.textContent = `Score : ${session.correct} ✓ / ${session.incorrect} ✗`;
  }

  function handleSubmit() {
    if (!session?.current) return;
    if (session.currentDone) return;
    stopVoiceRecognition();
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
    const depth = Math.max(1, Math.min(session.queue.length, card.dueWeight));
    const insertAt = Math.min(session.queue.length, session.queue.length - depth);
    session.queue.splice(insertAt, 0, clone);
  }

  function requeueMiss(card) {
    if (!session) return;
    const clone = { ...card };
    const spot = Math.min(2, session.queue.length);
    session.queue.splice(spot, 0, clone);
  }

  function finalizeAttempt({ submittedAnswer = null, expired = false, hintUsed = false }) {
    if (!session?.current || session.currentDone) return;
    clearCountdown();
    clearHint();
    stopSpeaking();
    stopVoiceRecognition();
    session.currentDone = true;
    const card = session.current;
    const correctAnswer = card.a * card.b;
    const isCorrect = submittedAnswer === correctAnswer;
    const result = expired ? (isCorrect ? "correct" : "timeout") : isCorrect ? "correct" : "wrong";
    const durationMs = Math.max(0, Date.now() - (session.currentStart || Date.now()));
    session.asked += 1;
    const attempt = {
      a: card.a,
      b: card.b,
      answer: submittedAnswer,
      correctAnswer,
      result,
      durationMs,
      hintUsed: Boolean(hintUsed),
      expired: Boolean(expired),
    };
    session.history.push(attempt);
    if (result === "correct") {
      session.correct += 1;
      els.feedback.textContent = expired ? "Bravo, juste à temps !" : "Bravo !";
      els.feedback.className = "feedback ok";
      playSound("ok");
      card.streak += 1;
      card.lastResult = "correct";
      card.dueWeight = clampWeight((card.dueWeight || 3) + 1);
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
      card.dueWeight = MIN_WEIGHT;
      requeueMiss(card);
    }
    renderSessionMeta();
    if (result === "correct") {
      session.currentDone = false;
      nextCard();
    } else if (!expired) {
      // Laisser l'enfant retenter la même opération (mauvaise réponse)
      els.answerInput.value = "";
      focusAnswer();
      session.currentDone = false;
      session.currentStart = Date.now();
      startCountdown();
      scheduleAutoListening(250);
    } else {
      // Timeout : rester sur la question sans relancer le chrono
      els.answerInput.value = "";
      focusAnswer();
      session.currentDone = false;
      els.timerLabel.textContent = "Temps : expiré";
      els.timerLabel.classList.add("muted");
      scheduleAutoListening(250);
    }
  }

  function endSession() {
    const player = getActivePlayer();
    if (player && session) {
      clearCountdown();
      stopSpeaking();
      stopVoiceRecognition();
      updatePlayerStats(player, session.history);
      const achievedAccuracy = calculateAccuracy(session.correct, session.incorrect);
      const targetRate = session.targetSuccessRate || TARGET_SUCCESS_RATE;
      const sessionRecord = {
        asked: session.asked,
        correct: session.correct,
        incorrect: session.incorrect,
        mode: session.mode,
        table: session.table,
        tables: session.tables,
        finishedAt: new Date().toISOString(),
        targetSuccessRate: targetRate,
        achievedAccuracy,
        accuracyDelta: achievedAccuracy - targetRate,
        attempts: session.history.slice(), // shallow copy for persistence
      };
      player.lastSession = sessionRecord;
      player.sessions = player.sessions || [];
      player.sessions.unshift(sessionRecord);
      if (player.sessions.length > 10) {
        player.sessions.length = 10; // garder les 10 dernières
      }
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

  function renderOpsGrid() {
    const player = getActivePlayer();
    els.opsGrid.innerHTML = "";
    if (!player) {
      const msg = document.createElement("div");
      msg.textContent = "Aucun joueur sélectionné.";
      els.opsGrid.appendChild(msg);
      return;
    }
    const attemptStats = collectAttemptStats(player);
    const cards = [];
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const key = `${a}|${b}`;
        const stats = player.factStreaks?.[key] || { streak: 0, misses: 0 };
        const attempts = attemptStats[key] || { success: 0, fail: 0 };
        cards.push({ a, b, success: attempts.success, fail: attempts.fail, streak: stats.streak || 0 });
      }
    }
    cards.forEach((card) => {
      const div = document.createElement("div");
      div.className = "op-card";
      const title = document.createElement("div");
      title.className = "op-title";
      title.textContent = `${card.a} × ${card.b}`;
      const statsRow = document.createElement("div");
      statsRow.className = "op-stats";

      const pillSucc = document.createElement("span");
      pillSucc.className = "pill good";
      pillSucc.textContent = `${card.success} ✓`;

      const pillFail = document.createElement("span");
      pillFail.className = "pill bad";
      pillFail.textContent = `${card.fail} ✗`;

      const streak = document.createElement("span");
      streak.className = "pill";
      streak.textContent = `Streak: ${card.streak}`;

      statsRow.appendChild(pillSucc);
      statsRow.appendChild(pillFail);
      statsRow.appendChild(streak);

      div.appendChild(title);
      div.appendChild(statsRow);
      els.opsGrid.appendChild(div);
    });
  }

  function renderHeatmap() {
    const player = getActivePlayer();
    const container = els.heatmapGrid;
    if (!container) return;
    container.innerHTML = "";
    if (!player) {
      const msg = document.createElement("div");
      msg.className = "heat-empty";
      msg.textContent = "Aucun joueur sélectionné.";
      container.appendChild(msg);
      return;
    }
    const attemptStats = collectAttemptStats(player);
    let maxFail = 0;
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const key = `${a}|${b}`;
        const fails = attemptStats[key]?.fail || 0;
        if (fails > maxFail) maxFail = fails;
      }
    }
    if (maxFail === 0) {
      const msg = document.createElement("div");
      msg.className = "heat-empty";
      msg.textContent = "Aucune erreur enregistrée pour le moment.";
      container.appendChild(msg);
      return;
    }
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const key = `${a}|${b}`;
        const fails = attemptStats[key]?.fail || 0;
        const ratio = maxFail > 0 ? fails / maxFail : 0;
        const cell = document.createElement("div");
        cell.className = "heat-cell";
        const bg = buildHeatColor(ratio);
        cell.style.background = bg.bg;
        cell.style.borderColor = bg.border;
        const label = document.createElement("div");
        label.className = "heat-label";
        label.textContent = `${a}×${b}`;
        const count = document.createElement("div");
        count.className = "heat-count";
        count.textContent = `${fails} ✗`;
        cell.appendChild(label);
        cell.appendChild(count);
        container.appendChild(cell);
      }
    }
  }

  function renderSummary() {
    if (!session) return;
    const { correct, incorrect, targetQuestions } = session;
    const achieved = calculateAccuracy(correct, incorrect);
    const accuracy = Math.round(achieved * 100);
    const targetRate = session.targetSuccessRate || TARGET_SUCCESS_RATE;
    const targetPct = Math.round(targetRate * 100);
    const delta = accuracy - targetPct;
    els.summaryText.textContent = `Objectif ${targetPct}% · Obtenu ${accuracy}%`;
    els.summaryCorrect.textContent = correct;
    els.summaryWrong.textContent = incorrect;
    els.summaryAccuracy.textContent = `${accuracy}%`;
    els.summaryTarget.textContent = `${targetPct}%`;
    els.summaryDelta.textContent = `${delta >= 0 ? "+" : ""}${delta}%`;
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
    if (session.hintEnabled) {
      const hintDelay = Math.max(0, totalMs - HINT_LEAD_MS);
      if (hintDelay > 0) {
        session.timers.hint = setTimeout(() => {
          showHintOptions();
        }, hintDelay);
      }
    }
    session.timers.expiry = setTimeout(() => {
      const pending = els.answerInput.value.trim();
      const parsed = pending === "" ? null : Number(pending);
      finalizeAttempt({ submittedAnswer: Number.isFinite(parsed) ? parsed : null, expired: true });
    }, totalMs);
  }

  function clearCountdown() {
    if (!session?.timers) return;
    if (session.timers.tick) clearInterval(session.timers.tick);
    if (session.timers.expiry) clearTimeout(session.timers.expiry);
    if (session.timers.hint) clearTimeout(session.timers.hint);
    session.timers.tick = null;
    session.timers.expiry = null;
    session.timers.hint = null;
  }

  function ensureVoiceCapabilities() {
    if (voiceState.ttsSupported === null) {
      voiceState.ttsSupported = typeof window.speechSynthesis !== "undefined" &&
        typeof window.SpeechSynthesisUtterance !== "undefined";
    }
    if (voiceState.recognitionSupported === null) {
      const ctor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
      voiceState.recognitionCtor = ctor;
      voiceState.recognitionSupported = Boolean(ctor);
    }
  }

  function resetVoiceSessionState() {
    if (!session) return;
    session.voice = {
      ttsAvailable: true,
      recognitionAvailable: true,
    };
    voiceState.ttsAvailable = true;
    voiceState.recognitionAvailable = true;
    setVoiceStatus("");
  }

  function applyInitialVoiceAvailability() {
    if (!session) return;
    const ttsMissing = session.ttsEnabled && !voiceState.ttsSupported;
    const recognitionMissing = session.voiceInputEnabled && !voiceState.recognitionSupported;
    if (!ttsMissing && !recognitionMissing) return;
    if (ttsMissing) {
      session.voice.ttsAvailable = false;
      voiceState.ttsAvailable = false;
    }
    if (recognitionMissing) {
      session.voice.recognitionAvailable = false;
      voiceState.recognitionAvailable = false;
    }
    if (ttsMissing && recognitionMissing) {
      setVoiceStatus("Fonctions vocales indisponibles.", "nope");
      return;
    }
    if (ttsMissing) {
      setVoiceStatus("Lecture vocale indisponible.", "nope");
      return;
    }
    setVoiceStatus("Réponse vocale indisponible.", "nope");
  }

  function buildSpokenPrompt(card) {
    if (!card) return "";
    return `${numberToFrenchWords(card.a)} fois ${numberToFrenchWords(card.b)}`;
  }

  function numberToFrenchWords(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return String(value);
    }
    const directMap = {
      0: "zero",
      1: "un",
      2: "deux",
      3: "trois",
      4: "quatre",
      5: "cinq",
      6: "six",
      7: "sept",
      8: "huit",
      9: "neuf",
      10: "dix",
      11: "onze",
      12: "douze",
      13: "treize",
      14: "quatorze",
      15: "quinze",
      16: "seize",
      17: "dix-sept",
      18: "dix-huit",
      19: "dix-neuf",
      20: "vingt",
      30: "trente",
      40: "quarante",
      50: "cinquante",
      60: "soixante",
      70: "soixante-dix",
      71: "soixante-et-onze",
      80: "quatre-vingts",
      90: "quatre-vingt-dix",
      100: "cent",
    };
    if (Object.prototype.hasOwnProperty.call(directMap, number)) {
      return directMap[number];
    }
    if (number < 0 || number > 100) {
      return String(number);
    }
    if (number < 70) {
      const tens = Math.floor(number / 10) * 10;
      const unit = number % 10;
      if (unit === 1 && tens !== 80) {
        return `${directMap[tens]}-et-un`;
      }
      return `${directMap[tens]}-${directMap[unit]}`;
    }
    if (number < 80) {
      return `soixante-${numberToFrenchWords(number - 60)}`;
    }
    if (number < 100) {
      if (number === 81) return "quatre-vingt-un";
      return `quatre-vingt-${numberToFrenchWords(number - 80)}`;
    }
    return String(number);
  }

  function setVoiceStatus(message, kind = "") {
    if (!els.voiceStatus) return;
    els.voiceStatus.textContent = message;
    els.voiceStatus.className = "voice-status";
    if (!message) {
      els.voiceStatus.classList.add("hidden");
      return;
    }
    if (kind) {
      els.voiceStatus.classList.add(kind);
    }
  }

  function syncVoiceControls() {
    if (!els.voiceControls || !session) return;
    ensureVoiceCapabilities();
    const hasStatus = Boolean(els.voiceStatus?.textContent);
    const ttsVisible = session.ttsEnabled && voiceState.ttsSupported && session.voice.ttsAvailable;
    const recognitionActive = session.voiceInputEnabled &&
      voiceState.recognitionSupported &&
      session.voice.recognitionAvailable;
    const showControls = ttsVisible || recognitionActive || hasStatus;
    els.voiceControls.classList.toggle("hidden", !showControls);
    els.speakPrompt.classList.toggle("hidden", !ttsVisible);
    els.voiceAnswer.classList.add("hidden");
  }

  function markTtsUnavailable(message) {
    if (!session?.voice) return;
    session.voice.ttsAvailable = false;
    voiceState.ttsAvailable = false;
    stopSpeaking();
    if (message) {
      setVoiceStatus(message, "nope");
    }
    syncVoiceControls();
  }

  function markRecognitionUnavailable(message) {
    if (!session?.voice) return;
    session.voice.recognitionAvailable = false;
    voiceState.recognitionAvailable = false;
    stopVoiceRecognition();
    if (message) {
      setVoiceStatus(message, "nope");
    }
    syncVoiceControls();
  }

  function speakText(text, { onend } = {}) {
    ensureVoiceCapabilities();
    if (!session?.ttsEnabled || !text) return;
    if (!voiceState.ttsSupported || !session.voice?.ttsAvailable) {
      if (typeof onend === "function") {
        onend();
      }
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.9;
      utterance.onend = () => {
        if (typeof onend === "function") {
          onend();
        }
      };
      utterance.onerror = () => {
        markTtsUnavailable("Lecture vocale indisponible.");
        if (typeof onend === "function") {
          onend();
        }
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis unavailable.", e);
      markTtsUnavailable("Lecture vocale indisponible.");
      if (typeof onend === "function") {
        onend();
      }
    }
  }

  function speakCurrentPrompt() {
    if (!session?.current || !session.ttsEnabled) return;
    speakText(buildSpokenPrompt(session.current));
  }

  function clearAutoListenTimer() {
    if (voiceState.autoListenTimer) {
      clearTimeout(voiceState.autoListenTimer);
      voiceState.autoListenTimer = null;
    }
  }

  function scheduleAutoListening(delayMs = 150) {
    clearAutoListenTimer();
    if (!session?.voiceInputEnabled || !session.voice?.recognitionAvailable) return;
    voiceState.shouldAutoListen = true;
    voiceState.autoListenTimer = setTimeout(() => {
      voiceState.autoListenTimer = null;
      if (!session?.current || session.currentDone) return;
      startVoiceRecognition();
    }, delayMs);
  }

  function playPromptVoiceLoop() {
    if (!session?.current) return;
    clearAutoListenTimer();
    if (session.ttsEnabled && voiceState.ttsSupported && session.voice?.ttsAvailable) {
      speakText(buildSpokenPrompt(session.current), {
        onend: () => {
          scheduleAutoListening();
        },
      });
      return;
    }
    scheduleAutoListening();
  }

  function stopSpeaking() {
    if (typeof window.speechSynthesis === "undefined") return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn("Unable to cancel speech synthesis.", e);
    }
  }

  function parseTranscriptAsNumber(transcript) {
    if (!transcript) return null;
    const normalized = transcript
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 -]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) return null;
    const digitMatch = normalized.match(/\d+/);
    if (digitMatch) {
      return Number(digitMatch[0]);
    }
    const directMap = {
      zero: 0,
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
      sept: 7,
      huit: 8,
      neuf: 9,
      dix: 10,
      onze: 11,
      douze: 12,
      treize: 13,
      quatorze: 14,
      quinze: 15,
      seize: 16,
      "dix sept": 17,
      "dix huit": 18,
      "dix neuf": 19,
      vingt: 20,
      trente: 30,
      quarante: 40,
      cinquante: 50,
      soixante: 60,
      "soixante dix": 70,
      "soixante et onze": 71,
      "quatre vingt": 80,
      "quatre vingt dix": 90,
      cent: 100,
    };
    if (Object.prototype.hasOwnProperty.call(directMap, normalized)) {
      return directMap[normalized];
    }
    const tokens = normalized
      .replace(/-/g, " ")
      .split(" ")
      .filter((token) => token && token !== "et");
    if (!tokens.length) return null;
    const unitMap = {
      zero: 0,
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
      sept: 7,
      huit: 8,
      neuf: 9,
    };
    const teenMap = {
      dix: 10,
      onze: 11,
      douze: 12,
      treize: 13,
      quatorze: 14,
      quinze: 15,
      seize: 16,
    };
    const tensMap = {
      vingt: 20,
      trente: 30,
      quarante: 40,
      cinquante: 50,
      soixante: 60,
    };
    let total = 0;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (Object.prototype.hasOwnProperty.call(teenMap, token)) {
        total += teenMap[token];
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(tensMap, token)) {
        total += tensMap[token];
        continue;
      }
      if (token === "dix" && Object.prototype.hasOwnProperty.call(unitMap, tokens[i + 1])) {
        total += 10 + unitMap[tokens[i + 1]];
        i += 1;
        continue;
      }
      if (token === "soixante" && token === tokens[i]) {
        const next = tokens[i + 1];
        if (next === "dix") {
          const unit = unitMap[tokens[i + 2]] || 0;
          total += 70 + unit;
          i += unit ? 2 : 1;
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(teenMap, next)) {
          total += 60 + teenMap[next];
          i += 1;
          continue;
        }
      }
      if (token === "quatre" && tokens[i + 1] === "vingt") {
        const next = tokens[i + 2];
        if (!next) {
          total += 80;
          i += 1;
          continue;
        }
        if (next === "dix") {
          const unit = unitMap[tokens[i + 3]] || 0;
          total += 90 + unit;
          i += unit ? 3 : 2;
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(teenMap, next)) {
          total += 80 + teenMap[next];
          i += 2;
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(unitMap, next)) {
          total += 80 + unitMap[next];
          i += 2;
          continue;
        }
      }
      if (Object.prototype.hasOwnProperty.call(unitMap, token)) {
        total += unitMap[token];
        continue;
      }
      return null;
    }
    return Number.isFinite(total) ? total : null;
  }

  function handleRecognizedTranscript(transcript) {
    const parsed = parseTranscriptAsNumber(transcript);
    if (!Number.isFinite(parsed)) {
      setVoiceStatus("Réponse non comprise.", "nope");
      return;
    }
    setVoiceStatus(`Réponse entendue : ${parsed}`, "ok");
    els.answerInput.value = String(parsed);
    finalizeAttempt({ submittedAnswer: parsed });
  }

  function startVoiceRecognition() {
    if (!session?.voiceInputEnabled || session.currentDone) return;
    ensureUserInteraction();
    ensureVoiceCapabilities();
    if (!voiceState.recognitionSupported || !voiceState.recognitionCtor) {
      markRecognitionUnavailable("Réponse vocale indisponible.");
      return;
    }
    if (!session.voice?.recognitionAvailable) return;
    stopSpeaking();
    stopVoiceRecognition(false);
    voiceState.shouldAutoListen = true;
    try {
      const recognition = new voiceState.recognitionCtor();
      voiceState.recognition = recognition;
      voiceState.isListening = true;
      recognition.lang = "fr-FR";
      recognition.maxAlternatives = 1;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => {
        voiceState.isListening = true;
        setVoiceStatus("J'écoute...", "ok");
        syncVoiceControls();
      };
      recognition.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || "";
        voiceState.isListening = false;
        syncVoiceControls();
        handleRecognizedTranscript(transcript);
      };
      recognition.onerror = (event) => {
        voiceState.isListening = false;
        const code = event?.error || "unknown";
        if (code === "not-allowed" || code === "service-not-allowed") {
          markRecognitionUnavailable("Micro refusé, réponse vocale masquée.");
          return;
        }
        if (code === "audio-capture") {
          markRecognitionUnavailable("Micro indisponible.");
          return;
        }
        if (code !== "aborted" && code !== "no-speech") {
          setVoiceStatus("Écoute impossible, réessaie.", "nope");
        }
        syncVoiceControls();
      };
      recognition.onend = () => {
        voiceState.isListening = false;
        voiceState.recognition = null;
        if (voiceState.shouldAutoListen && session?.voiceInputEnabled && !session.currentDone && session.voice?.recognitionAvailable) {
          scheduleAutoListening(300);
          return;
        }
        syncVoiceControls();
      };
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition unavailable.", e);
      markRecognitionUnavailable("Réponse vocale indisponible.");
    }
  }

  function stopVoiceRecognition(keepAutoListen = false) {
    clearAutoListenTimer();
    if (!keepAutoListen) {
      voiceState.shouldAutoListen = false;
    }
    if (!voiceState.recognition) {
      voiceState.isListening = false;
      return;
    }
    const active = voiceState.recognition;
    voiceState.recognition = null;
    voiceState.isListening = false;
    try {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.onstart = null;
      active.stop();
    } catch (e) {
      console.warn("Unable to stop voice recognition.", e);
    }
    syncVoiceControls();
  }

  function playSound(kind) {
    if (!userInteracted || audioInitFailed) return;
    const player = getActivePlayer();
    const soundOn = player?.settings?.soundOn ?? true;
    if (!soundOn) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    try {
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
    } catch (e) {
      audioInitFailed = true;
      console.warn("Audio playback failed, sound disabled for this session.", e);
    }
  }

  function getAudioContext() {
    if (audioInitFailed) return null;
    if (audioCtx) return audioCtx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        audioInitFailed = true;
        return null;
      }
      audioCtx = new AudioContext();
      return audioCtx;
    } catch (e) {
      audioInitFailed = true;
      console.warn("Audio context unavailable.", e);
      return null;
    }
  }

  function ensureUserInteraction() {
    if (userInteracted) return;
    userInteracted = true;
  }

  function isCoarsePointerDevice() {
    return window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
  }

  function configureAnswerInputForDevice() {
    if (!els.answerInput) return;
    const isMobile = isCoarsePointerDevice();
    if (isMobile) {
      els.answerInput.type = "text";
      els.answerInput.setAttribute("inputmode", "none");
      els.answerInput.setAttribute("readonly", "readonly");
    } else {
      els.answerInput.type = "number";
      els.answerInput.setAttribute("inputmode", "numeric");
      els.answerInput.removeAttribute("readonly");
    }
  }

  // UI events
  els.start.addEventListener("click", () => {
    showPanel("player");
  });
  els.startPlayer.addEventListener("click", () => {
    showPanel("player");
  });

  els.backFromPlayer.addEventListener("click", () => showPanel("landing"));
  els.backFromMode.addEventListener("click", () => showPanel("player"));
  els.backToPlayer.addEventListener("click", () => showPanel("player"));

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

  els.beginSession.addEventListener("click", () => {
    const tables = getSelectedTables();
    if (tables.length === 0) {
      alert("Choisis au moins une table.");
      return;
    }
    store.settings = store.settings || { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
    store.settings.timerEnabled = Boolean(els.timerToggle.checked);
    store.settings.timerSeconds = clampTimer(els.timerSeconds.value || DEFAULT_TIMER_SECONDS);
    els.timerSeconds.value = store.settings.timerSeconds;
    saveStore();
    startSession({ tables });
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

  els.parentBack.addEventListener("click", () => {
    showPanel("landing");
  });

  els.activePlayerChip.addEventListener("click", () => {
    showPanel("player");
  });

  const parentButton = document.createElement("button");
  parentButton.textContent = "Espace parent";
  parentButton.className = "btn ghost small";
  parentButton.addEventListener("click", () => {
    renderOpsGrid();
    renderHeatmap();
    showPanel("parent");
  });
  document.querySelector(".status")?.appendChild(parentButton);

  function exitToHome() {
    clearCountdown();
    clearHint();
    stopSpeaking();
    stopVoiceRecognition();
    session = null;
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    els.answerInput.value = "";
    setVoiceStatus("");
    updateIdleTimerLabel();
    showPanel("landing");
  }

  els.playHome.addEventListener("click", () => {
    exitToHome();
  });

  els.replay.addEventListener("click", () => {
    stopSpeaking();
    stopVoiceRecognition();
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

  els.ttsToggle.addEventListener("change", () => {
    const player = getActivePlayer();
    if (!player) return;
    player.settings = player.settings || {};
    player.settings.ttsEnabled = Boolean(els.ttsToggle.checked);
    saveStore();
  });

  els.voiceInputToggle.addEventListener("change", () => {
    const player = getActivePlayer();
    if (!player) return;
    player.settings = player.settings || {};
    player.settings.voiceInputEnabled = Boolean(els.voiceInputToggle.checked);
    saveStore();
  });

  els.timerToggle.addEventListener("change", () => {
    store.settings = store.settings || { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
    store.settings.timerEnabled = Boolean(els.timerToggle.checked);
    saveStore();
    updateIdleTimerLabel();
  });

  els.timerSeconds.addEventListener("input", () => {
    store.settings = store.settings || { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
    store.settings.timerSeconds = clampTimer(els.timerSeconds.value || DEFAULT_TIMER_SECONDS);
    els.timerSeconds.value = store.settings.timerSeconds;
    saveStore();
    updateIdleTimerLabel();
  });

  els.hintToggle.addEventListener("change", () => {
    store.settings = store.settings || { timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS };
    store.settings.hintEnabled = Boolean(els.hintToggle.checked);
    saveStore();
  });

  els.speakPrompt.addEventListener("click", () => {
    ensureUserInteraction();
    playPromptVoiceLoop();
  });

  els.voiceAnswer.addEventListener("click", () => {
    if (voiceState.isListening) {
      stopVoiceRecognition();
      setVoiceStatus("");
      return;
    }
    startVoiceRecognition();
  });

  function getSelectedTables() {
    const boxes = els.tableCheckboxes.querySelectorAll('input[type="checkbox"]');
    const chosen = [];
    boxes.forEach((box) => {
      if (box.checked) chosen.push(Number(box.value));
    });
    if (els.allTablesToggle.checked) {
      return [1,2,3,4,5,6,7,8,9,10];
    }
    return chosen;
  }

  function syncAllToggle() {
    const boxes = els.tableCheckboxes.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(boxes).every((b) => b.checked);
    els.allTablesToggle.checked = allChecked;
  }

  els.allTablesToggle.addEventListener("change", () => {
    const boxes = els.tableCheckboxes.querySelectorAll('input[type="checkbox"]');
    boxes.forEach((box) => {
      box.checked = els.allTablesToggle.checked;
    });
  });

  els.tableCheckboxes.addEventListener("change", syncAllToggle);

  function updateIdleTimerLabel() {
    const enabled = store.settings?.timerEnabled ?? true;
    const secs = clampTimer(store.settings?.timerSeconds ?? DEFAULT_TIMER_SECONDS);
    if (enabled) {
      els.timerLabel.textContent = `Temps : ${secs}s`;
      els.timerLabel.classList.remove("muted");
    } else {
      els.timerLabel.textContent = "Temps : ∞";
      els.timerLabel.classList.add("muted");
    }
  }

  els.activePlayerChip.addEventListener("click", () => {
    showPanel("player");
  });

  document.addEventListener("pointerdown", ensureUserInteraction, { once: true });
  const pointerMedia = window.matchMedia ? window.matchMedia("(pointer:coarse)") : null;
  if (pointerMedia?.addEventListener) {
    pointerMedia.addEventListener("change", configureAnswerInputForDevice);
  } else if (pointerMedia?.addListener) {
    pointerMedia.addListener(configureAnswerInputForDevice);
  }

  function focusAnswer() {
    setTimeout(() => {
      els.answerInput?.focus();
    }, 0);
  }

  function clampWeight(n) {
    return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, Math.round(n)));
  }

  function calculateAccuracy(correct, incorrect) {
    const total = Math.max(1, correct + incorrect);
    return correct / total;
  }

  function buildHeatColor(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const alpha = 0.18 + 0.6 * clamped;
    const borderAlpha = 0.3 + 0.5 * clamped;
    return {
      bg: `rgba(255, 99, 71, ${alpha.toFixed(3)})`,
      border: `rgba(255, 99, 71, ${borderAlpha.toFixed(3)})`,
    };
  }

  // Initial paint
  updatePlayerSelect();
  if (store.activePlayerId) {
    setActivePlayer(store.activePlayerId);
  } else if (store.players.length > 0) {
    setActivePlayer(store.players[0].id);
  }
  updateIdleTimerLabel();
  configureAnswerInputForDevice();
})();
