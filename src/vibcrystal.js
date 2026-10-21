import * as THREE from 'three';
import { Stats } from './static_libs/stats.min.js';
import * as atomic_data from './atomic_data.js';
import * as utils from './utils.js';
import * as mat from './mat.js';
import { createAtomBadgeHtml } from './atomcolors.js';
import { bindAppearanceAtomSelection, bindBondRuleControls, bindEnterToApply, createBondColorInputStateUpdater } from './appearancecontrols.js';
import { sharedViewerMethods } from './viewercommon.js';
import { StructureViewerBase } from './structureviewerbase.js';
import { buildCrystalBondRules, getChemicalBondLimit } from './bonding.js';
import { createAtomSphereGeometry, createBondCylinderGeometry, createCellLineObject } from './viewergeometry.js';
import { buildBondList, getViewerAtomRadius } from './viewermeshes.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const vec_y = new THREE.Vector3( 0, 1, 0 );
const vec_0 = new THREE.Vector3( 0, 0, 0 );
// scratch objects reused by the per-frame update to avoid allocations
const scratchDir = new THREE.Vector3();
const scratchMid = new THREE.Vector3();
const scratchOffset = new THREE.Vector3();
const scratchVel = new THREE.Vector3();

function getComplexParts(z) {
    if (z && z.__rawComplex) {
        z = z.__rawComplex;
    }

    let re = 0.0;
    let im = 0.0;

    if (z && typeof z.re === 'number') {
        re = z.re;
    } else if (z && typeof z.real === 'number') {
        re = z.real;
    } else if (z && typeof z.real === 'function') {
        re = z.real();
    }

    if (z && typeof z.im === 'number') {
        im = z.im;
    } else if (z && typeof z.imag === 'number') {
        im = z.imag;
    } else if (z && typeof z.imag === 'function') {
        im = z.imag();
    }

    return [re, im];
}

function computeBondFrame( point1, point2, outMidpoint, outQuaternion, outDir ) {
    /*
    fill the midpoint, the quaternion and the unit direction
    linking two points and return their distance
    */
    outDir.subVectors(point2, point1);
    let length = outDir.length();
    if (length > 0) {
        outDir.multiplyScalar(1.0 / length);
    }
    outQuaternion.setFromUnitVectors( vec_y, outDir );
    outMidpoint.copy(point1).addScaledVector(outDir, 0.5 * length);
    return length;
}

function getSupportedWebmMimeType() {
    if (typeof globalThis.MediaRecorder !== 'function') {
        return null;
    }

    const preferredTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
    ];

    if (typeof globalThis.MediaRecorder.isTypeSupported !== 'function') {
        return preferredTypes[preferredTypes.length - 1];
    }

    for (let i = 0; i < preferredTypes.length; i++) {
        if (globalThis.MediaRecorder.isTypeSupported(preferredTypes[i])) {
            return preferredTypes[i];
        }
    }

    return null;
}

function browserSupportsNativeWebmCapture() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return false;
    }

    let canvas = document.createElement('canvas');
    if (!canvas || typeof canvas.captureStream !== 'function') {
        return false;
    }

    return !!getSupportedWebmMimeType();
}

function browserSupportsWebmCapture() {
    return browserSupportsNativeWebmCapture();
}

export class VibCrystal extends StructureViewerBase {
    /*
    Class to show phonon vibrations using Three.js and WebGl
    */

    constructor(container) {
        super();

        this.display = 'jmol'; //use jmol or vesta displaystyle

        this.time = 0,
        this.lastFrameTime = null;
        this.animationFrameId = null;
        this.needsRender = true;
        this.arrows = false;
        this.cell = false;
        this.paused = false;
        this.initialized = false;

        this.container = container;
        this.container0 = container.get(0);
        this.dimensions = this.getContainerDimensions();

        this.stats = null;
        this.capturer = null;
        this.captureState = 'idle';
        this.captureFormat = null;
        this.captureFrameCount = 0;
        this.captureFrameTarget = 0;
        this.captureStartTime = 0;
        this.captureDurationMs = 0;
        this.capturePhaseStart = 0;
        this.captureRecorder = null;
        this.captureRecorderChunks = [];
        this.captureRecorderMimeType = null;
        this.captureStream = null;
        this.vibrationComponents = [];
        this.onAppearanceUpdated = null;

        //camera options
        this.cameraDistance = 100;
        this.cameraViewAngle = 10;
        this.cameraNear = 0.1;
        this.cameraFar = 5000;

        //balls
        this.sphereRadius = 0.5;
        if (this.display == 'vesta') {
            this.sphereLat = 16;
            this.sphereLon = 16;
        } else {
            this.sphereLat = 12;
            this.sphereLon = 12;
        }

        //bonds
        this.bondRadius = 0.1;
        this.bondSegments = 6;
        this.bondVertical = 1;

        //arrows
        this.arrowHeadRadiusRatio = 2;
        this.arrowHeadLengthRatio = .25;
        this.arrowRadius = 0.1;
        this.arrowLength = 1.0;

        //arrowscale
        this.arrowScale = 2.0;
        this.defaultArrowScale = this.arrowScale;
        this.minArrowScale = 0.0;
        this.maxArrowScale = 5.0;
        this.stepArrowScale = 0.01;

        //amplitude
        this.amplitude = 0.2;
        this.defaultAmplitude = this.amplitude;
        this.minAmplitude = 0.0;
        this.maxAmplitude = 5.0;
        this.stepAmplitude = 0.01;
        this.modeScaleAutoInitialized = false;

        //speed
        this.speed = 0.7;
        this.minSpeed = 0.01;
        this.maxSpeed = 3.0;
        this.stepSpeed = 0.01;

        this.fps = 60;

        this.arrowcolor = 0xbbffbb;
        this.defaultArrowColor = this.arrowcolor;
        this.defaultBondsColor = this.bondscolor;
        this.defaultBondColorByAtom = this.bondColorByAtom;
        this.atomRadiusScale = 1.0;
        this.defaultAtomRadiusScale = this.atomRadiusScale;
        this.defaultBondRadius = this.bondRadius;
        this.defaultArrowRadius = this.arrowRadius;
        this.arrowobjects = [];
        this.atomobjects = [];
        this.atommeshes = [];
        this.atommeshTypeIndices = [];
        this.atomInstanceRefs = [];
        this.bondobjects = [];
        this.bondmesh = null;
        this.bondmeshes = [];
        this.arrowmesh = null;
        this.bonds = [];
        this.instanceDummy = new THREE.Object3D();
        this.animateFrame = this.animate.bind(this);
        this.captureK = null;
        this.captureN = null;
		this.modified_covalent_radii = JSON.parse(JSON.stringify(atomic_data.covalent_radii));
        this.autoBondRulesSourcePhonon = null;
    }

    setAtomColorOverride(atomNumber, colorValue) {
        this.atomColorOverrides[atomNumber] = this.normalizeColorHex(
            colorValue,
            this.getDefaultAtomColor(atomNumber)
        );
    }

