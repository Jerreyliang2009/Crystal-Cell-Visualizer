import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AtomContributionInteraction } from "./atomContributionInteraction.js";
import { AtomContributionRenderer } from "./atomContributionRenderer.js";
import { AtomCoordinateOverlay } from "./atomCoordinateOverlay.js";
import { AtomCoordinationRenderer } from "./atomCoordinationRenderer.js";
import { EffectiveAtomRenderer } from "./effectiveAtomRenderer.js";
import {
  axisConvention,
  getBuildStatusLabel,
  getCrystalById,
  getCrystalOptions,
  getDefaultCrystalId,
  getStandardViewOptions,
  projectMeta,
  standardViewDirections
} from "./crystalData.js";
import {
  renderCountingPanel,
  renderAtomLegend,
  setCountingPanelVisibility,
  setCrystalSummary,
  setPanelStatus,
  setupUI
} from "./ui.js";

const viewerContainer = document.getElementById("crystal-viewer");
const stageElement = document.getElementById("project-stage");
const modelElement = document.getElementById("current-model");
const typeElement = document.getElementById("crystal-type");
const representativeSubstanceElement = document.getElementById(
  "representative-substance"
);
const representativeFormulaElement = document.getElementById(
  "representative-formula"
);
const buildStatusElement = document.getElementById("build-status");
const supportElement = document.getElementById("feature-support");
const audienceElement = document.getElementById("target-audience");
const atomContributionHintElement = document.getElementById(
  "atom-contribution-hint"
);
const coordinationSelectionInfoElement = document.getElementById(
  "coordination-selection-info"
);

if (!viewerContainer) {
  throw new Error("未找到 3D 渲染容器 #crystal-viewer");
}

if (stageElement) {
  stageElement.textContent = projectMeta.stage;
}

if (audienceElement) {
  audienceElement.textContent = projectMeta.audience;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeaf2f7);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(5.2, 4.2, 5.8);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;
renderer.domElement.classList.add("viewer-renderer");
viewerContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.1;
controls.minDistance = 2.5;
controls.maxDistance = 16;

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8e4ef, 1.18));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
keyLight.position.set(5.5, 7, 4.5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

const scientificSpaceGroup = new THREE.Group();
scientificSpaceGroup.name = "scientific-space-group";
const scientificBridgeBasis = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(
    axisConvention.threeJsBridgeBasis.xAxis.x,
    axisConvention.threeJsBridgeBasis.xAxis.y,
    axisConvention.threeJsBridgeBasis.xAxis.z
  ),
  new THREE.Vector3(
    axisConvention.threeJsBridgeBasis.yAxis.x,
    axisConvention.threeJsBridgeBasis.yAxis.y,
    axisConvention.threeJsBridgeBasis.yAxis.z
  ),
  new THREE.Vector3(
    axisConvention.threeJsBridgeBasis.zAxis.x,
    axisConvention.threeJsBridgeBasis.zAxis.y,
    axisConvention.threeJsBridgeBasis.zAxis.z
  )
);
scientificSpaceGroup.quaternion.setFromRotationMatrix(scientificBridgeBasis);
scene.add(scientificSpaceGroup);

const crystalGroup = new THREE.Group();
crystalGroup.name = "crystal-root";
scientificSpaceGroup.add(crystalGroup);

const crystalOrientationGroup = new THREE.Group();
crystalOrientationGroup.name = "crystal-orientation-group";
crystalGroup.add(crystalOrientationGroup);

scientificSpaceGroup.updateMatrixWorld(true);
const scientificToWorldQuaternion = scientificSpaceGroup.getWorldQuaternion(
  new THREE.Quaternion()
);

const bondAxis = new THREE.Vector3(0, 1, 0);
const scientificXAxis = new THREE.Vector3(
  axisConvention.axes.x.vector.x,
  axisConvention.axes.x.vector.y,
  axisConvention.axes.x.vector.z
);
const scientificYAxis = new THREE.Vector3(
  axisConvention.axes.y.vector.x,
  axisConvention.axes.y.vector.y,
  axisConvention.axes.y.vector.z
);
const scientificZAxis = new THREE.Vector3(
  axisConvention.axes.z.vector.x,
  axisConvention.axes.z.vector.y,
  axisConvention.axes.z.vector.z
);
const AXIS_VISUAL_COLORS = Object.freeze({
  x: { color: 0xc85d4f, colorText: "#c85d4f" },
  y: { color: 0x4b8f78, colorText: "#4b8f78" },
  z: { color: 0x3d6fa7, colorText: "#3d6fa7" }
});
const DEFAULT_VIEW_DISTANCE_MULTIPLIER = 0.74;
const EDGE_VIEW_ID = "side-edge";
const CUBIC_EDGE_VIEW_VERTICAL_BIAS = 0.42;
const HCP_EDGE_VIEW_VERTICAL_BIAS = 0.34;

let currentCrystalId = getDefaultCrystalId();
let currentCrystal = getCrystalById(currentCrystalId);
let selectedViewId = "default";
let viewLockEnabled = false;
let autoRotateEnabled = true;
let showCellAxesEnabled = false;
let showAuxiliaryAtomsEnabled = true;
let showCoordinationEnabled = false;
let showCountEnabled = false;
let selectedCountGroupId = "all";
let hoveredCountGroupId = null;
let currentModelRefs = createEmptyModelRefs();
let cameraTransition = null;
const atomContributionRenderer = new AtomContributionRenderer({
  attachTarget: crystalOrientationGroup
});
const atomCoordinationRenderer = new AtomCoordinationRenderer({
  attachTarget: crystalOrientationGroup
});
const atomCoordinateOverlay = new AtomCoordinateOverlay({
  attachTarget: crystalOrientationGroup,
  labelContainer: viewerContainer,
  camera
});
const effectiveAtomRenderer = new EffectiveAtomRenderer({
  attachTarget: crystalOrientationGroup
});
const effectiveCountingRaycaster = new THREE.Raycaster();
const effectiveCountingPointer = new THREE.Vector2();
const atomContributionInteraction = new AtomContributionInteraction({
  domElement: renderer.domElement,
  camera,
  getInteractiveObjects: getAtomContributionInteractiveObjects,
  onHoverAtom: handleAtomContributionHover,
  onSelectAtom: handleAtomContributionSelect,
  onClearSelection: clearAtomContributionInteraction
});
const atomCoordinationInteraction = new AtomContributionInteraction({
  domElement: renderer.domElement,
  camera,
  getInteractiveObjects: getCoordinationInteractiveObjects,
  onHoverAtom: handleCoordinationHover,
  onSelectAtom: handleCoordinationSelect,
  onClearSelection: clearAtomCoordinationInteraction
});
const atomCoordinateInteraction = new AtomContributionInteraction({
  domElement: renderer.domElement,
  camera,
  getInteractiveObjects: getCoordinateInteractiveObjects,
  onHoverAtom: null,
  onSelectAtom: handleCoordinateSelect,
  onClearSelection: clearAtomCoordinateSelection
});

function createEmptyModelRefs() {
  return {
    frameGroup: null,
    bondGroup: null,
    atomGroup: null,
    auxiliaryGroup: null,
    coordinationGroup: null,
    internalAxisGroup: null,
    particleMeshesByIndex: [],
    connectionMeshesByIndex: []
  };
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  if (!material) {
    return;
  }

  material.map?.dispose?.();
  material.alphaMap?.dispose?.();
  material.dispose?.();
}

function clearGroup(group) {
  group.traverse((child) => {
    if (child === group) {
      return;
    }

    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  });

  group.clear();
}

