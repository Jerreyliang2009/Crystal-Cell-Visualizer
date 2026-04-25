const defaultBoxFrame = {
  shape: "box",
  size: { x: 2, y: 2, z: 2 },
  edgeColor: 0x1f4f74,
  edgeOpacity: 1,
  fillColor: 0xa7c7dc,
  fillOpacity: 0.05
};

const particlePalette = {
  demo: 0x4f9fd4,
  sodium: 0xf0a45d,
  chloride: 0x73bb7f,
  cesium: 0xf4c75a,
  carbon: 0x606a73,
  carbonAuxiliary: 0x9aa5ae,
  metal: 0x7d8d99,
  metalLight: 0x9fb0bc,
  hcp: 0x7b9d8c,
  bond: 0x71808c,
  bondAuxiliary: 0xa0adb7,
  coordinationCenter: 0xe6a24f,
  coordinationNeighbor: 0xf1c47d,
  coordinationConnection: 0xd58327,
  coordinationShell: 0xedb867
};

const diamondNearestNeighborDistance = Math.sqrt(3) / 4;
const diamondNeighborTolerance = 1e-5;

const diamondFccSites = [
  [0, 0, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
  [0.5, 0.5, 0]
];

const diamondBasisShiftedSites = [
  [0.25, 0.25, 0.25],
  [0.25, 0.75, 0.75],
  [0.75, 0.25, 0.75],
  [0.75, 0.75, 0.25]
];

const rockSaltAnionSites = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
  [0.5, 0.5, 0],
  [0.5, 0.5, 1],
  [0.5, 0, 0.5],
  [0.5, 1, 0.5],
  [0, 0.5, 0.5],
  [1, 0.5, 0.5]
];

const rockSaltCationSites = [
  [0.5, 0, 0],
  [0.5, 1, 0],
  [0.5, 0, 1],
  [0.5, 1, 1],
  [0, 0.5, 0],
  [1, 0.5, 0],
  [0, 0.5, 1],
  [1, 0.5, 1],
  [0, 0, 0.5],
  [1, 0, 0.5],
  [0, 1, 0.5],
  [1, 1, 0.5],
  [0.5, 0.5, 0.5]
];

const csclCornerSites = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1]
];

const bccCornerSites = [...csclCornerSites];
const hcpCoordinationTolerance = 1e-4;
const hcpNearestNeighborDistance = 1;
const hcpIdealCRatio = Math.sqrt(8 / 3);
const hcpHalfHeight = hcpIdealCRatio / 2;
const hcpPrimitiveVectors = [
  [hcpNearestNeighborDistance, 0, 0],
  [hcpNearestNeighborDistance / 2, (Math.sqrt(3) * hcpNearestNeighborDistance) / 2, 0],
  [0, 0, hcpIdealCRatio]
];
const hcpBasisSites = [
  [0, 0, -hcpHalfHeight],
  [hcpNearestNeighborDistance / 2, hcpNearestNeighborDistance / (2 * Math.sqrt(3)), 0]
];
function createRegularPolygonVertices(sideCount, circumradius, angleOffset = 0) {
  return Array.from({ length: sideCount }, (_, index) => {
    const angle = angleOffset + (Math.PI * 2 * index) / sideCount;

    return [
      circumradius * Math.cos(angle),
      circumradius * Math.sin(angle)
    ];
  });
}

const hcpHexagonVertices = createRegularPolygonVertices(
  6,
  hcpNearestNeighborDistance
);

function createHcpCellGeometry() {
  const baseVertices = hcpHexagonVertices.map(([x, y]) => [x, y]);
  const zMin = -hcpHalfHeight;
  const zMax = hcpHalfHeight;
  const bottomFacePoints = [[0, 0, zMin], ...baseVertices.map(([x, y]) => [x, y, zMin])];
  const topFacePoints = [[0, 0, zMax], ...baseVertices.map(([x, y]) => [x, y, zMax])];
  const middleLayerPoints = [
    hcpBasisSites[1],
    addPoint(hcpBasisSites[1], scalePoint(hcpPrimitiveVectors[0], -1)),
    addPoint(hcpBasisSites[1], scalePoint(hcpPrimitiveVectors[1], -1))
  ].sort(compareFractionalPoints);

  return {
    a: hcpNearestNeighborDistance,
    c: hcpIdealCRatio,
    zMin,
    zMax,
    baseVertices,
    bottomFacePoints,
    topFacePoints,
    middleLayerPoints
  };
}

const hcpCellGeometry = createHcpCellGeometry();

export const axisConvention = {
  id: "crystal-standard-xyz",
  label: "统一晶胞科学坐标",
  summary:
    "所有晶胞先按统一科学坐标构建，再统一映射到 three.js 世界坐标中显示。",
  axes: {
    x: {
      label: "X",
      vector: { x: 1, y: 0, z: 0 },
      description: "屏幕靠近观察者"
    },
    y: {
      label: "Y",
      vector: { x: 0, y: 1, z: 0 },
      description: "页面水平向右"
    },
    z: {
      label: "Z",
      vector: { x: 0, y: 0, z: 1 },
      description: "页面竖直向上"
    }
  },
  screenMapping: {
    depthToward: "+X",
    depthAway: "-X",
    right: "+Y",
    up: "+Z"
  },
  threeJsBridgeBasis: {
    xAxis: { x: 0, y: 0, z: 1 },
    yAxis: { x: 1, y: 0, z: 0 },
    zAxis: { x: 0, y: 1, z: 0 }
  }
};

export const standardViewDirections = {
  default: {
    id: "default",
    label: "默认展示视角",
    description: "使用当前晶胞的推荐展示视角。"
  },
  front: {
    id: "front",
    label: "正视图",
    direction: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    distanceScale: 2.02,
    description: "沿 +X 方向观察，页面中 Y 向右、Z 向上。"
  },
  side: {
    id: "side",
    label: "侧视图",
    direction: { x: 0, y: 1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    distanceScale: 2.02,
    description: "沿 +Y 方向观察，页面中 X 的投影向右、Z 向上。"
  },
  sideEdge: {
    id: "side-edge",
    label: "侧棱观测",
    direction: { x: 1, y: 1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    targetOffset: { x: 1, y: 1, z: 0 },
    distanceScale: 2.34,
    description:
      "沿 +X 与 +Y 的水平角平分方向观察，并以位于 +X/+Y 象限的一条竖直侧棱中点为视线中心；Z 保持向上。"
  },
  top: {
    id: "top",
    label: "俯视图",
    direction: { x: 0, y: 0, z: 1 },
    up: { x: -1, y: 0, z: 0 },
    distanceScale: 2.08,
    description: "沿 +Z 方向观察；对 HCP 而言就是沿 c 轴俯视，页面右侧为 +Y。"
  },
  isometric: {
    id: "isometric",
    label: "等轴测视图",
    direction: { x: 1.45, y: 1.55, z: 1.18 },
    up: { x: 0, y: 0, z: 1 },
    distanceScale: 2.16,
    description: "兼顾三个主轴的立体标准视图，便于比赛演示。"
  },
  diagonal: {
    id: "diagonal",
    label: "对角线视图",
    direction: { x: 1, y: 1, z: 1 },
    up: { x: 0, y: 0, z: 1 },
    distanceScale: 2.12,
    description: "沿空间对角线方向观察，适合突出体心或四面体网络。"
  }
};

const defaultCrystalOrientation = {
  rotation: { x: 0, y: 0, z: 0 }
};

function cloneVectorConfig(vector, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: vector?.x ?? fallback.x,
    y: vector?.y ?? fallback.y,
    z: vector?.z ?? fallback.z
  };
}

function normalizeCrystalOrientation(orientation) {
  return {
    rotation: cloneVectorConfig(
      orientation?.rotation ?? orientation,
      defaultCrystalOrientation.rotation
    )
  };
}

function normalizeDefaultView(view) {
  const baseView = view ?? {};

  return {
    viewId: baseView.viewId ?? baseView.id ?? "isometric",
    direction: baseView.direction ? cloneVectorConfig(baseView.direction) : null,
    up: baseView.up ? cloneVectorConfig(baseView.up) : null,
    targetOffset: baseView.targetOffset
      ? cloneVectorConfig(baseView.targetOffset)
      : null,
    distanceScale:
      Number.isFinite(baseView.distanceScale) ? baseView.distanceScale : null,
    description: baseView.description ?? "",
    rationale: baseView.rationale ?? ""
  };
}

function toCenteredPosition([x, y, z]) {
  return {
    x: (x - 0.5) * 2,
    y: (y - 0.5) * 2,
    z: (z - 0.5) * 2
  };
}

function pointKey(point) {
  return point.map((value) => value.toFixed(6)).join(",");
}

function compareFractionalPoints(a, b) {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }

  if (a[1] !== b[1]) {
    return a[1] - b[1];
  }

  return a[2] - b[2];
}

