/* ---------- helpers ---------- */
let ROOT = 16;
const fmt = (n) => parseFloat(n.toFixed(4)).toString();

const rootInput = document.getElementById("root-size");
const vwMin = document.getElementById("vw-min");
const vwMax = document.getElementById("vw-max");

/* persistence (degrades gracefully if storage is blocked) */
const STORE_KEY = "type-unit-converter:v2";
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      root: rootInput.value,
      vwMin: vwMin.value,
      vwMax: vwMax.value,
      fsMax: clMaxSize.value,
      fsMin: clMinSize.value,
      lhOn: lhOn,
      lhUnit: lhUnit,
      lhMax: clMaxLh.value,
      lhMin: clMinLh.value,
      varsOn: varsOn,
      varName: document.getElementById("vars-name").value,
      histRecalc: historyRecalc.checked,
    }));
  } catch (e) { /* storage unavailable, skip */ }
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

const copyValues = { cl: "", lhc: "", ls: "", lhu: "", vars: "" };

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const t = document.createElement("textarea");
    t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand("copy"); t.remove();
  }
}

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    await writeClipboard(copyValues[btn.dataset.copy] || "");
    // copying a fluid clamp value means it was used — snapshot it into history
    if (["cl", "lhc", "vars"].includes(btn.dataset.copy)) addHistoryEntry();
    const original = btn.textContent;
    btn.textContent = "Copied ✓";
    btn.classList.add("copy-btn--copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copy-btn--copied");
    }, 1400);
  });
});

function currentSettings() {
  return { root: ROOT, minVw: parseFloat(vwMin.value), maxVw: parseFloat(vwMax.value) };
}

/* build a fluid clamp() from two px endpoints; settings default to the globals */
function buildClamp(minPx, maxPx, s = currentSettings()) {
  const { root, minVw, maxVw } = s;
  if ([minPx, maxPx, minVw, maxVw, root].some(isNaN) || minVw === maxVw || root <= 0) return null;

  const a = minPx / root, b = maxPx / root;
  const va = minVw / root, vb = maxVw / root;
  const slope = (b - a) / (vb - va);
  const intersect = a - slope * va;
  const slopeVw = slope * 100;

  const lower = `${fmt(Math.min(a, b))}rem`;
  const upper = `${fmt(Math.max(a, b))}rem`;
  return `clamp(${lower}, ${fmt(intersect)}rem + ${fmt(slopeVw)}vw, ${upper})`;
}

/* ---------- fluid clamp (font-size + optional line-height) ---------- */
const clMinSize = document.getElementById("cl-min-size");
const clMaxSize = document.getElementById("cl-max-size");
const clMinLh = document.getElementById("cl-min-lh");
const clMaxLh = document.getElementById("cl-max-lh");
const clOutput = document.getElementById("cl-output");
const clSub = document.getElementById("cl-sub");
const lhcOutput = document.getElementById("lhc-output");
const lhcSub = document.getElementById("lhc-sub");
const clPreview = document.getElementById("cl-preview");
const lhToggle = document.getElementById("lh-toggle");
const lhInputs = document.getElementById("lh-inputs");
const lhResult = document.getElementById("lh-result");
const clLhUnitSelect = document.getElementById("cl-lh-unit");
const clMaxLhUnit = document.getElementById("cl-max-lh-unit");
const clMinLhUnit = document.getElementById("cl-min-lh-unit");
const clMaxLhHint = document.getElementById("cl-max-lh-hint");
const clMinLhHint = document.getElementById("cl-min-lh-hint");

let lhOn = false;
let lhUnit = "unitless";

const LH_UNITS = {
  unitless: { suffix: "×", step: "0.05", hint: "Ratio at the %s viewport." },
  px: { suffix: "px", step: "0.5", hint: "Leading in px at the %s viewport." },
  percent: { suffix: "%", step: "1", hint: "% of font size at the %s viewport." },
};

/* line-height value <-> px leading, relative to the font size at that end */
function lhToPx(value, unit, fontPx) {
  if (unit === "px") return value;
  if (unit === "percent") return (value / 100) * fontPx;
  return value * fontPx;
}
function lhFromPx(px, unit, fontPx) {
  if (unit === "px") return px;
  if (unit === "percent") return (px / fontPx) * 100;
  return px / fontPx;
}

