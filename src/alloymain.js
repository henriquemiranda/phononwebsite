/*
 * alloymain.js  —  entry point for alloy.html
 *
 * Mirrors main.js top-level structure exactly.
 * Material selection via 4 sliders (x and m for each of 2 alloys).
 * Material 2 Raman spectrum is overlaid on Material 1's chart.
 *
 * Place at:   phononwebsite/src/alloymain.js
 * Build to:   phononwebsite/build/alloy.min.js
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


import { AlloyDB }    from './alloydb.js';
import { PhononJson } from './phononjson.js';
import { VibCrystal, PhononHighcharts, PhononWebpage } from './phononwebsite.js';


const X_VALUES = Array.from({length: 21}, (_, i) => (i * 0.05).toFixed(2));


const M_VALUES = [
    '32.06','34.41','36.75','39.10','41.44','43.79','46.13','48.48',
    '50.82','53.17','55.52','57.86','60.21','62.55','64.90','67.24',
    '69.59','71.93','74.28','76.62','78.97'
];

function makeFilename(x, m) {
    return `alloydb/BaZr_x_${x}_m_${m}.json`;
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

function computeRamanCurve(phonon) {
    if (!phonon || !phonon.raman_intensities) return null;
    const gi  = phonon.gamma_index || 0;
    const frq = phonon.eigenvalues[gi];
    const int = phonon.raman_intensities;
    const g   = 2.0;
    const maxF = Math.max(...frq) + 50;

    let maxI = 0;
    for (let i = 0; i < frq.length; i++) {
        if (int[i] <= 0) continue;
        let I = 0;
        for (let j = 0; j < frq.length; j++) {
            if (int[j] > 0) { const dw = frq[i]-frq[j]; I += int[j]*g*g/(dw*dw+g*g); }
        }
        if (I > maxI) maxI = I;
    }
    if (maxI === 0) return null;

    const data = [];
    for (let w = 0; w < maxF; w++) {
        let I = 0;
        for (let i = 0; i < frq.length; i++) {
            if (int[i] > 0) { const dw = w-frq[i]; I += int[i]*g*g/(dw*dw+g*g); }
        }
        data.push([w, I / maxI]);
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

    if (!comparisonPhonon) { chart.redraw(); return; }

    const data = computeRamanCurve(comparisonPhonon);
    if (!data)  { chart.redraw(); return; }

    chart.addSeries({
        _isComparison: true,
        name:      'Material 2: ' + (comparisonLabel || ''),
        type:      'line',
        data:      data,
        color:     '#e67e22',
        dashStyle: 'ShortDash',
        marker:    { enabled: false },
        enableMouseTracking: false,
    }, true);
}

const _origPlotRaman = p.plotRaman.bind(p);
p.plotRaman = function() {
    _origPlotRaman();
    setTimeout(() => {
        overlayComparisonRaman();
        updateChartTitle(_m1x, _m1m);
        setPageTitle(_m1x, _m1m);
    }, 0);
};

function xVal(idx)  { return X_VALUES[idx]; }
function mVal(idx)  { return M_VALUES[idx]; }

function debounce(fn, ms) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}


function updateLabel(valEl, text) {
    document.getElementById(valEl).textContent = text;
}

function formatNameHTML(x, m) {
    const xf = parseFloat(x);
    const s  = (1 - xf).toFixed(2);
    const se = xf.toFixed(2);
    return `BaZr(S<sub>${s}</sub>Se<sub>${se}</sub>)<sub>3</sub><sup>${m}</sup>`;
}


function formatNameChart2(x, m) {
    const xf = parseFloat(x);
    const s  = (1 - xf).toFixed(2);
    const se = xf.toFixed(2);
    return `Raman Spectrum`;
}


function setPageTitle(x, m) {
    const el = document.getElementById('name');
    if (el) el.innerHTML = formatNameHTML(x, m);
}


function updateChartTitle(x, m) {
    if (typeof Highcharts === 'undefined') return;
    const chart = Highcharts.charts.find(
        c => c && c.renderTo && c.renderTo.id === 'raman-spectrum'
    );
    if (chart) chart.setTitle({ text: formatNameChart2(x, m) });
}


let _m1x = '0.00', _m1m = '32.06';

function loadMaterial1(xIdx, mIdx) {
    const x    = xVal(xIdx);
    const m    = mVal(mIdx);
    _m1x = x; _m1m = m;
    const url  = makeFilename(x, m);
    const html = formatNameHTML(x, m);
    const plain = formatNameChart2(x, m);
    document.getElementById('m1-name').innerHTML = html;
    p.loadURL({ json: url, name: plain });
    setTimeout(() => setPageTitle(x, m), 50);
}


const _loadMat2 = debounce(function(xIdx, mIdx) {
    const x   = xVal(xIdx);
    const m   = mVal(mIdx);
    const url = makeFilename(x, m);
    comparisonLabel = formatNameChart2(x, m);
    document.getElementById('m2-name').innerHTML = formatNameHTML(x, m);

    const phonon = new PhononJson();
    phonon.getFromURL(url, function() {
        comparisonPhonon = phonon;
        overlayComparisonRaman();
    });
}, 300);


function wireSliders() {
    const m1x = document.getElementById('m1-x-slider');
    const m1m = document.getElementById('m1-m-slider');
    const m2x = document.getElementById('m2-x-slider');
    const m2m = document.getElementById('m2-m-slider');

    function onM1Change() {
        updateLabel('m1-x-val', xVal(+m1x.value));
        updateLabel('m1-m-val', mVal(+m1m.value));
        loadMaterial1(+m1x.value, +m1m.value);
    }
    function onM2Change() {
        updateLabel('m2-x-val', xVal(+m2x.value));
        updateLabel('m2-m-val', mVal(+m2m.value));
        _loadMat2(+m2x.value, +m2m.value);
    }

    m1x.addEventListener('input', onM1Change);
    m1m.addEventListener('input', onM1Change);
    m2x.addEventListener('input', onM2Change);
    m2m.addEventListener('input', onM2Change);
}


p.materialsIndex = [];
if (p.dom_mat) { p.dom_mat.empty(); }
if (p.dom_ref) { p.dom_ref.empty(); }

const alloySource = new AlloyDB();
alloySource.get_materials(function(materials) {
    for (let i = 0; i < materials.length; i++) {
        p.materialsIndex.push(materials[i]);
    }

    p.renderMaterialsMenu();

    wireSliders();

    loadMaterial1(0, 0);
});