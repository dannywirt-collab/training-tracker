const STORAGE_KEY = "training_tracker_entries_v2";
const LEGACY_STORAGE_KEY = "training_tracker_entries_v1";
const CUSTOM_METRIC_KEY = "training_tracker_custom_metrics_v1";

const BASE_METRICS = [
  { key: "bodyWeight", label: "Body Weight (lb)", color: "#22577a", decimals: 1, unit: "lb" },
  { key: "sleepHours", label: "Sleep (hours)", color: "#2b9348", decimals: 1, unit: "hr" },
  { key: "restingHr", label: "Resting HR (bpm)", color: "#bc4749", decimals: 0, unit: "bpm" },
  { key: "readiness", label: "Readiness", color: "#5a189a", decimals: 1, unit: "" },
  { key: "trainingLoad", label: "Training Load", color: "#ca6702", decimals: 0, unit: "" },
  { key: "soreness", label: "Soreness", color: "#9d0208", decimals: 1, unit: "" },
  { key: "mood", label: "Mood", color: "#386641", decimals: 1, unit: "" }
];

const CHART_COLORS = ["#0b6e4f", "#9a031e", "#3a0ca3", "#0077b6", "#fb8500", "#2d6a4f", "#ae2012"];

const form = document.getElementById("entry-form");
const entriesBody = document.getElementById("entries-body");
const editIdInput = document.getElementById("edit-id");
const submitBtn = document.getElementById("submit-btn");
const resetBtn = document.getElementById("reset-btn");
const statsNode = document.getElementById("stats");
const chartGrid = document.getElementById("chart-grid");
const chartTemplate = document.getElementById("chart-template");
const bestPrBody = document.getElementById("best-pr-body");

const customMetricInputs = document.getElementById("custom-metric-inputs");
const customMetricTags = document.getElementById("custom-metric-tags");
const metricForm = document.getElementById("metric-form");
const dashboardRange = document.getElementById("dashboard-range");
const dashboardStats = document.getElementById("dashboard-stats");

const exerciseList = document.getElementById("exercise-list");
const prList = document.getElementById("pr-list");
const addExerciseBtn = document.getElementById("add-exercise");
const addPrBtn = document.getElementById("add-pr");

const importCsvInput = document.getElementById("import-csv");
const importFitInput = document.getElementById("import-fit");
const exportCsvBtn = document.getElementById("export-csv");
const clearAllBtn = document.getElementById("clear-all");

const fieldIds = ["date", "trainingType", "bodyWeight", "sleepHours", "restingHr", "readiness", "trainingLoad", "soreness", "mood", "notes"];

let entries = loadEntries();
let customMetrics = loadCustomMetrics();

initialize();

function initialize() {
  document.getElementById("date").valueAsDate = new Date();

  form.addEventListener("submit", onSaveEntry);
  resetBtn.addEventListener("click", resetForm);
  metricForm.addEventListener("submit", onCreateCustomMetric);

  exportCsvBtn.addEventListener("click", exportCsv);
  importCsvInput.addEventListener("change", importCsv);
  importFitInput.addEventListener("change", importFitFiles);
  clearAllBtn.addEventListener("click", clearAll);

  addExerciseBtn.addEventListener("click", () => addExerciseRow());
  addPrBtn.addEventListener("click", () => addPrRow());
  dashboardRange.addEventListener("change", renderDashboard);

  renderCustomMetricDefinitionTags();
  renderCustomMetricInputs();
  ensureListRowMinimums();
  render();
}

function onSaveEntry(event) {
  event.preventDefault();
  const exercises = collectExercises();
  const prs = collectPrs();

  const entry = {
    id: editIdInput.value || crypto.randomUUID(),
    date: value("date"),
    trainingType: normalizeTrainingType(value("trainingType")) || inferTrainingTypeFromExercises(exercises),
    bodyWeight: numberValue("bodyWeight"),
    sleepHours: numberValue("sleepHours"),
    restingHr: numberValue("restingHr"),
    readiness: numberValue("readiness"),
    trainingLoad: numberValue("trainingLoad"),
    soreness: numberValue("soreness"),
    mood: numberValue("mood"),
    custom: collectCustomValues(),
    exercises,
    prs,
    notes: value("notes").trim()
  };

  const existingIndex = entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  persistEntries();
  resetForm();
  render();
}

function onCreateCustomMetric(event) {
  event.preventDefault();

  const name = document.getElementById("metric-name").value.trim();
  const unit = document.getElementById("metric-unit").value.trim();
  const decimals = clampNumber(Number(document.getElementById("metric-decimals").value), 0, 3, 1);

  if (!name) {
    return;
  }

  customMetrics.push({
    id: slugify(name) + "-" + crypto.randomUUID().slice(0, 6),
    label: name,
    unit,
    decimals
  });

  persistCustomMetrics();
  metricForm.reset();
  document.getElementById("metric-decimals").value = "1";

  renderCustomMetricDefinitionTags();
  renderCustomMetricInputs();
  render();
}

function render() {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  renderTable(sorted);
  renderStats(sorted);
  renderCharts(sorted);
  renderDashboard();
  renderBestPrs(sorted);
}

function renderCustomMetricInputs() {
  customMetricInputs.innerHTML = "";

  if (!customMetrics.length) {
    customMetricInputs.innerHTML = '<p class="muted-small">No custom metrics yet.</p>';
    return;
  }

  customMetrics.forEach((metric) => {
    const label = document.createElement("label");
    label.innerHTML = `
      ${escapeHtml(metric.label)}${metric.unit ? ` (${escapeHtml(metric.unit)})` : ""}
      <input type="number" data-custom-id="${metric.id}" step="any" placeholder="0" />
    `;
    customMetricInputs.appendChild(label);
  });
}