function addPoint(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scalePoint(point, scalar) {
  return [point[0] * scalar, point[1] * scalar, point[2] * scalar];
}

function combineTranslations(vectors, coefficients) {
  return vectors.reduce(
    (result, vector, index) =>
      addPoint(result, scalePoint(vector, coefficients[index] ?? 0)),
    [0, 0, 0]
  );
}

function toPointArray(position) {
  if (Array.isArray(position)) {
    return [...position];
  }

  return [position.x, position.y, position.z];
}

function toPositionObject(position) {
  return {
    x: position[0],
    y: position[1],
    z: position[2]
  };
}

function distanceSquared(a, b) {
  return (
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

function isPointInsideOrOnCell(point, epsilon = 1e-6) {
  return point.every((value) => value >= -epsilon && value <= 1 + epsilon);
}

function normalizeStringArray(values) {
  return (values ?? []).filter(Boolean);
}

function normalizeRuleArray(values) {
  return (values ?? []).map((value) => ({
    site: value.site ?? "",
    particles: value.particles ?? "",
    equation: value.equation ?? "",
    note: value.note ?? ""
  }));
}

function normalizeCountArray(values) {
  return (values ?? []).map((value) => ({
    label: value.label ?? "",
    value: value.value ?? ""
  }));
}

function normalizeAtomLegendArray(values) {
  return (values ?? [])
    .map((value) => ({
      label: value.label ?? value.name ?? "",
      color: value.color,
      note: value.note ?? ""
    }))
    .filter((value) => value.label);
}

function createParticle({
  position,
  radius,
  color,
  label,
  category,
  opacity = 1,
  visible = true,
  includeInFrame = true,
  metadata = {}
}) {
  return {
    position,
    radius,
    color,
    label,
    category,
    opacity,
    visible,
    includeInFrame,
    metadata
  };
}

function createParticlesFromFractional(points, config) {
  return points.map((point, index) =>
    createParticle({
      ...config,
      position: toCenteredPosition(point),
      label:
        typeof config.label === "function"
          ? config.label(index, point)
          : config.label,
      metadata: {
        ...config.metadata,
        fractionalPosition: point
      }
    })
  );
}

function createParticlesFromCartesian(points, config) {
  return points.map((point, index) =>
    createParticle({
      ...config,
      position: toPositionObject(point),
      label:
        typeof config.label === "function"
          ? config.label(index, point)
          : config.label,
      metadata: {
        ...config.metadata,
        cartesianPosition: [...point]
      }
    })
  );
}

function createConnection(from, to, config = {}) {
  return {
    from,
    to,
    start: config.start ? { ...config.start } : null,
    end: config.end ? { ...config.end } : null,
    color: config.color ?? particlePalette.bond,
    radius: config.radius ?? 0.035,
    opacity: config.opacity ?? 1,
    endpointInset: config.endpointInset ?? 0,
    includeInFrame: config.includeInFrame ?? true,
    metadata: config.metadata ?? {}
  };
}

function createCoordinationDisplay({
  coordinationType,
  coordinationNumber,
  coordinationRenderMode,
  coordinationLabel,
  coordinationDescription,
  coordinationCenters,
  style = {}
}) {
  const normalizedCenters = (coordinationCenters ?? []).map((center) => ({
    particleIndex: center.particleIndex,
    neighborParticleIndices: center.neighborParticleIndices ?? [],
    connectionPairs: center.connectionPairs ?? [],
    polyhedronFaces: center.polyhedronFaces ?? [],
    renderMode: center.renderMode ?? coordinationRenderMode,
    label: center.label ?? coordinationLabel,
    labelOffset: center.labelOffset ?? { x: 0.18, y: 0.24, z: 0.18 },
    centerScale: center.centerScale ?? 1.28,
    neighborScale: center.neighborScale ?? 1.18
  }));

  return {
    coordinationType,
    coordinationNumber,
    coordinationRenderMode,
    coordinationLabel,
    coordinationDescription,
    coordinationCenters: normalizedCenters,
    coordinationNeighbors:
      normalizedCenters[0]?.neighborParticleIndices?.slice() ?? [],
    style: {
      centerColor: style.centerColor ?? particlePalette.coordinationCenter,
      neighborColor: style.neighborColor ?? particlePalette.coordinationNeighbor,
      connectionColor:
        style.connectionColor ?? particlePalette.coordinationConnection,
      polyhedronColor: style.polyhedronColor ?? particlePalette.coordinationShell,
      labelColor: style.labelColor ?? "#173047"
    }
  };
}

function normalizeCoordinationTranslationVectors(vectors) {
  return (vectors ?? []).map((vector) => {
    if (Array.isArray(vector)) {
      return { x: vector[0] ?? 0, y: vector[1] ?? 0, z: vector[2] ?? 0 };
    }

    return {
      x: vector?.x ?? 0,
      y: vector?.y ?? 0,
      z: vector?.z ?? 0
    };
  });
}

function createBoxCoordinationTranslationVectors(cellFrame = defaultBoxFrame) {
  const size = cellFrame.size ?? defaultBoxFrame.size;

  return [
    { x: size.x ?? 2, y: 0, z: 0 },
    { x: 0, y: size.y ?? 2, z: 0 },
    { x: 0, y: 0, z: size.z ?? 2 }
  ];
}

function createCoordinationRule(ruleConfig, entry = {}, coordinationDisplay = null) {
  if (!ruleConfig && !coordinationDisplay) {
    return null;
  }

  const rule = ruleConfig ?? {};
  const cellFrame = {
    ...defaultBoxFrame,
    ...(entry.cellFrame ?? {})
  };
  const rawTranslationVectors =
    rule.translationVectors ??
    (cellFrame.shape === "box"
      ? createBoxCoordinationTranslationVectors(cellFrame)
      : []);

  return {
    type: rule.type ?? "nearest-neighbor-shell",
    coordinationNumber:
      rule.coordinationNumber ??
      entry.coordinationNumber ??
      coordinationDisplay?.coordinationNumber ??
      null,
    translationVectors: normalizeCoordinationTranslationVectors(
      rawTranslationVectors
    ),
    searchRange: rule.searchRange ?? rule.maxSearchRange ?? 1,
    tolerance: rule.tolerance ?? rule.distanceTolerance ?? hcpCoordinationTolerance,
    relativeTolerance: rule.relativeTolerance ?? 0.025,
    nearestNeighborDistance:
      rule.nearestNeighborDistance ?? entry.nearestNeighborDistance ?? null,
    explanation:
      rule.explanation ??
      entry.coordinationInfo?.summary ??
      entry.coordinationDescription ??
      coordinationDisplay?.coordinationDescription ??
      "该原子周围最近邻原子构成其配位环境。"
  };
}

function createCoordinationInfo(info = {}) {
  return {
    title: info.title ?? "",
    summary: info.summary ?? ""
  };
}

function createCountingInfo(info = {}) {
  return {
    countingTitle: info.countingTitle ?? "",
    countingSummary: info.countingSummary ?? "",
    equivalentContributionRules: normalizeRuleArray(
      info.equivalentContributionRules
    ),
    finalParticleCount: normalizeCountArray(info.finalParticleCount),
    formulaConclusion: info.formulaConclusion ?? ""
  };
}

function formatContributionFraction(value) {
  const knownFractions = [
    [1, "1"],
    [1 / 2, "1/2"],
    [1 / 4, "1/4"],
    [1 / 6, "1/6"],
    [1 / 8, "1/8"]
  ];
  const match = knownFractions.find(
    ([candidate]) => Math.abs(candidate - value) <= 1e-6
  );

  if (match) {
    return match[1];
  }

  if (Math.abs(value - Math.round(value)) <= 1e-6) {
    return String(Math.round(value));
  }

  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatEffectiveCountValue(value) {
  if (Math.abs(value - Math.round(value)) <= 1e-6) {
    return String(Math.round(value));
  }

  return formatContributionFraction(value);
}

function createEffectiveAtomGroup(group = {}) {
  const atomRefs = normalizeStringArray(
    (group.atomRefs ?? []).map((value) => String(value))
  )
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value));
  const count = Number.isFinite(group.count) ? group.count : atomRefs.length;
  const contribution = Number.isFinite(group.contribution)
    ? group.contribution
    : 0;
  const totalContribution = Number.isFinite(group.totalContribution)
    ? group.totalContribution
    : Number.isFinite(group.total)
      ? group.total
      : count * contribution;
  const contributionText =
    group.contributionText ??
    group.contributionLabel ??
    formatContributionFraction(contribution);
  const totalLabel =
    group.totalLabel ?? formatEffectiveCountValue(totalContribution);
  const formulaText =
    group.formulaText ??
    group.equation ??
    `${count} × ${contributionText} = ${totalLabel}`;
  const atomIds = Array.isArray(group.atomIds) && group.atomIds.length
    ? group.atomIds.map((value) => String(value))
    : atomRefs.map((atomRef, index) => `${group.id ?? "effective"}-atom-${atomRef}-${index}`);
  const sharedBy = Number.isFinite(group.sharedBy)
    ? group.sharedBy
    : contribution > 0
      ? Math.round(1 / contribution)
      : 0;

  return {
    id: group.id ?? "",
    label: group.label ?? "",
    species: group.species ?? "",
    speciesLabel: group.speciesLabel ?? group.species ?? "",
    count,
    contribution,
    contributionText,
    contributionLabel: contributionText,
    sharedBy,
    totalContribution,
    total: totalContribution,
    totalLabel,
    formulaText,
    equation: formulaText,
    positionType: group.positionType ?? "",
    atomIds,
    atomRefs,
    explanation: group.explanation ?? "",
    emphasisColor: group.emphasisColor ?? null
  };
}

function createEffectiveAtomCounting(config = {}) {
  const groups = (config.groups ?? []).map(createEffectiveAtomGroup);
  const derivedTotals = {};

  groups.forEach((group) => {
    if (!group.species) {
      return;
    }

    derivedTotals[group.species] =
      (derivedTotals[group.species] ?? 0) + group.total;
  });

  return {
    enabled: config.enabled !== false,
    title: config.title ?? "有效原子示意",
    summary: config.summary ?? "",
    shortConclusion: config.shortConclusion ?? "",
    formula: config.formula ?? "",
    stoichiometry: config.stoichiometry ?? "",
    detailIntro: config.detailIntro ?? "",
    defaultGroupId: config.defaultGroupId ?? "all",
    totalAtoms: {
      ...derivedTotals,
      ...(config.totalAtoms ?? {})
    },
    groups
  };
}

function createParticleIndexMapByFractional(particles) {
  const indexMap = new Map();

  particles.forEach((particle, index) => {
    const fractionalPosition = particle.metadata?.fractionalPosition;

    if (!fractionalPosition) {
      return;
    }

    indexMap.set(pointKey(fractionalPosition), index);
  });

  return indexMap;
}

function getIndexByFractional(indexMap, point) {
  return indexMap.get(pointKey(point));
}

function createParticleIndexMapByCartesian(particles) {
  const indexMap = new Map();

  particles.forEach((particle, index) => {
    indexMap.set(pointKey(toPointArray(particle.position)), index);
  });

  return indexMap;
}

function buildPeriodicLatticePoints({
  basisSites,
  translationVectors,
  searchRange
}) {
  const pointMap = new Map();

  for (let tx = -searchRange; tx <= searchRange; tx += 1) {
    for (let ty = -searchRange; ty <= searchRange; ty += 1) {
      for (let tz = -searchRange; tz <= searchRange; tz += 1) {
        const translation = combineTranslations(translationVectors, [tx, ty, tz]);

        basisSites.forEach((site) => {
          const point = addPoint(site, translation);
          pointMap.set(pointKey(point), point);
        });
      }
    }
  }

  return [...pointMap.values()];
}

function findNearestNeighborShell({
  centerPoint,
  basisSites,
  translationVectors,
  coordinationNumber,
  tolerance = hcpCoordinationTolerance,
  maxSearchRange = 2
}) {
  for (let searchRange = 1; searchRange <= maxSearchRange; searchRange += 1) {
    const candidates = buildPeriodicLatticePoints({
      basisSites,
      translationVectors,
      searchRange
    })
      .map((point) => ({
        point,
        distance: Math.sqrt(distanceSquared(centerPoint, point))
      }))
      .filter((candidate) => candidate.distance > tolerance)
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          compareFractionalPoints(left.point, right.point)
      );

    if (!candidates.length) {
      continue;
    }

    const nearestDistance = candidates[0].distance;
    const neighbors = candidates
      .filter(
        (candidate) =>
          Math.abs(candidate.distance - nearestDistance) <= tolerance
      )
      .map((candidate) => candidate.point)
      .sort(compareFractionalPoints);

    if (neighbors.length === coordinationNumber) {
      return {
        neighbors,
        nearestDistance
      };
    }

    if (neighbors.length > coordinationNumber) {
      throw new Error("Nearest-neighbor shell includes more sites than expected.");
    }
  }

  throw new Error("Failed to resolve a complete nearest-neighbor shell.");
}

function createPeriodicCoordinationData({
  particles,
  centerPoint,
  basisSites,
  translationVectors,
  coordinationType,
  coordinationNumber,
  coordinationLabel,
  coordinationDescription,
  coordinationRenderMode = "bonds",
  centerLabel,
  helperRadius,
  helperColor,
  helperCategory,
  helperLabelPrefix,
  tolerance = hcpCoordinationTolerance,
  maxSearchRange = 2,
  style
}) {
  const combinedParticles = particles.map((particle) => ({
    ...particle,
    metadata: {
      ...particle.metadata
    }
  }));
  const particleIndexMap = createParticleIndexMapByCartesian(combinedParticles);
  const centerParticleIndex = particleIndexMap.get(pointKey(centerPoint));

  if (!Number.isInteger(centerParticleIndex)) {
    throw new Error("Representative coordination center is not in the main cell.");
  }

  const neighborShell = findNearestNeighborShell({
    centerPoint,
    basisSites,
    translationVectors,
    coordinationNumber,
    tolerance,
    maxSearchRange
  });
  const neighborParticleIndices = neighborShell.neighbors.map((point, index) => {
    const key = pointKey(point);
    const existingIndex = particleIndexMap.get(key);

    if (Number.isInteger(existingIndex)) {
      return existingIndex;
    }

    const helperParticle = createParticle({
      position: toPositionObject(point),
      radius: helperRadius,
      color: helperColor,
      label: `${helperLabelPrefix} ${index + 1}`,
      category: helperCategory,
      visible: false,
      includeInFrame: false,
      metadata: {
        cartesianPosition: [...point],
        isAuxiliary: true,
        coordinationHelper: true
      }
    });

    combinedParticles.push(helperParticle);
    const helperIndex = combinedParticles.length - 1;
    particleIndexMap.set(key, helperIndex);

    return helperIndex;
  });

  return {
    particles: combinedParticles,
    connections: [],
    nearestNeighborDistance: neighborShell.nearestDistance,
    coordinationRule: createCoordinationRule({
      coordinationNumber,
      translationVectors,
      searchRange: maxSearchRange,
      tolerance,
      nearestNeighborDistance: neighborShell.nearestDistance,
      explanation: coordinationDescription
    }),
    coordinationDisplay: createCoordinationDisplay({
      coordinationType,
      coordinationNumber,
      coordinationRenderMode,
      coordinationLabel,
      coordinationDescription,
      coordinationCenters: [
        {
          particleIndex: centerParticleIndex,
          neighborParticleIndices,
          label: centerLabel ?? coordinationLabel
        }
      ],
      style
    })
  };
}

function createCrystalEntry(entry) {
  const coordinationDisplay = entry.coordinationDisplay ?? null;
  const supportsCoordinationDisplay = Boolean(
    entry.supportsCoordinationDisplay ?? coordinationDisplay
  );
  const supportsCountingDisplay = Boolean(
    entry.supportsCountingDisplay ??
      entry.supportsCounting ??
      entry.countingInfo ??
      entry.effectiveAtomCounting
  );
  const particles = entry.particles ?? entry.atoms ?? [];
  const crystalOrientation = normalizeCrystalOrientation(
    entry.crystalOrientation ?? defaultCrystalOrientation
  );
  const defaultView = normalizeDefaultView(entry.defaultView);

  return {
    ...entry,
    particles,
    atoms: entry.atoms ?? particles,
    name: entry.name ?? entry.displayName,
    displayName: entry.displayName ?? entry.name,
    category: entry.category ?? "未分类",
    representativeSubstance: entry.representativeSubstance ?? "",
    representativeFormula: entry.representativeFormula ?? "",
    structureFeatureSummary:
      entry.structureFeatureSummary ?? entry.typeSummary ?? entry.description ?? "",
    countingInfo: entry.countingInfo ? createCountingInfo(entry.countingInfo) : null,
    effectiveAtomCounting: entry.effectiveAtomCounting
      ? createEffectiveAtomCounting(entry.effectiveAtomCounting)
      : null,
    coordinationInfo: entry.coordinationInfo
      ? createCoordinationInfo(entry.coordinationInfo)
      : supportsCoordinationDisplay
        ? createCoordinationInfo({
            title:
              entry.coordinationLabel ??
              coordinationDisplay?.coordinationLabel ??
              "閰嶄綅璇存槑",
            summary:
              entry.coordinationDescription ??
              coordinationDisplay?.coordinationDescription ??
              "",
          })
        : null,
    cellFrame: {
      ...defaultBoxFrame,
      ...entry.cellFrame
    },
    supportsCoordinationDisplay,
    supportsCoordination: supportsCoordinationDisplay,
    supportsCountingDisplay,
    supportsCounting: supportsCountingDisplay,
    coordinationType:
      entry.coordinationType ?? coordinationDisplay?.coordinationType ?? null,
    coordinationNumber:
      entry.coordinationNumber ?? coordinationDisplay?.coordinationNumber ?? null,
    coordinationRenderMode:
      entry.coordinationRenderMode ??
      coordinationDisplay?.coordinationRenderMode ??
      null,
    coordinationLabel:
      entry.coordinationLabel ?? coordinationDisplay?.coordinationLabel ?? null,
    coordinationDescription:
      entry.coordinationDescription ??
      coordinationDisplay?.coordinationDescription ??
      null,
    coordinationCenterStrategy: entry.coordinationCenterStrategy ?? "",
    coordinationNeighborSearch: entry.coordinationNeighborSearch ?? "",
    rigorousNotes: normalizeStringArray(entry.rigorousNotes),
    coordinationCenters:
      entry.coordinationCenters ??
      coordinationDisplay?.coordinationCenters ??
      [],
    coordinationNeighbors:
      entry.coordinationNeighbors ??
      coordinationDisplay?.coordinationNeighbors ??
      [],
    coordinationRule: createCoordinationRule(
      entry.coordinationRule,
      entry,
      coordinationDisplay
    ),
    atomLegend: normalizeAtomLegendArray(entry.atomLegend),
    axisConventionId: entry.axisConventionId ?? axisConvention.id,
    crystalOrientation,
    orientationSummary: entry.orientationSummary ?? "",
    defaultView,
    defaultViewSummary: entry.defaultViewSummary ?? defaultView.description ?? "",
    defaultViewRationale:
      entry.defaultViewRationale ?? defaultView.rationale ?? ""
  };
}

function collectUniqueDiamondLatticePoints() {
  const latticePointMap = new Map();

  for (let tx = -1; tx <= 1; tx += 1) {
    for (let ty = -1; ty <= 1; ty += 1) {
      for (let tz = -1; tz <= 1; tz += 1) {
        const translation = [tx, ty, tz];

        diamondFccSites.forEach((site) => {
          const point = addPoint(site, translation);
          latticePointMap.set(pointKey(point), point);
        });

        diamondBasisShiftedSites.forEach((site) => {
          const point = addPoint(site, translation);
          latticePointMap.set(pointKey(point), point);
        });
      }
    }
  }

  return [...latticePointMap.values()].sort(compareFractionalPoints);
}

function findDiamondNearestNeighbors(point, candidates) {
  return candidates
    .filter((candidate) => {
      const distance = Math.sqrt(distanceSquared(point, candidate));

      return (
        distance > diamondNeighborTolerance &&
        Math.abs(distance - diamondNearestNeighborDistance) <=
          diamondNeighborTolerance
      );
    })
    .sort(compareFractionalPoints);
}

function buildDiamondConnections(connectionDescriptors, particleIndexByKey) {
  return connectionDescriptors.map((descriptor) => {
    const isAuxiliary = descriptor.isAuxiliary;

    return createConnection(
      particleIndexByKey.get(descriptor.fromKey),
      particleIndexByKey.get(descriptor.toKey),
      {
        start: toCenteredPosition(descriptor.fromPoint),
        end: toCenteredPosition(descriptor.toPoint),
        color: isAuxiliary ? particlePalette.bondAuxiliary : particlePalette.bond,
        radius: isAuxiliary ? 0.022 : 0.026,
        opacity: 1,
        endpointInset: isAuxiliary ? 0.045 : 0.06,
        includeInFrame: !isAuxiliary,
        metadata: {
          isDiamondAuxiliaryBond: isAuxiliary,
          fractionalMidpoint: [
            (descriptor.fromPoint[0] + descriptor.toPoint[0]) / 2,
            (descriptor.fromPoint[1] + descriptor.toPoint[1]) / 2,
            (descriptor.fromPoint[2] + descriptor.toPoint[2]) / 2
          ]
        }
      }
    );
  });
}

function createNaClCrystalData() {
  const particles = [
    ...createParticlesFromFractional(rockSaltAnionSites, {
      radius: 0.18,
      color: particlePalette.chloride,
      label: (index) => `Cl- 浣嶇偣 ${index + 1}`,
      category: "anion"
    }),
    ...createParticlesFromFractional(rockSaltCationSites, {
      radius: 0.12,
      color: particlePalette.sodium,
      label: (index) => `Na+ 浣嶇偣 ${index + 1}`,
      category: "cation"
    })
  ];
  const indexMap = createParticleIndexMapByFractional(particles);
  const centerParticleIndex = getIndexByFractional(indexMap, [0.5, 0.5, 0.5]);
  const neighborPoints = [
    [0.5, 0.5, 1],
    [1, 0.5, 0.5],
    [0.5, 1, 0.5],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0]
  ];
  const neighborIndices = neighborPoints.map((point) =>
    getIndexByFractional(indexMap, point)
  );
  const [zp, xp, yp, xm, ym, zm] = neighborIndices;
  const clCornerRefs = [...csclCornerSites]
    .map((point) => getIndexByFractional(indexMap, point))
    .filter((value) => Number.isInteger(value));
  const clFaceRefs = [
    [0.5, 0.5, 0],
    [0.5, 0.5, 1],
    [0.5, 0, 0.5],
    [0.5, 1, 0.5],
    [0, 0.5, 0.5],
    [1, 0.5, 0.5]
  ]
    .map((point) => getIndexByFractional(indexMap, point))
    .filter((value) => Number.isInteger(value));
  const naBodyRef = getIndexByFractional(indexMap, [0.5, 0.5, 0.5]);
  const naEdgeRefs = rockSaltCationSites
    .filter((point) => pointKey(point) !== pointKey([0.5, 0.5, 0.5]))
    .map((point) => getIndexByFractional(indexMap, point))
    .filter((value) => Number.isInteger(value));

  return {
    particles,
    connections: [],
    effectiveAtomCounting: {
      enabled: true,
      title: "有效原子示意",
      summary:
        "高亮部分表示真正计入当前 NaCl 晶胞的原子份额；半透明整球表示该原子与相邻晶胞共享的完整位置。",
      shortConclusion:
        "Cl 的 FCC 骨架有效贡献为 4，Na 的棱心与体心有效贡献也为 4，因此化学计量比为 1:1。",
      formula:
        "Cl：8 × 1/8 + 6 × 1/2 = 4；Na：12 × 1/4 + 1 × 1 = 4",
      stoichiometry: "Na : Cl = 1 : 1",
      detailIntro:
        "开启示意后，角点、面心、棱心和体心原子会直接按照晶胞边界裁切出其有效部分。",
      totalAtoms: {
        Cl: 4,
        Na: 4
      },
      groups: [
        {
          id: "nacl-cl-corner",
          label: "Cl 角点原子",
          species: "Cl",
          count: 8,
          contribution: 1 / 8,
          positionType: "corner",
          atomRefs: clCornerRefs,
          explanation:
            "8 个角点 Cl- 被 8 个相邻晶胞共享，因此每个角点 Cl- 只对当前晶胞贡献 1/8。"
        },
        {
          id: "nacl-cl-face",
          label: "Cl 面心原子",
          species: "Cl",
          count: 6,
          contribution: 1 / 2,
          positionType: "face",
          atomRefs: clFaceRefs,
          explanation:
            "6 个面心 Cl- 各被 2 个相邻晶胞共享，因此每个面心 Cl- 对当前晶胞贡献 1/2。"
        },
        {
          id: "nacl-na-edge",
          label: "Na 棱心原子",
          species: "Na",
          count: 12,
          contribution: 1 / 4,
          positionType: "edge",
          atomRefs: naEdgeRefs,
          explanation:
            "12 个棱心 Na+ 各被 4 个相邻晶胞共享，因此每个棱心 Na+ 对当前晶胞贡献 1/4。"
        },
        {
          id: "nacl-na-body",
          label: "Na 体心原子",
          species: "Na",
          count: 1,
          contribution: 1,
          positionType: "body",
          atomRefs: [naBodyRef],
          explanation:
            "体心 Na+ 完全位于当前晶胞内部，因此整个原子都计入当前晶胞。"
        }
      ]
    },
    coordinationDisplay: createCoordinationDisplay({
      coordinationType: "octahedral",
      coordinationNumber: 6,
      coordinationRenderMode: "bonds+polyhedron",
      coordinationLabel: "NaCl 型代表性 6:6 配位",
      coordinationDescription:
        "当前突出显示一个代表性 Na+ 与 6 个最近邻 Cl-，用八面体配位环境说明 NaCl 型结构中的 6:6 配位。",
      coordinationCenters: [
        {
          particleIndex: centerParticleIndex,
          neighborParticleIndices: neighborIndices,
          polyhedronFaces: [
            [zp, xp, yp],
            [zp, yp, xm],
            [zp, xm, ym],
            [zp, ym, xp],
            [zm, yp, xp],
            [zm, xm, yp],
            [zm, ym, xm],
            [zm, xp, ym]
          ],
          label: "6:6 八面体配位"
        }
      ]
    })
  };
}

