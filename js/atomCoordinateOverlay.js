import * as THREE from "three";

const HALO_COLOR = 0x4db6ff;
const HALO_OPACITY = 0.34;
const HALO_SCALE = 1.48;
const LABEL_OFFSET_X = 12;
const LABEL_OFFSET_Y = -14;
const FRACTION_TOLERANCE = 1e-5;
const SQRT3 = Math.sqrt(3);

function toVector3(value, fallback = new THREE.Vector3()) {
  if (!value) {
    return fallback.clone();
  }

  if (value.isVector3) {
    return value.clone();
  }

  if (Array.isArray(value)) {
    return new THREE.Vector3(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
  }

  return new THREE.Vector3(value.x ?? 0, value.y ?? 0, value.z ?? 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  material?.map?.dispose?.();
  material?.dispose?.();
}

function disposeObjectTree(root) {
  root.traverse((child) => {
    if (child === root) {
      return;
    }

    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  });
}

function normalizeNumeric(value) {
  return Math.abs(value) <= FRACTION_TOLERANCE ? 0 : value;
}

function findRational(value, denominators = [1, 2, 3, 4, 6, 8]) {
  const normalized = normalizeNumeric(value);

  for (const denominator of denominators) {
    const numerator = Math.round(normalized * denominator);

    if (Math.abs(normalized - numerator / denominator) <= FRACTION_TOLERANCE) {
      return {
        numerator,
        denominator
      };
    }
  }

  return null;
}

function formatRationalUnit(value, unit) {
  const rational = findRational(value);

  if (!rational) {
    return null;
  }

  const { numerator, denominator } = rational;

  if (numerator === 0) {
    return "0";
  }

  const sign = numerator < 0 ? "-" : "";
  const absoluteNumerator = Math.abs(numerator);

  if (denominator === 1) {
    return `${sign}${absoluteNumerator}${unit}`;
  }

  return `${sign}${absoluteNumerator}/${denominator}${unit}`;
}

function formatDecimalUnit(value, unit) {
  const normalized = normalizeNumeric(value);
  const rounded = normalized.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

  return rounded === "0" ? "0" : `${rounded}${unit}`;
}

function formatCubicFractionCoordinate(value) {
  return formatRationalUnit(value, "a") ?? formatDecimalUnit(value, "a");
}

function formatHcpBasalCoordinate(value, aLength = 1) {
  const normalized = normalizeNumeric(value / aLength);
  const rational = formatRationalUnit(normalized, "a");

  if (rational) {
    return rational;
  }

  const sqrt3Multiple = findRational(normalized / SQRT3, [1, 2, 3, 6]);

  if (sqrt3Multiple) {
    const { numerator, denominator } = sqrt3Multiple;

    if (numerator === 0) {
      return "0";
    }

    const sign = numerator < 0 ? "-" : "";
    const absoluteNumerator = Math.abs(numerator);
    const prefix = absoluteNumerator === 1 ? "√3" : `${absoluteNumerator}√3`;

    if (denominator === 1) {
      return `${sign}${prefix}a`;
    }

    return `${sign}${prefix}/${denominator}a`;
  }

  return formatDecimalUnit(normalized, "a");
}

function formatHcpHeightCoordinate(value, cellFrame = {}) {
  const cLength =
    cellFrame.height ?? ((cellFrame.zMax ?? 1) - (cellFrame.zMin ?? -1));
  const zMin =
    cellFrame.zMin ??
    (Number.isFinite(cellFrame.height) ? -cellFrame.height * 0.5 : -cLength * 0.5);
  const normalizedHeight = normalizeNumeric((value - zMin) / cLength);

  return (
    formatRationalUnit(normalizedHeight, "c") ??
    formatDecimalUnit(normalizedHeight, "c")
  );
}

function formatFallbackCoordinate(value) {
  const normalized = normalizeNumeric(value);

  return normalized.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function getBoxFractionalCoordinate(mesh, crystal) {
  if (mesh.userData?.fractionalCoord) {
    return toVector3(mesh.userData.fractionalCoord);
  }

  const cellFrame = crystal?.cellFrame ?? {};
  const size = toVector3(cellFrame.size, new THREE.Vector3(2, 2, 2));
  const local = toVector3(mesh.userData?.localPosition ?? mesh.position);

  return new THREE.Vector3(
    (local.x + size.x * 0.5) / size.x,
    (local.y + size.y * 0.5) / size.y,
    (local.z + size.z * 0.5) / size.z
  );
}

function getAtomPosition(mesh) {
  return toVector3(mesh.userData?.cartesianCoord ?? mesh.userData?.localPosition ?? mesh.position);
}

function hasExplicitDisplayCoordinate(userData) {
  return (
    userData?.displayCoord ||
    userData?.displayCartesianCoord ||
    userData?.symbolicCoord ||
    userData?.displayFractionalCoord
  );
}

function getExplicitDisplayCoordinate(userData) {
  return (
    userData?.displayCoord ||
    userData?.displayCartesianCoord ||
    userData?.symbolicCoord ||
    userData?.displayFractionalCoord ||
    ""
  );
}

function formatExplicitCoordinate(value) {
  if (Array.isArray(value)) {
    return `(${value.join(", ")})`;
  }

  if (value && typeof value === "object") {
    return `(${value.x ?? 0}, ${value.y ?? 0}, ${value.z ?? 0})`;
  }

  return String(value ?? "");
}

function formatCoordinate(mesh, crystal) {
  const userData = mesh.userData ?? {};

  if (hasExplicitDisplayCoordinate(userData)) {
    return formatExplicitCoordinate(getExplicitDisplayCoordinate(userData));
  }

  if (crystal?.cellFrame?.shape === "hexagonal-prism") {
    const position = getAtomPosition(mesh);
    const aLength = crystal.cellFrame.radius ?? 1;

    return `(${formatHcpBasalCoordinate(position.x, aLength)}, ${formatHcpBasalCoordinate(
      position.y,
      aLength
    )}, ${formatHcpHeightCoordinate(position.z, crystal.cellFrame)})`;
  }

  const fractional = getBoxFractionalCoordinate(mesh, crystal);

  if (fractional) {
    return `(${formatCubicFractionCoordinate(fractional.x)}, ${formatCubicFractionCoordinate(
      fractional.y
    )}, ${formatCubicFractionCoordinate(fractional.z)})`;
  }

  const position = getAtomPosition(mesh);

  return `(${formatFallbackCoordinate(position.x)}, ${formatFallbackCoordinate(
    position.y
  )}, ${formatFallbackCoordinate(position.z)})`;
}

function inferElementLabel(userData = {}) {
  const rawLabel =
    userData.element ||
    userData.species ||
    userData.atomType ||
    userData.label ||
    userData.category ||
    "原子";
  const text = String(rawLabel).trim();
  const knownSymbol = text.match(/\b(Na|Cl|Cs|C|Cu|Fe|Mg)\b/u);

  if (knownSymbol) {
    return knownSymbol[1];
  }

  const leadingSymbol = text.match(/^([A-Z][a-z]?)/u);

  return leadingSymbol?.[1] ?? text;
}

function getAuxiliaryMark(userData = {}) {
  if (userData.isGhost || userData.isGhostAtom) {
    return "辅助";
  }

  if (userData.isCoordinationHelper || userData.isHelper || userData.isAuxiliaryParticle) {
    return "辅助";
  }

  if (userData.isExtendedAtom) {
    return "扩展";
  }

  return "";
}

function createCoordinateHalo(mesh) {
  const radius = mesh.geometry?.parameters?.radius ?? 0.16;
  const geometry = new THREE.SphereGeometry(radius * HALO_SCALE, 30, 30);
  const material = new THREE.MeshPhongMaterial({
    color: HALO_COLOR,
    transparent: true,
    opacity: HALO_OPACITY,
    depthWrite: false,
    shininess: 120,
    emissive: new THREE.Color(HALO_COLOR).multiplyScalar(0.28)
  });
  const halo = new THREE.Mesh(geometry, material);

  halo.position.copy(toVector3(mesh.userData?.localPosition ?? mesh.position));
  halo.renderOrder = 12;
  halo.userData = {
    includeInFrame: false,
    isAtomCoordinateHalo: true
  };

  return halo;
}

export class AtomCoordinateOverlay {
  constructor({ attachTarget, labelContainer, camera }) {
    this.attachTarget = attachTarget;
    this.labelContainer = labelContainer;
    this.camera = camera;
    this.rootGroup = null;
    this.crystal = null;
    this.particleMeshesByIndex = [];
    this.selectedMesh = null;
    this.halo = null;
    this.labelElement = null;
    this.projectedPosition = new THREE.Vector3();
    this.worldPosition = new THREE.Vector3();
  }

  rebuild(crystal, particleMeshesByIndex = []) {
    this.clear({ removeRoot: true });
    this.crystal = crystal;
    this.particleMeshesByIndex = particleMeshesByIndex;

    if (!this.attachTarget) {
      return;
    }

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = `${crystal?.id ?? "crystal"}-atom-coordinate-overlay`;
    this.rootGroup.userData = {
      includeInFrame: false
    };
    this.attachTarget.add(this.rootGroup);
  }

  clear({ removeRoot = false } = {}) {
    this.clearSelection();

    if (removeRoot && this.rootGroup) {
      disposeObjectTree(this.rootGroup);
      this.rootGroup.removeFromParent();
      this.rootGroup = null;
    }

    if (removeRoot) {
      this.crystal = null;
      this.particleMeshesByIndex = [];
    }
  }

  clearSelection() {
    this.selectedMesh = null;

    if (this.halo) {
      this.halo.geometry?.dispose?.();
      disposeMaterial(this.halo.material);
      this.halo.removeFromParent();
      this.halo = null;
    }

    if (this.labelElement) {
      this.labelElement.remove();
      this.labelElement = null;
    }
  }

  selectAtom(mesh) {
    if (!mesh || mesh.userData?.coordinateSelectable === false) {
      this.clearSelection();
      return null;
    }

    this.clearSelection();
    this.selectedMesh = mesh;
    this.halo = createCoordinateHalo(mesh);
    this.rootGroup?.add(this.halo);
    this.labelElement = this.createLabelElement(mesh);
    this.labelContainer?.appendChild(this.labelElement);
    this.update();

    return {
      element: inferElementLabel(mesh.userData),
      coordinate: formatCoordinate(mesh, this.crystal)
    };
  }

  createLabelElement(mesh) {
    const labelElement = document.createElement("div");
    const elementLabel = inferElementLabel(mesh.userData);
    const auxiliaryMark = getAuxiliaryMark(mesh.userData);
    const coordinateText = formatCoordinate(mesh, this.crystal);
    const markHtml = auxiliaryMark
      ? `<span class="atom-coordinate-mark">${escapeHtml(auxiliaryMark)}</span>`
      : "";

    labelElement.className = "atom-coordinate-label";
    labelElement.innerHTML = `
      <span class="atom-coordinate-element">${escapeHtml(elementLabel)}${markHtml}</span>
      <span class="atom-coordinate-value">坐标：${escapeHtml(coordinateText)}</span>
    `;

    return labelElement;
  }

  update() {
    if (!this.selectedMesh || !this.labelElement || !this.camera) {
      return;
    }

    if (this.selectedMesh.visible === false) {
      this.labelElement.hidden = true;
      return;
    }

    this.selectedMesh.getWorldPosition(this.worldPosition);
    this.projectedPosition.copy(this.worldPosition).project(this.camera);

    if (
      this.projectedPosition.z < -1 ||
      this.projectedPosition.z > 1 ||
      Math.abs(this.projectedPosition.x) > 1.18 ||
      Math.abs(this.projectedPosition.y) > 1.18
    ) {
      this.labelElement.hidden = true;
      return;
    }

    const width = this.labelContainer?.clientWidth ?? 0;
    const height = this.labelContainer?.clientHeight ?? 0;
    const x = (this.projectedPosition.x * 0.5 + 0.5) * width;
    const y = (-this.projectedPosition.y * 0.5 + 0.5) * height;

    this.labelElement.hidden = false;
    this.labelElement.style.transform = `translate(${Math.round(
      x + LABEL_OFFSET_X
    )}px, ${Math.round(y + LABEL_OFFSET_Y)}px)`;
  }
}