function renderCustomMetricDefinitionTags() {
  customMetricTags.innerHTML = "";

  if (!customMetrics.length) {
    customMetricTags.innerHTML = '<p class="muted-small">Add custom metrics like HRV, steps, calories, or stress score.</p>';
    return;
  }

  customMetrics.forEach((metric) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <span>${escapeHtml(metric.label)}${metric.unit ? ` (${escapeHtml(metric.unit)})` : ""} · ${metric.decimals}dp</span>
      <button type="button" class="chip-remove" data-remove-metric="${metric.id}">x</button>
    `;
    customMetricTags.appendChild(chip);
  });

  customMetricTags.querySelectorAll("[data-remove-metric]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeCustomMetric(btn.dataset.removeMetric);
    });
  });
}

function removeCustomMetric(metricId) {
  customMetrics = customMetrics.filter((metric) => metric.id !== metricId);

  entries = entries.map((entry) => {
    const nextCustom = { ...(entry.custom || {}) };
    delete nextCustom[metricId];
    return { ...entry, custom: nextCustom };
  });

  persistCustomMetrics();
  persistEntries();

  renderCustomMetricDefinitionTags();
  renderCustomMetricInputs();
  render();
}

function ensureListRowMinimums() {
  if (!exerciseList.children.length) addExerciseRow();
  if (!prList.children.length) addPrRow();
}

function addExerciseRow(data = {}) {
  const row = document.createElement("div");
  row.className = "list-row";
  row.innerHTML = `
    <input type="text" data-field="exerciseName" placeholder="Exercise" value="${escapeHtmlAttr(data.exerciseName || "")}" />
    <input type="number" data-field="sets" min="0" step="1" placeholder="Sets" value="${data.sets ?? ""}" />
    <input type="number" data-field="reps" min="0" step="1" placeholder="Reps" value="${data.reps ?? ""}" />
    <input type="number" data-field="weight" min="0" step="0.1" placeholder="Weight" value="${data.weight ?? ""}" />
    <input type="number" data-field="rpe" min="0" max="10" step="0.5" placeholder="RPE" value="${data.rpe ?? ""}" />
    <button type="button" class="danger small-btn" data-remove-row>Remove</button>
  `;
  exerciseList.appendChild(row);

  row.querySelector("[data-remove-row]").addEventListener("click", () => {
    row.remove();
    ensureListRowMinimums();
  });
}

function addPrRow(data = {}) {
  const row = document.createElement("div");
  row.className = "list-row pr-row";
  row.innerHTML = `
    <input type="text" data-field="exercise" placeholder="Exercise" value="${escapeHtmlAttr(data.exercise || "")}" />
    <input type="number" data-field="value" min="0" step="0.1" placeholder="PR value" value="${data.value ?? ""}" />
    <input type="text" data-field="unit" placeholder="lb, kg, reps, sec" value="${escapeHtmlAttr(data.unit || "")}" />
    <input type="text" data-field="notes" placeholder="Context" value="${escapeHtmlAttr(data.notes || "")}" />
    <button type="button" class="danger small-btn" data-remove-row>Remove</button>
  `;
  prList.appendChild(row);

  row.querySelector("[data-remove-row]").addEventListener("click", () => {
    row.remove();
    ensureListRowMinimums();
  });
}

function collectCustomValues() {
  const out = {};
  customMetricInputs.querySelectorAll("input[data-custom-id]").forEach((input) => {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) {
      out[input.dataset.customId] = parsed;
    }
  });
  return out;
}

function collectExercises() {
  return [...exerciseList.querySelectorAll(".list-row")]
    .map((row) => ({
      exerciseName: row.querySelector('[data-field="exerciseName"]')?.value.trim() || "",
      sets: numericOrNull(row.querySelector('[data-field="sets"]')?.value),
      reps: numericOrNull(row.querySelector('[data-field="reps"]')?.value),
      weight: numericOrNull(row.querySelector('[data-field="weight"]')?.value),
      rpe: numericOrNull(row.querySelector('[data-field="rpe"]')?.value)
    }))
    .filter((item) => item.exerciseName || item.sets || item.reps || item.weight || item.rpe);
}

function collectPrs() {
  return [...prList.querySelectorAll(".pr-row")]
    .map((row) => ({
      exercise: row.querySelector('[data-field="exercise"]')?.value.trim() || "",
      value: numericOrNull(row.querySelector('[data-field="value"]')?.value),
      unit: row.querySelector('[data-field="unit"]')?.value.trim() || "",
      notes: row.querySelector('[data-field="notes"]')?.value.trim() || ""
    }))
    .filter((item) => item.exercise && item.value);
}

function renderTable(sortedEntries) {
  entriesBody.innerHTML = "";

  if (!sortedEntries.length) {
    entriesBody.innerHTML = '<tr><td colspan="12">No entries yet.</td></tr>';
    return;
  }

  const rows = [...sortedEntries].reverse();

  rows.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${trainingTypeBadgeHtml(entry.trainingType, entry.notes, entry.exercises)}</td>
      <td>${formatMetric(getMetric("bodyWeight"), entry.bodyWeight)}</td>
      <td>${formatMetric(getMetric("sleepHours"), entry.sleepHours)}</td>
      <td>${formatMetric(getMetric("restingHr"), entry.restingHr)}</td>
      <td>${formatMetric(getMetric("readiness"), entry.readiness)}</td>
      <td>${formatMetric(getMetric("trainingLoad"), entry.trainingLoad)}</td>
      <td>${escapeHtml(customSummary(entry.custom))}</td>
      <td>${entry.exercises?.length || 0}</td>
      <td>${entry.prs?.length || 0}</td>
      <td>${escapeHtml(entry.notes || "")}</td>
      <td class="actions">
        <button class="secondary" data-edit="${entry.id}">Edit</button>
        <button class="danger" data-delete="${entry.id}">Delete</button>
      </td>
    `;
    entriesBody.appendChild(tr);
  });

  entriesBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => loadIntoForm(btn.dataset.edit));
  });

  entriesBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.delete));
  });
}

function renderStats(sortedEntries) {
  statsNode.innerHTML = "";
  const lastSeven = sortedEntries.slice(-7);

  if (!lastSeven.length) {
    statsNode.innerHTML = '<p class="muted-small">No stats yet.</p>';
    return;
  }

  BASE_METRICS.forEach((metric) => {
    const avg = average(lastSeven.map((entry) => Number(entry[metric.key])));
    appendStat(statsNode, metric.label, `${avg.toFixed(metric.decimals)}${metric.unit ? ` ${metric.unit}` : ""}`);
  });

  customMetrics.forEach((metric) => {
    const values = lastSeven
      .map((entry) => Number(entry.custom?.[metric.id]))
      .filter((value) => Number.isFinite(value));

    if (values.length) {
      appendStat(statsNode, `${metric.label} (avg)`, `${average(values).toFixed(metric.decimals)}${metric.unit ? ` ${metric.unit}` : ""}`);
    }
  });
}

