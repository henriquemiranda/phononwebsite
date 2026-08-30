/*
 * alloymain.js  —  entry point for alloy.html
 *
 * Mirrors main.js top-level structure. Loads two small end-member
 * "runtime dynamical matrix" payloads (pure BaZrS3 and pure BaZrSe3,
 * parsed from QE .dyn files by generate_alloy_endmembers.py) and mixes
 * them live in the browser as the x/m sliders move -- see src/alloymix.js.
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
import { buildMixedInternalJson } from './alloymix.js';

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

function loadMixed(x, m) {
    if (!endmemberS || !endmemberSe) return;

    document.getElementById('alloy-name').innerHTML = formatNameHTML(x, m);
    document.getElementById('name').innerHTML = formatNameHTML(x, m);

    const mixedData = buildMixedInternalJson(endmemberS, endmemberSe, x, m);

    p.k = 0;
    p.n = 0;
    delete p.link;
    p.phonon = new PhononJson();
    p.phonon.getFromInternalJson(mixedData, () => p.loadCallback());
}

function wireSliders() {
    const xSlider = document.getElementById('x-slider');
    const mSlider = document.getElementById('m-slider');

    function onChange() {
        const x = parseFloat(xSlider.value);
        const m = parseFloat(mSlider.value);
        document.getElementById('x-val').textContent = x.toFixed(2);
        document.getElementById('m-val').textContent = m.toFixed(2);
        loadMixed(x, m);
    }

    xSlider.addEventListener('input', onChange);
    mSlider.addEventListener('input', onChange);
}

Promise.all([
    fetch('alloydb/bazrs3.json').then((r) => r.json()),
    fetch('alloydb/bazrse3.json').then((r) => r.json()),
]).then(([s, se]) => {
    endmemberS = s;
    endmemberSe = se;
    wireSliders();
    loadMixed(0, 32.06);
}).catch((err) => {
    console.error('AlloyMain: could not load end-member payloads:', err);
});
