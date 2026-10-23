import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  setupLegacyTestEnv,
  teardownLegacyTestEnv,
} from './helpers/legacy-test-env.mjs';

import {
  getMaterialsProjectId,
  parseRamanTensors,
  ramanActivity,
  stokesIntensityFactor,
  mapRamanIntensities,
  fetchRamanTensors,
  findGammaIndex,
} from '../src/ramandb.js';
import worker, { getMaterialId } from '../proxy/ramandb/worker.js';

//excerpt of ramandb.oulu.fi/figs/tensors_yaml/mp-2542.yaml (BeO, CC BY 4.0)
const BEO_YAML = `raman_activities:
- #0
  band_index: 4
  frequency(1/cm):     323.26627643
  raman_tensor:
  - [      -0.00782796,      -0.02895711,       0.00000000  ]
  - [      -0.02898474,       0.00780094,       0.00000000  ]
  - [       0.00000000,       0.00000000,      -0.00000430  ]
- #1
  band_index: 5
  frequency(1/cm):     323.26627767
  raman_tensor:
  - [      -0.02898904,       0.00773217,       0.00000000  ]
  - [       0.00768735,       0.02905474,       0.00000000  ]
  - [       0.00000000,       0.00000000,       0.00000491  ]
- #2
  band_index: 6
  frequency(1/cm):     694.85954908
  raman_tensor:
  - [      -0.22216581,       0.00000000,       0.00000000  ]
  - [       0.00000000,      -0.22216514,       0.00000000  ]
  - [       0.00000000,       0.00000000,       0.45151009  ]
`;

const ISOTROPIC = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push(url);
    return handler(url);
  };
  return calls;
}

describe('ramandb', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('extracts the Materials Project id from the link or the file name', () => {
    assert.equal(getMaterialsProjectId({ link: 'https://materialsproject.org/materials/mp-2542' }), 'mp-2542');
    assert.equal(getMaterialsProjectId({ json: 'data/phonondb2017/mp-149.json.gz' }), 'mp-149');
    assert.equal(getMaterialsProjectId({ json: 'localdb/graphene/data.json' }), null);
    assert.equal(getMaterialsProjectId({}), null);
  });

  it('parses the tensors with zero-based band indices', () => {
    const modes = parseRamanTensors(BEO_YAML);
    assert.equal(modes.length, 3);
    assert.equal(modes[0].bandIndex, 3);
    assert.equal(modes[2].frequency, 694.85954908);
    assert.deepEqual(modes[2].tensor[2], [0, 0, 0.45151009]);
    assert.throws(() => parseRamanTensors('foo: 1'), /raman_activities/);
  });

  it('computes the orientationally averaged activity 45 a^2 + 7 g^2', () => {
    assert.equal(ramanActivity(ISOTROPIC), 45);
    //traceless symmetric xy tensor: a = 0, g^2 = 3
    assert.equal(ramanActivity([[0, 1, 0], [1, 0, 0], [0, 0, 0]]), 21);
  });

  it('matches the Stokes conversion of read_qe_phonon.py', () => {
    assert.ok(Math.abs(stokesIntensityFactor(500.0) / 2.1999854388424837e-05 - 1) < 1e-12);
    assert.ok(Math.abs(stokesIntensityFactor(1580.0) / 6.332354882954042e-06 - 1) < 1e-12);
    assert.equal(stokesIntensityFactor(0), 0);
  });

  it('attaches database modes to the closest Gamma frequency and normalizes', () => {
    //page Gamma modes are not energy ordered and include an LO mode at 900
    const gamma = [0, 0, 0, 900, 320, 321, 690];
    const modes = parseRamanTensors(BEO_YAML);
    const intensities = mapRamanIntensities(modes, gamma);

    assert.equal(intensities.length, gamma.length);
    assert.equal(intensities[3], 0);
    assert.equal(Math.max(...intensities), 1);
    //both E2 partners land on the closest page mode
    assert.ok(intensities[5] > 0);
    assert.equal(intensities[4], 0);
    assert.ok(intensities[6] > 0);
  });

  it('rejects tensors that do not fit the material', () => {
    const tooFewBands = [0, 0, 0];
    assert.equal(mapRamanIntensities(parseRamanTensors(BEO_YAML), tooFewBands), null);
    assert.equal(mapRamanIntensities([], [0, 0, 0]), null);
  });

  it('finds the Gamma point of the path', () => {
    assert.equal(findGammaIndex([[0.5, 0, 0], [0, 0, 0]]), 1);
    assert.equal(findGammaIndex([[0.5, 0, 0]]), -1);
  });

  it('fetches each material once through the proxy and treats 404 as missing', async () => {
    const calls = mockFetch((url) => url.endsWith('mp-2542')
      ? new Response(BEO_YAML, { status: 200 })
      : new Response('Not found', { status: 404 }));

    const first = await fetchRamanTensors('mp-2542', 'https://proxy.test/');
    const second = await fetchRamanTensors('mp-2542', 'https://proxy.test/');
    assert.equal(first.length, 3);
    assert.equal(second, first);
    assert.deepEqual(calls, ['https://proxy.test/mp-2542']);

    assert.equal(await fetchRamanTensors('mp-9999999', 'https://proxy.test'), null);
  });

  it('does nothing without a proxy', async () => {
    const calls = mockFetch(() => { throw new Error('should not fetch'); });
    assert.equal(await fetchRamanTensors('mp-1', ''), null);
    assert.equal(calls.length, 0);
  });

  it('retries a material after a network failure', async () => {
    let fail = true;
    mockFetch(() => {
      if (fail) { throw new Error('offline'); }
      return new Response(BEO_YAML, { status: 200 });
    });
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      assert.equal(await fetchRamanTensors('mp-7777', 'https://proxy.test'), null);
    } finally {
      console.warn = originalWarn;
    }
    fail = false;
    assert.equal((await fetchRamanTensors('mp-7777', 'https://proxy.test')).length, 3);
  });
});

