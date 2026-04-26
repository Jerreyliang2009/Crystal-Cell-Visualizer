(function (window) {
  "use strict";

const THREE = window.THREE;
const namespace = window.CrystalCellVisualizer || {};

const GHOST_OPACITY = 0.18;
const EFFECTIVE_OPACITY = 0.9;
const DIM_GHOST_OPACITY = 0.06;
const DIM_EFFECTIVE_OPACITY = 0.22;
const PULSE_SCALE_RANGE = 0.045;
const PULSE_SPEED = 0.0062;
const VISIBILITY_FADE_MS = 220;

function brightenColor(colorValue, amount = 0.24) {
  return new THREE.Color(colorValue).lerp(new THREE.Color(0xffffff), amount);
}

function buildBoxPlanes(cellFrame) {
  const size = new THREE.Vector3(
    cellFrame?.size?.x ?? 2,
    cellFrame?.size?.y ?? 2,
    cellFrame?.size?.z ?? 2
  );
  const halfSize = size.multiplyScalar(0.5);
  const min = halfSize.clone().multiplyScalar(-1);
  const max = halfSize;

  return [
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(min.x, 0, 0)
    ),
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(max.x, 0, 0)
    ),
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, min.y, 0)
    ),
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, max.y, 0)
    ),
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, min.z)
    ),
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, max.z)
    )
  ];
}

function buildHexagonalPrismPlanes(cellFrame) {
  const baseVertices = (cellFrame?.baseVertices ?? []).map((vertex) => ({
    x: vertex.x ?? 0,
    y: vertex.y ?? 0
  }));
  const zMin =
    cellFrame?.zMin ??
    (Number.isFinite(cellFrame?.height) ? -cellFrame.height * 0.5 : -1);
  const zMax =
    cellFrame?.zMax ??
    (Number.isFinite(cellFrame?.height) ? cellFrame.height * 0.5 : 1);
  const center = baseVertices.reduce(
    (result, vertex) => result.add(new THREE.Vector3(vertex.x, vertex.y, 0)),
    new THREE.Vector3()
  );

  if (baseVertices.length) {
    center.multiplyScalar(1 / baseVertices.length);
  }

  const sidePlanes = baseVertices.map((vertex, index) => {
    const nextVertex = baseVertices[(index + 1) % baseVertices.length];
    const edge = new THREE.Vector3(
      nextVertex.x - vertex.x,
      nextVertex.y - vertex.y,
      0
    );
    const midpoint = new THREE.Vector3(
      (vertex.x + nextVertex.x) * 0.5,
      (vertex.y + nextVertex.y) * 0.5,
      0
    );
    const inwardNormal = new THREE.Vector3(-edge.y, edge.x, 0).normalize();

    if (inwardNormal.dot(center.clone().sub(midpoint)) < 0) {
      inwardNormal.multiplyScalar(-1);
    }

    return new THREE.Plane().setFromNormalAndCoplanarPoint(
      inwardNormal,
      new THREE.Vector3(vertex.x, vertex.y, 0)
    );
  });

  return [
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, zMin)
    ),
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, zMax)
    ),
    ...sidePlanes
  ];
}

function buildLocalClippingPlanes(cellFrame) {
  if (cellFrame?.shape === "hexagonal-prism") {
    return buildHexagonalPrismPlanes(cellFrame);
  }

  return buildBoxPlanes(cellFrame);
}

function buildWorldClippingPlanes(cellFrame, targetGroup) {
  const localPlanes = buildLocalClippingPlanes(cellFrame);

  targetGroup.updateMatrixWorld(true);

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(
    targetGroup.matrixWorld
  );

  return localPlanes.map((plane) =>
    plane.clone().applyMatrix4(targetGroup.matrixWorld, normalMatrix)
  );
}

function createGhostMaterial(particle) {
  return new THREE.MeshPhongMaterial({
    color: particle.color,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthWrite: false,
    shininess: 65
  });
}

function createEffectiveMaterial(particle, clippingPlanes) {
  const emphasizedColor = brightenColor(particle.color, 0.18);

  return new THREE.MeshPhongMaterial({
    color: emphasizedColor,
    emissive: emphasizedColor.clone().multiplyScalar(0.18),
    transparent: true,
    opacity: EFFECTIVE_OPACITY,
    depthWrite: false,
    shininess: 120,
    side: THREE.DoubleSide,
    clippingPlanes,
    clipShadows: false
  });
}

function getParticlePositionVector(particle) {
  return new THREE.Vector3(
    particle?.position?.x ?? 0,
    particle?.position?.y ?? 0,
    particle?.position?.z ?? 0
  );
}

