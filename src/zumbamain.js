/*
 * zumbamain.js  —  entry point for zumba.html
 *
 * Porto notation dropdowns for 2 geometries.
 * Geometry 1: drives lattice animation + primary Raman spectrum + mode table.
 * Geometry 2: Raman overlay (orange dashed), togglable.
 *
 * Symmetry labels are read from JSON field mode_symmetry[] (injected by
 * generate_zumba_jsons.py via frequency-matching), so LO-TO reordering
 * is handled correctly per pol direction — no hardcoded position array.
 *
 * Constraint: pol direction cannot equal ei or es (enforced in UI).
 */

import $ from 'jquery';
import * as THREE from 'three';
import Highcharts from 'highcharts';
import jsyaml from 'js-yaml';
import Detector from '../libs/Detector.js';
import '../libs/CCapture.js';
import GIFLib from '../libs/gif.js';
import { Complex } from './legacycomplex.js';

if (THREE.ColorManagement && typeof THREE.ColorManagement.enabled === 'boolean') {
    THREE.ColorManagement.enabled = false;
}
function resolveGifConstructor(mod) {
    if (typeof mod === 'function')                { return mod; }
    if (mod && typeof mod.default === 'function') { return mod.default; }
    if (mod && typeof mod.GIF === 'function')     { return mod.GIF; }
    return null;
}
globalThis.THREE      = THREE;
globalThis.$          = $;
globalThis.jQuery     = $;
globalThis.Highcharts = Highcharts;
globalThis.Complex    = Complex;
globalThis.jsyaml     = jsyaml;
globalThis.GIF        = resolveGifConstructor(GIFLib);

import { ZumbaDB }    from './zumbadb.js';
import { PhononJson } from './phononjson.js';
import { VibCrystal, PhononHighcharts, PhononWebpage } from './phononwebsite.js';

function makeFilename(pol, ei, es) {
    return `zumbadb/ZMO_pol_${pol}_ei_${ei}_es_${es}.json`;
}
function portoLabel(pol, ei, es) {
    return `${pol}(${ei},${es})${pol}`;
}

const PORTO_RULES = {
    'z(x,x)z': new Set(['A_1', 'E_2']),
    'z(y,y)z': new Set(['A_1', 'E_2']),
    'z(x,y)z': new Set(['E_2']),
    'z(y,x)z': new Set(['E_2']),
    'z(x,z)z': new Set([]),
    'z(z,x)z': new Set([]),
    'z(y,z)z': new Set([]),
    'z(z,y)z': new Set([]),
    'z(z,z)z': new Set([]),
    'x(y,y)x': new Set(['A_1', 'E_2']),
    'x(z,z)x': new Set(['A_1']),
    'x(y,z)x': new Set(['E_1']),
    'x(z,y)x': new Set(['E_1']),
    'x(x,x)x': new Set([]),
    'x(x,y)x': new Set([]),
    'x(y,x)x': new Set([]),
    'x(x,z)x': new Set([]),
    'x(z,x)x': new Set([]),
    'y(x,x)y': new Set(['A_1', 'E_2']),
    'y(z,z)y': new Set(['A_1']),
    'y(x,z)y': new Set(['E_1']),
    'y(z,x)y': new Set(['E_1']),
    'y(y,y)y': new Set([]),
    'y(x,y)y': new Set([]),
    'y(y,x)y': new Set([]),
    'y(y,z)y': new Set([]),
    'y(z,y)y': new Set([]),
};

function getActiveSymmetries(pol, ei, es) {
    return PORTO_RULES[`${pol}(${ei},${es})${pol}`] || new Set([]);
}

function getModeSymmetry() {
    if (g1Symmetries.length > 0) return g1Symmetries;
    if (p.phonon && p.phonon.mode_symmetry) return p.phonon.mode_symmetry;
    return [];
}

function formatSymLabel(sym) {
    if (!sym || sym === '?') return '?';
    if (sym.toLowerCase() === 'dark') return 'Silent';
    return sym.replace(/_(\w+)/, '<sub>$1</sub>');
}