describe('PhononWebpage.loadRamanDatabase', () => {
  let dom;
  let PhononWebpage;
  let originalFetch;

  beforeEach(async () => {
    ({ dom } = setupLegacyTestEnv());
    ({ PhononWebpage } = await import('../src/phononwebpage.js'));
    originalFetch = globalThis.fetch;
    mockFetch(() => new Response(BEO_YAML, { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    teardownLegacyTestEnv(dom);
  });

  function makePage(phonon, id) {
    return {
      phonon: phonon,
      ramanDbId: id,
      ramanDbProxyUrl: 'https://proxy.test',
      plotted: 0,
      plotRaman() { this.plotted++; },
    };
  }

  function makePhonon() {
    return {
      kpoints: [[0.5, 0, 0], [0, 0, 0]],
      eigenvalues: [[10, 20, 30, 40, 50, 60], [0, 0, 0, 323, 324, 695]],
      raman_intensities: null,
    };
  }

  it('adds the database spectrum to materials without one', async () => {
    const page = makePage(makePhonon(), 'mp-11111');
    await PhononWebpage.prototype.loadRamanDatabase.call(page);

    assert.equal(page.phonon.gamma_index, 1);
    assert.equal(page.phonon.raman_intensities.length, 6);
    assert.ok(page.phonon.raman_source.url.includes('ramandb.oulu.fi'));
    assert.equal(page.plotted, 1);
  });

  it('keeps Raman data that came with the file', async () => {
    const phonon = makePhonon();
    phonon.raman_intensities = [0, 0, 0, 1, 0, 0];
    const page = makePage(phonon, 'mp-11112');
    await PhononWebpage.prototype.loadRamanDatabase.call(page);

    assert.deepEqual(phonon.raman_intensities, [0, 0, 0, 1, 0, 0]);
    assert.equal(page.plotted, 0);
  });

  it('ignores a response for a material that is no longer shown', async () => {
    const phonon = makePhonon();
    const page = makePage(phonon, 'mp-11113');
    const pending = PhononWebpage.prototype.loadRamanDatabase.call(page);
    page.phonon = makePhonon();
    await pending;

    assert.equal(phonon.raman_intensities, null);
    assert.equal(page.phonon.raman_intensities, null);
    assert.equal(page.plotted, 0);
  });
});

describe('ramandb proxy worker', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('only accepts material ids', () => {
    assert.equal(getMaterialId('/mp-2542'), 'mp-2542');
    assert.equal(getMaterialId('/mp-2542.yaml'), null);
    assert.equal(getMaterialId('/../figs/x'), null);
    assert.equal(getMaterialId('/'), null);
  });

  it('forwards the tensor file with CORS headers', async () => {
    const calls = mockFetch(() => new Response(BEO_YAML, { status: 200 }));
    const response = await worker.fetch(new Request('https://w.test/mp-2542'), {}, {});

    assert.deepEqual(calls, ['https://ramandb.oulu.fi/figs/tensors_yaml/mp-2542.yaml']);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(await response.text(), BEO_YAML);
  });

  it('rejects other paths without contacting the database', async () => {
    const calls = mockFetch(() => new Response('', { status: 200 }));
    const response = await worker.fetch(new Request('https://w.test/figs/phonon_yaml/mp-1.yaml'), {}, {});

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(calls.length, 0);
  });

  it('passes missing materials on as 404', async () => {
    mockFetch(() => new Response('', { status: 404 }));
    const response = await worker.fetch(new Request('https://w.test/mp-1'), {}, {});
    assert.equal(response.status, 404);
  });
});