function resizeRenderer() {
  const width = viewerContainer.clientWidth;
  const height = viewerContainer.clientHeight;

  if (!width || !height) {
    return;
  }

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function configVectorToVector3(
  vectorConfig,
  fallback = { x: 0, y: 0, z: 0 }
) {
  return new THREE.Vector3(
    vectorConfig?.x ?? fallback.x,
    vectorConfig?.y ?? fallback.y,
    vectorConfig?.z ?? fallback.z
  );
}

function normalizeDirection(vector, fallback) {
  if (vector.lengthSq() <= 1e-6) {
    return fallback.clone();
  }

  return vector.normalize();
}

function createAxisLabelSprite(label, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.Sprite();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.strokeStyle = "rgba(45, 74, 98, 0.22)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(64, 64, 40, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font =
    '700 56px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 64, 67);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  );
  sprite.scale.set(0.38, 0.38, 0.38);

  return sprite;
}

function createAtomContributionMetadataByParticleIndex(crystal) {
  const metadataByParticleIndex = new Map();

  (crystal?.effectiveAtomCounting?.groups ?? []).forEach((group) => {
    (group.atomRefs ?? []).forEach((atomRef, groupAtomIndex) => {
      if (!Number.isInteger(atomRef) || metadataByParticleIndex.has(atomRef)) {
        return;
      }

      metadataByParticleIndex.set(atomRef, {
        type: "atom",
        atomId:
          group.atomIds?.[groupAtomIndex] ??
          `${group.id}-atom-${atomRef}-${groupAtomIndex}`,
        species: group.species,
        positionType: group.positionType,
        groupId: group.id,
        contribution: group.contribution,
        contributionText: group.contributionText ?? group.contributionLabel,
        sharedBy: group.sharedBy,
        count: group.count,
        totalContribution: group.totalContribution ?? group.total,
        formulaText: group.formulaText ?? group.equation,
        selectable: true
      });
    });
  });

  return metadataByParticleIndex;
}

function getAxisVisualDefinitions() {
  return [
    {
      key: "x",
      label: axisConvention.axes.x.label,
      direction: scientificXAxis.clone(),
      color: AXIS_VISUAL_COLORS.x.color,
      colorText: AXIS_VISUAL_COLORS.x.colorText
    },
    {
      key: "y",
      label: axisConvention.axes.y.label,
      direction: scientificYAxis.clone(),
      color: AXIS_VISUAL_COLORS.y.color,
      colorText: AXIS_VISUAL_COLORS.y.colorText
    },
    {
      key: "z",
      label: axisConvention.axes.z.label,
      direction: scientificZAxis.clone(),
      color: AXIS_VISUAL_COLORS.z.color,
      colorText: AXIS_VISUAL_COLORS.z.colorText
    }
  ];
}

function getFloatingPanelLayoutRect(panelElement) {
  if (!panelElement || panelElement.hidden) {
    return null;
  }

  const liveRect = panelElement.getBoundingClientRect();

  if (liveRect.width > 0 && liveRect.height > 0) {
    return liveRect;
  }

  const left = Number.parseFloat(panelElement.dataset.detachedLeft ?? "");
  const top = Number.parseFloat(panelElement.dataset.detachedTop ?? "");
  const width = Number.parseFloat(panelElement.dataset.detachedWidth ?? "");
  const height = Number.parseFloat(panelElement.dataset.detachedHeight ?? "");

  if (
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
  }

  return null;
}


function getResolvedViewDefinition(crystal, requestedViewId = selectedViewId) {
  if (requestedViewId === "default") {
    const crystalDefaultView = crystal.defaultView ?? {};
    const inheritedView = getStandardViewDirectionById(
      crystalDefaultView.viewId,
      "isometric"
    );

    return {
      id: "default",
      label: standardViewDirections.default.label,
      direction: crystalDefaultView.direction ?? inheritedView.direction,
      up: crystalDefaultView.up ?? inheritedView.up,
      targetOffset:
        crystalDefaultView.targetOffset ?? inheritedView.targetOffset ?? null,
      distanceScale:
        crystalDefaultView.distanceScale ?? inheritedView.distanceScale ?? 2.12,
      description:
        crystal.defaultViewSummary ||
        crystalDefaultView.description ||
        inheritedView.description,
      rationale:
        crystal.defaultViewRationale || crystalDefaultView.rationale || "",
      referenceViewId: crystalDefaultView.viewId ?? inheritedView.id
    };
  }

  const explicitView = getStandardViewDirectionById(requestedViewId, "front");

  if (explicitView.id === EDGE_VIEW_ID) {
    return {
      ...explicitView,
      ...getEdgeViewConfig(crystal),
      id: explicitView.id,
      label: explicitView.label,
      referenceViewId: explicitView.id
    };
  }

  return {
    id: explicitView.id,
    label: explicitView.label,
    direction: explicitView.direction,
    up: explicitView.up,
    targetOffset: explicitView.targetOffset ?? null,
    distanceScale: explicitView.distanceScale ?? 2.12,
    description: explicitView.description,
    rationale: "",
    referenceViewId: explicitView.id
  };
}

function getStandardViewDirectionById(viewId, fallbackKey = "front") {
  if (viewId && standardViewDirections[viewId]) {
    return standardViewDirections[viewId];
  }

  const matchedView = Object.values(standardViewDirections).find(
    (view) => view.id === viewId
  );

  return matchedView ?? standardViewDirections[fallbackKey];
}

function getEdgeViewConfig(crystal) {
  const isHexagonal = crystal?.cellFrame?.shape === "hexagonal-prism";
  const verticalBias = isHexagonal
    ? HCP_EDGE_VIEW_VERTICAL_BIAS
    : CUBIC_EDGE_VIEW_VERTICAL_BIAS;

  return {
    direction: isHexagonal
      ? { x: 1, y: 0, z: verticalBias }
      : { x: 1, y: 1, z: verticalBias },
    up: { x: 0, y: 0, z: 1 },
    targetOffset: null,
    description: isHexagonal
      ? "沿 HCP 六方柱侧棱附近的规范教学方向观察，c 轴保持接近屏幕竖直。"
      : "沿立方晶胞竖直侧棱附近的规范教学方向观察，使 Z 轴竖直、X/Y 分列左下和右下，并保留轻微层叠感。",
    rationale:
      "以晶胞基矢构造稳定观察基：XY 对角方向提供侧棱重合感，少量 Z 偏转提供教学图中的层叠深度。"
  };
}

function getViewFocusTargetLocalPoint(viewDefinition, crystal = currentCrystal) {
  if (!viewDefinition?.targetOffset) {
    return null;
  }

  const targetOffset = configVectorToVector3(viewDefinition.targetOffset);
  const clampOffset = (value) => THREE.MathUtils.clamp(value ?? 0, -1, 1);
  const cellFrame = crystal?.cellFrame;

  if (cellFrame?.shape === "box") {
    const halfSize = configVectorToVector3(cellFrame.size, { x: 2, y: 2, z: 2 })
      .multiplyScalar(0.5);

    return new THREE.Vector3(
      halfSize.x * clampOffset(targetOffset.x),
      halfSize.y * clampOffset(targetOffset.y),
      halfSize.z * clampOffset(targetOffset.z)
    );
  }

  if (
    cellFrame?.shape === "hexagonal-prism" &&
    Array.isArray(cellFrame.baseVertices) &&
    cellFrame.baseVertices.length
  ) {
    const planarDirection = new THREE.Vector2(targetOffset.x, targetOffset.y);
    let focusX = 0;
    let focusY = 0;

    if (planarDirection.lengthSq() > 1e-6) {
      planarDirection.normalize();

      let bestScore = -Infinity;

      cellFrame.baseVertices.forEach((vertex) => {
        const candidate = new THREE.Vector2(vertex.x ?? 0, vertex.y ?? 0);
        const score = candidate.dot(planarDirection);

        if (score > bestScore) {
          bestScore = score;
          focusX = candidate.x;
          focusY = candidate.y;
        }
      });
    }

    const zMin =
      cellFrame.zMin ??
      (Number.isFinite(cellFrame.height) ? -cellFrame.height * 0.5 : -1);
    const zMax =
      cellFrame.zMax ??
      (Number.isFinite(cellFrame.height) ? cellFrame.height * 0.5 : 1);
    const zCenter = (zMin + zMax) * 0.5;
    const halfHeight = (zMax - zMin) * 0.5;

    return new THREE.Vector3(
      focusX,
      focusY,
      zCenter + halfHeight * clampOffset(targetOffset.z)
    );
  }

  return null;
}

function getCellCenterLocalPoint(crystal = currentCrystal) {
  const bounds = getCellFrameLocalBounds(crystal?.cellFrame ?? {});

  return bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
}

function getBoxCornerPoints(box) {
  const points = [];

  [box.min.x, box.max.x].forEach((x) => {
    [box.min.y, box.max.y].forEach((y) => {
      [box.min.z, box.max.z].forEach((z) => {
        points.push(new THREE.Vector3(x, y, z));
      });
    });
  });

  return points;
}

function fitCameraToCellFromDirection({
  target,
  focusTarget,
  directionWorld,
  upWorld,
  halfFov,
  aspect,
  padding = 1.12
}) {
  const bounds = getFrameBounds(target);
  const points = getBoxCornerPoints(bounds);
  const viewRight = new THREE.Vector3()
    .crossVectors(upWorld, directionWorld)
    .normalize();
  const viewUp = new THREE.Vector3()
    .crossVectors(directionWorld, viewRight)
    .normalize();
  let requiredDistance = 0;

  points.forEach((point) => {
    const offset = point.clone().sub(focusTarget);
    const depthOffset = offset.dot(directionWorld);
    const horizontalReach = Math.abs(offset.dot(viewRight));
    const verticalReach = Math.abs(offset.dot(viewUp));

    requiredDistance = Math.max(
      requiredDistance,
      depthOffset + horizontalReach / (Math.tan(halfFov) * aspect),
      depthOffset + verticalReach / Math.tan(halfFov)
    );
  });

  return Math.max(1, requiredDistance * padding);
}

function getViewDistanceMultiplier(viewDefinition) {
  return viewDefinition ? DEFAULT_VIEW_DISTANCE_MULTIPLIER : 1;
}

function createCameraPoseForView(target, viewDefinition) {
  const bounds = getFrameBounds(target);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.85);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const directionScientific = normalizeDirection(
    configVectorToVector3(viewDefinition.direction),
    scientificXAxis.clone().addScaledVector(scientificZAxis, 0.8)
  );
  let upScientific = normalizeDirection(
    configVectorToVector3(viewDefinition.up, axisConvention.axes.z.vector),
    scientificZAxis
  );

  if (Math.abs(directionScientific.dot(upScientific)) >= 0.98) {
    upScientific = scientificYAxis.clone();
  }

  const directionWorld = directionScientific
    .clone()
    .applyQuaternion(scientificToWorldQuaternion)
    .normalize();
  const upWorld = upScientific
    .clone()
    .applyQuaternion(scientificToWorldQuaternion)
    .normalize();
  const projectionZoom = viewDefinition.projectionZoom ?? 1;
  const focusTargetLocal =
    viewDefinition.fitTarget === "cell-center"
      ? getCellCenterLocalPoint(currentCrystal)
      : getViewFocusTargetLocalPoint(viewDefinition);

  target.updateMatrixWorld(true);

  const focusTarget = focusTargetLocal
    ? target.localToWorld(focusTargetLocal.clone())
    : sphere.center.clone();
  const baseDistance =
    viewDefinition.fitMode === "directional-bounds"
      ? fitCameraToCellFromDirection({
          target,
          focusTarget,
          directionWorld,
          upWorld,
          halfFov,
          aspect: camera.aspect,
          padding: viewDefinition.fitPadding ?? 1.12
        })
      : (radius / Math.tan(halfFov)) *
        (viewDefinition.distanceScale ?? 2.12);
  const distance =
    baseDistance * projectionZoom * getViewDistanceMultiplier(viewDefinition);

  return {
    position: focusTarget.clone().addScaledVector(directionWorld, distance),
    target: focusTarget,
    up: upWorld,
    zoom: projectionZoom,
    near: Math.max(0.1, distance / 28),
    far: Math.max(50, distance * 8),
    sphere
  };
}

