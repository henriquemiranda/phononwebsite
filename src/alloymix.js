/*
 * alloymix.js — client-side mixing for the BaZr(S(1-x)Se(x))3 alloy page.
 *
 * Replaces a precomputed x/m grid of static json files with live mixing of
 * two small endpoint payloads (pure BaZrS3 and pure BaZrSe3), each carrying
 * a "runtime dynamical matrix" (see src/dynamicalmatrix.js) parsed directly
 * from the underlying QE .dyn files.
 *
 * Two independent controls, matching the validated generation pipeline:
 *   x - chalcogen fraction: linearly interpolates the dynamical matrix
 *       (force_constants_compact) between the two endpoints. Mixes bonding
 *       character.
 *   m - chalcogen mass (amu): overrides the chalcogen-site mass at
 *       diagonalization time, independent of x. Isolates the pure mass
 *       effect from the force-constant effect.
 */

const BA_AMU = 137.327;
const ZR_AMU = 91.224;

export function mixForceConstants(fcS, fcSe, x) {
    const natoms = fcS.length;
    const mixed = new Array(natoms);
    for (let i = 0; i < natoms; i++) {
        mixed[i] = new Array(natoms);
        for (let j = 0; j < natoms; j++) {
            const blockS = fcS[i][j];
            const blockSe = fcSe[i][j];
            const block = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    block[row][col] = (1 - x) * blockS[row][col] + x * blockSe[row][col];
                }
            }
            mixed[i][j] = block;
        }
    }
    return mixed;
}

export function buildMixedMasses(atomTypes, mAmu, amuToNative) {
    return atomTypes.map((type) => {
        if (type === 'Ba') return BA_AMU * amuToNative;
        if (type === 'Zr') return ZR_AMU * amuToNative;
        return mAmu * amuToNative;
    });
}

export function buildMixedMassesAmu(atomTypes, mAmu) {
    return atomTypes.map((type) => {
        if (type === 'Ba') return BA_AMU;
        if (type === 'Zr') return ZR_AMU;
        return mAmu;
    });
}

/**
 * Linearly interpolate the DFPT Raman tensor (d(chi)/du, shape
 * [atom][pol][alpha][beta]) between the two end-members. Same blanket
 * linear interpolation as the force constants -- verified against real
 * QE dynmat.x output to reproduce mode Raman activities exactly (see
 * python/phononweb/tests/test_alloy_endmembers.py).
 */
export function mixRamanTensor(rtS, rtSe, x) {
    const natoms = rtS.length;
    const mixed = new Array(natoms);
    for (let a = 0; a < natoms; a++) {
        mixed[a] = new Array(3);
        for (let p = 0; p < 3; p++) {
            const blockS = rtS[a][p];
            const blockSe = rtSe[a][p];
            const block = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    block[row][col] = (1 - x) * blockS[row][col] + x * blockSe[row][col];
                }
            }
            mixed[a][p] = block;
        }
    }
    return mixed;
}

/**
 * Compute the powder-averaged Raman activity for every mode, from raw
 * (mass-weighted) eigenvectors as returned by solveHermitianEigenSystem,
 * the (mixed) Raman tensor, and each atom's mass in amu.
 *
 * Formula (matches QE's dynmat.x exactly, validated against real
 * dynmat.out output for both end-members and mixed x/m compositions):
 *   displacement[atom][pol] = eigenvector[atom][pol] / sqrt(mass_amu[atom])
 *   R[alpha][beta] = sum_{atom,pol} ramanTensor[atom][pol][alpha][beta] * displacement[atom][pol]
 *   a = trace(R) / 3
 *   anisotropy^2 = 0.5*((Rxx-Ryy)^2+(Ryy-Rzz)^2+(Rzz-Rxx)^2) + 3*(Rxy^2+Ryz^2+Rzx^2)
 *   activity = 45*a^2 + 7*anisotropy^2
 */
export function computeRamanActivities(eigenvectors, ramanTensor, massesAmu) {
    const natoms = massesAmu.length;
    const nmodes = eigenvectors.length;
    const activities = new Array(nmodes);

    for (let n = 0; n < nmodes; n++) {
        const eigenvector = eigenvectors[n];
        const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

        for (let atom = 0; atom < natoms; atom++) {
            const invSqrtMass = 1 / Math.sqrt(massesAmu[atom]);
            for (let pol = 0; pol < 3; pol++) {
                const displacement = eigenvector[atom * 3 + pol][0] * invSqrtMass;
                const tensorBlock = ramanTensor[atom][pol];
                for (let alpha = 0; alpha < 3; alpha++) {
                    for (let beta = 0; beta < 3; beta++) {
                        R[alpha][beta] += tensorBlock[alpha][beta] * displacement;
                    }
                }
            }
        }

        const a = (R[0][0] + R[1][1] + R[2][2]) / 3;
        const anisotropy2 = 0.5 * (
            (R[0][0] - R[1][1]) ** 2 +
            (R[1][1] - R[2][2]) ** 2 +
            (R[2][2] - R[0][0]) ** 2
        ) + 3 * (R[0][1] ** 2 + R[1][2] ** 2 + R[2][0] ** 2);

        activities[n] = 45 * a * a + 7 * anisotropy2;
    }

    return activities;
}

export function mixAlloyDynamicalMatrix(endmemberS, endmemberSe, x, mAmu) {
    const dmS = endmemberS.dynamical_matrix;
    const dmSe = endmemberSe.dynamical_matrix;

    return {
        ...dmS,
        force_constants_compact: mixForceConstants(
            dmS.force_constants_compact,
            dmSe.force_constants_compact,
            x
        ),
        masses: buildMixedMasses(endmemberS.atom_types, mAmu, endmemberS.amu_to_native_mass_unit),
    };
}

/**
 * Compute Raman activities for the mixed alloy at (x, m), given the raw
 * eigenvectors from solveHermitianEigenSystem(mixedDynamicalMatrix, [0,0,0]).
 * Returns null if either end-member is missing raman_tensor data.
 */
export function computeMixedRamanIntensities(endmemberS, endmemberSe, x, mAmu, eigenvectors) {
    if (!endmemberS.raman_tensor || !endmemberSe.raman_tensor) {
        return null;
    }
    const ramanTensor = mixRamanTensor(endmemberS.raman_tensor, endmemberSe.raman_tensor, x);
    const massesAmu = buildMixedMassesAmu(endmemberS.atom_types, mAmu);
    return computeRamanActivities(eigenvectors, ramanTensor, massesAmu);
}

/**
 * Build a PhononJson "internal json" object for the mixed alloy at (x, m).
 * Structure/lattice/atom positions are always the fixed BaZrS3 reference
 * geometry (endmemberS) -- only the dynamical matrix changes with x/m.
 */
export function buildMixedInternalJson(endmemberS, endmemberSe, x, mAmu) {
    return {
        name: endmemberS.name,
        formula: endmemberS.formula,
        natoms: endmemberS.natoms,
        lattice: endmemberS.lattice,
        atom_types: endmemberS.atom_types,
        atom_numbers: endmemberS.atom_numbers,
        atom_pos_car: endmemberS.atom_pos_car,
        qpoints: endmemberS.qpoints,
        distances: endmemberS.distances,
        highsym_qpts: endmemberS.highsym_qpts,
        line_breaks: endmemberS.line_breaks,
        repetitions: endmemberS.repetitions,
        dynamical_matrix: mixAlloyDynamicalMatrix(endmemberS, endmemberSe, x, mAmu),
    };
}