function createCsClCrystalData() {
  const particles = [
    ...createParticlesFromFractional(csclCornerSites, {
      radius: 0.18,
      color: particlePalette.chloride,
      label: (index) => `Cl- 浣嶇偣 ${index + 1}`,
      category: "anion"
    }),
    ...createParticlesFromFractional([[0.5, 0.5, 0.5]], {
      radius: 0.24,
      color: particlePalette.cesium,
      label: "Cs+ 浣嶇偣",
      category: "cation"
    })
  ];
  const indexMap = createParticleIndexMapByFractional(particles);
  const centerParticleIndex = getIndexByFractional(indexMap, [0.5, 0.5, 0.5]);
  const neighborIndices = [...csclCornerSites].map((point) =>
    getIndexByFractional(indexMap, point)
  );
  const [c000, c100, c010, c110, c001, c101, c011, c111] = neighborIndices;
  const cornerRefs = [...neighborIndices].filter((value) => Number.isInteger(value));

  return {
    particles,
    connections: [],
    effectiveAtomCounting: {
      enabled: true,
      title: "有效原子示意",
      summary:
        "高亮部分表示真正属于当前 CsCl 晶胞的原子份额；角点 Cl- 只保留晶胞内部的 1/8，体心 Cs+ 则完整计入。",
      shortConclusion:
        "角点 Cl 的有效总贡献为 1，体心 Cs 的有效总贡献也为 1，因此化学计量比为 1:1。",
      formula: "Cl：8 × 1/8 = 1；Cs：1 × 1 = 1",
      stoichiometry: "Cs : Cl = 1 : 1",
      totalAtoms: {
        Cl: 1,
        Cs: 1
      },
      groups: [
        {
          id: "cscl-cl-corner",
          label: "Cl 角点原子",
          species: "Cl",
          count: 8,
          contribution: 1 / 8,
          positionType: "corner",
          atomRefs: cornerRefs,
          explanation:
            "8 个角点 Cl- 被 8 个相邻晶胞共享，因此每个角点 Cl- 对当前晶胞贡献 1/8。"
        },
        {
          id: "cscl-cs-body",
          label: "Cs 体心原子",
          species: "Cs",
          count: 1,
          contribution: 1,
          positionType: "body",
          atomRefs: [centerParticleIndex],
          explanation:
            "体心 Cs+ 完全位于当前晶胞内部，因此整个原子都计入当前晶胞。"
        }
      ]
    },
    coordinationDisplay: createCoordinationDisplay({
      coordinationType: "cubic",
      coordinationNumber: 8,
      coordinationRenderMode: "bonds+polyhedron",
      coordinationLabel: "CsCl 型代表性 8:8 配位",
      coordinationDescription:
        "当前突出显示体心代表性 Cs+ 与 8 个角点 Cl-，用立方配位环境说明 CsCl 型结构中的 8:8 配位。",
      coordinationCenters: [
        {
          particleIndex: centerParticleIndex,
          neighborParticleIndices: neighborIndices,
          polyhedronFaces: [
            [c000, c100, c110, c010],
            [c001, c101, c111, c011],
            [c000, c100, c101, c001],
            [c010, c110, c111, c011],
            [c000, c010, c011, c001],
            [c100, c110, c111, c101]
          ],
          label: "8:8 绔嬫柟閰嶄綅"
        }
      ]
    })
  };
}

