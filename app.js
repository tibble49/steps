// ── Firebase ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBMxQerOpbyrIh-GfVnvifcj25sOIS4KBE",
  authDomain: "steps-10112.firebaseapp.com",
  projectId: "steps-10112",
  storageBucket: "steps-10112.firebasestorage.app",
  messagingSenderId: "827587203362",
  appId: "1:827587203362:web:dd1c3dae6255af18a5d57b"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const stateDoc = db.collection("challenge").doc("state");
// ─────────────────────────────────────────────────────────────────────────────

const CHALLENGE = {
  name: "May Step Challenge",
  start: "2026-05-01",
  end: "2026-05-31"
};

const TEAM_COLOR_PALETTE = [
  "#00897b",
  "#d35400",
  "#1e6de0",
  "#9b3fa8",
  "#b63a32",
  "#1f7a4f",
  "#cc8a00",
  "#4c5be0"
];

const defaultState = {
  participants: [],
  entries: [],
  participantColors: {}
};

const sampleParticipants = ["Lindsay", "Jordan", "Maya", "Noah"];
const sampleSteps = [
  ["Lindsay", 10222],
  ["Jordan", 12034],
  ["Maya", 8700],
  ["Noah", 13510]
];

const participantForm = document.querySelector("#participant-form");
const participantNameInput = document.querySelector("#participant-name");
const participantList = document.querySelector("#participant-list");
const entryForm = document.querySelector("#entry-form");
const entryParticipant = document.querySelector("#entry-participant");
const entryDate = document.querySelector("#entry-date");
const entrySteps = document.querySelector("#entry-steps");
const leaderboardBody = document.querySelector("#leaderboard-body");
const raceList = document.querySelector("#race-list");
const qrList = document.querySelector("#qr-list");
const historyList = document.querySelector("#history-list");
const challengeName = document.querySelector("#challenge-name");
const challengeRange = document.querySelector("#challenge-range");
const challengeStatus = document.querySelector("#challenge-status");
const seedButton = document.querySelector("#seed-button");
const resetButton = document.querySelector("#reset-button");
const chipTemplate = document.querySelector("#chip-template");

let state = structuredClone(defaultState);

async function startApp() {
  try {
    console.log("Loading state from Firestore...");
    const snap = await stateDoc.get();
    if (snap.exists) {
      console.log("State loaded from Firestore:", snap.data());
      state = parseState(snap.data());
    } else {
      console.log("No existing state in Firestore, starting with defaults");
    }
  } catch (err) {
    console.error("Failed to load from Firestore, falling back to empty state.", err);
    alert("⚠️ Database connection failed. Changes may not be saved. Check console for details.");
  }
  initialize();
  stateDoc.onSnapshot(
    (snap) => {
      console.log("Listener fired, snap.exists:", snap.exists);
      if (snap.exists) {
        console.log("Updating state from Firestore listener:", snap.data());
        state = parseState(snap.data());
        renderAll();
      }
    },
    (err) => {
      console.error("Firestore listener error:", err);
    }
  );
}

startApp();

function initialize() {
  renderChallengeMeta();
  entryDate.min = CHALLENGE.start;
  entryDate.max = CHALLENGE.end;
  entryDate.value = defaultEntryDate();
  preFillFromUrl();
  bindEvents();
  renderAll();
}

function bindEvents() {
  participantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = participantNameInput.value.trim();
    if (!name) return;

    if (state.participants.some((p) => p.toLowerCase() === name.toLowerCase())) {
      alert("That participant already exists.");
      return;
    }

    state.participants.push(name);
    state.participantColors[name] = pickColorForName(name, state.participants.length - 1);
    participantNameInput.value = "";
    persistAndRender();
  });

  entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const person = entryParticipant.value;
    const date = entryDate.value;
    const steps = Number(entrySteps.value);

    if (!person || !date || Number.isNaN(steps) || steps < 0) {
      return;
    }

    if (!isWithinChallenge(date)) {
      alert("Entries must be between May 1 and May 31, 2026.");
      return;
    }

    const existing = state.entries.find((entry) => entry.person === person && entry.date === date);
    if (existing) {
      existing.steps = steps;
    } else {
      state.entries.push({ person, date, steps });
    }

    entrySteps.value = "";
    persistAndRender();
  });

  participantList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("chip-remove")) return;

    const name = target.dataset.name;
    if (!name) return;

    state.participants = state.participants.filter((participant) => participant !== name);
    state.entries = state.entries.filter((entry) => entry.person !== name);
    delete state.participantColors[name];
    persistAndRender();
  });

  participantList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("chip-color")) return;

    const name = target.dataset.name;
    if (!name) return;

    state.participantColors[name] = target.value;
    persistAndRender();
  });

  seedButton.addEventListener("click", () => {
    if (state.participants.length > 0 || state.entries.length > 0) {
      const shouldReplace = confirm("This replaces your current data. Continue?");
      if (!shouldReplace) return;
    }

    const seededEntries = [];
    for (let offset = 0; offset < 5; offset += 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const iso = toISODate(date);

      for (const [person, baseline] of sampleSteps) {
        const variance = Math.floor(Math.random() * 2500 - 1200);
        seededEntries.push({ person, date: iso, steps: Math.max(4500, baseline + variance) });
      }
    }

    const participantColors = {};
    sampleParticipants.forEach((name, index) => {
      participantColors[name] = TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length];
    });

    state = {
      participants: [...sampleParticipants],
      entries: seededEntries,
      participantColors
    };

    persistAndRender();
  });

  resetButton.addEventListener("click", () => {
    const confirmed = confirm("Delete all participants and step entries?");
    if (!confirmed) return;
    state = structuredClone(defaultState);
    persistAndRender();
  });
}