/* switch input unit; convert the current values so the generated CSS is unchanged */
function setLhUnit(newUnit, convert) {
  if (!LH_UNITS[newUnit]) newUnit = "unitless";
  if (convert && newUnit !== lhUnit) {
    [[clMaxLh, clMaxSize], [clMinLh, clMinSize]].forEach(([lhEl, fsEl]) => {
      const px = lhToPx(parseFloat(lhEl.value), lhUnit, parseFloat(fsEl.value));
      const converted = lhFromPx(px, newUnit, parseFloat(fsEl.value));
      if (isFinite(converted)) lhEl.value = fmt(converted);
    });
  }
  lhUnit = newUnit;
  clLhUnitSelect.value = newUnit;
  const meta = LH_UNITS[newUnit];
  clMaxLhUnit.textContent = meta.suffix;
  clMinLhUnit.textContent = meta.suffix;
  clMaxLh.step = meta.step;
  clMinLh.step = meta.step;
  clMaxLhHint.textContent = meta.hint.replace("%s", "largest");
  clMinLhHint.textContent = meta.hint.replace("%s", "smallest");
  updateClamp();
}

clLhUnitSelect.addEventListener("change", () => {
  setLhUnit(clLhUnitSelect.value, true);
  saveState();
});

/* px endpoints currently driving the preview (null = invalid input) */
let previewFs = null;
let previewLh = null;

function updateClamp() {
  const minFs = parseFloat(clMinSize.value);
  const maxFs = parseFloat(clMaxSize.value);

  const fontClamp = buildClamp(minFs, maxFs);
  if (!fontClamp) {
    clOutput.textContent = "—";
    clSub.textContent = "check font sizes and viewport range";
    previewFs = null;
  } else {
    clOutput.textContent = fontClamp;
    clSub.textContent = `${fmt(maxFs)}px → ${fmt(minFs)}px`;
    copyValues.cl = fontClamp;
    previewFs = { min: minFs, max: maxFs };
  }

  previewLh = null;
  if (lhOn) {
    const minLh = parseFloat(clMinLh.value);
    const maxLh = parseFloat(clMaxLh.value);
    const minLhPx = lhToPx(minLh, lhUnit, minFs);
    const maxLhPx = lhToPx(maxLh, lhUnit, maxFs);
    const lhClamp = (isNaN(minLhPx) || isNaN(maxLhPx)) ? null : buildClamp(minLhPx, maxLhPx);

    if (!lhClamp) {
      lhcOutput.textContent = "—";
      lhcSub.textContent = "check line-height values";
    } else {
      lhcOutput.textContent = lhClamp;
      lhcSub.textContent = `${fmt(maxLhPx)}px → ${fmt(minLhPx)}px leading`;
      copyValues.lhc = lhClamp;
      previewLh = { min: minLhPx, max: maxLhPx };
    }
  }

  updateVars();
  updateSim();
}

/* ---------- resizable preview: container width simulates the viewport ---------- */
const clResize = document.getElementById("cl-resize");
const clSim = document.getElementById("cl-sim");
const SIM_MIN_W = 224; /* keep in sync with .preview__resize min-width (14rem) */

function updateSim() {
  if (!previewFs) {
    clSim.textContent = "the viewport";
    clPreview.style.removeProperty("font-size");
    clPreview.style.removeProperty("line-height");
    return;
  }

  /* map the container's drag range onto the viewport range, narrowest = min viewport */
  const maxW = clResize.parentElement.clientWidth;
  const minW = Math.min(SIM_MIN_W, maxW);
  const t = maxW > minW
    ? Math.max(0, Math.min(1, (clResize.offsetWidth - minW) / (maxW - minW)))
    : 1;

  const simVw = parseFloat(vwMin.value) + t * (parseFloat(vwMax.value) - parseFloat(vwMin.value));
  clSim.textContent = `a ${Math.round(simVw)}px viewport`;

  clPreview.style.fontSize = `${fmt(previewFs.min + t * (previewFs.max - previewFs.min))}px`;
  if (previewLh) {
    clPreview.style.lineHeight = `${fmt(previewLh.min + t * (previewLh.max - previewLh.min))}px`;
  } else {
    clPreview.style.removeProperty("line-height");
  }
}

new ResizeObserver(updateSim).observe(clResize);
window.addEventListener("resize", updateSim);

