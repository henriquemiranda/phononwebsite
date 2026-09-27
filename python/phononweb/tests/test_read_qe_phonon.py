from pathlib import Path

import numpy as np
import pytest

from phononweb.scripts.read_qe_phonon import (
    reorder_raman_activities,
    read_raman_intensities,
    stokes_intensity_factor,
)
from phononweb.qephonon import QePhonon

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


def test_reorder_raman_activities_uses_gamma_branch_order():
    assert reorder_raman_activities([10.0, 20.0, 30.0], [1, 0, 2]).tolist() == [20.0, 10.0, 30.0]


def test_reorder_raman_activities_rejects_mismatched_mode_counts():
    with pytest.raises(ValueError, match='Raman mode count'):
        reorder_raman_activities([10.0, 20.0], [0, 1, 2])


def test_reorder_eigenvalues_records_raw_mode_order_at_each_qpoint():
    phonon = QePhonon.__new__(QePhonon)
    phonon.nqpoints = 2
    phonon.nphons = 3
    phonon.natoms = 1
    phonon.eigenvalues = np.array([[100.0, 200.0, 300.0], [205.0, 105.0, 305.0]])
    phonon.eigenvectors = np.zeros((2, 3, 1, 3, 2))

    phonon.eigenvectors[0, 0, 0, 0, 0] = 1.0
    phonon.eigenvectors[0, 1, 0, 1, 0] = 1.0
    phonon.eigenvectors[0, 2, 0, 2, 0] = 1.0
    phonon.eigenvectors[1, 0, 0, 1, 0] = 1.0
    phonon.eigenvectors[1, 1, 0, 0, 0] = 1.0
    phonon.eigenvectors[1, 2, 0, 2, 0] = 1.0

    phonon.reorder_eigenvalues()

    assert phonon.mode_order.tolist() == [[0, 1, 2], [1, 0, 2]]
    np.testing.assert_allclose(phonon.eigenvalues[1], [105.0, 205.0, 305.0])
