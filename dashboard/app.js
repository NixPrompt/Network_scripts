const SAMPLE_PATH = "../examples/sample-output.json";

const state = {
  payload: null,
  targetFilter: "all",
  statusFilter: "all",
  search: "",
};

const els = {
  schemaValue: document.querySelector("#schemaValue"),
  runnerValue: document.querySelector("#runnerValue"),
  durationValue: document.querySelector("#durationValue"),
  okCount: document.querySelector("#okCount"),
  warnCount: document.querySelector("#warnCount"),
  failCount: document.querySelector("#failCount"),
  runWindow: document.querySelector("#runWindow"),
  targetGrid: document.querySelector("#targetGrid"),
  resultsBody: document.querySelector("#resultsBody"),
  fileInput: document.querySelector("#fileInput"),
  sampleButton: document.querySelector("#sampleButton"),
  pasteButton: document.querySelector("#pasteButton"),
  jsonPaste: document.querySelector("#jsonPaste"),
  ingestMessage: document.querySelector("#ingestMessage"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
};

function normalizeSummary(summary = {}) {
  return {
    OK: Number(summary.OK || 0),
    WARN: Number(summary.WARN || 0),
    FAIL: Number(summary.FAIL || 0),
  };
}

function statusRank(status) {
  return { FAIL: 3, WARN: 2, OK: 1 }[status] || 0;
}

function worstStatus(results) {
  return results.reduce((worst, result) => {
    return statusRank(result.status) > statusRank(worst) ? result.status : worst;
  }, "OK");
}

function countStatuses(results) {
  return results.reduce(
    (counts, result) => {
      counts[result.status] = (counts[result.status] || 0) + 1;
      return counts;
    },
    { OK: 0, WARN: 0, FAIL: 0 },
  );
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatDetails(details = {}) {
  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null);
  if (!entries.length) return "";
  return entries
    .map(([key, value]) => {
      const rendered = Array.isArray(value) ? value.join(", ") : String(value);
      return `${key}=${rendered}`;
    })
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Expected a JSON object.");
  }
  if (!Array.isArray(payload.results)) {
    throw new Error("Expected FoxOps JSON with a results array.");
  }
  return payload;
}

function setPayload(payload, message) {
  state.payload = validatePayload(payload);
  state.statusFilter = "all";
  state.search = "";
  els.statusFilter.value = "all";
  els.searchInput.value = "";
  els.ingestMessage.textContent = message || "Run loaded.";
  render();
}

function targetEntries(payload) {
  const groups = payload.groups || {};
  const hosts = Object.entries(groups.hosts || {}).map(([name, results]) => ({
    type: "hosts",
    label: "Host",
    name,
    results,
  }));
  const urls = Object.entries(groups.urls || {}).map(([name, results]) => ({
    type: "urls",
    label: "URL",
    name,
    results,
  }));

  return [...hosts, ...urls].filter((entry) => {
    return state.targetFilter === "all" || entry.type === state.targetFilter;
  });
}

function filteredResults(payload) {
  const search = state.search.trim().toLowerCase();
  return payload.results.filter((result) => {
    const statusMatches = state.statusFilter === "all" || result.status === state.statusFilter;
    const haystack = [
      result.status,
      result.check_id,
      result.name,
      result.target,
      result.message,
      formatDetails(result.details),
    ]
      .join(" ")
      .toLowerCase();
    return statusMatches && (!search || haystack.includes(search));
  });
}