    getCovalentRadius(atomNumber) {
        if (this.modified_covalent_radii && Number.isFinite(this.modified_covalent_radii[atomNumber])) {
            return this.modified_covalent_radii[atomNumber];
        }
        return atomic_data.covalent_radii[atomNumber] || 0;
    }

    setCovalentRadius(atomNumber, radius) {
        atomNumber = Number(atomNumber);
        radius = Number(radius);
        if (!Number.isFinite(atomNumber) || !Number.isFinite(radius) || radius <= 0) {
            return;
        }
        this.modified_covalent_radii[atomNumber] = radius;
    }

    setCovalentRadii(radii) {
        if (!radii || typeof radii !== 'object') {
            return;
        }
        let nextRadii = JSON.parse(JSON.stringify(atomic_data.covalent_radii));
        let keys = Object.keys(radii);
        for (let i = 0; i < keys.length; i++) {
            let atomNumber = Number(keys[i]);
            let radius = Number(radii[keys[i]]);
            if (Number.isFinite(atomNumber) && Number.isFinite(radius) && radius > 0) {
                nextRadii[atomNumber] = radius;
            }
        }
        this.modified_covalent_radii = nextRadii;
    }

    resetCovalentRadii() {
        this.modified_covalent_radii = JSON.parse(JSON.stringify(atomic_data.covalent_radii));
    }

    adjustCovalentRadiiSelect() {
        let unique_atom_numbers = this.atom_numbers.filter((v, i, a) => a.indexOf(v) === i);
        if (!this.dom_appearance_atom_list || !this.dom_appearance_atom_list.length) {
            return;
        }

        let selected = Number(this.getSelectedAppearanceAtomNumber());
        if (!Number.isFinite(selected) || !unique_atom_numbers.includes(selected)) {
            selected = unique_atom_numbers.length ? unique_atom_numbers[0] : null;
        }

        this.dom_appearance_atom_list.empty();
        for (let i=0; i<unique_atom_numbers.length; i++) {
            let atomNumber = unique_atom_numbers[i];
            this.dom_appearance_atom_list.append(
                '<button type="button" data-atom-number="' + atomNumber + '">' +
                createAtomBadgeHtml(atomic_data.atomic_symbol[atomNumber], atomNumber, this.getAtomColorHex.bind(this)) +
                '</button>'
            );
        }

        if (Number.isFinite(selected)) {
            this.setSelectedAppearanceAtomNumber(selected);
        }

        if (!Number.isFinite(selected)) {
            return;
        }
        if (this.dom_atom_color_input && this.dom_atom_color_input.length) {
            this.dom_atom_color_input.val(this.colorToInputHex(this.getAtomColorHex(selected)));
        }
        if (this.dom_atom_radius_input && this.dom_atom_radius_input.length) {
            this.dom_atom_radius_input.val(this.getAtomRadiusScale(selected));
        }

        if (this.dom_bond_add_atom_a && this.dom_bond_add_atom_a.length) {
            let previous = this.dom_bond_add_atom_a.val();
            this.dom_bond_add_atom_a.empty();
            for (let i=0; i<unique_atom_numbers.length; i++) {
                let atomNumber = unique_atom_numbers[i];
                this.dom_bond_add_atom_a.append('<option value="' + atomNumber + '">' + atomic_data.atomic_symbol[atomNumber] + '</option>');
            }
            if (previous !== null && unique_atom_numbers.includes(Number(previous))) {
                this.dom_bond_add_atom_a.val(previous);
            }
        }
        if (this.dom_bond_add_atom_b && this.dom_bond_add_atom_b.length) {
            let previous = this.dom_bond_add_atom_b.val();
            this.dom_bond_add_atom_b.empty();
            for (let i=0; i<unique_atom_numbers.length; i++) {
                let atomNumber = unique_atom_numbers[i];
                this.dom_bond_add_atom_b.append('<option value="' + atomNumber + '">' + atomic_data.atomic_symbol[atomNumber] + '</option>');
            }
            if (previous !== null && unique_atom_numbers.includes(Number(previous))) {
                this.dom_bond_add_atom_b.val(previous);
            }
        }
        if (this.dom_bond_add_cutoff_input && this.dom_bond_add_cutoff_input.length &&
            this.dom_bond_add_atom_a && this.dom_bond_add_atom_b) {
            let a = Number(this.dom_bond_add_atom_a.val());
            let b = Number(this.dom_bond_add_atom_b.val());
            if (Number.isFinite(a) && Number.isFinite(b)) {
                let key = this.getBondRuleKey(a, b);
                let value = this.bondRules[key] ? this.bondRules[key].cutoff : this.getDefaultBondCutoff(a, b);
                this.dom_bond_add_cutoff_input.val(Number(value).toFixed(2));
            }
        }
        this.refreshBondRulesUI(unique_atom_numbers);
    }

    getChemicalBondLimit(atomNumberA, atomNumberB) {
        return getChemicalBondLimit(atomNumberA, atomNumberB, this.modified_covalent_radii);
    }

    getClosestObservedBondDistance(atomNumberA, atomNumberB) {
        if (!this.atoms || !this.atoms.length || !this.phonon || !this.phonon.atom_numbers) {
            return null;
        }

        let atomNumbers = this.phonon.atom_numbers;
        let minDistance = Infinity;

        for (let i = 0; i < this.atoms.length; i++) {
            let atomA = this.atoms[i];
            let typeA = atomNumbers[atomA[0]];
            for (let j = i + 1; j < this.atoms.length; j++) {
                let atomB = this.atoms[j];
                let typeB = atomNumbers[atomB[0]];
                let matchesPair =
                    (typeA === atomNumberA && typeB === atomNumberB) ||
                    (typeA === atomNumberB && typeB === atomNumberA);
                if (!matchesPair) {
                    continue;
                }

                let distance = mat.distance(atomA.slice(1), atomB.slice(1));
                if (distance >= 0.4 && distance < minDistance) {
                    minDistance = distance;
                }
            }
        }

        return Number.isFinite(minDistance) ? minDistance : null;
    }

    getDefaultBondCutoff(atomNumberA, atomNumberB) {
        let closest = this.getClosestObservedBondDistance(atomNumberA, atomNumberB);
        if (Number.isFinite(closest)) {
            return Math.max(closest + 0.04, closest * 1.03);
        }
        return this.getChemicalBondLimit(atomNumberA, atomNumberB);
    }

    initializeBondRulesFromAtoms(atoms, atom_numbers) {
        this.bondRules = buildCrystalBondRules(
            atoms,
            atom_numbers,
            this.modified_covalent_radii,
            this.getBondRuleKey.bind(this),
        );
    }

    //functions to link the DOM buttons with this class
    setCameraDirectionButton(dom_button,direction) {
    /* Bind the action to set the direction of the camera using direction
       direction can be 'x','y','z'
    */
        let self = this;
        dom_button.click( function() { self.setCameraDirection(direction) } );
    }

