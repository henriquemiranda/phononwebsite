import * as THREE from 'three';
import { TrackballControls } from './static_libs/TrackballControls.js';
import { atomic_symbol, covalent_radii } from './atomic_data.js';
import { createAtomBadgeHtml } from './atomcolors.js';
import { bindAppearanceAtomSelection, bindBondRuleControls, bindEnterToApply, createBondColorInputStateUpdater } from './appearancecontrols.js';
import { IsosurfaceController } from './isosurfacecontroller.js';
import { getRaymarchPerformanceProfile } from './raymarchperformance.js';
import { getCombinations } from './utils.js';
import { createAtomSphereGeometry, createBondCylinderGeometry } from './viewergeometry.js';
import { buildBondList, getViewerAtomRadius } from './viewermeshes.js';
import { getSharedLightConfig, sharedViewerMethods } from './viewercommon.js';

const vecY = new THREE.Vector3(0, 1, 0);

function getBond(point1, point2) {
    const direction = new THREE.Vector3().subVectors(point2, point1);

    return {
        quaternion: new THREE.Quaternion().setFromUnitVectors(vecY, direction.clone().normalize()),
        midpoint: point1.clone().add(direction.multiplyScalar(0.5)),
    };
}

export class StructureViewerBase {

    constructor() {
        this.display = 'jmol';
        this.shading = true;
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.values = null;
        this.sizex = 1;
        this.sizey = 1;
        this.sizez = 1;
        this.cell = null;
        this.isosurfaceState = {
            level: 0.02,
            levelWasManuallySet: false,
        };
        this.isosurfaceOpacity = 0.18;
        this.isosurfaceRenderMode = 'marching-cubes';
        this.isInitialized = false;
        this.continuousRender = false;
        this.renderQueued = false;
        this.interactionActive = false;
        this.interactionTimeoutId = null;

        this.cameraViewAngle = 18;
        this.cameraNear = 0.1;
        this.cameraFar = 5000;
        this.cameraDistance = 300;

        this.sphereRadius = 0.5;
        this.sphereLat = 12;
        this.sphereLon = 12;
        this.bondRadius = 0.1;
        this.bondSegments = 6;
        this.bondVertical = 1;

        this.bondscolor = 0xffffff;
        this.defaultBondsColor = this.bondscolor;
        this.bondColorByAtom = true;
        this.defaultBondColorByAtom = this.bondColorByAtom;
        this.defaultBondRadius = this.bondRadius;
        this.atomColorOverrides = {};
        this.atomRadiusScaleOverrides = {};
        this.defaultAtomRadiusScale = 1.0;
        this.appearanceSelectedAtomNumber = null;
        this.bondRules = {};
        this.isosurfaceController = new IsosurfaceController(this);
    }

    init(container = this.container, options = {}) {
        this.container = container;
        this.continuousRender = options.continuousRender === true;
        const containerElement = container.get(0);
        this.dimensions = this.getContainerDimensions();

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            this.cameraViewAngle,
            this.dimensions.ratio,
            this.cameraNear,
            this.cameraFar,
        );
        this.camera.position.set(0, 0, this.cameraDistance);
        this.camera.lookAt(this.scene.position);

        const lightConfig = getSharedLightConfig();
        this.pointLight = new THREE.PointLight(lightConfig.color, lightConfig.intensity);
        this.pointLight.position.set(...lightConfig.position);
        this.pointLight.decay = lightConfig.decay;
        this.pointLight.visible = true;
        this.camera.add(this.pointLight);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(0xffffff);
        if ('outputColorSpace' in this.renderer && 'LinearSRGBColorSpace' in THREE) {
            this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        }
        if ('toneMapping' in this.renderer) {
            this.renderer.toneMapping = THREE.NoToneMapping;
        }
        this.appliedRendererSize = null;
        this.updateRendererPixelRatio();
        containerElement.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;
        this.canvas.style.display = 'block';

