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
const auth = firebase.auth();
const db = firebase.firestore();
const stateDoc = db.collection("challenge").doc("state");
// ─────────────────────────────────────────────────────────────────────────────

const CHALLENGE = {
  key: "2026-06",
  name: "June Step Challenge",
  start: "2026-06-01",
  end: "2026-06-30"
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
  participantColors: {},
  participantLastMonthAverages: {},
  challengeKey: CHALLENGE.key
};

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
const calendarGrid = document.querySelector("#calendar-grid");
const calendarLegend = document.querySelector("#calendar-legend");
const challengeName = document.querySelector("#challenge-name");
const challengeRange = document.querySelector("#challenge-range");
const challengeStatus = document.querySelector("#challenge-status");
const heroShoutoutValue = document.querySelector("#hero-shoutout-value");
const chipTemplate = document.querySelector("#chip-template");
const urlPrefillPerson = getUrlPrefillPerson();

let state = structuredClone(defaultState);

async function startApp() {
  try {
    await ensureAnonymousSession();
  } catch (err) {
    console.error("Failed to establish anonymous auth session.", err);
    alert("⚠️ Secure session setup failed. Database access may not work until you refresh.");
  }

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

async function ensureAnonymousSession() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const result = await auth.signInAnonymously();
  console.log("Anonymous auth ready:", result.user?.uid || "unknown-user");
  return result.user;
}

function initialize() {
  const didResetForNewChallenge = resetForNewChallengeIfNeeded();

  if (didResetForNewChallenge) {
    saveState(state).catch((err) => {
      console.error("Failed to save fresh challenge reset:", err);
      alert("⚠️ Could not fully reset previous challenge data in the database.");
    });
  }

  renderChallengeMeta();
  entryDate.min = CHALLENGE.start;
  entryDate.max = CHALLENGE.end;
  entryDate.value = defaultEntryDate();
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
      alert(
        `Entries must be between ${formatChallengeDate(CHALLENGE.start)} and ${formatChallengeDate(
          CHALLENGE.end
        )}.`
      );
      return;
    }

    const existing = state.entries.find((entry) => entry.person === person && entry.date === date);
    if (existing) {
      alert(`${person} already has an entry for ${formatChallengeDate(date)}.`);
      return;
    }

    state.entries.push({ person, date, steps });

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
    delete state.participantLastMonthAverages[name];
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
  applyUrlPrefillParticipant();
  renderHeroShoutout();
  renderQrCodes();
  renderLeaderboard(leaderboardData);
  renderRaceView(leaderboardData);
  renderHistory();
  renderCalendar();
}

