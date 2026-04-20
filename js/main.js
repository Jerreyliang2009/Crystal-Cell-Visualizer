import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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
  renderCoordinationPanel,
  renderCountingPanel,
  renderAtomLegend,
  setCoordinationPanelVisibility,
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

const axisWidgetScene = new THREE.Scene();
const axisWidgetCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
const axisWidgetGroup = new THREE.Group();
axisWidgetGroup.name = "axis-widget-group";
axisWidgetScene.add(axisWidgetGroup);
const AXIS_WIDGET_FIXED_SIZE = 96;
const AXIS_WIDGET_ANIMATION_MS = 220;
let axisWidgetHideTimer = 0;
let axisWidgetShowFrame = 0;

const axisWidgetContainer = document.createElement("div");
axisWidgetContainer.className = "axis-widget-overlay";
axisWidgetContainer.setAttribute("aria-hidden", "true");
axisWidgetContainer.style.position = "fixed";
axisWidgetContainer.style.top = "24px";
axisWidgetContainer.style.left = "24px";
axisWidgetContainer.style.width = `${AXIS_WIDGET_FIXED_SIZE}px`;
axisWidgetContainer.style.height = `${AXIS_WIDGET_FIXED_SIZE}px`;
axisWidgetContainer.style.boxSizing = "border-box";
axisWidgetContainer.style.padding = "10px";
axisWidgetContainer.style.border = "1px solid rgba(192, 208, 220, 0.92)";
axisWidgetContainer.style.borderRadius = "18px";
axisWidgetContainer.style.background = "rgba(255, 255, 255, 0.86)";
axisWidgetContainer.style.boxShadow = "0 16px 30px rgba(17, 45, 69, 0.14)";
axisWidgetContainer.style.backdropFilter = "blur(10px)";
axisWidgetContainer.style.overflow = "hidden";
axisWidgetContainer.style.pointerEvents = "none";
axisWidgetContainer.style.zIndex = "30";
axisWidgetContainer.style.display = "none";

const axisWidgetRenderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});
axisWidgetRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
axisWidgetRenderer.outputColorSpace = THREE.SRGBColorSpace;
axisWidgetRenderer.domElement.style.display = "block";
axisWidgetRenderer.domElement.style.width = "100%";
axisWidgetRenderer.domElement.style.height = "100%";
axisWidgetRenderer.domElement.style.pointerEvents = "none";
axisWidgetContainer.appendChild(axisWidgetRenderer.domElement);
document.body.appendChild(axisWidgetContainer);

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

let currentCrystalId = getDefaultCrystalId();
let currentCrystal = getCrystalById(currentCrystalId);
let selectedViewId = "default";
let viewLockEnabled = false;
let autoRotateEnabled = true;
let showAxesEnabled = false;
let showAuxiliaryAtomsEnabled = true;
let showCoordinationEnabled = false;
let showCountEnabled = false;
let currentModelRefs = createEmptyModelRefs();
let cameraTransition = null;

function createEmptyModelRefs() {
  return {
    frameGroup: null,
    bondGroup: null,
    atomGroup: null,
    auxiliaryGroup: null,
    coordinationGroup: null,
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

buildAxisWidget();

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

function buildAxisWidget() {
  clearGroup(axisWidgetGroup);
  axisWidgetGroup.quaternion.copy(scientificToWorldQuaternion);

  const axisDefinitions = [
    {
      label: axisConvention.axes.x.label,
      direction: scientificXAxis,
      color: 0xc85d4f,
      colorText: "#c85d4f"
    },
    {
      label: axisConvention.axes.y.label,
      direction: scientificYAxis,
      color: 0x4b8f78,
      colorText: "#4b8f78"
    },
    {
      label: axisConvention.axes.z.label,
      direction: scientificZAxis,
      color: 0x3d6fa7,
      colorText: "#3d6fa7"
    }
  ];

  axisDefinitions.forEach((axis) => {
    const arrow = new THREE.ArrowHelper(
      axis.direction.clone().normalize(),
      new THREE.Vector3(),
      1.02,
      axis.color,
      0.18,
      0.1
    );
    arrow.line.material.depthTest = false;
    arrow.cone.material.depthTest = false;
    axisWidgetGroup.add(arrow);

    const labelSprite = createAxisLabelSprite(axis.label, axis.colorText);
    labelSprite.position.copy(axis.direction.clone().normalize().multiplyScalar(1.26));
    axisWidgetGroup.add(labelSprite);
  });

  const originSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 18, 18),
    new THREE.MeshBasicMaterial({
      color: 0x40505f,
      depthTest: false,
      depthWrite: false
    })
  );
  axisWidgetGroup.add(originSphere);
}