function collectEffectiveAtomParticleIndices(crystal) {
  const indexSet = new Set();

  (crystal?.effectiveAtomCounting?.groups ?? []).forEach((group) => {
    (group.atomRefs ?? []).forEach((atomRef) => {
      if (Number.isInteger(atomRef)) {
        indexSet.add(atomRef);
      }
    });
  });

  return indexSet;
}

class EffectiveAtomRenderer {
  constructor({ attachTarget }) {
    this.attachTarget = attachTarget;
    this.crystal = null;
    this.rootGroup = null;
    this.groupEntries = [];
    this.geometryCache = new Map();
    this.materials = new Set();
    this.raycastTargets = [];
    this.visible = false;
    this.activeGroupId = "all";
    this.hoverGroupId = null;
    this.visibilityProgress = 0;
    this.visibilityTarget = 0;
    this.lastUpdateAt = 0;
  }

  clear() {
    if (this.rootGroup?.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }

    this.materials.forEach((material) => material.dispose?.());
    this.materials.clear();
    this.geometryCache.forEach((geometry) => geometry.dispose?.());
    this.geometryCache.clear();
    this.groupEntries = [];
    this.raycastTargets = [];
    this.rootGroup = null;
    this.crystal = null;
    this.hoverGroupId = null;
    this.visibilityProgress = 0;
    this.visibilityTarget = 0;
    this.lastUpdateAt = 0;
  }

  dispose() {
    this.clear();
  }

  getSphereGeometry(radius) {
    const geometryKey = radius.toFixed(6);

    if (!this.geometryCache.has(geometryKey)) {
      this.geometryCache.set(
        geometryKey,
        new THREE.SphereGeometry(radius, 30, 30)
      );
    }

    return this.geometryCache.get(geometryKey);
  }

  rebuild(crystal) {
    this.clear();
    this.crystal = crystal;

    const countingConfig = crystal?.effectiveAtomCounting;

    if (!countingConfig?.enabled || !this.attachTarget) {
      return;
    }

    const clippingPlanes = buildWorldClippingPlanes(
      crystal.cellFrame,
      this.attachTarget
    );
    const rootGroup = new THREE.Group();

    rootGroup.name = `${crystal.id}-effective-counting`;
    rootGroup.visible = this.visibilityTarget > 0 || this.visibilityProgress > 0;

    countingConfig.groups.forEach((groupConfig, groupIndex) => {
      const groupRoot = new THREE.Group();
      const entry = {
        id: groupConfig.id,
        config: groupConfig,
        root: groupRoot,
        atomEntries: [],
        pulsePhase: groupIndex * 0.6
      };

      groupRoot.name = `effective-group-${groupConfig.id}`;

      (groupConfig.atomRefs ?? []).forEach((atomRef, atomIndex) => {
        const particle = crystal.particles?.[atomRef];

        if (!particle || particle.metadata?.isAuxiliary || particle.visible === false) {
          return;
        }

        const geometry = this.getSphereGeometry(particle.radius);
        const ghostMaterial = createGhostMaterial(particle);
        const effectiveMaterial = createEffectiveMaterial(particle, clippingPlanes);
        const ghostMesh = new THREE.Mesh(geometry, ghostMaterial);
        const effectiveMesh = new THREE.Mesh(geometry, effectiveMaterial);
        const position = getParticlePositionVector(particle);
        const metadata = {
          effectiveCountingGroupId: groupConfig.id,
          effectiveCountingAtomRef: atomRef,
          effectiveCountingSpecies: groupConfig.species,
          effectiveCountingLabel: groupConfig.label,
          effectiveCountingEquation: groupConfig.equation,
          includeInFrame: false
        };

        ghostMesh.position.copy(position);
        effectiveMesh.position.copy(position);
        ghostMesh.renderOrder = 12;
        effectiveMesh.renderOrder = 13;
        ghostMesh.userData = {
          ...ghostMesh.userData,
          ...metadata,
          effectiveCountingLayer: "ghost",
          effectiveCountingIndex: atomIndex
        };
        effectiveMesh.userData = {
          ...effectiveMesh.userData,
          ...metadata,
          effectiveCountingLayer: "effective",
          effectiveCountingIndex: atomIndex
        };

        groupRoot.add(ghostMesh);
        groupRoot.add(effectiveMesh);
        entry.atomEntries.push({
          ghostMesh,
          effectiveMesh,
          ghostMaterial,
          effectiveMaterial
        });
        this.materials.add(ghostMaterial);
        this.materials.add(effectiveMaterial);
        this.raycastTargets.push(ghostMesh, effectiveMesh);
      });

      rootGroup.add(groupRoot);
      this.groupEntries.push(entry);
    });

    this.rootGroup = rootGroup;
    this.attachTarget.add(rootGroup);
    this.applyVisualState();
  }

