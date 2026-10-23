export class LocalPhononDB {
    /*
    Interact with locally generated PhononDB materials stored in data/phonondb2017.
    The visible list comes directly from the generated models manifests.
    */

    constructor() {
        this.name = "phonondb";
        this.author = "A. Togo";
        this.year = 2018;
        this.url = "https://github.com/atztogo/phonondb";
        this.generated = "data/phonondb2017/models.json";
        //this fork has no LFS quota, so the data files are served by the upstream site
        this.root = "https://henriquemiranda.github.io/phononwebsite/data/phonondb2017";
    }

    get_materials(callback) {
        let reference = this.author + ", " + "<a href=" + this.url + ">" + this.name + "</a> (" + this.year + ")";
        let name = this.name;
        let generated = this.generated;
        let root = this.root;
        let finishEmpty = function() {
            callback([]);
        };
        let normalizeMaterialId = function(value) {
            let text = String(value == null ? '' : value).trim();
            if (text.endsWith('.json.gz')) {
                text = text.slice(0, -8);
            } else if (text.endsWith('.json')) {
                text = text.slice(0, -5);
            }
            if (text.startsWith('mp-')) {
                return text.slice(3);
            }
            return text;
        };

        let normalizeMaterialFile = function(value, normalizedId) {
            let text = String(value == null ? '' : value).trim();
            if (text.endsWith('.json.gz')) {
                return text;
            }
            if (text.endsWith('.json')) {
                return text + '.gz';
            }
            return 'mp-' + normalizedId + '.json.gz';
        };

        let loadGeneratedEntries = function(onDone) {
            let localById = {};
            let request;
            try {
                request = $.get(generated, function(localEntries) {
                    for (let i = 0; i < localEntries.length; i++) {
                        let entry = localEntries[i];
                        if (typeof entry === "string") {
                            let id = normalizeMaterialId(entry);
                            localById[id] = {
                                id: id,
                                file: normalizeMaterialFile(entry, id),
                                root: root,
                            };
                        } else if (entry && entry.id != null) {
                            let id = normalizeMaterialId(entry.id);
                            localById[id] = Object.assign({
                                id: id,
                                file: normalizeMaterialFile(entry.file || entry.id, id),
                                root: root,
                            }, entry);
                        }
                    }
                    onDone(localById);
                });
            } catch (error) {
                onDone(localById);
                return;
            }

            if (request && typeof request.fail === "function") {
                request.fail(function() {
                    onDone(localById);
                });
            }
        };

        loadGeneratedEntries(function(localById) {
            let materialIds = Object.keys(localById);
            if (!materialIds.length) {
                callback([]);
                return;
            }

            materialIds.sort(function(left, right) {
                let leftValue = Number(left);
                let rightValue = Number(right);
                if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
                    return leftValue - rightValue;
                }
                return left.localeCompare(right);
            });

            let materials = [];
            for (let i = 0; i < materialIds.length; i++) {
                let id = materialIds[i];
                let localEntry = localById[id];
                let m = Object.assign({}, localEntry);
                m.id = localEntry.id != null ? localEntry.id : id;
                m.name = localEntry.name || localEntry.formula || ('mp-' + id);
                m.source = name;
                m.type = "json";
                m.reference = reference;
                m.url = (m.root || "") + "/" + m.file;
                m.link = m.link || ("https://materialsproject.org/materials/mp-" + m.id);
                materials.push(m);
            }

            callback(materials);
        });
    }
}
