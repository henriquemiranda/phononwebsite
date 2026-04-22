import { LocalDB } from './localdb.js';
import { ContribDB } from './contribdb.js';
import { MaterialsProjectDB } from './mpdb.js';
import { LocalPhononDB } from './localphonondb.js';
import { PhononJson } from './phononjson.js';
import { PhononYaml } from './phononyaml.js';
import { exportXSF, exportPOSCAR }  from './exportfiles.js';
import * as atomic_data from './atomic_data.js';
import * as mat from './mat.js';
import * as utils from './utils.js';
import { atomColorHexToCss, getAtomBadgeTextColor } from './atomcolors.js';
import { renderLatticeTable, renderAtomPositionsTable } from './structureinfo.js';

export class PhononWebpage {

    constructor(visualizer, dispersion) {
        this.k = 0;
        this.n = 0;
        this.nx = 1;
        this.ny = 1;
        this.nz = 1;

        //select visualization
        this.visualizer = visualizer;

        //select dispersion
        this.dispersion = dispersion;

        //bind some functions (TODO: improve this)
        this.exportXSF    = exportXSF.bind(this);
        this.exportPOSCAR = exportPOSCAR.bind(this);

        //bind click event from highcharts with action
        dispersion.setClickEvent(this);

        this.showModeWeightsOnPlot = false;
        this.materialFilterQuery = '';
        this.materialsIndex = [];
        this.disabledReferenceKeys = new Set();
        this.loadingState = null;
    }

    getModeMaxDisplacementNorm() {
        if (!this.phonon || typeof this.phonon.ensureQpointEigenvectors === 'function') {
            this.phonon && this.phonon.ensureQpointEigenvectors(this.k);
        }
        if (!this.phonon || !this.phonon.vec || !this.phonon.vec[this.k] || !this.phonon.vec[this.k][this.n]) {
            return 0;
        }

        let mode = this.phonon.vec[this.k][this.n];
        let maxNorm = 0;
        for (let i=0; i<mode.length; i++) {
            let atomNormSq = 0;
            for (let axis=0; axis<3; axis++) {
                let component = mode[i][axis];
                atomNormSq += component[0] * component[0] + component[1] * component[1];
            }
            maxNorm = Math.max(maxNorm, Math.sqrt(atomNormSq));
        }
        return maxNorm;
    }

    getZeroPointAmplitudeAngstrom() {
        if (!this.phonon || this.phonon.mode_amplitude_convention !== 'avg-mass-normalized') {
            return null;
        }

        let avgMassAmu = Number(this.phonon.average_mass);
        let frequencyCm1 = this.phonon.eigenvalues && this.phonon.eigenvalues[this.k]
            ? Number(this.phonon.eigenvalues[this.k][this.n])
            : NaN;

        if (!Number.isFinite(avgMassAmu) || avgMassAmu <= 0 || !Number.isFinite(frequencyCm1) || frequencyCm1 <= 0) {
            return null;
        }

        let hbar = 1.054571817e-34;
        let amu = 1.66053906660e-27;
        let speedOfLight = 299792458;
        let omega = 2.0 * Math.PI * speedOfLight * 100.0 * frequencyCm1;
        let avgMassKg = avgMassAmu * amu;
        let displacementMeters = Math.sqrt(hbar / (2.0 * avgMassKg * omega));
        return displacementMeters / 1.0e-10;
    }

    getRecommendedMotionScaleAngstrom() {
        let maxNorm = this.getModeMaxDisplacementNorm();
        if (!(maxNorm > 0)) {
            return 0.2;
        }

        let zeroPointAmplitude = this.getZeroPointAmplitudeAngstrom();
        let visibleTarget = 0.14;
        if (this.phonon && Number.isFinite(this.phonon.nndist) && this.phonon.nndist > 0) {
            visibleTarget = Math.max(0.08, Math.min(0.22, this.phonon.nndist * 0.12));
        }

        let visibilityAmplitude = visibleTarget / maxNorm;
        let recommended = zeroPointAmplitude !== null
            ? Math.max(zeroPointAmplitude, visibilityAmplitude)
            : visibilityAmplitude;

        return Math.max(0.02, Math.min(5.0, recommended));
    }

    getRecommendedVectorScaleAngstrom() {
        let maxNorm = this.getModeMaxDisplacementNorm();
        if (!(maxNorm > 0)) {
            return 0.9;
        }

        let visibleTarget = 0.7;
        if (this.phonon && Number.isFinite(this.phonon.nndist) && this.phonon.nndist > 0) {
            visibleTarget = Math.max(0.4, Math.min(1.2, this.phonon.nndist * 0.45));
        }

        return Math.max(0.15, Math.min(5.0, visibleTarget / maxNorm));
    }

