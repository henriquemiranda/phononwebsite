from pathlib import Path

import numpy as np

from phononweb.scripts.generate_alloy_endmembers import (
    AMU_TO_NATIVE,
    RY_TO_CM1,
    build_payload,
)
from phononweb.scripts.parse_qe_dynmat import parse_qe_dynmat

FIXTURE_DIR = (
    Path(__file__).resolve().parents[3] / "test" / "fixtures" / "qespresso" / "alloy"
)
BA_AMU, ZR_AMU = 137.327, 91.224


def _diagonalize(fc, atom_types, m_amu, apply_asr=True):
    natoms = fc.shape[0]
    fc = fc.copy()

    if apply_asr:
        # matches the 'translational' correction in src/dynamicalmatrix.js:
        # for each primitive atom i, subtract the mean over j from every (i,j) block
        for i in range(natoms):
            fc[i] -= fc[i].mean(axis=0)

    masses = np.array([
        BA_AMU * AMU_TO_NATIVE if t == "Ba" else
        ZR_AMU * AMU_TO_NATIVE if t == "Zr" else
        m_amu * AMU_TO_NATIVE
        for t in atom_types
    ])

    D = np.zeros((natoms * 3, natoms * 3), dtype=complex)
    for i in range(natoms):
        for j in range(natoms):
            sqrt_mm = np.sqrt(masses[i] * masses[j])
            D[i * 3:i * 3 + 3, j * 3:j * 3 + 3] = fc[i, j] / sqrt_mm
    D = (D + D.conj().T) / 2

    eigvals = np.linalg.eigvalsh(D)
    signed_sqrt = np.sign(eigvals) * np.sqrt(np.abs(eigvals))
    return np.sort(signed_sqrt * RY_TO_CM1)


def test_parses_both_endmembers_as_real_hermitian_gamma_matrices():
    for name in ("bazrs3.dyn", "bazrse3.dyn"):
        parsed = parse_qe_dynmat(str(FIXTURE_DIR / name))
        dynmat = parsed["dynamical_matrix"]
        assert parsed["natoms"] == 20
        assert abs(dynmat.imag).max() == 0.0
        assert np.allclose(dynmat, dynmat.transpose(1, 0, 3, 2).conj())


def test_matches_qe_reference_at_x0_native_s_mass():
    parsed = parse_qe_dynmat(str(FIXTURE_DIR / "bazrs3.dyn"))
    atom_types = [parsed["type_symbols"][t - 1] for t in parsed["atom_types"]]
    freqs = _diagonalize(parsed["dynamical_matrix"], atom_types, 32.06)

    # reference: QE dynmat.x on bazrs3.dyn, native S mass, asr='crystal'
    reference_optical = [49.18, 50.88, 60.91, 63.10, 64.10, 67.11, 68.78]
    np.testing.assert_allclose(freqs[3:10], reference_optical, atol=0.05)
    assert abs(freqs[:3]).max() < 1.0


def test_matches_qe_reference_at_x1_native_se_mass():
    parsed = parse_qe_dynmat(str(FIXTURE_DIR / "bazrse3.dyn"))
    atom_types = [parsed["type_symbols"][t - 1] for t in parsed["atom_types"]]
    freqs = _diagonalize(parsed["dynamical_matrix"], atom_types, 78.97)

    # reference: QE dynmat.x on bazrse3.dyn, native Se mass, asr='crystal'
    reference_optical = [22.58, 38.67, 49.75, 50.53, 54.89]
    np.testing.assert_allclose(freqs[3:8], reference_optical, atol=0.05)


def test_mixed_x_and_independent_m_match_real_grid_ground_truth():
    parsed_s = parse_qe_dynmat(str(FIXTURE_DIR / "bazrs3.dyn"))
    parsed_se = parse_qe_dynmat(str(FIXTURE_DIR / "bazrse3.dyn"))
    atom_types = [parsed_s["type_symbols"][t - 1] for t in parsed_s["atom_types"]]

    cases = [
        # (x, m, ground truth from alloydb/BaZr_x_<x>_m_<m>.json on the closed PR #37 branch)
        (0.05, 34.41, [48.164558, 50.295745, 60.696143, 62.567842, 63.732195, 66.730342, 67.919162]),
        (0.50, 55.52, [37.970018, 44.88604, 56.995197, 58.308366, 59.983849, 60.224575, 62.755419]),
    ]
    for x, m, reference in cases:
        fc_mixed = (1 - x) * parsed_s["dynamical_matrix"] + x * parsed_se["dynamical_matrix"]
        freqs = _diagonalize(fc_mixed, atom_types, m)
        np.testing.assert_allclose(freqs[3:3 + len(reference)], reference, atol=0.05)


def test_build_payload_produces_expected_shape():
    payload = build_payload(
        str(FIXTURE_DIR / "bazrs3.dyn"), name="BaZrS3", formula="Ba4S12Zr4"
    )
    dm = payload["dynamical_matrix"]
    assert payload["natoms"] == 20
    assert len(dm["force_constants_compact"]) == 20
    assert len(dm["force_constants_compact"][0]) == 20
    assert len(dm["masses"]) == 20
    # line_breaks is [start, end) -- must span the single q-point (k=0) or the
    # frequency-axis chart silently renders zero series (see getGraph in
    # src/phononhighcharts.js): getPlotSegments treats [0, 0] as an empty range.
    assert payload["line_breaks"] == [[0, 1]]
    assert payload["qpoints"] == [[0.0, 0.0, 0.0]]
    assert payload["distances"] == [0.0]
    assert dm["s2pp_map"] == list(range(20))