  setVisible(nextValue) {
    this.visible = Boolean(nextValue);
    this.visibilityTarget = this.visible ? 1 : 0;

    if (this.rootGroup && this.visibilityTarget > 0) {
      this.rootGroup.visible = true;
    }

    this.applyVisualState();
  }

  setActiveGroup(groupId = "all") {
    this.activeGroupId = groupId || "all";
    this.applyVisualState();
  }

  setHoverGroup(groupId = null) {
    this.hoverGroupId = groupId || null;
    this.applyVisualState();
  }

  getInteractiveObjects() {
    return this.visible && this.visibilityProgress >= 0.35 ? this.raycastTargets : [];
  }

  getGroupIdFromObject(object) {
    let currentObject = object;

    while (currentObject) {
      if (currentObject.userData?.effectiveCountingGroupId) {
        return currentObject.userData.effectiveCountingGroupId;
      }

      currentObject = currentObject.parent;
    }

    return null;
  }

  getHighlightGroupId() {
    if (this.hoverGroupId) {
      return this.hoverGroupId;
    }

    if (this.activeGroupId && this.activeGroupId !== "all") {
      return this.activeGroupId;
    }

    return null;
  }

  applyVisualState() {
    const activeFilterId =
      this.activeGroupId && this.activeGroupId !== "all"
        ? this.activeGroupId
        : null;
    const emphasisGroupId = this.getHighlightGroupId();
    const opacityFactor = this.visibilityProgress;
    const shouldShowAnyGroup =
      this.visibilityTarget > 0.001 || this.visibilityProgress > 0.001;

    this.groupEntries.forEach((entry) => {
      const isVisible = !activeFilterId || activeFilterId === entry.id;
      const isEmphasized = emphasisGroupId === entry.id;
      const shouldDim =
        Boolean(emphasisGroupId) &&
        this.activeGroupId === "all" &&
        emphasisGroupId !== entry.id;

      entry.root.visible = shouldShowAnyGroup && isVisible;

      entry.atomEntries.forEach(({ ghostMesh, effectiveMesh, ghostMaterial, effectiveMaterial }) => {
        ghostMesh.scale.setScalar(1);
        effectiveMesh.scale.setScalar(1);
        ghostMaterial.opacity =
          (shouldDim ? DIM_GHOST_OPACITY : GHOST_OPACITY) * opacityFactor;
        effectiveMaterial.opacity =
          (shouldDim ? DIM_EFFECTIVE_OPACITY : EFFECTIVE_OPACITY) * opacityFactor;
        effectiveMaterial.emissiveIntensity =
          (isEmphasized ? 1.2 : 1) * (0.3 + opacityFactor * 0.7);
      });
    });

    if (this.rootGroup && !shouldShowAnyGroup) {
      this.rootGroup.visible = false;
    }
  }

  update(now) {
    if (!this.rootGroup) {
      return;
    }

    const deltaMs = this.lastUpdateAt
      ? Math.min(48, Math.max(0, now - this.lastUpdateAt))
      : 16;
    this.lastUpdateAt = now;

    const previousVisibilityProgress = this.visibilityProgress;
    const fadeStep = Math.min(1, deltaMs / VISIBILITY_FADE_MS);

    this.visibilityProgress = THREE.MathUtils.lerp(
      this.visibilityProgress,
      this.visibilityTarget,
      fadeStep
    );

    if (Math.abs(this.visibilityProgress - this.visibilityTarget) <= 0.01) {
      this.visibilityProgress = this.visibilityTarget;
    }

    if (Math.abs(this.visibilityProgress - previousVisibilityProgress) > 0.0001) {
      if (this.visibilityProgress > 0) {
        this.rootGroup.visible = true;
      }

      this.applyVisualState();
    }

    if (this.visibilityProgress <= 0.001 && this.visibilityTarget <= 0.001) {
      this.rootGroup.visible = false;
      return;
    }

    const emphasisGroupId = this.getHighlightGroupId();

    this.groupEntries.forEach((entry) => {
      const isEmphasized = entry.id === emphasisGroupId;
      const pulseScale = isEmphasized
        ? 1 + Math.sin(now * PULSE_SPEED + entry.pulsePhase) * PULSE_SCALE_RANGE
        : 1;

      entry.atomEntries.forEach(({ ghostMesh, effectiveMesh }) => {
        ghostMesh.scale.setScalar(isEmphasized ? 1.01 : 1);
        effectiveMesh.scale.setScalar(pulseScale);
      });
    });
  }
}

Object.assign(namespace, {
  collectEffectiveAtomParticleIndices,
  EffectiveAtomRenderer
});

window.CrystalCellVisualizer = namespace;
})(window);
