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
      lhOn: lhOn,
      varsOn: varsOn,
      varName: document.getElementById("vars-name").value,
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
    const original = btn.textContent;
    btn.textContent = "Copied ✓";
    btn.classList.add("copy-btn--copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copy-btn--copied");
    }, 1400);
  });
});

/* build a fluid clamp() from two px endpoints using global viewports + root */
function buildClamp(minPx, maxPx) {
  const minVw = parseFloat(vwMin.value);
  const maxVw = parseFloat(vwMax.value);
  if ([minPx, maxPx, minVw, maxVw].some(isNaN) || minVw === maxVw) return null;

  const a = minPx / ROOT, b = maxPx / ROOT;
  const va = minVw / ROOT, vb = maxVw / ROOT;
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

let lhOn = false;

function updateClamp() {
  const minFs = parseFloat(clMinSize.value);
  const maxFs = parseFloat(clMaxSize.value);

  const fontClamp = buildClamp(minFs, maxFs);
  if (!fontClamp) {
    clOutput.textContent = "—";
    clSub.textContent = "check font sizes and viewport range";
    clPreview.style.removeProperty("font-size");
  } else {
    clOutput.textContent = fontClamp;
    clSub.textContent = `${fmt(maxFs)}px → ${fmt(minFs)}px`;
    copyValues.cl = fontClamp;
    clPreview.style.fontSize = fontClamp;
  }

  if (lhOn) {
    const minLh = parseFloat(clMinLh.value);
    const maxLh = parseFloat(clMaxLh.value);
    const minLhPx = minLh * minFs;
    const maxLhPx = maxLh * maxFs;
    const lhClamp = (isNaN(minLh) || isNaN(maxLh)) ? null : buildClamp(minLhPx, maxLhPx);

    if (!lhClamp) {
      lhcOutput.textContent = "—";
      lhcSub.textContent = "check line-height ratios";
      clPreview.style.removeProperty("line-height");
    } else {
      lhcOutput.textContent = lhClamp;
      lhcSub.textContent = `${fmt(maxLhPx)}px → ${fmt(minLhPx)}px leading`;
      copyValues.lhc = lhClamp;
      clPreview.style.lineHeight = lhClamp;
    }
  } else {
    clPreview.style.removeProperty("line-height");
  }

  updateVars();
}

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
  el.addEventListener("input", updateClamp)
);

/* ---------- CSS variables output ---------- */
const varsToggle = document.getElementById("vars-toggle");
const varsArea = document.getElementById("vars-area");
const varsName = document.getElementById("vars-name");
const varsCode = document.getElementById("vars-code");

let varsOn = false;

function buildVarName() {
  const min = clMinSize.value.trim();
  const max = clMaxSize.value.trim();
  let name = (varsName.value || "").trim() || "fluid-size";
  name = name.replace(/\{min\}/g, min).replace(/\{max\}/g, max);
  // keep it a sane custom-property ident: spaces to dashes, drop unsafe chars
  name = name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-_]/g, "");
  return name || "fluid-size";
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
  saveState();
});
[vwMin, vwMax].forEach((el) =>
  el.addEventListener("input", () => { updateClamp(); saveState(); })
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

setLhOn(saved && saved.lhOn === true);    // restore line-height toggle
setVarsOn(saved && saved.varsOn === true); // restore CSS variables toggle
updateLS();
updateLHU();
updateClamp();