    syncVisualizerModeScaleDefaults(force = false) {
        if (!this.visualizer || typeof this.visualizer.syncModeScaleDefaults !== 'function') {
            return;
        }
        this.visualizer.syncModeScaleDefaults(
            this.getRecommendedMotionScaleAngstrom(),
            this.getRecommendedVectorScaleAngstrom(),
            force
        );
    }

    //functions to link the DOM buttons with this class
    setMaterialsList(dom_mat)      { this.dom_mat = dom_mat; }
    setMaterialsFilterInput(dom_input) {
        this.dom_material_filter = dom_input;
        this.materialFilterQuery = '';
        this.materialsIndex = [];
        if (!dom_input || !dom_input.length) {
            return;
        }

        dom_input.on('input', () => {
            this.materialFilterQuery = dom_input.val() || '';
            this.renderMaterialsMenu();
        });
    }
    setReferencesList(dom_ref)     { this.dom_ref = dom_ref; }
    setAtomPositions(dom_atompos)  { this.dom_atompos = dom_atompos; }
    setLattice(dom_lattice)        { this.dom_lattice = dom_lattice; }
    setTitle(dom_title)            { this.dom_title = dom_title; }

    setUpdateButton(dom_button) {
        self = this;
        dom_button.click( function() { self.update(); } );
    }

    setExportXSFButton(dom_button) {
        dom_button.click(this.exportXSF.bind(this));
    }

    setExportPOSCARButton(dom_button) {
        dom_button.click(this.exportPOSCAR.bind(this));
    }

    setRepetitionsInput(dom_nx,dom_ny,dom_nz) {

        this.dom_nx = dom_nx;
        this.dom_ny = dom_ny;
        this.dom_nz = dom_nz;

        function keyup(event) {
            if(event.keyCode == 13) {
                this.update(false);
            }
        }

        dom_nx.keyup( keyup.bind(this) );
        dom_ny.keyup( keyup.bind(this) );
        dom_nz.keyup( keyup.bind(this) );
    }

    setModeSelectionInput(dom_k, dom_n, dom_button) {
        this.dom_k = dom_k;
        this.dom_n = dom_n;
        this.dom_mode_button = dom_button;

        function keyup(event) {
            if(event.keyCode == 13) {
                this.selectModeFromInputs();
            }
        }

        if (this.dom_k) { this.dom_k.keyup( keyup.bind(this) ); }
        if (this.dom_n) { this.dom_n.keyup( keyup.bind(this) ); }
        if (this.dom_mode_button) { this.dom_mode_button.click( this.selectModeFromInputs.bind(this) ); }
    }

    setModeWeightsToggle(dom_checkbox) {
        this.dom_mode_weights_toggle = dom_checkbox;
        if (!dom_checkbox || !dom_checkbox.length) {
            return;
        }

        dom_checkbox.prop('checked', this.showModeWeightsOnPlot);
        dom_checkbox.on('change', () => {
            this.showModeWeightsOnPlot = !!dom_checkbox.prop('checked');
            this.runWithProgressFeedback(() => {
                this.refreshDispersionAppearance();
            });
        });
    }

    setFileInput(dom_input) {
        /* Load a custom file button
        */
        dom_input.change( this.loadCustomFile.bind(this) );
        dom_input.click( function() { this.value = '';} );
    }

    loadCustomFile(event) {
        /*
        find the type of file and call the corresponding function to read it

        two formats available:
            1. band.yaml generated with phonopy with eigenvectors
            2. internal .json format description available in
            http://henriquemiranda.github.io/phononwebsite/
            3. pymatgen phononBS format
        */
        this.k = 0;
        this.n = 0;
        self = this;

        function set_name() {
            delete self.link;
            self.name = utils.format_formula_html(self.phonon.name);
            self.loadCallback();
        }

        let file = event.target.files[0];
        if (file.name.indexOf(".yaml") > -1) {
            this.phonon = new PhononYaml();
            this.phonon.getFromFile(file, set_name );
         }
        else if (file.name.indexOf(".json") > -1) {
            this.phonon = new PhononJson();
            this.phonon.getFromFile(file, set_name );
        }
        else {
            alert("Ivalid file");
        }
    }

