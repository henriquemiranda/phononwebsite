/*
 * AlloyDB — loads plain .json phonon files from the alloydb/ directory.
 *
 * Because browsers cannot list directories, the class reads a manifest file
 * at  alloydb/manifest.json  which is a simple JSON array of filenames, e.g.:
 *
 *   ["BaZrS_x_0.0_m_32.06.json", "BaZrS_x_1.0_m_78.97.json", ...]
 *
 * Generate / regenerate the manifest any time you add files:
 *
 *   cd phononwebsite/alloydb
 *   python3 -c "import os,json; print(json.dumps(sorted(f for f in os.listdir('.') if f.endswith('.json'))))" > manifest.json
 *
 * The display name shown in the sidebar is taken from the JSON's own "name"
 * field (e.g. "bazrs3").  If that field is absent the filename stem is used.
 */

export class AlloyDB {

    constructor() {
        this.name      = "alloydb";
        this.author    = "Custom Alloy Database";
        this.year      = new Date().getFullYear();
        this.root      = "alloydb";
        this.manifest  = "alloydb/manifest.json";
    }

    get_materials(callback) {
        const root      = this.root;
        const name      = this.name;
        const manifest  = this.manifest;
        const reference = this.author + " (" + this.year + ")";

        // Try to fetch the manifest; fall back to empty list on any error.
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

                // Sort alphabetically so the sidebar is predictable.
                files.sort();

                const materials = files.map(function(filename) {
                    // Strip .json suffix for the display name.
                    let stem = filename.endsWith(".json")
                        ? filename.slice(0, -5)
                        : filename;

                    return {
                        id:        stem,
                        name:      stem,          // shown in sidebar; overridden by JSON "name" field at load time
                        source:    name,
                        type:      "json",         // tells PhononWebpage to use PhononJson loader (no .gz)
                        reference: reference,
                        url:       root + "/" + filename,
                        link:      null,
                    };
                });

                callback(materials);
            })
            .catch(function(err) {
                console.warn("AlloyDB: could not load manifest:", err);
                callback([]);
            });
    }
}