function createDiamondCrystalData() {
  const allDiamondPoints = collectUniqueDiamondLatticePoints();
  const primaryPoints = allDiamondPoints.filter((point) =>
    isPointInsideOrOnCell(point)
  );
  const primaryPointKeys = new Set(primaryPoints.map((point) => pointKey(point)));
  const representativePoint = [0.25, 0.25, 0.25];
  const representativeKey = pointKey(representativePoint);
  const helperPointMap = new Map();
  const connectionDescriptors = [];
  const seenBondKeys = new Set();
  const representativeNeighborKeySet = new Set();

  primaryPoints.forEach((point) => {
    const fromKey = pointKey(point);
    const neighbors = findDiamondNearestNeighbors(point, allDiamondPoints);

    neighbors.forEach((neighbor) => {
      const toKey = pointKey(neighbor);
      const bondKey = [fromKey, toKey].sort().join("|");

      if (fromKey === representativeKey) {
        representativeNeighborKeySet.add(toKey);
      }

      if (toKey === representativeKey) {
        representativeNeighborKeySet.add(fromKey);
      }

      if (seenBondKeys.has(bondKey)) {
        return;
      }

      seenBondKeys.add(bondKey);

      const isNeighborInside = primaryPointKeys.has(toKey);

      if (!isNeighborInside) {
        helperPointMap.set(toKey, neighbor);
      }

      connectionDescriptors.push({
        fromKey,
        toKey,
        fromPoint: point,
        toPoint: neighbor,
        isAuxiliary: !isNeighborInside
      });
    });
  });

  const sortedPrimaryPoints = [...primaryPoints].sort(compareFractionalPoints);
  const sortedHelperPoints = [...helperPointMap.values()].sort(
    compareFractionalPoints
  );
  const particles = [];
  const particleIndexByKey = new Map();

  sortedPrimaryPoints.forEach((point, index) => {
    const key = pointKey(point);

    particleIndexByKey.set(key, particles.length);
    particles.push(
      createParticle({
        position: toCenteredPosition(point),
        radius: 0.14,
        color: particlePalette.carbon,
        label: `C 原子 ${index + 1}`,
        category: "carbon-primary",
        metadata: {
          fractionalPosition: point,
          isDiamondPrimary: true
        }
      })
    );
  });

  sortedHelperPoints.forEach((point, index) => {
    const key = pointKey(point);

    particleIndexByKey.set(key, particles.length);
    particles.push(
      createParticle({
        position: toCenteredPosition(point),
        radius: 0.1,
        color: particlePalette.carbonAuxiliary,
        label: `C 鍘熷瓙锛堢浉閭绘櫠鑳炶緟鍔╋級${index + 1}`,
        category: "carbon-helper",
        includeInFrame: false,
        metadata: {
          fractionalPosition: point,
          isAuxiliary: true,
          isDiamondHelper: true
        }
      })
    );
  });

  const connections = buildDiamondConnections(
    connectionDescriptors,
    particleIndexByKey
  );
  const neighborIndices = [...representativeNeighborKeySet]
    .map((key) => particleIndexByKey.get(key))
    .filter((index) => Number.isInteger(index));
  const [n0, n1, n2, n3] = neighborIndices;
  const diamondCornerRefs = [...csclCornerSites]
    .map((point) => particleIndexByKey.get(pointKey(point)))
    .filter((value) => Number.isInteger(value));
  const diamondFaceRefs = [
    [0.5, 0.5, 0],
    [0.5, 0.5, 1],
    [0.5, 0, 0.5],
    [0.5, 1, 0.5],
    [0, 0.5, 0.5],
    [1, 0.5, 0.5]
  ]
    .map((point) => particleIndexByKey.get(pointKey(point)))
    .filter((value) => Number.isInteger(value));
  const diamondInternalRefs = [...diamondBasisShiftedSites]
    .map((point) => particleIndexByKey.get(pointKey(point)))
    .filter((value) => Number.isInteger(value));

  return {
    particles,
    connections,
    effectiveAtomCounting: {
      enabled: true,
      title: "有效原子示意",
      summary:
        "金刚石型晶胞可分成 FCC 骨架的 4 个等效原子，加上 4 个完全位于晶胞内部的基元原子。",
      shortConclusion:
        "角点与面心共同形成 4 个 FCC 等效原子，内部基元原子再贡献 4 个，因此一个常规金刚石型晶胞共含 8 个 C 原子。",
      formula: "角点 C：8 × 1/8 = 1；面心 C：6 × 1/2 = 3；内部 C：4 × 1 = 4",
      totalAtoms: {
        C: 8
      },
      groups: [
        {
          id: "diamond-corner",
          label: "C 角点原子",
          species: "C",
          count: 8,
          contribution: 1 / 8,
          positionType: "corner",
          atomRefs: diamondCornerRefs,
          explanation:
            "金刚石型常规晶胞的 8 个角点 C 与普通立方角点一样，被 8 个相邻晶胞共享，因此每个角点只贡献 1/8。"
        },
        {
          id: "diamond-face",
          label: "C 面心原子",
          species: "C",
          count: 6,
          contribution: 1 / 2,
          positionType: "face",
          atomRefs: diamondFaceRefs,
          explanation:
            "6 个面心 C 分别位于两个相邻晶胞共有的面上，因此每个面心 C 贡献 1/2。"
        },
        {
          id: "diamond-internal",
          label: "C 内部基元原子",
          species: "C",
          count: 4,
          contribution: 1,
          positionType: "internal",
          atomRefs: diamondInternalRefs,
          explanation:
            "4 个内部基元 C 完全位于晶胞内部，它们不是面心或体心共享位点，而是完整地各贡献 1 个。"
        }
      ]
    },
    coordinationDisplay: createCoordinationDisplay({
      coordinationType: "tetrahedral",
      coordinationNumber: 4,
      coordinationRenderMode: "bonds+polyhedron",
      coordinationLabel: "金刚石型代表性四配位",
      coordinationDescription:
        "当前突出显示一个代表性碳原子及其 4 个最近邻碳原子，用四面体环境说明金刚石型结构中的四配位。",
      coordinationCenters: [
        {
          particleIndex: particleIndexByKey.get(representativeKey),
          neighborParticleIndices: neighborIndices,
          polyhedronFaces:
            neighborIndices.length === 4
              ? [
                  [n0, n1, n2],
                  [n0, n1, n3],
                  [n0, n2, n3],
                  [n1, n2, n3]
                ]
              : [],
          label: "鍥涢厤浣嶅洓闈綋"
        }
      ]
    })
  };
}

