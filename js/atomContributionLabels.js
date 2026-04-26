(function (window) {
  "use strict";

const THREE = window.THREE;
const namespace = window.CrystalCellVisualizer || {};

const LABEL_FONT =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const MAX_PIXEL_RATIO = 2;

function toCssColor(value, fallback = "#2d77a8") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function roundedRect(context, x, y, width, height, radius) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - resolvedRadius,
    y + height
  );
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function createTextTexture({
  text,
  fontSize = 46,
  fontWeight = 800,
  paddingX = 24,
  paddingY = 12,
  background = "rgba(255, 255, 255, 0.78)",
  border = "rgba(35, 72, 96, 0.18)",
  textColor = "#173047",
  haloColor = "rgba(255, 255, 255, 0.92)",
  radius = 28
}) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    MAX_PIXEL_RATIO
  );
  const font = `${fontWeight} ${fontSize}px ${LABEL_FONT}`;

  context.font = font;
  const metrics = context.measureText(text);
  const width = Math.ceil(metrics.width + paddingX * 2);
  const height = Math.ceil(fontSize + paddingY * 2);

  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, width, height);

  if (background) {
    context.fillStyle = background;
    roundedRect(context, 1, 1, width - 2, height - 2, radius);
    context.fill();
  }

  if (border) {
    context.strokeStyle = border;
    context.lineWidth = 2;
    roundedRect(context, 2, 2, width - 4, height - 4, radius);
    context.stroke();
  }

  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";

  if (haloColor) {
    context.lineWidth = 6;
    context.strokeStyle = haloColor;
    context.strokeText(text, width / 2, height / 2 + 1);
  }

  context.fillStyle = textColor;
  context.fillText(text, width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    aspect: width / height
  };
}

function createLabelSprite(text, options = {}) {
  const labelTexture = createTextTexture({
    text,
    ...options
  });

  if (!labelTexture) {
    return new THREE.Sprite();
  }

  const material = new THREE.SpriteMaterial({
    map: labelTexture.texture,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const height = options.worldHeight ?? 0.22;

  sprite.scale.set(height * labelTexture.aspect, height, 1);
  sprite.renderOrder = options.renderOrder ?? 24;
  sprite.userData = {
    ...sprite.userData,
    includeInFrame: false,
    isAtomContributionLabel: true
  };

  return sprite;
}

function createAtomContributionLabel({ text, color }) {
  const baseColor = new THREE.Color(color ?? 0x2d77a8);
  const accentColor = `rgba(${Math.round(baseColor.r * 255)}, ${Math.round(
    baseColor.g * 255
  )}, ${Math.round(baseColor.b * 255)}, 0.18)`;

  return createLabelSprite(text, {
    fontSize: 48,
    fontWeight: 850,
    paddingX: 22,
    paddingY: 12,
    background: "rgba(255, 255, 255, 0.78)",
    border: accentColor,
    textColor: toCssColor(color),
    worldHeight: 0.23,
    renderOrder: 26
  });
}

function createFormulaLabel({ text, color }) {
  return createLabelSprite(text, {
    fontSize: 44,
    fontWeight: 800,
    paddingX: 26,
    paddingY: 12,
    background: "rgba(255, 255, 255, 0.48)",
    border: "",
    textColor: toCssColor(color, "#173047"),
    haloColor: "rgba(255, 255, 255, 0.96)",
    radius: 18,
    worldHeight: 0.25,
    renderOrder: 28
  });
}

function createHoverHintLabel({ text, color }) {
  return createLabelSprite(text, {
    fontSize: 36,
    fontWeight: 760,
    paddingX: 18,
    paddingY: 9,
    background: "rgba(255, 255, 255, 0.7)",
    border: "rgba(35, 72, 96, 0.12)",
    textColor: toCssColor(color, "#173047"),
    haloColor: "rgba(255, 255, 255, 0.9)",
    radius: 18,
    worldHeight: 0.17,
    renderOrder: 30
  });
}

function disposeLabelSprite(sprite) {
  if (!sprite) {
    return;
  }

  const material = sprite.material;

  if (Array.isArray(material)) {
    material.forEach((entry) => {
      entry.map?.dispose?.();
      entry.dispose?.();
    });
    return;
  }

  material?.map?.dispose?.();
  material?.dispose?.();
}

Object.assign(namespace, {
  createAtomContributionLabel,
  createFormulaLabel,
  createHoverHintLabel,
  disposeLabelSprite
});

window.CrystalCellVisualizer = namespace;
})(window);