function renderDashboard() {
  dashboardStats.innerHTML = "";
  const range = Number(dashboardRange.value);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  if (!sorted.length) {
    dashboardStats.innerHTML = '<p class="muted-small">No entries yet.</p>';
    return;
  }

  const currentWindow = sorted.slice(-range);
  const previousWindow = sorted.slice(-(range * 2), -range);

  const current = summarizeWindow(currentWindow);
  const previous = previousWindow.length ? summarizeWindow(previousWindow) : null;

  appendDashboardStat("Entries", current.count, deltaText(current.count, previous?.count));
  appendDashboardStat("Avg Weight", formatDeltaMetric(current.avgWeight, previous?.avgWeight, 1, "lb"));
  appendDashboardStat("Avg Sleep", formatDeltaMetric(current.avgSleep, previous?.avgSleep, 1, "hr"));
  appendDashboardStat("Avg Readiness", formatDeltaMetric(current.avgReadiness, previous?.avgReadiness, 1, ""));
  appendDashboardStat("Total Training Load", formatDeltaMetric(current.totalLoad, previous?.totalLoad, 0, ""));
  appendDashboardStat("Total Volume", formatDeltaMetric(current.totalVolume, previous?.totalVolume, 0, "lb"));
  appendDashboardStat("PR Hits", deltaText(current.prCount, previous?.prCount));
  appendDashboardStat("Sessions Logged", deltaText(current.sessionCount, previous?.sessionCount));
}

function summarizeWindow(windowEntries) {
  const avgWeight = average(windowEntries.map((entry) => Number(entry.bodyWeight)));
  const avgSleep = average(windowEntries.map((entry) => Number(entry.sleepHours)));
  const avgReadiness = average(windowEntries.map((entry) => Number(entry.readiness)));
  const totalLoad = sum(windowEntries.map((entry) => Number(entry.trainingLoad)));
  const sessionCount = windowEntries.filter((entry) => (entry.exercises?.length || 0) > 0).length;
  const prCount = sum(windowEntries.map((entry) => entry.prs?.length || 0));

  const totalVolume = sum(
    windowEntries.flatMap((entry) =>
      (entry.exercises || []).map((ex) => (Number(ex.sets) || 0) * (Number(ex.reps) || 0) * (Number(ex.weight) || 0))
    )
  );

  return { count: windowEntries.length, avgWeight, avgSleep, avgReadiness, totalLoad, totalVolume, prCount, sessionCount };
}

function appendDashboardStat(label, value, delta = "") {
  const block = document.createElement("article");
  block.className = "stat";
  block.innerHTML = `
    <span>${label}</span>
    <strong>${value}</strong>
    <small class="muted-small">${delta || "No prior period"}</small>
  `;
  dashboardStats.appendChild(block);
}

function formatDeltaMetric(current, previous, decimals, unit) {
  const value = Number.isFinite(current) ? current.toFixed(decimals) : "0";
  const suffix = unit ? ` ${unit}` : "";
  const delta = Number.isFinite(previous) ? deltaText(current, previous, decimals) : "No prior period";
  return `${value}${suffix} (${delta})`;
}

function deltaText(current, previous, decimals = 0) {
  if (!Number.isFinite(previous)) return "No prior period";
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(decimals)} vs prev`;
}

function renderCharts(sortedEntries) {
  chartGrid.innerHTML = "";

  if (sortedEntries.length < 2) {
    chartGrid.innerHTML = '<p class="muted-small">Add at least 2 entries to see trend lines.</p>';
    return;
  }

  const chartMetrics = [
    ...BASE_METRICS,
    ...customMetrics.map((metric, index) => ({
      key: `custom.${metric.id}`,
      label: `${metric.label}${metric.unit ? ` (${metric.unit})` : ""}`,
      decimals: metric.decimals,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }))
  ];

  chartMetrics.forEach((metric) => {
    const values = sortedEntries.map((entry) => getEntryMetricValue(entry, metric.key)).filter((value) => Number.isFinite(value));
    if (values.length < 2) return;

    const node = chartTemplate.content.cloneNode(true);
    const title = node.querySelector("h3");
    const canvas = node.querySelector("canvas");
    title.textContent = metric.label;

    drawLineChart(canvas, sortedEntries, metric);
    chartGrid.appendChild(node);
  });

  if (!chartGrid.children.length) {
    chartGrid.innerHTML = '<p class="muted-small">No chartable data yet.</p>';
  }
}

function drawLineChart(canvas, sortedEntries, metric) {
  const points = sortedEntries
    .map((entry) => ({ date: entry.date, value: getEntryMetricValue(entry, metric.key) }))
    .filter((point) => Number.isFinite(point.value));

  if (points.length < 2) return;

  const values = points.map((point) => point.value);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 16, right: 16, bottom: 34, left: 42 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#d5d9df";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#5b6470";
  ctx.font = "11px sans-serif";
  ctx.fillText(min.toFixed(metric.decimals ?? 1), 6, h - pad.bottom + 4);
  ctx.fillText(max.toFixed(metric.decimals ?? 1), 6, pad.top + 4);

  const xStep = (w - pad.left - pad.right) / (points.length - 1);

  ctx.strokeStyle = metric.color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  points.forEach((point, index) => {
    const x = pad.left + index * xStep;
    const normalized = (point.value - min) / spread;
    const y = h - pad.bottom - normalized * (h - pad.top - pad.bottom);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = metric.color;
  points.forEach((point, index) => {
    const x = pad.left + index * xStep;
    const normalized = (point.value - min) / spread;
    const y = h - pad.bottom - normalized * (h - pad.top - pad.bottom);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const firstLabel = points[0].date;
  const lastLabel = points[points.length - 1].date;
  ctx.fillStyle = "#5b6470";
  ctx.fillText(shortDate(firstLabel), pad.left, h - 12);

  const lastWidth = ctx.measureText(shortDate(lastLabel)).width;
  ctx.fillText(shortDate(lastLabel), w - pad.right - lastWidth, h - 12);
}

function renderBestPrs(sortedEntries) {
  bestPrBody.innerHTML = "";

  const bestByExercise = new Map();
  sortedEntries.forEach((entry) => {
    (entry.prs || []).forEach((pr) => {
      const name = (pr.exercise || "").trim();
      const value = Number(pr.value);
      if (!name || !Number.isFinite(value)) return;

      const existing = bestByExercise.get(name.toLowerCase());
      if (!existing || value > existing.value) {
        bestByExercise.set(name.toLowerCase(), {
          exercise: name,
          value,
          unit: pr.unit || "",
          notes: pr.notes || "",
          date: entry.date
        });
      }
    });
  });

  const best = [...bestByExercise.values()].sort((a, b) => b.value - a.value);

  if (!best.length) {
    bestPrBody.innerHTML = '<tr><td colspan="4">No PR records yet.</td></tr>';
    return;
  }

  best.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.exercise)}</td>
      <td>${item.value}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</td>
      <td>${item.date}</td>
      <td>${escapeHtml(item.notes)}</td>
    `;
    bestPrBody.appendChild(tr);
  });
}