    loadURL(url_vars,callback) {
        /*
        load file from post request in the url
        */

        this.k = 0;
        this.n = 0;
        delete this.link;
        if (callback == null) {
            callback = this.loadCallback.bind(this);
        }

        let targetName = ("name" in url_vars) ? url_vars.name : this.name;
        this.startLoadingFeedback(targetName);

        let wrappedCallback = function() {
            this.finishLoadingFeedback();
            callback();
        }.bind(this);

        let hooks = {
            onStart: function() {
                this.updateLoadingFeedback();
            }.bind(this),
            onProgress: function(progress) {
                this.updateLoadingFeedback(progress);
            }.bind(this),
            onComputeProgress: function(progress) {
                this.updateLoadingFeedback(progress);
            }.bind(this),
            onError: function(error) {
                this.failLoadingFeedback(error);
            }.bind(this),
            onFinish: function() {
                if (this.loadingState && this.loadingState.status === 'loading') {
                    this.updateLoadingFeedback();
                }
            }.bind(this)
        };

        if ( "name" in url_vars ) {
            this.name = url_vars.name;
        }
        if ( "link" in url_vars ) {
            this.link = url_vars.link;
        }

        if ("yaml" in url_vars) {
            this.phonon = new PhononYaml();
            this.phonon.getFromURL(url_vars.yaml,wrappedCallback);
        }
        else if ("json" in url_vars) {
            this.phonon = new PhononJson();
            this.phonon.getFromURL(url_vars.json,wrappedCallback,hooks);
        }
        else {
            //alert("Ivalid url");
        }
    }

    startLoadingFeedback(label) {
        this.loadingState = {
            label: label || 'Material',
            status: 'loading',
            progress: null
        };
        this.updateLoadingFeedback();
    }

    updateLoadingFeedback(progressInfo) {
        if (!this.loadingState) {
            return;
        }

        if (progressInfo && progressInfo.total) {
            let ratio = Math.max(0, Math.min(1, progressInfo.loaded / progressInfo.total));
            this.loadingState.progress = progressInfo.phase === 'compute'
                ? 0.7 + 0.3 * ratio
                : 0.7 * ratio;
        } else if (progressInfo && progressInfo.loaded && !progressInfo.total) {
            this.loadingState.progress = null;
        }

        let progressPercent = this.loadingState.progress;
        let barWidth = progressPercent !== null && progressPercent !== undefined
            ? (progressPercent * 100) + '%'
            : '35%';
        let progress = document.getElementById('progress');
        if (progress) {
            progress.style.width = barWidth;
        }
    }

    finishLoadingFeedback() {
        this.loadingState = null;
        let progress = document.getElementById('progress');
        if (progress) {
            progress.style.width = '0%';
        }
    }

    failLoadingFeedback(error) {
        let message = error && error.message ? error.message : 'Unable to load phonon data.';
        this.finishLoadingFeedback();
        PhononJson.showCompressedLoadError(message);
    }

    runWithProgressFeedback(work) {
        let progress = document.getElementById('progress');
        if (!progress) {
            work();
            return;
        }

        progress.style.width = '28%';
        requestAnimationFrame(() => {
            progress.style.width = '68%';
            requestAnimationFrame(() => {
                try {
                    work();
                } finally {
                    progress.style.width = '100%';
                    window.setTimeout(() => {
                        if (!this.loadingState) {
                            progress.style.width = '0%';
                        }
                    }, 140);
                }
            });
        });
    }

    getUrlVars(default_vars) {
        /*
        get variables from the url
        from http://stackoverflow.com/questions/4656843/jquery-get-querystring-from-url

        currently the possible options are:
            json : load a json file from location
            yaml : load a yaml file from location
            name : change the display name of the material
        */
        let hash;
        let vars = {};

        if (location.search) {
            let hashes = location.search.slice(1).split('&');
            for(let i = 0; i < hashes.length; i++) {
                hash = hashes[i].split('=');
                vars[hash[0]] = hash[1];
            }
        }

        //if no argument is present use the default vars
        if (Object.keys(vars).length < 1) {
            vars = default_vars;
        }

        this.loadURL(vars);
    }

    loadCallback() {
        /*
        Fuunction to be called once the file is loaded
        */
        this.name = utils.format_formula_html(this.phonon.name);
        if (this.visualizer) {
            this.visualizer.modeScaleAutoInitialized = false;
        }
        this.setRepetitions(this.phonon.repetitions);
        this.updateModeSelectionInputs();
        if (!this.enforceVisualizationLimits(true)) {
            return;
        }
        this.update();
    }

    getRepetitions() {
        /*
        read the number of repetitions in each direction and update it
        */
        if (this.dom_nx) { this.nx = this.dom_nx.val(); }
        if (this.dom_ny) { this.ny = this.dom_ny.val(); }
        if (this.dom_nz) { this.nz = this.dom_nz.val(); }
    }

