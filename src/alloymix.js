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