function setLhOn(on) {
  lhOn = on;
  lhToggle.setAttribute("aria-pressed", String(on));
  lhToggle.setAttribute("aria-expanded", String(on));
  lhInputs.hidden = !on;
  lhResult.hidden = !on;
  lhToggle.querySelector(".toggle__text").textContent =
    on ? "Remove line-height clamp" : "Add line-height clamp";
  updateClamp();
}

lhToggle.addEventListener("click", () => { setLhOn(!lhOn); saveState(); });
[clMinSize, clMaxSize, clMinLh, clMaxLh].forEach((el) =>
  el.addEventListener("input", () => { updateClamp(); saveState(); })
);

/* ---------- CSS variables output ---------- */
const varsToggle = document.getElementById("vars-toggle");
const varsArea = document.getElementById("vars-area");
const varsName = document.getElementById("vars-name");
const varsCode = document.getElementById("vars-code");

let varsOn = false;

function buildVarNameFrom(template, min, max) {
  let name = (template || "").trim() || "fluid-size";
  name = name.replace(/\{min\}/g, (min || "").trim()).replace(/\{max\}/g, (max || "").trim());
  // keep it a sane custom-property ident: spaces to dashes, drop unsafe chars
  name = name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-_]/g, "");
  return name || "fluid-size";
}

function buildVarName() {
  return buildVarNameFrom(varsName.value, clMinSize.value, clMaxSize.value);
}

function updateVars() {
  const name = buildVarName();
  const fontValid = clOutput.textContent.startsWith("clamp");
  let text;
  if (!fontValid) {
    text = "/* enter valid font sizes and viewport range */";
  } else {
    const lines = [`--${name}: ${copyValues.cl};`];
    if (lhOn && lhcOutput.textContent.startsWith("clamp")) {
      lines.push(`--${name}-line-height: ${copyValues.lhc};`);
    }
    text = lines.join("\n");
  }
  varsCode.textContent = text;
  copyValues.vars = text;
}

function setVarsOn(on) {
  varsOn = on;
  varsToggle.setAttribute("aria-pressed", String(on));
  varsToggle.setAttribute("aria-expanded", String(on));
  varsArea.hidden = !on;
  varsToggle.querySelector(".toggle__text").textContent =
    on ? "Hide CSS variables" : "Output as CSS variables";
  updateVars();
}

varsToggle.addEventListener("click", () => { setVarsOn(!varsOn); saveState(); });
varsName.addEventListener("input", () => { updateVars(); saveState(); });

/* ---------- calculation history ---------- */
const HISTORY_KEY = "type-unit-converter:history:v1";
const HISTORY_MAX = 50;
const historyList = document.getElementById("history-list");
const historyRecalc = document.getElementById("history-recalc");

let historyEntries = [];
let historyIdCounter = 0;

function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function persistHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(historyEntries)); } catch (e) {}
}

/* entries store inputs + the globals they were made under; outputs are
   always recomputed, so the "apply current settings" toggle is free */
function currentEntry() {
  return {
    id: `${Date.now()}-${historyIdCounter++}`,
    ts: Date.now(),
    root: rootInput.value, vwMin: vwMin.value, vwMax: vwMax.value,
    fsMax: clMaxSize.value, fsMin: clMinSize.value,
    lhOn: lhOn, lhUnit: lhUnit, lhMax: clMaxLh.value, lhMin: clMinLh.value,
    varsOn: varsOn, varName: varsName.value,
  };
}

function entryKey(entry) {
  const { id, ts, ...inputs } = entry;
  return JSON.stringify(inputs);
}

function entrySettings(entry) {
  return { root: parseFloat(entry.root), minVw: parseFloat(entry.vwMin), maxVw: parseFloat(entry.vwMax) };
}

function computeEntryOutputs(entry, s) {
  const minFs = parseFloat(entry.fsMin);
  const maxFs = parseFloat(entry.fsMax);
  const fontClamp = buildClamp(minFs, maxFs, s);
  let lhClamp = null;
  if (entry.lhOn) {
    const minLhPx = lhToPx(parseFloat(entry.lhMin), entry.lhUnit, minFs);
    const maxLhPx = lhToPx(parseFloat(entry.lhMax), entry.lhUnit, maxFs);
    if (!isNaN(minLhPx) && !isNaN(maxLhPx)) lhClamp = buildClamp(minLhPx, maxLhPx, s);
  }
  let varsLines = null;
  if (entry.varsOn && fontClamp) {
    const name = buildVarNameFrom(entry.varName, entry.fsMin, entry.fsMax);
    varsLines = [`--${name}: ${fontClamp};`];
    if (lhClamp) varsLines.push(`--${name}-line-height: ${lhClamp};`);
  }
  return { fontClamp, lhClamp, varsLines };
}