    setRepetitions(repetitions) {
        /*
        set the number of repetitions on the interface
        */

        if (repetitions) {
            this.nx = repetitions[0];
            this.ny = repetitions[1];
            this.nz = repetitions[2];
        }

        if (this.dom_nx) { this.dom_nx.val(this.nx); }
        if (this.dom_ny) { this.dom_ny.val(this.ny); }
        if (this.dom_nz) { this.dom_nz.val(this.nz); }
    }

    getStructure(nx,ny,nz) {
        let lat = this.phonon.lat;
        let apc = this.phonon.atom_pos_car;
        let atoms = [];

        for (let ix=0;ix<nx;ix++) {
            for (let iy=0;iy<ny;iy++) {
                for (let iz=0;iz<nz;iz++) {
                    for (let i=0;i<this.phonon.natoms;i++) {

                        //postions of the atoms
                        let x = apc[i][0] + ix*lat[0][0] + iy*lat[1][0] + iz*lat[2][0];
                        let y = apc[i][1] + ix*lat[0][1] + iy*lat[1][1] + iz*lat[2][1];
                        let z = apc[i][2] + ix*lat[0][2] + iy*lat[1][2] + iz*lat[2][2];

                        atoms.push( [i,x,y,z] );
                    }
                }
            }
        }

        return atoms;
    }

    getBondingDistance() {
        /*
        replicate the unit cell two times in each direction
        and clauclate the minimum bonding distance
        */
        let atoms = this.getStructure(2,2,2);

        let combinations = utils.getCombinations( atoms );
        let min = 1e9;
        for (let i=0; i<combinations.length; i++ ) {
            let a = combinations[i][0];
            let b = combinations[i][1];

            let dist = mat.distance(a.slice(1),b.slice(1));
            if (min > dist) {
                min = dist;
            }
        }
        return min;
    }

    getVibrations(nx,ny,nz) {
        /*
        Calculate the vibration patterns for all the atoms
        */
        let phonon = this.phonon;
        if (phonon && typeof phonon.ensureQpointEigenvectors === 'function') {
            phonon.ensureQpointEigenvectors(this.k);
        }
        let veckn = phonon.vec[this.k][this.n];
        let vibrations = [];
        let kpt = phonon.kpoints[this.k];

        //additional phase if necessary
        let atom_phase = [];
        if (phonon.addatomphase) {
            for (let i=0; i<phonon.natoms; i++) {
                let phase = mat.vec_dot(kpt,phonon.atom_pos_red[i]);
                atom_phase.push(phase);
            }
        }
        else {
            for (let i=0; i<phonon.natoms; i++) {
                atom_phase.push(0);
            }
        }

        for (let ix=0; ix<nx; ix++) {
            for (let iy=0; iy<ny; iy++) {
                for (let iz=0; iz<nz; iz++) {

                    for (let i=0; i<phonon.natoms; i++) {
                        let sprod = mat.vec_dot(kpt,[ix,iy,iz]) + atom_phase[i];
                        let phase = Complex.Polar(1.0,sprod*2.0*mat.pi);

                        //Displacements of the atoms
                        let x = Complex(veckn[i][0][0],veckn[i][0][1]).mult(phase);
                        let y = Complex(veckn[i][1][0],veckn[i][1][1]).mult(phase);
                        let z = Complex(veckn[i][2][0],veckn[i][2][1]).mult(phase);

                        vibrations.push( [x,y,z] );
                    }
                }
            }
        }

        return vibrations;
    }

    setVibrations() {
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
    }

    getModeSelectionLimits() {
        if (!this.phonon || !this.phonon.eigenvalues || !this.phonon.distances) {
            return { maxK: 0, maxN: 0 };
        }
        let maxK = Math.max(0, this.phonon.distances.length - 1);
        let maxN = Math.max(0, this.phonon.eigenvalues[0].length - 1);
        return { maxK: maxK, maxN: maxN };
    }

    getEnergyOrderedBandIndices(k) {
        if (!this.phonon || !this.phonon.eigenvalues || !this.phonon.eigenvalues[k]) {
            return [];
        }
        let values = this.phonon.eigenvalues[k];
        let indexed = values.map((value, index) => ({ value: value, index: index }));
        indexed.sort((a, b) => a.value - b.value);
        return indexed.map((item) => item.index);
    }

    getBandIndexFromEnergyOrder(k, order) {
        let orderMap = this.getEnergyOrderedBandIndices(k);
        if (orderMap.length === 0) { return 0; }
        order = Math.max(0, Math.min(orderMap.length - 1, order));
        return orderMap[order];
    }

    getEnergyOrderFromBandIndex(k, bandIndex) {
        let orderMap = this.getEnergyOrderedBandIndices(k);
        let order = orderMap.indexOf(bandIndex);
        return order >= 0 ? order : 0;
    }

