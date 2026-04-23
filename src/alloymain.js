/*
 * alloymain.js  —  entry point for alloy.html
 *
 * Mirrors main.js structure exactly (top-level execution, no document.ready
 * wrapper) so VibCrystal measures the container at the same point in the
 * page lifecycle as the original.
 *
 * Extra feature: Raman comparison overlay.
 * A second material selector lets the user pick a comparison alloy whose
 * Raman spectrum is overlaid on the primary one in a different colour.
 *
 * Place at:   phononwebsite/src/alloymain.js
 * Build to:   phononwebsite/build/alloy.min.js  (rollup.config.mjs)
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

import { AlloyDB }     from './alloydb.js';
import { PhononJson }  from './phononjson.js';
import { VibCrystal, PhononHighcharts, PhononWebpage } from './phononwebsite.js';

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
    $('#appearance_atom_list'),
    $('#displaystyle'),
    $('#atom_color_input'),
    $('#arrow_color_input'),
    $('#bond_color_input'),
    $('#bond_color_by_atom_checkbox'),
    $('#atom_radius_input'),
    $('#bond_radius_input'),
    $('#arrow_radius_input'),
    $('#bond_rules_list'),
    $('#bond_add_atom_a'),
    $('#bond_add_atom_b'),
    $('#bond_add_cutoff_input'),
    $('#bond_add_button'),
    $('#appearance_reset_atom_button'),
    $('#appearance_reset_bonds_button'),
    $('#appearance_reset_vectors_button'),
);

v.setAppearanceUpdatedCallback(() => p.refreshAppearanceUI());

if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
}

let comparisonPhonon = null;
let comparisonName   = null;

function computeRamanSeries(phonon) {
    if (!phonon || !phonon.raman_intensities) return null;

    const gamma_idx   = phonon.gamma_index || 0;
    const frequencies = phonon.eigenvalues[gamma_idx];
    const intensities = phonon.raman_intensities;
    const gamma       = 2.0;
    const maxFreq     = Math.max(...frequencies) + 50;
    let maxI = 0;
    for (let i = 0; i < frequencies.length; i++) {
        if (intensities[i] <= 0) continue;
        let I = 0;
        for (let j = 0; j < frequencies.length; j++) {
            if (intensities[j] > 0) {
                const dw = frequencies[i] - frequencies[j];
                I += intensities[j] * (gamma * gamma) / (dw * dw + gamma * gamma);
            }
        }
        if (I > maxI) maxI = I;
    }
    if (maxI === 0) return null;

    const data = [];
    for (let w = 0; w < maxFreq; w += 1) {
        let I = 0;
        for (let i = 0; i < frequencies.length; i++) {
            if (intensities[i] > 0) {
                const dw = w - frequencies[i];
                I += intensities[i] * (gamma * gamma) / (dw * dw + gamma * gamma);
            }
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

    // Remove any existing comparison series
    let existing = chart.series.find(s => s.name && s.name.startsWith('Compare:'));
    if (existing) existing.remove(false);

    if (!comparisonPhonon) {
        chart.redraw();
        return;
    }

    const seriesData = computeRamanSeries(comparisonPhonon);
    if (!seriesData) {
        chart.redraw();
        return;
    }

    chart.addSeries({
        name:   'Compare: ' + (comparisonName || 'Alloy 2'),
        type:   'line',
        data:   seriesData,
        color:  '#e67e22',     
        dashStyle: 'ShortDash',
        marker: { enabled: false },
        enableMouseTracking: false,
    }, true);
}

const _originalPlotRaman = p.plotRaman.bind(p);
p.plotRaman = function() {
    _originalPlotRaman();
    setTimeout(overlayComparisonRaman, 0);
};

function loadComparisonAlloy(url, name) {
    if (!url) {
        comparisonPhonon = null;
        comparisonName   = null;
        overlayComparisonRaman();
        updateClearButton();
        return;
    }

    const phonon = new PhononJson();
    phonon.getFromURL(url, function() {
        comparisonPhonon = phonon;
        comparisonName   = name;
        overlayComparisonRaman();
        updateClearButton();
    });
}

function updateClearButton() {
    const btn = document.getElementById('compare-clear');
    if (!btn) return;
    btn.style.display = comparisonPhonon ? 'inline-block' : 'none';
}

function buildCompareSelector(materials) {
    const sel = document.getElementById('compare-select');
    if (!sel) return;

    while (sel.options.length > 1) sel.remove(1);

    materials.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value       = m.url;
        opt.textContent = m.name;
        opt.dataset.name = m.name;
        sel.appendChild(opt);
    });

    sel.onchange = function() {
        const url  = sel.value;
        const name = sel.options[sel.selectedIndex].dataset.name || url;
        if (!url) {
            loadComparisonAlloy(null, null);
        } else {
            loadComparisonAlloy(url, name);
        }
    };
}

document.getElementById('compare-clear').addEventListener('click', function() {
    document.getElementById('compare-select').value = '';
    loadComparisonAlloy(null, null);
});

p.materialsIndex = [];
if (p.dom_mat) { p.dom_mat.empty(); }
if (p.dom_ref) { p.dom_ref.empty(); }

const alloySource = new AlloyDB();
alloySource.get_materials(function(materials) {
    for (let i = 0; i < materials.length; i++) {
        p.materialsIndex.push(materials[i]);
    }
    p.renderMaterialsMenu();
    buildCompareSelector(materials);  
});

p.getUrlVars({});