function renderHeroShoutout() {
  if (!heroShoutoutValue) return;

  const validEntries = state.entries.filter(
    (entry) => isWithinChallenge(entry.date) && Number.isFinite(entry.steps)
  );

  if (validEntries.length === 0) {
    heroShoutoutValue.textContent = "Waiting for first entry...";
    return;
  }

  const topSteps = Math.max(...validEntries.map((entry) => entry.steps));
  const topEntries = validEntries.filter((entry) => entry.steps === topSteps);
  const uniqueNames = [...new Set(topEntries.map((entry) => entry.person))].sort((a, b) =>
    a.localeCompare(b)
  );

  if (uniqueNames.length === 1) {
    const topEntry = topEntries
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    heroShoutoutValue.textContent = `${uniqueNames[0]} with ${formatNumber(topSteps)} on ${formatChallengeDate(topEntry.date)}`;
    return;
  }

  heroShoutoutValue.textContent = `${uniqueNames.join(", ")} tied at ${formatNumber(topSteps)} steps`;
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
    row.innerHTML = '<td colspan="8">No data yet.</td>';
    leaderboardBody.append(row);
    return;
  }

  const leaderTotal = totals[0].total;

  totals.forEach((item, index) => {
    const behindLeader = Math.max(0, leaderTotal - item.total);
    const prevTotal = index > 0 ? totals[index - 1].total : null;
    const behindNext = prevTotal !== null ? Math.max(0, prevTotal - item.total) : 0;
    const dailyAverageTrendClass = getDailyAverageTrendClass(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.name}</td>
      <td>${formatNumber(item.total)}</td>
      <td>${formatNumber(item.highestSingleDay)}</td>
      <td class="${dailyAverageTrendClass}">${formatNumber(item.average)}</td>
      <td>${formatAverageValue(item.lastMonthAverage)}</td>
      <td>${index === 0 ? "—" : `${formatNumber(behindNext)} behind`}</td>
      <td>${behindLeader === 0 ? "Leader" : `${formatNumber(behindLeader)} behind`}</td>
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
  const previousChallengeWindow = getPreviousChallengeWindow();
  const totals = state.participants.map((name) => {
    const personEntries = state.entries.filter(
      (entry) => entry.person === name && isWithinChallenge(entry.date)
    );
    const previousMonthEntries = state.entries.filter(
      (entry) =>
        entry.person === name &&
        entry.date >= previousChallengeWindow.start &&
        entry.date <= previousChallengeWindow.end
    );
    const total = personEntries.reduce((sum, entry) => sum + entry.steps, 0);
    const highestSingleDay = personEntries.length
      ? Math.max(...personEntries.map((entry) => entry.steps))
      : 0;
    const average = personEntries.length ? Math.round(total / personEntries.length) : 0;
    const previousMonthTotal = previousMonthEntries.reduce((sum, entry) => sum + entry.steps, 0);
    const lastMonthAverage = previousMonthEntries.length
      ? Math.round(previousMonthTotal / previousMonthEntries.length)
      : null;
    const manualLastMonthAverage = state.participantLastMonthAverages[name];

    return {
      name,
      total,
      highestSingleDay,
      average,
      entryCount: personEntries.length,
      lastMonthAverage: Number.isFinite(manualLastMonthAverage)
        ? manualLastMonthAverage
        : lastMonthAverage
    };
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

function getDailyAverageTrendClass(item) {
  if (item.entryCount === 0 || item.lastMonthAverage === null) {
    return "";
  }

  return item.average >= item.lastMonthAverage ? "daily-avg-up" : "daily-avg-down";
}

function renderHistory() {
  historyList.innerHTML = "";

  const sorted = [...state.entries]
    .filter((entry) => isWithinChallenge(entry.date))
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

function renderCalendar() {
  if (!calendarGrid || !calendarLegend) return;

  calendarGrid.innerHTML = "";
  calendarLegend.innerHTML = "";

  const dates = getChallengeDates();
  const firstDate = new Date(`${CHALLENGE.start}T00:00:00`);
  const leadingBlanks = firstDate.getDay();

  for (let i = 0; i < leadingBlanks; i += 1) {
    const blank = document.createElement("li");
    blank.className = "calendar-day calendar-day-blank";
    blank.setAttribute("aria-hidden", "true");
    calendarGrid.append(blank);
  }

  if (state.participants.length === 0) {
    const empty = document.createElement("li");
    empty.className = "calendar-empty";
    empty.textContent = "Add participants to track daily completion.";
    calendarGrid.append(empty);
    return;
  }

  for (const name of state.participants) {
    const legendItem = document.createElement("li");
    legendItem.className = "calendar-legend-item";
    legendItem.innerHTML = `
      <span class="calendar-legend-swatch" style="--dot-color:${getParticipantColor(name)}"></span>
      <span>${name}</span>
    `;
    calendarLegend.append(legendItem);
  }

  const entryLookup = getEntryLookupByDay();
  const todayIso = toISODate(new Date());

  for (const isoDate of dates) {
    const dayDate = new Date(`${isoDate}T00:00:00`);
    const dayNumber = dayDate.getDate();
    const day = document.createElement("li");
    day.className = "calendar-day";
    if (isoDate === todayIso) {
      day.classList.add("is-today");
    }

    const dayLabel = document.createElement("span");
    dayLabel.className = "calendar-day-number";
    dayLabel.textContent = String(dayNumber);

    const dots = document.createElement("div");
    dots.className = "calendar-dots";

    for (const name of state.participants) {
      const hasEntry = entryLookup.get(isoDate)?.has(name.toLowerCase()) || false;
      const dot = document.createElement("span");
      dot.className = "calendar-dot";
      if (!hasEntry) {
        dot.classList.add("is-missing");
      }
      dot.style.setProperty("--dot-color", getParticipantColor(name));
      dot.title = `${name}: ${hasEntry ? "Logged" : "Missing"}`;
      dots.append(dot);
    }

    day.append(dayLabel, dots);
    calendarGrid.append(day);
  }
}

function getEntryLookupByDay() {
  const lookup = new Map();

  for (const entry of state.entries) {
    if (!isWithinChallenge(entry.date)) continue;

    if (!lookup.has(entry.date)) {
      lookup.set(entry.date, new Set());
    }

    lookup.get(entry.date).add(entry.person.toLowerCase());
  }

  return lookup;
}

function getChallengeDates() {
  const start = new Date(`${CHALLENGE.start}T00:00:00`);
  const end = new Date(`${CHALLENGE.end}T00:00:00`);
  const dates = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(toISODate(cursor));
  }

  return dates;
}

function saveState(nextState) {
  return stateDoc.set(nextState, { merge: true });
}

function parseState(data) {
  const participantColors =
    data.participantColors && typeof data.participantColors === "object"
      ? data.participantColors
      : {};
  const participantLastMonthAverages =
    data.participantLastMonthAverages && typeof data.participantLastMonthAverages === "object"
      ? data.participantLastMonthAverages
      : {};

  const normalizedEntries = Array.isArray(data.entries)
    ? data.entries.map(normalizeEntry).filter(Boolean)
    : [];

  return {
    participants: Array.isArray(data.participants)
      ? data.participants.filter((p) => typeof p === "string")
      : [],
    entries: normalizedEntries,
    participantColors,
    participantLastMonthAverages: normalizeParticipantAverages(participantLastMonthAverages),
    challengeKey: typeof data.challengeKey === "string" ? data.challengeKey : ""
  };
}

function resetForNewChallengeIfNeeded() {
  if (state.challengeKey === CHALLENGE.key) {
    return false;
  }

  state.challengeKey = CHALLENGE.key;
  return true;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry.person !== "string") {
    return null;
  }

  const date = normalizeIsoDate(entry.date);
  const steps = Number(entry.steps);

  if (!date || !Number.isFinite(steps) || steps < 0) {
    return null;
  }

  return {
    person: entry.person,
    date,
    steps
  };
}

function normalizeIsoDate(value) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return toISODate(parsed);
    }
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISODate(value);
  }

  if (value && typeof value.toDate === "function") {
    const date = value.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return toISODate(date);
    }
  }

  return null;
}