function enforcePolConstraint(prefix) {
    const polSel = document.getElementById(`${prefix}-pol`);
    const eiSel  = document.getElementById(`${prefix}-ei`);
    const esSel  = document.getElementById(`${prefix}-es`);
    if (!polSel || !eiSel || !esSel) return;

    const pol = polSel.value;
    const ei  = eiSel.value;
    const es  = esSel.value;

    Array.from(eiSel.options).forEach(opt => {
        opt.disabled = (opt.value === pol);
    });
    Array.from(esSel.options).forEach(opt => {
        opt.disabled = (opt.value === pol);
    });
    Array.from(polSel.options).forEach(opt => {
        opt.disabled = (opt.value === ei || opt.value === es);
    });

    let changed = false;
    if (eiSel.value === pol) {
        const valid = Array.from(eiSel.options).find(o => !o.disabled);
        if (valid) { eiSel.value = valid.value; changed = true; }
    }
    if (esSel.value === pol) {
        const valid = Array.from(esSel.options).find(o => !o.disabled);
        if (valid) { esSel.value = valid.value; changed = true; }
    }
    if (polSel.value === eiSel.value || polSel.value === esSel.value) {
        const valid = Array.from(polSel.options).find(o => !o.disabled);
        if (valid) { polSel.value = valid.value; changed = true; }
    }
    return changed;
}

const v = new VibCrystal($('#vibcrystal'));
const d = new PhononHighcharts($('#highcharts'), $('#raman-spectrum'));
const p = new PhononWebpage(v, d);

p.setMaterialsList(        $('#mat')              );
p.setMaterialsFilterInput( $('#materials_filter') );
p.setReferencesList(       $('#ref')              );
p.setAtomPositions(        $('#atompos')          );
p.setLattice(              $('#lattice')          );
p.setRepetitionsInput(     $('#nx'), $('#ny'), $('#nz') );
p.setModeSelectionInput(   $('#kindex'), $('#nindex'), $('#modeselect') );
p.setModeWeightsToggle(    $('#mode_weights_plot') );
p.setUpdateButton(         $('#update')           );
p.setFileInput(            $('#file-input')       );
p.setTitle(                $('#name')             );

v.setCameraDirectionButton($('#camerax'), 'x');
v.setCameraDirectionButton($('#cameray'), 'y');
v.setCameraDirectionButton($('#cameraz'), 'z');
v.setDisplayCombo(        $('#displaystyle')            );
v.setCellCheckbox(        $('#drawcell')                );
v.setShadingCheckbox(     $('#drawshading')             );
v.setWebmButton(          $('#webmbutton')              );
v.setGifButton(           $('#gifbutton')               );
v.setArrowsCheckbox(      $('#drawvectors')             );
v.setArrowsInput(         $('#vectors_amplitude_range') );
v.setSpeedInput(          $('#speed_range')             );
v.setAmplitudeInput(      $('#amplitude_box'), $('#amplitude_range') );
v.setPlayPause(           $('#playpause')               );
v.setAdvancedAppearanceControls(
    $('#appearance_atom_list'), $('#displaystyle'),
    $('#atom_color_input'),     $('#arrow_color_input'),
    $('#bond_color_input'),     $('#bond_color_by_atom_checkbox'),
    $('#atom_radius_input'),    $('#bond_radius_input'),
    $('#arrow_radius_input'),   $('#bond_rules_list'),
    $('#bond_add_atom_a'),      $('#bond_add_atom_b'),
    $('#bond_add_cutoff_input'),
    $('#bond_add_button'),
    $('#appearance_reset_atom_button'),
    $('#appearance_reset_bonds_button'),
    $('#appearance_reset_vectors_button'),
);
v.setAppearanceUpdatedCallback(() => p.refreshAppearanceUI());

if (!Detector.webgl) { Detector.addGetWebGLMessage(); }

let comparisonPhonon = null;
let comparisonLabel  = null;
let showGeometry2    = true;

let _g1pol = 'x', _g1ei = 'y', _g1es = 'y';
let g1Symmetries = []; 