function loadIntoForm(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  fieldIds.forEach((fieldId) => {
    document.getElementById(fieldId).value = entry[fieldId] ?? "";
  });

  customMetricInputs.querySelectorAll("input[data-custom-id]").forEach((input) => {
    input.value = entry.custom?.[input.dataset.customId] ?? "";
  });

  exerciseList.innerHTML = "";
  (entry.exercises || []).forEach((exercise) => addExerciseRow(exercise));

  prList.innerHTML = "";
  (entry.prs || []).forEach((pr) => addPrRow(pr));

  ensureListRowMinimums();

  editIdInput.value = entry.id;
  submitBtn.textContent = "Update Entry";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  document.getElementById("date").valueAsDate = new Date();
  editIdInput.value = "";
  submitBtn.textContent = "Save Entry";

  customMetricInputs.querySelectorAll("input[data-custom-id]").forEach((input) => {
    input.value = "";
  });

  exerciseList.innerHTML = "";
  prList.innerHTML = "";
  ensureListRowMinimums();
}

function deleteEntry(id) {
  entries = entries.filter((entry) => entry.id !== id);
  persistEntries();
  render();
}

function clearAll() {
  if (!confirm("Delete all entries? This cannot be undone.")) return;

  entries = [];
  persistEntries();
  resetForm();
  render();
}

