import * as atomic_data from './atomic_data.js';
import * as utils from './utils.js';
import * as mat from './mat.js';
import pako from 'pako';
import { MaterialsProjectDB } from './mpdb.js';
import { solveHermitianEigenSystem } from './dynamicalmatrix.js';

var thz2cm1 = 33.35641;
var ev2cm1 = 8065.73;

export class PhononJson {

    getDefaultEigenvalueMatchToleranceCm1() {
        return 0.5;
    }

    getComplexVectorOverlapAbs(left, right) {
        let leftNorm2 = 0;
        let rightNorm2 = 0;
        for (let i = 0; i < left.length; i++) {
            leftNorm2 += left[i][0] * left[i][0] + left[i][1] * left[i][1];
            rightNorm2 += right[i][0] * right[i][0] + right[i][1] * right[i][1];
        }
        if (leftNorm2 <= 0 || rightNorm2 <= 0) {
            return 0;
        }
        let norm = 1 / Math.sqrt(leftNorm2 * rightNorm2);
        let real = 0;
        let imag = 0;
        for (let i = 0; i < left.length; i++) {
            real += left[i][0] * right[i][0] + left[i][1] * right[i][1];
            imag += left[i][0] * right[i][1] - left[i][1] * right[i][0];
        }
        return Math.sqrt(real * real + imag * imag) * norm;
    }

    estimateRuntimeBandConnection(prevEigenvectors, eigenvectors, prevBandOrder) {
        let metric = [];
        for (let i = 0; i < prevEigenvectors.length; i++) {
            let row = [];
            for (let j = 0; j < eigenvectors.length; j++) {
                row.push(this.getComplexVectorOverlapAbs(prevEigenvectors[i], eigenvectors[j]));
            }
            metric.push(row);
        }

        let connectionOrder = [];
        for (let i = 0; i < metric.length; i++) {
            let overlaps = metric[i];
            let maxValue = 0;
            let maxIndex = 0;
            for (let candidateIndex = metric.length - 1; candidateIndex >= 0; candidateIndex--) {
                let value = overlaps[candidateIndex];
                if (connectionOrder.indexOf(candidateIndex) !== -1) {
                    continue;
                }
                if (value > maxValue) {
                    maxValue = value;
                    maxIndex = candidateIndex;
                }
            }
            connectionOrder.push(maxIndex);
        }

        let bandOrder = [];
        for (let i = 0; i < prevBandOrder.length; i++) {
            bandOrder.push(connectionOrder[prevBandOrder[i]]);
        }
        return bandOrder;
    }

    warnRuntimeEigenvalueMismatch(qIndex, runtimeEigenvalues) {
        let storedEigenvalues = this.stored_eigenvalues && this.stored_eigenvalues[qIndex]
            ? this.stored_eigenvalues[qIndex]
            : (this.eigenvalues && this.eigenvalues[qIndex]);
        if (
            !storedEigenvalues ||
            !runtimeEigenvalues ||
            storedEigenvalues.length !== runtimeEigenvalues.length
        ) {
            return;
        }

        let maxDifference = 0;
        for (let i = 0; i < storedEigenvalues.length; i++) {
            maxDifference = Math.max(
                maxDifference,
                Math.abs(Number(storedEigenvalues[i]) - Number(runtimeEigenvalues[i]))
            );
        }

        if (maxDifference > this.getDefaultEigenvalueMatchToleranceCm1()) {
            console.warn(
                `Runtime eigenvalue mismatch at q-point ${qIndex}: max |Δω| = ${maxDifference.toFixed(3)} cm^-1`
            );
        }
    }

    async solveRuntimeEigenSystem(qIndex) {
        let qDirection = this.getNacQDirection(qIndex);
        return solveHermitianEigenSystem(this.dynamical_matrix, this.kpoints[qIndex], qDirection);
    }

