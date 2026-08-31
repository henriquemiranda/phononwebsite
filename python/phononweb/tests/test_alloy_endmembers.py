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


def _diagonalize_with_vectors(fc, atom_types, m_amu, apply_asr=True):
    natoms = fc.shape[0]
    fc = fc.copy()
    if apply_asr:
        for i in range(natoms):
            fc[i] -= fc[i].mean(axis=0)

    masses_native = np.array([
        BA_AMU * AMU_TO_NATIVE if t == "Ba" else
        ZR_AMU * AMU_TO_NATIVE if t == "Zr" else
        m_amu * AMU_TO_NATIVE
        for t in atom_types
    ])

    D = np.zeros((natoms * 3, natoms * 3), dtype=complex)
    for i in range(natoms):
        for j in range(natoms):
            sqrt_mm = np.sqrt(masses_native[i] * masses_native[j])
            D[i * 3:i * 3 + 3, j * 3:j * 3 + 3] = fc[i, j] / sqrt_mm
    D = (D + D.conj().T) / 2

    eigvals, eigvecs = np.linalg.eigh(D)
    freqs = np.sign(eigvals) * np.sqrt(np.abs(eigvals)) * RY_TO_CM1
    return freqs, eigvecs


def _mode_raman_activities(eigvecs, raman_tensor, atom_types, m_amu):
    natoms = len(atom_types)
    masses_amu = np.array([
        BA_AMU if t == "Ba" else ZR_AMU if t == "Zr" else m_amu for t in atom_types
    ])

    activities = np.zeros(eigvecs.shape[1])
    for n in range(eigvecs.shape[1]):
        displacement = eigvecs[:, n].reshape(natoms, 3).real / np.sqrt(masses_amu)[:, None]
        R = np.einsum("apxy,ap->xy", raman_tensor, displacement)
        a = np.trace(R).real / 3
        aniso2 = 0.5 * (
            (R[0, 0] - R[1, 1]) ** 2 + (R[1, 1] - R[2, 2]) ** 2 + (R[2, 2] - R[0, 0]) ** 2
        ) + 3 * (R[0, 1] ** 2 + R[1, 2] ** 2 + R[2, 0] ** 2)
        activities[n] = (45 * a ** 2 + 7 * aniso2).real
    return activities


def test_raman_activities_match_qe_reference_at_x0_native_s_mass():
    parsed = parse_qe_dynmat(str(FIXTURE_DIR / "bazrs3.dyn"))
    atom_types = [parsed["type_symbols"][t - 1] for t in parsed["atom_types"]]
    freqs, eigvecs = _diagonalize_with_vectors(parsed["dynamical_matrix"], atom_types, 32.06)
    order = np.argsort(freqs)
    activities = _mode_raman_activities(eigvecs, parsed["raman_tensor"], atom_types, 32.06)

    # reference: QE dynmat.x Raman column for bazrs3.dyn, native S mass (1-indexed modes)
    reference = {6: 42.8962, 9: 111.7040, 13: 20.3699, 16: 49.8196, 18: 5.3743,
                 19: 105.8911, 20: 322.9583, 21: 9.9834}
    for mode1, expected in reference.items():
        sorted_index = order[mode1 - 1]
        assert abs(activities[sorted_index] - expected) < 0.01, (mode1, activities[sorted_index], expected)


def test_raman_activities_match_qe_reference_for_mixed_x010_composition():
    parsed_s = parse_qe_dynmat(str(FIXTURE_DIR / "bazrs3.dyn"))
    parsed_se = parse_qe_dynmat(str(FIXTURE_DIR / "bazrse3.dyn"))
    atom_types = [parsed_s["type_symbols"][t - 1] for t in parsed_s["atom_types"]]

    x, m = 0.10, 36.75
    fc_mixed = (1 - x) * parsed_s["dynamical_matrix"] + x * parsed_se["dynamical_matrix"]
    raman_mixed = (1 - x) * parsed_s["raman_tensor"] + x * parsed_se["raman_tensor"]
    freqs, eigvecs = _diagonalize_with_vectors(fc_mixed, atom_types, m)
    order = np.argsort(freqs)
    activities = _mode_raman_activities(eigvecs, raman_mixed, atom_types, m)

    # reference: dynmat_alloy_10.out (x=10%, m=M_EFF(0.10)=36.75), 1-indexed modes
    reference = {6: 38.7286, 9: 136.2116, 15: 0.0172}
    for mode1, expected in reference.items():
        sorted_index = order[mode1 - 1]
        assert abs(activities[sorted_index] - expected) < 0.01, (mode1, activities[sorted_index], expected)


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
    assert payload["raman_tensor"] is not None
    assert len(payload["raman_tensor"]) == 20
    assert len(payload["raman_tensor"][0]) == 3
    assert len(payload["raman_tensor"][0][0]) == 3
