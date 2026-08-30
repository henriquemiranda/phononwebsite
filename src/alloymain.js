/*
 * alloymain.js  —  entry point for alloy.html
 *
 * Mirrors main.js top-level structure. Loads two small end-member
 * "runtime dynamical matrix" payloads (pure BaZrS3 and pure BaZrSe3,
 * parsed from QE .dyn files by generate_alloy_endmembers.py) and mixes
 * them live in the browser as the x/m sliders move -- see src/alloymix.js.
 *
 * Material 1's sliders drive the 3D animation + frequency axis + Raman
 * spectrum/table (via the shared plotRaman() from the raman feature).
 * Material 2's sliders drive an independent Raman-curve-only overlay for
 * comparison -- it never touches the 3D view or mode selection.
 *
 * Place at:   phononwebsite/src/alloymain.js
 * Build to:   phononwebsite/build/alloy.js
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

import { PhononJson } from './phononjson.js';
import { VibCrystal, PhononHighcharts, PhononWebpage } from './phononwebsite.js';
import { solveHermitianEigenSystem } from './dynamicalmatrix.js';
import { buildMixedInternalJson, computeMixedRamanIntensities } from './alloymix.js';

const v = new VibCrystal($('#vibcrystal'));
const d = new PhononHighcharts($('#highcharts'));
const p = new PhononWebpage(v, d);

p.setRepetitionsInput(     $('#nx'), $('#ny'), $('#nz') );
p.setModeSelectionInput(   $('#kindex'), $('#nindex'), $('#modeselect') );
p.setModeWeightsToggle(    $('#mode_weights_plot') );
p.setUpdateButton(         $('#update')           );
p.setAtomPositions(        $('#atompos')          );
p.setLattice(              $('#lattice')          );
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

function formatNameHTML(x, m) {
    const s = (1 - x).toFixed(2);
    const se = x.toFixed(2);
    return `BaZr(S<sub>${s}</sub>Se<sub>${se}</sub>)<sub>3</sub><sup>m=${m.toFixed(2)}</sup>`;
}

let endmemberS = null;
let endmemberSe = null;

// Lorentzian-broadened Raman curve for an independent set of frequencies/
// activities, in the same raw (unnormalized) units plotRaman() uses for its
// main "Spectrum" series -- both materials' curves are directly comparable
// since Raman activity here is a genuine physical quantity (A^4/amu-derived),
// not per-material-normalized.
function computeRamanCurve(frequencies, activities) {
    if (!activities || !activities.some((v) => v > 0)) return null;
    const gamma = 2.0;
    const maxFreq = Math.max(...frequencies) + 50;
    const data = [];
    for (let w = 0; w < maxFreq; w += 1) {
        let total = 0;
        for (let i = 0; i < frequencies.length; i++) {
            if (activities[i] > 0) {
                const dw = w - frequencies[i];
                total += activities[i] * (gamma * gamma) / (dw * dw + gamma * gamma);
            }
        }
        data.push([w, total]);
    }
    return data;
}

let comparisonCurve = null;
let comparisonLabel = null;

function overlayComparisonRaman() {
    if (typeof Highcharts === 'undefined') return;
    const chart = Highcharts.charts.find(
        (c) => c && c.renderTo && c.renderTo.id === 'raman-spectrum'
    );
    if (!chart) return;

    const old = chart.series.find((s) => s.options._isComparison);
    if (old) old.remove(false);

    if (!comparisonCurve) { chart.redraw(); return; }

    chart.addSeries({
        _isComparison: true,
        name: 'Material 2: ' + (comparisonLabel || ''),
        type: 'line',
        data: comparisonCurve,
        color: '#e67e22',
        dashStyle: 'ShortDash',
        marker: { enabled: false },
        enableMouseTracking: false,
    }, true);
}

const _origPlotRaman = p.plotRaman.bind(p);
p.plotRaman = function() {
    _origPlotRaman();
    setTimeout(() => overlayComparisonRaman(), 0);
};

let requestId = 0;
let requestId2 = 0;

async function loadMixed(x, m) {
    if (!endmemberS || !endmemberSe) return;
    const thisRequest = ++requestId;

    document.getElementById('alloy-name').innerHTML = formatNameHTML(x, m);
    document.getElementById('name').innerHTML = formatNameHTML(x, m);

    const mixedData = buildMixedInternalJson(endmemberS, endmemberSe, x, m);

    const { eigenvectors } = await solveHermitianEigenSystem(mixedData.dynamical_matrix, [0, 0, 0]);
    const activities = computeMixedRamanIntensities(endmemberS, endmemberSe, x, m, eigenvectors);
    if (thisRequest !== requestId) return;

    p.k = 0;
    p.n = 0;
    delete p.link;
    p.phonon = new PhononJson();
    p.phonon.getFromInternalJson(mixedData, () => {
        if (thisRequest !== requestId) return;
        if (activities) {
            p.phonon.raman_intensities = activities;
            p.phonon.gamma_index = 0;
        }
        p.loadCallback();
    });
}

async function loadComparison(x2, m2) {
    if (!endmemberS || !endmemberSe) return;
    const thisRequest = ++requestId2;

    comparisonLabel = formatNameHTML(x2, m2).replace(/<[^>]+>/g, '');
    document.getElementById('alloy2-name').innerHTML = formatNameHTML(x2, m2);

    const mixedData = buildMixedInternalJson(endmemberS, endmemberSe, x2, m2);
    const { eigenvectors, eigenvaluesCm1 } = await solveHermitianEigenSystem(
        mixedData.dynamical_matrix, [0, 0, 0]
    );
    const activities = computeMixedRamanIntensities(endmemberS, endmemberSe, x2, m2, eigenvectors);
    if (thisRequest !== requestId2) return;

    comparisonCurve = computeRamanCurve(eigenvaluesCm1, activities);
    overlayComparisonRaman();
}

function wireSliders() {
    const xSlider = document.getElementById('x-slider');
    const mSlider = document.getElementById('m-slider');
    const x2Slider = document.getElementById('x2-slider');
    const m2Slider = document.getElementById('m2-slider');

    function onChange() {
        const x = parseFloat(xSlider.value);
        const m = parseFloat(mSlider.value);
        document.getElementById('x-val').textContent = x.toFixed(2);
        document.getElementById('m-val').textContent = m.toFixed(2);
        loadMixed(x, m);
    }

    function onChange2() {
        const x2 = parseFloat(x2Slider.value);
        const m2 = parseFloat(m2Slider.value);
        document.getElementById('x2-val').textContent = x2.toFixed(2);
        document.getElementById('m2-val').textContent = m2.toFixed(2);
        loadComparison(x2, m2);
    }

    xSlider.addEventListener('input', onChange);
    mSlider.addEventListener('input', onChange);
    x2Slider.addEventListener('input', onChange2);
    m2Slider.addEventListener('input', onChange2);
}

Promise.all([
    fetch('alloydb/bazrs3.json').then((r) => r.json()),
    fetch('alloydb/bazrse3.json').then((r) => r.json()),
]).then(([s, se]) => {
    endmemberS = s;
    endmemberSe = se;
    wireSliders();
    loadMixed(0, 32.06);
    loadComparison(1, 78.97);
}).catch((err) => {
    console.error('AlloyMain: could not load end-member payloads:', err);
});
