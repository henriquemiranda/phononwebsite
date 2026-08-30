import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PhononHighcharts } from '../src/phononhighcharts.js';

describe('PhononHighcharts selection sync', () => {
  it('selects points using bandIndex metadata instead of series name', () => {
    const chartHelper = new PhononHighcharts(null);
    let deselected = false;
    let selected = false;
    const previousPoint = {
      select(value) {
        if (value === false) {
          deselected = true;
        }
      },
    };
    const targetPoint = {
      x: 1.25,
      select(value) {
        if (value === true) {
          selected = true;
        }
      },
    };

    chartHelper.selectedPoint = previousPoint;
    chartHelper.selectedBandIndex = 0;
    chartHelper.selectedX = 0.0;
    chartHelper.chart = {
      series: [
        {
          name: 'custom-label',
          options: {
            bandIndex: 4,
          },
          points: [targetPoint],
        },
      ],
    };

    chartHelper.selectModePoint({ distances: [1.25] }, 0, 4);

    assert.equal(deselected, true);
    assert.equal(selected, true);
    assert.equal(chartHelper.selectedPoint, targetPoint);
    assert.equal(chartHelper.selectedBandIndex, 4);
    assert.equal(chartHelper.selectedX, 1.25);
  });

  it('prefers the exact k-index when multiple points share the same x position', () => {
    const chartHelper = new PhononHighcharts(null);
    let selectedPoint = null;
    const firstPoint = {
      x: 2.0,
      options: { kIndex: 5 },
      select(value) {
        if (value === true) {
          selectedPoint = 'first';
        }
      },
    };
    const secondPoint = {
      x: 2.0,
      options: { kIndex: 6 },
      select(value) {
        if (value === true) {
          selectedPoint = 'second';
        }
      },
    };

    chartHelper.chart = {
      series: [
        {
          name: '4',
          options: { bandIndex: 4 },
          points: [firstPoint, secondPoint],
        },
      ],
    };

    chartHelper.selectModePoint({ distances: [0, 0, 0, 0, 0, 2.0, 2.0] }, 6, 4);

    assert.equal(selectedPoint, 'second');
    assert.equal(chartHelper.selectedK, 6);
  });

  it('clears a stale selectedPoint when update() rebuilds the chart', () => {
    // regression test: update() destroys and recreates this.chart, but a
    // previously selectModePoint()-selected point from the OLD (now dead)
    // chart was never cleared. The next selectModePoint() call (which
    // update() always triggers via PhononWebpage.update()) would then call
    // .select(false, false) on that dead point, and Highcharts throws trying
    // to reach the point's now-nonexistent chart. Reproduced by clicking any
    // Raman-spectrum peak, then changing anything that reloads the phonon
    // (an alloy slider, a zumba geometry dropdown) -- the reload silently
    // aborts partway through PhononWebpage.update() and the display freezes.
    const chartHelper = new PhononHighcharts([{}]);

    let deadPointSelectCalled = false;
    chartHelper.selectedPoint = {
      select() {
        deadPointSelectCalled = true;
        throw new TypeError("Cannot read properties of undefined (reading 'chart')");
      },
    };
    chartHelper.selectedBandIndex = 3;
    chartHelper.selectedK = 0;
    chartHelper.selectedX = 0;

    const oldChart = { destroy() {}, series: [] };
    chartHelper.chart = oldChart;

    const originalHighcharts = globalThis.Highcharts;
    globalThis.Highcharts = {
      chart() {
        return { series: [], xAxis: [{}], destroy() {} };
      },
    };

    try {
      chartHelper.update({
        eigenvalues: [[10, 20]],
        highsym_qpts: {},
        distances: [0],
        line_breaks: [[0, 1]],
      });
    } finally {
      globalThis.Highcharts = originalHighcharts;
    }

    assert.equal(deadPointSelectCalled, false);
    assert.equal(chartHelper.selectedPoint, null);
    assert.equal(chartHelper.selectedBandIndex, null);
    assert.equal(chartHelper.selectedK, null);
    assert.equal(chartHelper.selectedX, null);

    // the next selectModePoint() call (as PhononWebpage.update() always
    // issues right after dispersion.update()) must not throw either.
    assert.doesNotThrow(() => {
      chartHelper.selectModePoint({ distances: [0] }, 0, 3);
    });
  });
});