function addHistoryEntry() {
  if (!clOutput.textContent.startsWith("clamp")) return;
  const entry = currentEntry();
  if (historyEntries.length && entryKey(historyEntries[0]) === entryKey(entry)) return;
  historyEntries.unshift(entry);
  if (historyEntries.length > HISTORY_MAX) historyEntries.length = HISTORY_MAX;
  persistHistory();
  renderHistory();
}

function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function restoreEntry(entry) {
  if (!historyRecalc.checked) {
    // reproduce the exact original output: bring back its globals too
    rootInput.value = entry.root;
    vwMin.value = entry.vwMin;
    vwMax.value = entry.vwMax;
    ROOT = parseFloat(rootInput.value) || 16;
    updateLS();
  }
  clMaxSize.value = entry.fsMax;
  clMinSize.value = entry.fsMin;
  clMaxLh.value = entry.lhMax;
  clMinLh.value = entry.lhMin;
  setLhUnit(entry.lhUnit, false); // stored values are already in this unit
  varsName.value = entry.varName;
  setLhOn(entry.lhOn === true);
  setVarsOn(entry.varsOn === true);
  saveState();
}

function renderHistory() {
  historyList.textContent = "";

  if (!historyEntries.length) {
    const li = document.createElement("li");
    li.className = "history__empty";
    li.textContent = "Copy or save a calculation and it will appear here.";
    historyList.appendChild(li);
    return;
  }

  const useCurrent = historyRecalc.checked;
  historyEntries.forEach((entry) => {
    const out = computeEntryOutputs(entry, useCurrent ? currentSettings() : entrySettings(entry));

    const summary = document.createElement("span");
    const lhSuffix = (LH_UNITS[entry.lhUnit] || LH_UNITS.unitless).suffix;
    summary.textContent =
      `${entry.fsMax}px → ${entry.fsMin}px` +
      (entry.lhOn ? ` · lh ${entry.lhMax}${lhSuffix} → ${entry.lhMin}${lhSuffix}` : "") +
      ` · root ${entry.root}px · vw ${entry.vwMax}–${entry.vwMin}`;

    const time = document.createElement("span");
    time.className = "history__time";
    time.textContent = relTime(entry.ts);

    const meta = document.createElement("span");
    meta.className = "history__meta";
    meta.append(summary, time);

    const code = document.createElement("span");
    code.className = "history__code";
    const lines = out.varsLines || [
      `font-size: ${out.fontClamp || "—"};`,
      ...(entry.lhOn ? [`line-height: ${out.lhClamp || "—"};`] : []),
    ];
    code.textContent = lines.join("\n");

    const row = document.createElement("button");
    row.type = "button";
    row.className = "history__entry";
    row.title = `Restore — saved ${new Date(entry.ts).toLocaleString()}`;
    row.append(meta, code);
    row.addEventListener("click", () => restoreEntry(entry));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "history__delete";
    del.setAttribute("aria-label", "Delete history entry");
    del.textContent = "×";
    del.addEventListener("click", () => {
      historyEntries = historyEntries.filter((e) => e.id !== entry.id);
      persistHistory();
      renderHistory();
    });

    const li = document.createElement("li");
    li.className = "history__item";
    li.append(row, del);
    historyList.appendChild(li);
  });
}

historyRecalc.addEventListener("change", () => { renderHistory(); saveState(); });
document.getElementById("history-save").addEventListener("click", addHistoryEntry);
document.getElementById("history-clear").addEventListener("click", () => {
  historyEntries = [];
  persistHistory();
  renderHistory();
});

/* ---------- letter spacing ---------- */
const lsValue = document.getElementById("ls-value");
const lsFontSize = document.getElementById("ls-fontsize");
const lsOutput = document.getElementById("ls-output");
const lsSub = document.getElementById("ls-sub");
const lsPreview = document.getElementById("ls-preview");