function normalizeParticipantAverages(values) {
  const normalized = {};

  for (const [name, rawValue] of Object.entries(values)) {
    const value = Number(rawValue);
    if (typeof name === "string" && Number.isFinite(value) && value >= 0) {
      normalized[name] = Math.round(value);
    }
  }

  return normalized;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function formatAverageValue(value) {
  return value === null ? "—" : formatNumber(value);
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

function getPreviousChallengeWindow() {
  const currentStart = new Date(`${CHALLENGE.start}T00:00:00`);
  const previousMonthStart = new Date(currentStart);
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
  previousMonthStart.setDate(1);

  const previousMonthEnd = new Date(currentStart);
  previousMonthEnd.setDate(0);

  return {
    start: toISODate(previousMonthStart),
    end: toISODate(previousMonthEnd)
  };
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
    return `${CHALLENGE.name} complete. Ready for the next challenge window.`;
  }
  const daysLeft = dateDiffInDays(todayIso, CHALLENGE.end) + 1;
  return `Live now: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

function defaultEntryDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = toISODate(yesterday);

  if (yesterdayIso < CHALLENGE.start) return CHALLENGE.start;
  if (yesterdayIso > CHALLENGE.end) return CHALLENGE.end;
  return yesterdayIso;
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

function getUrlPrefillPerson() {
  const params = new URLSearchParams(window.location.search);
  const person = params.get("person");
  return person ? person.trim() : "";
}

function applyUrlPrefillParticipant() {
  if (!urlPrefillPerson) return;

  const matchedParticipant = state.participants.find(
    (name) => name.toLowerCase() === urlPrefillPerson.toLowerCase()
  );

  if (!matchedParticipant) return;

  entryParticipant.value = matchedParticipant;
  entryParticipant.focus();
  entrySteps.focus();
}

function sanitizeId(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("Link copied!");
  });
}