function stopCameraTransition() {
  cameraTransition = null;
}

function applyCameraPose(pose) {
  stopCameraTransition();
  camera.position.copy(pose.position);
  camera.up.copy(pose.up);
  controls.target.copy(pose.target);
  camera.zoom = pose.zoom ?? 1;
  camera.near = pose.near;
  camera.far = pose.far;
  camera.updateProjectionMatrix();
  controls.update();
}

function startCameraTransition(pose, duration = 480) {
  cameraTransition = {
    startedAt: performance.now(),
    duration,
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    fromUp: camera.up.clone(),
    fromZoom: camera.zoom,
    fromNear: camera.near,
    fromFar: camera.far,
    toPosition: pose.position.clone(),
    toTarget: pose.target.clone(),
    toUp: pose.up.clone(),
    toZoom: pose.zoom ?? 1,
    toNear: pose.near,
    toFar: pose.far
  };
}

function updateCameraTransition(now) {
  if (!cameraTransition) {
    return;
  }

  const rawProgress = (now - cameraTransition.startedAt) / cameraTransition.duration;
  const progress = THREE.MathUtils.clamp(rawProgress, 0, 1);
  const easedProgress = 1 - (1 - progress) ** 3;

  camera.position.lerpVectors(
    cameraTransition.fromPosition,
    cameraTransition.toPosition,
    easedProgress
  );
  controls.target.lerpVectors(
    cameraTransition.fromTarget,
    cameraTransition.toTarget,
    easedProgress
  );
  camera.up
    .copy(cameraTransition.fromUp)
    .lerp(cameraTransition.toUp, easedProgress)
    .normalize();
  camera.zoom = THREE.MathUtils.lerp(
    cameraTransition.fromZoom,
    cameraTransition.toZoom,
    easedProgress
  );
  camera.near = THREE.MathUtils.lerp(
    cameraTransition.fromNear,
    cameraTransition.toNear,
    easedProgress
  );
  camera.far = THREE.MathUtils.lerp(
    cameraTransition.fromFar,
    cameraTransition.toFar,
    easedProgress
  );
  camera.updateProjectionMatrix();

  if (progress >= 1) {
    cameraTransition = null;
  }
}

function markFrameInclusion(object, includeInFrame = true) {
  object.userData = {
    ...object.userData,
    includeInFrame
  };
}

function applyMaterialOpacity(material, opacity) {
  material.opacity = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = opacity >= 0.999;
}

function createBoxFrame(cellFrame) {
  const frameGroup = new THREE.Group();
  const geometry = new THREE.BoxGeometry(
    cellFrame.size.x,
    cellFrame.size.y,
    cellFrame.size.z
  );
  const surfaceMaterial = new THREE.MeshPhongMaterial({
    color: cellFrame.fillColor,
    transparent: true,
    opacity: cellFrame.fillOpacity,
    shininess: 35,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: cellFrame.edgeColor,
    transparent: cellFrame.edgeOpacity < 1,
    opacity: cellFrame.edgeOpacity
  });

  const boxSurface = new THREE.Mesh(geometry, surfaceMaterial);
  const boxEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    edgeMaterial
  );

  markFrameInclusion(frameGroup, true);
  markFrameInclusion(boxSurface, true);
  markFrameInclusion(boxEdges, true);

  frameGroup.add(boxSurface);
  frameGroup.add(boxEdges);

  return frameGroup;
}

function createHexagonalPrismFrame(cellFrame) {
  const frameGroup = new THREE.Group();
  let geometry;

  if (Array.isArray(cellFrame.baseVertices) && cellFrame.baseVertices.length >= 3) {
    const baseVertices = cellFrame.baseVertices.map((vertex) => ({
      x: vertex.x,
      y: vertex.y
    }));
    const zMin =
      cellFrame.zMin ?? -(cellFrame.height ?? 2) * 0.5;
    const zMax =
      cellFrame.zMax ?? (cellFrame.height ?? 2) * 0.5;
    const shape = new THREE.Shape();

    baseVertices.forEach((vertex, index) => {
      if (index === 0) {
        shape.moveTo(vertex.x, vertex.y);
        return;
      }

      shape.lineTo(vertex.x, vertex.y);
    });
    shape.closePath();

    geometry = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: zMax - zMin,
      bevelEnabled: false,
      curveSegments: 1
    });
    geometry.translate(0, 0, zMin);
  } else {
    const radius = cellFrame.radius ?? 1;
    const height = cellFrame.height ?? 2;

    geometry = new THREE.CylinderGeometry(radius, radius, height, 6, 1, false);
    geometry.rotateX(Math.PI / 2);
  }

  const surfaceMaterial = new THREE.MeshPhongMaterial({
    color: cellFrame.fillColor,
    transparent: true,
    opacity: cellFrame.fillOpacity,
    shininess: 35,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: cellFrame.edgeColor,
    transparent: cellFrame.edgeOpacity < 1,
    opacity: cellFrame.edgeOpacity
  });
  const prismSurface = new THREE.Mesh(geometry, surfaceMaterial);
  const prismEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    edgeMaterial
  );

  markFrameInclusion(frameGroup, true);
  markFrameInclusion(prismSurface, true);
  markFrameInclusion(prismEdges, true);

  frameGroup.add(prismSurface);
  frameGroup.add(prismEdges);

  return frameGroup;
}

function createCellFrame(cellFrame) {
  if (cellFrame?.shape === "hexagonal-prism") {
    return createHexagonalPrismFrame(cellFrame);
  }

  return createBoxFrame(cellFrame);
}

function toLocalVector3(position) {
  if (!position) {
    return null;
  }

  if (position.isVector3) {
    return position.clone();
  }

  return new THREE.Vector3(position.x, position.y, position.z);
}

function resolveConnectionEndpoints(connection, particles) {
  const startParticle = particles[connection.from];
  const endParticle = particles[connection.to];
  const start = toLocalVector3(connection.start ?? startParticle?.position);
  const end = toLocalVector3(connection.end ?? endParticle?.position);

  if (!start || !end) {
    return null;
  }

  return {
    start,
    end,
    startParticle,
    endParticle
  };
}

function createModelLayerGroup(name, includeInFrame = true) {
  const group = new THREE.Group();

  group.name = name;
  markFrameInclusion(group, includeInFrame);

  return group;
}

function getCellFrameLocalBounds(cellFrame = {}) {
  if (
    cellFrame.shape === "hexagonal-prism" &&
    Array.isArray(cellFrame.baseVertices) &&
    cellFrame.baseVertices.length >= 3
  ) {
    const xValues = cellFrame.baseVertices.map((vertex) => vertex.x ?? 0);
    const yValues = cellFrame.baseVertices.map((vertex) => vertex.y ?? 0);
    const zMin =
      cellFrame.zMin ??
      (Number.isFinite(cellFrame.height) ? -cellFrame.height * 0.5 : -1);
    const zMax =
      cellFrame.zMax ??
      (Number.isFinite(cellFrame.height) ? cellFrame.height * 0.5 : 1);

    return {
      min: new THREE.Vector3(
        Math.min(...xValues),
        Math.min(...yValues),
        zMin
      ),
      max: new THREE.Vector3(
        Math.max(...xValues),
        Math.max(...yValues),
        zMax
      )
    };
  }

  const size = configVectorToVector3(cellFrame.size, { x: 2, y: 2, z: 2 });
  const halfSize = size.multiplyScalar(0.5);

  return {
    min: halfSize.clone().multiplyScalar(-1),
    max: halfSize.clone()
  };
}

function getCrystalInternalAxisLengths(crystal, bounds, origin) {
  const mainParticleRadii = (crystal?.particles ?? [])
    .filter(
      (particle) =>
        particle?.visible !== false &&
        !particle?.metadata?.isAuxiliary &&
        !particle?.metadata?.isDiamondHelper &&
        Number.isFinite(particle?.radius)
    )
    .map((particle) => particle.radius);
  const maxParticleRadius = mainParticleRadii.length
    ? Math.max(...mainParticleRadii)
    : 0.18;
  const span = bounds.max.clone().sub(bounds.min);
  const positiveReach = bounds.max.clone().sub(origin);
  const overflowMargin = Math.max(
    maxParticleRadius * 1.35,
    Math.min(span.x, span.y, span.z) * 0.14,
    0.24
  );
  const minimumRequiredLength = maxParticleRadius * 2.24;

  return {
    x: Math.max(minimumRequiredLength, positiveReach.x + overflowMargin),
    y: Math.max(minimumRequiredLength, positiveReach.y + overflowMargin),
    z: Math.max(minimumRequiredLength, positiveReach.z + overflowMargin),
    overflowMargin,
    maxParticleRadius
  };
}

