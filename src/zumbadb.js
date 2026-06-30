/*
 * ZumbaDB — loads plain .json phonon files from the zumbadb/ directory.
 *
 * File naming convention mirrors the Porto notation:
 *   ZMO_pol_<pol>_ei_<ei>_es_<es>.json
 * e.g.:
 *   ZMO_pol_z_ei_x_es_y.json   →  z(x,y)z
 *   ZMO_pol_x_ei_z_es_z.json   →  x(z,z)x
 *
 * Because browsers cannot list directories, the class reads a manifest file
 * at  zumbadb/manifest.json  which is a simple JSON array of filenames.
 */

export class ZumbaDB {

    constructor() {
        this.name      = "zumbadb";
        this.author    = "ZMO Raman Database";
        this.year      = new Date().getFullYear();
        this.root      = "zumbadb";
        this.manifest  = "zumbadb/manifest.json";
    }
    static makeFilename(pol, ei, es) {
        return `zumbadb/ZMO_pol_${pol}_ei_${ei}_es_${es}.json`;
    }
    static portoLabel(pol, ei, es) {
        return `${pol}(${ei},${es})${pol}`;
    }

    get_materials(callback) {
        const root      = this.root;
        const name      = this.name;
        const manifest  = this.manifest;
        const reference = this.author + " (" + this.year + ")";

        fetch(manifest)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("manifest not found: " + manifest);
                }
                return response.json();
            })
            .then(function(files) {
                if (!Array.isArray(files) || files.length === 0) {
                    callback([]);
                    return;
                }

                files.sort();

                const materials = files.map(function(filename) {
                    let stem = filename.endsWith(".json")
                        ? filename.slice(0, -5)
                        : filename;
                    const m = stem.match(/pol_([xyz])_ei_([xyz])_es_([xyz])/);
                    const label = m
                        ? `${m[1]}(${m[2]},${m[3]})${m[1]}`
                        : stem;

                    return {
                        id:        stem,
                        name:      label,
                        source:    name,
                        type:      "json",
                        reference: reference,
                        url:       root + "/" + filename,
                        link:      null,
                    };
                });

                callback(materials);
            })
            .catch(function(err) {
                console.warn("ZumbaDB: could not load manifest:", err);
                callback([]);
            });
    }
}