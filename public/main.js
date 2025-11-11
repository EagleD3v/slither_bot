const container = document.getElementById("stats-container");
const refreshBtn = document.getElementById("refresh-btn");
const regionBtn = document.getElementById("region-btn");
const regionMenu = document.getElementById("region-menu");
const sortBtn = document.getElementById("sort-btn");
const sortMenu = document.getElementById("sort-menu");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const statusSummaryEl = document.getElementById("status-summary");
const statusViewersEl = document.getElementById("status-viewers");
const statusRefreshEl = document.getElementById("status-refresh");
const minimapModal = document.getElementById("minimap-modal");
const minimapModalTitle = document.getElementById("minimap-modal-title");
const minimapModalImage = document.getElementById("minimap-modal-image");
const minimapModalClose = document.getElementById("minimap-modal-close");

const REGION_OPTIONS = [
  { id: "ALL", label: "ALL" },
  { id: "Europe", label: "Europe" },
  { id: "Asia", label: "Asia" },
  { id: "North America", label: "North America" },
  { id: "South America", label: "South America" },
  { id: "Oceania", label: "Oceania" },
  { id: "Africa", label: "Africa" }
];

const SORT_OPTIONS = [
  { id: "players", label: "Most players" },
  { id: "top1", label: "#1 score" },
  { id: "top10", label: "#10 score" },
  { id: "totalScore", label: "Total score" },
  { id: "region", label: "Region (A-Z)" }
];

const REFRESH_DEFAULT_SECONDS = 120;
const numberFormatter = new Intl.NumberFormat();

const state = {
  allServers: [],
  filtered: [],
  region: "ALL",
  sort: "players",
  searchTerm: "",
  refreshIntervalSeconds: REFRESH_DEFAULT_SECONDS,
  totalServers: 0,
  lastUpdated: null,
  liveViewers: 0
};

let countdownSeconds = REFRESH_DEFAULT_SECONDS;
let countdownTimer = null;
let viewerSource = null;
let minimapModalVisible = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTerm(text) {
  const safe = escapeHtml(text ?? "");
  if (!state.searchTerm) return safe;
  const pattern = new RegExp(`(${escapeRegExp(state.searchTerm)})`, "ig");
  return safe.replace(pattern, "<mark>$1</mark>");
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "?";
  return numberFormatter.format(value);
}