    updateModeSelectionInputs() {
        if (!this.dom_k || !this.dom_n) { return; }
        let limits = this.getModeSelectionLimits();

        this.dom_k.attr('min', 1);
        this.dom_k.attr('max', limits.maxK + 1);
        this.dom_k.attr('step', 1);
        this.dom_k.val(this.k + 1);

        this.dom_n.attr('min', 1);
        this.dom_n.attr('max', limits.maxN + 1);
        this.dom_n.attr('step', 1);
        this.dom_n.val(this.getEnergyOrderFromBandIndex(this.k, this.n) + 1);
    }

    selectModeByBandIndex(k, n, syncChart=true) {
        if (!this.phonon) { return; }
        let limits = this.getModeSelectionLimits();

        k = parseInt(k, 10);
        n = parseInt(n, 10);
        if (!Number.isFinite(k)) { k = this.k; }
        if (!Number.isFinite(n)) { n = this.n; }

        this.k = Math.max(0, Math.min(limits.maxK, k));
        this.n = Math.max(0, Math.min(limits.maxN, n));
        this.updateModeSelectionInputs();
        if (typeof this.phonon.ensureQpointEigenvectors === 'function') {
            this.phonon.ensureQpointEigenvectors(this.k);
        }

        this.setVibrations();
        this.syncVisualizerModeScaleDefaults(false);
        this.visualizer.update(this);
        if (syncChart && this.dispersion && this.dispersion.selectModePoint) {
            this.dispersion.selectModePoint(this.phonon, this.k, this.n);
        }
    }

    selectMode(k, nOrder, syncChart=true) {
        if (!this.phonon) { return; }
        let limits = this.getModeSelectionLimits();

        k = parseInt(k, 10);
        nOrder = parseInt(nOrder, 10);
        if (!Number.isFinite(k)) { k = this.k + 1; }
        if (!Number.isFinite(nOrder)) { nOrder = this.getEnergyOrderFromBandIndex(this.k, this.n) + 1; }

        k = Math.max(1, Math.min(limits.maxK + 1, k)) - 1;
        nOrder = Math.max(1, Math.min(limits.maxN + 1, nOrder)) - 1;
        let n = this.getBandIndexFromEnergyOrder(k, nOrder);
        this.selectModeByBandIndex(k, n, syncChart);
    }

    selectModeFromInputs() {
        if (!this.dom_k || !this.dom_n) { return; }
        this.selectMode(this.dom_k.val(), this.dom_n.val(), true);
    }

