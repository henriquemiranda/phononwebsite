import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  setupLegacyTestEnv,
  teardownLegacyTestEnv,
} from './helpers/legacy-test-env.mjs';

import { PhononJson } from '../src/phononjson.js';

describe('PhononJson raman fields', () => {
  let dom;

  beforeEach(() => {
    ({ dom } = setupLegacyTestEnv());
  });

  afterEach(() => {
    teardownLegacyTestEnv(dom);
  });

  it('exposes raman_intensities and gamma_index from the json payload', async () => {
    const phonon = new PhononJson();

    await new Promise((resolve) => {
      phonon.getFromInternalJson({
        name: 'Graphene',
        natoms: 2,
        atom_types: ['C', 'C'],
        atom_numbers: [6, 6],
        atom_pos_car: [[0, 0, 0], [1, 1, 1]],
        atom_pos_red: [[0, 0, 0], [0.5, 0.5, 0.5]],
        lattice: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        qpoints: [[0, 0, 0], [0.5, 0, 0]],
        distances: [0, 1],
        formula: 'C2',
        eigenvalues: [
          [0, 0, 0, 1350, 1580, 1580],
          [50, 60, 70, 1300, 1550, 1560],
        ],
        repetitions: [1, 1, 1],
        highsym_qpts: [[0, 'GAMMA'], [1, 'M']],
        line_breaks: [[0, 1]],
        raman_intensities: [0, 0, 0, 0.42, 1.0, 0.85],
        gamma_index: 0,
      }, resolve);
    });

    assert.deepEqual(phonon.raman_intensities, [0, 0, 0, 0.42, 1.0, 0.85]);
    assert.equal(phonon.gamma_index, 0);
  });

  it('defaults gamma_index to 0 and raman_intensities to null when absent', async () => {
    const phonon = new PhononJson();

    await new Promise((resolve) => {
      phonon.getFromInternalJson({
        name: 'Graphene',
        natoms: 2,
        atom_types: ['C', 'C'],
        atom_numbers: [6, 6],
        atom_pos_car: [[0, 0, 0], [1, 1, 1]],
        atom_pos_red: [[0, 0, 0], [0.5, 0.5, 0.5]],
        lattice: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        qpoints: [[0, 0, 0]],
        distances: [0],
        formula: 'C2',
        eigenvalues: [[0, 0, 0, 1350, 1580, 1580]],
        repetitions: [1, 1, 1],
        highsym_qpts: [[0, 'GAMMA']],
        line_breaks: [[0, 0]],
      }, resolve);
    });

    assert.equal(phonon.raman_intensities, null);
    assert.equal(phonon.gamma_index, 0);
  });
});