function createFccCrystalData() {
  const particles = [
    ...createParticlesFromFractional(csclCornerSites, {
      radius: 0.15,
      color: particlePalette.metalLight,
      label: (index) => `FCC 角点原子 ${index + 1}`,
      category: "fcc-corner"
    }),
    ...createParticlesFromFractional(
      [
        [0.5, 0.5, 0],
        [0.5, 0.5, 1],
        [0.5, 0, 0.5],
        [0.5, 1, 0.5],
        [0, 0.5, 0.5],
        [1, 0.5, 0.5]
      ],
      {
        radius: 0.17,
        color: particlePalette.metal,
        label: (index) => `FCC 面心原子 ${index + 1}`,
        category: "fcc-face-center"
      }
    )
  ];
  const indexMap = createParticleIndexMapByFractional(particles);
  const cornerRefs = [...csclCornerSites]
    .map((point) => getIndexByFractional(indexMap, point))
    .filter((value) => Number.isInteger(value));
  const faceRefs = [
    [0.5, 0.5, 0],
    [0.5, 0.5, 1],
    [0.5, 0, 0.5],
    [0.5, 1, 0.5],
    [0, 0.5, 0.5],
    [1, 0.5, 0.5]
  ]
    .map((point) => getIndexByFractional(indexMap, point))
    .filter((value) => Number.isInteger(value));
  const fccBasisSites = diamondFccSites.map((point) =>
    toPointArray(toCenteredPosition(point))
  );

  const fccData = createPeriodicCoordinationData({
    particles,
    centerPoint: toPointArray(toCenteredPosition([0.5, 0.5, 0])),
    basisSites: fccBasisSites,
    translationVectors: [
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2]
    ],
    coordinationType: "close-packed",
    coordinationNumber: 12,
    coordinationLabel: "FCC 代表性 12 配位",
    coordinationDescription:
      "当前主模型显示一个 FCC 常规立方晶胞的 8 个角点和 6 个面心；配位显示选取主晶胞中的一个面心原子，并按周期性晶格的最近邻壳层补全 12 个最近邻。",
    centerLabel: "FCC 面心原子的 12 配位",
    helperRadius: 0.13,
    helperColor: particlePalette.metalLight,
    helperCategory: "fcc-coordination-helper",
    helperLabelPrefix: "FCC 相邻晶胞辅助原子",
    style: {
      centerColor: 0xe3a254,
      neighborColor: 0xf0c889,
      connectionColor: 0xc57a28,
      polyhedronColor: 0xedb867
    }
  });

  return {
    ...fccData,
    effectiveAtomCounting: {
      enabled: true,
      title: "有效原子示意",
      summary:
        "FCC 晶胞中，角点原子只保留晶胞内部的 1/8，面心原子保留 1/2，因此高亮部分可以直接看出有效贡献。",
      shortConclusion:
        "8 个角点各贡献 1/8，6 个面心各贡献 1/2，所以一个常规 FCC 晶胞的有效原子数为 4。",
      formula: "角点：8 × 1/8 = 1；面心：6 × 1/2 = 3",
      totalAtoms: {
        Cu: 4
      },
      groups: [
        {
          id: "fcc-corner",
          label: "角点原子",
          species: "Cu",
          count: 8,
          contribution: 1 / 8,
          positionType: "corner",
          atomRefs: cornerRefs,
          explanation:
            "FCC 的 8 个角点原子被 8 个相邻晶胞共享，因此每个角点原子只贡献 1/8。"
        },
        {
          id: "fcc-face",
          label: "面心原子",
          species: "Cu",
          count: 6,
          contribution: 1 / 2,
          positionType: "face",
          atomRefs: faceRefs,
          explanation:
            "FCC 的 6 个面心原子各位于两个相邻晶胞共享的面上，因此每个面心原子贡献 1/2。"
        }
      ]
    }
  };
}

function createBccCrystalData() {
  const particles = [
    ...createParticlesFromFractional(bccCornerSites, {
      radius: 0.15,
      color: particlePalette.metalLight,
      label: (index) => `BCC 椤剁偣鍘熷瓙 ${index + 1}`,
      category: "bcc-corner"
    }),
    ...createParticlesFromFractional([[0.5, 0.5, 0.5]], {
      radius: 0.18,
      color: particlePalette.metal,
      label: "BCC 浣撳績鍘熷瓙",
      category: "bcc-center"
    })
  ];
  const indexMap = createParticleIndexMapByFractional(particles);
  const cornerRefs = [...bccCornerSites]
    .map((point) => getIndexByFractional(indexMap, point))
    .filter((value) => Number.isInteger(value));
  const bodyRef = getIndexByFractional(indexMap, [0.5, 0.5, 0.5]);
  const bccBasisSites = [
    toPointArray(toCenteredPosition([0, 0, 0])),
    toPointArray(toCenteredPosition([0.5, 0.5, 0.5]))
  ];

  const bccData = createPeriodicCoordinationData({
    particles,
    centerPoint: toPointArray(toCenteredPosition([0.5, 0.5, 0.5])),
    basisSites: bccBasisSites,
    translationVectors: [
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2]
    ],
    coordinationType: "body-centered",
    coordinationNumber: 8,
    coordinationLabel: "BCC 代表性 8 配位",
    coordinationDescription:
      "当前主模型显示一个 BCC 常规立方晶胞的 8 个角点和 1 个体心；配位显示选取体心原子，并按周期性晶格的最近邻壳层得到 8 个最近邻角点原子。",
    centerLabel: "BCC 体心原子的 8 配位",
    helperRadius: 0.13,
    helperColor: particlePalette.metalLight,
    helperCategory: "bcc-coordination-helper",
    helperLabelPrefix: "BCC 相邻晶胞辅助原子",
    style: {
      centerColor: 0xd99a4c,
      neighborColor: 0xebc37f,
      connectionColor: 0xc47a28,
      polyhedronColor: 0xe8b565
    }
  });

  return {
    ...bccData,
    effectiveAtomCounting: {
      enabled: true,
      title: "有效原子示意",
      summary:
        "BCC 晶胞中，角点原子只保留晶胞内部的 1/8，体心原子完整计入，因此视觉上可以直接看出 1 + 1 的来源。",
      shortConclusion:
        "8 个角点各贡献 1/8，再加上 1 个完整体心原子，因此一个常规 BCC 晶胞的有效原子数为 2。",
      formula: "角点：8 × 1/8 = 1；体心：1 × 1 = 1",
      totalAtoms: {
        Fe: 2
      },
      groups: [
        {
          id: "bcc-corner",
          label: "角点原子",
          species: "Fe",
          count: 8,
          contribution: 1 / 8,
          positionType: "corner",
          atomRefs: cornerRefs,
          explanation:
            "BCC 的 8 个角点原子被 8 个相邻晶胞共享，因此每个角点原子只贡献 1/8。"
        },
        {
          id: "bcc-body",
          label: "体心原子",
          species: "Fe",
          count: 1,
          contribution: 1,
          positionType: "body",
          atomRefs: [bodyRef],
          explanation:
            "体心原子完全位于晶胞内部，因此完整贡献 1 个原子。"
        }
      ]
    }
  };
}