    setPlayPause(dom_input) {
        dom_input.click( this.playpause.bind(this) );
    }

    setCellCheckbox(dom_checkbox) {
        let self = this;
        dom_checkbox.click( function() {
            self.cell = this.checked;
            self.updatelocal();
        } )
    }

    setDisplayCombo(dom_combo) {
        var self = this;
        dom_combo[0].onchange = function() {
            self.display = dom_combo[0].options[dom_combo[0].selectedIndex].value;
            self.updatelocal(true);
        }
    }

    setShadingCheckbox(dom_checkbox) {
        let self = this;
        this.shading = dom_checkbox.prop('checked');
        dom_checkbox.click( function() {
            self.shading = this.checked;
            self.updatelocal();
        } );
    }

    setWebmButton(dom_button) {
        let self = this;
        if (!browserSupportsWebmCapture()) {
            dom_button.hide();
        }

        dom_button.click(function() { self.capturestart('webm'); });
    }

    setGifButton(dom_button) {
        let self = this;
        dom_button.click(function() { self.capturestart('gif'); });
    }

    setArrowsCheckbox(dom_checkbox) {
        let self = this;
        this.dom_drawvectors_checkbox = dom_checkbox;
        this.arrows = dom_checkbox.checked;
        dom_checkbox.click( function() {
            self.arrows = this.checked;
            self.updatelocal();
        });
    }

    setArrowsInput(dom_range) {
        let self = this;
        this.dom_vectors_amplitude_range = dom_range;

        dom_range.val(self.arrowScale);
        dom_range.attr('min',self.minArrowScale);
        dom_range.attr('max',self.maxArrowScale);
        dom_range.attr('step',self.stepArrowScale);
        dom_range.change( function () {
            self.arrowScale = parseFloat(this.value);
        });
    }

   setAmplitudeInput(dom_number,dom_range) {
        let self = this;
        this.dom_amplitude_box = dom_number;
        this.dom_amplitude_range = dom_range;

        dom_number.val(self.amplitude);
        dom_number.keyup( function () {
            if (this.value < dom_range.min) { dom_range.attr('min', this.value); }
            if (this.value > dom_range.max) { dom_range.attr('max', this.value); }
            self.amplitude = parseFloat(this.value);
            dom_range.val(this.value)
        });

        dom_range.val(self.amplitude);
        dom_range.attr('min',self.minAmplitude);
        dom_range.attr('max',self.maxAmplitude);
        dom_range.attr('step',self.stepAmplitude);
        dom_range.change( function () {
            self.amplitude = parseFloat(this.value);
            dom_number.val(this.value);
        });
    }

    isApproximatelyEqual(a, b, tolerance = 1e-6) {
        return Math.abs(Number(a) - Number(b)) <= tolerance;
    }

    formatControlNumber(value, decimals = 3) {
        value = Number(value);
        if (!Number.isFinite(value)) {
            return '';
        }
        return value.toFixed(decimals).replace(/\.?0+$/, '');
    }

    setArrowScaleValue(value) {
        value = Number(value);
        if (!Number.isFinite(value)) {
            return;
        }

        this.arrowScale = value;
        if (this.dom_vectors_amplitude_range && this.dom_vectors_amplitude_range.length) {
            if (value > Number(this.dom_vectors_amplitude_range.attr('max'))) {
                this.dom_vectors_amplitude_range.attr('max', value);
            }
            this.dom_vectors_amplitude_range.val(value);
        }
    }

    setAmplitudeValue(value) {
        value = Number(value);
        if (!Number.isFinite(value)) {
            return;
        }

        this.amplitude = value;
        if (this.dom_amplitude_box && this.dom_amplitude_box.length) {
            this.dom_amplitude_box.val(this.formatControlNumber(value, 3));
        }
        if (this.dom_amplitude_range && this.dom_amplitude_range.length) {
            if (value > Number(this.dom_amplitude_range.attr('max'))) {
                this.dom_amplitude_range.attr('max', value);
            }
            this.dom_amplitude_range.val(value);
        }
    }

    syncModeScaleDefaults(amplitudeValue, arrowScaleValue = amplitudeValue, force = false) {
        amplitudeValue = Number(amplitudeValue);
        arrowScaleValue = Number(arrowScaleValue);
        if (!Number.isFinite(amplitudeValue) || amplitudeValue < 0) {
            return;
        }
        if (!Number.isFinite(arrowScaleValue) || arrowScaleValue < 0) {
            return;
        }

        let previousDefaultAmplitude = Number(this.defaultAmplitude);
        let previousDefaultArrowScale = Number(this.defaultArrowScale);
        let shouldUpdateAmplitude = force || !this.modeScaleAutoInitialized ||
            this.isApproximatelyEqual(this.amplitude, previousDefaultAmplitude);
        let shouldUpdateArrowScale = force || !this.modeScaleAutoInitialized ||
            this.isApproximatelyEqual(this.arrowScale, previousDefaultArrowScale);

        this.defaultAmplitude = amplitudeValue;
        this.defaultArrowScale = arrowScaleValue;
        this.modeScaleAutoInitialized = true;

        if (shouldUpdateAmplitude) {
            this.setAmplitudeValue(amplitudeValue);
        }
        if (shouldUpdateArrowScale) {
            this.setArrowScaleValue(arrowScaleValue);
        }
    }

    setSpeedInput(dom_range) {
        let self = this;

        dom_range.val(self.speed);
        dom_range.attr('min',self.minSpeed);
        dom_range.attr('max',self.maxSpeed);
        dom_range.attr('step',self.stepSpeed);
        dom_range.change( function () {
            self.speed = this.value;
        });
    }

