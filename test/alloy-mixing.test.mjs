import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { buildMixedInternalJson } from '../src/alloymix.js';
import { solveHermitianEigenSystem } from '../src/dynamicalmatrix.js';
import { PhononHighcharts } from '../src/phononhighcharts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
    return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'alloy', name), 'utf8'));
}

describe('alloy dynamical-matrix mixing', () => {
    const endmemberS = loadFixture('bazrs3.json');
    const endmemberSe = loadFixture('bazrse3.json');

    it('reproduces the pure BaZrS3 spectrum at x=0 with native mass', async () => {
        const mixed = buildMixedInternalJson(endmemberS, endmemberSe, 0, 32.06);
        const { eigenvaluesCm1 } = await solveHermitianEigenSystem(mixed.dynamical_matrix, [0, 0, 0]);
        const sorted = [...eigenvaluesCm1].sort((a, b) => a - b);

        // Reference from QE dynmat.x on bazrs3.dyn (native S mass, asr='crystal').
        const referenceOptical = [49.18, 50.88, 60.91, 63.10, 64.10, 67.11, 68.78];
        for (let i = 0; i < referenceOptical.length; i++) {
            assert.ok(
                Math.abs(sorted[i + 3] - referenceOptical[i]) < 0.05,
                `mode ${i + 3}: got ${sorted[i + 3]}, expected ~${referenceOptical[i]}`
            );
        }
        // acoustic modes should be small (translational-ASR approximation, not exactly 0)
        for (let i = 0; i < 3; i++) {
            assert.ok(Math.abs(sorted[i]) < 1, `acoustic mode ${i} too large: ${sorted[i]}`);
        }
    });

    it('reproduces the pure BaZrSe3 spectrum at x=1 with native mass', async () => {
        const mixed = buildMixedInternalJson(endmemberS, endmemberSe, 1, 78.97);
        const { eigenvaluesCm1 } = await solveHermitianEigenSystem(mixed.dynamical_matrix, [0, 0, 0]);
        const sorted = [...eigenvaluesCm1].sort((a, b) => a - b);

        // Reference from QE dynmat.x on bazrse3.dyn (native Se mass, asr='crystal').
        const referenceOptical = [22.58, 38.67, 49.75, 50.53, 54.89];
        for (let i = 0; i < referenceOptical.length; i++) {
            assert.ok(
                Math.abs(sorted[i + 3] - referenceOptical[i]) < 0.05,
                `mode ${i + 3}: got ${sorted[i + 3]}, expected ~${referenceOptical[i]}`
            );
        }
    });

    it('matches real cluster-computed ground truth at x=0.05, m=34.41', async () => {
        const mixed = buildMixedInternalJson(endmemberS, endmemberSe, 0.05, 34.41);
        const { eigenvaluesCm1 } = await solveHermitianEigenSystem(mixed.dynamical_matrix, [0, 0, 0]);
        const sorted = [...eigenvaluesCm1].sort((a, b) => a - b);

        // ground truth: alloydb/BaZr_x_0.05_m_34.41.json from the closed PR #37 branch
        const reference = [48.164558, 50.295745, 60.696143, 62.567842, 63.732195, 66.730342, 67.919162];
        for (let i = 0; i < reference.length; i++) {
            assert.ok(
                Math.abs(sorted[i + 3] - reference[i]) < 0.05,
                `mode ${i + 3}: got ${sorted[i + 3]}, expected ~${reference[i]}`
            );
        }
    });

    it('matches real cluster-computed ground truth at x=0.50, m=55.52', async () => {
        const mixed = buildMixedInternalJson(endmemberS, endmemberSe, 0.5, 55.52);
        const { eigenvaluesCm1 } = await solveHermitianEigenSystem(mixed.dynamical_matrix, [0, 0, 0]);
        const sorted = [...eigenvaluesCm1].sort((a, b) => a - b);

        // ground truth: alloydb/BaZr_x_0.50_m_55.52.json from the closed PR #37 branch
        const reference = [37.970018, 44.88604, 56.995197, 58.308366, 59.983849, 60.224575, 62.755419];
        for (let i = 0; i < reference.length; i++) {
            assert.ok(
                Math.abs(sorted[i + 3] - reference[i]) < 0.05,
                `mode ${i + 3}: got ${sorted[i + 3]}, expected ~${reference[i]}`
            );
        }
    });

    it('plots all 60 modes on the frequency-axis chart at Gamma', () => {
        // regression test: line_breaks: [[0, 0]] (an empty range) silently
        // produced zero chart series -- the alloy page would show a completely
        // blank frequency axis with no way to browse or select modes.
        const mixed = buildMixedInternalJson(endmemberS, endmemberSe, 0.3, 50);
        mixed.eigenvalues = [new Array(60).fill(0).map((_, i) => i)];

        const chartHelper = new PhononHighcharts(null);
        chartHelper.getGraph(mixed);

        assert.equal(chartHelper.highcharts.length, 60);
        for (const series of chartHelper.highcharts) {
            assert.equal(series.data.length, 1);
            assert.equal(series.data[0].kIndex, 0);
        }
    });
});
