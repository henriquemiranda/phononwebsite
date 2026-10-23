/*
 * ramandb.js — Raman spectra of the Computational Raman Database
 * (M. Bagheri and H.-P. Komsa, Sci. Data 10, 80 (2023), CC BY 4.0).
 *
 * The database stores the Raman tensor of every Raman-active Gamma mode of a
 * material in a small yaml file named after its Materials Project id. They are
 * fetched at runtime, one material at a time, through the CORS proxy in
 * proxy/ramandb (ramandb.oulu.fi itself does not allow cross-origin requests),
 * so nothing is added to the local database.
 *
 * The tensors were computed on the database's own phonon calculation, so its
 * modes are attached to the Gamma modes shown on the page by frequency.
 */

import jsyaml from 'js-yaml';

//base url of the deployed proxy/ramandb worker, Raman spectra are disabled while empty
export const RAMANDB_PROXY_URL = 'https://ramandb-proxy.rashmidotexe.workers.dev';

export const RAMANDB_REFERENCE = {
    text: 'Computational Raman Database (M. Bagheri and H.-P. Komsa, Sci. Data 10, 80 (2023))',
    url: 'https://ramandb.oulu.fi/',
    license: 'CC BY 4.0',
};

//Exact SI constants for the Raman Stokes intensity conversion.
const h = 6.62607015e-34;
const c = 299792458.0;
const kB = 1.380649e-23;

const tensorCache = new Map();

export function getMaterialsProjectId(urlVars) {
    /*
    mp-id of the material from its link or file name, null for other sources
    */
    for (let key of ['link', 'json']) {
        let match = urlVars && urlVars[key] ? /\bmp-(\d+)\b/.exec(urlVars[key]) : null;
        if (match) {
            return 'mp-' + match[1];
        }
    }
    return null;
}

export function parseRamanTensors(text) {
    /*
    yaml of the database -> [{bandIndex, frequency, tensor}]
    with zero-based band indices and frequencies in cm-1
    */
    let data = jsyaml.load(text);
    if (!data || !Array.isArray(data.raman_activities)) {
        throw new Error('No raman_activities in the Raman database file');
    }
    return data.raman_activities.map((mode) => ({
        bandIndex: mode.band_index - 1,
        frequency: mode['frequency(1/cm)'],
        tensor: mode.raman_tensor,
    }));
}

export function ramanActivity(tensor) {
    /*
    orientationally averaged activity 45 a^2 + 7 g^2 of a mode Raman tensor
    */
    let t = (i, j) => (tensor[i][j] + tensor[j][i]) / 2;
    let a = (t(0, 0) + t(1, 1) + t(2, 2)) / 3;
    let g2 = 0.5 * ((t(0, 0) - t(1, 1)) ** 2 + (t(1, 1) - t(2, 2)) ** 2 + (t(2, 2) - t(0, 0)) ** 2)
           + 3 * (t(0, 1) ** 2 + t(1, 2) ** 2 + t(2, 0) ** 2);
    return 45 * a * a + 7 * g2;
}

export function stokesIntensityFactor(frequency, temperature = 300.0) {
    /*
    (1 / freq) * (n_v + 1), same conversion as read_qe_phonon.py
    */
    if (!(frequency > 0)) {
        return 0;
    }
    let f = frequency * 100.0;
    let n = 1.0 / Math.expm1((h * c * f) / (kB * temperature));
    return (1.0 / f) * (n + 1.0);
}

export function mapRamanIntensities(modes, gammaFrequencies) {
    /*
    normalized Stokes intensities indexed like gammaFrequencies

    each database mode is added to the Gamma mode with the closest frequency;
    band indices are not used directly because the page includes the LO-TO
    splitting at Gamma, which reorders the polar modes
    */
    let nbands = gammaFrequencies.length;
    if (!modes.length || modes.some((mode) => mode.bandIndex < 0 || mode.bandIndex >= nbands)) {
        return null;
    }

    let intensities = new Array(nbands).fill(0);
    for (let mode of modes) {
        let closest = 0;
        for (let n = 1; n < nbands; n++) {
            if (Math.abs(gammaFrequencies[n] - mode.frequency) <
                Math.abs(gammaFrequencies[closest] - mode.frequency)) {
                closest = n;
            }
        }
        intensities[closest] += ramanActivity(mode.tensor) * stokesIntensityFactor(mode.frequency);
    }

    let maxValue = Math.max(...intensities);
    if (!(maxValue > 0)) {
        return null;
    }
    return intensities.map((value) => value / maxValue);
}

export function fetchRamanTensors(materialId, proxyUrl = RAMANDB_PROXY_URL) {
    /*
    Raman modes of a material, null if the database does not have it
    */
    if (!proxyUrl || !materialId) {
        return Promise.resolve(null);
    }
    if (!tensorCache.has(materialId)) {
        let request = fetch(proxyUrl.replace(/\/$/, '') + '/' + materialId)
            .then((response) => {
                if (response.status === 404) { return null; }
                if (!response.ok) {
                    throw new Error('Raman database request failed: HTTP ' + response.status);
                }
                return response.text().then(parseRamanTensors);
            })
            .catch((error) => {
                //do not keep failures so the material can be retried later
                tensorCache.delete(materialId);
                console.warn('Unable to load Raman tensors for ' + materialId + ':', error);
                return null;
            });
        tensorCache.set(materialId, request);
    }
    return tensorCache.get(materialId);
}

export function findGammaIndex(qpoints) {
    if (!qpoints) { return -1; }
    return qpoints.findIndex((q) => q.every((x) => Math.abs(x) < 1e-5));
}
