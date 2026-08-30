from pathlib import Path

import numpy as np

from phononweb.scripts.read_qe_phonon import (
    read_raman_intensities,
    stokes_intensity_factor,
)

FIXTURE_DYNMAT = (
    Path(__file__).resolve().parents[3]
    / 'test'
    / 'fixtures'
    / 'espresso'
    / 'gr.dynmat.out'
)


def test_read_raman_intensities_parses_dynmat_table():
    intensities = read_raman_intensities(str(FIXTURE_DYNMAT))

    # graphene has 6 modes at gamma: 3 acoustic (silent) + 2 degenerate E2g + 1 A1g'-like
    assert intensities == [0.0, 0.0, 0.0, 12.5, 8.4, 8.4]


def test_read_raman_intensities_missing_file_returns_none():
    assert read_raman_intensities(str(FIXTURE_DYNMAT.with_name('does_not_exist.out'))) is None


def test_stokes_intensity_factor_is_zero_at_zero_frequency():
    factor = stokes_intensity_factor([0.0], 300.0)

    assert factor.tolist() == [0.0]


def test_stokes_intensity_factor_matches_reference_values():
    # graphene's two optical branches at gamma (cm-1), T=300K
    frequencies = [911.740895, 1604.085116]

    factor = stokes_intensity_factor(frequencies, 300.0)

    np.testing.assert_allclose(factor, [1.11081904e-05, 6.23692705e-06], rtol=1e-6)
