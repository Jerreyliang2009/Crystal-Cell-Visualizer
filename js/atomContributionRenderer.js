(function (window) {
  "use strict";

const THREE = window.THREE;
const namespace = window.CrystalCellVisualizer || {};
const {
  createAtomContributionLabel,
  createFormulaLabel,
  createHoverHintLabel,
  disposeLabelSprite
} = namespace;

const FADE_MS = 260;
const GHOST_OPACITY = 0.12;
const EFFECTIVE_OPACITY = 0.98;
const EFFECTIVE_HALO_OPACITY = 0.36;
const CONNECTOR_OPACITY = 0.45;
const PULSE_SPEED = 0.006;
const EFFECTIVE_HALO_SCALE = 1.055;

function brightenColor(colorValue, amount = 0.26) {
  return new THREE.Color(colorValue).lerp(new THREE.Color(0xffffff), amount);
}

function makeEffectiveColor(colorValue) {
  return new THREE.Color(colorValue).offsetHSL(0, 0.1, 0.18);
}

function applyMaterialOpacity(material, opacity) {
  material.opacity = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = opacity >= 0.999;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  material?.map?.dispose?.();
  material?.dispose?.();
}

function getParticlePositionVector(particle) {
  return new THREE.Vector3(
    particle?.position?.x ?? 0,
    particle?.position?.y ?? 0,
    particle?.position?.z ?? 0
  );
}

function getMeshBaseColor(mesh) {
  return mesh.userData?.baseColor ?? mesh.material?.color?.getHex?.() ?? 0x7d8d99;
}

function getMeshDefaultOpacity(mesh) {
  return mesh.userData?.defaultOpacity ?? mesh.material?.opacity ?? 1;
}

function getCellFrameLocalBounds(cellFrame = {}) {
  if (
    cellFrame.shape === "hexagonal-prism" &&
    Array.isArray(cellFrame.baseVertices) &&
    cellFrame.baseVertices.length >= 3
  ) {
    const zMin =
      cellFrame.zMin ??
      (Number.isFinite(cellFrame.height) ? -cellFrame.height * 0.5 : -1);
    const zMax =
      cellFrame.zMax ??
      (Number.isFinite(cellFrame.height) ? cellFrame.height * 0.5 : 1);
    const bounds = new THREE.Box3();

    cellFrame.baseVertices.forEach((vertex) => {
      bounds.expandByPoint(new THREE.Vector3(vertex.x ?? 0, vertex.y ?? 0, zMin));
      bounds.expandByPoint(new THREE.Vector3(vertex.x ?? 0, vertex.y ?? 0, zMax));
    });

    return bounds;
  }

  const size = new THREE.Vector3(
    cellFrame?.size?.x ?? 2,
    cellFrame?.size?.y ?? 2,
    cellFrame?.size?.z ?? 2
  );
  const halfSize = size.multiplyScalar(0.5);

  return new THREE.Box3(halfSize.clone().multiplyScalar(-1), halfSize);
}

function buildBoxPlanes(cellFrame) {
  const bounds = getCellFrameLocalBounds(cellFrame);
  const min = bounds.min;
  const max = bounds.max;

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

function buildCellClippingPlanes(cellFrame, targetGroup) {
  const localPlanes = buildLocalClippingPlanes(cellFrame);

  targetGroup.updateMatrixWorld(true);

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(
    targetGroup.matrixWorld
  );

  return localPlanes.map((plane) =>
    plane.clone().applyMatrix4(targetGroup.matrixWorld, normalMatrix)
  );
}

function getReadableGroupLabel(group) {
  return group?.label?.replace(/\s*原子$/, "") || "原子";
}

function getContributionText(group) {
  return group?.contributionText || group?.contributionLabel || "";
}

function getFormulaText(group) {
  return group?.formulaText || group?.equation || "";
}

function getTotalContribution(group) {
  return group?.totalContribution ?? group?.total ?? 0;
}

class AtomContributionRenderer {
  constructor({ attachTarget }) {
    this.attachTarget = attachTarget;
    this.rootGroup = null;
    this.crystal = null;
    this.particleMeshesByIndex = [];
    this.selectedMesh = null;
    this.selectedGroup = null;
    this.hoverMesh = null;
    this.selectionEntries = [];
    this.hoverEntries = [];
    this.animatedEntries = [];
    this.selectedEffectiveVisualGroup = null;
    this.overlayGeometries = new Set();
    this.lastUpdateAt = 0;
  }

  rebuild(crystal, particleMeshesByIndex = []) {
    this.clear({ immediate: true });
    this.crystal = crystal;
    this.particleMeshesByIndex = particleMeshesByIndex;

    if (!this.attachTarget) {
      return;
    }

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = `${crystal?.id ?? "crystal"}-atom-contribution-root`;
    this.rootGroup.visible = true;
    this.rootGroup.userData = {
      includeInFrame: false
    };
    this.attachTarget.add(this.rootGroup);
  }

  clear({ immediate = true } = {}) {
    this.clearHover({ immediate });
    this.clearSelection({ immediate });
    this.restoreAllAtomVisuals();

    if (immediate) {
      this.animatedEntries.forEach((entry) => this.disposeAnimatedEntry(entry));
      this.animatedEntries = [];
    }

    this.overlayGeometries.forEach((geometry) => geometry.dispose?.());
    this.overlayGeometries.clear();

    if (this.rootGroup?.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }

    this.rootGroup = null;
    this.crystal = null;
    this.particleMeshesByIndex = [];
    this.selectedMesh = null;
    this.selectedGroup = null;
    this.hoverMesh = null;
    this.selectedEffectiveVisualGroup = null;
    this.lastUpdateAt = 0;
  }

  dispose() {
    this.clear({ immediate: true });
  }

  getGroupById(groupId) {
    return (
      this.crystal?.effectiveAtomCounting?.groups?.find(
        (group) => group.id === groupId
      ) ?? null
    );
  }

  getSelectableMeshes() {
    return this.particleMeshesByIndex.filter(
      (mesh) => mesh?.userData?.selectable && mesh.visible !== false
    );
  }

  getGroupMeshes(group) {
    return (group?.atomRefs ?? [])
      .map((atomRef) => this.particleMeshesByIndex[atomRef])
      .filter(Boolean);
  }

  getGroupCenter(group) {
    const groupMeshes = this.getGroupMeshes(group);

    if (!groupMeshes.length) {
      return new THREE.Vector3();
    }

    return groupMeshes
      .reduce((result, mesh) => result.add(mesh.position), new THREE.Vector3())
      .multiplyScalar(1 / groupMeshes.length);
  }

  getLabelPositionForMesh(mesh, group) {
    const bounds = getCellFrameLocalBounds(this.crystal?.cellFrame);
    const cellCenter = bounds.getCenter(new THREE.Vector3());
    const direction = mesh.position.clone().sub(cellCenter);
    const radius = this.crystal?.particles?.[mesh.userData?.particleIndex]?.radius ?? 0.16;

    if (direction.lengthSq() <= 1e-6) {
      direction.set(0.58, 0.36, 0.74);
    }

    direction.normalize();

    if (group?.positionType?.startsWith("hcp")) {
      direction.z += 0.18;
      direction.normalize();
    }

    return mesh.position
      .clone()
      .addScaledVector(direction, radius + 0.2)
      .add(new THREE.Vector3(0, 0, 0.04));
  }

  getFormulaPosition(selectedMesh, group) {
    const bounds = getCellFrameLocalBounds(this.crystal?.cellFrame);
    const cellCenter = bounds.getCenter(new THREE.Vector3());
    const selectedPosition = selectedMesh?.position ?? this.getGroupCenter(group);
    const outward = selectedPosition.clone().sub(cellCenter);
    const cellSize = bounds.getSize(new THREE.Vector3());
    const offsetScale = Math.max(cellSize.x, cellSize.y, cellSize.z) * 0.24;

    if (outward.lengthSq() <= 1e-6) {
      outward.set(0.8, 0.46, 0.64);
    }

    outward.normalize();

    return selectedPosition
      .clone()
      .addScaledVector(outward, offsetScale)
      .add(new THREE.Vector3(0, 0, Math.max(0.18, cellSize.z * 0.08)));
  }

  addAnimatedObject(object, {
    target = 1,
    initial = 0,
    dispose,
    materialOpacity = null
  } = {}) {
    const materials = [];

    object.traverse?.((child) => {
      if (!child.material) {
        return;
      }

      const materialList = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materialList.forEach((material) => {
        const maxOpacity = materialOpacity?.get?.(material) ?? material.opacity ?? 1;

        material.transparent = true;
        material.opacity = maxOpacity * initial;
        materials.push({
          material,
          maxOpacity
        });
      });
    });

    if (!object.traverse && object.material) {
      const materialList = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materialList.forEach((material) => {
        const maxOpacity = materialOpacity?.get?.(material) ?? material.opacity ?? 1;

        material.transparent = true;
        material.opacity = maxOpacity * initial;
        materials.push({
          material,
          maxOpacity
        });
      });
    }

    const entry = {
      object,
      materials,
      opacity: initial,
      target,
      dispose
    };

    this.animatedEntries.push(entry);

    return entry;
  }

  fadeOutEntries(entries, { immediate = false } = {}) {
    entries.forEach((entry) => {
      if (immediate) {
        this.disposeAnimatedEntry(entry);
        return;
      }

      entry.target = 0;
    });

    if (immediate && entries.length) {
      const entrySet = new Set(entries);

      this.animatedEntries = this.animatedEntries.filter(
        (entry) => !entrySet.has(entry)
      );
    }
  }

  disposeAnimatedEntry(entry) {
    if (!entry) {
      return;
    }

    if (entry.object?.parent) {
      entry.object.parent.remove(entry.object);
    }

    entry.dispose?.();
  }

  clearSelectedAtomEffectivePart({ immediate = false } = {}) {
    const effectiveEntries = this.selectionEntries.filter(
      (entry) => entry.object?.userData?.atomContributionRole === "selectedEffectiveVisualGroup"
    );

    this.fadeOutEntries(effectiveEntries, { immediate });
    this.selectionEntries = this.selectionEntries.filter(
      (entry) => !effectiveEntries.includes(entry)
    );
    this.selectedEffectiveVisualGroup = null;
  }

  clearSelection({ immediate = false } = {}) {
    this.clearSelectedAtomEffectivePart({ immediate });
    this.fadeOutEntries(this.selectionEntries, { immediate });
    this.selectionEntries = [];
    this.selectedMesh = null;
    this.selectedGroup = null;
    this.restoreDefaultVisualState();
  }

  clearHover({ immediate = false } = {}) {
    this.fadeOutEntries(this.hoverEntries, { immediate });
    this.hoverEntries = [];
    this.hoverMesh = null;
    this.applyAtomVisualState();
  }

  restoreMeshToBase(mesh) {
    if (!mesh?.material) {
      return;
    }

    const material = mesh.material;

    material.color.setHex(getMeshBaseColor(mesh));
    material.emissive?.setHex?.(0x000000);
    applyMaterialOpacity(material, getMeshDefaultOpacity(mesh));
    mesh.scale.setScalar(1);
    mesh.renderOrder = mesh.userData?.baseRenderOrder ?? 2;
  }

  restoreDefaultVisualState() {
    this.getSelectableMeshes().forEach((mesh) => this.restoreMeshToBase(mesh));
  }

  restoreAllAtomVisuals() {
    this.restoreDefaultVisualState();
  }

  applyAtomVisualState() {
    this.restoreAllAtomVisuals();

    const selectedGroup = this.selectedGroup;
    const selectedMesh = this.selectedMesh;
    const hoverMesh = this.hoverMesh;

    if (selectedGroup) {
      const groupMeshes = new Set(this.getGroupMeshes(selectedGroup));
      const accentColor = selectedGroup.emphasisColor ?? getMeshBaseColor(selectedMesh);
      const focusColor = brightenColor(accentColor, 0.36);

      this.getSelectableMeshes().forEach((mesh) => {
        if (groupMeshes.has(mesh)) {
          const material = mesh.material;
          const baseColor = new THREE.Color(getMeshBaseColor(mesh));
          const highlightColor = brightenColor(accentColor, 0.28);
          const isSelected = mesh === selectedMesh;

          if (isSelected) {
            material.color.copy(baseColor.lerp(focusColor, 0.18));
            material.emissive?.copy?.(focusColor.clone().multiplyScalar(0.1));
            applyMaterialOpacity(material, 0.18);
            mesh.scale.setScalar(1);
            mesh.renderOrder = 15;
            return;
          }

          material.color.copy(baseColor.lerp(highlightColor, 0.34));
          material.emissive?.copy?.(highlightColor.clone().multiplyScalar(0.16));
          applyMaterialOpacity(material, 0.78);
          mesh.scale.setScalar(1.04);
          mesh.renderOrder = 14;
          return;
        }

        const dimColor = new THREE.Color(getMeshBaseColor(mesh)).lerp(
          new THREE.Color(0xdce3e8),
          0.62
        );

        mesh.material.color.copy(dimColor);
        mesh.material.emissive?.setHex?.(0x000000);
        applyMaterialOpacity(mesh.material, Math.max(0.08, getMeshDefaultOpacity(mesh) * 0.24));
        mesh.renderOrder = mesh.userData?.baseRenderOrder ?? 2;
      });
    }

    if (hoverMesh && hoverMesh !== selectedMesh) {
      const material = hoverMesh.material;
      const hoverColor = brightenColor(getMeshBaseColor(hoverMesh), 0.38);

      material.color.copy(hoverColor);
      material.emissive?.copy?.(hoverColor.clone().multiplyScalar(0.2));
      applyMaterialOpacity(material, 1);
      hoverMesh.scale.setScalar(selectedGroup ? 1.1 : 1.07);
      hoverMesh.renderOrder = 17;
    }
  }

  createSelectionLabels(group, selectedMesh) {
    const text = getContributionText(group);
    const entries = [];

    this.getGroupMeshes(group).forEach((mesh) => {
      const label = createAtomContributionLabel({
        text,
        color: getMeshBaseColor(mesh)
      });

      label.position.copy(this.getLabelPositionForMesh(mesh, group));
      this.rootGroup.add(label);
      entries.push(
        this.addAnimatedObject(label, {
          dispose: () => disposeLabelSprite(label)
        })
      );
    });

    const formulaText = getFormulaText(group);

    if (formulaText) {
      const formulaLabel = createFormulaLabel({
        text: formulaText,
        color: getMeshBaseColor(selectedMesh)
      });
      const formulaPosition = this.getFormulaPosition(selectedMesh, group);
      const selectedPosition = selectedMesh.position.clone();
      const connectorGeometry = new THREE.BufferGeometry().setFromPoints([
        selectedPosition,
        formulaPosition
      ]);
      const connectorMaterial = new THREE.LineBasicMaterial({
        color: brightenColor(getMeshBaseColor(selectedMesh), 0.1),
        transparent: true,
        opacity: CONNECTOR_OPACITY,
        depthTest: false,
        depthWrite: false
      });
      const connector = new THREE.Line(connectorGeometry, connectorMaterial);

      connector.renderOrder = 25;
      connector.userData = {
        includeInFrame: false
      };
      formulaLabel.position.copy(formulaPosition);
      this.rootGroup.add(connector);
      this.rootGroup.add(formulaLabel);
      this.overlayGeometries.add(connectorGeometry);
      entries.push(
        this.addAnimatedObject(connector, {
          dispose: () => {
            connectorGeometry.dispose();
            connectorMaterial.dispose();
            this.overlayGeometries.delete(connectorGeometry);
          }
        }),
        this.addAnimatedObject(formulaLabel, {
          dispose: () => disposeLabelSprite(formulaLabel)
        })
      );
    }

    return entries;
  }

  createEffectivePartHalo({ geometry, materialColor, clippingPlanes }) {
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: materialColor,
      transparent: true,
      opacity: EFFECTIVE_HALO_OPACITY,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      clippingPlanes,
      clipShadows: false
    });
    const haloMesh = new THREE.Mesh(geometry, haloMaterial);

    haloMesh.scale.setScalar(EFFECTIVE_HALO_SCALE);
    haloMesh.renderOrder = 29;
    haloMesh.userData = {
      includeInFrame: false,
      atomContributionOverlay: true,
      layer: "effectivePartHalo"
    };

    return {
      haloMesh,
      haloMaterial
    };
  }

  showSelectedAtomEffectivePart(atomMesh, group) {
    const selectedMesh = atomMesh;
    const particle = this.crystal?.particles?.[selectedMesh.userData?.particleIndex];

    if (!particle) {
      return null;
    }

    this.clearSelectedAtomEffectivePart();

    const visualGroup = new THREE.Group();
    const geometry = new THREE.SphereGeometry(particle.radius, 48, 40);
    const clippingPlanes = buildCellClippingPlanes(
      this.crystal.cellFrame,
      this.attachTarget
    );
    const ghostMaterial = new THREE.MeshPhongMaterial({
      color: particle.color,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthWrite: false,
      shininess: 45
    });
    const effectiveColor = makeEffectiveColor(particle.color);
    const effectiveMaterial = new THREE.MeshPhongMaterial({
      color: effectiveColor,
      emissive: effectiveColor.clone().multiplyScalar(0.54),
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: EFFECTIVE_OPACITY,
      depthWrite: false,
      depthTest: true,
      shininess: 120,
      side: THREE.DoubleSide,
      clippingPlanes,
      clipShadows: false
    });
    const ghostMesh = new THREE.Mesh(geometry, ghostMaterial);
    const effectiveMesh = new THREE.Mesh(geometry, effectiveMaterial);
    const { haloMesh, haloMaterial } = this.createEffectivePartHalo({
      geometry,
      materialColor: effectiveColor,
      clippingPlanes
    });
    const position = getParticlePositionVector(particle);
    const metadata = {
      includeInFrame: false,
      atomContributionOverlay: true,
      groupId: group.id,
      atomId: selectedMesh.userData.atomId,
      species: selectedMesh.userData.species,
      positionType: selectedMesh.userData.positionType,
      contribution: selectedMesh.userData.contribution,
      contributionText: getContributionText(group),
      totalContribution: getTotalContribution(group)
    };

    ghostMesh.position.copy(position);
    effectiveMesh.position.copy(position);
    haloMesh.position.copy(position);
    ghostMesh.renderOrder = 23;
    effectiveMesh.renderOrder = 30;
    visualGroup.name = `selected-effective-${selectedMesh.userData.atomId ?? "atom"}`;
    visualGroup.userData = {
      includeInFrame: false,
      atomContributionOverlay: true,
      atomContributionRole: "selectedEffectiveVisualGroup"
    };
    ghostMesh.userData = {
      ...ghostMesh.userData,
      ...metadata,
      layer: "ghostAtom"
    };
    effectiveMesh.userData = {
      ...effectiveMesh.userData,
      ...metadata,
      layer: "effectivePart"
    };
    haloMesh.userData = {
      ...haloMesh.userData,
      ...metadata,
      layer: "effectivePartHalo"
    };
    visualGroup.add(ghostMesh);
    visualGroup.add(haloMesh);
    visualGroup.add(effectiveMesh);
    this.rootGroup.add(visualGroup);
    this.selectedEffectiveVisualGroup = visualGroup;
    this.overlayGeometries.add(geometry);

    return this.addAnimatedObject(visualGroup, {
      target: 1,
      initial: 0,
      dispose: () => {
        geometry.dispose();
        ghostMaterial.dispose();
        effectiveMaterial.dispose();
        haloMaterial.dispose();
        this.overlayGeometries.delete(geometry);
      }
    });
  }

  createSelectedAtomContributionMeshes(group, selectedMesh) {
    const effectiveEntry = this.showSelectedAtomEffectivePart(selectedMesh, group);

    return effectiveEntry ? [effectiveEntry] : [];
  }

  selectAtom(mesh) {
    if (!mesh?.userData?.selectable) {
      this.clearSelection();
      return null;
    }

    const group = this.getGroupById(mesh.userData.groupId);

    if (!group) {
      this.clearSelection();
      return null;
    }

    this.clearSelection();
    this.selectedMesh = mesh;
    this.selectedGroup = group;
    this.selectionEntries = [
      ...this.createSelectionLabels(group, mesh),
      ...this.createSelectedAtomContributionMeshes(group, mesh)
    ];
    this.applyAtomVisualState();

    return group;
  }

  setHoverAtom(mesh) {
    const normalizedMesh = mesh?.userData?.selectable ? mesh : null;

    if (this.hoverMesh === normalizedMesh) {
      return;
    }

    this.clearHover();
    this.hoverMesh = normalizedMesh;

    if (normalizedMesh) {
      const group = this.getGroupById(normalizedMesh.userData.groupId);

      if (group) {
        const hintLabel = createHoverHintLabel({
          text: `${getReadableGroupLabel(group)} · ${getContributionText(group)}`,
          color: getMeshBaseColor(normalizedMesh)
        });

        hintLabel.position.copy(this.getLabelPositionForMesh(normalizedMesh, group));
        hintLabel.position.add(new THREE.Vector3(0, 0, 0.14));
        this.rootGroup?.add(hintLabel);
        this.hoverEntries = [
          this.addAnimatedObject(hintLabel, {
            dispose: () => disposeLabelSprite(hintLabel)
          })
        ];
      }
    }

    this.applyAtomVisualState();
  }

  clearInteraction({ immediate = false } = {}) {
    this.clearHover({ immediate });
    this.clearSelection({ immediate });
  }

  update(now) {
    const deltaMs = this.lastUpdateAt
      ? Math.min(48, Math.max(0, now - this.lastUpdateAt))
      : 16;
    this.lastUpdateAt = now;

    const fadeStep = Math.min(1, deltaMs / FADE_MS);

    this.animatedEntries = this.animatedEntries.filter((entry) => {
      entry.opacity = THREE.MathUtils.lerp(entry.opacity, entry.target, fadeStep);

      if (Math.abs(entry.opacity - entry.target) <= 0.01) {
        entry.opacity = entry.target;
      }

      entry.materials.forEach(({ material, maxOpacity }) => {
        material.opacity = maxOpacity * entry.opacity;
      });

      if (entry.target <= 0 && entry.opacity <= 0.01) {
        this.disposeAnimatedEntry(entry);
        return false;
      }

      return true;
    });

    if (!this.selectedGroup) {
      return;
    }

    const groupMeshes = this.getGroupMeshes(this.selectedGroup);

    groupMeshes.forEach((mesh, index) => {
      const isSelected = mesh === this.selectedMesh;
      const baseScale = isSelected ? 1 : 1.04;
      const pulse = isSelected
        ? 0
        : Math.sin(now * PULSE_SPEED + index * 0.55) * 0.018;

      mesh.scale.setScalar(baseScale + pulse);
    });
  }
}

namespace.AtomContributionRenderer = AtomContributionRenderer;
window.CrystalCellVisualizer = namespace;
})(window);