function persistAndRender() {
  saveState(state).catch((err) => {
    alert("Error saving to database. Changes may not persist. Check browser console.");
    console.error("persistAndRender save error:", err);
  });
  renderAll();
}

function renderAll() {
  const leaderboardData = getLeaderboardData();
  renderParticipants();
  renderEntryParticipants();
  renderQrCodes();
  renderLeaderboard(leaderboardData);
  renderRaceView(leaderboardData);
  renderHistory();
}

function renderParticipants() {
  participantList.innerHTML = "";

  if (state.participants.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No participants yet.";
    empty.style.color = "#5c676a";
    participantList.append(empty);
    return;
  }

  for (const name of state.participants) {
    const clone = chipTemplate.content.firstElementChild.cloneNode(true);
    clone.querySelector(".chip-name").textContent = name;
    clone.style.setProperty("--lane-color", getParticipantColor(name));

    const colorInput = clone.querySelector(".chip-color");
    colorInput.value = getParticipantColor(name);
    colorInput.dataset.name = name;
    colorInput.setAttribute("aria-label", `Pick team color for ${name}`);

    const removeButton = clone.querySelector(".chip-remove");
    removeButton.dataset.name = name;
    removeButton.setAttribute("aria-label", `Remove ${name}`);
    participantList.append(clone);
  }
}

function renderEntryParticipants() {
  entryParticipant.innerHTML = "";

  if (state.participants.length === 0) {
    const option = new Option("Add participants first", "", true, true);
    entryParticipant.add(option);
    entryParticipant.disabled = true;
    return;
  }

  entryParticipant.disabled = false;
  for (const name of state.participants) {
    const option = new Option(name, name);
    entryParticipant.add(option);
  }
}