function updateLS() {
  const px = parseFloat(lsValue.value);
  const fs = parseFloat(lsFontSize.value);
  if (isNaN(px) || isNaN(fs) || fs <= 0) {
    lsOutput.textContent = "—";
    lsSub.textContent = "enter valid numbers";
    return;
  }
  const em = px / fs;
  const emStr = `${fmt(em)}em`;
  lsOutput.textContent = emStr;
  lsSub.textContent = `or ${fmt(px / ROOT)}rem at a ${fmt(ROOT)}px root`;
  copyValues.ls = emStr;
  lsPreview.style.fontSize = `${fs}px`;
  lsPreview.style.letterSpacing = emStr;
}
lsValue.addEventListener("input", updateLS);
lsFontSize.addEventListener("input", updateLS);

/* ---------- line height (unitless) ---------- */
const lhuValue = document.getElementById("lh-value");
const lhuUnit = document.getElementById("lh-unit");
const lhuFontSizeField = document.getElementById("lh-fontsize-field");
const lhuFontSize = document.getElementById("lh-fontsize");
const lhuOutput = document.getElementById("lhu-output");
const lhuSub = document.getElementById("lhu-sub");
const lhuPreview = document.getElementById("lhu-preview");

function updateLHU() {
  const v = parseFloat(lhuValue.value);
  const usePx = lhuUnit.value === "px";
  lhuFontSizeField.hidden = !usePx;

  if (isNaN(v)) {
    lhuOutput.textContent = "—";
    lhuSub.textContent = "enter a valid number";
    return;
  }

  let unitless, sub;
  if (usePx) {
    const fs = parseFloat(lhuFontSize.value);
    if (isNaN(fs) || fs <= 0) {
      lhuOutput.textContent = "—";
      lhuSub.textContent = "enter a valid font size";
      return;
    }
    unitless = v / fs;
    sub = `${fmt(v)}px ÷ ${fmt(fs)}px`;
  } else {
    unitless = v / 100;
    sub = `${fmt(v)}% ÷ 100`;
  }

  const out = fmt(unitless);
  lhuOutput.textContent = out;
  lhuSub.textContent = sub;
  copyValues.lhu = out;
  lhuPreview.style.lineHeight = out;
}
lhuValue.addEventListener("input", updateLHU);
lhuUnit.addEventListener("change", updateLHU);
lhuFontSize.addEventListener("input", updateLHU);

/* ---------- global settings ---------- */
rootInput.addEventListener("input", () => {
  ROOT = parseFloat(rootInput.value) || 16;
  updateLS();
  updateClamp();
  if (historyRecalc.checked) renderHistory();
  saveState();
});
[vwMin, vwMax].forEach((el) =>
  el.addEventListener("input", () => {
    updateClamp();
    if (historyRecalc.checked) renderHistory();
    saveState();
  })
);

/* ---------- tabs (ARIA pattern + arrow keys) ---------- */
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectTab(tab) {
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
  });
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    let next;
    if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
    else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); selectTab(next); next.focus(); }
  });
});

/* ---------- init ---------- */
const saved = loadState();
if (saved) {
  if (saved.root) rootInput.value = saved.root;
  if (saved.vwMin) vwMin.value = saved.vwMin;
  if (saved.vwMax) vwMax.value = saved.vwMax;
  // ignore the pre-desktop-first default so existing visitors pick up the new template
  if (saved.varName && saved.varName !== "{min}px-to-{max}px") varsName.value = saved.varName;
}
ROOT = parseFloat(rootInput.value) || 16;

// restore the line-height values and unit; only convert the default ratios
// into the saved unit when the values themselves weren't saved (older state)
const hasSavedLh = saved && saved.lhMax != null && saved.lhMin != null;
if (saved && saved.fsMax != null) clMaxSize.value = saved.fsMax;
if (saved && saved.fsMin != null) clMinSize.value = saved.fsMin;
if (hasSavedLh) {
  clMaxLh.value = saved.lhMax;
  clMinLh.value = saved.lhMin;
}
if (saved && saved.lhUnit && saved.lhUnit !== "unitless") setLhUnit(saved.lhUnit, !hasSavedLh);
historyRecalc.checked = !!(saved && saved.histRecalc === true);

setLhOn(saved && saved.lhOn === true);    // restore line-height toggle
setVarsOn(saved && saved.varsOn === true); // restore CSS variables toggle
updateLS();
updateLHU();
updateClamp();

historyEntries = loadHistory();
renderHistory();
