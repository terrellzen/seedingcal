const CELL_LINES = [
  { name: 'U2OS', diameter: 20, doubling_time: 24 },
  { name: 'HEK293', diameter: 13, doubling_time: 24 },
  { name: 'HeLa', diameter: 18, doubling_time: 20 },
];

const VESSELS = {
  "35 mm Dish":     { cat_no: "150460 / 150318", surface_area: 8.8,  cells_100: 1200000,  medium: "2" },
  "60 mm Dish":     { cat_no: "150462 / 150288", surface_area: 21.5, cells_100: 3200000,  medium: "5" },
  "100 mm Dish":    { cat_no: "150464 / 150350", surface_area: 56.7, cells_100: 8800000,  medium: "12" },
  "150 mm Dish":    { cat_no: "150468 / 168381", surface_area: 145,  cells_100: 20000000, medium: "30" },
  "6-Well Plate":   { cat_no: "140675",          surface_area: 9.6,  cells_100: 1200000,  medium: "1-3" },
  "12-Well Plate":  { cat_no: "150628",          surface_area: 3.5,  cells_100: 500000,   medium: "1-2" },
  "24-Well Plate":  { cat_no: "142475",          surface_area: 1.9,  cells_100: 240000,   medium: "0.5-1.0" },
  "48-Well Plate":  { cat_no: "150687",          surface_area: 1.1,  cells_100: 120000,   medium: "0.2-0.4" },
  "96-Well Plate":  { cat_no: "167008",          surface_area: 0.32, cells_100: 40000,    medium: "0.1-0.2" },
  "384-Well Plate": { cat_no: "164688",          surface_area: 0.084,cells_100: 7200,     medium: "0.08" },
  "1536-Well Plate":{ cat_no: "253614",          surface_area: 0.03, cells_100: 3600,     medium: "0.01" },
};

const VESSEL_NAMES = Object.keys(VESSELS);

const DEFAULTS = { hela_reference_diameter: 18, cell_diameter: 13, doubling_time: 24, incubation_time: 48 };
const STORAGE_KEY = 'cell_seeding_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}
function saveSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

function sizeCorrection(s) { return (s.hela_reference_diameter / s.cell_diameter) ** 2; }

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(1);
}

function calculateAll(s, vesselName, vessel, viableConc, viability, startConf, endConf) {
  const factor = sizeCorrection(s);
  const viableCellsMl = viableConc * (viability / 100);
  const cells100 = vessel.cells_100 * factor;
  const cellsNeeded = cells100 * (startConf / 100);
  const volumeSeedUl = (cellsNeeded / viableCellsMl) * 1000;
  const cellsEnd = cells100 * (endConf / 100);
  const doublingsNeeded = Math.log2(endConf / startConf);
  const hoursNeeded = doublingsNeeded * s.doubling_time;
  const incubationSufficient = s.incubation_time >= hoursNeeded;
  const confluenceAfter = startConf * 2 ** (s.incubation_time / s.doubling_time);
  return { vessel_name: vesselName, vessel, cells_100: cells100, cells_needed: cellsNeeded,
    volume_seed_ul: volumeSeedUl, cells_end: cellsEnd, viable_cells_ml: viableCellsMl,
    doublings_needed: doublingsNeeded, hours_needed: hoursNeeded,
    incubation_sufficient: incubationSufficient, confluence_after: confluenceAfter };
}