function createHcpMainCellPoints() {
  return {
    bottomFacePoints: hcpCellGeometry.bottomFacePoints.map((point) => [...point]),
    topFacePoints: hcpCellGeometry.topFacePoints.map((point) => [...point]),
    middleLayerPoints: hcpCellGeometry.middleLayerPoints.map((point) => [...point])
  };
}

function createHcpCrystalData() {
  const { bottomFacePoints, topFacePoints, middleLayerPoints } =
    createHcpMainCellPoints();
  const particles = [
    ...createParticlesFromCartesian(bottomFacePoints, {
      radius: 0.145,
      color: particlePalette.metalLight,
      label: (index) =>
        index === 0 ? "HCP 下底面中心原子" : `HCP 下底面顶点原子 ${index}`,
      category: "hcp-bottom-layer"
    }),
    ...createParticlesFromCartesian(topFacePoints, {
      radius: 0.145,
      color: particlePalette.metalLight,
      label: (index) =>
        index === 0 ? "HCP 上底面中心原子" : `HCP 上底面顶点原子 ${index}`,
      category: "hcp-top-layer"
    }),
    ...createParticlesFromCartesian(middleLayerPoints, {
      radius: 0.17,
      color: particlePalette.hcp,
      label: (index) => `HCP 中层 B 位原子 ${index + 1}`,
      category: "hcp-middle-layer"
    })
  ];
  const indexMap = createParticleIndexMapByCartesian(particles);
  const cornerRefs = [...bottomFacePoints.slice(1), ...topFacePoints.slice(1)]
    .map((point) => indexMap.get(pointKey(point)))
    .filter((value) => Number.isInteger(value));
  const basalFaceCenterRefs = [bottomFacePoints[0], topFacePoints[0]]
    .map((point) => indexMap.get(pointKey(point)))
    .filter((value) => Number.isInteger(value));
  const internalRefs = [...middleLayerPoints]
    .map((point) => indexMap.get(pointKey(point)))
    .filter((value) => Number.isInteger(value));

  const hcpData = createPeriodicCoordinationData({
    particles,
    centerPoint: middleLayerPoints[0],
    basisSites: hcpBasisSites,
    translationVectors: hcpPrimitiveVectors,
    coordinationType: "hexagonal-close-packed",
    coordinationNumber: 12,
    coordinationLabel: "HCP 代表性 12 配位",
    coordinationDescription:
      "当前主模型显示常规六方晶胞中的 12 个顶点原子、2 个上下底面中心原子和 3 个中层原子；配位显示选取中层代表性原子，并按周期性晶格的最近邻壳层补全同层 6 个、上层 3 个、下层 3 个最近邻。",
    centerLabel: "HCP 中层原子的 12 配位",
    helperRadius: 0.13,
    helperColor: particlePalette.metalLight,
    helperCategory: "hcp-coordination-helper",
    helperLabelPrefix: "HCP 相邻晶胞辅助原子",
    tolerance: hcpCoordinationTolerance,
    style: {
      centerColor: 0xd89d57,
      neighborColor: 0xecc98a,
      connectionColor: 0xbe7a34,
      polyhedronColor: 0xe6b86e
    }
  });

  return {
    ...hcpData,
    effectiveAtomCounting: {
      enabled: true,
      title: "有效原子示意",
      summary:
        "六方晶胞中，高亮部分表示真正计入当前六方棱柱晶胞的原子份额；角点原子按六方晶胞共享关系取 1/6，而不是立方晶胞的 1/8。",
      shortConclusion:
        "12 个角点各贡献 1/6，2 个底面中心各贡献 1/2，再加上 3 个内部原子各贡献 1，因此常规 HCP 晶胞共含 6 个原子。",
      formula:
        "角点：12 × 1/6 = 2；底面中心：2 × 1/2 = 1；内部：3 × 1 = 3",
      totalAtoms: {
        Mg: 6
      },
      groups: [
        {
          id: "hcp-corner",
          label: "六方晶胞角点原子",
          species: "Mg",
          count: 12,
          contribution: 1 / 6,
          positionType: "hcpCorner",
          atomRefs: cornerRefs,
          explanation:
            "常规 HCP 六方晶胞的 12 个顶点原子由 6 个相邻晶胞共享，因此每个角点原子只贡献 1/6。"
        },
        {
          id: "hcp-basal-center",
          label: "上下底面中心原子",
          species: "Mg",
          count: 2,
          contribution: 1 / 2,
          positionType: "hcpBasalFaceCenter",
          atomRefs: basalFaceCenterRefs,
          explanation:
            "上下底面中心原子各位于两个相邻晶胞共享的底面上，因此每个底面中心原子贡献 1/2。"
        },
        {
          id: "hcp-internal",
          label: "中层内部原子",
          species: "Mg",
          count: 3,
          contribution: 1,
          positionType: "hcpInternal",
          atomRefs: internalRefs,
          explanation:
            "中层 B 位的 3 个原子完全位于当前六方晶胞内部，因此各自完整贡献 1。"
        }
      ]
    }
  };
}

const testCubeParticles = [
  createParticle({
    position: { x: 0, y: 0, z: 0 },
    radius: 0.28,
    color: particlePalette.demo,
    label: "娴嬭瘯绮掑瓙",
    category: "demo"
  })
];

const naclCrystalData = createNaClCrystalData();
const csclCrystalData = createCsClCrystalData();
const diamondCrystalData = createDiamondCrystalData();
const fccCrystalData = createFccCrystalData();
const bccCrystalData = createBccCrystalData();
const hcpCrystalData = createHcpCrystalData();

export const projectMeta = {
  title: "晶胞结构可视化",
  stage: "多晶胞结构、配位与有效原子示意展示",
  audience: "高中化学学习与比赛展示",
  defaultCrystalId: "nacl",
  axisConvention,
  standardViewDirections
};