function getCrystalInternalAxisOrigin(crystal, bounds) {
  const cellFrame = crystal?.cellFrame ?? {};

  if (cellFrame.shape === "hexagonal-prism") {
    // The hexagonal prism has no atom at the shared back-left-bottom box corner,
    // so we use that external corner to keep the positive-axis convention
    // consistent with the cubic cells.
    return bounds.min.clone();
  }

  return bounds.min.clone();
}

function buildCrystalAxisGroup(crystal) {
  const axisGroup = createModelLayerGroup("crystal-internal-axes", false);
  const bounds = getCellFrameLocalBounds(crystal.cellFrame ?? {});
  const origin = getCrystalInternalAxisOrigin(crystal, bounds);
  const axisLengths = getCrystalInternalAxisLengths(crystal, bounds, origin);
  const maxAxisLength = Math.max(axisLengths.x, axisLengths.y, axisLengths.z);
  const labelScale = THREE.MathUtils.clamp(maxAxisLength * 0.18, 0.2, 0.28);

  getAxisVisualDefinitions().forEach((axis) => {
    const direction = axis.direction.clone().normalize();
    const axisLength = axisLengths[axis.key];
    const headLength = Math.max(0.12, axisLength * 0.11);
    const headWidth = Math.max(0.08, axisLength * 0.08);
    const labelDistance =
      axisLength + Math.max(0.12, axisLengths.overflowMargin * 0.52);
    const arrow = new THREE.ArrowHelper(
      direction,
      origin,
      axisLength,
      axis.color,
      headLength,
      headWidth
    );

    arrow.line.material.transparent = true;
    arrow.line.material.opacity = 0.96;
    arrow.line.material.depthTest = false;
    arrow.line.material.depthWrite = false;
    arrow.line.renderOrder = 9;
    arrow.cone.material.transparent = true;
    arrow.cone.material.opacity = 0.98;
    arrow.cone.material.depthTest = false;
    arrow.cone.material.depthWrite = false;
    arrow.cone.renderOrder = 10;
    markFrameInclusion(arrow.line, false);
    markFrameInclusion(arrow.cone, false);
    axisGroup.add(arrow);

    const labelSprite = createAxisLabelSprite(axis.label, axis.colorText);
    labelSprite.scale.set(labelScale, labelScale, labelScale);
    labelSprite.position.copy(
      origin.clone().add(direction.multiplyScalar(labelDistance))
    );
    labelSprite.renderOrder = 11;
    markFrameInclusion(labelSprite, false);
    axisGroup.add(labelSprite);
  });

  const originSphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      Math.max(0.05, axisLengths.maxParticleRadius * 0.34),
      18,
      18
    ),
    new THREE.MeshBasicMaterial({
      color: 0x40505f,
      transparent: true,
      opacity: 0.94,
      depthTest: false,
      depthWrite: false
    })
  );
  originSphere.position.copy(origin);
  originSphere.renderOrder = 11;
  markFrameInclusion(originSphere, false);
  axisGroup.add(originSphere);

  axisGroup.visible = showCellAxesEnabled;

  return axisGroup;
}

function coordinateArrayToObject(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return {
      x: value[0] ?? 0,
      y: value[1] ?? 0,
      z: value[2] ?? 0
    };
  }

  return {
    x: value.x ?? 0,
    y: value.y ?? 0,
    z: value.z ?? 0
  };
}

function isOutsideUnitCell(fractionalCoord) {
  if (!fractionalCoord) {
    return false;
  }

  return [fractionalCoord.x, fractionalCoord.y, fractionalCoord.z].some(
    (value) => value < -1e-6 || value > 1 + 1e-6
  );
}

function inferParticleElement(particle, atomSpecies) {
  if (atomSpecies) {
    return atomSpecies;
  }

  const rawLabel = `${particle.metadata?.element ?? ""} ${
    particle.metadata?.species ?? ""
  } ${particle.label ?? ""} ${particle.category ?? ""}`;
  const knownSymbol = rawLabel.match(/\b(Na|Cl|Cs|C|Cu|Fe|Mg)\b/u);

  if (knownSymbol) {
    return knownSymbol[1];
  }

  const leadingSymbol = rawLabel.trim().match(/^([A-Z][a-z]?)/u);

  return leadingSymbol?.[1] ?? "";
}

function createParticleMesh(particle, particleIndex, atomContributionMetadata = null) {
  if (particle.visible === false) {
    return null;
  }

  const metadata = particle.metadata ?? {};
  const atomSpecies =
    atomContributionMetadata?.species ??
    metadata.species ??
    metadata.element ??
    "";
  const fractionalCoord = coordinateArrayToObject(metadata.fractionalPosition);
  const cartesianCoord = coordinateArrayToObject(
    metadata.cartesianPosition ?? particle.position
  );
  const isCoordinationHelper = Boolean(metadata.coordinationHelper);
  const isHelper = Boolean(
    metadata.isAuxiliary || metadata.isDiamondHelper || isCoordinationHelper
  );
  const isGhost = Boolean(metadata.isGhost || metadata.isGhostAtom);
  const element = inferParticleElement(particle, atomSpecies);
  const geometry = new THREE.SphereGeometry(particle.radius, 30, 30);
  const opacity = particle.opacity ?? 1;
  const material = new THREE.MeshPhongMaterial({
    color: particle.color,
    transparent: opacity < 0.999,
    opacity,
    depthWrite: opacity >= 0.999,
    shininess: 100
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(
    particle.position.x,
    particle.position.y,
    particle.position.z
  );
  mesh.name = particle.label || particle.category;
  mesh.renderOrder = 2;
  mesh.userData = {
    type: "atom",
    particleIndex,
    atomId:
      atomContributionMetadata?.atomId ??
      `${particle.category ?? "particle"}-${particleIndex}`,
    species: atomSpecies,
    element,
    atomType: atomSpecies || particle.label || particle.category || "atom",
    positionType: atomContributionMetadata?.positionType ?? "",
    groupId: atomContributionMetadata?.groupId ?? "",
    contribution: atomContributionMetadata?.contribution ?? null,
    contributionText: atomContributionMetadata?.contributionText ?? "",
    sharedBy: atomContributionMetadata?.sharedBy ?? null,
    totalContribution: atomContributionMetadata?.totalContribution ?? null,
    formulaText: atomContributionMetadata?.formulaText ?? "",
    selectable: Boolean(atomContributionMetadata?.selectable),
    isSelectableAtom: true,
    coordinateSelectable: metadata.coordinateSelectable !== false && !isGhost,
    fractionalCoord,
    cartesianCoord,
    cellCoord: fractionalCoord ?? cartesianCoord,
    displayCoord:
      metadata.displayCoord ??
      metadata.displayCoordinate ??
      metadata.coordinateLabel ??
      "",
    displayCartesianCoord:
      metadata.displayCartesianCoord ?? metadata.displayCartesianCoordinate ?? "",
    displayFractionalCoord:
      metadata.displayFractionalCoord ?? metadata.displayFractionalCoordinate ?? "",
    symbolicCoord: metadata.symbolicCoord ?? metadata.symbolicCoordinate ?? "",
    atomRole:
      metadata.atomRole ??
      atomContributionMetadata?.positionType ??
      particle.category ??
      "",
    isHelper,
    isGhost,
    isGhostAtom: isGhost,
    isCoordinationHelper,
    isExtendedAtom: isOutsideUnitCell(fractionalCoord),
    label: particle.label,
    category: particle.category,
    baseColor: particle.color,
    baseRenderOrder: 2,
    defaultOpacity: opacity,
    includeInFrame: particle.includeInFrame !== false,
    isAuxiliaryParticle: Boolean(
      particle.metadata?.isAuxiliary || particle.metadata?.isDiamondHelper
    ),
    localPosition: {
      ...particle.position
    }
  };

  return mesh;
}

function createBondBetweenPoints(startPoint, endPoint, options = {}) {
  const start = toLocalVector3(startPoint);
  const end = toLocalVector3(endPoint);

  if (!start || !end) {
    return null;
  }

  const rawDirection = end.clone().sub(start);
  const fullLength = rawDirection.length();

  if (fullLength <= 1e-6) {
    return null;
  }

  const direction = rawDirection.clone().divideScalar(fullLength);
  const endpointInset = Math.min(options.endpointInset ?? 0, fullLength * 0.49);
  const trimmedStart = start.clone().addScaledVector(direction, endpointInset);
  const trimmedEnd = end.clone().addScaledVector(direction, -endpointInset);
  const length = trimmedStart.distanceTo(trimmedEnd);
  const radius = options.radius ?? 0.03;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 16, 1, false);
  const opacity = options.opacity ?? 1;
  const material = new THREE.MeshPhongMaterial({
    color: options.color ?? 0x7b8894,
    transparent: opacity < 0.999,
    opacity,
    depthWrite: opacity >= 0.999,
    shininess: 80
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(trimmedStart.clone().add(trimmedEnd).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(bondAxis, direction);
  mesh.renderOrder = options.renderOrder ?? 1;
  mesh.userData = {
    baseColor: options.color ?? 0x7b8894,
    baseRenderOrder: mesh.renderOrder,
    defaultOpacity: opacity,
    includeInFrame: options.includeInFrame !== false,
    isAuxiliaryConnection: Boolean(
      options.metadata?.isAuxiliaryConnection ||
        options.metadata?.isDiamondAuxiliaryBond
    ),
    localStart: { x: start.x, y: start.y, z: start.z },
    localEnd: { x: end.x, y: end.y, z: end.z }
  };
  markFrameInclusion(mesh, options.includeInFrame !== false);

  return mesh;
}

function createConnectionMesh(connection, particles) {
  const endpoints = resolveConnectionEndpoints(connection, particles);

  if (!endpoints) {
    return null;
  }

  const defaultInset =
    Math.min(
      endpoints.startParticle?.radius ?? 0,
      endpoints.endParticle?.radius ?? 0
    ) * 0.45;

  return createBondBetweenPoints(endpoints.start, endpoints.end, {
    color: connection.color,
    radius: connection.radius,
    opacity: connection.opacity,
    endpointInset: connection.endpointInset ?? defaultInset,
    includeInFrame: connection.includeInFrame,
    metadata: connection.metadata
  });
}

function createCoordinationHalo(position, particle, color, scale, opacity) {
  const geometry = new THREE.SphereGeometry(particle.radius * scale, 24, 24);
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    shininess: 120,
    emissive: new THREE.Color(color).multiplyScalar(0.2)
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(position);
  mesh.renderOrder = 5;
  markFrameInclusion(mesh, false);

  return mesh;
}

function createCoordinationPolyhedron(faces, particles, color) {
  const validFaces = (faces ?? [])
    .map((face) => face.filter((index) => particles[index]))
    .filter((face) => face.length >= 3);

  if (!validFaces.length) {
    return null;
  }

  const trianglePositions = [];
  const edgeKeys = new Set();
  const edgePositions = [];

  validFaces.forEach((face) => {
    const facePoints = face.map((index) => toLocalVector3(particles[index].position));

    for (let index = 1; index < facePoints.length - 1; index += 1) {
      const a = facePoints[0];
      const b = facePoints[index];
      const c = facePoints[index + 1];

      trianglePositions.push(
        a.x,
        a.y,
        a.z,
        b.x,
        b.y,
        b.z,
        c.x,
        c.y,
        c.z
      );
    }

    for (let index = 0; index < face.length; index += 1) {
      const from = face[index];
      const to = face[(index + 1) % face.length];
      const edgeKey = [from, to].sort((a, b) => a - b).join(":");

      if (edgeKeys.has(edgeKey)) {
        continue;
      }

      edgeKeys.add(edgeKey);

      const start = toLocalVector3(particles[from].position);
      const end = toLocalVector3(particles[to].position);

      edgePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
  });

  const polyhedronGroup = createModelLayerGroup(
    "coordination-polyhedron",
    false
  );
  const surfaceGeometry = new THREE.BufferGeometry();
  surfaceGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(trianglePositions, 3)
  );
  surfaceGeometry.computeVertexNormals();

  const surfaceMaterial = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
    shininess: 55
  });
  const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  surfaceMesh.renderOrder = 3;
  markFrameInclusion(surfaceMesh, false);
  polyhedronGroup.add(surfaceMesh);

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(edgePositions, 3)
  );
  const edgeMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75
  });
  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edgeLines.renderOrder = 4;
  markFrameInclusion(edgeLines, false);
  polyhedronGroup.add(edgeLines);

  return polyhedronGroup;
}