    setAdvancedAppearanceControls(
        domAtomList,
        domDisplaySelect,
        domAtomColorInput,
        domArrowColorInput,
        domBondColorInput,
        domBondColorByAtomCheckbox,
        domAtomRadiusInput,
        domBondRadiusInput,
        domArrowRadiusInput,
        domBondRulesList,
        domBondAddAtomA,
        domBondAddAtomB,
        domBondAddCutoffInput,
        domBondAddButton,
        domResetAtomButton,
        domResetBondsButton,
        domResetVectorsButton,
    ) {
        if (typeof domResetVectorsButton === 'undefined') {
            domResetVectorsButton = domResetBondsButton;
            domResetBondsButton = domResetAtomButton;
            domResetAtomButton = domBondAddButton;
            domBondAddButton = null;
        }

        let self = this;
        this.dom_appearance_atom_list = domAtomList;
        this.dom_display_select = domDisplaySelect;
        this.dom_atom_color_input = domAtomColorInput;
        this.dom_arrow_color_input = domArrowColorInput;
        this.dom_bond_color_input = domBondColorInput;
        this.dom_bond_color_by_atom_checkbox = domBondColorByAtomCheckbox;
        this.dom_atom_radius_input = domAtomRadiusInput;
        this.dom_bond_radius_input = domBondRadiusInput;
        this.dom_arrow_radius_input = domArrowRadiusInput;
        this.dom_bond_rules_list = domBondRulesList;
        this.dom_bond_add_atom_a = domBondAddAtomA;
        this.dom_bond_add_atom_b = domBondAddAtomB;
        this.dom_bond_add_cutoff_input = domBondAddCutoffInput;
        this.dom_bond_add_button = domBondAddButton;
        const updateBondColorInputState = createBondColorInputStateUpdater(this, domBondColorInput);

        bindAppearanceAtomSelection(this, domAtomList, domAtomColorInput, domAtomRadiusInput);

        const applyAppearanceSettings = function() {
            let atomNumber = Number(self.getSelectedAppearanceAtomNumber());
            let previousDisplay = self.display;
            let previousBondColorByAtom = self.bondColorByAtom;
            let previousBondRadius = self.bondRadius;
            let previousArrowRadius = self.arrowRadius;
            let previousArrowColor = self.arrowcolor;
            let previousBondColor = self.bondscolor;
            let previousAtomColor = Number.isFinite(atomNumber) ? self.getAtomColorHex(atomNumber) : null;
            let previousAtomRadius = Number.isFinite(atomNumber) ? self.getAtomRadiusScale(atomNumber) : null;
            if (Number.isFinite(atomNumber)) {
                if (domAtomColorInput && domAtomColorInput.length) {
                    let rawAtomColor = domAtomColorInput.val();
                    if (rawAtomColor) {
                            // Only persist an override when user picked a non-default color.
                            // If it matches current display default, keep it dynamic across Jmol/Vesta.
                            let defaultHex = self.getDefaultAtomColor(atomNumber);
                            let selectedHex = self.normalizeColorHex(rawAtomColor, defaultHex);
                            if (selectedHex === defaultHex) {
                                self.clearAtomColorOverride(atomNumber);
                            } else {
                                self.atomColorOverrides[atomNumber] = selectedHex;
                            }
                        }
                    }
                if (domAtomRadiusInput && domAtomRadiusInput.length) {
                    let atomScale = Math.max(0.1, parseFloat(domAtomRadiusInput.val()) || self.defaultAtomRadiusScale);
                    self.setAtomRadiusScaleOverride(atomNumber, atomScale);
                    domAtomRadiusInput.val(atomScale);
                }
            }

            if (domDisplaySelect && domDisplaySelect.length) {
                self.display = domDisplaySelect.val() || self.display;
            }
            if (domArrowColorInput && domArrowColorInput.length) {
                self.arrowcolor = self.normalizeColorHex(domArrowColorInput.val(), self.arrowcolor);
            }
            if (!self.bondColorByAtom && domBondColorInput && domBondColorInput.length) {
                self.bondscolor = self.normalizeColorHex(domBondColorInput.val(), self.bondscolor);
            }
            if (domBondColorByAtomCheckbox && domBondColorByAtomCheckbox.length) {
                self.bondColorByAtom = !!domBondColorByAtomCheckbox.prop('checked');
            }
            updateBondColorInputState();
            if (domBondRadiusInput && domBondRadiusInput.length) {
                self.bondRadius = Math.max(0.01, parseFloat(domBondRadiusInput.val()) || self.bondRadius);
                domBondRadiusInput.val(self.bondRadius);
            }
            if (domArrowRadiusInput && domArrowRadiusInput.length) {
                self.arrowRadius = Math.max(0.01, parseFloat(domArrowRadiusInput.val()) || self.arrowRadius);
                domArrowRadiusInput.val(self.arrowRadius);
            }

            let displayChanged = self.display !== previousDisplay;
            let bondColorModeChanged = self.bondColorByAtom !== previousBondColorByAtom;
            let bondRadiusChanged = self.bondRadius !== previousBondRadius;
            let arrowRadiusChanged = self.arrowRadius !== previousArrowRadius;
            let atomRadiusChanged = Number.isFinite(atomNumber) && self.getAtomRadiusScale(atomNumber) !== previousAtomRadius;

            let atomColorChanged = Number.isFinite(atomNumber) && self.getAtomColorHex(atomNumber) !== previousAtomColor;
            let bondColorChanged = self.bondscolor !== previousBondColor;
            let arrowColorChanged = self.arrowcolor !== previousArrowColor;

            if (displayChanged || bondColorModeChanged || bondRadiusChanged || arrowRadiusChanged || atomRadiusChanged) {
                self.updatelocal(true);
            } else if (atomColorChanged || bondColorChanged || arrowColorChanged) {
                self.refreshColorsInPlace(true);
            }
        };

        if (domArrowColorInput && domArrowColorInput.length) {
            domArrowColorInput.val(this.colorToInputHex(this.arrowcolor));
            domArrowColorInput.on('change', function() {
                applyAppearanceSettings();
            });
        }

        if (domBondColorInput && domBondColorInput.length) {
            domBondColorInput.val(this.colorToInputHex(this.bondscolor));
            domBondColorInput.on('change', function() {
                applyAppearanceSettings();
            });
        }
        if (domBondColorByAtomCheckbox && domBondColorByAtomCheckbox.length) {
            domBondColorByAtomCheckbox.prop('checked', this.bondColorByAtom);
            domBondColorByAtomCheckbox.on('change', function() {
                applyAppearanceSettings();
            });
        }
        updateBondColorInputState();

        if (domAtomColorInput && domAtomColorInput.length) {
            domAtomColorInput.on('change', function() {
                applyAppearanceSettings();
            });
        }

        if (domAtomRadiusInput && domAtomRadiusInput.length) {
            let atomNumber = this.getSelectedAppearanceAtomNumber();
            domAtomRadiusInput.val(
                Number.isFinite(atomNumber) ? this.getAtomRadiusScale(atomNumber) : this.defaultAtomRadiusScale
            );
            domAtomRadiusInput.attr('min', 0.1);
            domAtomRadiusInput.attr('max', 5.0);
            domAtomRadiusInput.attr('step', 0.05);
        }

        if (domBondRadiusInput && domBondRadiusInput.length) {
            domBondRadiusInput.val(this.bondRadius);
            domBondRadiusInput.attr('min', 0.01);
            domBondRadiusInput.attr('max', 1.0);
            domBondRadiusInput.attr('step', 0.01);
        }

        if (domArrowRadiusInput && domArrowRadiusInput.length) {
            domArrowRadiusInput.val(this.arrowRadius);
            domArrowRadiusInput.attr('min', 0.01);
            domArrowRadiusInput.attr('max', 1.0);
            domArrowRadiusInput.attr('step', 0.01);
        }

        if (domResetAtomButton && domResetAtomButton.length) {
            domResetAtomButton.click(function() {
                let atomNumber = self.getSelectedAppearanceAtomNumber();
                if (Number.isFinite(atomNumber)) {
                    self.clearAtomColorOverride(atomNumber);
                    delete self.atomRadiusScaleOverrides[atomNumber];
                }
                if (self.dom_atom_color_input && self.dom_atom_color_input.length && Number.isFinite(atomNumber)) {
                    self.dom_atom_color_input.val(self.colorToInputHex(self.getAtomColorHex(atomNumber)));
                }
                if (self.dom_atom_radius_input && self.dom_atom_radius_input.length && Number.isFinite(atomNumber)) {
                    self.dom_atom_radius_input.val(self.getAtomRadiusScale(atomNumber));
                }
                self.updatelocal(true);
            });
        }

        if (domResetBondsButton && domResetBondsButton.length) {
            domResetBondsButton.click(function() {
                self.bondscolor = self.defaultBondsColor;
                self.bondColorByAtom = self.defaultBondColorByAtom;
                self.bondRadius = self.defaultBondRadius;
                if (self.dom_bond_color_input && self.dom_bond_color_input.length) {
                    self.dom_bond_color_input.val(self.colorToInputHex(self.bondscolor));
                }
                if (self.dom_bond_color_by_atom_checkbox && self.dom_bond_color_by_atom_checkbox.length) {
                    self.dom_bond_color_by_atom_checkbox.prop('checked', self.bondColorByAtom);
                }
                updateBondColorInputState();
                if (self.dom_bond_radius_input && self.dom_bond_radius_input.length) {
                    self.dom_bond_radius_input.val(self.bondRadius);
                }
                self.initializeBondRulesFromAtoms(self.atoms || [], self.phonon ? self.phonon.atom_numbers : []);
                self.refreshBondRulesUI(this.atom_numbers || []);
                self.updatelocal(true);
            });
        }

        bindBondRuleControls(
            this,
            domBondRulesList,
            domBondAddAtomA,
            domBondAddAtomB,
            domBondAddCutoffInput,
            domBondAddButton,
            () => {
                self.refreshBondRulesUI(self.atom_numbers || []);
                self.updatelocal();
            },
        );

        if (domResetVectorsButton && domResetVectorsButton.length) {
            domResetVectorsButton.click(function() {
                self.arrowcolor = self.defaultArrowColor;
                self.arrowRadius = self.defaultArrowRadius;
                self.arrowScale = self.defaultArrowScale;
                self.arrows = false;

                if (self.dom_arrow_color_input && self.dom_arrow_color_input.length) {
                    self.dom_arrow_color_input.val(self.colorToInputHex(self.arrowcolor));
                }
                if (self.dom_arrow_radius_input && self.dom_arrow_radius_input.length) {
                    self.dom_arrow_radius_input.val(self.arrowRadius);
                }
                if (self.dom_vectors_amplitude_range && self.dom_vectors_amplitude_range.length) {
                    self.dom_vectors_amplitude_range.val(self.arrowScale);
                }
                if (self.dom_drawvectors_checkbox && self.dom_drawvectors_checkbox.length) {
                    self.dom_drawvectors_checkbox.prop('checked', self.arrows);
                }
                self.updatelocal();
            });
        }

        bindEnterToApply([domAtomRadiusInput, domBondRadiusInput, domArrowRadiusInput], applyAppearanceSettings);
    }