function syncAxisWidgetCamera(widgetWidth = 176, widgetHeight = 176) {
  const cameraOffset = camera.position.clone().sub(controls.target);

  if (cameraOffset.lengthSq() <= 1e-6) {
    cameraOffset.set(2.6, 2.4, 3.1);
  }

  axisWidgetCamera.position.copy(cameraOffset.setLength(5.6));
  axisWidgetCamera.up.copy(camera.up);
  axisWidgetCamera.lookAt(0, 0, 0);
  axisWidgetCamera.aspect =
    widgetWidth > 0 && widgetHeight > 0 ? widgetWidth / widgetHeight : 1;
  axisWidgetCamera.updateProjectionMatrix();
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

function getAxisWidgetLayout() {
  const width = viewerContainer.clientWidth;
  const height = viewerContainer.clientHeight;

  if (!width || !height) {
    return null;
  }

  const inset = width <= 640 ? 10 : width <= 900 ? 12 : 24;
  const widgetSize = AXIS_WIDGET_FIXED_SIZE;
  const atomLegendElement = document.getElementById("atom-legend-floating");
  const floatingPanelElement = document.getElementById("floating-ui");
  const axisSide = atomLegendElement?.classList.contains("is-right")
    ? "right"
    : atomLegendElement?.classList.contains("is-left")
      ? "left"
      : floatingPanelElement?.classList.contains("is-left")
        ? "right"
        : "left";
  const left =
    axisSide === "left" ? inset : window.innerWidth - inset - widgetSize;

  return {
    top: inset,
    left,
    side: axisSide,
    widgetWidth: widgetSize,
    widgetHeight: widgetSize
  };
}

function showAxisWidgetContainer() {
  if (axisWidgetHideTimer) {
    window.clearTimeout(axisWidgetHideTimer);
    axisWidgetHideTimer = 0;
  }

  axisWidgetContainer.setAttribute("aria-hidden", "false");

  if (axisWidgetContainer.style.display !== "block") {
    axisWidgetContainer.style.display = "block";
    axisWidgetContainer.classList.remove("is-visible");
    axisWidgetContainer.getBoundingClientRect();
  }

  if (
    !axisWidgetContainer.classList.contains("is-visible") &&
    !axisWidgetShowFrame
  ) {
    axisWidgetShowFrame = window.requestAnimationFrame(() => {
      axisWidgetShowFrame = 0;

      if (showAxesEnabled) {
        axisWidgetContainer.classList.add("is-visible");
      }
    });
  }
}

function hideAxisWidgetContainer() {
  if (axisWidgetShowFrame) {
    window.cancelAnimationFrame(axisWidgetShowFrame);
    axisWidgetShowFrame = 0;
  }

  axisWidgetContainer.setAttribute("aria-hidden", "true");
  axisWidgetContainer.classList.remove("is-visible");

  if (axisWidgetContainer.style.display === "none" || axisWidgetHideTimer) {
    return;
  }

  axisWidgetHideTimer = window.setTimeout(() => {
    axisWidgetHideTimer = 0;

    if (!showAxesEnabled) {
      axisWidgetContainer.style.display = "none";
    }
  }, AXIS_WIDGET_ANIMATION_MS + 40);
}

function renderAxisWidget() {
  if (!showAxesEnabled) {
    hideAxisWidgetContainer();
    return;
  }

  const layout = getAxisWidgetLayout();

  if (!layout) {
    hideAxisWidgetContainer();
    return;
  }

  const { left, top, side, widgetWidth, widgetHeight } = layout;

  syncAxisWidgetCamera(widgetWidth, widgetHeight);
  axisWidgetContainer.style.top = `${top}px`;
  axisWidgetContainer.style.width = `${widgetWidth}px`;
  axisWidgetContainer.style.height = `${widgetHeight}px`;
  axisWidgetContainer.style.left = `${left}px`;
  axisWidgetContainer.style.right = "auto";
  axisWidgetContainer.classList.toggle("is-left", side === "left");
  axisWidgetContainer.classList.toggle("is-right", side === "right");
  axisWidgetContainer.dataset.side = side;
  showAxisWidgetContainer();
  axisWidgetRenderer.setSize(widgetWidth, widgetHeight, false);
  axisWidgetRenderer.render(axisWidgetScene, axisWidgetCamera);
}

function getResolvedViewDefinition(crystal, requestedViewId = selectedViewId) {
  if (requestedViewId === "default") {
    const crystalDefaultView = crystal.defaultView ?? {};
    const inheritedView =
      standardViewDirections[crystalDefaultView.viewId] ??
      standardViewDirections.isometric;

    return {
      id: "default",
      label: standardViewDirections.default.label,
      direction: crystalDefaultView.direction ?? inheritedView.direction,
      up: crystalDefaultView.up ?? inheritedView.up,
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

  const explicitView =
    standardViewDirections[requestedViewId] ?? standardViewDirections.front;

  return {
    id: explicitView.id,
    label: explicitView.label,
    direction: explicitView.direction,
    up: explicitView.up,
    distanceScale: explicitView.distanceScale ?? 2.12,
    description: explicitView.description,
    rationale: "",
    referenceViewId: explicitView.id
  };
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
  const distance =
    (radius / Math.tan(halfFov)) * (viewDefinition.distanceScale ?? 2.12);

  return {
    position: sphere.center.clone().addScaledVector(directionWorld, distance),
    target: sphere.center.clone(),
    up: upWorld,
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
    fromNear: camera.near,
    fromFar: camera.far,
    toPosition: pose.position.clone(),
    toTarget: pose.target.clone(),
    toUp: pose.up.clone(),
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

function createParticleMesh(particle) {
  if (particle.visible === false) {
    return null;
  }

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
  const modelRefs = {
    frameGroup,
    bondGroup,
    atomGroup,
    auxiliaryGroup,
    coordinationGroup,
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
    const mesh = createParticleMesh(particle);

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
  return Boolean(crystal.supportsCountingDisplay && crystal.countingInfo);
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
  const countSupport = hasCountingDisplay(crystal)
    ? "支持计数显示"
    : "当前无计数显示";

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
  renderCoordinationPanel(crystal);
  renderCountingPanel(crystal);
  renderAtomLegend(crystal);
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

function setShowAxesState(nextValue, { syncUi = true } = {}) {
  showAxesEnabled = Boolean(nextValue);

  if (syncUi) {
    uiController?.setShowAxes(showAxesEnabled);
  }

  renderAxisWidget();
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
  const shouldDim = coordinationEnabled && hasCoordinationDisplay(crystal);
  const centerIndices = new Set(
    currentModelRefs.coordinationGroup?.userData?.centerParticleIndices ?? []
  );
  const neighborIndices = new Set(
    currentModelRefs.coordinationGroup?.userData?.neighborParticleIndices ?? []
  );

  currentModelRefs.particleMeshesByIndex.forEach((mesh, particleIndex) => {
    if (!mesh) {
      return;
    }

    resetParticleVisual(mesh);

    if (!shouldDim) {
      return;
    }

    if (centerIndices.has(particleIndex)) {
      applyCoordinationParticleEmphasis(mesh, "center");
      return;
    }

    if (neighborIndices.has(particleIndex)) {
      applyCoordinationParticleEmphasis(mesh, "neighbor");
      return;
    }

    const material = mesh.material;
    const dimOpacity = mesh.userData.isAuxiliaryParticle
      ? 0.08
      : mesh.userData.defaultOpacity * 0.36;

    applyMaterialOpacity(material, dimOpacity);
  });

  currentModelRefs.connectionMeshesByIndex.forEach((mesh) => {
    if (!mesh) {
      return;
    }

    resetConnectionVisual(mesh);

    if (!shouldDim) {
      return;
    }

    const material = mesh.material;
    const dimOpacity = mesh.userData.isAuxiliaryConnection
      ? 0.05
      : mesh.userData.defaultOpacity * 0.2;

    applyMaterialOpacity(material, dimOpacity);
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

  currentModelRefs.coordinationGroup.visible =
    enabled &&
    hasCoordinationDisplay(crystal) &&
    currentModelRefs.coordinationGroup.children.length > 0;
}

function applyCoordinationPanelVisibility(crystal, enabled) {
  setCoordinationPanelVisibility(enabled && hasCoordinationDisplay(crystal));
}

function applyCountingPanelVisibility(crystal, enabled) {
  setCountingPanelVisibility(enabled && hasCountingDisplay(crystal));
}

function applyCrystalDisplayState() {
  applyBaseModelVisualState(currentCrystal, showCoordinationEnabled);
  applyAuxiliaryVisibility(currentCrystal);
  applyCoordinationVisibility(currentCrystal, showCoordinationEnabled);
  updateKnowledgePanels(currentCrystal);
  applyCoordinationPanelVisibility(currentCrystal, showCoordinationEnabled);
  applyCountingPanelVisibility(currentCrystal, showCountEnabled);
}

function getLoadStatusMessage(crystal) {
  if (showCountEnabled && hasCountingDisplay(crystal)) {
    return crystal.countingInfo?.countingSummary ?? `已显示 ${crystal.name} 的计数说明。`;
  }

  if (showCoordinationEnabled && hasCoordinationDisplay(crystal)) {
    return (
      crystal.coordinationDescription ??
      `已显示 ${crystal.coordinationLabel ?? "代表性配位环境"}。`
    );
  }

  return `已加载 ${crystal.name}。`;
}

const uiController = setupUI({
  crystalOptions: getCrystalOptions(),
  viewOptions: getStandardViewOptions(),
  initialState: {
    currentCrystalId,
    selectedViewId,
    viewLocked: viewLockEnabled,
    autoRotate: autoRotateEnabled,
    showAxes: showAxesEnabled,
    showAuxiliary: showAuxiliaryAtomsEnabled,
    showCoordination: false,
    showCount: false
  },
  onCrystalChange(nextCrystalId) {
    loadCrystal(nextCrystalId);
  },
  onViewChange(nextViewId) {
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
  onShowAxesChange(nextValue) {
    setShowAxesState(nextValue, { syncUi: true });
    setPanelStatus(nextValue ? "已显示统一坐标轴。" : "已隐藏统一坐标轴。");
  },
  onShowAuxiliaryChange(nextValue) {
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
        ? currentCrystal.coordinationDescription ??
            `已显示 ${currentCrystal.coordinationLabel ?? "代表性配位环境"}。`
        : `已隐藏 ${currentCrystal.coordinationLabel ?? "代表性配位环境"}。`
    );
  },
  onShowCountChange(nextValue) {
    if (!hasCountingDisplay(currentCrystal)) {
      showCountEnabled = false;
      uiController.setShowCount(false);
      setPanelStatus("当前晶胞暂不提供计数说明。");
      return;
    }

    showCountEnabled = nextValue;
    applyCrystalDisplayState();
    setPanelStatus(
      nextValue
        ? currentCrystal.countingInfo?.countingSummary ??
            `已显示 ${currentCrystal.name} 的计数说明。`
        : `已隐藏 ${currentCrystal.name} 的计数说明。`
    );
  }
});

function syncCrystalUI(crystal) {
  const auxiliaryAvailable = Boolean(crystal.supportsAuxiliaryAtoms);
  const coordinationAvailable = hasCoordinationDisplay(crystal);
  const countAvailable = hasCountingDisplay(crystal);

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
  uiController.setShowAxes(showAxesEnabled);
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

  stopCameraTransition();
  clearGroup(crystalOrientationGroup);
  currentModelRefs = createEmptyModelRefs();

  const { modelGroup, modelRefs } = createCrystalModel(currentCrystal);
  currentModelRefs = modelRefs;

  crystalOrientationGroup.add(modelGroup);
  applyCrystalOrientation(currentCrystal);
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
  renderer.render(scene, camera);
  renderAxisWidget();
}

animate();