function buildCoordinationOverlay(crystal) {
  const coordinationGroup = createModelLayerGroup("crystal-coordination", false);
  const coordinationDisplay = crystal.coordinationDisplay;

  if (!coordinationDisplay) {
    coordinationGroup.visible = false;
    return coordinationGroup;
  }

  const style = coordinationDisplay.style ?? {};
  const particles = crystal.particles ?? [];
  const highlightedParticles = new Set();
  const centerParticleIndices = new Set();
  const neighborParticleIndices = new Set();
  const connectionRadius =
    coordinationDisplay.coordinationNumber >= 10 ? 0.02 : 0.024;

  coordinationDisplay.coordinationCenters.forEach((centerConfig) => {
    const centerParticle = particles[centerConfig.particleIndex];

    if (!centerParticle) {
      return;
    }

    const centerPosition = toLocalVector3(centerParticle.position);
    const centerHalo = createCoordinationHalo(
      centerPosition,
      centerParticle,
      style.centerColor,
      centerConfig.centerScale,
      0.62
    );
    coordinationGroup.add(centerHalo);
    highlightedParticles.add(centerConfig.particleIndex);
    centerParticleIndices.add(centerConfig.particleIndex);

    centerConfig.neighborParticleIndices.forEach((neighborIndex) => {
      if (highlightedParticles.has(neighborIndex)) {
        return;
      }

      const neighborParticle = particles[neighborIndex];

      if (!neighborParticle) {
        return;
      }

      const neighborPosition = toLocalVector3(neighborParticle.position);
      const neighborHalo = createCoordinationHalo(
        neighborPosition,
        neighborParticle,
        style.neighborColor,
        centerConfig.neighborScale,
        0.48
      );
      coordinationGroup.add(neighborHalo);
      highlightedParticles.add(neighborIndex);
      neighborParticleIndices.add(neighborIndex);
    });

    const connectionPairs =
      centerConfig.connectionPairs.length > 0
        ? centerConfig.connectionPairs
        : centerConfig.neighborParticleIndices.map((neighborIndex) => [
            centerConfig.particleIndex,
            neighborIndex
          ]);

    connectionPairs.forEach(([fromIndex, toIndex]) => {
      const fromParticle = particles[fromIndex];
      const toParticle = particles[toIndex];

      if (!fromParticle || !toParticle) {
        return;
      }

      const endpointInset =
        Math.min(fromParticle.radius, toParticle.radius) * 0.72;
      const connectionMesh = createBondBetweenPoints(
        fromParticle.position,
        toParticle.position,
        {
          color: style.connectionColor,
          radius: connectionRadius,
          opacity: 0.94,
          endpointInset,
          includeInFrame: false,
          renderOrder: 4
        }
      );

      if (connectionMesh) {
        coordinationGroup.add(connectionMesh);
      }
    });

    const polyhedron = createCoordinationPolyhedron(
      centerConfig.polyhedronFaces,
      particles,
      style.polyhedronColor
    );

    if (polyhedron) {
      coordinationGroup.add(polyhedron);
    }
  });

  coordinationGroup.userData = {
    centerParticleIndices: [...centerParticleIndices],
    neighborParticleIndices: [...neighborParticleIndices],
    highlightedParticleIndices: [...highlightedParticles]
  };
  coordinationGroup.visible = false;

  return coordinationGroup;
}

function createCrystalModel(crystal) {
  const modelGroup = new THREE.Group();
  const frameGroup = createModelLayerGroup("crystal-frame");
  const bondGroup = createModelLayerGroup("crystal-bonds");
  const atomGroup = createModelLayerGroup("crystal-atoms");
  const auxiliaryGroup = createModelLayerGroup("crystal-auxiliary");
  const coordinationGroup = buildCoordinationOverlay(crystal);
  const internalAxisGroup = buildCrystalAxisGroup(crystal);
  const atomContributionMetadataByParticleIndex =
    createAtomContributionMetadataByParticleIndex(crystal);
  const modelRefs = {
    frameGroup,
    bondGroup,
    atomGroup,
    auxiliaryGroup,
    coordinationGroup,
    internalAxisGroup,
    particleMeshesByIndex: [],
    connectionMeshesByIndex: []
  };

  modelGroup.name = `${crystal.id}-model`;
  frameGroup.add(createCellFrame(crystal.cellFrame));
  modelGroup.add(frameGroup);
  modelGroup.add(bondGroup);
  modelGroup.add(auxiliaryGroup);
  modelGroup.add(atomGroup);
  modelGroup.add(coordinationGroup);
  modelGroup.add(internalAxisGroup);

  if (Array.isArray(crystal.connections)) {
    crystal.connections.forEach((connection, index) => {
      const mesh = createConnectionMesh(connection, crystal.particles);

      if (!mesh) {
        return;
      }

      modelRefs.connectionMeshesByIndex[index] = mesh;
      if (mesh.userData?.isAuxiliaryConnection) {
        auxiliaryGroup.add(mesh);
      } else {
        bondGroup.add(mesh);
      }
    });
  }

  crystal.particles.forEach((particle, index) => {
    const mesh = createParticleMesh(
      particle,
      index,
      atomContributionMetadataByParticleIndex.get(index)
    );

    if (!mesh) {
      return;
    }

    modelRefs.particleMeshesByIndex[index] = mesh;

    if (mesh.userData?.isAuxiliaryParticle) {
      auxiliaryGroup.add(mesh);
    } else {
      atomGroup.add(mesh);
    }
  });

  return {
    modelGroup,
    modelRefs
  };
}

function hasCoordinationDisplay(crystal) {
  return Boolean(crystal.supportsCoordinationDisplay && crystal.coordinationDisplay);
}

