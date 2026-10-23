/*
 * cuvacmain.js  —  entry point for cuvac.html
 *
 * Γ-only phonons of a Cu vacancy (q=-1) in a 287-atom CuInSe2 supercell.
 * With 861 modes the dispersion plot is a dense stack of flat lines, so the
 * left column carries a clickable mode table (same style as the ZMO/alloy
 * Raman tables) that selects a mode for the animation directly.
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

import { VibCrystal, PhononHighcharts, PhononWebpage } from './phononwebsite.js';

const DATA_URL = 'defectdb/Cu_vac_q-1_PBE_gamma.json.gz';
const TITLE_HTML = 'V<sub>Cu</sub><sup>−1</sup> in CuInSe<sub>2</sub> (287 atoms, PBE, Γ)';

const v = new VibCrystal($('#vibcrystal'));
const d = new PhononHighcharts($('#highcharts'));
const p = new PhononWebpage(v, d);

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

const MODE_K = 0;

function buildModeTable() {
    const wrapper = document.getElementById('mode-table-container');
    const phonon = p.phonon;
    if (!wrapper || !phonon || !phonon.eigenvalues) return;

    const freqs = phonon.eigenvalues[MODE_K];
    const rows = freqs.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f);

    const bodyRows = rows.map(({ f, i }, order) =>
        `<tr data-band-index="${i}" data-freq="${f}" title="Visualize this phonon mode">
            <td>${order + 1}</td>
            <td><span class="freq">${f.toFixed(2)}</span></td>
        </tr>`
    ).join('');

    wrapper.innerHTML = `
        <table id="mode-table">
            <thead>
                <tr>
                    <th>Mode #</th>
                    <th>Frequency (cm⁻¹)</th>
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>`;

    wrapper.querySelector('tbody').addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-band-index]');
        if (row) p.selectModeByBandIndex(MODE_K, parseInt(row.dataset.bandIndex, 10));
    });

    applyModeFilter();
    highlightModeRow(p.n);
}

function highlightModeRow(bandIndex) {
    const tbody = document.querySelector('#mode-table tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
    const row = tbody.querySelector(`tr[data-band-index="${bandIndex}"]`);
    if (row) {
        row.classList.add('selected');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Typing a frequency keeps only the rows whose value starts with it
// (e.g. "15" -> 15.xx, 150.xx, 151.xx ...).
function applyModeFilter() {
    const input = document.getElementById('mode-filter');
    const query = input ? input.value.trim() : '';
    document.querySelectorAll('#mode-table tbody tr').forEach(tr => {
        const text = parseFloat(tr.dataset.freq).toFixed(2);
        tr.style.display = (!query || text.startsWith(query)) ? '' : 'none';
    });
}

const _origSelectMode = p.selectModeByBandIndex.bind(p);
p.selectModeByBandIndex = function (k, n, syncChart = true) {
    _origSelectMode(k, n, syncChart);
    if (p.k === MODE_K) highlightModeRow(p.n);
};

document.getElementById('mode-filter').addEventListener('input', applyModeFilter);

// Rebuild the table for any load, including a custom file from the menu.
let showingDefaultData = true;
$('#file-input').on('change', () => { showingDefaultData = false; });

const _origLoadCallback = p.loadCallback.bind(p);
p.loadCallback = function () {
    _origLoadCallback();
    if (showingDefaultData) document.getElementById('name').innerHTML = TITLE_HTML;
    buildModeTable();
};

window.app = p;

p.loadURL({ json: DATA_URL, name: 'Cu vacancy' });