export const crystalCatalog = [
  createCrystalEntry({
    id: "test-cube",
    name: "测试立方体",
    displayName: "测试立方体",
    category: "开发调试",
    representativeSubstance: "",
    representativeFormula: "",
    typeSummary: "开发调试模型，用于验证基础渲染流程。",
    structureFeatureSummary: "内部测试场景，不属于正式展示内容。",
    particles: testCubeParticles,
    connections: [],
    cellFrame: defaultBoxFrame,
    description: "保留原有测试模型，用于开发阶段调试。",
    orientationSummary: "调试用立方体同样遵守统一坐标：棱边分别平行 X、Y、Z 轴。",
    defaultView: {
      viewId: "isometric",
      rationale: "调试时同时观察三个主轴。"
    },
    supportsCoordinationDisplay: false,
    supportsCountingDisplay: false,
    supportsAuxiliaryAtoms: false,
    buildStatus: "demo",
    showInSelector: false
  }),
  createCrystalEntry({
    id: "nacl",
    name: "NaCl 型晶胞（岩盐型）",
    displayName: "NaCl 型晶胞（岩盐型，以 NaCl 为代表）",
    category: "离子晶体",
    representativeSubstance: "氯化钠",
    representativeFormula: "NaCl",
    typeSummary: "Cl- 构成面心立方骨架，Na+ 占据全部八面体空隙。",
    structureFeatureSummary:
      "NaCl 型结构可看作 Cl- 形成面心立方堆积，Na+ 填入全部八面体空隙，两种离子构成彼此穿插的子晶格。",
    particles: naclCrystalData.particles,
    connections: naclCrystalData.connections,
    coordinationDisplay: naclCrystalData.coordinationDisplay,
    effectiveAtomCounting: naclCrystalData.effectiveAtomCounting,
    coordinationLabel: "NaCl 型 6:6 配位",
    coordinationDescription:
      "突出一个代表性 Na+ 与 6 个最近邻 Cl- 的八面体配位环境。",
    coordinationInfo: {
      title: "6:6 配位",
      summary:
        "每个 Na+ 周围有 6 个最近邻 Cl-，每个 Cl- 周围也有 6 个最近邻 Na+，代表性几何环境为八面体。"
    },
    countingInfo: {
      countingTitle: "NaCl 型晶胞计数",
      countingSummary:
        "按 NaCl 型常规立方晶胞计数：Cl- 位于顶点和面心，Na+ 位于棱心和体心。",
      equivalentContributionRules: [
        {
          site: "顶点 Cl-",
          particles: "Cl-",
          equation: "8 x 1/8 = 1",
          note: "每个顶点离子被 8 个晶胞共享。"
        },
        {
          site: "面心 Cl-",
          particles: "Cl-",
          equation: "6 x 1/2 = 3",
          note: "每个面心离子被 2 个晶胞共享。"
        },
        {
          site: "棱心 Na+",
          particles: "Na+",
          equation: "12 x 1/4 = 3",
          note: "每个棱心离子被 4 个晶胞共享。"
        },
        {
          site: "体心 Na+",
          particles: "Na+",
          equation: "1 x 1 = 1",
          note: "体心离子完全属于当前晶胞。"
        }
      ],
      finalParticleCount: [
        { label: "Cl-", value: "4" },
        { label: "Na+", value: "4" },
        { label: "NaCl 单位", value: "4" }
      ],
      formulaConclusion:
        "晶胞内 Na+ 与 Cl- 的等效数目比为 1:1，因此对应 4 个 NaCl。"
    },
    cellFrame: {
      ...defaultBoxFrame,
      fillColor: 0xa6cadc,
      fillOpacity: 0.05
    },
    description:
      "当前模型展示 NaCl 的常规立方晶胞：角点和面心位置为 Cl-，棱心与体心位置为 Na+。",
    atomLegend: [
      {
        label: "Na+",
        color: particlePalette.sodium,
        note: "棱心与体心位置的阳离子。"
      },
      {
        label: "Cl-",
        color: particlePalette.chloride,
        note: "角点与面心位置的阴离子。"
      }
    ],
    orientationSummary:
      "NaCl 采用常规立方晶胞表达，三组晶胞棱边分别与全局 X、Y、Z 轴平行，不做局部旋转。",
    defaultView: {
      viewId: "isometric",
      rationale: "同时看清立方边框、Cl- 的面心分布以及 Na+ 的体心/棱心位置。"
    },
    supportsAuxiliaryAtoms: false,
    supportsCountingDisplay: true,
    buildStatus: "ready",
    showInSelector: true
  }),
  createCrystalEntry({
    id: "cscl",
    name: "CsCl 型晶胞",
    displayName: "CsCl 型晶胞（以 CsCl 为代表）",
    category: "离子晶体",
    representativeSubstance: "氯化铯",
    representativeFormula: "CsCl",
    typeSummary: "Cl- 位于角点，Cs+ 位于体心。",
    structureFeatureSummary:
      "CsCl 型结构中，一种离子位于立方体 8 个角点，另一种离子位于体心；它是两种离子构成的结构类型，不应与单质 BCC 金属混同。",
    particles: csclCrystalData.particles,
    connections: csclCrystalData.connections,
    coordinationDisplay: csclCrystalData.coordinationDisplay,
    effectiveAtomCounting: csclCrystalData.effectiveAtomCounting,
    coordinationLabel: "CsCl 型 8:8 配位",
    coordinationDescription:
      "突出体心 Cs+ 与 8 个角点 Cl- 的立方配位环境。",
    coordinationInfo: {
      title: "8:8 配位",
      summary:
        "体心 Cs+ 周围有 8 个角点 Cl-，角点 Cl- 周围也有 8 个最近邻 Cs+，代表性几何环境可视作立方配位。"
    },
    countingInfo: {
      countingTitle: "CsCl 型晶胞计数",
      countingSummary:
        "按 CsCl 型常规立方晶胞计数：Cl- 在角点，Cs+ 在体心。",
      equivalentContributionRules: [
        {
          site: "角点 Cl-",
          particles: "Cl-",
          equation: "8 x 1/8 = 1",
          note: "每个角点离子被 8 个晶胞共享。"
        },
        {
          site: "体心 Cs+",
          particles: "Cs+",
          equation: "1 x 1 = 1",
          note: "体心离子完全属于当前晶胞。"
        }
      ],
      finalParticleCount: [
        { label: "Cl-", value: "1" },
        { label: "Cs+", value: "1" },
        { label: "CsCl 单位", value: "1" }
      ],
      formulaConclusion:
        "晶胞内 Cs+ 与 Cl- 的等效数目比为 1:1，因此对应 1 个 CsCl。"
    },
    cellFrame: {
      ...defaultBoxFrame,
      fillColor: 0xbad3e2,
      fillOpacity: 0.05
    },
    description:
      "当前模型展示 CsCl 的立方晶胞：角点为 Cl-，体心为 Cs+。",
    atomLegend: [
      {
        label: "Cs+",
        color: particlePalette.cesium,
        note: "体心位置的阳离子。"
      },
      {
        label: "Cl-",
        color: particlePalette.chloride,
        note: "8 个角点位置的阴离子。"
      }
    ],
    orientationSummary:
      "CsCl 采用常规立方晶胞表达，三组晶胞棱边分别与全局 X、Y、Z 轴平行，不做局部旋转。",
    defaultView: {
      viewId: "diagonal",
      rationale: "沿空间对角线更容易同时看清角点离子与体心离子的立体位置关系。"
    },
    supportsAuxiliaryAtoms: false,
    supportsCountingDisplay: true,
    buildStatus: "ready",
    showInSelector: true
  }),
  createCrystalEntry({
    id: "diamond",
    name: "金刚石型晶胞",
    displayName: "金刚石型晶胞（以金刚石 C 为代表）",
    category: "原子晶体",
    representativeSubstance: "金刚石",
    representativeFormula: "C",
    typeSummary: "金刚石型结构可视作 fcc 晶格加两原子基元，形成四配位共价网络。",
    structureFeatureSummary:
      "金刚石型结构可写成 fcc Bravais 点阵加两原子基元；每个碳原子与 4 个最近邻碳原子形成四面体共价键网络。",
    particles: diamondCrystalData.particles,
    connections: diamondCrystalData.connections,
    coordinationDisplay: diamondCrystalData.coordinationDisplay,
    effectiveAtomCounting: diamondCrystalData.effectiveAtomCounting,
    coordinationLabel: "金刚石型四配位",
    coordinationDescription:
      "突出一个代表性碳原子与 4 个最近邻碳原子的四面体环境。",
    coordinationInfo: {
      title: "四配位四面体环境",
      summary:
        "每个碳原子周围有 4 个最近邻碳原子，配位环境为四面体，最近邻连接同时体现为共价键网络。"
    },
    countingInfo: {
      countingTitle: "金刚石型晶胞计数",
      countingSummary:
        "按金刚石型常规立方晶胞计数，可理解为 fcc 晶格点再加 4 个内部基元碳原子。",
      equivalentContributionRules: [
        {
          site: "顶点 C",
          particles: "C",
          equation: "8 x 1/8 = 1",
          note: "8 个角点原子折算为 1 个。"
        },
        {
          site: "面心 C",
          particles: "C",
          equation: "6 x 1/2 = 3",
          note: "6 个面心原子折算为 3 个。"
        },
        {
          site: "内部基元 C",
          particles: "C",
          equation: "4 x 1 = 4",
          note: "4 个内部基元原子完全属于当前晶胞。"
        }
      ],
      finalParticleCount: [
        { label: "等效 C 原子数", value: "8" }
      ],
      formulaConclusion:
        "一个常规金刚石型晶胞等效含 8 个 C 原子。"
    },
    cellFrame: {
      ...defaultBoxFrame,
      fillColor: 0xc9d0d7,
      fillOpacity: 0.04
    },
    description:
      "当前模型展示一个金刚石型常规立方晶胞，并绘制稳定的最近邻共价键网络。",
    atomLegend: [
      {
        label: "C 原子",
        color: particlePalette.carbon,
        note: "主晶胞中的碳原子，共同构成四面体共价网络。"
      }
    ],
    orientationSummary:
      "Diamond 采用常规立方晶胞表达，晶胞棱边与全局 X、Y、Z 轴平行；四面体成键网络只是内部连线方向，并未改变晶胞主轴。",
    defaultView: {
      viewId: "diagonal",
      direction: { x: 1.32, y: 1.12, z: 1.42 },
      up: { x: 0, y: 0, z: 1 },
      distanceScale: 2.18,
      rationale: "略偏上的对角线视角更利于观察四面体共价键网络的空间穿插。"
    },
    supportsAuxiliaryAtoms: true,
    supportsCountingDisplay: true,
    buildStatus: "ready",
    showInSelector: true,
    bondRule: {
      type: "distance",
      nearestNeighborDistance: diamondNearestNeighborDistance,
      tolerance: diamondNeighborTolerance
    }
  }),
  createCrystalEntry({
    id: "fcc",
    name: "面心立方（FCC）",
    displayName: "面心立方（FCC，以 Cu 为代表）",
    category: "金属晶体",
    representativeSubstance: "铜",
    representativeFormula: "Cu",
    typeSummary:
      "面心立方金属结构中，单个常规晶胞的主显示原子位于 8 个角点和 6 个面心位置。",
    structureFeatureSummary:
      "FCC 是结构类型，Cu 只是代表性实例。当前页面主显示一个 FCC 常规立方晶胞的 8 个角点和 6 个面心；代表性中心原子的 12 配位通过周期性晶格最近邻搜索补全，必要时调用相邻晶胞辅助原子。",
    particles: fccCrystalData.particles,
    connections: fccCrystalData.connections,
    coordinationDisplay: fccCrystalData.coordinationDisplay,
    coordinationRule: fccCrystalData.coordinationRule,
    effectiveAtomCounting: fccCrystalData.effectiveAtomCounting,
    coordinationLabel: "FCC 代表性 12 配位",
    coordinationDescription:
      "突出主晶胞中一个面心原子的 12 个最近邻；完整配位由周期性晶格最近邻壳层给出，并不意味着这 12 个最近邻全部位于当前单个晶胞内部。",
    coordinationCenterStrategy:
      "选取主晶胞中的一个面心原子作为代表性中心原子。",
    coordinationNeighborSearch:
      "在 FCC 周期性晶格上按最小非零距离搜索最近邻壳层；距离容差为 1e-4，必要时使用相邻晶胞辅助原子补全完整 12 配位。",
    rigorousNotes: [
      "FCC 的配位数为 12。",
      "当前主模型只显示一个常规立方晶胞的主原子位置，完整最近邻环境通过周期性晶格补全。",
      "FCC 与 HCP 都属于最密堆积结构，但堆积层序不同。"
    ],
    coordinationInfo: {
      title: "12 配位与最密堆积",
      summary:
        "FCC 中每个原子有 12 个最近邻，属于最密堆积结构。当前页面主显示单个常规晶胞，配位显示则以主晶胞中的一个面心原子为中心，通过周期性晶格最近邻搜索补全 12 个最近邻。"
    },
    countingInfo: {
      countingTitle: "FCC 晶胞计数",
      countingSummary:
        "按标准面心立方常规晶胞计数：8 个角点和 6 个面心折算为 4 个原子。",
      equivalentContributionRules: [
        {
          site: "顶点金属原子",
          particles: "M",
          equation: "8 x 1/8 = 1",
          note: "每个顶点原子被 8 个晶胞共享。"
        },
        {
          site: "面心金属原子",
          particles: "M",
          equation: "6 x 1/2 = 3",
          note: "每个面心原子被 2 个晶胞共享。"
        }
      ],
      finalParticleCount: [
        { label: "等效金属原子数", value: "4" },
        { label: "若以 Cu 为代表", value: "4 个 Cu 原子" }
      ],
      formulaConclusion:
        "FCC 是结构类型；若以铜为代表实例，则一个常规 FCC 晶胞等效含 4 个 Cu 原子。"
    },
    cellFrame: {
      ...defaultBoxFrame,
      fillColor: 0xc7d5df,
      fillOpacity: 0.035
    },
    description:
      "当前模型主显示 FCC 常规立方晶胞中的全部主显示原子：8 个角点和 6 个面心。配位模式选取一个面心原子为代表，并按周期性晶格最近邻壳层补全 12 配位。",
    atomLegend: [
      {
        label: "Cu 原子（角点）",
        color: particlePalette.metalLight,
        note: "8 个角点位置的代表性金属原子。"
      },
      {
        label: "Cu 原子（面心）",
        color: particlePalette.metal,
        note: "6 个面心位置的代表性金属原子。"
      }
    ],
    orientationSummary:
      "FCC 采用常规立方晶胞表达，三组晶胞棱边分别与全局 X、Y、Z 轴平行，不做局部旋转。",
    defaultView: {
      viewId: "isometric",
      rationale: "等轴测视图能同时显出三个可见面上的面心原子分布。"
    },
    supportsAuxiliaryAtoms: false,
    supportsCountingDisplay: true,
    buildStatus: "ready",
    showInSelector: true
  }),
  createCrystalEntry({
    id: "bcc",
    name: "体心立方（BCC）",
    displayName: "体心立方（BCC，以 α-Fe 为代表）",
    category: "金属晶体",
    representativeSubstance: "α-Fe（常温铁）",
    representativeFormula: "Fe",
    typeSummary: "体心立方金属结构中，角点和体心都由同一种金属原子占据。",
    structureFeatureSummary:
      "BCC 是结构类型，α-Fe 只是代表性实例。标准 BCC 常规晶胞由 8 个角点和 1 个体心组成，最近邻配位数为 8。",
    particles: bccCrystalData.particles,
    connections: bccCrystalData.connections,
    coordinationDisplay: bccCrystalData.coordinationDisplay,
    coordinationRule: bccCrystalData.coordinationRule,
    effectiveAtomCounting: bccCrystalData.effectiveAtomCounting,
    coordinationLabel: "BCC 代表性 8 配位",
    coordinationDescription:
      "突出主晶胞中体心原子的 8 个最近邻。这里的 8 配位来自周期性晶格最近邻壳层，BCC 的配位数不是 12。",
    coordinationCenterStrategy:
      "选取主晶胞中的体心原子作为代表性中心原子。",
    coordinationNeighborSearch:
      "在 BCC 周期性晶格上按最小非零距离搜索最近邻壳层；距离容差为 1e-4。当前选取体心原子时，8 个最近邻都落在当前主晶胞的角点位置。",
    rigorousNotes: [
      "BCC 的配位数为 8，而不是 12。",
      "BCC 不是最密堆积结构。",
      "当前主模型已经包含体心原子的完整 8 个角点最近邻，但配位判定仍按周期性晶格最近邻壳层统一生成。"
    ],
    coordinationInfo: {
      title: "8 配位体心环境",
      summary:
        "BCC 中体心原子周围有 8 个最近邻角点原子。当前页面主显示一个完整 BCC 常规立方晶胞，并按周期性晶格最近邻壳层统一生成体心原子的 8 配位。"
    },
    countingInfo: {
      countingTitle: "BCC 晶胞计数",
      countingSummary:
        "按标准体心立方常规晶胞计数：8 个角点和 1 个体心折算为 2 个原子。",
      equivalentContributionRules: [
        {
          site: "顶点金属原子",
          particles: "M",
          equation: "8 x 1/8 = 1",
          note: "每个顶点原子被 8 个晶胞共享。"
        },
        {
          site: "体心金属原子",
          particles: "M",
          equation: "1 x 1 = 1",
          note: "体心原子完全属于当前晶胞。"
        }
      ],
      finalParticleCount: [
        { label: "等效金属原子数", value: "2" },
        { label: "若以 α-Fe 为代表", value: "2 个 Fe 原子" }
      ],
      formulaConclusion:
        "BCC 是结构类型；若以 α-Fe 为代表实例，则一个常规 BCC 晶胞等效含 2 个 Fe 原子。"
    },
    cellFrame: {
      ...defaultBoxFrame,
      fillColor: 0xc1d3df,
      fillOpacity: 0.04
    },
    description:
      "当前模型主显示标准 BCC 常规立方晶胞中的全部主显示原子：8 个角点原子与 1 个体心原子。配位模式选取体心原子并突出其 8 个最近邻。",
    atomLegend: [
      {
        label: "Fe 原子（角点）",
        color: particlePalette.metalLight,
        note: "8 个角点位置的代表性金属原子。"
      },
      {
        label: "Fe 原子（体心）",
        color: particlePalette.metal,
        note: "晶胞体心位置的代表性金属原子。"
      }
    ],
    orientationSummary:
      "BCC 采用常规立方晶胞表达，三组晶胞棱边分别与全局 X、Y、Z 轴平行，不做局部旋转。",
    defaultView: {
      viewId: "diagonal",
      rationale: "对角线视角更容易凸显体心原子与 8 个角点之间的空间关系。"
    },
    supportsAuxiliaryAtoms: false,
    supportsCountingDisplay: true,
    buildStatus: "ready",
    showInSelector: true
  }),
  createCrystalEntry({
    id: "hcp",
    name: "六方最密堆积（HCP）",
    displayName: "六方最密堆积（HCP，以 Mg 为代表）",
    category: "金属晶体",
    representativeSubstance: "镁",
    representativeFormula: "Mg",
    orientationSummary:
      "HCP 采用常规六方晶胞（六方棱柱）表达：六方底面放在 X-Y 平面内，+Z 为 c 轴方向；+X 指向观察者，+Y 指向页面右侧，+Z 指向页面上方。",
    defaultView: {
      viewId: "isometric",
      direction: { x: 1.08, y: 1.4, z: 0.96 },
      up: { x: 0, y: 0, z: 1 },
      distanceScale: 2.18,
      rationale: "轻微俯视的立体视角更利于同时看清 ABAB 堆积层次、六方边框和 c 轴方向。"
    },
    typeSummary:
      "六方最密堆积结构采用 ABAB 层状堆积；当前页面主显示的是常规六方晶胞。",
    structureFeatureSummary:
      "HCP 是结构类型，Mg 只是代表性实例。当前页面主显示常规六方晶胞中的 12 个顶点原子、2 个上下底面中心原子和 3 个中层原子；代表性中心原子的 12 配位通过周期性晶格最近邻搜索补全。",
    particles: hcpCrystalData.particles,
    connections: hcpCrystalData.connections,
    coordinationDisplay: hcpCrystalData.coordinationDisplay,
    coordinationRule: hcpCrystalData.coordinationRule,
    effectiveAtomCounting: hcpCrystalData.effectiveAtomCounting,
    coordinationLabel: "HCP 代表性 12 配位",
    coordinationDescription:
      "突出常规六方晶胞中一个中层代表性原子的 12 个最近邻；完整配位由周期性晶格最近邻壳层给出，并不意味着 12 个最近邻全部位于当前单个晶胞内部。",
    coordinationCenterStrategy:
      "选取常规六方晶胞中部 B 层的一个原子作为代表性中心原子。",
    coordinationNeighborSearch:
      "在 HCP 周期性晶格上按最小非零距离搜索最近邻壳层；距离容差为 1e-4。对中层 B 位原子可得到同层 6 个、上层 3 个、下层 3 个最近邻，必要时使用相邻晶胞辅助原子补全。",
    rigorousNotes: [
      "HCP 的配位数为 12。",
      "当前页面采用常规六方晶胞（六方棱柱）作为主显示单胞，而不是只显示一个 primitive cell。",
      "HCP 与 FCC 都属于最密堆积结构，但 HCP 的层序为 ABAB。"
    ],
    coordinationInfo: {
      title: "12 配位与 ABAB 堆积",
      summary:
        "HCP 中每个原子有 12 个最近邻：同层 6 个，上层 3 个，下层 3 个，层序为 ABAB。当前页面主显示常规六方晶胞，并以中层代表性原子为中心，通过周期性晶格最近邻搜索补全完整 12 配位。"
    },
    countingInfo: {
      countingTitle: "HCP 晶胞计数",
      countingSummary:
        "当前计数采用常规六方晶胞口径：12 个顶点、2 个上下底面中心和 3 个内部原子折算为 6 个原子。",
      equivalentContributionRules: [
        {
          site: "12 个顶点原子",
          particles: "M",
          equation: "12 x 1/6 = 2",
          note: "每个六方棱柱顶点原子被 6 个晶胞共享。"
        },
        {
          site: "上下底面中心原子",
          particles: "M",
          equation: "2 x 1/2 = 1",
          note: "上、下底面中心原子各被 2 个晶胞共享。"
        },
        {
          site: "内部原子",
          particles: "M",
          equation: "3 x 1 = 3",
          note: "这 3 个原子完全位于当前晶胞内部。"
        }
      ],
      finalParticleCount: [
        { label: "等效金属原子数", value: "6" },
        { label: "若以 Mg 为代表", value: "6 个 Mg 原子" }
      ],
      formulaConclusion:
        "HCP 是结构类型；按当前采用的常规六方晶胞口径，一个晶胞等效含 6 个原子，若以 Mg 为代表则为 6 个 Mg 原子。"
    },
    cellFrame: {
      ...defaultBoxFrame,
      shape: "hexagonal-prism",
      baseVertices: hcpCellGeometry.baseVertices.map(([x, y]) => ({ x, y })),
      zMin: hcpCellGeometry.zMin,
      zMax: hcpCellGeometry.zMax,
      radius: hcpCellGeometry.a,
      height: hcpCellGeometry.c,
      fillColor: 0xc6d8d3,
      fillOpacity: 0.035
    },
    description:
      "当前模型主显示常规六方晶胞中的全部主显示原子：12 个顶点、2 个上下底面中心和 3 个中层原子。配位模式选取一个中层原子为代表，并按周期性晶格最近邻壳层补全 12 配位。",
    atomLegend: [
      {
        label: "Mg 原子（顶/底层）",
        color: particlePalette.metalLight,
        note: "六方棱柱的上下底面顶点与面心原子。"
      },
      {
        label: "Mg 原子（中层 B 位）",
        color: particlePalette.hcp,
        note: "位于中间堆积层的代表性原子。"
      }
    ],
    supportsAuxiliaryAtoms: false,
    supportsCountingDisplay: true,
    buildStatus: "ready",
    showInSelector: true
  })
];

export function getDefaultCrystalId() {
  return projectMeta.defaultCrystalId;
}

export function getCrystalOptions() {
  return crystalCatalog
    .filter((crystal) => crystal.showInSelector !== false)
    .map((crystal) => ({
      id: crystal.id,
      label: crystal.displayName ?? crystal.name
    }));
}

export function getStandardViewOptions() {
  return Object.values(standardViewDirections).map((view) => ({
    id: view.id,
    label: view.label
  }));
}

export function getCrystalById(id) {
  return crystalCatalog.find((crystal) => crystal.id === id) ?? crystalCatalog[0];
}

export function getBuildStatusLabel(status) {
  const statusMap = {
    demo: "测试模型",
    ready: "可展示",
    schematic: "教学示意"
  };

  return statusMap[status] ?? "未知状态";
}