function formatUpdated(timestamp) {
  if (!timestamp) return "Unknown";
  const updated = new Date(timestamp).getTime();
  if (Number.isNaN(updated)) return "Unknown";
  const diffMs = Date.now() - updated;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function buildCard(server) {
  const ipValue = server.ip ?? "?";
  const needsBrackets = ipValue.includes(":") && !ipValue.startsWith("[");
  const sanitizedIp = needsBrackets ? `[${ipValue}]` : ipValue;
  const ipDisplay = server.port ? `${sanitizedIp}:${server.port}` : sanitizedIp;
  const badgeLabel = server.cluster != null ? `CL-${server.cluster}` : "LIVE";
  const locationLabel = `${server.continentName ?? "Unknown region"} - ${server.countryName ?? "Unknown"}`;
  const updatedFriendly = formatUpdated(server.timestamp);
  const updatedTime = server.timestamp
    ? new Date(server.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const updatedDisplay = `${updatedFriendly}${updatedTime ? ` (${updatedTime})` : ""}`;
  const totalSnakes = server.totalPlayers ?? 0;
  const totalScore = server.totalScore ?? 0;
  const hasMinimap = Boolean(server.minimap);

  const flag = server.countryCode
    ? `<img src="https://flagcdn.com/48x36/${server.countryCode.toLowerCase()}.png" alt="${escapeHtml(
        server.countryCode
      )} flag" />`
    : `<span class="flag-fallback">&#127760;</span>`;

  const searchMatches = state.searchTerm
    ? (server.leaderboard || []).filter((p) => (p.name ?? "").toLowerCase().includes(state.searchTerm.toLowerCase()))
        .length
    : 0;
  const matchBadge = state.searchTerm
    ? `<span class="search-match-count">${searchMatches} match${searchMatches === 1 ? "" : "es"}</span>`
    : "";

  const leaderboardRows =
    server.leaderboard && server.leaderboard.length
      ? server.leaderboard
          .slice(0, 10)
          .map((entry, index) => {
            const rank = Number.isFinite(entry.rank) ? entry.rank : index + 1;
            const rankClass = index === 0 ? " first" : index === 1 ? " second" : index === 2 ? " third" : "";
            return `
              <div class="lb-row${rankClass}">
                <span class="lb-rank">${rank}</span>
                <span class="lb-name">${highlightTerm(entry.name ?? "(unnamed)")}</span>
                <span class="lb-score">${formatNumber(entry.score)}</span>
              </div>
            `;
          })
          .join("")
      : `<div class="lb-empty">No leaderboard data</div>`;

  const minimapContent = hasMinimap
    ? `<img src="${server.minimap}" alt="Minimap for ${escapeHtml(ipValue)}" />`
    : "<p>No minimap data</p>";

  const minimapButton = `
    <button
      class="minimap-zoom"
      type="button"
      ${hasMinimap ? "" : "disabled"}
      data-ip="${escapeHtml(ipDisplay)}"
      data-minimap="${hasMinimap ? escapeHtml(server.minimap) : ""}"
      aria-label="View minimap for ${escapeHtml(ipDisplay)}"
    >
      &#128269;
    </button>
  `;

  return `
    <div class="server-card">
      <div class="card-header">
        <div class="card-ip">${escapeHtml(ipDisplay)}</div>
        <div class="card-badge">${escapeHtml(String(badgeLabel))}</div>
      </div>

      <div class="card-meta">
        <div class="flag-icon">${flag}</div>
        <div class="meta-text">
          <p class="meta-region">${escapeHtml(locationLabel)}</p>
          <p class="card-updated">Updated ${escapeHtml(updatedDisplay)}</p>
        </div>
      </div>

      <div class="leaderboard-compact">
        <div class="lb-row lb-head">
          <span>#</span>
          <span>Nickname ${matchBadge}</span>
          <span>Length</span>
        </div>
        <div class="lb-list">
          ${leaderboardRows}
        </div>
      </div>

      <div class="minimap-panel">
        <div class="minimap-wrapper">
          <div class="minimap-container">
            ${minimapContent}
          </div>
          ${minimapButton}
        </div>
        <div class="minimap-stats">
          <div>
            <span class="stat-label">Snakes</span>
            <span class="stat-value">${formatNumber(totalSnakes)}</span>
          </div>
          <div>
            <span class="stat-label">Total</span>
            <span class="stat-value">${formatNumber(totalScore)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStats(servers) {
  if (!Array.isArray(servers) || !servers.length) {
    container.innerHTML = `<p class="empty-message">No servers match the current filters. Try a different region or search.</p>`;
    return;
  }

  container.innerHTML = servers.map((server) => buildCard(server)).join("");
}

function getSortLabel() {
  return SORT_OPTIONS.find((option) => option.id === state.sort)?.label ?? "Players";
}

function getRegionLabel() {
  return REGION_OPTIONS.find((option) => option.id === state.region)?.label ?? "ALL";
}

function updateStatus() {
  const showingAll = state.region === "ALL" && state.filtered.length === state.totalServers && !state.searchTerm;
  const summary = showingAll
    ? `Showing all servers (${state.filtered.length}) sorted by ${getSortLabel()}.`
    : `Showing ${state.filtered.length} of ${state.totalServers} server${state.filtered.length === 1 ? '' : 's'} (Region: ${getRegionLabel()}) sorted by ${getSortLabel()}${
        state.searchTerm ? ` - search: "${escapeHtml(state.searchTerm)}"` : ''
      }.`;

  statusSummaryEl.innerHTML = summary;
  statusViewersEl.textContent = `Online viewers: ${formatNumber(state.liveViewers)}`;
  statusRefreshEl.textContent = `Refreshing in: ${Math.max(0, countdownSeconds)}s`;
}

function updateDropdownLabels() {
  regionBtn.textContent = state.region === "ALL" ? "Select Region" : `Region: ${getRegionLabel()}`;
  sortBtn.textContent = `Sort (${getSortLabel()})`;

  regionMenu.querySelectorAll("button[data-region]").forEach((button) => {
    button.classList.toggle("active", button.dataset.region === state.region);
  });

  sortMenu.querySelectorAll("button[data-sort]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === state.sort);
  });
}

function applyFilters() {
  let servers = state.allServers.slice();

  if (state.region !== "ALL") {
    servers = servers.filter((server) => (server.continentName ?? "Unknown region") === state.region);
  }

  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    servers = servers.filter((server) => (server.leaderboard || []).some((entry) => (entry.name ?? "").toLowerCase().includes(term)));
  }

  const sorters = {
    players: (a, b) => (b.totalPlayers ?? 0) - (a.totalPlayers ?? 0),
    totalScore: (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0),
    top1: (a, b) => (b.leaderboard?.[0]?.score ?? 0) - (a.leaderboard?.[0]?.score ?? 0),
    top10: (a, b) => (b.leaderboard?.[9]?.score ?? 0) - (a.leaderboard?.[9]?.score ?? 0),
    region: (a, b) => {
      const regionCompare = (a.continentName ?? "Unknown").localeCompare(b.continentName ?? "Unknown", undefined, { sensitivity: "base" });
      if (regionCompare !== 0) return regionCompare;
      return (a.countryName ?? "").localeCompare(b.countryName ?? "", undefined, { sensitivity: "base" });
    }
  };

  servers.sort(sorters[state.sort] ?? sorters.players);
  state.filtered = servers;
  renderStats(servers);
  updateStatus();
}

function closeDropdowns() {
  document.querySelectorAll(".dropdown").forEach((dropdown) => dropdown.classList.remove("open"));
}

function startCountdown(seconds) {
  countdownSeconds = Math.max(1, Math.round(seconds ?? REFRESH_DEFAULT_SECONDS));
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  updateStatus();

  countdownTimer = setInterval(() => {
    countdownSeconds -= 1;
    if (countdownSeconds <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      fetchStats(true);
      return;
    }
    updateStatus();
  }, 1000);
}

async function fetchStats(forceRefresh = false) {
  try {
    const url = `/stats${forceRefresh ? "?refresh=1" : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.servers)) {
      throw new Error("No server data yet. Try refreshing.");
    }

    state.allServers = data.servers.map((server) => ({
      ...server,
      leaderboard: Array.isArray(server.leaderboard) ? server.leaderboard : []
    }));
    state.totalServers = data.serverCount ?? state.allServers.length;
    state.refreshIntervalSeconds = data.refreshIntervalSeconds ?? REFRESH_DEFAULT_SECONDS;
    state.lastUpdated = data.updatedAt ?? new Date().toISOString();
    if (typeof data.onlineViewers === "number") {
      state.liveViewers = data.onlineViewers;
    }

    applyFilters();
    startCountdown(state.refreshIntervalSeconds);
  } catch (error) {
    container.innerHTML = `<p class="error">Error: ${escapeHtml(error.message || "Failed to load stats")}</p>`;
    statusSummaryEl.textContent = "Unable to load server stats.";
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    statusRefreshEl.textContent = "Refreshing halted";
  }
}