    plotRaman() {
        if (!this.phonon || !this.phonon.raman_intensities) return;
        window.app = this; 
        
        const phononContainer = document.getElementById('highcharts');
        if (phononContainer) phononContainer.style.display = 'none';
        
        const ramanContainer = document.getElementById('raman-spectrum');
        if (ramanContainer) ramanContainer.style.display = 'block';
        
        let self = this;
        let gamma_idx = this.phonon.gamma_index || 0;
        let frequencies = this.phonon.eigenvalues[gamma_idx];
        let intensities = this.phonon.raman_intensities;
        
        let gamma = 2.0;
        let maxFreq = Math.max(...frequencies) + 50;
        
        let continuousData = [];
        let stickData = [];  
        let allModes = [];   
        
        for (let i = 0; i < frequencies.length; i++) {
            let I_at_peak = 0;
            for (let j = 0; j < frequencies.length; j++) {
                if (intensities[j] > 0) {
                    let dw = frequencies[i] - frequencies[j];
                    I_at_peak += intensities[j] * ((gamma * gamma) / (dw * dw + gamma * gamma));
                }
            }
        
            let isActive = intensities[i] > 0;
        
            allModes.push({ 
                x: frequencies[i], 
                y: I_at_peak, 
                modeIndex: i, 
                active: isActive 
            });
        
            if (isActive) {
                stickData.push({ x: frequencies[i], y: I_at_peak, modeIndex: i });
            }
        }
        
        for (let w = 0; w < maxFreq; w += 1) {
            let I_total = 0;
            for (let i = 0; i < frequencies.length; i++) {
                if (intensities[i] > 0) {
                    let dw = w - frequencies[i];
                    I_total += intensities[i] * ((gamma * gamma) / (dw * dw + gamma * gamma));
                }
            }
            continuousData.push([w, I_total]);
        }
        
        if (typeof Highcharts !== 'undefined') {
            let existingChart = Highcharts.charts.find(c => c && c.renderTo && c.renderTo.id === 'raman-spectrum');
            if (existingChart) existingChart.destroy();
        
            Highcharts.chart('raman-spectrum', {
                title: { text: 'Raman Spectrum: BaZrS₃' },
                xAxis: { title: { text: 'Frequency (cm⁻¹)' } },
                yAxis: { title: { text: 'Intensity' } },
                series: [
                    {
                        name: 'Spectrum',
                        type: 'line',
                        data: continuousData,
                        color: '#2c3e50',
                        marker: { enabled: false },
                        enableMouseTracking: false
                    },
                    {
                        name: 'Active Modes',
                        type: 'scatter',
                        data: stickData,
                        color: '#e74c3c',
                        cursor: 'pointer',
                        point: {
                            events: {
                                click: function () {
                                    self.selectModeByBandIndex(gamma_idx, this.modeIndex);
                                }
                            }
                        }
                    }
                ]
            });
        }
        
        const maxI = Math.max(...allModes.filter(m => m.active).map(d => d.y));
        let existingContainer = document.getElementById('raman-table-container');
        if (existingContainer) existingContainer.remove();
        let tableHTML = `
            <div id="raman-table-container" style="max-height: 400px; overflow-y: auto; margin-top: 16px; border: 1px solid #ccc;">
                <table id="raman-table" style="width:100%; border-collapse:collapse; font-size:14px; font-family:sans-serif;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background:#2c3e50; color:white;">
                            <th style="padding:10px; text-align:center; background:#2c3e50;">Mode #</th>
                            <th style="padding:10px; text-align:center; background:#2c3e50;">Frequency (cm⁻¹)</th>
                            <th style="padding:10px; text-align:center; background:#2c3e50;">Intensity (norm.)</th>
                            <th style="padding:10px; text-align:center; background:#2c3e50;">Raman Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allModes
                            .sort((a, b) => a.x - b.x)
                            .map((d, i) => `
                                <tr style="border-bottom: 1px solid #eee; background:${d.active ? '#fff3f3' : (i % 2 === 0 ? '#f9f9f9' : 'white')};">
                                    <td style="padding:8px; text-align:center;">${d.modeIndex + 1}</td>
                                    
                                    <td style="padding:8px; text-align:center;">
                                        <span style="color:#3498db; text-decoration:underline; cursor:pointer; font-weight:bold;"
                                              onclick="window.app.selectModeByBandIndex(${gamma_idx}, ${d.modeIndex})"
                                              title="Visualize this phonon mode">
                                            ${d.x.toFixed(2)}
                                        </span>
                                    </td>
                                    
                                    <td style="padding:8px; text-align:center;">${d.active ? (d.y / maxI).toFixed(4) : '—'}</td>
                                    <td style="padding:8px; text-align:center; color:#e74c3c;">${d.active ? '<b>✓</b>' : ''}</td>
                                </tr>`)
                            .join('')}
                    </tbody>
                </table>
            </div>`;
        
        const flexHighcharts = document.querySelector('.flex-highcharts');
        if (flexHighcharts) {
            flexHighcharts.insertAdjacentHTML('beforeend', tableHTML);
        }
    }
    update(dispersion = true) {
        /*
        Update all the aspects fo the webpage
        */

        //update structure
        this.getRepetitions();
        if (!this.enforceVisualizationLimits(false)) {
            return;
        }
        this.atoms = this.getStructure(this.nx,this.ny,this.nz);
        this.vibrations = this.getVibrations(this.nx,this.ny,this.nz);
        this.phonon.nndist = this.getBondingDistance();
        this.syncVisualizerModeScaleDefaults(!this.visualizer.modeScaleAutoInitialized);
        if (typeof this.phonon.ensureQpointEigenvectors === 'function') {
            this.phonon.ensureQpointEigenvectors(this.k);
        }

        //update page
        this.updatePage();

        //update visualizer first so material changes show immediately in Three.js
        this.visualizer.update(this);

        //update dispersion
        if (dispersion) {
            const dispersionOptions = this.getDispersionOptions();
            dispersionOptions.resetLegendVisibility = true;
            this.dispersion.update(this.phonon, dispersionOptions);
            if (this.dispersion.selectModePoint) {
                this.dispersion.selectModePoint(this.phonon, this.k, this.n);
            }
        }
       this.plotRaman();
    }

    getDispersionOptions() {
        return {
            enabled: this.showModeWeightsOnPlot,
            getAtomColorHex: (atomNumber) => this.getAtomColorHex(atomNumber),
            getAtomLabel: (atomNumber) => atomic_data.atomic_symbol[atomNumber] || String(atomNumber),
            resetLegendVisibility: false,
        };
    }

    getAtomColorHex(atomNumber) {
        if (this.visualizer && typeof this.visualizer.getAtomColorHex === 'function') {
            return this.visualizer.getAtomColorHex(atomNumber);
        }
        return 0x0066ff;
    }