function computeRamanCurve(phonon) {
    if (!phonon || !phonon.raman_intensities) return null;
    const gi  = phonon.gamma_index || 0;
    const frq = phonon.eigenvalues[gi];
    const int = phonon.raman_intensities;
    const g   = 2.0;
    const maxF = Math.max(...frq) + 50;

    let hasIntensity = false;
    for (let i = 0; i < frq.length; i++) {
        if (int[i] > 0) { hasIntensity = true; break; }
    }
    if (!hasIntensity) return null;

    const data = [];
    for (let w = 0; w < maxF; w++) {
        let I = 0;
        for (let i = 0; i < frq.length; i++) {
            if (int[i] > 0) {
                const dw = w - frq[i];
                I += int[i] * g * g / (dw * dw + g * g);
            }
        }
        data.push([w, I]);
    }
    return data;
}

function overlayComparisonRaman() {
    if (typeof Highcharts === 'undefined') return;
    const chart = Highcharts.charts.find(
        c => c && c.renderTo && c.renderTo.id === 'raman-spectrum'
    );
    if (!chart) return;

    const old = chart.series.find(s => s.options._isComparison);
    if (old) old.remove(false);

    if (!comparisonPhonon || !showGeometry2) { chart.redraw(); return; }

    const data = computeRamanCurve(comparisonPhonon);
    if (!data) { chart.redraw(); return; }

    chart.addSeries({
        _isComparison: true,
        name:      'Geometry 2: ' + (comparisonLabel || ''),
        type:      'line',
        data:      data,
        color:     '#e67e22',
        dashStyle: 'ShortDash',
        marker:    { enabled: false },
        enableMouseTracking: false,
    }, true);
}

function fixActiveModesDots() {
    if (typeof Highcharts === 'undefined') return;
    const chart = Highcharts.charts.find(c => c && c.renderTo && c.renderTo.id === 'raman-spectrum');
    if (!chart) return;

    const phonon = p.phonon;
    if (!phonon || !phonon.eigenvalues) return;
    
    const gi  = phonon.gamma_index || 0;
    const frq = phonon.eigenvalues[gi];
    if (!frq) return;

    const symLabels = getModeSymmetry();
    const activeSym = getActiveSymmetries(_g1pol, _g1ei, _g1es);

    chart.series.forEach(s => {
        if (s.options._isComparison || s.options.isWeightSeries || s.options.isLegendSeries) return;
        if (s.type !== 'scatter' && !(s.options && s.options.type === 'scatter')) return;

        s.points.forEach(point => {
            let modeIdx = -1;
            let minDiff = Infinity;
            
            for (let i = 0; i < frq.length; i++) {
                const diff = Math.abs(frq[i] - point.x);
                if (diff < minDiff) {
                    minDiff = diff;
                    modeIdx = i;
                }
            }

            if (modeIdx !== -1 && minDiff < 0.1) {
                const sym  = symLabels[modeIdx];
                const show = sym ? activeSym.has(sym) : false;

                point.update({
                    marker: {
                        radius:    show ? 4 : 1,
                        symbol:    'diamond',
                        fillColor: show ? '#e74c3c' : '#000000',
                        lineColor: show ? '#c0392b' : '#333333',
                        lineWidth: 1,
                        enabled:   true
                    }
                }, false);
            }
        });
    });

    chart.redraw();
}