function initMenus() {
  regionMenu.innerHTML = REGION_OPTIONS.map((option) => `<li><button type="button" data-region="${option.id}">${option.label}</button></li>`).join("");
  sortMenu.innerHTML = SORT_OPTIONS.map((option) => `<li><button type="button" data-sort="${option.id}">${option.label}</button></li>`).join("");

  regionMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-region]");
    if (!button) return;
    state.region = button.dataset.region;
    closeDropdowns();
    updateDropdownLabels();
    applyFilters();
  });

  sortMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sort]");
    if (!button) return;
    state.sort = button.dataset.sort;
    closeDropdowns();
    updateDropdownLabels();
    applyFilters();
  });

  regionBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const dropdown = regionBtn.closest(".dropdown");
    dropdown.classList.toggle("open");
    sortBtn.closest(".dropdown").classList.remove("open");
  });

  sortBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const dropdown = sortBtn.closest(".dropdown");
    dropdown.classList.toggle("open");
    regionBtn.closest(".dropdown").classList.remove("open");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".dropdown")) {
      closeDropdowns();
    }
  });

  updateDropdownLabels();
}

function handleSearch() {
  state.searchTerm = searchInput.value.trim();
  applyFilters();
}

function initLiveViewerStream() {
  if (viewerSource) {
    viewerSource.close();
  }

  viewerSource = new EventSource("/live-viewers");
  viewerSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (typeof payload.viewerCount === "number") {
        state.liveViewers = payload.viewerCount;
        updateStatus();
      }
    } catch (err) {
      console.error("Failed to parse live viewer payload", err);
    }
  };

  viewerSource.onerror = () => {
    viewerSource?.close();
    viewerSource = null;
    setTimeout(initLiveViewerStream, 5000);
  };
}

function openMinimapModal(ip, src) {
  if (!src) return;
  minimapModalTitle.textContent = ip;
  minimapModalImage.src = src;
  minimapModalImage.alt = `Minimap for ${ip}`;
  minimapModal.classList.remove("hidden");
  minimapModalVisible = true;
}

function closeMinimapModal() {
  if (!minimapModalVisible) return;
  minimapModal.classList.add("hidden");
  minimapModalImage.src = "";
  minimapModalTitle.textContent = "";
  minimapModalVisible = false;
}

refreshBtn.addEventListener("click", () => fetchStats(true));
searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});

searchInput.addEventListener("input", () => {
  if (!searchInput.value.trim() && state.searchTerm) {
    state.searchTerm = "";
    applyFilters();
  }
});

container.addEventListener("click", (event) => {
  const zoomBtn = event.target.closest(".minimap-zoom");
  if (!zoomBtn || zoomBtn.disabled) return;
  const ip = zoomBtn.dataset.ip ?? "";
  const src = zoomBtn.dataset.minimap ?? "";
  if (src) {
    openMinimapModal(ip, src);
  }
});

minimapModalClose.addEventListener("click", closeMinimapModal);
minimapModal.addEventListener("click", (event) => {
  if (event.target === minimapModal) {
    closeMinimapModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDropdowns();
    closeMinimapModal();
  }
});

window.addEventListener("beforeunload", () => {
  viewerSource?.close();
});

initMenus();
initLiveViewerStream();
fetchStats(true);