function hasCountingDisplay(crystal) {
  return Boolean(
    crystal.supportsCountingDisplay &&
      (crystal.countingInfo || crystal.effectiveAtomCounting)
  );
}

function getSupportText(crystal) {
  const bondSupport =
    crystal.connections?.length > 0 ? "支持结构成键显示" : "当前不绘制结构成键";
  const auxiliarySupport = crystal.supportsAuxiliaryAtoms
    ? "支持辅助原子显示"
    : "无辅助原子显示";
  const coordinationSupport = hasCoordinationDisplay(crystal)
    ? "支持代表性配位显示"
    : "当前不支持配位显示";
  const countSupport = hasEffectiveCounting(crystal)
    ? "支持模型内贡献标注"
    : "当前无模型内贡献标注";

  return `${bondSupport} / ${auxiliarySupport} / ${coordinationSupport} / ${countSupport}`;
}

function updateCrystalInfo(crystal) {
  if (modelElement) {
    modelElement.textContent = crystal.displayName ?? `${crystal.name} (${crystal.id})`;
  }

  if (typeElement) {
    typeElement.textContent = crystal.structureFeatureSummary ?? crystal.typeSummary;
  }

  if (representativeSubstanceElement) {
    representativeSubstanceElement.textContent =
      crystal.representativeSubstance || "当前未设置";
  }

  if (representativeFormulaElement) {
    representativeFormulaElement.textContent =
      crystal.representativeFormula || "当前未设置";
  }

  if (buildStatusElement) {
    buildStatusElement.textContent = getBuildStatusLabel(crystal.buildStatus);
  }

  if (supportElement) {
    supportElement.textContent = getSupportText(crystal);
  }

  setCrystalSummary(crystal.description ?? crystal.structureFeatureSummary);
}

function updateKnowledgePanels(crystal) {
  renderCountingPanel(crystal, getCountingPanelRenderState(crystal));
  renderAtomLegend(crystal);
}

function hasEffectiveCounting(crystal) {
  return Boolean(
    crystal?.effectiveAtomCounting?.enabled &&
      crystal.effectiveAtomCounting.groups?.length
  );
}

function getAtomContributionInteractiveObjects() {
  if (!showCountEnabled || !hasEffectiveCounting(currentCrystal)) {
    return [];
  }

  return currentModelRefs.particleMeshesByIndex.filter(
    (mesh) => mesh?.userData?.selectable && mesh.visible !== false
  );
}

function clearAtomContributionInteraction({ immediate = false } = {}) {
  atomContributionRenderer.clearInteraction({ immediate });
}

function handleAtomContributionHover(mesh) {
  atomContributionRenderer.setHoverAtom(mesh);
}