let state = {
  settings: loadSettings(),
  cellLine: null,
  viableConc: '',
  viability: '',
  startConf: '',
  endConf: '',
  vessel: null,
  editing: null,
  editVal: '',
  pendingVessel: null,
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function renderSettingsFields() {
  const s = state.settings;
  const factor = sizeCorrection(s);

  const groups = [
    { id: 'settingsFields', fields: [
      { key: 'hela_reference_diameter', label: 'HeLa ref. diameter', unit: 'µm', note: 'HeLa cells at confluence compact to ~18 µm' },
      { key: 'cell_diameter', label: 'Cell line diameter', unit: 'µm', note: 'U2OS ~20 µm · HEK293 ~13 µm · HeLa ~18 µm' },
    ]},
    { id: 'settingsFields2', fields: [
      { key: 'doubling_time', label: 'Doubling time', unit: 'h', note: 'U2OS ~24 h · HEK293 ~24 h · HeLa ~20 h' },
      { key: 'incubation_time', label: 'Planned incubation', unit: 'h', note: 'How long cells will be in culture' },
    ]},
  ];

  for (const { id, fields } of groups) {
    let html = '';
    for (const f of fields) {
      const editing = state.editing === f.key;
      html += `<div class="setting-row">
        <div class="flex-1">
          <div class="setting-label">${f.label}</div>
          <div class="setting-note">${f.note}</div>
        </div>`;
      if (editing) {
        html += `<div class="edit-group">
          <input type="text" id="editInput" inputmode="numeric" value="${state.editVal}">
          <span class="setting-unit">${f.unit}</span>
          <span class="action" onclick="commitEdit()" style="color:var(--accent)">✓</span>
          <span class="action" onclick="cancelEdit()" style="color:var(--red)">✕</span>
        </div>`;
      } else {
        html += `<div class="clickable" onclick="beginEdit('${f.key}')">
          <span class="setting-value">${s[f.key]}</span>
          <span class="setting-unit">${f.unit}</span>
          <span class="chevron">›</span>
        </div>`;
      }
      html += `</div>`;
    }
    if (id === 'settingsFields') {
      html += `<div class="setting-row">
        <div class="setting-label flex-1">Correction factor</div>
        <span class="setting-value" style="color:var(--secondary)">${factor.toFixed(2)} (HeLa=1.00 · U2OS=0.81 · HEK293=1.92)</span>
      </div>`;
    }
    document.getElementById(id).innerHTML = html;
  }

  let vhtml = '';
  VESSEL_NAMES.forEach((name) => {
    const v = VESSELS[name];
    const cnt = v.cells_100 >= 1_000_000 ? (v.cells_100/1_000_000).toFixed(1)+'M' : v.cells_100 >= 1_000 ? (v.cells_100/1_000).toFixed(1)+'K' : v.cells_100;
    vhtml += `<div class="vessel-settings-row">
      <span class="vs-icon">📦</span>
      <div class="flex-1">
        <div class="vs-name">${name}</div>
        <div class="vs-detail">${v.cat_no} · ${v.surface_area} cm² · ${v.medium} mL</div>
      </div>
      <span class="vs-count">${cnt} @100%</span>
    </div>`;
  });
  document.getElementById('vesselRef').innerHTML = vhtml;

  if (state.editing) {
    setTimeout(() => {
      const inp = document.getElementById('editInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 50);
  }
}

function renderModal() {
  const html = VESSEL_NAMES.map(name => {
    const v = VESSELS[name];
    const sel = state.pendingVessel === name;
    const cnt = v.cells_100 >= 1_000_000 ? (v.cells_100/1_000_000).toFixed(1)+'M' : v.cells_100 >= 1_000 ? (v.cells_100/1_000).toFixed(1)+'K' : v.cells_100;
    return `<div class="modal-item" onclick="selectPending('${name}')">
      <span class="mi-icon${sel ? ' sel' : ''}">📦</span>
      <div class="flex-1">
        <div class="mi-name${sel ? ' sel' : ''}">${name}</div>
        <div class="mi-detail">${v.cat_no} · ${v.surface_area} cm² · ${v.medium} mL · ${cnt} @100%</div>
      </div>
      ${sel ? '<span class="mi-check">✓</span>' : ''}
    </div>`;
  }).join('');
  document.getElementById('modalList').innerHTML = html;
}

function renderVesselSelector() {
  const sel = state.vessel;
  const ph = document.getElementById('vesselPlaceholder');
  const det = document.getElementById('vesselDetail');
  if (sel) {
    const v = VESSELS[sel];
    ph.textContent = sel;
    ph.style.color = 'var(--text)';
    ph.style.fontWeight = '600';
    det.textContent = `${v.cat_no} · ${v.surface_area} cm² · ${v.medium} mL`;
    det.style.display = 'block';
  } else {
    ph.textContent = 'Tap to select a vessel';
    ph.style.color = 'var(--secondary)';
    ph.style.fontWeight = '400';
    det.style.display = 'none';
  }
}

function renderCellLineButtons() {
  $$('#cellLineGroup button').forEach(b => {
    b.classList.toggle('active', b.dataset.line === state.cellLine);
  });
}

function selectCellLine(name) {
  state.cellLine = name;
  const cl = CELL_LINES.find(c => c.name === name);
  if (cl) {
    state.settings.cell_diameter = cl.diameter;
    state.settings.doubling_time = cl.doubling_time;
    saveSettings(state.settings);
  }
  renderCellLineButtons();
}

function beginEdit(key) {
  state.editing = key;
  state.editVal = String(state.settings[key]);
  renderSettingsFields();
}

function commitEdit() {
  if (!state.editing) return;
  const inp = document.getElementById('editInput');
  if (!inp) return;
  const val = parseNum(inp.value);
  if (isNaN(val) || val <= 0) return;
  state.settings[state.editing] = val;
  state.editing = null;
  state.editVal = '';
  renderSettingsFields();
}

function cancelEdit() {
  state.editing = null;
  state.editVal = '';
  renderSettingsFields();
}

function applySettings() {
  saveSettings(state.settings);
  state.settings = loadSettings();
  renderSettingsFields();
  const btn = document.getElementById('applyBtn');
  btn.textContent = '✓ Applied!';
  btn.classList.add('green');
  setTimeout(() => { btn.textContent = '✓ Apply Settings'; btn.classList.remove('green'); }, 1500);
}

function resetDefaults() {
  state.settings = { ...DEFAULTS };
  state.editing = null;
  renderSettingsFields();
}

function openVesselModal() {
  state.pendingVessel = state.vessel;
  renderModal();
  document.getElementById('vesselModal').classList.add('open');
}

function closeModal() {
  document.getElementById('vesselModal').classList.remove('open');
}

function selectPending(name) {
  state.pendingVessel = name;
  renderModal();
}

function confirmVessel() {
  if (state.pendingVessel) state.vessel = state.pendingVessel;
  closeModal();
  renderVesselSelector();
}

function parseNum(v) { return parseFloat(v.replace(/[^\d.-]/g, '')); }

function calculate() {
  const err = document.getElementById('errorMsg');
  err.textContent = '';

  if (!state.cellLine) { err.textContent = 'Select a cell line'; return; }
  if (!state.vessel) { err.textContent = 'Select a vessel'; return; }

  const vc = parseNum(document.getElementById('viableConc').value);
  const viab = parseNum(document.getElementById('viability').value);
  const sc = parseNum(document.getElementById('startConf').value);
  const ec = parseNum(document.getElementById('endConf').value);

  if (isNaN(vc) || isNaN(viab) || isNaN(sc) || isNaN(ec)) { err.textContent = 'Fill in all numeric fields'; return; }
  if (viab <= 0 || viab > 100) { err.textContent = 'Viability must be 1–100'; return; }

  const vessel = VESSELS[state.vessel];
  const r = calculateAll(state.settings, state.vessel, vessel, vc, viab, sc, ec);

  document.getElementById('results').style.display = 'block';
  document.getElementById('resultVessel').textContent = r.vessel_name;
  document.getElementById('resultMeta').textContent = `${state.cellLine} · ${sc}% → ${ec}%`;

  const badge = document.getElementById('resultBadge');
  badge.textContent = r.incubation_sufficient ? '✓ Sufficient incubation' : '⚠ Extend incubation';
  badge.style.background = r.incubation_sufficient ? 'var(--green)' : 'var(--orange)';

  document.getElementById('resCellsNeeded').textContent = fmt(r.cells_needed);
  document.getElementById('resVolume').textContent = r.volume_seed_ul.toFixed(1) + ' µL';
  document.getElementById('resCellsEnd').textContent = fmt(r.cells_end);

  document.getElementById('resCatNo').textContent = r.vessel.cat_no;
  document.getElementById('resSA').textContent = r.vessel.surface_area + ' cm²';
  document.getElementById('resMed').textContent = r.vessel.medium + ' mL';
  document.getElementById('resCells100').textContent = fmt(r.cells_100);
  document.getElementById('resSeedVol').textContent = r.volume_seed_ul.toFixed(1) + ' µL';

  document.getElementById('resDoublings').textContent = r.doublings_needed.toFixed(2);
  document.getElementById('resHours').textContent = r.hours_needed.toFixed(1) + 'h';
  document.getElementById('resConfAfter').textContent = r.confluence_after.toFixed(1) + '%';

  document.getElementById('calcBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$$('.tab-bar button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-bar button').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

$$('#cellLineGroup button').forEach(b => {
  b.addEventListener('click', () => selectCellLine(b.dataset.line));
});

document.getElementById('vesselSelector').addEventListener('click', openVesselModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalConfirm').addEventListener('click', confirmVessel);

document.getElementById('calcBtn').addEventListener('click', calculate);

document.getElementById('applyBtn').addEventListener('click', applySettings);
document.getElementById('resetBtn').addEventListener('click', resetDefaults);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state.editing) commitEdit();
  if (e.key === 'Escape' && state.editing) cancelEdit();
  if (e.key === 'Escape' && document.getElementById('vesselModal').classList.contains('open')) closeModal();
});

document.getElementById('vesselModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('vesselModal')) closeModal();
});

renderCellLineButtons();
renderVesselSelector();
renderSettingsFields();

$$('.tab-bar button').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'calc') {
      state.settings = loadSettings();
    }
  });
});