        if (!containerElement.clientHeight) {
            containerElement.style.height = `${this.dimensions.height}px`;
        }
        if (containerElement.parentElement && !containerElement.parentElement.clientHeight) {
            containerElement.parentElement.style.height = `${this.dimensions.height}px`;
        }

        const controlsElement = options.controlsElement || this.renderer.domElement;
        this.controls = new TrackballControls(this.camera, controlsElement);
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 0.3;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;
        this.controls.addEventListener('change', () => {
            this.handleInteractionActivity();
            this.requestRender();
        });
        if (typeof options.configureControls === 'function') {
            options.configureControls(this.controls);
        }

        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.isInitialized = true;
        if (typeof options.afterInit === 'function') {
            options.afterInit();
        }
        this.onWindowResize();
        const shouldStartAnimation = Object.prototype.hasOwnProperty.call(options, 'startAnimation')
            ? options.startAnimation !== false
            : true;
        if (shouldStartAnimation) {
            this.animate();
        }
    }

    clearIsosurfacePreviewCache() {
        this.isosurfaceController.clearPreviewCache();
    }

    get isolevel() {
        return this.isosurfaceState.level;
    }

    getIsolevel() {
        return this.isosurfaceState.level;
    }

    hasManualIsolevel() {
        return this.isosurfaceState.levelWasManuallySet;
    }

    setIsolevelState(level, { manual = this.hasManualIsolevel() } = {}) {
        const numericLevel = Number(level);
        if (!Number.isFinite(numericLevel)) {
            return this.isosurfaceState.level;
        }
        this.isosurfaceState.level = numericLevel;
        this.isosurfaceState.levelWasManuallySet = !!manual;
        return numericLevel;
    }

    resetIsolevelState(level) {
        return this.setIsolevelState(level, { manual: false });
    }

    setIsosurfaceRenderMode(mode) {
        this.isosurfaceController.setMode(mode);
        this.isosurfaceRenderMode = this.isosurfaceController.getMode();
        this.updateRendererPixelRatio();
        if (Array.isArray(this.values) && this.values.length) {
            this.updateIsosurface();
        }
    }

    getIsosurfaceRenderMode() {
        return this.isosurfaceController.getMode();
    }

    getContainerDimensions() {
        let width = this.container.width();
        let height = this.container.height();

        if (!width || !height) {
            const rect = this.container.get(0).getBoundingClientRect();
            width = rect.width;
            height = rect.height;
        }
        if ((!width || !height) && this.container.get(0).parentElement) {
            const rect = this.container.get(0).parentElement.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
        }
        if (!width || !height) {
            width = Math.max(window.innerWidth * 0.5, 300);
            height = Math.max(window.innerHeight * 0.5, 300);
        }

        return { width, height, ratio: width / height };
    }

    getPreferredPixelRatio() {
        const nativePixelRatio = window.devicePixelRatio || 1;
        if (!this.getIsosurfaceRenderMode().startsWith('raymarch')) {
            // beyond 2x the extra pixels are hardly visible but cost a lot of fill rate
            return Math.min(nativePixelRatio, 2);
        }
        const interpolation = this.getIsosurfaceRenderMode() === 'raymarch-tricubic' ? 'tricubic' : 'trilinear';
        const profile = getRaymarchPerformanceProfile({
            interacting: this.interactionActive,
            selectedInterpolation: interpolation,
            gridSizeMax: Math.max(this.sizex || 1, this.sizey || 1, this.sizez || 1),
        });
        return nativePixelRatio / profile.resolutionDivisor;
    }

    getRaymarchRenderConfig(baseInterpolation) {
        return getRaymarchPerformanceProfile({
            interacting: this.interactionActive,
            selectedInterpolation: baseInterpolation,
            gridSizeMax: Math.max(this.sizex || 1, this.sizey || 1, this.sizez || 1),
        });
    }

    handleInteractionActivity() {
        const wasActive = this.interactionActive;
        this.interactionActive = true;
        this.updateRendererPixelRatio();
        if (!wasActive && this.getIsosurfaceRenderMode().startsWith('raymarch') && Array.isArray(this.values) && this.values.length) {
            this.updateIsosurface();
        }

        if (this.interactionTimeoutId) {
            window.clearTimeout(this.interactionTimeoutId);
        }
        this.interactionTimeoutId = window.setTimeout(() => {
            this.interactionActive = false;
            this.interactionTimeoutId = null;
            this.updateRendererPixelRatio();
            if (this.getIsosurfaceRenderMode().startsWith('raymarch') && Array.isArray(this.values) && this.values.length) {
                this.updateIsosurface();
            } else {
                this.requestRender();
            }
        }, 140);
    }

    updateRendererPixelRatio() {
        if (!this.renderer) {
            return;
        }
        const pixelRatio = this.getPreferredPixelRatio();
        const width = this.dimensions ? this.dimensions.width : 0;
        const height = this.dimensions ? this.dimensions.height : 0;
        // called on every controls change event: skip resizing the drawing buffer when nothing changed
        const applied = this.appliedRendererSize;
        if (applied && applied.pixelRatio === pixelRatio && applied.width === width && applied.height === height) {
            return;
        }
        this.appliedRendererSize = { pixelRatio, width, height };
        this.renderer.setPixelRatio(pixelRatio);
        if (width && height) {
            this.renderer.setSize(width, height, false);
        }
    }

    setDisplayCombo(domCombo) {
        this.domDisplaySelect = domCombo;
        if (domCombo && domCombo.length) {
            domCombo.val(this.display);
            domCombo.on('change', () => {
                this.display = domCombo.val() || this.display;
                this.updateLightStyle();
                this.refreshAppearanceControls();
                this.updateStructure();
            });
        }
    }

    setAppearanceControls(
        domAtomList,
        domAtomColorInput,
        domBondColorInput,
        domBondColorByAtomCheckbox,
        domAtomRadiusInput,
        domBondRadiusInput,
        domBondRulesList,
        domBondAddAtomA,
        domBondAddAtomB,
        domBondAddCutoffInput,
        domResetAtomButton,
        domResetBondsButton,
    ) {
        this.domAppearanceAtomList = domAtomList;
        this.domAtomColorInput = domAtomColorInput;
        this.domBondColorInput = domBondColorInput;
        this.domBondColorByAtomCheckbox = domBondColorByAtomCheckbox;
        this.domAtomRadiusInput = domAtomRadiusInput;
        this.domBondRadiusInput = domBondRadiusInput;
        this.domBondRulesList = domBondRulesList;
        this.domBondAddAtomA = domBondAddAtomA;
        this.domBondAddAtomB = domBondAddAtomB;
        this.domBondAddCutoffInput = domBondAddCutoffInput;
        const updateBondColorInputState = createBondColorInputStateUpdater(this, domBondColorInput);

        bindAppearanceAtomSelection(this, domAtomList, domAtomColorInput, domAtomRadiusInput);

        const applyAppearanceSettings = () => {
            const atomNumber = Number(this.getSelectedAppearanceAtomNumber());
            if (Number.isFinite(atomNumber)) {
                if (domAtomColorInput && domAtomColorInput.length) {
                    const rawAtomColor = domAtomColorInput.val();
                    if (rawAtomColor) {
                        const defaultHex = this.getDefaultAtomColor(atomNumber);
                        const selectedHex = this.normalizeColorHex(rawAtomColor, defaultHex);
                        if (selectedHex === defaultHex) {
                            this.clearAtomColorOverride(atomNumber);
                        } else {
                            this.atomColorOverrides[atomNumber] = selectedHex;
                        }
                    }
                }

                if (domAtomRadiusInput && domAtomRadiusInput.length) {
                    const atomScale = Math.max(0.1, parseFloat(domAtomRadiusInput.val()) || this.defaultAtomRadiusScale);
                    this.setAtomRadiusScaleOverride(atomNumber, atomScale);
                    domAtomRadiusInput.val(atomScale);
                }
            }

            if (!this.bondColorByAtom && domBondColorInput && domBondColorInput.length) {
                this.bondscolor = this.normalizeColorHex(domBondColorInput.val(), this.bondscolor);
            }
            if (domBondColorByAtomCheckbox && domBondColorByAtomCheckbox.length) {
                this.bondColorByAtom = !!domBondColorByAtomCheckbox.prop('checked');
            }
            updateBondColorInputState();

            if (domBondRadiusInput && domBondRadiusInput.length) {
                this.bondRadius = Math.max(0.01, parseFloat(domBondRadiusInput.val()) || this.bondRadius);
                domBondRadiusInput.val(this.bondRadius);
            }

            this.updateStructure();
        };

        if (domAtomColorInput && domAtomColorInput.length) {
            domAtomColorInput.on('change', applyAppearanceSettings);
        }

        if (domBondColorInput && domBondColorInput.length) {
            domBondColorInput.val(this.colorToInputHex(this.bondscolor));
            domBondColorInput.on('change', applyAppearanceSettings);
        }

        if (domBondColorByAtomCheckbox && domBondColorByAtomCheckbox.length) {
            domBondColorByAtomCheckbox.prop('checked', this.bondColorByAtom);
            domBondColorByAtomCheckbox.on('change', applyAppearanceSettings);
        }

        if (domAtomRadiusInput && domAtomRadiusInput.length) {
            domAtomRadiusInput.attr('min', 0.1);
            domAtomRadiusInput.attr('max', 5.0);
            domAtomRadiusInput.attr('step', 0.05);
        }

        if (domBondRadiusInput && domBondRadiusInput.length) {
            domBondRadiusInput.attr('min', 0.01);
            domBondRadiusInput.attr('max', 1.0);
            domBondRadiusInput.attr('step', 0.01);
            domBondRadiusInput.val(this.bondRadius);
        }

        bindBondRuleControls(
            this,
            domBondRulesList,
            domBondAddAtomA,
            domBondAddAtomB,
            domBondAddCutoffInput,
            () => {
                this.refreshAppearanceControls();
                this.updateStructure();
            },
        );

        bindEnterToApply([domAtomRadiusInput, domBondRadiusInput], applyAppearanceSettings);

        if (domResetAtomButton && domResetAtomButton.length) {
            domResetAtomButton.on('click', () => {
                const atomNumber = this.getSelectedAppearanceAtomNumber();
                if (Number.isFinite(atomNumber)) {
                    this.clearAtomColorOverride(atomNumber);
                    delete this.atomRadiusScaleOverrides[atomNumber];
                }
                this.refreshAppearanceControls();
                this.updateStructure();
            });
        }

        if (domResetBondsButton && domResetBondsButton.length) {
            domResetBondsButton.on('click', () => {
                this.bondscolor = this.defaultBondsColor;
                this.bondColorByAtom = this.defaultBondColorByAtom;
                this.bondRadius = this.defaultBondRadius;
                this.initializeBondRulesFromAtoms();
                this.refreshAppearanceControls();
                this.updateStructure();
            });
        }

        updateBondColorInputState();
    }

    refreshAppearanceControls() {
        if (!this.atom_numbers || !this.atom_numbers.length) {
            return;
        }

        const uniqueAtomNumbers = this.atom_numbers.filter((value, index, array) => array.indexOf(value) === index);
        let selected = Number(this.getSelectedAppearanceAtomNumber());
        if (!Number.isFinite(selected) || !uniqueAtomNumbers.includes(selected)) {
            selected = uniqueAtomNumbers[0];
        }

        if (this.domAppearanceAtomList && this.domAppearanceAtomList.length) {
            this.domAppearanceAtomList.empty();
            for (let i = 0; i < uniqueAtomNumbers.length; i++) {
                const atomNumber = uniqueAtomNumbers[i];
                this.domAppearanceAtomList.append(
                    `<button type="button" data-atom-number="${atomNumber}">${createAtomBadgeHtml(atomic_symbol[atomNumber], atomNumber, this.getAtomColorHex.bind(this))}</button>`
                );
            }
        }

        this.setSelectedAppearanceAtomNumber(selected);

        if (this.domDisplaySelect && this.domDisplaySelect.length) {
            this.domDisplaySelect.val(this.display);
        }
        if (this.domAtomColorInput && this.domAtomColorInput.length) {
            this.domAtomColorInput.val(this.colorToInputHex(this.getAtomColorHex(selected)));
        }
        if (this.domAtomRadiusInput && this.domAtomRadiusInput.length) {
            this.domAtomRadiusInput.val(this.getAtomRadiusScale(selected));
        }
        if (this.domBondColorInput && this.domBondColorInput.length) {
            this.domBondColorInput.val(this.colorToInputHex(this.bondscolor));
            this.domBondColorInput.prop('disabled', this.bondColorByAtom);
        }
        if (this.domBondColorByAtomCheckbox && this.domBondColorByAtomCheckbox.length) {
            this.domBondColorByAtomCheckbox.prop('checked', this.bondColorByAtom);
        }
        if (this.domBondRadiusInput && this.domBondRadiusInput.length) {
            this.domBondRadiusInput.val(this.bondRadius);
        }
        if (this.domBondAddAtomA && this.domBondAddAtomA.length) {
            const previous = this.domBondAddAtomA.val();
            this.domBondAddAtomA.empty();
            for (let i = 0; i < uniqueAtomNumbers.length; i++) {
                const atomNumber = uniqueAtomNumbers[i];
                this.domBondAddAtomA.append(`<option value="${atomNumber}">${atomic_symbol[atomNumber]}</option>`);
            }
            if (previous !== null && uniqueAtomNumbers.includes(Number(previous))) {
                this.domBondAddAtomA.val(previous);
            }
        }
        if (this.domBondAddAtomB && this.domBondAddAtomB.length) {
            const previous = this.domBondAddAtomB.val();
            this.domBondAddAtomB.empty();
            for (let i = 0; i < uniqueAtomNumbers.length; i++) {
                const atomNumber = uniqueAtomNumbers[i];
                this.domBondAddAtomB.append(`<option value="${atomNumber}">${atomic_symbol[atomNumber]}</option>`);
            }
            if (previous !== null && uniqueAtomNumbers.includes(Number(previous))) {
                this.domBondAddAtomB.val(previous);
            }
        }
        if (this.domBondAddCutoffInput && this.domBondAddCutoffInput.length && this.domBondAddAtomA && this.domBondAddAtomB) {
            const a = Number(this.domBondAddAtomA.val());
            const b = Number(this.domBondAddAtomB.val());
            if (Number.isFinite(a) && Number.isFinite(b)) {
                const key = this.getBondRuleKey(a, b);
                const value = this.bondRules[key] ? this.bondRules[key].cutoff : this.getDefaultBondCutoff(a, b);
                this.domBondAddCutoffInput.val(Number(value).toFixed(2));
            }
        }
        this.refreshBondRulesUI();
    }

    getDefaultBondCutoff(atomNumberA, atomNumberB) {
        return covalent_radii[atomNumberA] + covalent_radii[atomNumberB];
    }

    initializeBondRulesFromAtoms() {
        this.bondRules = {};
        if (!this.atoms || !this.atom_numbers) {
            return;
        }
        const tmpAtoms = [];
        for (let i = 0; i < this.atoms.length; i++) {
            tmpAtoms.push({
                atom_number: this.atom_numbers[this.atoms[i][0]],
                position: new THREE.Vector3(this.atoms[i][1], this.atoms[i][2], this.atoms[i][3]),
            });
        }
        const combinations = getCombinations(tmpAtoms);
        for (let i = 0; i < combinations.length; i++) {
            const a = combinations[i][0];
            const b = combinations[i][1];
            const length = a.position.distanceTo(b.position);
            const cutoff = this.getDefaultBondCutoff(a.atom_number, b.atom_number);
            if (length < cutoff) {
                this.setBondRule(a.atom_number, b.atom_number, cutoff);
            }
        }
    }

    getAtomMaterials() {
        this.materials = [];
        for (let i = 0; i < this.atom_numbers.length; i++) {
            const number = this.atom_numbers[i];
            const atomColor = this.getAtomColor(number);
            let material = this.createShadedMaterial({ blending: THREE.NormalBlending });
            material.color.copy(atomColor);
            this.materials.push(material);
        }
    }

    updateViewParameters() {
        if (!this.atoms || !this.atoms.length) {
            return;
        }

        let maxRadius = 0;

        for (let i = 0; i < this.atoms.length; i++) {
            const atomI = this.atoms[i];
            const posI = new THREE.Vector3(atomI[1], atomI[2], atomI[3]).sub(this.geometricCenter);
            maxRadius = Math.max(maxRadius, posI.length());
        }

        const halfFov = (this.cameraViewAngle * Math.PI / 180) / 2;
        this.cameraDistance = Math.max(45, (maxRadius / Math.tan(halfFov)) * 1.25);
        this.setCameraDirection('z');
    }

    addStructure() {
        this.atomobjects = [];
        this.bondobjects = [];
        this.bonds = [];

        const sphereGeometries = new Map();

        for (let i = 0; i < this.atoms.length; i++) {
            const atomTypeIndex = this.atoms[i][0];
            const atomNumber = this.atom_numbers[atomTypeIndex];
            if (!sphereGeometries.has(atomTypeIndex)) {
                const atomScale = this.getAtomRadiusScale(atomNumber);
                const radius = getViewerAtomRadius(
                    this.display,
                    atomNumber,
                    atomScale,
                    this.sphereRadius,
                    covalent_radii,
                );
                sphereGeometries.set(
                    atomTypeIndex,
                    createAtomSphereGeometry(radius, this.sphereLat, this.sphereLon),
                );
            }

            const object = new THREE.Mesh(sphereGeometries.get(atomTypeIndex), this.materials[atomTypeIndex]);
            const pos = new THREE.Vector3(this.atoms[i][1], this.atoms[i][2], this.atoms[i][3]);
            pos.sub(this.geometricCenter);

            object.position.copy(pos);
            object.name = 'atom';
            object.atom_number = this.atom_numbers[this.atoms[i][0]];

            this.scene.add(object);
            this.atomobjects.push(object);
        }

        this.bonds = buildBondList(
            this.atomobjects,
            this.bondRules,
            this.getBondRuleKey.bind(this),
            this.getDefaultBondCutoff.bind(this),
            { requireRule: true },
        );

        for (let i = 0; i < this.bonds.length; i++) {
            const bondEntry = this.bonds[i];
            const bond = getBond(bondEntry.a, bondEntry.b);
            const createBondSegment = (length, midpoint, colorHex) => {
                const geometry = createBondCylinderGeometry(
                    this.bondRadius,
                    length,
                    this.bondSegments,
                    this.bondVertical,
                );
                let material = this.createShadedMaterial({ color: colorHex });
                const object = new THREE.Mesh(geometry, material);
                object.setRotationFromQuaternion(bond.quaternion);
                object.position.copy(midpoint);
                object.name = 'bond';
                this.scene.add(object);
                this.bondobjects.push(object);
            };

            if (this.bondColorByAtom) {
                const direction = new THREE.Vector3().subVectors(bondEntry.b, bondEntry.a).normalize();
                const halfLength = bondEntry.baseLength / 2;
                const midpointA = bondEntry.a.clone().addScaledVector(direction, halfLength / 2);
                const midpointB = bondEntry.b.clone().addScaledVector(direction, -halfLength / 2);
                createBondSegment(halfLength, midpointA, this.getAtomColorHex(bondEntry.a_atom_number));
                createBondSegment(halfLength, midpointB, this.getAtomColorHex(bondEntry.b_atom_number));
            } else {
                createBondSegment(bondEntry.baseLength, bond.midpoint, this.bondscolor);
            }
        }
    }

    removeStructure() {
        if (!this.scene) {
            return;
        }

        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            this.disposeSceneObject(this.scene.children[i]);
            this.scene.remove(this.scene.children[i]);
        }
    }

    getMarchingCubesOptions() {
        return { insideIsAbove: true };
    }

    requestMarchingCubesUpdate() {
        this.isosurfaceController.requestUpdate();
    }

    updateIsosurfaceSync() {
        this.isosurfaceController.updateSync();
    }

    updateIsosurfacePreview() {
        this.isosurfaceController.updatePreview();
    }

    updateIsosurface() {
        this.requestMarchingCubesUpdate();
    }

    changeIsolevel(isolevel) {
        this.setIsolevelState(isolevel, { manual: true });
        this.updateIsosurfaceSync();
    }

    changeIsosurfaceOpacity(opacity) {
        const numericOpacity = Number(opacity);
        if (!Number.isFinite(numericOpacity)) {
            return;
        }

        this.isosurfaceOpacity = Math.max(0, Math.min(1, numericOpacity));
        this.forEachNamedSceneObject('isosurface', (mesh) => {
            if (mesh.material) {
                if (mesh.material.uniforms && mesh.material.uniforms.uOpacity) {
                    mesh.material.uniforms.uOpacity.value = this.isosurfaceOpacity;
                }
                mesh.material.opacity = this.isosurfaceOpacity;
                mesh.material.transparent = true;
                mesh.material.depthWrite = this.isosurfaceOpacity >= 0.999;
                mesh.material.needsUpdate = true;
            }
        });
        this.render();
    }

    previewIsolevel(isolevel) {
        this.setIsolevelState(isolevel, { manual: true });
        this.updateIsosurfacePreview();
    }

    setCameraDirection(direction) {
        if (!this.camera) {
            return;
        }

        if (direction === 'x') {
            this.camera.position.set(this.cameraDistance, 0, 0);
            this.camera.up.set(0, 0, 1);
        }
        if (direction === 'y') {
            this.camera.position.set(0, this.cameraDistance, 0);
            this.camera.up.set(0, 0, 1);
        }
        if (direction === 'z') {
            this.camera.position.set(0, 0, this.cameraDistance);
            this.camera.up.set(0, 1, 0);
        }
    }

    addMarchingCubes() {
        this.requestMarchingCubesUpdate();
    }

    createIsosurfaceMaterial() {
        return new THREE.MeshLambertMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.isosurfaceOpacity,
            depthWrite: this.isosurfaceOpacity >= 0.999,
        });
    }

    addMarchingCubesGeometry(geometry) {
        const mesh = new THREE.Mesh(geometry, this.createIsosurfaceMaterial());
        mesh.name = 'isosurface';
        mesh.position.sub(this.geometricCenter);
        this.scene.add(mesh);
    }

    addIsosurfaceObject(object) {
        if (!object) {
            return;
        }
        object.name = 'isosurface';
        if (this.geometricCenter) {
            object.position.copy(object.position.clone().sub(this.geometricCenter));
        }
        this.scene.add(object);
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) {
            return;
        }

        this.dimensions = this.getContainerDimensions();
        if (!this.dimensions.width || !this.dimensions.height) {
            return;
        }
        this.camera.aspect = this.dimensions.ratio;
        this.camera.updateProjectionMatrix();
        this.updateRendererPixelRatio();
        this.controls.handleResize();
        this.requestRender();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.update();
        if (this.continuousRender) {
            this.render();
        }
    }

    update() {
        if (this.controls) {
            this.controls.update();
        }
    }

    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    requestRender() {
        if (!this.renderer || !this.scene || !this.camera) {
            return;
        }
        if (this.continuousRender) {
            this.render();
            return;
        }
        if (this.renderQueued) {
            return;
        }
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            this.render();
        });
    }
}

Object.assign(StructureViewerBase.prototype, sharedViewerMethods);