    getAtomColorCss(atomNumber) {
        return atomColorHexToCss(this.getAtomColorHex(atomNumber));
    }

    getAtomBadgeTextColor(atomNumber) {
        return getAtomBadgeTextColor(this.getAtomColorHex(atomNumber));
    }

    refreshAppearanceUI() {
        this.updatePage();
        this.refreshDispersionAppearance();
    }

    refreshDispersionAppearance() {
        if (!this.phonon || !this.dispersion) {
            return;
        }
        if (typeof this.dispersion.refreshAppearance === 'function') {
            this.dispersion.refreshAppearance(this.getDispersionOptions());
        } else {
            this.dispersion.update(this.phonon, this.getDispersionOptions());
            if (this.dispersion.selectModePoint) {
                this.dispersion.selectModePoint(this.phonon, this.k, this.n);
            }
        }
        if (this.dispersion.reflow) {
            this.dispersion.reflow();
        }
    }

    estimateDisplayedAtoms() {
        if (!this.phonon || !this.phonon.natoms) {
            return 0;
        }
        return Number(this.phonon.natoms) * Number(this.nx) * Number(this.ny) * Number(this.nz);
    }

    enforceVisualizationLimits(fromLoadCallback) {
        const maxDisplayedAtoms = 5000;
        const displayedAtoms = this.estimateDisplayedAtoms();

        if (displayedAtoms <= maxDisplayedAtoms) {
            return true;
        }

        if (fromLoadCallback && this.phonon && this.phonon.natoms <= maxDisplayedAtoms) {
            this.setRepetitions([1, 1, 1]);
            return true;
        }

        alert(
            'This structure is too large to render interactively (' +
            displayedAtoms +
            ' atoms after repetitions). Please reduce repetitions or use a smaller structure.'
        );
        return false;
    }

    updatePage() {
        /*
        lattice vectors table
        */

        if (this.dom_lattice)  {
            renderLatticeTable(this.dom_lattice, this.phonon.lat);
        }

        //atomic positions table
        if (this.dom_atompos) {
            renderAtomPositionsTable(
                this.dom_atompos,
                this.phonon.atom_pos_red,
                this.phonon.atom_types,
                this.phonon.atom_numbers,
                this.getAtomColorHex.bind(this)
            );
        }

        //update title
        if (this.dom_title) {
            let title = this.dom_title[0];
            while (title.hasChildNodes()) {
                title.removeChild(title.lastChild);
            }

            //make link
            if ("link" in this) {
                let a = document.createElement("A");
                a.href = this.link;
                a.innerHTML = this.name;
                title.appendChild(a);
            }
            else {
                title.innerHTML = this.name;
            }

        }
    }

    updateMenu() {
        /*
        create menu with:
            1. local files (files distributed with the website)
            2. files from the phonodb database 2015 and 2017
            3. potentially more sources of data can be added
        */

        let self = this;

        this.materialsIndex = [];
        if (this.dom_mat) { this.dom_mat.empty(); }
        if (this.dom_ref) { this.dom_ref.empty(); }

        function addMaterials(materials) {
            for (let i=0; i<materials.length; i++) {
                self.materialsIndex.push(materials[i]);
            }
            self.renderMaterialsMenu();
        }

        //local database
        let source = new LocalDB();
        source.get_materials(addMaterials);

        //contributions database
        source = new ContribDB();
        source.get_materials(addMaterials);

        //locally generated PhononDB subset
        source = new LocalPhononDB();
        source.get_materials(addMaterials);

        //materials project database
        source = new MaterialsProjectDB();
        source.checkAvailability(function(isAvailable) {
            if (isAvailable) {
                source.get_materials(addMaterials);
            } else {
                console.log("Skipping Materials Project phonons because the OpenData bucket is unreachable from this browser.");
            }
        });
    }

    getMaterialFilterTokens() {
        let query = this.materialFilterQuery || '';
        return query
            .toLowerCase()
            .split(/[\s,]+/)
            .map(function(token) { return token.trim(); })
            .filter(function(token) { return token.length > 0; });
    }

    getMaterialReferenceKey(material) {
        let source = material && material.source ? material.source : '';
        let reference = material && material.reference ? material.reference : '';
        return source + "::" + reference;
    }

    isReferenceEnabled(referenceKey) {
        return !this.disabledReferenceKeys.has(referenceKey);
    }

    toggleReferenceEnabled(referenceKey) {
        if (this.disabledReferenceKeys.has(referenceKey)) {
            this.disabledReferenceKeys.delete(referenceKey);
        } else {
            this.disabledReferenceKeys.add(referenceKey);
        }
        this.renderMaterialsMenu();
    }