    async yieldForRuntimeSolve() {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    async computeRuntimeBandConnectedEigenSolutionAsync(progressCallback = null) {
        if (!this.canComputeEigenvectorsOnDemand() || !this.kpoints || !this.kpoints.length) {
            return null;
        }

        let rawEigenvectors = [];
        let rawEigenvalues = [];
        let totalQpoints = this.kpoints.length;
        for (let qIndex = 0; qIndex < this.kpoints.length; qIndex++) {
            let eigenSystem = await this.solveRuntimeEigenSystem(qIndex);
            rawEigenvectors.push(eigenSystem.eigenvectors);
            rawEigenvalues.push(eigenSystem.eigenvaluesCm1);
            if (progressCallback) {
                progressCallback({
                    phase: 'compute',
                    loaded: qIndex + 1,
                    total: totalQpoints,
                });
            }
            if ((qIndex + 1) % 4 === 0 || qIndex + 1 === totalQpoints) {
                await this.yieldForRuntimeSolve();
            }
        }

        let bandOrder = null;
        let orderedEigenvectors = [];
        let orderedEigenvalues = [];
        let mismatchSummary = [];
        for (let qIndex = 0; qIndex < rawEigenvectors.length; qIndex++) {
            if (qIndex === 0 || bandOrder === null) {
                bandOrder = [];
                for (let modeIndex = 0; modeIndex < rawEigenvectors[qIndex].length; modeIndex++) {
                    bandOrder.push(modeIndex);
                }
            } else {
                bandOrder = this.estimateRuntimeBandConnection(
                    rawEigenvectors[qIndex - 1],
                    rawEigenvectors[qIndex],
                    bandOrder
                );
            }

            let qOrderedEigenvectors = bandOrder.map((modeIndex) => rawEigenvectors[qIndex][modeIndex]);
            let qOrderedEigenvalues = bandOrder.map((modeIndex) => rawEigenvalues[qIndex][modeIndex]);
            let storedEigenvalues = this.stored_eigenvalues && this.stored_eigenvalues[qIndex]
                ? this.stored_eigenvalues[qIndex]
                : (this.eigenvalues && this.eigenvalues[qIndex] ? this.eigenvalues[qIndex] : null);
            let maxDeltaCm1 = null;
            if (storedEigenvalues && storedEigenvalues.length === qOrderedEigenvalues.length) {
                maxDeltaCm1 = 0;
                for (let modeIndex = 0; modeIndex < storedEigenvalues.length; modeIndex++) {
                    maxDeltaCm1 = Math.max(
                        maxDeltaCm1,
                        Math.abs(Number(storedEigenvalues[modeIndex]) - Number(qOrderedEigenvalues[modeIndex]))
                    );
                }
            }

            orderedEigenvectors.push(qOrderedEigenvectors);
            orderedEigenvalues.push(qOrderedEigenvalues);
            mismatchSummary.push({
                qIndex: qIndex,
                maxDeltaCm1: maxDeltaCm1,
            });
        }

        return {
            eigenvectors: orderedEigenvectors,
            eigenvalues: orderedEigenvalues,
            mismatchSummary: mismatchSummary,
        };
    }

    async computeAllRuntimeEigenvectorsWithBandConnectionAsync(progressCallback = null) {
        if (!this.vec || !this.vec.length || !this.canComputeEigenvectorsOnDemand()) {
            return false;
        }

        let solution = await this.computeRuntimeBandConnectedEigenSolutionAsync(progressCallback);
        if (!solution) {
            return false;
        }

        for (let qIndex = 0; qIndex < solution.eigenvectors.length; qIndex++) {
            let orderedComplexEigenvectors = solution.eigenvectors[qIndex];
            this.warnRuntimeEigenvalueMismatch(qIndex, solution.eigenvalues[qIndex]);
            let eivecq = this.convertComplexEigenvectorsToInternal(orderedComplexEigenvectors);
            this.applyModeAmplitudeConventionToEigenvectors(eivecq);
            this.normalizeEigenvectorSet(eivecq);
            this.vec[qIndex] = eivecq;
        }

        this.eigenvalues = solution.eigenvalues;
        this.invalidateEigenvectorCaches();
        return true;
    }

    decodeBase64Bytes(base64Text) {
        if (typeof base64Text !== 'string') {
            return new Uint8Array(0);
        }

        if (typeof atob === 'function') {
            let binary = atob(base64Text);
            let bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        }

        if (typeof Buffer !== 'undefined') {
            return new Uint8Array(Buffer.from(base64Text, 'base64'));
        }

        throw new Error('Base64 decoding is not available in this environment.');
    }

    decodeCompressedVectors(payload) {
        if (!payload || payload.format !== 'q11-int16-base64') {
            return null;
        }

        let shape = payload.shape || [];
        if (shape.length !== 5) {
            return null;
        }

        let scale = Number(payload.scale);
        if (!Number.isFinite(scale) || scale <= 0) {
            return null;
        }

        let bytes = this.decodeBase64Bytes(payload.data);
        let expectedCount = shape.reduce((acc, value) => acc * value, 1);
        if (bytes.length !== expectedCount * 2) {
            return null;
        }

        let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let values = new Float32Array(expectedCount);
        for (let i = 0; i < expectedCount; i++) {
            values[i] = view.getInt16(i * 2, true) / scale;
        }

        let offset = 0;
        let vectors = [];
        for (let q = 0; q < shape[0]; q++) {
            let qVectors = [];
            for (let n = 0; n < shape[1]; n++) {
                let modeVectors = [];
                for (let atom = 0; atom < shape[2]; atom++) {
                    let atomVectors = [];
                    for (let axis = 0; axis < shape[3]; axis++) {
                        atomVectors.push([
                            values[offset++],
                            values[offset++],
                        ]);
                    }
                    modeVectors.push(atomVectors);
                }
                qVectors.push(modeVectors);
            }
            vectors.push(qVectors);
        }

        return vectors;
    }

    normalizeEigenvectors() {
        if (!this.vec || !this.vec.length || !this.atom_numbers || !this.atom_numbers.length) {
            return;
        }

        for (let q=0; q<this.vec.length; q++) {
            let eivecq = this.vec[q];
            if (!eivecq || !eivecq.length) {
                continue;
            }
            for (let n=0; n<eivecq.length; n++) {
                let eivecqn = eivecq[n];
                let modeNormSq = 0;
                for (let i=0; i<eivecqn.length; i++) {
                    modeNormSq += eivecqn[i][0][0] * eivecqn[i][0][0] + eivecqn[i][0][1] * eivecqn[i][0][1];
                    modeNormSq += eivecqn[i][1][0] * eivecqn[i][1][0] + eivecqn[i][1][1] * eivecqn[i][1][1];
                    modeNormSq += eivecqn[i][2][0] * eivecqn[i][2][0] + eivecqn[i][2][1] * eivecqn[i][2][1];
                }

                if (!(modeNormSq > 0)) {
                    continue;
                }

                let norm = 1.0 / Math.sqrt(modeNormSq);
                for (let i=0; i<eivecqn.length; i++) {
                    eivecqn[i][0][0] *= norm;
                    eivecqn[i][1][0] *= norm;
                    eivecqn[i][2][0] *= norm;
                    eivecqn[i][0][1] *= norm;
                    eivecqn[i][1][1] *= norm;
                    eivecqn[i][2][1] *= norm;
                }
            }
        }
    }

    normalizeEigenvectorSet(eivecq) {
        if (!eivecq || !eivecq.length) {
            return;
        }

        for (let n=0; n<eivecq.length; n++) {
            let eivecqn = eivecq[n];
            let modeNormSq = 0;
            for (let i=0; i<eivecqn.length; i++) {
                modeNormSq += eivecqn[i][0][0] * eivecqn[i][0][0] + eivecqn[i][0][1] * eivecqn[i][0][1];
                modeNormSq += eivecqn[i][1][0] * eivecqn[i][1][0] + eivecqn[i][1][1] * eivecqn[i][1][1];
                modeNormSq += eivecqn[i][2][0] * eivecqn[i][2][0] + eivecqn[i][2][1] * eivecqn[i][2][1];
            }

            if (!(modeNormSq > 0)) {
                continue;
            }

            let norm = 1.0 / Math.sqrt(modeNormSq);
            for (let i=0; i<eivecqn.length; i++) {
                eivecqn[i][0][0] *= norm;
                eivecqn[i][1][0] *= norm;
                eivecqn[i][2][0] *= norm;
                eivecqn[i][0][1] *= norm;
                eivecqn[i][1][1] *= norm;
                eivecqn[i][2][1] *= norm;
            }
        }
    }

    invalidateEigenvectorCaches() {
        this.atomTypeWeightsCache = null;
    }

    canComputeEigenvectorsOnDemand() {
        return !!(
            this.dynamical_matrix &&
            this.dynamical_matrix.force_constants_compact &&
            this.dynamical_matrix.shortest_vectors &&
            this.dynamical_matrix.multiplicity &&
            this.dynamical_matrix.s2pp_map &&
            this.dynamical_matrix.primitive_lattice &&
            (!this.dynamical_matrix.nac ||
                (
                    this.dynamical_matrix.nac.method === 'gonze' &&
                    this.dynamical_matrix.nac.g_list &&
                    this.dynamical_matrix.nac.positions_car &&
                    this.dynamical_matrix.nac.dd_q0
                )) &&
            this.kpoints
        );
    }

    getSegmentForQpoint(qIndex) {
        if (!this.line_breaks) {
            return null;
        }
        for (let i = 0; i < this.line_breaks.length; i++) {
            let start = this.line_breaks[i][0];
            let end = this.line_breaks[i][1];
            if (qIndex >= start && qIndex < end) {
                return [start, end];
            }
        }
        return null;
    }

    getNacQDirection(qIndex) {
        if (!this.dynamical_matrix || !this.dynamical_matrix.nac || !this.kpoints || !this.kpoints[qIndex]) {
            return null;
        }

        let qpoint = this.kpoints[qIndex];
        let qNormSq = qpoint[0] * qpoint[0] + qpoint[1] * qpoint[1] + qpoint[2] * qpoint[2];
        if (qNormSq > 1e-16) {
            return null;
        }

        let segment = this.getSegmentForQpoint(qIndex);
        if (!segment) {
            return null;
        }

        let start = segment[0];
        let end = segment[1] - 1;
        if (start < 0 || end < 0 || start >= this.kpoints.length || end >= this.kpoints.length) {
            return null;
        }

        let startQ = this.kpoints[start];
        let endQ = this.kpoints[end];
        let direction = [
            Number(startQ[0]) - Number(endQ[0]),
            Number(startQ[1]) - Number(endQ[1]),
            Number(startQ[2]) - Number(endQ[2]),
        ];
        let directionNormSq = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
        if (directionNormSq > 1e-16) {
            return direction;
        }

        if (qIndex > start) {
            let previousQ = this.kpoints[qIndex - 1];
            direction = [
                Number(previousQ[0]) - Number(qpoint[0]),
                Number(previousQ[1]) - Number(qpoint[1]),
                Number(previousQ[2]) - Number(qpoint[2]),
            ];
            directionNormSq = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
            if (directionNormSq > 1e-16) {
                return direction;
            }
        }

        if (qIndex + 1 < segment[1]) {
            let nextQ = this.kpoints[qIndex + 1];
            direction = [
                Number(qpoint[0]) - Number(nextQ[0]),
                Number(qpoint[1]) - Number(nextQ[1]),
                Number(qpoint[2]) - Number(nextQ[2]),
            ];
            directionNormSq = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
            if (directionNormSq > 1e-16) {
                return direction;
            }
        }

        return null;
    }

    convertComplexEigenvectorsToInternal(complexEigenvectors) {
        let natoms = this.natoms;
        let modes = [];
        for (let modeIndex = 0; modeIndex < complexEigenvectors.length; modeIndex++) {
            let vector = complexEigenvectors[modeIndex];
            let atoms = [];
            for (let atomIndex = 0; atomIndex < natoms; atomIndex++) {
                atoms.push([
                    [vector[atomIndex * 3 + 0][0], vector[atomIndex * 3 + 0][1]],
                    [vector[atomIndex * 3 + 1][0], vector[atomIndex * 3 + 1][1]],
                    [vector[atomIndex * 3 + 2][0], vector[atomIndex * 3 + 2][1]],
                ]);
            }
            modes.push(atoms);
        }
        return modes;
    }

    applyModeAmplitudeConventionToEigenvectors(eivecq) {
        if (
            !eivecq ||
            this.mode_amplitude_convention !== 'avg-mass-normalized' ||
            !this.dynamical_matrix ||
            !this.dynamical_matrix.masses
        ) {
            return eivecq;
        }

        let masses = this.dynamical_matrix.masses;
        let averageMass = Number(this.average_mass);
        if (!Number.isFinite(averageMass) || averageMass <= 0) {
            return eivecq;
        }

        for (let modeIndex = 0; modeIndex < eivecq.length; modeIndex++) {
            for (let atomIndex = 0; atomIndex < eivecq[modeIndex].length; atomIndex++) {
                let atomMass = Number(masses[atomIndex]);
                if (!Number.isFinite(atomMass) || atomMass <= 0) {
                    continue;
                }
                let scale = Math.sqrt(averageMass / atomMass);
                for (let axis = 0; axis < 3; axis++) {
                    eivecq[modeIndex][atomIndex][axis][0] *= scale;
                    eivecq[modeIndex][atomIndex][axis][1] *= scale;
                }
            }
        }

        return eivecq;
    }

    ensureQpointEigenvectors(qIndex) {
        if (!this.vec || qIndex < 0 || qIndex >= this.vec.length) {
            return false;
        }
        if (this.vec[qIndex] && this.vec[qIndex].length) {
            return true;
        }
        if (!this.canComputeEigenvectorsOnDemand()) {
            return false;
        }
        return false;
    }

    ensureAllEigenvectors() {
        if (!this.vec || !this.vec.length) {
            return false;
        }

        let changed = false;
        for (let qIndex = 0; qIndex < this.vec.length; qIndex++) {
            if (this.vec[qIndex] && this.vec[qIndex].length) {
                continue;
            }
            changed = this.ensureQpointEigenvectors(qIndex) || changed;
        }
        return changed;
    }

    static showCompressedLoadError(message) {
        if (PhononJson.lastCompressedLoadError === message) {
            return;
        }
        PhononJson.lastCompressedLoadError = message;
        alert(message);
    }

    getFromURL(url,callback,hooks={}) {
        /*
        load a file from url
        */

        if (url.endsWith('.gz')) {
            this.getFromCompressedURL(url,callback,hooks);
            return;
        }

        function onLoadEndHandler(text) {
            this.getFromJson(text,callback,hooks);
        };

        hooks.onStart && hooks.onStart();
        let request;
        try {
            request = $.getJSON(url,onLoadEndHandler.bind(this));
        } catch (error) {
            hooks.onError && hooks.onError({
                kind: 'request',
                message: error && error.message ? error.message : 'Unable to load phonon data.'
            });
            hooks.onFinish && hooks.onFinish();
            return;
        }

        if (request && typeof request.fail === 'function') {
            request.fail(function(jqxhr, textStatus) {
                hooks.onError && hooks.onError({
                    kind: 'request',
                    message: textStatus || 'Unable to load phonon data.'
                });
            });
        }

        if (request && typeof request.always === 'function') {
            request.always(function() {
                hooks.onFinish && hooks.onFinish();
            });
        } else {
            hooks.onFinish && hooks.onFinish();
        }

    }

    getFromCompressedURL(url,callback,hooks={}) {
        if (typeof XMLHttpRequest === 'undefined') {
            hooks.onError && hooks.onError({
                kind: 'browser',
                message: "This browser cannot load compressed phonon JSON files."
            });
            return;
        }

        let xhr = new XMLHttpRequest();
        hooks.onStart && hooks.onStart();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';

        xhr.onprogress = function(event) {
            hooks.onProgress && hooks.onProgress({
                loaded: event.loaded,
                total: event.lengthComputable ? event.total : null
            });
        };

        xhr.onload = function() {
            if (xhr.status !== 200) {
                hooks.onError && hooks.onError({
                    kind: 'http',
                    status: xhr.status,
                    message: "Unable to load compressed phonon data: HTTP " + xhr.status
                });
                hooks.onFinish && hooks.onFinish();
                return;
            }

            Promise.resolve(xhr.response)
                .then(function(buffer) {
                    let textPromise;
                    if (typeof DecompressionStream === 'function') {
                        let stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
                        textPromise = new Response(stream).text();
                    } else {
                        let uint8 = new Uint8Array(buffer);
                        textPromise = Promise.resolve(pako.ungzip(uint8, { to: 'string' }));
                    }
                    return textPromise;
                })
                .then(function(text) {
                    this.getFromString(text,callback,hooks);
                    hooks.onFinish && hooks.onFinish();
                }.bind(this))
                .catch(function(error) {
                    console.log(error);
                    hooks.onError && hooks.onError({
                        kind: 'parse',
                        message: error && error.message ? error.message : 'Unable to parse compressed phonon data.'
                    });
                    hooks.onFinish && hooks.onFinish();
                });
        }.bind(this);

        xhr.onerror = function() {
            let isMaterialsProject = url.indexOf('materialsproject-parsed.s3.amazonaws.com') !== -1;
            let likelyCors = isMaterialsProject && MaterialsProjectDB.availabilityState === false;
            let message = likelyCors
                ? "Unable to load Materials Project phonon data. The remote OpenData bucket is blocking cross-origin browser requests (CORS)."
                : "Unable to load compressed phonon data because the download failed in the browser.";
            hooks.onError && hooks.onError({
                kind: likelyCors ? 'cors' : 'network',
                message: message
            });
            hooks.onFinish && hooks.onFinish();
        };

        xhr.send(null);
    }

    getFromFile(file,callback) {
        /*
        file is a javasccript file object with the ".json" file in data
        */

        let json_reader = new FileReader();

        function onLoadEndHandler() {
            this.getFromString(json_reader.result,callback);
        };

        //read the files
        json_reader.onloadend = onLoadEndHandler.bind(this);
        json_reader.readAsText(file);

    }

    getFromString(string,callback,hooks={}) {
        /*
        string is the content of the ".json" file as a string
        */

        let json = JSON.parse(string);
        this.getFromJson(json,callback,hooks);
    }

    getFromJson(json,callback,hooks={}) {
        if (json.hasOwnProperty('@class')) {
            this.getFromPMGJson(json,callback);
        } else if (
            json.hasOwnProperty('qpoints') &&
            json.hasOwnProperty('frequencies') &&
            json.hasOwnProperty('eigendisplacements') &&
            json.hasOwnProperty('structure')
        ) {
            this.getFromOpenDataJson(json,callback);
        } else { this.getFromInternalJson(json,callback,hooks); }
    }

    getFromInternalJson(data,callback,hooks={}) {
        /*
        It was determined the json dictionary is the internal format
        */

        this.addatomphase = false;
        this.name = data["name"];
        this.natoms = data["natoms"];
        this.atom_types = data["atom_types"];
        this.atom_numbers = data["atom_numbers"];
        this.atomic_numbers = data["atomic_numbers"];
        this.atom_pos_car = data["atom_pos_car"];
        this.atom_pos_red = data["atom_pos_red"];
        this.lat = data["lattice"];
        this.vec = data["vectors_compressed"]
            ? this.decodeCompressedVectors(data["vectors_compressed"])
            : data["vectors"];
        this.kpoints = data["qpoints"];
        this.distances = data["distances"];
        this.formula = data["formula"];
        this.eigenvalues = data["eigenvalues"] || null;
        this.stored_eigenvalues = data["eigenvalues"]
            ? data["eigenvalues"].map((row) => row.slice())
            : null;
        this.repetitions = data["repetitions"];

        this.raman_intensities = data["raman_intensities"] || null;
        this.gamma_index = data["gamma_index"] || 0;

        this.average_mass = data["average_mass"];
        this.mode_amplitude_convention = data["mode_amplitude_convention"];
        this.dynamical_matrix = data["dynamical_matrix"] || null;
        this.masses = data["masses"] || (this.dynamical_matrix ? this.dynamical_matrix.masses : null);
        if (this.dynamical_matrix && !this.dynamical_matrix.primitive_lattice && this.lat) {
            this.dynamical_matrix.primitive_lattice = this.lat;
        }

        if (!this.vec && this.canComputeEigenvectorsOnDemand()) {
            this.vec = new Array(this.kpoints.length).fill(null);
        }

        //get qindex
        this.qindex = {};
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        //get high symmetry qpoints
        this.highsym_qpts = {}
        for (let i=0; i<data["highsym_qpts"].length; i++) {
            let dist = this.distances[data["highsym_qpts"][i][0]];
            this.highsym_qpts[dist] = data["highsym_qpts"][i][1];
        }

        //get line breaks
        this.getLineBreaks(data);

        let finalize = function() {
            if (this.vec) {
                this.normalizeEigenvectors();
            }
            this.invalidateEigenvectorCaches();
            callback();
        }.bind(this);

        if (this.canComputeEigenvectorsOnDemand() && this.vec && this.vec.length && !this.vec[0]) {
            this.computeAllRuntimeEigenvectorsWithBandConnectionAsync(function(progress) {
                hooks.onComputeProgress && hooks.onComputeProgress(progress);
            })
                .finally(finalize);
            return;
        }

        finalize();
    }

    parseOpenDataComplex(value) {
        if (typeof value === 'number') {
            return [value,0];
        }

        if (typeof value !== 'string') {
            return [0,0];
        }

        let normalized = value.trim();
        if (normalized[0] === '(' && normalized[normalized.length-1] === ')') {
            normalized = normalized.slice(1,-1);
        }

        normalized = normalized.replace(/\s+/g, '');

        if (normalized === '0j') {
            return [0,0];
        }

        let splitIndex = -1;
        for (let i=1; i<normalized.length; i++) {
            if ((normalized[i] === '+' || normalized[i] === '-') && normalized[i-1] !== 'e' && normalized[i-1] !== 'E') {
                splitIndex = i;
            }
        }

        if (normalized.endsWith('j')) {
            if (splitIndex === -1) {
                return [0,Number(normalized.slice(0,-1))];
            }

            return [
                Number(normalized.slice(0,splitIndex)),
                Number(normalized.slice(splitIndex,-1))
            ];
        }

        return [Number(normalized),0];
    }

    getFromOpenDataJson(data,callback) {
        this.addatomphase = false;

        let structure = data["structure"];
        this.lat = structure["lattice"]["matrix"];
        let rlat = utils.rec_lat(this.lat);
        this.repetitions = [3,3,3];

        this.atom_pos_car = [];
        this.atom_pos_red = [];
        this.atom_types = [];
        this.atom_numbers = [];

        let sites = structure["sites"];
        for (let i=0; i<sites.length; i++) {
            let site = sites[i];

            let atom_type = site['label'];
            this.atom_types.push(atom_type);
            this.atom_numbers.push(atomic_data.atomic_number[atom_type]);
            this.atom_pos_car.push(site['xyz']);
            this.atom_pos_red.push(site['abc']);
        }

        this.natoms = sites.length;
        this.name = utils.get_formula(this.atom_types);

        let qpoints_red = data['qpoints'];
        let qpoints_car = utils.red_car_list(qpoints_red,rlat);
        this.kpoints = qpoints_red;

        let labels_dict = data["labels_dict"];
        let high_symmetry_points_red = [];
        let high_symmetry_labels = [];
        for (let label in labels_dict) {
            let qpoint = labels_dict[label];
            high_symmetry_points_red.push(qpoint);
            high_symmetry_labels.push(label);
        }

        let high_symmetry_points_car = utils.red_car_list(high_symmetry_points_red,rlat);
        let highsym_qpts_index = {}
        for (let nq=0; nq<qpoints_car.length; nq++) {
            let result = utils.point_in_list(qpoints_car[nq],high_symmetry_points_car);
            if (result["found"]) {
                let label = high_symmetry_labels[result["index"]]
                highsym_qpts_index[nq] = label;
            }
        }

        this.distances = [0];
        this.line_breaks = []
        let nqstart = 0;
        let dist = 0;
        for (let nq=1; nq<this.kpoints.length; nq++) {
            if ((nq in highsym_qpts_index) && (nq-1 in highsym_qpts_index) &&
                (highsym_qpts_index[nq] != highsym_qpts_index[nq-1])) {
                highsym_qpts_index[nq] += "|"+highsym_qpts_index[nq-1];
                delete highsym_qpts_index[nq-1];
                this.line_breaks.push([nqstart,nq]);
                nqstart = nq;
            }
            else
            {
                dist = dist + mat.distance(this.kpoints[nq-1],this.kpoints[nq]);
            }
            this.distances.push(dist);
        }
        this.line_breaks.push([nqstart,this.kpoints.length]);

        this.highsym_qpts = {}
        for (let nq in highsym_qpts_index) {
            let pointDistance = this.distances[nq];
            let label = highsym_qpts_index[nq];
            this.highsym_qpts[pointDistance] = label;
        }

        this.qindex = {};
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        let eig = data["frequencies"];
        let eiv = data["eigendisplacements"];
        let nbands = eig.length;
        let nqpoints = eig[0].length;
        this.vec = [];
        this.eigenvalues = [];
        for (let nq=0; nq<nqpoints; nq++) {
            let eig_qpoint = [];
            let eiv_qpoint = [];

            for (let n=0; n<nbands; n++) {
                eig_qpoint.push(eig[n][nq]*thz2cm1);

                let eiv_qpoint_atoms = [];
                for (let a=0; a<this.natoms; a++) {
                    let mode = eiv[n][nq][a];
                    let x = this.parseOpenDataComplex(mode[0]);
                    let y = this.parseOpenDataComplex(mode[1]);
                    let z = this.parseOpenDataComplex(mode[2]);

                    eiv_qpoint_atoms.push([
                        [x[0],x[1]],
                        [y[0],y[1]],
                        [z[0],z[1]]
                    ]);
                }
                eiv_qpoint.push(eiv_qpoint_atoms);
            }
            this.eigenvalues.push(eig_qpoint);
            this.vec.push(eiv_qpoint);
        }

        this.normalizeEigenvectors();
        callback();
    }

    getFromPMGJson(data,callback) {
        /*
        It was determined that the json dictionary is the pymatgen format
        */

        this.addatomphase = false;

        //system information (not needed for now)
        let structure = data["structure"];

        //lattice
        this.lat = structure["lattice"]["matrix"];
        let rlat = utils.rec_lat(this.lat);
        this.repetitions = [3,3,3];

        this.atom_pos_car = [];
        this.atom_pos_red = [];
        this.atom_types = [];
        this.atom_numbers = [];

        let sites = structure["sites"];
        for (let i=0; i<sites.length; i++) {
            let site = sites[i];

            let atom_type = site['label'];
            this.atom_types.push(atom_type);
            this.atom_numbers.push(atomic_data.atomic_number[atom_type]);
            this.atom_pos_car.push(site['xyz']);
            this.atom_pos_red.push(site['abc']);
        }

        this.natoms = sites.length;
        this.name = utils.get_formula(this.atom_types);

        //dispersion
        let qpoints_red = data['qpoints'];
        let qpoints_car = utils.red_car_list(qpoints_red,rlat);
        this.kpoints = qpoints_red;

        /*
        get high symmetry qpoints
        Where we have to match the qpoint with a certain label with the
        high-symmetry point
        */
        let labels_dict = data["labels_dict"];
        let high_symmetry_points_red = [];
        let high_symmetry_labels = [];
        for (let label in labels_dict) {
            let qpoint = labels_dict[label];
            high_symmetry_points_red.push(qpoint);
            high_symmetry_labels.push(label);
        }

        let high_symmetry_points_car = utils.red_car_list(high_symmetry_points_red,rlat);
        let highsym_qpts_index = {}
        for (let nq=0; nq<qpoints_car.length; nq++) {
            let result = utils.point_in_list(qpoints_car[nq],high_symmetry_points_car);
            if (result["found"]) {
                let label = high_symmetry_labels[result["index"]]
                highsym_qpts_index[nq] = label;
            }
        }

        //calculate the distances between the qpoints
        this.distances = [0];
        this.line_breaks = []
        let nqstart = 0;
        let dist = 0;
        for (let nq=1; nq<this.kpoints.length; nq++) {
            //handle jumps
            if ((nq in highsym_qpts_index) && (nq-1 in highsym_qpts_index) &&
                (highsym_qpts_index[nq] != highsym_qpts_index[nq-1])) {
                highsym_qpts_index[nq] += "|"+highsym_qpts_index[nq-1];
                delete highsym_qpts_index[nq-1];
                this.line_breaks.push([nqstart,nq]);
                nqstart = nq;
            }
            else
            {
                dist = dist + mat.distance(this.kpoints[nq-1],this.kpoints[nq]);
            }
            this.distances.push(dist);
        }
        this.line_breaks.push([nqstart,this.kpoints.length]);

        this.highsym_qpts = {}
        for (let nq in highsym_qpts_index) {
            let dist = this.distances[nq];
            let label = highsym_qpts_index[nq];
            this.highsym_qpts[dist] = label;
        }

        //get qindex
        this.qindex = {};
        for (let i=0; i<this.distances.length; i++) {
            this.qindex[this.distances[i]] = i;
        }

        /*
        fill in the list of eigenvalues and eigenvectors
        I will transpose to keep compatibility between the old interfaces
        even though this is super ugly
        */
        let eig = data["bands"];
        let eiv = data["eigendisplacements"];
        let nbands = eig.length;
        let nqpoints = eig[0].length;

        this.vec = [];
        this.eigenvalues = [];
        for (let nq=0; nq<nqpoints; nq++) {
            let eig_qpoint = [];
            let eiv_qpoint = [];

            for (let n=0; n<nbands; n++) {
                eig_qpoint.push(eig[n][nq]*thz2cm1);

                let eiv_qpoint_atoms = [];

                for (let a=0; a<this.natoms; a++) {
                    let real = eiv["real"][n][nq][a];
                    let imag = eiv["imag"][n][nq][a];

                    let x = [real[0],imag[0]];
                    let y = [real[1],imag[1]];
                    let z = [real[2],imag[2]];

                    eiv_qpoint_atoms.push([x,y,z]);
                }
                eiv_qpoint.push(eiv_qpoint_atoms);
            }
            this.eigenvalues.push(eig_qpoint);
            this.vec.push(eiv_qpoint);
        }

        this.normalizeEigenvectors();
        callback();
    }

    getLineBreaks(data) {
        //get line breaks
        if ("line_breaks" in data) {
            this.line_breaks = data["line_breaks"]
        }
        else {
            //no line breaks
            this.line_breaks = [[0,this.kpoints.length]];
        }
    }

}