    init() {
        /*
        Initialize the phonon animation
        */
        super.init(this.container, {
            controlsElement: this.container0,
            startAnimation: false,
            configureControls: (controls) => {
                controls.noZoom = false;
                controls.noPan = false;
                controls.addEventListener('change', () => {
                    this.needsRender = true;
                    if (this.paused) {
                        this.render();
                    }
                });
            },
            afterInit: () => {
                this.renderer.shadowMap.enabled = false;
                this.stats = new Stats();
                this.container0.appendChild(this.stats.domElement);
            },
        });
    }

    captureend(format) {
        if (this.captureState !== 'capturing') {
            return;
        }

        const progress = document.getElementById('progress');
        if (this.captureRecorder && format === 'webm') {
            const recorder = this.captureRecorder;
            const stream = this.captureStream;

            this.captureRecorder = null;
            this.captureStream = null;
            this.captureState = 'saving';

            if (stream && typeof stream.getTracks === 'function') {
                stream.getTracks().forEach((track) => {
                    if (track && typeof track.stop === 'function') {
                        track.stop();
                    }
                });
            }

            recorder.stop();
            return;
        }

        if (!this.capturer) {
            return;
        }

        const capturer = this.capturer;
        this.capturer = null;
        this.captureState = 'saving';
        const filename = this.getCaptureFilename(format);

        capturer.stop();
        capturer.save((url) => {
            let element = document.createElement('a');
            element.setAttribute('href', url);
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

            this.resetCaptureProgress(progress);
            this.resetCaptureState();
        });
    }

    capturestart(format) {
        if (this.capturer || this.captureState !== 'idle') {
            return;
        }
        if (format === 'gif' && typeof globalThis.GIF !== 'function') {
            const message = 'GIF export is currently unavailable. Please reload the page and try again.';
            if (typeof alert === 'function') {
                alert(message);
            } else {
                console.warn(message);
            }
            return;
        }

        let progress = document.getElementById( 'progress' );
        if (progress) {
            progress.style.width = '0%';
        }

        let captureFrameTarget = this.getCaptureFrameTarget();
        let captureDurationMs = this.getCaptureDurationMs(captureFrameTarget);

        if (format === 'webm' && this.startNativeWebmCapture(progress)) {
            this.captureFrameTarget = captureFrameTarget;
            this.captureDurationMs = captureDurationMs;
            return;
        }

        let options = { format: format,
                        workersPath: 'libs/',
                        verbose: false,
                        framerate: this.fps,
                        onProgress: function( p ) {
                            if (progress) {
                                progress.style.width = ( p * 100 ) + '%';
                            }
                        }
                      }

        this.capturer = new globalThis.CCapture( options ),
        this.captureState = 'capturing';
        this.captureFormat = format;
        this.captureFrameCount = 0;
        this.captureFrameTarget = captureFrameTarget;
        this.captureStartTime = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
        this.captureDurationMs = captureDurationMs;
        this.capturePhaseStart = ((this.time % 1) + 1) % 1;
        this.capturer.start();
    }

    startNativeWebmCapture(progress) {
        if (!this.canvas || typeof this.canvas.captureStream !== 'function' || typeof globalThis.MediaRecorder !== 'function') {
            return false;
        }

        let mimeType = getSupportedWebmMimeType();
        if (!mimeType) {
            return false;
        }

        let stream = this.canvas.captureStream(this.fps);
        let recorder;
        try {
            recorder = new globalThis.MediaRecorder(stream, { mimeType: mimeType });
        } catch (error) {
            recorder = new globalThis.MediaRecorder(stream);
            mimeType = recorder.mimeType || mimeType;
        }

        this.captureRecorder = recorder;
        this.captureRecorderChunks = [];
        this.captureRecorderMimeType = mimeType;
        this.captureStream = stream;
        this.captureState = 'capturing';
        this.captureFormat = 'webm';
        this.captureFrameCount = 0;
        this.captureFrameTarget = this.getCaptureFrameTarget();
        this.captureStartTime = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
        this.captureDurationMs = this.getCaptureDurationMs(this.captureFrameTarget);
        this.capturePhaseStart = ((this.time % 1) + 1) % 1;

        recorder.ondataavailable = (event) => {
            if (event && event.data && event.data.size > 0) {
                this.captureRecorderChunks.push(event.data);
            }
        };

        recorder.onstop = () => {
            let blob = new Blob(this.captureRecorderChunks, { type: this.captureRecorderMimeType || 'video/webm' });
            let url = window.URL.createObjectURL(blob);
            let element = document.createElement('a');
            element.setAttribute('href', url);
            element.setAttribute('download', this.getCaptureFilename('webm'));
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

            this.resetCaptureProgress(progress);
            this.resetCaptureState();
        };

        recorder.start();
        return true;
    }