function renderLeaderboard(totals) {
  leaderboardBody.innerHTML = "";

  if (totals.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5">No data yet.</td>';
    leaderboardBody.append(row);
    return;
  }

  const leaderTotal = totals[0].total;

  totals.forEach((item, index) => {
    const behind = Math.max(0, leaderTotal - item.total);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.name}</td>
      <td>${formatNumber(item.total)}</td>
      <td>${formatNumber(item.average)}</td>
      <td>${behind === 0 ? "Leader" : `${formatNumber(behind)} behind`}</td>
    `;
    leaderboardBody.append(row);
  });
}

function renderRaceView(totals) {
  raceList.innerHTML = "";

  if (totals.length === 0) {
    const empty = document.createElement("li");
    empty.className = "race-empty";
    empty.textContent = "Add participants and entries to start the race view.";
    raceList.append(empty);
    return;
  }

  const leaderTotal = totals[0].total;

  totals.forEach((item, index) => {
    const lane = document.createElement("li");
    lane.className = "race-lane";
    lane.style.setProperty("--lane-color", getParticipantColor(item.name));

    const progress = leaderTotal > 0 ? Math.round((item.total / leaderTotal) * 100) : 0;
    lane.style.setProperty("--progress", String(progress));

    lane.innerHTML = `
      <div class="race-lane-top">
        <span class="race-rank">${getRaceBadge(index + 1)}</span>
        <span class="race-name">${item.name}</span>
        <span class="race-meta">${formatNumber(item.total)} steps total</span>
      </div>
      <div class="track" role="img" aria-label="${item.name} race position at ${progress}%">
        <div class="track-progress"></div>
        <span class="runner">${getRunnerIcon(item.name)}</span>
        <span class="finish-flag">&#9873;</span>
      </div>
    `;

    raceList.append(lane);
  });
}

function getLeaderboardData() {
  const totals = state.participants.map((name) => {
    const personEntries = state.entries.filter(
      (entry) => entry.person === name && isWithinChallenge(entry.date)
    );
    const total = personEntries.reduce((sum, entry) => sum + entry.steps, 0);
    const average = personEntries.length ? Math.round(total / personEntries.length) : 0;
    return { name, total, average };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals;
}

function getRaceBadge(rank) {
  const badges = {
    1: "#1",
    2: "#2",
    3: "#3"
  };
  return badges[rank] ?? `#${rank}`;
}

function getRunnerIcon(name) {
  const icons = ["&#127939;", "&#128694;", "&#128099;", "&#128692;", "&#128693;", "&#127946;"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return icons[Math.abs(hash) % icons.length];
}

function renderHistory() {
  historyList.innerHTML = "";

  const sorted = [...state.entries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12);

  if (sorted.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No entries yet. Add a step log to get started.";
    historyList.append(empty);
    return;
  }

  for (const entry of sorted) {
    const item = document.createElement("li");
    item.style.borderLeft = `4px solid ${getParticipantColor(entry.person)}`;
    const date = new Date(`${entry.date}T00:00:00`);
    const displayDate = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    item.innerHTML = `
      <span>${entry.person}</span>
      <span>${displayDate}</span>
      <strong>${formatNumber(entry.steps)} steps</strong>
    `;
    historyList.append(item);
  }
}

function saveState(nextState) {
  return stateDoc.set(nextState, { merge: true });
}

function parseState(data) {
  const participantColors =
    data.participantColors && typeof data.participantColors === "object"
      ? data.participantColors
      : {};
  return {
    participants: Array.isArray(data.participants)
      ? data.participants.filter((p) => typeof p === "string")
      : [],
    entries: Array.isArray(data.entries)
      ? data.entries.filter(isValidEntry)
      : [],
    participantColors
  };
}

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry.person === "string" &&
    typeof entry.date === "string" &&
    typeof entry.steps === "number"
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getParticipantColor(name) {
  return state.participantColors[name] || pickColorForName(name, state.participants.indexOf(name));
}

function pickColorForName(name, index) {
  if (!name) return TEAM_COLOR_PALETTE[0];
  if (index >= 0) return TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length];

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_COLOR_PALETTE[Math.abs(hash) % TEAM_COLOR_PALETTE.length];
}

function isWithinChallenge(isoDate) {
  return isoDate >= CHALLENGE.start && isoDate <= CHALLENGE.end;
}

function renderChallengeMeta() {
  challengeName.textContent = CHALLENGE.name;
  challengeRange.textContent = `Race window: ${formatChallengeDate(CHALLENGE.start)} to ${formatChallengeDate(CHALLENGE.end)}`;
  challengeStatus.textContent = challengeStatusText();
}

function challengeStatusText() {
  const todayIso = toISODate(new Date());
  if (todayIso < CHALLENGE.start) {
    const days = dateDiffInDays(todayIso, CHALLENGE.start);
    return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (todayIso > CHALLENGE.end) {
    return "May challenge complete. Ready for the next challenge window.";
  }
  const daysLeft = dateDiffInDays(todayIso, CHALLENGE.end) + 1;
  return `Live now: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

function defaultEntryDate() {
  const todayIso = toISODate(new Date());
  if (todayIso < CHALLENGE.start) return CHALLENGE.start;
  if (todayIso > CHALLENGE.end) return CHALLENGE.end;
  return todayIso;
}

function formatChallengeDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function dateDiffInDays(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

function renderQrCodes() {
  qrList.innerHTML = "";

  if (state.participants.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Add participants to generate QR codes.";
    qrList.append(empty);
    return;
  }

  for (const name of state.participants) {
    const card = document.createElement("li");
    card.className = "qr-card";

    const nameSpan = document.createElement("span");
    nameSpan.className = "qr-name";
    nameSpan.textContent = name;

    const qrContainer = document.createElement("div");
    qrContainer.id = `qr-${sanitizeId(name)}`;

    const link = getQrLink(name);
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "qr-copy-link";
    copyButton.title = "Copy link to clipboard";
    copyButton.textContent = "Copy Link";
    copyButton.onclick = () => copyToClipboard(link);

    card.append(qrContainer, nameSpan, copyButton);
    qrList.append(card);

    new QRCode(qrContainer, {
      text: link,
      width: 120,
      height: 120,
      colorDark: "#0f8f80",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

function getQrLink(name) {
  const base = window.location.protocol + "//" + window.location.host + window.location.pathname;
  return `${base}?person=${encodeURIComponent(name)}`;
}

function preFillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const person = params.get("person");

  if (person && state.participants.includes(person)) {
    entryParticipant.value = person;
    entryParticipant.focus();
    entrySteps.focus();
  }
}

function sanitizeId(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("Link copied!");
  });
}
