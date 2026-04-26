(function (window) {
  "use strict";

const THREE = window.THREE;
const namespace = window.CrystalCellVisualizer || {};

const FADE_MS = 260;
const CENTER_COLOR = 0xf2a85b;
const NEIGHBOR_COLOR = 0x6fc3ff;
const AUXILIARY_NEIGHBOR_COLOR = 0xa9d8ff;
const CONNECTION_COLOR = 0x2d8fca;
const CENTER_SCALE = 1.2;
const NEIGHBOR_SCALE = 1.12;
const POSITION_KEY_PRECISION = 5;
const DEFAULT_TOLERANCE = 1e-4;

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

function vectorKey(vector, precision = POSITION_KEY_PRECISION) {
  return [vector.x, vector.y, vector.z]
    .map((value) => value.toFixed(precision))
    .join(",");
}

function coefficientsKey(coefficients) {
  return coefficients.join(",");
}

function isZeroCoefficients(coefficients) {
  return coefficients.every((value) => value === 0);
}

function applyMaterialOpacity(material, opacity) {
  if (!material) {
    return;
  }

  material.opacity = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = opacity >= 0.999;
  material.needsUpdate = true;
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

function resetParticleVisual(mesh) {
  const material = mesh?.material;

  if (!material) {
    return;
  }

  material.color.setHex(mesh.userData?.baseColor ?? material.color.getHex());
  material.emissive?.setHex?.(0x000000);
  applyMaterialOpacity(
    material,
    mesh.userData?.defaultOpacity ?? material.opacity ?? 1
  );
  mesh.scale.setScalar(1);
  mesh.renderOrder = mesh.userData?.baseRenderOrder ?? 2;
}

function resetConnectionVisual(mesh) {
  const material = mesh?.material;

  if (!material) {
    return;
  }

  material.color.setHex(mesh.userData?.baseColor ?? material.color.getHex());
  material.emissive?.setHex?.(0x000000);
  applyMaterialOpacity(
    material,
    mesh.userData?.defaultOpacity ?? material.opacity ?? 1
  );
  mesh.renderOrder = mesh.userData?.baseRenderOrder ?? 1;
}

function brightenColor(colorValue, amount = 0.24) {
  return new THREE.Color(colorValue ?? 0x7d8d99).lerp(
    new THREE.Color(0xffffff),
    amount
  );
}

function getParticlePosition(particle) {
  return toVector3(particle?.position);
}

function getMeshLocalPosition(mesh) {
  return toVector3(mesh?.userData?.localPosition ?? mesh?.position);
}

function getAtomTypeFromParticle(particle, mesh) {
  return (
    mesh?.userData?.species ||
    mesh?.userData?.atomType ||
    particle?.metadata?.species ||
    particle?.metadata?.element ||
    particle?.label ||
    particle?.category ||
    "原子"
  );
}

function getAtomTypeLabel(value) {
  return String(value ?? "原子").replace(/\s*位点.*$/, "").trim() || "原子";
}

function getDefaultBoxTranslationVectors(crystal) {
  const size = crystal?.cellFrame?.size ?? { x: 2, y: 2, z: 2 };

  return [
    new THREE.Vector3(size.x ?? 2, 0, 0),
    new THREE.Vector3(0, size.y ?? 2, 0),
    new THREE.Vector3(0, 0, size.z ?? 2)
  ];
}

function normalizeTranslationVectors(crystal) {
  const vectors = crystal?.coordinationRule?.translationVectors;

  if (Array.isArray(vectors) && vectors.length >= 3) {
    return vectors.slice(0, 3).map((vector) => toVector3(vector));
  }

  if (crystal?.cellFrame?.shape === "box") {
    return getDefaultBoxTranslationVectors(crystal);
  }

  return [];
}

function resolveCoordinationRule(crystal) {
  const rule = crystal?.coordinationRule ?? {};
  const display = crystal?.coordinationDisplay ?? {};
  const coordinationNumber =
    rule.coordinationNumber ??
    crystal?.coordinationNumber ??
    display.coordinationNumber ??
    null;

  if (!Number.isFinite(coordinationNumber)) {
    return null;
  }

  return {
    type: rule.type ?? "nearest-neighbor-shell",
    coordinationNumber,
    searchRange: Math.max(1, rule.searchRange ?? rule.maxSearchRange ?? 1),
    tolerance: rule.tolerance ?? rule.distanceTolerance ?? DEFAULT_TOLERANCE,
    relativeTolerance: rule.relativeTolerance ?? 0.025,
    translationVectors: normalizeTranslationVectors(crystal),
    explanation:
      rule.explanation ??
      crystal?.coordinationInfo?.summary ??
      crystal?.coordinationDescription ??
      "该原子周围最近邻原子构成其配位环境。"
  };
}

function createCoefficientTriples(searchRange) {
  const triples = [];

  for (let x = -searchRange; x <= searchRange; x += 1) {
    for (let y = -searchRange; y <= searchRange; y += 1) {
      for (let z = -searchRange; z <= searchRange; z += 1) {
        triples.push([x, y, z]);
      }
    }
  }

  return triples;
}

function combineTranslation(vectors, coefficients) {
  return vectors.reduce(
    (result, vector, index) =>
      result.addScaledVector(vector, coefficients[index] ?? 0),
    new THREE.Vector3()
  );
}

function createCylinderBetween(start, end, options = {}) {
  const direction = end.clone().sub(start);
  const fullLength = direction.length();

  if (fullLength <= 1e-6) {
    return null;
  }

  direction.normalize();

  const endpointInset = Math.min(
    options.endpointInset ?? 0,
    fullLength * 0.45
  );
  const trimmedStart = start.clone().addScaledVector(direction, endpointInset);
  const trimmedEnd = end.clone().addScaledVector(direction, -endpointInset);
  const length = trimmedStart.distanceTo(trimmedEnd);
  const geometry = new THREE.CylinderGeometry(
    options.radius ?? 0.018,
    options.radius ?? 0.018,
    length,
    14,
    1,
    false
  );
  const opacity = options.opacity ?? 0.82;
  const material = new THREE.MeshPhongMaterial({
    color: options.color ?? CONNECTION_COLOR,
    transparent: opacity < 0.999,
    opacity,
    depthWrite: false,
    shininess: 80,
    emissive: new THREE.Color(options.color ?? CONNECTION_COLOR).multiplyScalar(
      0.12
    )
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(trimmedStart.clone().add(trimmedEnd).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  mesh.renderOrder = options.renderOrder ?? 6;
  mesh.userData = {
    includeInFrame: false,
    isDynamicCoordinationObject: true
  };

  return mesh;
}

function createHalo(position, radius, color, opacity) {
  const geometry = new THREE.SphereGeometry(radius, 28, 28);
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    shininess: 120,
    emissive: new THREE.Color(color).multiplyScalar(0.28)
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(position);
  mesh.renderOrder = 7;
  mesh.userData = {
    includeInFrame: false,
    isDynamicCoordinationObject: true
  };

  return mesh;
}

function createAuxiliaryNeighborMesh(record) {
  const particle = record.particle;
  const radius = particle?.radius ?? 0.12;
  const color = record.baseColor ?? particle?.color ?? AUXILIARY_NEIGHBOR_COLOR;
  const geometry = new THREE.SphereGeometry(radius, 26, 26);
  const material = new THREE.MeshPhongMaterial({
    color: brightenColor(color, 0.34),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    shininess: 115,
    emissive: new THREE.Color(NEIGHBOR_COLOR).multiplyScalar(0.22)
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(record.position);
  mesh.scale.setScalar(NEIGHBOR_SCALE);
  mesh.renderOrder = 8;
  mesh.userData = {
    type: "atom",
    atomId: record.atomId,
    atomType: record.atomType,
    species: record.atomType,
    isSelectableAtom: false,
    isAuxiliaryAtom: true,
    includeInFrame: false,
    isDynamicCoordinationObject: true
  };

  return mesh;
}

function getMaterialOpacityTargets(object) {
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material].filter(Boolean);

  return materials.map((material) => ({
    material,
    targetOpacity: material.opacity ?? 1
  }));
}

function createShellFaces(neighborRecords) {
  if (neighborRecords.length === 4) {
    return [
      [0, 1, 2],
      [0, 1, 3],
      [0, 2, 3],
      [1, 2, 3]
    ];
  }

  return [];
}

function createCoordinationShell(neighborRecords) {
  const faces = createShellFaces(neighborRecords);

  if (!faces.length) {
    return null;
  }

  const positions = [];

  faces.forEach((face) => {
    for (let index = 1; index < face.length - 1; index += 1) {
      [face[0], face[index], face[index + 1]].forEach((pointIndex) => {
        const point = neighborRecords[pointIndex]?.position;

        positions.push(point.x, point.y, point.z);
      });
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    color: 0x7cc8ff,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
    shininess: 60
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.renderOrder = 3;
  mesh.userData = {
    includeInFrame: false,
    isDynamicCoordinationObject: true
  };

  return mesh;
}

class AtomCoordinationRenderer {
  constructor({ attachTarget }) {
    this.attachTarget = attachTarget;
    this.rootGroup = null;
    this.crystal = null;
    this.particleMeshesByIndex = [];
    this.connectionMeshesByIndex = [];
    this.selectedMesh = null;
    this.hoverMesh = null;
    this.neighborRecords = [];
    this.animatedEntries = [];
    this.selectionInfo = null;
  }

  rebuild(crystal, particleMeshesByIndex = [], connectionMeshesByIndex = []) {
    this.clear({ immediate: true });
    this.crystal = crystal;
    this.particleMeshesByIndex = particleMeshesByIndex;
    this.connectionMeshesByIndex = connectionMeshesByIndex;

    if (!this.attachTarget) {
      return;
    }

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = `${crystal?.id ?? "crystal"}-dynamic-coordination`;
    this.rootGroup.visible = true;
    this.rootGroup.userData = {
      includeInFrame: false
    };
    this.attachTarget.add(this.rootGroup);
  }

  clear({ immediate = true } = {}) {
    this.clearHover();
    this.clearSelection({ immediate });
    this.selectionInfo = null;

    if (this.rootGroup) {
      disposeObjectTree(this.rootGroup);
      this.rootGroup.removeFromParent();
      this.rootGroup = null;
    }

    this.crystal = null;
    this.particleMeshesByIndex = [];
    this.connectionMeshesByIndex = [];
  }

  setHoverAtom(mesh) {
    if (this.selectedMesh) {
      return;
    }

    if (this.hoverMesh === mesh) {
      return;
    }

    if (this.hoverMesh && this.hoverMesh !== this.selectedMesh) {
      resetParticleVisual(this.hoverMesh);
    }

    this.hoverMesh = mesh;

    if (!mesh || mesh === this.selectedMesh) {
      return;
    }

    const material = mesh.material;
    const baseColor = mesh.userData?.baseColor ?? material.color.getHex();
    const hoverColor = brightenColor(baseColor, 0.22);

    material.color.copy(hoverColor);
    material.emissive?.copy?.(new THREE.Color(0xf2bf74).multiplyScalar(0.12));
    applyMaterialOpacity(material, Math.min(1, mesh.userData?.defaultOpacity ?? 1));
    mesh.scale.setScalar(1.06);
    mesh.renderOrder = 6;
  }

  clearHover() {
    if (this.hoverMesh && this.hoverMesh !== this.selectedMesh) {
      resetParticleVisual(this.hoverMesh);
    }

    this.hoverMesh = null;
  }

  clearSelection({ immediate = true } = {}) {
    this.selectedMesh = null;
    this.neighborRecords = [];
    this.selectionInfo = null;
    this.restoreDefaultVisualState();

    if (!this.rootGroup) {
      return;
    }

    if (immediate) {
      disposeObjectTree(this.rootGroup);
      this.rootGroup.clear();
      this.animatedEntries = [];
      return;
    }

    this.rootGroup.children.forEach((child) => {
      this.fadeOutAndDispose(child);
    });
  }

  restoreDefaultVisualState() {
    this.particleMeshesByIndex.forEach((mesh) => {
      if (mesh) {
        resetParticleVisual(mesh);
      }
    });

    this.connectionMeshesByIndex.forEach((mesh) => {
      if (mesh) {
        resetConnectionVisual(mesh);
      }
    });
  }

  refreshVisualState() {
    if (!this.selectedMesh || !this.neighborRecords.length) {
      return;
    }

    this.applySelectionVisualState(this.selectedMesh, this.neighborRecords);
  }

  selectAtom(atomMesh) {
    if (!atomMesh || !this.crystal || !this.rootGroup) {
      this.clearSelection();
      return null;
    }

    const selection = this.buildCoordinationObjects(atomMesh);

    if (!selection) {
      this.clearSelection();
      return null;
    }

    this.clearSelection({ immediate: true });
    this.selectedMesh = atomMesh;
    this.neighborRecords = selection.neighborRecords;
    this.selectionInfo = selection.info;
    this.applySelectionVisualState(atomMesh, selection.neighborRecords);
    this.buildSelectionOverlay(atomMesh, selection.neighborRecords);

    return selection.info;
  }

  buildCoordinationObjects(atomMesh) {
    const rule = resolveCoordinationRule(this.crystal);

    if (!rule) {
      return null;
    }

    const centerPosition = getMeshLocalPosition(atomMesh);
    const candidates = this.buildPeriodicCandidates(centerPosition, rule);

    if (!candidates.length) {
      return null;
    }

    const nearestDistance =
      this.crystal?.coordinationRule?.nearestNeighborDistance ??
      candidates[0].distance;
    const tolerance = Math.max(
      rule.tolerance,
      nearestDistance * rule.relativeTolerance
    );
    let neighborRecords = candidates.filter(
      (candidate) => Math.abs(candidate.distance - nearestDistance) <= tolerance
    );

    if (neighborRecords.length < rule.coordinationNumber) {
      neighborRecords = candidates.slice(0, rule.coordinationNumber);
    }

    if (neighborRecords.length > rule.coordinationNumber) {
      neighborRecords = neighborRecords.slice(0, rule.coordinationNumber);
    }

    const info = this.createSelectionInfo(atomMesh, neighborRecords, rule);

    return {
      neighborRecords,
      info
    };
  }

  buildPeriodicCandidates(centerPosition, rule) {
    const particles = this.crystal?.particles ?? [];
    const sourceRecords = particles
      .map((particle, particleIndex) => ({
        particle,
        particleIndex,
        mesh: this.particleMeshesByIndex[particleIndex]
      }))
      .filter(({ particle }) => {
        if (!particle || particle.visible === false) {
          return false;
        }

        if (particle.includeInFrame === false) {
          return false;
        }

        if (particle.metadata?.isAuxiliary || particle.metadata?.isDiamondHelper) {
          return false;
        }

        return true;
      });
    const visibleMeshByPosition = new Map();

    this.particleMeshesByIndex.forEach((mesh, particleIndex) => {
      if (!mesh || mesh.visible === false) {
        return;
      }

      visibleMeshByPosition.set(vectorKey(getMeshLocalPosition(mesh)), {
        mesh,
        particleIndex
      });
    });

    const coefficients = createCoefficientTriples(rule.searchRange);
    const candidatesByPosition = new Map();

    sourceRecords.forEach(({ particle, particleIndex, mesh }) => {
      const sourcePosition = getParticlePosition(particle);

      coefficients.forEach((coefficientTriple) => {
        const translation = combineTranslation(
          rule.translationVectors,
          coefficientTriple
        );
        const position = sourcePosition.clone().add(translation);
        const distance = position.distanceTo(centerPosition);

        if (distance <= rule.tolerance) {
          return;
        }

        const key = vectorKey(position);
        const existingVisible = visibleMeshByPosition.get(key);
        const zeroTranslation = isZeroCoefficients(coefficientTriple);
        const priority =
          (existingVisible ? 4 : 0) +
          (zeroTranslation ? 2 : 0) +
          (mesh?.visible !== false ? 1 : 0);
        const candidate = {
          key,
          atomId:
            existingVisible?.mesh?.userData?.atomId ??
            `${mesh?.userData?.atomId ?? particle.category ?? "atom"}@${coefficientsKey(coefficientTriple)}`,
          atomType: getAtomTypeLabel(
            getAtomTypeFromParticle(particle, existingVisible?.mesh ?? mesh)
          ),
          particle,
          particleIndex,
          mesh: existingVisible?.mesh ?? null,
          position,
          distance,
          translationCoefficients: coefficientTriple,
          isAuxiliary: !existingVisible,
          baseColor:
            existingVisible?.mesh?.userData?.baseColor ??
            mesh?.userData?.baseColor ??
            particle.color,
          priority
        };
        const previous = candidatesByPosition.get(key);

        if (!previous || candidate.priority > previous.priority) {
          candidatesByPosition.set(key, candidate);
        }
      });
    });

    return [...candidatesByPosition.values()].sort(
      (left, right) =>
        left.distance - right.distance ||
        left.position.x - right.position.x ||
        left.position.y - right.position.y ||
        left.position.z - right.position.z
    );
  }

  createSelectionInfo(atomMesh, neighborRecords, rule) {
    const atomType = getAtomTypeLabel(
      getAtomTypeFromParticle(
        this.crystal?.particles?.[atomMesh.userData?.particleIndex],
        atomMesh
      )
    );
    const neighborCounts = new Map();

    neighborRecords.forEach((record) => {
      neighborCounts.set(record.atomType, (neighborCounts.get(record.atomType) ?? 0) + 1);
    });

    const neighborSummary = [...neighborCounts.entries()]
      .map(([type, count]) => `${type} × ${count}`)
      .join("，");

    return {
      crystalName: this.crystal?.displayName ?? this.crystal?.name ?? "",
      atomId: atomMesh.userData?.atomId ?? "",
      atomType,
      coordinationNumber: neighborRecords.length || rule.coordinationNumber,
      expectedCoordinationNumber: rule.coordinationNumber,
      neighborSummary,
      description: rule.explanation
    };
  }

  applySelectionVisualState(centerMesh, neighborRecords) {
    const neighborMeshes = new Set(
      neighborRecords
        .map((record) => record.mesh)
        .filter(Boolean)
    );

    this.particleMeshesByIndex.forEach((mesh) => {
      if (!mesh) {
        return;
      }

      resetParticleVisual(mesh);

      if (mesh === centerMesh) {
        this.applyCenterVisual(mesh);
        return;
      }

      if (neighborMeshes.has(mesh)) {
        this.applyNeighborVisual(mesh);
        return;
      }

      const dimOpacity = mesh.userData?.isAuxiliaryParticle
        ? 0.06
        : (mesh.userData?.defaultOpacity ?? 1) * 0.28;

      applyMaterialOpacity(mesh.material, dimOpacity);
      mesh.renderOrder = mesh.userData?.baseRenderOrder ?? 2;
    });

    this.connectionMeshesByIndex.forEach((mesh) => {
      if (!mesh) {
        return;
      }

      resetConnectionVisual(mesh);
      applyMaterialOpacity(mesh.material, (mesh.userData?.defaultOpacity ?? 1) * 0.18);
    });
  }

  applyCenterVisual(mesh) {
    const material = mesh.material;
    const baseColor = mesh.userData?.baseColor ?? material.color.getHex();

    material.color.copy(brightenColor(baseColor, 0.34));
    material.emissive?.copy?.(new THREE.Color(CENTER_COLOR).multiplyScalar(0.42));
    applyMaterialOpacity(material, 1);
    mesh.scale.setScalar(CENTER_SCALE);
    mesh.renderOrder = 10;
  }

  applyNeighborVisual(mesh) {
    const material = mesh.material;
    const baseColor = mesh.userData?.baseColor ?? material.color.getHex();

    material.color.copy(brightenColor(baseColor, 0.22));
    material.emissive?.copy?.(new THREE.Color(NEIGHBOR_COLOR).multiplyScalar(0.28));
    applyMaterialOpacity(material, 0.96);
    mesh.scale.setScalar(NEIGHBOR_SCALE);
    mesh.renderOrder = 9;
  }

  buildSelectionOverlay(centerMesh, neighborRecords) {
    const centerPosition = getMeshLocalPosition(centerMesh);
    const centerParticle = this.crystal?.particles?.[centerMesh.userData?.particleIndex];
    const centerRadius = centerParticle?.radius ?? 0.14;
    const centerHalo = createHalo(
      centerPosition,
      centerRadius * 1.55,
      CENTER_COLOR,
      0.38
    );

    this.addAnimatedObject(centerHalo);

    neighborRecords.forEach((record) => {
      const radius = record.particle?.radius ?? 0.12;

      if (record.isAuxiliary) {
        this.addAnimatedObject(createAuxiliaryNeighborMesh(record));
      }

      this.addAnimatedObject(
        createHalo(
          record.position,
          radius * 1.38,
          record.isAuxiliary ? AUXILIARY_NEIGHBOR_COLOR : NEIGHBOR_COLOR,
          record.isAuxiliary ? 0.28 : 0.22
        )
      );

      const connection = createCylinderBetween(centerPosition, record.position, {
        color: CONNECTION_COLOR,
        radius: neighborRecords.length >= 10 ? 0.014 : 0.018,
        opacity: record.isAuxiliary ? 0.68 : 0.78,
        endpointInset: Math.min(centerRadius, radius) * 0.72
      });

      if (connection) {
        this.addAnimatedObject(connection);
      }
    });

    const shell = createCoordinationShell(neighborRecords);

    if (shell) {
      this.addAnimatedObject(shell);
    }
  }

  addAnimatedObject(object) {
    const materialTargets = getMaterialOpacityTargets(object);

    materialTargets.forEach(({ material }) => {
      material.opacity = 0;
      material.transparent = true;
      material.depthWrite = false;
    });

    object.scale.multiplyScalar(0.86);
    this.rootGroup.add(object);
    this.animatedEntries.push({
      object,
      materialTargets,
      startScale: object.scale.clone(),
      endScale: object.scale.clone().multiplyScalar(1 / 0.86),
      startedAt: performance.now(),
      duration: FADE_MS,
      mode: "in"
    });
  }

  fadeOutAndDispose(object) {
    this.animatedEntries = this.animatedEntries.filter(
      (entry) => entry.object !== object
    );
    const materialTargets = getMaterialOpacityTargets(object).map((target) => ({
      ...target,
      startOpacity: target.material.opacity ?? target.targetOpacity
    }));

    this.animatedEntries.push({
      object,
      materialTargets,
      startScale: object.scale.clone(),
      endScale: object.scale.clone().multiplyScalar(0.92),
      startedAt: performance.now(),
      duration: FADE_MS,
      mode: "out"
    });
  }

  update(now) {
    if (!this.animatedEntries.length) {
      return;
    }

    this.animatedEntries = this.animatedEntries.filter((entry) => {
      const progress = Math.min(1, (now - entry.startedAt) / entry.duration);
      const eased = 1 - (1 - progress) ** 3;

      entry.object.scale.lerpVectors(entry.startScale, entry.endScale, eased);
      entry.materialTargets.forEach((target) => {
        const startOpacity = entry.mode === "out" ? target.startOpacity : 0;
        const endOpacity = entry.mode === "out" ? 0 : target.targetOpacity;

        target.material.opacity = THREE.MathUtils.lerp(
          startOpacity,
          endOpacity,
          eased
        );
      });

      if (progress < 1) {
        return true;
      }

      if (entry.mode === "out") {
        entry.object.removeFromParent();
        disposeObjectTree(entry.object);
        entry.object.geometry?.dispose?.();
        disposeMaterial(entry.object.material);
      }

      return false;
    });
  }
}

namespace.AtomCoordinationRenderer = AtomCoordinationRenderer;
window.CrystalCellVisualizer = namespace;
})(window);