    getCaptureFrameTarget() {
        let speed = Math.max(this.speed, this.minSpeed, 1e-6);
        return Math.max(1, Math.round(this.fps / speed));
    }

    getCaptureDurationMs(frameTarget = this.getCaptureFrameTarget()) {
        return (frameTarget / this.fps) * 1000;
    }

    resetCaptureProgress(progress) {
        if (progress) {
            progress.style.width = '0%';
        }
    }

    resetCaptureState() {
        this.capturer = null;
        this.captureRecorder = null;
        this.captureRecorderChunks = [];
        this.captureRecorderMimeType = null;
        this.captureStream = null;
        this.captureState = 'idle';
        this.captureFormat = null;
        this.captureFrameCount = 0;
        this.captureFrameTarget = 0;
        this.captureStartTime = 0;
        this.captureDurationMs = 0;
        this.capturePhaseStart = 0;
    }

    getCaptureFilename(format) {
        let base = this.phonon && this.phonon.name ? this.phonon.name : 'phonon';
        let suffix = '';
        if (Number.isFinite(this.captureK) && Number.isFinite(this.captureN)) {
            suffix = '_k' + this.captureK + '_n' + this.captureN;
        }
        let safe = String(base)
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '');
        if (!safe) {
            safe = 'phonon';
        }
        return safe + suffix + '.' + format;
    }

    getAtypes(atom_numbers) {
        this.materials = [];
        this.atom_numbers = atom_numbers;

        for (let i=0; i < atom_numbers.length; i++) {
            let n = atom_numbers[i];
            let atomColor = this.getAtomColor(n);
            let material = this.createShadedMaterial({ blending: THREE.NormalBlending });
            material.color.copy(atomColor);
            this.materials.push( material );
        }
    }

    refreshAtomMeshColors() {
        if (!this.atommeshes || !this.atom_numbers) {
            return;
        }

        for (let i=0; i<this.atommeshes.length; i++) {
            let mesh = this.atommeshes[i];
            let typeIndex = this.atommeshTypeIndices[i];
            if (!mesh || !mesh.material || !Number.isFinite(typeIndex)) {
                continue;
            }

            let atomNumber = this.atom_numbers[typeIndex];
            if (!Number.isFinite(atomNumber)) {
                continue;
            }

            mesh.material.color.copy(this.getAtomColor(atomNumber));
        }
    }

    refreshBondMeshColors() {
        if (!this.bondmeshes || !this.bondmeshes.length) {
            return;
        }

        if (this.bondColorByAtom && this.bondmesh && this.bondmesh.setColorAt) {
            let mesh = this.bondmesh;
            for (let i=0; i<this.bonds.length; i++) {
                let bond = this.bonds[i];
                mesh.setColorAt(2 * i, this.getAtomColor(bond.a_atom_number));
                mesh.setColorAt(2 * i + 1, this.getAtomColor(bond.b_atom_number));
            }
            if (mesh.instanceColor) { mesh.instanceColor.needsUpdate = true; }
            return;
        }

        for (let i=0; i<this.bondmeshes.length; i++) {
            let mesh = this.bondmeshes[i];
            if (!mesh || !mesh.material) {
                continue;
            }
            mesh.material.color.setHex(this.bondscolor);
        }
    }

    refreshArrowColors() {
        if (!this.arrowobjects || !this.arrowobjects.length) {
            return;
        }

        for (let i=0; i<this.arrowobjects.length; i++) {
            let arrow = this.arrowobjects[i];
            if (!arrow || !arrow.material) {
                continue;
            }
            arrow.material.color.setHex(this.arrowcolor);
        }
    }

    refreshColorsInPlace(notifyAppearanceUpdate = false) {
        this.refreshAtomMeshColors();
        this.refreshBondMeshColors();
        this.refreshArrowColors();
        if (notifyAppearanceUpdate && typeof this.onAppearanceUpdated === 'function') {
            this.onAppearanceUpdated();
        }
        this.needsRender = true;
        this.startAnimationLoop();
    }

    addCell(lat) {
        /*
        Represent the unit cell
        */
        if (this.cell) {
          this.scene.add(createCellLineObject(lat, this.geometricCenter));
        }

    }

    addStructure(atoms,atom_numbers) {
        /*
        Add the atoms from the phononweb object
        */
        this.atomobjects  = [];
        this.atommeshes = [];
        this.atommeshTypeIndices = [];
        this.atomInstanceRefs = [];
        this.bondobjects  = [];
        this.bondmesh = null;
        this.bondmeshes = [];
        this.arrowmesh = null;
        this.arrowobjects = [];
        this.atompos = [];
        this.atomvel = [];
        this.bonds = [];
        this.nndist = this.phonon.nndist+0.05;

        //get geometric center
        let geometricCenter = new THREE.Vector3(0,0,0);
        for (let i=0; i<atoms.length; i++) {
            let pos = new THREE.Vector3(atoms[i][1], atoms[i][2], atoms[i][3]);
            geometricCenter.add(pos);
        }
        geometricCenter.multiplyScalar(1.0/atoms.length);
        this.geometricCenter = geometricCenter;

        // Build one instanced mesh per atom type/material.
        let instancesPerType = new Map();
        for (let i=0; i<atoms.length; i++) {
            let typeIndex = atoms[i][0];
            instancesPerType.set(typeIndex, (instancesPerType.get(typeIndex) || 0) + 1);
        }

        let meshesByType = new Map();
        let nextInstanceByType = new Map();
        instancesPerType.forEach((count, typeIndex) => {
            let sphereGeometry;
            let atomNumber = atom_numbers[typeIndex];
            let atomScale = this.getAtomRadiusScale(atomNumber);
            sphereGeometry = createAtomSphereGeometry(
                getViewerAtomRadius(this.display, atomNumber, atomScale, this.sphereRadius, atomic_data.covalent_radii),
                this.sphereLat,
                this.sphereLon
            );

            let instancedMesh = new THREE.InstancedMesh(sphereGeometry, this.materials[typeIndex], count);
            instancedMesh.name = "atoms-" + typeIndex;
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            instancedMesh.frustumCulled = false;
            this.scene.add(instancedMesh);
            this.atommeshes.push(instancedMesh);
            this.atommeshTypeIndices.push(typeIndex);
            meshesByType.set(typeIndex, instancedMesh);
            nextInstanceByType.set(typeIndex, 0);
        });

        //add an atom state for each atom and assign it to the corresponding instance
        for (let i=0; i<atoms.length; i++) {
            let typeIndex = atoms[i][0];
            let pos = new THREE.Vector3(atoms[i][1], atoms[i][2], atoms[i][3]);
            pos.sub(geometricCenter);

            let atomState = {
                name: "atom",
                atom_number: atom_numbers[typeIndex],
                position: pos.clone(),
                velocity: vec_0.clone()
            };

            let mesh = meshesByType.get(typeIndex);
            let instanceId = nextInstanceByType.get(typeIndex);
            nextInstanceByType.set(typeIndex, instanceId + 1);
            this.atomInstanceRefs.push({ mesh: mesh, instanceId: instanceId });

            this.instanceDummy.position.copy(pos);
            this.instanceDummy.quaternion.set(0, 0, 0, 1);
            this.instanceDummy.scale.set(1, 1, 1);
            this.instanceDummy.updateMatrix();
            mesh.setMatrixAt(instanceId, this.instanceDummy.matrix);

            this.atomobjects.push(atomState);
            this.atompos.push(pos);
        }

        for (let i=0; i<this.atommeshes.length; i++) {
            this.atommeshes[i].instanceMatrix.needsUpdate = true;
        }

        //add arrows
        if (this.arrows) {

            //arrow geometry
            let arrowGeometry = new THREE.CylinderGeometry(
                0,
                this.arrowHeadRadiusRatio * this.arrowRadius,
                this.arrowLength * this.arrowHeadLengthRatio
            );

            let axisGeometry = new THREE.CylinderGeometry(
                this.arrowRadius,
                this.arrowRadius,
                this.arrowLength
            );

            let AxisMaterial;
            if (this.shading) {
                AxisMaterial = new THREE.MeshLambertMaterial( {
                    color: this.arrowcolor,
                    blending: THREE.NormalBlending
                } );
            } else {
                AxisMaterial = new THREE.MeshBasicMaterial( {
                    color: this.arrowcolor,
                    blending: THREE.NormalBlending
                } );
            }

            // Bake the head offset into its geometry and merge it with the axis
            // so that all the arrows are drawn with a single instanced mesh.
            let length = (this.arrowLength + this.arrowLength * this.arrowHeadLengthRatio) / 2;
            arrowGeometry.translate(0, length, 0);
            let arrowsGeometry = mergeGeometries([axisGeometry, arrowGeometry]);
            axisGeometry.dispose();
            arrowGeometry.dispose();

            this.arrowmesh = new THREE.InstancedMesh(arrowsGeometry, AxisMaterial, atoms.length);
            this.arrowmesh.name = "arrows";
            this.arrowmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.arrowmesh.frustumCulled = false;
            this.scene.add( this.arrowmesh );
            this.arrowobjects.push( this.arrowmesh );
        }

        this.bonds = buildBondList(
            this.atomobjects,
            this.bondRules,
            this.getBondRuleKey.bind(this),
            this.getDefaultBondCutoff.bind(this),
            { requireRule: true },
        );

        const createBondMaterial = function(vertexColorsEnabled) {
            let bondMaterialConfig = {
                color: vertexColorsEnabled ? 0xffffff : this.bondscolor,
                blending: THREE.NormalBlending,
                vertexColors: vertexColorsEnabled
            };
            return this.createShadedMaterial(bondMaterialConfig);
        }.bind(this);

        //build bond meshes
        if (this.bonds.length > 0) {
            let bondGeometry = createBondCylinderGeometry(
                this.bondRadius, 1.0, this.bondSegments, this.bondVertical
            );

            // With per-atom colours each bond is drawn as two halves:
            // instance 2*i is the half next to atom a and 2*i+1 the half next to atom b.
            let instanceCount = this.bondColorByAtom ? 2 * this.bonds.length : this.bonds.length;
            this.bondmesh = new THREE.InstancedMesh(
                bondGeometry,
                createBondMaterial(false),
                instanceCount
            );
            if (this.bondColorByAtom) {
                this.bondmesh.material.color.setHex(0xffffff);
            }
            this.bondmesh.name = "bonds";
            this.bondmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.bondmesh.frustumCulled = false;
            this.bondmeshes.push(this.bondmesh);
            this.bondobjects.push(this.bondmesh);
            this.scene.add(this.bondmesh);
            this.refreshBondMeshColors();
        }

        this.updateDynamicTransforms();
    }

    removeStructure() {
        let nobjects = this.scene.children.length;
        let scene = this.scene

        //remove everything, releasing the GPU resources of the meshes built by addStructure
        for (let i=nobjects-1; i>=0; i--) {
            let child = scene.children[i];
            this.disposeSceneObject(child);
            if (child.isInstancedMesh) {
                child.dispose();
            }
            scene.remove(child);
        }
    }

    update(phononweb) {
        /*
        this is the entry point of the phononweb
        structure.
        It must contain:
            1. atoms
            2. vibrations
            3. phonon
        */

        // Selecting another mode of the same structure only changes the vibrations,
        // so the scene can be kept and only the displacements updated.
        let sameStructure = this.initialized &&
            this.scene && this.atomobjects && this.atomobjects.length &&
            phononweb.phonon === this.phonon &&
            phononweb.atoms === this.atoms;

        this.phonon     = phononweb.phonon;
        this.vibrations = phononweb.vibrations;
        this.atoms      = phononweb.atoms;
        this.captureK   = Number(phononweb.k);
        this.captureN   = Number(phononweb.n);
        this.vibrationComponents = this.vibrations.map((v) => [
            getComplexParts(v[0]),
            getComplexParts(v[1]),
            getComplexParts(v[2])
        ]);
        if (this.autoBondRulesSourcePhonon !== this.phonon || !Object.keys(this.bondRules).length) {
            this.initializeBondRulesFromAtoms(this.atoms, this.phonon.atom_numbers);
            this.autoBondRulesSourcePhonon = this.phonon;
        }

        if (sameStructure) {
            this.updateDynamicTransforms();
            this.needsRender = true;
            this.startAnimationLoop();
            return;
        }

        //check if it is initialized
        if (!this.initialized) {
            this.init()
            this.initialized = true;
        }

        this.updatelocal();
    }

    setAppearanceUpdatedCallback(callback) {
        this.onAppearanceUpdated = callback;
    }

    updatelocal(notifyAppearanceUpdate = false) {
        this.removeStructure();
        this.addLights();
        this.getAtypes(this.phonon.atom_numbers);
        this.addStructure(this.atoms,this.phonon.atom_numbers);
        this.addCell(this.phonon.lat);
        this.adjustCovalentRadiiSelect();
        if (notifyAppearanceUpdate && typeof this.onAppearanceUpdated === 'function') {
            this.onAppearanceUpdated();
        }
        this.needsRender = true;
        this.startAnimationLoop();
    }

    onWindowResize() {
        super.onWindowResize();
        this.needsRender = true;
    }

    updateStructure() {
        this.updatelocal();
    }

    playpause() {
        if (this.paused) { this.paused = false; }
        else             { this.paused = true;  }
        if (!this.paused) {
            this.lastFrameTime = null;
        }
        this.needsRender = true;
    }

    pause() {
        if (this.animationFrameId !== null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.animationFrameId);
            } else {
                clearTimeout(this.animationFrameId);
            }
            this.animationFrameId = null;
        }
    }

    startAnimationLoop() {
        if (!this.controls || !this.camera || !this.scene || !this.renderer) {
            this.render();
            return;
        }
        if (this.animationFrameId === null) {
            this.lastFrameTime = null;
            if (typeof requestAnimationFrame === 'function') {
                this.animationFrameId = requestAnimationFrame( this.animateFrame );
            } else {
                this.animationFrameId = setTimeout(() => this.animate(Date.now()), 16);
            }
        }
    }

    animate(timestamp) {
        if (!this.controls || !this.camera || !this.scene || !this.renderer) {
            this.animationFrameId = null;
            return;
        }
        if (this.lastFrameTime === null) {
            this.lastFrameTime = timestamp;
        }

        let dt = (timestamp - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = timestamp;
        if (dt > 0.05) dt = 0.05;

        if (!this.paused && this.captureState !== 'capturing') {
            this.time += dt * this.speed;
        }
        this.controls.update();
        if (!this.paused || this.needsRender) {
            this.render();
        }
        if (typeof requestAnimationFrame === 'function') {
            this.animationFrameId = requestAnimationFrame( this.animateFrame );
        } else {
            this.animationFrameId = setTimeout(() => this.animate(Date.now()), 16);
        }
    }

    getPhaseFactors() {
        /*
        complex factor A*exp(i*2*pi*t) applied to the eigenvectors at the current time
        */
        let phaseTime = this.time;
        if (this.captureState === 'capturing' && this.captureFrameTarget > 0) {
            phaseTime = this.capturePhaseStart + (this.captureFrameCount / this.captureFrameTarget);
        }
        let phaseAngle = phaseTime * 2.0 * mat.pi;
        return [this.amplitude * Math.cos(phaseAngle), this.amplitude * Math.sin(phaseAngle)];
    }

    updateDynamicTransforms(phaseRe, phaseIm) {
        /*
        update the atoms, bonds and arrows instance matrices for the given phase
        */
        if (phaseRe === undefined) {
            [phaseRe, phaseIm] = this.getPhaseFactors();
        }
        let atomobjects = this.atomobjects || [];
        let vibrationComponents = this.vibrationComponents || [];
        if (vibrationComponents.length < atomobjects.length) {
            return;
        }

        //update positions according to vibrational modes
        let arrowmesh = this.arrows ? this.arrowmesh : null;
        let dummy = this.instanceDummy;
        let s = .5*this.arrowScale/this.amplitude;
        for (let i=0; i<atomobjects.length; i++) {
            let atom       = atomobjects[i];
            let atompos    = this.atompos[i];
            let vibrations = vibrationComponents[i];

            let vx = phaseRe * vibrations[0][0] - phaseIm * vibrations[0][1];
            let vy = phaseRe * vibrations[1][0] - phaseIm * vibrations[1][1];
            let vz = phaseRe * vibrations[2][0] - phaseIm * vibrations[2][1];

            let x  = atompos.x + vx;
            let y  = atompos.y + vy;
            let z  = atompos.z + vz;

            atom.position.set( x, y, z );

            //the atom instance matrices are pure translations: write them directly
            let atomInstance = this.atomInstanceRefs[i];
            let matrixArray = atomInstance.mesh.instanceMatrix.array;
            let offset = 16 * atomInstance.instanceId;
            matrixArray[offset + 12] = x;
            matrixArray[offset + 13] = y;
            matrixArray[offset + 14] = z;

            if (arrowmesh) {

                //velocity vector
                scratchVel.set(vx,vy,vz);
                let vlength = scratchVel.length()/this.amplitude;

                dummy.position.set(x+vx*s,y+vy*s,z+vz*s);
                dummy.scale.set(1, vlength*this.arrowScale, 1);
                dummy.quaternion.setFromUnitVectors(vec_y,scratchVel.normalize());
                dummy.updateMatrix();
                arrowmesh.setMatrixAt(i, dummy.matrix);
            }
        }

        //update the bonds positions
        let bondmesh = this.bondmesh;
        if (bondmesh) {
            for (let i=0; i<this.bonds.length; i++) {
                let bond = this.bonds[i];
                let lengthNow = computeBondFrame(bond.a, bond.b, scratchMid, dummy.quaternion, scratchDir);
                if (this.bondColorByAtom) {
                    scratchOffset.copy(scratchDir).multiplyScalar(lengthNow * 0.25);
                    dummy.scale.set(1, lengthNow * 0.5, 1);

                    dummy.position.copy(scratchMid).sub(scratchOffset);
                    dummy.updateMatrix();
                    bondmesh.setMatrixAt(2 * i, dummy.matrix);

                    dummy.position.copy(scratchMid).add(scratchOffset);
                    dummy.updateMatrix();
                    bondmesh.setMatrixAt(2 * i + 1, dummy.matrix);
                } else {
                    dummy.position.copy(scratchMid);
                    dummy.scale.set(1, lengthNow, 1);
                    dummy.updateMatrix();
                    bondmesh.setMatrixAt(i, dummy.matrix);
                }
            }
            bondmesh.instanceMatrix.needsUpdate = true;
        }

        for (let i=0; i<this.atommeshes.length; i++) {
            this.atommeshes[i].instanceMatrix.needsUpdate = true;
        }
        if (arrowmesh) {
            arrowmesh.instanceMatrix.needsUpdate = true;
        }
    }

    render() {
        if (!this.renderer || !this.scene || !this.camera) {
            this.needsRender = false;
            return;
        }

        if (!this.paused) {
            let [phaseRe, phaseIm] = this.getPhaseFactors();
            this.updateDynamicTransforms(phaseRe, phaseIm);
        }

        this.renderer.render( this.scene, this.camera );

        //if the capturer exists then capture
        if (this.capturer) {
            this.capturer.capture( this.canvas );
            this.captureFrameCount += 1;
            if (this.captureFrameCount >= this.captureFrameTarget) {
                this.captureend(this.captureFormat || 'webm');
            }
        } else if (this.captureRecorder && this.captureState === 'capturing') {
            let progress = document.getElementById('progress');
            this.captureFrameCount += 1;

            if (progress && this.captureFrameTarget > 0) {
                progress.style.width = (Math.min(this.captureFrameCount / this.captureFrameTarget, 1.0) * 100) + '%';
            }

            if (this.captureFrameCount >= this.captureFrameTarget) {
                this.captureend('webm');
            }
        }

        if (this.stats) {
            this.stats.update();
        }
        this.needsRender = false;
    }
}

Object.assign(VibCrystal.prototype, sharedViewerMethods);