    getMaterialElements(materialName) {
        let matches = materialName.match(/[A-Z][a-z]?/g);
        if (!matches) {
            return [];
        }
        return matches.map(function(symbol) {
            return symbol.toLowerCase();
        });
    }

    materialMatchesFilter(material, tokens) {
        if (!tokens.length) {
            return true;
        }

        let materialName = material.name || '';
        let formulaText = materialName.toLowerCase();
        let elementTokens = this.getMaterialElements(materialName);

        return tokens.every(function(token) {
            if (/^[a-z]{1,2}$/.test(token)) {
                return elementTokens.indexOf(token) !== -1;
            }
            return formulaText.indexOf(token) !== -1;
        });
    }

    getMaterialSourcePriority(material) {
        let source = material && material.source ? material.source : '';
        let sourcePriorities = {
            localdb: 0,
            contribdb: 1,
            phonondb: 2,
            mpdb: 3,
        };
        return Object.prototype.hasOwnProperty.call(sourcePriorities, source)
            ? sourcePriorities[source]
            : 99;
    }

    compareMaterialsForMenu(a, b) {
        let priorityDelta = this.getMaterialSourcePriority(a) - this.getMaterialSourcePriority(b);
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        let nameA = (a && a.name ? a.name : '').toLowerCase();
        let nameB = (b && b.name ? b.name : '').toLowerCase();
        let nameDelta = nameA.localeCompare(nameB);
        if (nameDelta !== 0) {
            return nameDelta;
        }

        let referenceA = this.getMaterialReferenceKey(a);
        let referenceB = this.getMaterialReferenceKey(b);
        return referenceA.localeCompare(referenceB);
    }

    renderMaterialsMenu() {
        let dom_mat = this.dom_mat;
        let dom_ref = this.dom_ref;
        if (!dom_mat) {
            return;
        }

        dom_mat.empty();
        if (dom_ref) {
            dom_ref.empty();
        }

        let tokens = this.getMaterialFilterTokens();
        let unique_references = new Map();
        let baseFilteredMaterials = this.materialsIndex
            .filter((material) => this.materialMatchesFilter(material, tokens))
            .slice()
            .sort(this.compareMaterialsForMenu.bind(this));
        let filteredMaterials = baseFilteredMaterials
            .filter((material) => this.isReferenceEnabled(this.getMaterialReferenceKey(material)));
        let nreferences = 1;

        for (let i=0; i<baseFilteredMaterials.length; i++) {
            let m = baseFilteredMaterials[i];
            let ref = m["reference"];
            let refKey = this.getMaterialReferenceKey(m);
            if (!unique_references.has(refKey)) {
                unique_references.set(refKey, {
                    index: nreferences,
                    reference: ref,
                    count: 0
                });
                nreferences += 1;
            }
            unique_references.get(refKey).count += 1;
        }

        let materialsHeading = document.querySelector("#material-list h3");
        if (materialsHeading) {
            materialsHeading.textContent = "Materials (" + filteredMaterials.length + "):";
        }

        for (let i=0; i<filteredMaterials.length; i++) {
            let m = filteredMaterials[i];
            let refKey = this.getMaterialReferenceKey(m);
            let referenceEntry = unique_references.get(refKey);
            let name = utils.format_formula_html(m.name);
            let name_ref = name + " ["+referenceEntry.index+"]";

            let li = document.createElement("LI");
            let a = document.createElement("A");
            a.onclick = () => {
                let url_vars = {};
                url_vars[m.type] = m.url;
                url_vars.name = name_ref;
                if ("link" in m) { url_vars.link = m.link }
                this.loadURL(url_vars);
            };
            a.innerHTML = name;
            li.appendChild(a);
            dom_mat.append(li);
        }

        if (dom_ref) {
            for (let [refKey, referenceEntry] of unique_references.entries()) {
                let refIndex = referenceEntry.index;
                let ref = referenceEntry.reference;
                let refCount = referenceEntry.count || 0;
                let li = document.createElement("LI");
                li.className = "reference-filter-item";
                if (!this.isReferenceEnabled(refKey)) {
                    li.classList.add("reference-filter-disabled");
                }
                let toggle = document.createElement("input");
                toggle.type = "checkbox";
                toggle.className = "reference-filter-toggle";
                toggle.checked = this.isReferenceEnabled(refKey);
                toggle.title = "Show materials from this source";
                toggle.onchange = () => {
                    this.toggleReferenceEnabled(refKey);
                };

                let text = document.createElement("span");
                text.className = "reference-filter-text";
                text.innerHTML = "["+refIndex+"] "+ref+" ("+refCount+")";

                li.appendChild(toggle);
                li.appendChild(text);
                dom_ref.append(li);
            }
        }
    }

}