function rebuildRamanTable() {
    const wrapper = document.getElementById('raman-table-container');
    if (!wrapper) return false;

    const phonon = p.phonon;
    if (!phonon) return false;

    const gi    = phonon.gamma_index || 0;
    const freqs = phonon.eigenvalues[gi];
    const int1  = phonon.raman_intensities;    
    if (!freqs) return false;

    const int2 = (comparisonPhonon && comparisonPhonon.raman_intensities)
        ? comparisonPhonon.raman_intensities
        : null;

    const symLabels = getModeSymmetry();
    const activeSym = getActiveSymmetries(_g1pol, _g1ei, _g1es);

    let maxI1 = 0, maxI2 = 0;
    if (int1) { for (let i = 0; i < int1.length; i++) { if (int1[i] > maxI1) maxI1 = int1[i]; } }
    if (int2) { for (let i = 0; i < int2.length; i++) { if (int2[i] > maxI2) maxI2 = int2[i]; } }

    const rows = freqs.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f);

    const g1Porto  = portoLabel(_g1pol, _g1ei, _g1es);
    const g1Header = `Intensity<br><small style="font-weight:normal">${g1Porto}</small>`;
    const g2Header = comparisonLabel
        ? `Intensity<br><small style="font-weight:normal">${comparisonLabel}</small>`
        : 'Intensity (G2)';

    const thStyle = 'padding:10px; text-align:center; background:#2c3e50; color:white;';
    const tdStyle = 'padding:8px; text-align:center;';

    let bodyRows = rows.map(({ f, i }, rowIdx) => {
        const sym      = symLabels[i] || '?';
        const isActive = activeSym.has(sym);
        const bg       = isActive ? '#fff3f3' : (rowIdx % 2 === 0 ? '#f9f9f9' : 'white');

        const freqCell = `<td style="${tdStyle}">
            <span style="color:#3498db;text-decoration:underline;cursor:pointer;font-weight:bold;"
                  onclick="window.app.selectModeByBandIndex(${gi}, ${i})"
                  title="Visualize this phonon mode">
                ${f.toFixed(2)}
            </span>
        </td>`;

        const i1 = (int1 && int1[i] > 0 && maxI1 > 0) ? (int1[i] / maxI1).toFixed(3) : '—';
        const i2 = int2
            ? ((int2[i] > 0 && maxI2 > 0) ? (int2[i] / maxI2).toFixed(3) : '—')
            : '<span style="color:#ccc">—</span>';

        const symColor  = isActive ? '#27ae60' : '#999';
        const symWeight = isActive ? 'bold' : 'normal';
        const symCell = `<td style="${tdStyle}color:${symColor};font-weight:${symWeight};">${formatSymLabel(sym)}</td>`;

        return `<tr data-band-index="${i}" style="border-bottom:1px solid #eee; background:${bg}; transition: background 0.2s;">
            <td style="${tdStyle}">${i + 1}</td>
            ${freqCell}
            <td style="${tdStyle}">${i1}</td>
            <td style="${tdStyle}">${i2}</td>
            ${symCell}
        </tr>`;
    }).join('');

    wrapper.innerHTML = `
        <div style="max-height:400px; overflow-y:auto; margin-top:16px; border:1px solid #ccc;">
            <table style="width:100%; border-collapse:collapse; font-size:14px; font-family:sans-serif;">
                <thead style="position:sticky; top:0; z-index:10;">
                    <tr>
                        <th style="${thStyle}">Mode #</th>
                        <th style="${thStyle}">Frequency (cm⁻¹)</th>
                        <th style="${thStyle}">${g1Header}</th>
                        <th style="${thStyle}">${g2Header}</th>
                        <th style="${thStyle}">Symmetry</th>
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>`;

    return true;
}

const _origPlotRaman = p.plotRaman.bind(p);
p.plotRaman = function () {
    _origPlotRaman();

    if (!rebuildRamanTable()) {
        let tries = 0;
        const poll = setInterval(() => {
            if (rebuildRamanTable() || ++tries > 20) clearInterval(poll);
        }, 80);
    }
    setTimeout(() => {
        fixActiveModesDots();
        overlayComparisonRaman();
        setPageTitle();
    }, 0);
};

const _origSelectMode = p.selectModeByBandIndex.bind(p);