function exportCsv() {
  if (!entries.length) {
    alert("No entries to export.");
    return;
  }

  const header = [
    "id",
    "date",
    "trainingType",
    "bodyWeight",
    "sleepHours",
    "restingHr",
    "readiness",
    "trainingLoad",
    "soreness",
    "mood",
    "notes",
    "sourceFitKey",
    "sourceCsvKey",
    "customMetricDefsJson",
    "customValuesJson",
    "exercisesJson",
    "prsJson"
  ];

  const rows = entries.map((entry) =>
    header
      .map((field) => {
        if (field === "customMetricDefsJson") return csvEscape(JSON.stringify(customMetrics));
        if (field === "customValuesJson") return csvEscape(JSON.stringify(entry.custom || {}));
        if (field === "exercisesJson") return csvEscape(JSON.stringify(entry.exercises || []));
        if (field === "prsJson") return csvEscape(JSON.stringify(entry.prs || []));
        return csvEscape(String(entry[field] ?? ""));
      })
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `training-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const imported = parseCsv(text, file.name);
      entries = mergeImportedEntries(entries, imported);
      persistEntries();
      render();
      alert(`Imported ${imported.length} entries.`);
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }

    importCsvInput.value = "";
  };

  reader.readAsText(file);
}

async function importFitFiles(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;

  let importedCount = 0;
  let skippedCount = 0;
  let parseFailures = 0;

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const summary = parseFitFile(arrayBuffer);
      const fitEntry = buildEntryFromFitSummary(summary, file.name);
      const existingIndex = entries.findIndex((entry) => entry.sourceFitKey === fitEntry.sourceFitKey);

      if (existingIndex >= 0) {
        entries[existingIndex] = fitEntry;
      } else {
        entries.push(fitEntry);
      }

      importedCount += 1;
    } catch {
      parseFailures += 1;
    }
  }

  entries = entries.filter((entry) => {
    if (!entry.sourceFitKey) return true;
    if (!entry.date) {
      skippedCount += 1;
      return false;
    }
    return true;
  });

  persistCustomMetrics();
  persistEntries();
  renderCustomMetricDefinitionTags();
  renderCustomMetricInputs();
  render();

  importFitInput.value = "";
  alert(`FIT import complete. Imported: ${importedCount}. Skipped: ${skippedCount}. Failed: ${parseFailures}.`);
}

function buildEntryFromFitSummary(summary, fileName) {
  const date = summary.startDate ? toIsoDateLocal(summary.startDate) : toIsoDateLocal(new Date());
  const durationMin = summary.durationSec / 60;
  const distanceKm = summary.distanceM / 1000;
  const trainingLoadFromFit = Math.max(1, Math.round(durationMin * ((summary.avgHr || 120) / 100)));

  const custom = {};
  setFitCustomMetric(custom, "FIT Duration", "min", 1, durationMin);
  setFitCustomMetric(custom, "FIT Distance", "km", 2, distanceKm);
  if (Number.isFinite(summary.calories) && summary.calories > 0) {
    setFitCustomMetric(custom, "FIT Calories", "kcal", 0, summary.calories);
  }
  if (Number.isFinite(summary.avgHr) && summary.avgHr > 0) {
    setFitCustomMetric(custom, "FIT Avg HR", "bpm", 0, summary.avgHr);
  }
  if (Number.isFinite(summary.avgPower) && summary.avgPower > 0) {
    setFitCustomMetric(custom, "FIT Avg Power", "W", 0, summary.avgPower);
  }
  if (Number.isFinite(summary.avgCadence) && summary.avgCadence > 0) {
    setFitCustomMetric(custom, "FIT Avg Cadence", "rpm", 0, summary.avgCadence);
  }

  const sportLabel = summary.sportLabel || "Imported FIT Session";

  return {
    id: crypto.randomUUID(),
    sourceFitKey: `fit:${fileName}:${date}:${Math.round(summary.durationSec)}`,
    date,
    trainingType: inferTrainingTypeFromText(sportLabel),
    bodyWeight: 0,
    sleepHours: 0,
    restingHr: summary.avgHr > 0 ? Math.max(20, Math.round(summary.avgHr * 0.6)) : 60,
    readiness: 5,
    trainingLoad: trainingLoadFromFit,
    soreness: 5,
    mood: 5,
    custom,
    exercises: [
      {
        exerciseName: sportLabel,
        sets: 1,
        reps: Math.max(1, Math.round(durationMin)),
        weight: null,
        rpe: summary.avgHr ? clampNumber(Math.round((summary.avgHr / 20) * 2) / 2, 1, 10, null) : null
      }
    ],
    prs: [],
    notes: buildFitNotes(summary, fileName)
  };
}

function setFitCustomMetric(target, label, unit, decimals, value) {
  if (!Number.isFinite(value)) return;
  const metricId = ensureCustomMetric(label, unit, decimals);
  target[metricId] = Number(value.toFixed(decimals));
}

function ensureCustomMetric(label, unit, decimals) {
  const existing = customMetrics.find((metric) => metric.label.toLowerCase() === label.toLowerCase());
  if (existing) return existing.id;

  const created = {
    id: `${slugify(label)}-${crypto.randomUUID().slice(0, 6)}`,
    label,
    unit,
    decimals
  };
  customMetrics.push(created);
  return created.id;
}

function buildFitNotes(summary, fileName) {
  const parts = [`Imported from ${fileName}`];
  if (summary.sportLabel) parts.push(`Sport: ${summary.sportLabel}`);
  if (summary.distanceM > 0) parts.push(`Distance: ${(summary.distanceM / 1000).toFixed(2)} km`);
  if (summary.durationSec > 0) parts.push(`Duration: ${(summary.durationSec / 60).toFixed(1)} min`);
  if (summary.calories > 0) parts.push(`Calories: ${Math.round(summary.calories)}`);
  return parts.join(" | ");
}

function parseFitFile(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  if (dv.byteLength < 12) {
    throw new Error("FIT file too small.");
  }

  const headerSize = dv.getUint8(0);
  const dataSize = dv.getUint32(4, true);
  const dataType = readAscii(dv, 8, 4);
  if (dataType !== ".FIT") {
    throw new Error("Invalid FIT signature.");
  }

  let offset = headerSize;
  const end = Math.min(dv.byteLength, headerSize + dataSize);
  const definitions = new Map();
  let lastTimestamp = null;

  const sessions = [];
  const records = [];

  while (offset < end) {
    const header = dv.getUint8(offset);
    offset += 1;

    const isCompressedTimestamp = (header & 0x80) !== 0;
    let isDefinition = false;
    let hasDeveloperFields = false;
    let localMesgNum = 0;
    let timestampOffset = 0;

    if (isCompressedTimestamp) {
      localMesgNum = (header >> 5) & 0x03;
      timestampOffset = header & 0x1f;
    } else {
      isDefinition = (header & 0x40) !== 0;
      hasDeveloperFields = (header & 0x20) !== 0;
      localMesgNum = header & 0x0f;
    }

    if (isDefinition) {
      if (offset + 5 > end) break;
      offset += 1;
      const architecture = dv.getUint8(offset);
      offset += 1;
      const littleEndian = architecture === 0;
      const globalMesgNum = dv.getUint16(offset, littleEndian);
      offset += 2;
      const fieldCount = dv.getUint8(offset);
      offset += 1;

      const fields = [];
      for (let i = 0; i < fieldCount; i += 1) {
        const defNum = dv.getUint8(offset);
        const size = dv.getUint8(offset + 1);
        const baseType = dv.getUint8(offset + 2);
        offset += 3;
        fields.push({ defNum, size, baseType });
      }

      if (hasDeveloperFields) {
        const developerFieldCount = dv.getUint8(offset);
        offset += 1;
        offset += developerFieldCount * 3;
      }

      definitions.set(localMesgNum, { littleEndian, globalMesgNum, fields });
      continue;
    }

    const definition = definitions.get(localMesgNum);
    if (!definition) {
      break;
    }

    const message = {};
    for (const field of definition.fields) {
      message[field.defNum] = readFitFieldValue(dv, offset, field.size, field.baseType, definition.littleEndian);
      offset += field.size;
    }

    if (isCompressedTimestamp) {
      const base = Number.isFinite(lastTimestamp) ? lastTimestamp : 0;
      const baseSeconds = base & ~0x1f;
      let candidate = baseSeconds + timestampOffset;
      if (Number.isFinite(lastTimestamp) && candidate < lastTimestamp) candidate += 32;
      message[253] = candidate;
      lastTimestamp = candidate;
    } else if (Number.isFinite(message[253])) {
      lastTimestamp = message[253];
    }

    if (definition.globalMesgNum === 18) {
      sessions.push(message);
    } else if (definition.globalMesgNum === 20) {
      records.push(message);
    }
  }

  return summarizeFitMessages(sessions, records);
}

function summarizeFitMessages(sessions, records) {
  const session = sessions[sessions.length - 1] || {};

  const startDate = fitDateToJsDate(session[2]) || fitDateToJsDate(records[0]?.[253]) || null;
  const durationSec = normalizeTimerSeconds(session[0]) || inferDurationFromRecords(records);
  const distanceM = Number.isFinite(session[9]) ? session[9] / 100 : inferDistanceFromRecords(records);
  const calories = Number.isFinite(session[11]) ? session[11] : null;
  const avgHr = Number.isFinite(session[16]) ? session[16] : average(records.map((record) => record[3]));
  const avgPower = Number.isFinite(session[20]) ? session[20] : average(records.map((record) => record[7]));
  const avgCadence = Number.isFinite(session[18]) ? session[18] : average(records.map((record) => record[4]));
  const sportLabel = decodeSport(session[5], session[6]);

  return {
    startDate,
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    distanceM: Number.isFinite(distanceM) ? distanceM : 0,
    calories: Number.isFinite(calories) ? calories : 0,
    avgHr: Number.isFinite(avgHr) ? avgHr : 0,
    avgPower: Number.isFinite(avgPower) ? avgPower : 0,
    avgCadence: Number.isFinite(avgCadence) ? avgCadence : 0,
    sportLabel
  };
}

function readFitFieldValue(dv, offset, size, baseType, littleEndian) {
  const type = baseType & 0x1f;
  if (type === 7) {
    return readAscii(dv, offset, size).replace(/\0/g, "").trim();
  }

  if (type === 8 && size === 4) return dv.getFloat32(offset, littleEndian);
  if (type === 9 && size === 8) return dv.getFloat64(offset, littleEndian);

  if (type === 1 && size === 1) return sanitizeFitValue(dv.getInt8(offset), type);
  if ((type === 0 || type === 2 || type === 10) && size === 1) return sanitizeFitValue(dv.getUint8(offset), type);
  if ((type === 3 || type === 11) && size === 2) return sanitizeFitValue(dv.getInt16(offset, littleEndian), type);
  if ((type === 4 || type === 13) && size === 2) return sanitizeFitValue(dv.getUint16(offset, littleEndian), type);
  if (type === 5 && size === 4) return sanitizeFitValue(dv.getInt32(offset, littleEndian), type);
  if ((type === 6 || type === 14) && size === 4) return sanitizeFitValue(dv.getUint32(offset, littleEndian), type);

  if (size === 1) return dv.getUint8(offset);
  if (size === 2) return dv.getUint16(offset, littleEndian);
  if (size === 4) return dv.getUint32(offset, littleEndian);
  return null;
}

function sanitizeFitValue(value, type) {
  if (!Number.isFinite(value)) return null;
  if ((type === 0 || type === 2) && value === 0xff) return null;
  if (type === 1 && value === 0x7f) return null;
  if (type === 4 && value === 0xffff) return null;
  if (type === 3 && value === 0x7fff) return null;
  if (type === 6 && value === 0xffffffff) return null;
  if (type === 5 && value === 0x7fffffff) return null;
  return value;
}

function decodeSport(sportValue, subSportValue) {
  const sportMap = {
    0: "Generic",
    1: "Running",
    2: "Cycling",
    3: "Transition",
    4: "Fitness Equipment",
    5: "Swimming",
    6: "Basketball",
    7: "Soccer",
    8: "Tennis",
    9: "American Football",
    10: "Training",
    11: "Walking",
    12: "Cross-Country Skiing",
    13: "Alpine Skiing",
    14: "Snowboarding",
    15: "Rowing",
    16: "Mountaineering",
    17: "Hiking",
    18: "Multisport",
    19: "Paddling",
    20: "Flying",
    21: "E-Biking",
    22: "Motorcycling",
    23: "Boating",
    24: "Driving",
    25: "Golf",
    26: "Hang Gliding",
    27: "Horseback Riding",
    28: "Hunting",
    29: "Fishing",
    30: "Inline Skating",
    31: "Rock Climbing",
    32: "Sailing",
    33: "Ice Skating",
    34: "Sky Diving",
    35: "Snowshoeing",
    36: "Snowmobiling",
    37: "Stand-Up Paddleboarding",
    38: "Surfing",
    39: "Wakeboarding",
    40: "Water Skiing",
    41: "Kayaking",
    42: "Rafting",
    43: "Windsurfing",
    44: "Kitesurfing",
    45: "Tactical",
    46: "Jumpmaster",
    47: "Boxing",
    48: "Floor Climbing",
    53: "Strength Training"
  };

  const subSportMap = {
    6: "Road",
    7: "Mountain",
    12: "Track",
    18: "Indoor Cycling",
    25: "Trail Running",
    44: "Indoor Running",
    53: "HIIT",
    54: "Yoga"
  };

  if (Number.isFinite(subSportValue) && subSportMap[subSportValue]) return subSportMap[subSportValue];
  if (Number.isFinite(sportValue) && sportMap[sportValue]) return sportMap[sportValue];
  return "Imported FIT Session";
}

function normalizeTimerSeconds(rawValue) {
  if (!Number.isFinite(rawValue)) return null;
  if (rawValue > 100000) return rawValue / 1000;
  return rawValue;
}

function inferDurationFromRecords(records) {
  const start = records.find((record) => Number.isFinite(record[253]))?.[253];
  const end = [...records].reverse().find((record) => Number.isFinite(record[253]))?.[253];
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

function inferDistanceFromRecords(records) {
  const endDistance = [...records].reverse().find((record) => Number.isFinite(record[5]))?.[5];
  if (!Number.isFinite(endDistance)) return 0;
  return endDistance / 100;
}

function fitDateToJsDate(fitTimestamp) {
  if (!Number.isFinite(fitTimestamp)) return null;
  const fitEpochOffsetSeconds = 631065600;
  return new Date((fitTimestamp + fitEpochOffsetSeconds) * 1000);
}

function toIsoDateLocal(date) {
  const local = new Date(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readAscii(dv, offset, length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(dv.getUint8(offset + i));
  }
  return out;
}

function normalizeImportedEntry(entry) {
  const normalizedExercises = Array.isArray(entry.exercises) ? entry.exercises : [];
  const inferred = normalizeTrainingType(entry.trainingType) || inferTrainingTypeFromExercises(normalizedExercises) || inferTrainingTypeFromText(entry.notes || "");
  return {
    ...entry,
    trainingType: inferred || "other",
    custom: entry.custom || {},
    exercises: normalizedExercises,
    prs: Array.isArray(entry.prs) ? entry.prs : []
  };
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function firstHeaderIndex(indexMap, names) {
  for (const name of names) {
    const idx = indexMap[normalizeHeader(name)];
    if (idx != null) return idx;
  }
  return null;
}

function fromFirstColumn(row, indexMap, names) {
  const idx = firstHeaderIndex(indexMap, names);
  if (idx == null) return "";
  return row[idx] || "";
}

function parseAnyDate(value) {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const d = new Date(cleaned);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cleaned)) {
    const parts = cleaned.split(/[\/\s]/);
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    let year = Number(parts[2]);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDistanceKm(raw) {
  if (!raw) return null;
  const text = String(raw).trim().toLowerCase();
  if (!text) return null;
  const numeric = Number(text.replace(/[^0-9.]+/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (text.includes("km")) return numeric;
  if (text.includes("mi")) return numeric * 1.60934;
  if (text.includes("m") && !text.includes("mi")) return numeric / 1000;
  if (numeric > 1000) return numeric / 1000;
  return numeric;
}

function parseDistanceKmFromRow(row, indexMap) {
  const distanceM = fromFirstColumn(row, indexMap, ["distancem", "distance_m"]);
  const meters = Number(String(distanceM || "").replace(/[^0-9.]+/g, ""));
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;
  const distanceMi = fromFirstColumn(row, indexMap, ["distancemi", "distance_mi", "miles"]);
  const miles = Number(String(distanceMi || "").replace(/[^0-9.]+/g, ""));
  if (Number.isFinite(miles) && miles > 0) return miles * 1.60934;
  return parseDistanceKm(fromFirstColumn(row, indexMap, ["distancekm", "distance_km", "distance", "distancemi", "distance_mi"]));
}

function parseDurationMinutes(raw) {
  if (!raw) return null;
  const text = String(raw).trim().toLowerCase();
  if (!text) return null;

  if (/^\d+:\d{2}(:\d{2})?$/.test(text)) {
    const parts = text.split(":").map(Number);
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  }

  const numeric = Number(text.replace(/[^0-9.]+/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (text.includes("hour") || text.includes("hr") || text.includes("h")) return numeric * 60;
  if (text.includes("sec") || text.includes(" s")) return numeric / 60;
  return numeric;
}

function normalizeTrainingType(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "swim" || value === "strength" || value === "run" || value === "cycle" || value === "other") return value;
  return inferTrainingTypeFromText(value);
}

function inferTrainingTypeFromExercises(exercises = []) {
  const text = exercises.map((item) => item.exerciseName || "").join(" ");
  return inferTrainingTypeFromText(text);
}

function inferTrainingTypeFromText(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return "";
  if (/swim|pool|freestyle|breaststroke|backstroke|butterfly/.test(value)) return "swim";
  if (/run|jog|treadmill|track|trail run/.test(value)) return "run";
  if (/cycle|bike|ride|spin|peloton|cycling|mtb/.test(value)) return "cycle";
  if (/strength|lift|deadlift|bench|squat|press|hypertrophy|resistance/.test(value)) return "strength";
  return "other";
}

function readableTrainingType(type) {
  const map = { swim: "Swim", strength: "Strength", run: "Run", cycle: "Cycle", other: "Other" };
  return map[type] || "Other";
}

function trainingTypeBadgeHtml(trainingType, notes, exercises) {
  const resolved = normalizeTrainingType(trainingType) || inferTrainingTypeFromExercises(exercises) || inferTrainingTypeFromText(notes || "") || "other";
  const imgPath = `assets/type-${resolved}.svg`;
  return `<span class="type-badge"><img src="${imgPath}" alt="${resolved}" /><span>${readableTrainingType(resolved)}</span></span>`;
}

function parseCsv(csvText, fileName = "import.csv") {
  const rows = splitCsvRows(csvText.trim());
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));
  const rawHeaders = rows[0];
  const hasNativeShape = ["id", "date", "bodyweight", "sleephours", "restinghr", "readiness", "trainingload", "soreness", "mood", "notes"].every(
    (col) => headers.includes(col)
  );

  if (hasNativeShape) {
    return parseNativeTrackerCsv(rows, headers);
  }
  return parseActivityCsv(rows, headers, rawHeaders, fileName);
}

function parseNativeTrackerCsv(rows, headers) {
  const indexMap = Object.fromEntries(headers.map((name, index) => [name, index]));
  let customIdMap = {};
  const importedMetricDefs = parseJsonSafe(rows[1]?.[indexMap.custommetricdefsjson], []);
  if (Array.isArray(importedMetricDefs) && importedMetricDefs.length) {
    customIdMap = mergeImportedCustomMetrics(importedMetricDefs);
  }

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => ({
      id: row[indexMap.id] || crypto.randomUUID(),
      date: row[indexMap.date] || "",
      trainingType: normalizeTrainingType(row[indexMap.trainingtype]) || "",
      bodyWeight: Number(row[indexMap.bodyweight]),
      sleepHours: Number(row[indexMap.sleephours]),
      restingHr: Number(row[indexMap.restinghr]),
      readiness: Number(row[indexMap.readiness]),
      trainingLoad: Number(row[indexMap.trainingload]),
      soreness: Number(row[indexMap.soreness]),
      mood: Number(row[indexMap.mood]),
      notes: row[indexMap.notes] || "",
      sourceFitKey: row[indexMap.sourcefitkey] || "",
      sourceCsvKey: row[indexMap.sourcecsvkey] || "",
      custom: remapCustomValues(parseJsonSafe(row[indexMap.customvaluesjson], {}), customIdMap),
      exercises: parseJsonSafe(row[indexMap.exercisesjson], []),
      prs: parseJsonSafe(row[indexMap.prsjson], [])
    }))
    .filter((entry) => entry.date)
    .map((entry) => normalizeImportedEntry(entry));
}

function parseActivityCsv(rows, headers, rawHeaders, fileName) {
  const indexMap = Object.fromEntries(headers.map((name, index) => [name, index]));
  const dateIndex = firstHeaderIndex(indexMap, ["date", "startdate", "activitydate", "timestamp", "starttime", "time"]);
  if (dateIndex == null) {
    throw new Error(`Could not find a date column. Found: ${rawHeaders.join(", ")}`);
  }

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row, rowIndex) => parseActivityRow(row, indexMap, dateIndex, fileName, rowIndex))
    .filter(Boolean);
}

function parseActivityRow(row, indexMap, dateIndex, fileName, rowIndex) {
  const parsedDate = parseAnyDate(row[dateIndex]);
  if (!parsedDate) return null;
  const date = toIsoDateLocal(parsedDate);

  const typeRaw = fromFirstColumn(row, indexMap, ["type", "sport", "activitytype", "activity"]);
  const trainingType = normalizeTrainingType(typeRaw) || inferTrainingTypeFromText(typeRaw || "");
  const distanceKm = parseDistanceKmFromRow(row, indexMap);
  const durationMin = parseDurationMinutes(fromFirstColumn(row, indexMap, ["durationmin", "duration", "movingtime", "elapsedtime"]));
  const calories = numericOrNull(fromFirstColumn(row, indexMap, ["calories", "kcal"]));
  const avgHr = numericOrNull(fromFirstColumn(row, indexMap, ["avghr", "averageheartrate", "hravg"]));
  const avgPower = numericOrNull(fromFirstColumn(row, indexMap, ["avgpower", "averagepower", "poweravg"]));
  const avgCadence = numericOrNull(fromFirstColumn(row, indexMap, ["avgcadence", "cadenceavg", "averagecadence"]));
  const load = numericOrNull(fromFirstColumn(row, indexMap, ["trainingload", "load"]));
  const notes = fromFirstColumn(row, indexMap, ["notes", "comment", "description", "title"]) || "";

  const custom = {};
  if (Number.isFinite(durationMin)) setFitCustomMetric(custom, "CSV Duration", "min", 1, durationMin);
  if (Number.isFinite(distanceKm)) setFitCustomMetric(custom, "CSV Distance", "km", 2, distanceKm);
  if (Number.isFinite(calories)) setFitCustomMetric(custom, "CSV Calories", "kcal", 0, calories);
  if (Number.isFinite(avgHr)) setFitCustomMetric(custom, "CSV Avg HR", "bpm", 0, avgHr);
  if (Number.isFinite(avgPower)) setFitCustomMetric(custom, "CSV Avg Power", "W", 0, avgPower);
  if (Number.isFinite(avgCadence)) setFitCustomMetric(custom, "CSV Avg Cadence", "rpm", 0, avgCadence);

  const sportLabel = readableTrainingType(trainingType || "other");
  const resolvedLoad = Number.isFinite(load)
    ? load
    : Math.max(1, Math.round((durationMin || 30) * (((avgHr || 120) * 0.01) || 1)));

  const entry = {
    id: crypto.randomUUID(),
    sourceCsvKey: `csv:${fileName}:${rowIndex}:${date}:${Math.round(durationMin || 0)}`,
    date,
    trainingType: trainingType || inferTrainingTypeFromText(notes),
    bodyWeight: 0,
    sleepHours: 0,
    restingHr: Number.isFinite(avgHr) ? Math.max(20, Math.round(avgHr * 0.6)) : 60,
    readiness: 5,
    trainingLoad: resolvedLoad,
    soreness: 5,
    mood: 5,
    custom,
    exercises: [
      {
        exerciseName: sportLabel,
        sets: 1,
        reps: Math.max(1, Math.round(durationMin || 30)),
        weight: null,
        rpe: Number.isFinite(avgHr) ? clampNumber(Math.round((avgHr / 20) * 2) / 2, 1, 10, null) : null
      }
    ],
    prs: [],
    notes: notes || `Imported from CSV (${fileName})`
  };

  return normalizeImportedEntry(entry);
}

function splitCsvRows(text) {
  const rows = [];
  let currentCell = "";
  let currentRow = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);
  return rows;
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacy) return [];
      const legacyParsed = JSON.parse(legacy);
      if (!Array.isArray(legacyParsed)) return [];
      const migrated = legacyParsed.map((entry) => ({
        ...entry,
        trainingType: normalizeTrainingType(entry.trainingType) || inferTrainingTypeFromText(entry.notes || ""),
        custom: {},
        exercises: [],
        prs: []
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((entry) => normalizeImportedEntry(entry))
      : [];
  } catch {
    return [];
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadCustomMetrics() {
  try {
    const raw = localStorage.getItem(CUSTOM_METRIC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistCustomMetrics() {
  localStorage.setItem(CUSTOM_METRIC_KEY, JSON.stringify(customMetrics));
}

function mergeImportedCustomMetrics(imported) {
  const byName = new Map(customMetrics.map((metric) => [metric.label.toLowerCase(), metric]));
  const idMap = {};
  let changed = false;

  imported.forEach((candidate) => {
    if (!candidate || !candidate.label) return;
    const label = String(candidate.label).trim();
    if (!label) return;
    const existing = byName.get(label.toLowerCase());
    if (existing) {
      if (candidate.id) idMap[candidate.id] = existing.id;
      return;
    }

    const newMetric = {
      id: candidate.id || `${slugify(label)}-${crypto.randomUUID().slice(0, 6)}`,
      label,
      unit: String(candidate.unit || ""),
      decimals: clampNumber(Number(candidate.decimals), 0, 3, 1)
    };

    customMetrics.push(newMetric);
    byName.set(label.toLowerCase(), newMetric);
    if (candidate.id) idMap[candidate.id] = newMetric.id;
    changed = true;
  });

  if (changed) {
    persistCustomMetrics();
    renderCustomMetricDefinitionTags();
    renderCustomMetricInputs();
  }

  return idMap;
}

function remapCustomValues(customValues, idMap) {
  if (!customValues || typeof customValues !== "object") return {};
  const out = {};

  Object.entries(customValues).forEach(([key, value]) => {
    const mappedKey = idMap[key] || key;
    out[mappedKey] = value;
  });

  return out;
}

function value(id) {
  return document.getElementById(id).value;
}

function numberValue(id) {
  const parsed = Number(document.getElementById(id).value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericOrNull(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetric(key) {
  return BASE_METRICS.find((metric) => metric.key === key);
}

function getEntryMetricValue(entry, key) {
  if (key.startsWith("custom.")) {
    const id = key.replace("custom.", "");
    const value = Number(entry.custom?.[id]);
    return Number.isFinite(value) ? value : null;
  }

  const value = Number(entry[key]);
  return Number.isFinite(value) ? value : null;
}

function formatMetric(metric, value) {
  const parsed = Number(value);
  if (!metric || !Number.isFinite(parsed)) return "-";
  return parsed.toFixed(metric.decimals);
}

function customSummary(customValues = {}) {
  const keys = Object.keys(customValues);
  if (!keys.length) return "-";

  const shown = keys
    .slice(0, 2)
    .map((id) => {
      const metric = customMetrics.find((item) => item.id === id);
      if (!metric) return null;
      const value = Number(customValues[id]);
      if (!Number.isFinite(value)) return null;
      return `${metric.label}: ${value.toFixed(metric.decimals)}`;
    })
    .filter(Boolean);

  if (!shown.length) return "-";
  if (keys.length > 2) shown.push(`+${keys.length - 2} more`);
  return shown.join(" | ");
}

function appendStat(container, label, value) {
  const block = document.createElement("article");
  block.className = "stat";
  block.innerHTML = `
    <span>${label}</span>
    <strong>${value}</strong>
  `;
  container.appendChild(block);
}

function shortDate(isoDate) {
  const [year, month, day] = String(isoDate || "").split("-");
  if (!year || !month || !day) return isoDate;
  return `${month}/${day}/${year.slice(2)}`;
}

function upsertById(existing, incoming) {
  const map = new Map(existing.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => map.set(entry.id, entry));
  return [...map.values()];
}

function mergeImportedEntries(existing, incoming) {
  const next = [...existing];
  incoming.forEach((entry) => {
    const existingIndex = next.findIndex(
      (item) =>
        (entry.sourceFitKey && item.sourceFitKey === entry.sourceFitKey) ||
        (entry.sourceCsvKey && item.sourceCsvKey === entry.sourceCsvKey) ||
        item.id === entry.id
    );
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...entry };
    } else {
      next.push(entry);
    }
  });
  return next;
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function sum(values) {
  return values.filter((value) => Number.isFinite(value)).reduce((acc, value) => acc + value, 0);
}

function csvEscape(value) {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