function renderOverview(payload) {
  const metadata = payload.metadata || {};
  const summary = normalizeSummary(payload.summary || countStatuses(payload.results));
  const total = Math.max(summary.OK + summary.WARN + summary.FAIL, 1);

  els.schemaValue.textContent = metadata.output_schema || "Unknown";
  els.runnerValue.textContent = metadata.runner || metadata.source || "Unknown";
  els.durationValue.textContent = `${Number(metadata.duration_ms || 0).toLocaleString()} ms`;
  els.okCount.textContent = summary.OK;
  els.warnCount.textContent = summary.WARN;
  els.failCount.textContent = summary.FAIL;
  els.runWindow.textContent = `${formatDateTime(metadata.started_at)} to ${formatDateTime(metadata.completed_at)}`;

  document.documentElement.style.setProperty("--ok-width", `${Math.max(summary.OK, 0.01)}fr`);
  document.documentElement.style.setProperty("--warn-width", `${Math.max(summary.WARN, 0.01)}fr`);
  document.documentElement.style.setProperty("--fail-width", `${Math.max(summary.FAIL, 0.01)}fr`);
  document.querySelector(".meter").setAttribute(
    "aria-label",
    `${Math.round((summary.OK / total) * 100)} percent OK, ${summary.WARN} warnings, ${summary.FAIL} failures`,
  );
}

function renderTargets(payload) {
  const entries = targetEntries(payload);
  if (!entries.length) {
    els.targetGrid.innerHTML = '<div class="empty-state">No targets found for this filter.</div>';
    return;
  }

  els.targetGrid.innerHTML = entries
    .map((entry) => {
      const counts = countStatuses(entry.results);
      const status = worstStatus(entry.results);
      return `
        <article class="target-card">
          <div class="target-top">
            <div>
              <span class="badge">${entry.label}</span>
              <div class="target-name">${escapeHtml(entry.name)}</div>
            </div>
            <span class="status-pill ${status}">${status}</span>
          </div>
          <div class="target-counts">
            <span><strong>${counts.OK}</strong>OK</span>
            <span><strong>${counts.WARN}</strong>WARN</span>
            <span><strong>${counts.FAIL}</strong>FAIL</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResults(payload) {
  const rows = filteredResults(payload);
  if (!rows.length) {
    els.resultsBody.innerHTML = '<tr><td colspan="5" class="empty-state">No checks match the current filters.</td></tr>';
    return;
  }

  els.resultsBody.innerHTML = rows
    .map((result) => {
      return `
        <tr>
          <td><span class="status-pill ${escapeHtml(result.status)}">${escapeHtml(result.status)}</span></td>
          <td>${escapeHtml(result.check_id || result.name || "unknown")}</td>
          <td>${escapeHtml(result.target || "local")}</td>
          <td>${escapeHtml(result.message || "")}</td>
          <td class="details">${escapeHtml(formatDetails(result.details))}</td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  if (!state.payload) return;
  renderOverview(state.payload);
  renderTargets(state.payload);
  renderResults(state.payload);
}

async function loadSample() {
  try {
    const response = await fetch(SAMPLE_PATH);
    if (!response.ok) throw new Error(`Sample request failed with ${response.status}.`);
    const payload = await response.json();
    setPayload(payload, "Sample run loaded.");
  } catch (error) {
    els.ingestMessage.textContent = `Could not load sample: ${error.message}`;
  }
}

els.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    setPayload(JSON.parse(text), `Loaded ${file.name}.`);
  } catch (error) {
    els.ingestMessage.textContent = `Could not load file: ${error.message}`;
  } finally {
    event.target.value = "";
  }
});

els.sampleButton.addEventListener("click", loadSample);

els.pasteButton.addEventListener("click", () => {
  try {
    setPayload(JSON.parse(els.jsonPaste.value), "Pasted run loaded.");
  } catch (error) {
    els.ingestMessage.textContent = `Could not parse pasted JSON: ${error.message}`;
  }
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderResults(state.payload);
});

els.statusFilter.addEventListener("change", (event) => {
  state.statusFilter = event.target.value;
  renderResults(state.payload);
});

document.querySelectorAll("[data-target-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.targetFilter = button.dataset.targetFilter;
    document.querySelectorAll("[data-target-filter]").forEach((candidate) => {
      candidate.classList.toggle("active", candidate === button);
    });
    renderTargets(state.payload);
  });
});

loadSample();