p.selectModeByBandIndex = function (gamma_index, band_index) {
    if (!d || !d.chart) {
        console.warn("Chart not ready, skipping original mode selection.");
        return; 
    }


    _origSelectMode(gamma_index, band_index);

    const phonon = p.phonon;
    if (!phonon || !phonon.eigenvalues) return;
    
    const freq = phonon.eigenvalues[gamma_index][band_index];
    const symLabels = getModeSymmetry();
    const sym = symLabels[band_index];
    const isActive = getActiveSymmetries(_g1pol, _g1ei, _g1es).has(sym);
    const modeColor = isActive ? '#e74c3c' : '#000000';

    if (d.chart.xAxis && d.chart.xAxis[0]) {
        d.chart.xAxis[0].removePlotLine('selected-mode-line');
        d.chart.xAxis[0].addPlotLine({
            id: 'selected-mode-line',
            value: freq,
            color: modeColor,
            width: 2,
            zIndex: 5
        });
    }

    const tbody = document.querySelector('#raman-table-container tbody');
    if (tbody) {
        tbody.querySelectorAll('tr').forEach(tr => tr.style.borderLeft = 'none');
        const row = tbody.querySelector(`tr[data-band-index="${band_index}"]`);
        if (row) {
            row.style.borderLeft = `5px solid ${modeColor}`;
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
};

window.app = p;

function setPageTitle() {
    const el = document.getElementById('name');
    if (el) el.innerHTML = 'Zn<sub>2</sub>Mo<sub>3</sub>O<sub>8</sub>';
}
function updateNotationDisplay(panelId, pol, ei, es) {
    const el = document.getElementById(panelId);
    if (el) el.textContent = portoLabel(pol, ei, es);
}

function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function loadGeometry1(pol, ei, es) {
    _g1pol = pol; _g1ei = ei; _g1es = es;
    const url   = makeFilename(pol, ei, es);
    const label = portoLabel(pol, ei, es);
    document.getElementById('m1-name').textContent = label;
    updateNotationDisplay('m1-notation', pol, ei, es);

    fetch(url)
        .then(res => res.json())
        .then(data => {
            g1Symmetries = data.mode_symmetry || [];
            rebuildRamanTable();
            fixActiveModesDots();
        })
        .catch(err => console.error("Could not load symmetries:", err));

    p.loadURL({ json: url, name: label });
    setTimeout(setPageTitle, 50);
}

const _loadGeometry2 = debounce(function (pol, ei, es) {
    const url   = makeFilename(pol, ei, es);
    const label = portoLabel(pol, ei, es);
    comparisonLabel = label;
    document.getElementById('m2-name').textContent = label;
    updateNotationDisplay('m2-notation', pol, ei, es);
    const phonon = new PhononJson();
    phonon.getFromURL(url, function () {
        comparisonPhonon = phonon;
        overlayComparisonRaman();
        rebuildRamanTable(); 
    });
}, 300);

function getPorto(prefix) {
    return {
        pol: document.getElementById(`${prefix}-pol`).value,
        ei:  document.getElementById(`${prefix}-ei`).value,
        es:  document.getElementById(`${prefix}-es`).value,
    };
}

function wireDropdowns() {
    ['m1-pol', 'm1-ei', 'm1-es'].forEach(id => {
        document.getElementById(id).addEventListener('change', function () {
            enforcePolConstraint('m1');
            const { pol, ei, es } = getPorto('m1');
            updateNotationDisplay('m1-notation', pol, ei, es);
            loadGeometry1(pol, ei, es);
        });
    });

    ['m2-pol', 'm2-ei', 'm2-es'].forEach(id => {
        document.getElementById(id).addEventListener('change', function () {
            enforcePolConstraint('m2');
            const { pol, ei, es } = getPorto('m2');
            updateNotationDisplay('m2-notation', pol, ei, es);
            _loadGeometry2(pol, ei, es);
        });
    });

    const toggle = document.getElementById('g2-toggle');
    if (toggle) {
        toggle.addEventListener('change', function () {
            showGeometry2 = toggle.checked;
            overlayComparisonRaman();
        });
    }
}

p.materialsIndex = [];
if (p.dom_mat) { p.dom_mat.empty(); }
if (p.dom_ref) { p.dom_ref.empty(); }

const zumbaSource = new ZumbaDB();
zumbaSource.get_materials(function (materials) {
    for (let i = 0; i < materials.length; i++) {
        p.materialsIndex.push(materials[i]);
    }
    p.renderMaterialsMenu();
    wireDropdowns();

    enforcePolConstraint('m1');
    enforcePolConstraint('m2');

    const { pol: p1, ei: e1, es: s1 } = getPorto('m1');
    updateNotationDisplay('m1-notation', p1, e1, s1);
    loadGeometry1(p1, e1, s1);

    const { pol: p2, ei: e2, es: s2 } = getPorto('m2');
    updateNotationDisplay('m2-notation', p2, e2, s2);
    _loadGeometry2(p2, e2, s2);
});