function handleAtomContributionSelect(mesh) {
  if (!showCountEnabled || !hasEffectiveCounting(currentCrystal)) {
    clearAtomContributionInteraction();
    return;
  }

  const group = atomContributionRenderer.selectAtom(mesh);

  if (!group) {
    return;
  }

  selectedCountGroupId = group.id;
  uiController?.setSelectedCountGroup?.(selectedCountGroupId);
  setPanelStatus(`${group.label}：${group.formulaText ?? group.equation}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCoordinationInteractiveObjects() {
  if (!showCoordinationEnabled || !hasCoordinationDisplay(currentCrystal)) {
    return [];
  }

  return currentModelRefs.particleMeshesByIndex.filter(
    (mesh) =>
      mesh?.userData?.type === "atom" &&
      mesh.userData.isSelectableAtom !== false &&
      mesh.visible !== false
  );
}

function renderCoordinationSelectionInfo(info) {
  if (!coordinationSelectionInfoElement) {
    return;
  }

  if (!info) {
    coordinationSelectionInfoElement.hidden = true;
    coordinationSelectionInfoElement.innerHTML = "";
    return;
  }

  const coordinationNumberText =
    info.coordinationNumber === info.expectedCoordinationNumber
      ? `${info.coordinationNumber}`
      : `${info.coordinationNumber} / ${info.expectedCoordinationNumber}`;

  coordinationSelectionInfoElement.innerHTML = `
    <p class="coordination-info-kicker">当前选中配位环境</p>
    <dl class="coordination-info-list">
      <div>
        <dt>晶胞</dt>
        <dd>${escapeHtml(info.crystalName)}</dd>
      </div>
      <div>
        <dt>中心原子</dt>
        <dd>${escapeHtml(info.atomType)}</dd>
      </div>
      <div>
        <dt>配位数</dt>
        <dd>${escapeHtml(coordinationNumberText)}</dd>
      </div>
      <div>
        <dt>配位原子</dt>
        <dd>${escapeHtml(info.neighborSummary || "最近邻原子")}</dd>
      </div>
    </dl>
    <p class="coordination-info-note">${escapeHtml(info.description)}</p>
  `;
  coordinationSelectionInfoElement.hidden = false;
}

function clearCoordinationSelectionInfo() {
  renderCoordinationSelectionInfo(null);
}

function clearAtomCoordinationInteraction({ immediate = false } = {}) {
  atomCoordinationRenderer.clearSelection({ immediate });
  atomCoordinationRenderer.clearHover();
  clearCoordinationSelectionInfo();
}

function handleCoordinationHover(mesh) {
  atomCoordinationRenderer.setHoverAtom(mesh);
}

function handleCoordinationSelect(mesh) {
  if (!showCoordinationEnabled || !hasCoordinationDisplay(currentCrystal)) {
    clearAtomCoordinationInteraction({ immediate: true });
    return;
  }

  const info = atomCoordinationRenderer.selectAtom(mesh);

  if (!info) {
    clearAtomCoordinationInteraction({ immediate: true });
    return;
  }

  renderCoordinationSelectionInfo(info);
  setPanelStatus(
    `${info.atomType} 配位数 ${info.coordinationNumber}：${
      info.neighborSummary || "最近邻原子"
    }`
  );
}

function getCoordinateInteractiveObjects() {
  if (!showCellAxesEnabled || showCountEnabled) {
    return [];
  }

  return currentModelRefs.particleMeshesByIndex.filter(
    (mesh) =>
      mesh?.userData?.type === "atom" &&
      mesh.userData.coordinateSelectable !== false &&
      mesh.visible !== false
  );
}

function clearAtomCoordinateSelection() {
  atomCoordinateOverlay.clearSelection();
}

function handleCoordinateSelect(mesh) {
  if (!showCellAxesEnabled || showCountEnabled) {
    clearAtomCoordinateSelection();
    return;
  }

  atomCoordinateOverlay.selectAtom(mesh);
}

function getCountingGroupOptions(crystal) {
  if (!hasEffectiveCounting(crystal)) {
    return [{ id: "all", label: "全部显示" }];
  }

  return [
    { id: "all", label: "全部显示" },
    ...crystal.effectiveAtomCounting.groups.map((group) => ({
      id: group.id,
      label: group.label
    }))
  ];
}

function resolveSelectedCountGroupId(crystal, requestedGroupId = selectedCountGroupId) {
  if (!hasEffectiveCounting(crystal)) {
    return "all";
  }

  if (requestedGroupId === "all") {
    return "all";
  }

  return crystal.effectiveAtomCounting.groups.some(
    (group) => group.id === requestedGroupId
  )
    ? requestedGroupId
    : "all";
}

function getCountingPanelRenderState(crystal = currentCrystal) {
  const detailGroupId =
    hoveredCountGroupId ||
    (selectedCountGroupId !== "all" ? selectedCountGroupId : null);

  return {
    enabled: showCountEnabled && hasEffectiveCounting(crystal),
    selectedGroupId: selectedCountGroupId,
    detailGroupId
  };
}

function refreshCountingPanel() {
  if (!currentCrystal) {
    return;
  }

  renderCountingPanel(currentCrystal, getCountingPanelRenderState(currentCrystal));
}

function getFrameBounds(target) {
  const bounds = new THREE.Box3();
  const childBounds = new THREE.Box3();
  let hasBounds = false;

  target.traverse((child) => {
    if (child === target || child.userData?.includeInFrame === false) {
      return;
    }

    if (!child.isMesh && !child.isLineSegments && !child.isLine) {
      return;
    }

    childBounds.setFromObject(child);

    if (childBounds.isEmpty()) {
      return;
    }

    if (!hasBounds) {
      bounds.copy(childBounds);
      hasBounds = true;
      return;
    }

    bounds.union(childBounds);
  });

  return hasBounds ? bounds : new THREE.Box3().setFromObject(target);
}

function applyCrystalOrientation(crystal) {
  const rotation = crystal.crystalOrientation?.rotation ?? { x: 0, y: 0, z: 0 };

  crystalOrientationGroup.rotation.set(
    rotation.x ?? 0,
    rotation.y ?? 0,
    rotation.z ?? 0
  );
  crystalOrientationGroup.updateMatrixWorld(true);
}

function applySelectedView({
  viewId = selectedViewId,
  animate = false,
  syncUi = true
} = {}) {
  if (!currentCrystal || crystalOrientationGroup.children.length === 0) {
    return null;
  }

  selectedViewId = viewId;

  if (syncUi) {
    uiController?.setSelectedView(viewId);
  }

  const resolvedView = getResolvedViewDefinition(currentCrystal, viewId);
  const pose = createCameraPoseForView(crystalOrientationGroup, resolvedView);

  if (animate) {
    startCameraTransition(pose);
  } else {
    applyCameraPose(pose);
  }

  return resolvedView;
}

function setAutoRotateState(nextValue, { syncUi = true } = {}) {
  autoRotateEnabled = Boolean(nextValue);
  controls.autoRotate = autoRotateEnabled && !viewLockEnabled;

  if (syncUi) {
    uiController?.setAutoRotate(autoRotateEnabled);
  }
}

function setShowCellAxesState(nextValue, { syncUi = true } = {}) {
  showCellAxesEnabled = Boolean(nextValue);

  if (syncUi) {
    uiController?.setShowCellAxes(showCellAxesEnabled);
  }

  applyInternalAxisVisibility(showCellAxesEnabled);
  applyAtomCoordinateVisibility(currentCrystal, showCellAxesEnabled);
}

function getEffectiveCountingGroupById(
  crystal = currentCrystal,
  groupId = selectedCountGroupId
) {
  return (
    crystal?.effectiveAtomCounting?.groups?.find((group) => group.id === groupId) ??
    null
  );
}

function rebuildEffectiveCountingOverlay(crystal = currentCrystal) {
  hoveredCountGroupId = null;
  renderer.domElement.style.cursor = "";
  effectiveAtomRenderer.clear();
  selectedCountGroupId = resolveSelectedCountGroupId(crystal, selectedCountGroupId);
}

function setSelectedCountGroupState(nextGroupId, { syncUi = true } = {}) {
  selectedCountGroupId = resolveSelectedCountGroupId(currentCrystal, nextGroupId);
  effectiveAtomRenderer.setActiveGroup(selectedCountGroupId);

  if (syncUi) {
    uiController?.setSelectedCountGroup(selectedCountGroupId);
  }

  refreshCountingPanel();
}

function setHoveredCountGroupState(nextGroupId) {
  const normalizedGroupId = nextGroupId || null;

  if (hoveredCountGroupId === normalizedGroupId) {
    return;
  }

  hoveredCountGroupId = normalizedGroupId;
  effectiveAtomRenderer.setHoverGroup(hoveredCountGroupId);
  renderer.domElement.style.cursor = hoveredCountGroupId ? "pointer" : "";
  refreshCountingPanel();
}

function getPointedEffectiveCountingGroupId(event) {
  if (!showCountEnabled || !hasEffectiveCounting(currentCrystal)) {
    return null;
  }

  const interactiveObjects = effectiveAtomRenderer.getInteractiveObjects();

  if (!interactiveObjects.length) {
    return null;
  }

  const rect = renderer.domElement.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  effectiveCountingPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  effectiveCountingPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  effectiveCountingRaycaster.setFromCamera(effectiveCountingPointer, camera);

  const intersections = effectiveCountingRaycaster.intersectObjects(
    interactiveObjects,
    false
  );

  if (!intersections.length) {
    return null;
  }

  return effectiveAtomRenderer.getGroupIdFromObject(intersections[0].object);
}

function handleEffectiveCountingPointerMove(event) {
  setHoveredCountGroupState(getPointedEffectiveCountingGroupId(event));
}

function handleEffectiveCountingPointerLeave() {
  setHoveredCountGroupState(null);
}

function handleEffectiveCountingClick(event) {
  const groupId = getPointedEffectiveCountingGroupId(event);

  if (!groupId) {
    return;
  }

  setSelectedCountGroupState(groupId, { syncUi: true });

  const group = getEffectiveCountingGroupById(currentCrystal, groupId);

  if (group) {
    setPanelStatus(`当前聚焦：${group.label}（${group.equation}）。`);
  }
}

function setViewLockState(nextValue, { syncUi = true, animateToView = true } = {}) {
  viewLockEnabled = Boolean(nextValue);

  if (viewLockEnabled) {
    if (animateToView) {
      applySelectedView({
        viewId: selectedViewId,
        animate: true,
        syncUi: false
      });
    }

    setAutoRotateState(false, { syncUi: true });
    controls.enableRotate = false;
    uiController?.setAutoRotateAvailability(false);
  } else {
    controls.enableRotate = true;
    controls.autoRotate = autoRotateEnabled;
    uiController?.setAutoRotateAvailability(true);
    uiController?.setAutoRotate(autoRotateEnabled);
  }

  if (syncUi) {
    uiController?.setViewLock(viewLockEnabled);
  }
}

function resetParticleVisual(mesh) {
  const material = mesh.material;

  material.color.setHex(mesh.userData.baseColor);
  material.emissive.setHex(0x000000);
  applyMaterialOpacity(material, mesh.userData.defaultOpacity);
  mesh.scale.setScalar(1);
  mesh.renderOrder = mesh.userData.baseRenderOrder ?? 2;
}

function resetConnectionVisual(mesh) {
  const material = mesh.material;

  material.color.setHex(mesh.userData.baseColor);
  material.emissive.setHex(0x000000);
  applyMaterialOpacity(material, mesh.userData.defaultOpacity);
  mesh.renderOrder = mesh.userData.baseRenderOrder ?? 1;
}

function applyCoordinationParticleEmphasis(mesh, emphasisType) {
  const material = mesh.material;
  const baseColor = new THREE.Color(mesh.userData.baseColor);
  const accentColor = new THREE.Color(
    emphasisType === "center" ? 0xf2bf74 : 0xf6d59a
  );
  const emissiveStrength = emphasisType === "center" ? 0.42 : 0.26;

  material.color.copy(baseColor.lerp(accentColor, emphasisType === "center" ? 0.18 : 0.1));
  material.emissive.copy(accentColor.multiplyScalar(emissiveStrength));
  applyMaterialOpacity(material, 1);
  mesh.scale.setScalar(emphasisType === "center" ? 1.17 : 1.1);
  mesh.renderOrder = emphasisType === "center" ? 8 : 7;
}

function applyBaseModelVisualState(crystal, coordinationEnabled) {
  currentModelRefs.particleMeshesByIndex.forEach((mesh, particleIndex) => {
    if (!mesh) {
      return;
    }

    resetParticleVisual(mesh);
  });

  currentModelRefs.connectionMeshesByIndex.forEach((mesh) => {
    if (!mesh) {
      return;
    }

    resetConnectionVisual(mesh);
  });
}

function applyAuxiliaryVisibility(crystal) {
  const showAuxiliary = crystal.supportsAuxiliaryAtoms
    ? showAuxiliaryAtomsEnabled
    : true;

  if (currentModelRefs.auxiliaryGroup) {
    currentModelRefs.auxiliaryGroup.visible = showAuxiliary;
  }

  currentModelRefs.particleMeshesByIndex.forEach((mesh) => {
    if (!mesh) {
      return;
    }

    mesh.visible = showAuxiliary || !mesh.userData.isAuxiliaryParticle;
  });

  currentModelRefs.connectionMeshesByIndex.forEach((mesh) => {
    if (!mesh) {
      return;
    }

    mesh.visible = showAuxiliary || !mesh.userData.isAuxiliaryConnection;
  });
}

function applyCoordinationVisibility(crystal, enabled) {
  if (!currentModelRefs.coordinationGroup) {
    return;
  }

  currentModelRefs.coordinationGroup.visible = false;
}

function applyInternalAxisVisibility(enabled) {
  if (!currentModelRefs.internalAxisGroup) {
    return;
  }

  currentModelRefs.internalAxisGroup.visible = Boolean(enabled);
}

function applyCountingPanelVisibility(crystal, enabled) {
  setCountingPanelVisibility(false);
}

function applyEffectiveCountingVisibility(crystal, enabled) {
  const shouldEnableContributionInteraction =
    Boolean(enabled) && hasEffectiveCounting(crystal);

  hoveredCountGroupId = null;
  atomContributionInteraction.setEnabled(shouldEnableContributionInteraction);

  if (!shouldEnableContributionInteraction) {
    clearAtomContributionInteraction({ immediate: true });
  }

  if (atomContributionHintElement) {
    atomContributionHintElement.hidden = !shouldEnableContributionInteraction;
  }

  effectiveAtomRenderer.clear();
}

function applyDynamicCoordinationVisibility(crystal, enabled) {
  const shouldEnableCoordinationInteraction =
    Boolean(enabled) && hasCoordinationDisplay(crystal);

  atomCoordinationInteraction.setEnabled(shouldEnableCoordinationInteraction);

  if (!shouldEnableCoordinationInteraction) {
    clearAtomCoordinationInteraction({ immediate: true });
    return;
  }

  atomCoordinationRenderer.refreshVisualState();
}

function applyAtomCoordinateVisibility(crystal, enabled) {
  const shouldEnableCoordinateInteraction = Boolean(
    enabled && crystal && !showCountEnabled
  );

  atomCoordinateInteraction.setEnabled(shouldEnableCoordinateInteraction);

  if (!shouldEnableCoordinateInteraction) {
    clearAtomCoordinateSelection();
  }
}

function applyCrystalDisplayState() {
  applyBaseModelVisualState(currentCrystal, showCoordinationEnabled);
  applyAuxiliaryVisibility(currentCrystal);
  applyCoordinationVisibility(currentCrystal, showCoordinationEnabled);
  applyEffectiveCountingVisibility(currentCrystal, showCountEnabled);
  applyDynamicCoordinationVisibility(currentCrystal, showCoordinationEnabled);
  applyInternalAxisVisibility(showCellAxesEnabled);
  applyAtomCoordinateVisibility(currentCrystal, showCellAxesEnabled);
  updateKnowledgePanels(currentCrystal);
  applyCountingPanelVisibility(currentCrystal, showCountEnabled);
}

function getLoadStatusMessage(crystal) {
  if (showCountEnabled && hasEffectiveCounting(crystal)) {
    return `已加载 ${crystal.name}，原子贡献标注已开启。`;
  }

  if (showCoordinationEnabled && hasCoordinationDisplay(crystal)) {
    return `已加载 ${crystal.name}，配位点击模式已开启：点按任意可见原子查看最近邻配位。`;
  }

  return `已加载 ${crystal.name}。`;
}

const uiController = setupUI({
  crystalOptions: getCrystalOptions(),
  viewOptions: getStandardViewOptions(),
  initialState: {
    currentCrystalId,
    selectedViewId,
    selectedCountGroupId,
    countGroupOptions: getCountingGroupOptions(currentCrystal),
    viewLocked: viewLockEnabled,
    autoRotate: autoRotateEnabled,
    showCellAxes: showCellAxesEnabled,
    showAuxiliary: showAuxiliaryAtomsEnabled,
    showCoordination: false,
    showCount: false
  },
  onCrystalChange(nextCrystalId) {
    loadCrystal(nextCrystalId);
  },
  onViewChange(nextViewId) {
    clearAtomContributionInteraction();
    clearAtomCoordinationInteraction({ immediate: true });
    const resolvedView = applySelectedView({
      viewId: nextViewId,
      animate: true
    });

    if (!resolvedView) {
      return;
    }

    const viewLabel =
      nextViewId === "default"
        ? `${currentCrystal.name} 的默认展示视角`
        : resolvedView.label;
    setPanelStatus(`已切换到${viewLabel}。`);
  },
  onViewLockChange(nextValue) {
    setViewLockState(nextValue, {
      syncUi: true,
      animateToView: true
    });
    setPanelStatus(
      nextValue
        ? "视角已锁定：拖拽旋转已禁用，仅保留缩放；自动旋转已同步关闭。"
        : "已解除视角锁定，恢复自由拖拽旋转。"
    );
  },
  onAutoRotateChange(nextValue) {
    setAutoRotateState(nextValue, { syncUi: true });
    setPanelStatus(nextValue ? "自动旋转已开启。" : "自动旋转已暂停。");
  },
  onShowCellAxesChange(nextValue) {
    clearAtomContributionInteraction();
    setShowCellAxesState(nextValue, { syncUi: true });
    setPanelStatus(
      nextValue
        ? "已显示晶胞内统一坐标轴。"
        : "已隐藏晶胞内统一坐标轴。"
    );
  },
  onCountGroupChange(nextGroupId) {
    setSelectedCountGroupState(nextGroupId, { syncUi: false });
    const group = getEffectiveCountingGroupById(currentCrystal, selectedCountGroupId);

    if (selectedCountGroupId === "all" || !group) {
      setPanelStatus("已切换为查看全部贡献分组。");
      return;
    }

    setPanelStatus(`已切换为查看 ${group.label}。`);
  },
  onShowAuxiliaryChange(nextValue) {
    clearAtomContributionInteraction();
    clearAtomCoordinationInteraction({ immediate: true });
    clearAtomCoordinateSelection();
    if (!currentCrystal.supportsAuxiliaryAtoms) {
      uiController.setShowAuxiliary(showAuxiliaryAtomsEnabled);
      setPanelStatus("当前晶胞没有可切换的辅助原子。");
      return;
    }

    showAuxiliaryAtomsEnabled = nextValue;
    applyCrystalDisplayState();
    setPanelStatus(
      nextValue
        ? "已显示边界辅助原子与补全键。"
        : "已隐藏边界辅助原子，仅保留当前晶胞主体。"
    );
  },
  onShowCoordinationChange(nextValue) {
    clearAtomContributionInteraction();
    if (nextValue && showCountEnabled) {
      showCountEnabled = false;
      uiController.setShowCount(false);
    }

    if (!hasCoordinationDisplay(currentCrystal)) {
      showCoordinationEnabled = false;
      uiController.setShowCoordination(false);
      setPanelStatus("当前晶胞暂不提供配位显示。");
      return;
    }

    showCoordinationEnabled = nextValue;
    applyCrystalDisplayState();
    setPanelStatus(
      nextValue
        ? "配位点击模式已开启：点按任意可见原子查看最近邻配位。"
        : "配位点击模式已关闭。"
    );
  },
  onShowCountChange(nextValue) {
    clearAtomContributionInteraction();
    if (nextValue && showCoordinationEnabled) {
      showCoordinationEnabled = false;
      uiController.setShowCoordination(false);
      clearAtomCoordinationInteraction({ immediate: true });
    }

    if (!hasEffectiveCounting(currentCrystal)) {
      showCountEnabled = false;
      uiController.setShowCount(false);
      setPanelStatus("当前晶胞暂不提供模型内贡献标注。");
      return;
    }

    showCountEnabled = nextValue;
    applyCrystalDisplayState();
    setPanelStatus(
      nextValue
        ? "原子贡献标注已开启：点按原子查看它对晶胞的贡献。"
        : "原子贡献标注已关闭。"
    );
  }
});

function syncCrystalUI(crystal) {
  const auxiliaryAvailable = Boolean(crystal.supportsAuxiliaryAtoms);
  const coordinationAvailable = hasCoordinationDisplay(crystal);
  const countAvailable = hasEffectiveCounting(crystal);

  if (!coordinationAvailable) {
    showCoordinationEnabled = false;
  }

  if (!countAvailable) {
    showCountEnabled = false;
  }

  uiController.setSelectedCrystal(crystal.id);
  uiController.setSelectedView(selectedViewId);
  uiController.setViewLock(viewLockEnabled);
  uiController.setAutoRotate(autoRotateEnabled);
  uiController.setAutoRotateAvailability(!viewLockEnabled);
  uiController.setCountGroupOptions(getCountingGroupOptions(crystal));
  uiController.setSelectedCountGroup(selectedCountGroupId);
  uiController.setShowCellAxes(showCellAxesEnabled);
  uiController.setAuxiliaryAvailability(auxiliaryAvailable);
  uiController.setCoordinationAvailability(coordinationAvailable);
  uiController.setCountAvailability(countAvailable);

  if (auxiliaryAvailable) {
    uiController.setShowAuxiliary(showAuxiliaryAtomsEnabled);
  }

  if (coordinationAvailable) {
    uiController.setShowCoordination(showCoordinationEnabled);
  }

  if (countAvailable) {
    uiController.setShowCount(showCountEnabled);
  }
}

function loadCrystal(crystalId) {
  currentCrystalId = crystalId;
  currentCrystal = getCrystalById(crystalId);
  hoveredCountGroupId = null;

  stopCameraTransition();
  atomContributionRenderer.clear({ immediate: true });
  atomCoordinationRenderer.clear({ immediate: true });
  atomCoordinateOverlay.clear({ removeRoot: true });
  clearCoordinationSelectionInfo();
  effectiveAtomRenderer.clear();
  clearGroup(crystalOrientationGroup);
  currentModelRefs = createEmptyModelRefs();

  const { modelGroup, modelRefs } = createCrystalModel(currentCrystal);
  currentModelRefs = modelRefs;

  crystalOrientationGroup.add(modelGroup);
  applyCrystalOrientation(currentCrystal);
  atomContributionRenderer.rebuild(
    currentCrystal,
    currentModelRefs.particleMeshesByIndex
  );
  atomCoordinationRenderer.rebuild(
    currentCrystal,
    currentModelRefs.particleMeshesByIndex,
    currentModelRefs.connectionMeshesByIndex
  );
  atomCoordinateOverlay.rebuild(
    currentCrystal,
    currentModelRefs.particleMeshesByIndex
  );
  atomContributionInteraction.setEnabled(
    showCountEnabled && hasEffectiveCounting(currentCrystal)
  );
  atomCoordinationInteraction.setEnabled(
    showCoordinationEnabled && hasCoordinationDisplay(currentCrystal)
  );
  atomCoordinateInteraction.setEnabled(showCellAxesEnabled);
  rebuildEffectiveCountingOverlay(currentCrystal);
  setAutoRotateState(autoRotateEnabled, { syncUi: false });
  applySelectedView({
    viewId: selectedViewId,
    animate: false,
    syncUi: false
  });
  setViewLockState(viewLockEnabled, {
    syncUi: false,
    animateToView: false
  });
  syncCrystalUI(currentCrystal);
  updateCrystalInfo(currentCrystal);
  applyCrystalDisplayState();
  setPanelStatus(getLoadStatusMessage(currentCrystal));
}

resizeRenderer();
window.addEventListener("resize", resizeRenderer);

if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer();
  });
  resizeObserver.observe(viewerContainer);
}

loadCrystal(currentCrystalId);

function animate() {
  requestAnimationFrame(animate);
  updateCameraTransition(performance.now());
  controls.update();
  atomContributionRenderer.update(performance.now());
  atomCoordinationRenderer.update(performance.now());
  atomCoordinateOverlay.update();
  effectiveAtomRenderer.update(performance.now());
  renderer.render(scene, camera);
}

animate();
