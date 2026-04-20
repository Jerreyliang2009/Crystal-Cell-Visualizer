const statusElement = document.getElementById("panel-status");
const crystalSummaryElement = document.getElementById("crystal-summary");
const floatingPanel = document.getElementById("floating-ui");
const floatingPanelBody = document.getElementById("floating-ui-body");
const knowledgeStack = document.getElementById("knowledge-stack");
const coordinationPanel = document.getElementById("coordination-floating");
const coordinationContentElement = document.getElementById("coordination-content");
const countingPanel = document.getElementById("counting-floating");
const countingContentElement = document.getElementById("counting-content");
const atomLegendPanel = document.getElementById("atom-legend-floating");
const atomLegendContentElement = document.getElementById("atom-legend-content");
const atomLegendCardElement = atomLegendPanel?.querySelector(".atom-legend-card");
const panelSideToolbar = document.querySelector(".panel-side-toolbar");
const panelCollapseToolbar = document.querySelector(".panel-collapse-toolbar");
const panelCollapseButton = document.getElementById("btn-panel-collapse");
const panelSideButton = document.getElementById("btn-panel-side");

const PANEL_LAYOUT_STORAGE_KEY = "crystal-cell-visualizer-panel-layout";
const FLOATING_PANEL_GAP = 12;
const ATTACHED_PANEL_GAP = 8;
const COUNTING_CARD_MIN_SHARE = 180;
const COORDINATION_CARD_MIN_SHARE = 108;
const COORDINATION_CARD_MAX_SHARE_RATIO = 0.34;
const COORDINATION_CARD_SOFT_MAX_HEIGHT = 280;
const LEGEND_AXIS_MIN_SIZE = 88;
const LEGEND_AXIS_MAX_SIZE = 148;
const LEGEND_AXIS_TARGET_SIZE = 96;
const LEGEND_COMPACT_MIN_WIDTH = 112;
const LEGEND_MIN_WIDTH = 132;
const LEGEND_AXIS_ROW_GAP = 12;
const ATOM_LEGEND_FIXED_WIDTH = 312;
const ATOM_LEGEND_FIXED_HEIGHT = 141;
const PANEL_TOOLBAR_FALLBACK_HEIGHT = 48;
const CARD_ANIMATION_MS = 240;
const PANEL_MOVE_ANIMATION_MS = 260;
const ATOM_LEGEND_MOVE_ANIMATION_MS = PANEL_MOVE_ANIMATION_MS;
const panelLayoutRectCache = new WeakMap();
const cardAnimationState = new WeakMap();
const panelMoveAnimationState = new WeakMap();
let showAxesState = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateButtonState(button, isActive) {
  if (!button) {
    return;
  }

  button.classList.toggle("is-active", isActive);
  button.setAttribute("aria-pressed", String(isActive));
}

function setButtonAvailability(button, isEnabled) {
  if (!button) {
    return;
  }

  button.disabled = !isEnabled;

  if (!isEnabled) {
    updateButtonState(button, false);
  }
}

function normalizePanelSide(side) {
  return side === "left" ? "left" : "right";
}

function getViewportInset() {
  if (window.innerWidth <= 640) {
    return 10;
  }

  if (window.innerWidth <= 900) {
    return 12;
  }

  return 24;
}

function getPanelToolbarSide(panelSide) {
  return normalizePanelSide(panelSide) === "left" ? "right" : "left";
}

function getPanelCollapseToolbarSide(panelSide) {
  return normalizePanelSide(panelSide);
}

function syncToolbarElementSide(toolbarElement, side) {
  if (!toolbarElement) {
    return;
  }

  toolbarElement.classList.toggle("is-left", side === "left");
  toolbarElement.classList.toggle("is-right", side === "right");
  toolbarElement.dataset.side = side;
}

function syncPanelToolbarSide(panelSide) {
  syncToolbarElementSide(panelSideToolbar, getPanelToolbarSide(panelSide));
  syncToolbarElementSide(
    panelCollapseToolbar,
    getPanelCollapseToolbarSide(panelSide)
  );
}

function getToolbarReserve(toolbarElement) {
  if (!toolbarElement) {
    return 0;
  }

  const toolbarRect = toolbarElement.getBoundingClientRect();
  const toolbarHeight =
    toolbarRect.height > 0
      ? toolbarRect.height
      : PANEL_TOOLBAR_FALLBACK_HEIGHT;

  return Math.ceil(toolbarHeight + FLOATING_PANEL_GAP);
}

function getPanelToolbarReserve() {
  return getToolbarReserve(panelSideToolbar);
}

function getPanelCollapseToolbarReserve() {
  return getToolbarReserve(panelCollapseToolbar);
}

function readStoredPanelLayout() {
  try {
    const raw = window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);

    if (!raw) {
      return {
        panelSide: "right",
        panelCollapsed: false
      };
    }

    const parsed = JSON.parse(raw);

    return {
      panelSide: normalizePanelSide(parsed?.panelSide),
      panelCollapsed: Boolean(parsed?.panelCollapsed)
    };
  } catch {
    return {
      panelSide: "right",
      panelCollapsed: false
    };
  }
}

function persistPanelLayout(state) {
  try {
    window.localStorage.setItem(
      PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        panelSide: normalizePanelSide(state.panelSide),
        panelCollapsed: Boolean(state.panelCollapsed)
      })
    );
  } catch {
    // Ignore storage failures and keep the in-memory state only.
  }
}

function syncPanelToggleButtons(state) {
  if (panelCollapseButton) {
    const collapseText = state.panelCollapsed ? "展开信息栏" : "收起信息栏";

    panelCollapseButton.textContent = collapseText;
    panelCollapseButton.setAttribute("aria-label", collapseText);
    panelCollapseButton.setAttribute("title", collapseText);
    panelCollapseButton.setAttribute(
      "aria-expanded",
      String(!state.panelCollapsed)
    );
  }

  if (panelSideButton) {
    const moveText = state.panelSide === "left" ? "移到右侧" : "移到左侧";
    const moveLabel =
      state.panelSide === "left"
        ? "切换信息栏到右侧"
        : "切换信息栏到左侧";

    panelSideButton.textContent = moveText;
    panelSideButton.setAttribute("aria-label", moveLabel);
    panelSideButton.setAttribute("title", moveLabel);
  }
}

function updateKnowledgeStackVisibility() {
  if (!knowledgeStack) {
    return;
  }

  const hasVisiblePanel = Boolean(
    (countingPanel && !countingPanel.hidden) ||
      (coordinationPanel && !coordinationPanel.hidden)
  );

  knowledgeStack.hidden = !hasVisiblePanel;
  knowledgeStack.setAttribute("aria-hidden", String(!hasVisiblePanel));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getKnowledgeCardElement(panelElement) {
  if (!isPanelVisible(panelElement)) {
    return null;
  }

  if (
    (panelElement === coordinationPanel || panelElement === countingPanel) &&
    panelElement.classList.contains("is-detached")
  ) {
    return null;
  }

  const cardElement = panelElement.querySelector(".knowledge-card");

  return cardElement instanceof HTMLElement ? cardElement : null;
}

function getVisibleKnowledgeReferencePanel() {
  if (isPanelVisible(coordinationPanel)) {
    return coordinationPanel;
  }

  if (isPanelVisible(countingPanel)) {
    return countingPanel;
  }

  return null;
}

function isPanelVisible(panelElement) {
  return Boolean(
    panelElement &&
      !panelElement.hidden &&
      panelElement.dataset.layoutHidden !== "true"
  );
}

function getPanelRect(panelElement) {
  if (!isPanelVisible(panelElement)) {
    return null;
  }

  const rect = panelElement.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return rect;
}

function clearDetachedPanelRect(panelElement) {
  if (!panelElement) {
    return;
  }

  delete panelElement.dataset.detachedLeft;
  delete panelElement.dataset.detachedTop;
  delete panelElement.dataset.detachedWidth;
  delete panelElement.dataset.detachedHeight;
}

function setDetachedPanelRect(panelElement, rect) {
  if (!panelElement || !rect) {
    return;
  }

  panelLayoutRectCache.set(panelElement, {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom
  });

  panelElement.dataset.detachedLeft = String(Math.round(rect.left));
  panelElement.dataset.detachedTop = String(Math.round(rect.top));
  panelElement.dataset.detachedWidth = String(Math.round(rect.width));
  panelElement.dataset.detachedHeight = String(Math.round(rect.height));
}

function getDetachedPanelLeft(side, width, inset) {
  return side === "left"
    ? inset
    : Math.max(inset, window.innerWidth - inset - width);
}

function resolveDetachedPanelRect({
  panelElement,
  cardElement,
  liveRect,
  side,
  inset,
  width,
  bottom
}) {
  if (liveRect && liveRect.width > 0 && liveRect.height > 0) {
    return {
      left: liveRect.left,
      top: liveRect.top,
      width: liveRect.width,
      height: liveRect.height,
      right: liveRect.right,
      bottom: liveRect.bottom
    };
  }

  const cardRect =
    cardElement instanceof HTMLElement ? cardElement.getBoundingClientRect() : null;
  const fallbackWidth =
    liveRect?.width && liveRect.width > 0 ? liveRect.width : Math.max(0, width);
  const fallbackHeight =
    cardRect && cardRect.height > 0
      ? cardRect.height
      : cardElement instanceof HTMLElement
        ? Math.max(cardElement.scrollHeight, cardElement.offsetHeight)
        : 0;

  if (!(fallbackWidth > 0 && fallbackHeight > 0)) {
    return null;
  }

  const left = getDetachedPanelLeft(side, fallbackWidth, inset);
  const top = Math.max(
    inset,
    Math.round(window.innerHeight - bottom - fallbackHeight)
  );

  return {
    left,
    top,
    width: fallbackWidth,
    height: fallbackHeight,
    right: left + fallbackWidth,
    bottom: top + fallbackHeight
  };
}

function getPanelLayoutRect(panelElement) {
  if (!isPanelVisible(panelElement)) {
    return null;
  }

  if (panelElement.classList.contains("is-detached")) {
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
  }

  const liveRect = getPanelRect(panelElement);

  if (liveRect) {
    panelLayoutRectCache.set(panelElement, {
      left: liveRect.left,
      top: liveRect.top,
      width: liveRect.width,
      height: liveRect.height,
      right: liveRect.right,
      bottom: liveRect.bottom
    });
    return liveRect;
  }

  return panelLayoutRectCache.get(panelElement) ?? null;
}

function getReferencePanelWidth(panelElement, fallbackWidth = 220) {
  const panelRect = getPanelLayoutRect(panelElement);

  if (panelRect) {
    return panelRect.width;
  }

  const stackRect = knowledgeStack?.getBoundingClientRect();

  if (stackRect && stackRect.width > 0) {
    return stackRect.width;
  }

  return fallbackWidth;
}

function getKnowledgeColumnWidth(inset) {
  const stackRect = knowledgeStack?.getBoundingClientRect();

  if (stackRect && stackRect.width > 0) {
    return Math.round(stackRect.width);
  }

  if (window.innerWidth <= 640) {
    return Math.max(220, window.innerWidth - inset * 2);
  }

  const maxWidth = window.innerWidth <= 900 ? 400 : 420;

  return Math.max(220, Math.min(maxWidth, window.innerWidth - inset * 2));
}

function toCssColor(value, fallback = "#7d8d99") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function prefersReducedCardMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function clearAnimatedPanelStyles(panelElement, { keepOpenClass = false } = {}) {
  if (!panelElement) {
    return;
  }

  panelElement.style.height = "";
  panelElement.style.maxHeight = "";
  panelElement.style.overflow = "";
  panelElement.classList.remove(
    "is-card-animating",
    "is-card-entering",
    "is-card-leaving"
  );

  if (!keepOpenClass) {
    panelElement.classList.remove("is-card-open");
  }
}

function measureExpandedPanelHeight(panelElement) {
  if (!panelElement) {
    return 0;
  }

  const previousHeight = panelElement.style.height;
  const previousMaxHeight = panelElement.style.maxHeight;
  const previousOverflow = panelElement.style.overflow;

  panelElement.style.height = "";
  panelElement.style.maxHeight = "";
  panelElement.style.overflow = "";

  const rectHeight = panelElement.getBoundingClientRect().height;
  const measuredHeight = Math.max(rectHeight, panelElement.scrollHeight);

  panelElement.style.height = previousHeight;
  panelElement.style.maxHeight = previousMaxHeight;
  panelElement.style.overflow = previousOverflow;

  return Math.ceil(measuredHeight);
}

function setImmediatePanelVisibility(panelElement, isVisible, options = {}) {
  if (!panelElement) {
    return;
  }

  const { ariaHidden = true } = options;

  clearAnimatedPanelStyles(panelElement, {
    keepOpenClass: isVisible
  });
  panelElement.classList.toggle("card-animated-panel", true);
  panelElement.hidden = !isVisible;

  if (ariaHidden) {
    panelElement.setAttribute("aria-hidden", String(!isVisible));
  }

  panelElement.classList.toggle("is-card-open", isVisible);
}

function setAnimatedPanelVisibility(panelElement, isVisible, options = {}) {
  if (!panelElement) {
    return;
  }

  const {
    animateHeight = false,
    ariaHidden = true,
    onAfterShow,
    onAfterHide
  } = options;
  const previousState = cardAnimationState.get(panelElement);
  const isCurrentlyVisible = !panelElement.hidden;
  const isCurrentlyAnimating = panelElement.classList.contains("is-card-animating");

  if (
    isCurrentlyVisible === isVisible &&
    !isCurrentlyAnimating &&
    previousState?.targetVisible !== !isVisible
  ) {
    setImmediatePanelVisibility(panelElement, isVisible, {
      ariaHidden
    });

    if (isVisible) {
      onAfterShow?.();
    } else {
      onAfterHide?.();
    }

    return;
  }

  if (previousState?.timer) {
    window.clearTimeout(previousState.timer);
  }

  const token = (previousState?.token ?? 0) + 1;
  const shouldReduceMotion = prefersReducedCardMotion();

  cardAnimationState.set(panelElement, {
    token,
    targetVisible: isVisible,
    timer: 0
  });

  if (shouldReduceMotion) {
    setImmediatePanelVisibility(panelElement, isVisible, {
      ariaHidden
    });

    if (isVisible) {
      onAfterShow?.();
    } else {
      onAfterHide?.();
    }

    return;
  }

  const finish = () => {
    const activeState = cardAnimationState.get(panelElement);

    if (!activeState || activeState.token !== token) {
      return;
    }

    if (isVisible) {
      clearAnimatedPanelStyles(panelElement, {
        keepOpenClass: true
      });
      onAfterShow?.();
    } else {
      panelElement.hidden = true;
      clearAnimatedPanelStyles(panelElement);
      onAfterHide?.();
    }
  };

  const startTimer = () => {
    const duration = Number.parseFloat(
      window
        .getComputedStyle(panelElement)
        .getPropertyValue("--card-animation-duration")
    );
    const timeout = window.setTimeout(
      finish,
      (Number.isFinite(duration) ? duration : CARD_ANIMATION_MS) + 60
    );

    cardAnimationState.set(panelElement, {
      token,
      targetVisible: isVisible,
      timer: timeout
    });
  };
  const runAfterLayoutFrame = (callback) => {
    let didRun = false;
    const run = () => {
      if (didRun) {
        return;
      }

      didRun = true;
      callback();
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
    window.setTimeout(run, 32);
  };

  panelElement.classList.add("card-animated-panel", "is-card-animating");

  if (isVisible) {
    panelElement.hidden = false;

    if (ariaHidden) {
      panelElement.setAttribute("aria-hidden", "false");
    }

    clearAnimatedPanelStyles(panelElement);
    panelElement.classList.add(
      "card-animated-panel",
      "is-card-animating",
      "is-card-entering"
    );

    const targetHeight = animateHeight ? measureExpandedPanelHeight(panelElement) : 0;

    if (animateHeight) {
      panelElement.style.height = "0px";
      panelElement.style.maxHeight = "0px";
      panelElement.style.overflow = "hidden";
    }

    panelElement.getBoundingClientRect();

    runAfterLayoutFrame(() => {
      const activeState = cardAnimationState.get(panelElement);

      if (!activeState || activeState.token !== token) {
        return;
      }

      panelElement.classList.remove("is-card-entering");
      panelElement.classList.add("is-card-open");

      if (animateHeight) {
        panelElement.style.height = `${targetHeight}px`;
        panelElement.style.maxHeight = `${targetHeight}px`;
      }
    });
  } else {
    if (ariaHidden) {
      panelElement.setAttribute("aria-hidden", "true");
    }

    if (panelElement.hidden) {
      finish();
      return;
    }

    const currentHeight = panelElement.getBoundingClientRect().height;

    clearAnimatedPanelStyles(panelElement, {
      keepOpenClass: true
    });
    panelElement.classList.add(
      "card-animated-panel",
      "is-card-animating",
      "is-card-open"
    );

    if (animateHeight) {
      panelElement.style.height = `${Math.max(0, currentHeight)}px`;
      panelElement.style.maxHeight = `${Math.max(0, currentHeight)}px`;
      panelElement.style.overflow = "hidden";
    }

    panelElement.getBoundingClientRect();

    runAfterLayoutFrame(() => {
      const activeState = cardAnimationState.get(panelElement);

      if (!activeState || activeState.token !== token) {
        return;
      }

      panelElement.classList.remove("is-card-open");
      panelElement.classList.add("is-card-leaving");

      if (animateHeight) {
        panelElement.style.height = "0px";
        panelElement.style.maxHeight = "0px";
      }
    });
  }

  startTimer();
}

function getVisibleElementRect(element) {
  if (!element || element.hidden) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return rect;
}

function animatePanelMoveFrom(element, previousRect, options = {}) {
  if (!element || !previousRect || prefersReducedCardMotion()) {
    return;
  }

  const durationMs = options.durationMs ?? PANEL_MOVE_ANIMATION_MS;
  const nextRect = getVisibleElementRect(element);

  if (!nextRect) {
    return;
  }

  const deltaX = previousRect.left - nextRect.left;
  const deltaY = previousRect.top - nextRect.top;
  const scaleX = nextRect.width > 0 ? previousRect.width / nextRect.width : 1;
  const scaleY = nextRect.height > 0 ? previousRect.height / nextRect.height : 1;

  if (
    Math.abs(deltaX) < 1 &&
    Math.abs(deltaY) < 1 &&
    Math.abs(scaleX - 1) < 0.01 &&
    Math.abs(scaleY - 1) < 0.01
  ) {
    return;
  }

  const previousState = panelMoveAnimationState.get(element);

  if (previousState?.timer) {
    window.clearTimeout(previousState.timer);
  }

  element.classList.remove("is-panel-moving");
  element.style.setProperty("--panel-move-duration", `${durationMs}ms`);
  element.style.transition = "none";
  element.style.transformOrigin = "top left";
  element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
  element.style.opacity = "0.98";
  element.getBoundingClientRect();

  element.classList.add("is-panel-moving");
  element.style.transition = "";
  element.getBoundingClientRect();

  window.requestAnimationFrame(() => {
    element.style.transform = "translate(0, 0)";
    element.style.opacity = "";
  });

  const timer = window.setTimeout(() => {
    element.classList.remove("is-panel-moving");
    element.style.transform = "";
    element.style.transformOrigin = "";
    element.style.opacity = "";
    element.style.transition = "";
    element.style.removeProperty("--panel-move-duration");
    panelMoveAnimationState.delete(element);
  }, durationMs + 80);

  panelMoveAnimationState.set(element, {
    timer
  });
}

function resetKnowledgeCardHeights() {
  [countingPanel, coordinationPanel].forEach((panelElement) => {
    const cardElement = panelElement?.querySelector(".knowledge-card");

    if (cardElement instanceof HTMLElement) {
      cardElement.style.maxHeight = "";
    }
  });
}

function shouldDetachCoordinationPanel() {
  return Boolean(
    coordinationPanel &&
      isPanelVisible(coordinationPanel) &&
      window.innerWidth > 640
  );
}

function shouldDetachCountingPanel() {
  return Boolean(
    countingPanel &&
      isPanelVisible(countingPanel) &&
      window.innerWidth > 640
  );
}

function resetCountingPanelLayout() {
  if (!countingPanel) {
    return;
  }

  countingPanel.classList.remove("is-detached", "is-left", "is-right");
  clearDetachedPanelRect(countingPanel);
  countingPanel.style.left = "";
  countingPanel.style.right = "";
  countingPanel.style.bottom = "";
  countingPanel.style.width = "";

  const countingCardElement = countingPanel.querySelector(".knowledge-card");

  if (countingCardElement instanceof HTMLElement) {
    countingCardElement.style.maxHeight = "";
  }
}

function resetCoordinationPanelLayout() {
  if (!coordinationPanel) {
    return;
  }

  coordinationPanel.classList.remove("is-detached", "is-left", "is-right");
  clearDetachedPanelRect(coordinationPanel);
  coordinationPanel.style.left = "";
  coordinationPanel.style.right = "";
  coordinationPanel.style.bottom = "";
  coordinationPanel.style.width = "";

  const coordinationCardElement = coordinationPanel.querySelector(".knowledge-card");

  if (coordinationCardElement instanceof HTMLElement) {
    coordinationCardElement.style.maxHeight = "";
  }
}

function syncDetachedCoordinationPanelLayout(inset) {
  if (!isPanelVisible(coordinationPanel)) {
    resetCoordinationPanelLayout();
    return 0;
  }

  if (!shouldDetachCoordinationPanel()) {
    resetCoordinationPanelLayout();
    return 0;
  }

  const coordinationCardElement = coordinationPanel.querySelector(".knowledge-card");
  const knowledgeSide =
    knowledgeStack?.dataset.side === "right" ? "right" : "left";
  const referenceWidth = getKnowledgeColumnWidth(inset);
  const panelBottom = inset + getPanelToolbarReserve();

  coordinationPanel.classList.add("is-detached");
  coordinationPanel.classList.toggle("is-left", knowledgeSide === "left");
  coordinationPanel.classList.toggle("is-right", knowledgeSide === "right");
  coordinationPanel.style.width = `${referenceWidth}px`;
  coordinationPanel.style.bottom = `${panelBottom}px`;

  if (knowledgeSide === "left") {
    coordinationPanel.style.left = `${inset}px`;
    coordinationPanel.style.right = "auto";
  } else {
    coordinationPanel.style.left = "auto";
    coordinationPanel.style.right = `${inset}px`;
  }

  if (coordinationCardElement instanceof HTMLElement) {
    coordinationCardElement.style.maxHeight = `${Math.max(
      COORDINATION_CARD_MIN_SHARE,
      Math.floor(window.innerHeight * 0.32)
    )}px`;
  }

  const coordinationRect = resolveDetachedPanelRect({
    panelElement: coordinationPanel,
    cardElement: coordinationCardElement,
    liveRect: coordinationPanel.getBoundingClientRect(),
    side: knowledgeSide,
    inset,
    width: referenceWidth,
    bottom: panelBottom
  });

  if (!coordinationRect) {
    clearDetachedPanelRect(coordinationPanel);
    return 0;
  }

  setDetachedPanelRect(coordinationPanel, coordinationRect);
  return coordinationRect.height + FLOATING_PANEL_GAP;
}

function syncDetachedCountingPanelLayout(inset, bottomOffset = 0) {
  if (!isPanelVisible(countingPanel)) {
    resetCountingPanelLayout();
    return 0;
  }

  if (!shouldDetachCountingPanel()) {
    resetCountingPanelLayout();
    return 0;
  }

  const countingCardElement = countingPanel.querySelector(".knowledge-card");
  const knowledgeSide =
    knowledgeStack?.dataset.side === "right" ? "right" : "left";
  const referenceWidth = getKnowledgeColumnWidth(inset);
  const panelBottom = inset + getPanelToolbarReserve() + bottomOffset;

  countingPanel.classList.add("is-detached");
  countingPanel.classList.toggle("is-left", knowledgeSide === "left");
  countingPanel.classList.toggle("is-right", knowledgeSide === "right");
  countingPanel.style.width = `${referenceWidth}px`;
  countingPanel.style.bottom = `${panelBottom}px`;

  if (knowledgeSide === "left") {
    countingPanel.style.left = `${inset}px`;
    countingPanel.style.right = "auto";
  } else {
    countingPanel.style.left = "auto";
    countingPanel.style.right = `${inset}px`;
  }

  if (countingCardElement instanceof HTMLElement) {
    const viewportAllowance = bottomOffset > 0 ? 0.38 : 0.5;
    countingCardElement.style.maxHeight = `${Math.max(
      COUNTING_CARD_MIN_SHARE,
      Math.floor(window.innerHeight * viewportAllowance)
    )}px`;
  }

  const countingRect = resolveDetachedPanelRect({
    panelElement: countingPanel,
    cardElement: countingCardElement,
    liveRect: countingPanel.getBoundingClientRect(),
    side: knowledgeSide,
    inset,
    width: referenceWidth,
    bottom: panelBottom
  });

  if (!countingRect) {
    clearDetachedPanelRect(countingPanel);
    return 0;
  }

  setDetachedPanelRect(countingPanel, countingRect);
  return countingRect.height + FLOATING_PANEL_GAP;
}

function measureAtomLegendHeight(targetWidth, layoutMode = "default") {
  if (!atomLegendPanel || atomLegendPanel.hidden) {
    return 0;
  }

  return ATOM_LEGEND_FIXED_HEIGHT;

  const previousWidth = atomLegendPanel.style.width;
  const previousHeight = atomLegendPanel.style.height;
  const previousTop = atomLegendPanel.style.top;
  const previousBottom = atomLegendPanel.style.bottom;
  const previousLeft = atomLegendPanel.style.left;
  const previousRight = atomLegendPanel.style.right;
  const previousCardHeight = atomLegendCardElement?.style.height ?? "";
  const previousLayoutMode = atomLegendPanel.dataset.layoutMode ?? "";
  const previousAxisSize = atomLegendPanel.dataset.axisSize ?? "";
  const previousAxisHeight = atomLegendPanel.dataset.axisHeight ?? "";
  const previousRowHeight = atomLegendPanel.dataset.rowHeight ?? "";
  const previousReferenceWidth = atomLegendPanel.dataset.referenceWidth ?? "";
  const previousRowGap = atomLegendPanel.dataset.rowGap ?? "";

  if (targetWidth > 0) {
    atomLegendPanel.style.width = `${targetWidth}px`;
  }
  atomLegendPanel.style.height = "";
  atomLegendPanel.style.top = "auto";
  atomLegendPanel.style.bottom = "auto";
  atomLegendPanel.style.left = "-9999px";
  atomLegendPanel.style.right = "auto";
  atomLegendPanel.dataset.layoutMode = layoutMode;
  atomLegendPanel.dataset.axisSize = "";
  atomLegendPanel.dataset.axisHeight = "";
  atomLegendPanel.dataset.rowHeight = "";
  atomLegendPanel.dataset.referenceWidth = "";
  atomLegendPanel.dataset.rowGap = "";

  if (atomLegendCardElement) {
    atomLegendCardElement.style.height = "100%";
  }

  const legendHeight = Math.ceil(atomLegendPanel.getBoundingClientRect().height);

  atomLegendPanel.style.width = previousWidth;
  atomLegendPanel.style.height = previousHeight;
  atomLegendPanel.style.top = previousTop;
  atomLegendPanel.style.bottom = previousBottom;
  atomLegendPanel.style.left = previousLeft;
  atomLegendPanel.style.right = previousRight;
  atomLegendPanel.dataset.layoutMode = previousLayoutMode;
  atomLegendPanel.dataset.axisSize = previousAxisSize;
  atomLegendPanel.dataset.axisHeight = previousAxisHeight;
  atomLegendPanel.dataset.rowHeight = previousRowHeight;
  atomLegendPanel.dataset.referenceWidth = previousReferenceWidth;
  atomLegendPanel.dataset.rowGap = previousRowGap;

  if (atomLegendCardElement) {
    atomLegendCardElement.style.height = previousCardHeight;
  }

  return legendHeight;
}

function buildLegendAxisRowSpec(mode, totalWidth) {
  const compactLegendMinWidth = Math.max(LEGEND_COMPACT_MIN_WIDTH, LEGEND_MIN_WIDTH);
  const maxAxisSize = Math.max(LEGEND_AXIS_MIN_SIZE, LEGEND_AXIS_MAX_SIZE);
  const axisSize = clampNumber(
    LEGEND_AXIS_TARGET_SIZE,
    LEGEND_AXIS_MIN_SIZE,
    maxAxisSize
  );
  const availableLegendWidth = totalWidth - LEGEND_AXIS_ROW_GAP - axisSize;
  const legendWidth = clampNumber(
    ATOM_LEGEND_FIXED_WIDTH,
    compactLegendMinWidth,
    Math.max(compactLegendMinWidth, availableLegendWidth)
  );
  const legendNaturalHeight = ATOM_LEGEND_FIXED_HEIGHT;
  const rowHeight = Math.max(axisSize, legendNaturalHeight);

  return {
    mode,
    reserveTop: rowHeight + ATTACHED_PANEL_GAP,
    referenceWidth: totalWidth,
    axisSize,
    rowHeight,
    legendHeight: legendNaturalHeight,
    rowGap: LEGEND_AXIS_ROW_GAP,
    legendWidth
  };
}

function getAtomLegendLayoutPlan(inset) {
  if (!atomLegendPanel || atomLegendPanel.hidden || window.innerWidth <= 640) {
    return {
      mode: "default",
      reserveTop: 0
    };
  }

  const coordinationVisible = isPanelVisible(coordinationPanel);
  const countingVisible = isPanelVisible(countingPanel);
  const referenceWidth = getKnowledgeColumnWidth(inset);

  if (countingVisible) {
    const legendWidth = Math.min(ATOM_LEGEND_FIXED_WIDTH, referenceWidth);
    const legendHeight = ATOM_LEGEND_FIXED_HEIGHT;

    return {
      mode: "count",
      reserveTop: legendHeight + ATTACHED_PANEL_GAP,
      referenceWidth,
      legendWidth,
      legendHeight
    };
  }

  if (coordinationVisible) {
    const legendWidth = Math.min(ATOM_LEGEND_FIXED_WIDTH, referenceWidth);
    const legendHeight = ATOM_LEGEND_FIXED_HEIGHT;

    return {
      mode: "coordination",
      reserveTop: legendHeight + ATTACHED_PANEL_GAP,
      referenceWidth,
      legendWidth,
      legendHeight
    };
  }

  return {
    mode: "default",
    reserveTop: 0
  };
}

function getAxisWidgetTopBoundary(inset) {
  if (!showAxesState) {
    return inset;
  }

  const axisWidgetElement = document.querySelector(".axis-widget-overlay");

  if (!(axisWidgetElement instanceof HTMLElement)) {
    return inset;
  }

  const computedStyle = window.getComputedStyle(axisWidgetElement);

  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    Number.parseFloat(computedStyle.opacity || "1") <= 0
  ) {
    return inset;
  }

  const axisRect = axisWidgetElement.getBoundingClientRect();

  if (axisRect.width <= 0 || axisRect.height <= 0) {
    return inset;
  }

  if (!knowledgeStack || knowledgeStack.hidden || window.innerWidth <= 640) {
    return Math.max(inset, Math.round(axisRect.bottom + FLOATING_PANEL_GAP));
  }

  const knowledgeSide =
    knowledgeStack.dataset.side === "right" ? "right" : "left";
  const axisSide =
    axisRect.left + axisRect.width * 0.5 <= window.innerWidth * 0.5
      ? "left"
      : "right";

  if (knowledgeSide !== axisSide) {
    return inset;
  }

  return Math.max(inset, Math.round(axisRect.bottom + FLOATING_PANEL_GAP));
}

function getAtomLegendTopBoundary(inset) {
  if (!atomLegendPanel || atomLegendPanel.hidden) {
    return inset;
  }

  const legendRect = atomLegendPanel.getBoundingClientRect();

  if (legendRect.width <= 0 || legendRect.height <= 0) {
    return inset;
  }

  if (!knowledgeStack || knowledgeStack.hidden || window.innerWidth <= 640) {
    return Math.max(inset, Math.round(legendRect.bottom + FLOATING_PANEL_GAP));
  }

  const knowledgeSide =
    knowledgeStack.dataset.side === "right" ? "right" : "left";
  const legendSide =
    legendRect.left + legendRect.width * 0.5 <= window.innerWidth * 0.5
      ? "left"
      : "right";

  if (knowledgeSide !== legendSide) {
    return inset;
  }

  return Math.max(inset, Math.round(legendRect.bottom + FLOATING_PANEL_GAP));
}

function syncKnowledgeCardHeights(availableStackHeight) {
  const countingCardElement = getKnowledgeCardElement(countingPanel);
  const coordinationCardElement = getKnowledgeCardElement(coordinationPanel);

  [countingCardElement, coordinationCardElement].forEach((cardElement) => {
    if (cardElement) {
      cardElement.style.maxHeight = "none";
    }
  });

  const visibleCards = [
    countingCardElement
      ? {
          id: "counting",
          element: countingCardElement,
          naturalHeight: countingCardElement.scrollHeight
        }
      : null,
    coordinationCardElement
      ? {
          id: "coordination",
          element: coordinationCardElement,
          naturalHeight: coordinationCardElement.scrollHeight
        }
      : null
  ].filter(Boolean);

  if (!visibleCards.length || !Number.isFinite(availableStackHeight)) {
    return;
  }

  const availableHeight = Math.max(
    0,
    Math.floor(
      availableStackHeight - FLOATING_PANEL_GAP * Math.max(0, visibleCards.length - 1)
    )
  );

  if (visibleCards.length === 1) {
    visibleCards[0].element.style.maxHeight = `${Math.max(0, availableHeight)}px`;
    return;
  }

  const countingEntry = visibleCards.find((entry) => entry.id === "counting");
  const coordinationEntry = visibleCards.find(
    (entry) => entry.id === "coordination"
  );

  if (!countingEntry || !coordinationEntry) {
    visibleCards.forEach((entry) => {
      entry.element.style.maxHeight = `${Math.max(
        0,
        Math.floor(availableHeight / visibleCards.length)
      )}px`;
    });
    return;
  }

  if (availableHeight <= 240) {
    const countingHeight = Math.floor(availableHeight * 0.66);
    const coordinationHeight = Math.max(0, availableHeight - countingHeight);

    countingEntry.element.style.maxHeight = `${Math.max(0, countingHeight)}px`;
    coordinationEntry.element.style.maxHeight = `${Math.max(
      0,
      coordinationHeight
    )}px`;
    return;
  }

  const coordinationMinimum = Math.min(
    coordinationEntry.naturalHeight,
    COORDINATION_CARD_MIN_SHARE
  );
  const coordinationPreferred = Math.min(
    coordinationEntry.naturalHeight,
    Math.max(
      coordinationMinimum,
      Math.min(
        COORDINATION_CARD_SOFT_MAX_HEIGHT,
        Math.floor(availableHeight * COORDINATION_CARD_MAX_SHARE_RATIO)
      )
    )
  );
  const countingMinimum = Math.min(
    countingEntry.naturalHeight,
    Math.max(COUNTING_CARD_MIN_SHARE, Math.floor(availableHeight * 0.52))
  );
  const coordinationCap = Math.max(0, availableHeight - countingMinimum);
  const coordinationHeight = clampNumber(
    coordinationPreferred,
    Math.min(coordinationMinimum, coordinationCap),
    coordinationCap
  );
  const countingHeight = Math.max(0, availableHeight - coordinationHeight);

  countingEntry.element.style.maxHeight = `${countingHeight}px`;
  coordinationEntry.element.style.maxHeight = `${coordinationHeight}px`;
}

function syncAtomLegendLayout(inset, layoutPlan = getAtomLegendLayoutPlan(inset)) {
  if (!atomLegendPanel || atomLegendPanel.hidden) {
    return;
  }

  const legendSide = floatingPanel?.classList.contains("is-left") ? "right" : "left";
  const useCompactLayout = window.innerWidth <= 640;
  const toolbarReserve = getPanelToolbarReserve();

  atomLegendPanel.classList.toggle("is-left", legendSide === "left");
  atomLegendPanel.classList.toggle("is-right", legendSide === "right");
  atomLegendPanel.dataset.side = legendSide;
  atomLegendPanel.dataset.layoutMode = layoutPlan.mode;
  atomLegendPanel.style.top = "auto";
  atomLegendPanel.style.bottom = "auto";
  atomLegendPanel.style.left = "auto";
  atomLegendPanel.style.right = "auto";
  atomLegendPanel.style.width = "";
  atomLegendPanel.style.height = "";
  atomLegendPanel.dataset.axisSize = "";
  atomLegendPanel.dataset.axisHeight = "";
  atomLegendPanel.dataset.rowHeight = "";
  atomLegendPanel.dataset.referenceWidth = "";
  atomLegendPanel.dataset.rowGap = "";

  if (atomLegendCardElement) {
    atomLegendCardElement.style.height = "";
  }

  if (useCompactLayout) {
    const compactLegendWidth = Math.min(
      ATOM_LEGEND_FIXED_WIDTH,
      window.innerWidth - inset * 2
    );

    atomLegendPanel.style.top = "auto";
    atomLegendPanel.style.left = legendSide === "left" ? `${inset}px` : "auto";
    atomLegendPanel.style.right = legendSide === "right" ? `${inset}px` : "auto";
    atomLegendPanel.style.width = `${compactLegendWidth}px`;
    atomLegendPanel.style.height = `${ATOM_LEGEND_FIXED_HEIGHT}px`;
    atomLegendPanel.style.bottom = `${inset + toolbarReserve}px`;
    return;
  }

  if (layoutPlan.mode === "coordination") {
    const coordinationRect = getPanelLayoutRect(coordinationPanel);
    const referenceWidth =
      layoutPlan.referenceWidth ?? getReferencePanelWidth(coordinationPanel);
    const legendWidth =
      layoutPlan.legendWidth ?? Math.min(ATOM_LEGEND_FIXED_WIDTH, referenceWidth);
    const legendHeight =
      layoutPlan.legendHeight ?? ATOM_LEGEND_FIXED_HEIGHT;
    const legendLeft =
      legendSide === "left"
        ? coordinationRect?.left ?? inset
        : Math.max(
            inset,
            (coordinationRect?.right ?? window.innerWidth - inset) - legendWidth
          );

    atomLegendPanel.style.width = `${legendWidth}px`;
    atomLegendPanel.style.height = `${legendHeight}px`;
    atomLegendPanel.style.bottom = "auto";
    atomLegendPanel.style.top = `${Math.max(
      inset,
      (coordinationRect?.top ?? inset + legendHeight + ATTACHED_PANEL_GAP) -
        legendHeight -
        ATTACHED_PANEL_GAP
    )}px`;
    atomLegendPanel.style.left = `${legendLeft}px`;

    return;
  }

  if (layoutPlan.mode === "count") {
    const countRect = getPanelLayoutRect(countingPanel);
    const referenceWidth =
      layoutPlan.referenceWidth ?? getReferencePanelWidth(countingPanel);
    const legendWidth =
      layoutPlan.legendWidth ?? Math.min(ATOM_LEGEND_FIXED_WIDTH, referenceWidth);
    const legendHeight = layoutPlan.legendHeight ?? ATOM_LEGEND_FIXED_HEIGHT;
    const legendLeft =
      legendSide === "left"
        ? countRect?.left ?? inset
        : Math.max(
            inset,
            (countRect?.right ?? window.innerWidth - inset) - legendWidth
          );

    atomLegendPanel.style.width = `${legendWidth}px`;
    atomLegendPanel.style.height = `${legendHeight}px`;
    atomLegendPanel.style.bottom = "auto";
    atomLegendPanel.style.top = `${Math.max(
      inset,
      (countRect?.top ?? inset + legendHeight + ATTACHED_PANEL_GAP) -
        legendHeight -
        ATTACHED_PANEL_GAP
    )}px`;
    atomLegendPanel.style.left = `${legendLeft}px`;

    return;
  }

  if (
    layoutPlan.mode === "count-axis" ||
    layoutPlan.mode === "coordination-axis"
  ) {
    const referencePanel =
      layoutPlan.mode === "count-axis" ? countingPanel : coordinationPanel;
    const referenceRect = getPanelLayoutRect(referencePanel);
    const totalWidth =
      layoutPlan.referenceWidth ?? getKnowledgeColumnWidth(inset);
    const axisSize =
      layoutPlan.axisSize ?? clampNumber(
        Math.floor(totalWidth * 0.36),
        LEGEND_AXIS_MIN_SIZE,
        LEGEND_AXIS_MAX_SIZE
      );
    const rowHeight = layoutPlan.rowHeight ?? axisSize;
    const rowGap = layoutPlan.rowGap ?? LEGEND_AXIS_ROW_GAP;
    const legendWidth =
      layoutPlan.legendWidth ??
      Math.min(
        ATOM_LEGEND_FIXED_WIDTH,
        Math.max(LEGEND_MIN_WIDTH, totalWidth - rowGap - axisSize)
      );
    const legendHeight =
      layoutPlan.legendHeight ?? ATOM_LEGEND_FIXED_HEIGHT;
    const rowLeft =
      legendSide === "left"
        ? inset
        : Math.max(inset, window.innerWidth - inset - totalWidth);
    const legendLeft =
      legendSide === "left"
        ? rowLeft + axisSize + rowGap
        : rowLeft;
    const rowTop = Math.max(
      inset,
      (referenceRect?.top ?? inset + rowHeight + ATTACHED_PANEL_GAP) -
        rowHeight -
        ATTACHED_PANEL_GAP
    );

    atomLegendPanel.style.width = `${legendWidth}px`;
    atomLegendPanel.style.height = `${legendHeight}px`;
    atomLegendPanel.style.left = `${legendLeft}px`;
    atomLegendPanel.style.bottom = "auto";
    atomLegendPanel.dataset.axisSize = String(axisSize);
    atomLegendPanel.dataset.axisHeight = String(axisSize);
    atomLegendPanel.dataset.rowHeight = String(rowHeight);
    atomLegendPanel.dataset.referenceWidth = String(totalWidth);
    atomLegendPanel.dataset.rowGap = String(rowGap);

    if (atomLegendCardElement) {
      atomLegendCardElement.style.height = "100%";
    }

    atomLegendPanel.style.top = `${rowTop}px`;
    return;
  }

  const referencePanel = getVisibleKnowledgeReferencePanel();
  const legendRect = atomLegendPanel.getBoundingClientRect();
  const legendWidth = Math.min(
    ATOM_LEGEND_FIXED_WIDTH,
    Math.max(196, window.innerWidth - inset * 2)
  );
  const legendHeight = ATOM_LEGEND_FIXED_HEIGHT;
  atomLegendPanel.style.width = `${legendWidth}px`;
  atomLegendPanel.style.height = `${legendHeight}px`;

  if (referencePanel) {
    const referenceRect = referencePanel.getBoundingClientRect();
    const candidateLeft =
      legendSide === "left"
        ? clampNumber(
            referenceRect.right + FLOATING_PANEL_GAP,
            inset,
            window.innerWidth - inset - legendWidth
          )
        : clampNumber(
            referenceRect.left - FLOATING_PANEL_GAP - legendWidth,
            inset,
            window.innerWidth - inset - legendWidth
          );
    const candidateTop = clampNumber(
      referenceRect.bottom - legendHeight,
      inset,
      Math.max(inset, window.innerHeight - inset - legendHeight)
    );

    atomLegendPanel.style.left = `${candidateLeft}px`;
    atomLegendPanel.style.top = `${candidateTop}px`;
    return;
  }

  atomLegendPanel.style.bottom = `${inset + toolbarReserve}px`;
  atomLegendPanel.style.top = "auto";

  if (legendSide === "left") {
    atomLegendPanel.style.left = `${inset}px`;
  } else {
    atomLegendPanel.style.left = `${Math.max(
      inset,
      window.innerWidth - inset - legendWidth
    )}px`;
  }
}

let floatingLayoutSyncToken = 0;
let floatingLayoutSettledSyncToken = 0;

function syncFloatingPanelLayout() {
  floatingLayoutSyncToken = 0;

  const inset = getViewportInset();

  if (!floatingPanel) {
    return;
  }

  syncPanelToolbarSide(floatingPanel.classList.contains("is-left") ? "left" : "right");

  const panelBaseBottom = inset + getPanelCollapseToolbarReserve();
  let panelBottom = panelBaseBottom;
  const legendLayoutPlan = getAtomLegendLayoutPlan(inset);
  const detachedCoordinationReserve = syncDetachedCoordinationPanelLayout(inset);
  const detachedCountingReserve = syncDetachedCountingPanelLayout(
    inset,
    detachedCoordinationReserve
  );
  const hasDetachedKnowledgePanels =
    shouldDetachCoordinationPanel() || shouldDetachCountingPanel();
  const knowledgeBottom = hasDetachedKnowledgePanels
    ? inset
    : inset + getPanelToolbarReserve();

  if (knowledgeStack) {
    knowledgeStack.style.bottom = `${knowledgeBottom}px`;
    knowledgeStack.style.top = "";
    knowledgeStack.style.left = "";
    knowledgeStack.style.right = "";
    knowledgeStack.style.maxHeight = "";

    if (!knowledgeStack.hidden) {
      const isPanelOnLeft = floatingPanel.classList.contains("is-left");
      const useOppositeViewportSide = window.innerWidth > 640;

      knowledgeStack.classList.toggle("is-opposite-edge", useOppositeViewportSide);
      knowledgeStack.classList.toggle("is-below-panel", !useOppositeViewportSide);

      if (useOppositeViewportSide) {
        if (isPanelOnLeft) {
          knowledgeStack.style.left = "auto";
          knowledgeStack.style.right = `${inset}px`;
        } else {
          knowledgeStack.style.left = `${inset}px`;
          knowledgeStack.style.right = "auto";
        }
      }

      const isSharedLegendAxisRow =
        legendLayoutPlan.mode === "count-axis" ||
        legendLayoutPlan.mode === "coordination-axis";
      const applyKnowledgeStackBounds = (stackTopBoundary) => {
        const availableStackHeight = Math.max(
          0,
          window.innerHeight - stackTopBoundary - knowledgeBottom
        );

        if (useOppositeViewportSide) {
          knowledgeStack.style.top = `${stackTopBoundary}px`;
          knowledgeStack.style.bottom = `${knowledgeBottom}px`;
          knowledgeStack.style.maxHeight = "none";
        } else {
          knowledgeStack.style.top = "";
          knowledgeStack.style.maxHeight = `${availableStackHeight}px`;
        }

        syncKnowledgeCardHeights(availableStackHeight);

        return availableStackHeight;
      };
      const estimatedAxisTopBoundary = isSharedLegendAxisRow
        ? inset
        : getAxisWidgetTopBoundary(inset);
      let stackTopBoundary =
        estimatedAxisTopBoundary + legendLayoutPlan.reserveTop;

      if (!hasDetachedKnowledgePanels) {
        applyKnowledgeStackBounds(stackTopBoundary);
      }
      syncAtomLegendLayout(inset, legendLayoutPlan);

      const actualAxisTopBoundary = isSharedLegendAxisRow
        ? inset
        : getAxisWidgetTopBoundary(inset);
      const actualLegendTopBoundary = getAtomLegendTopBoundary(inset);
      const resolvedStackTopBoundary = Math.max(
        actualAxisTopBoundary,
        actualLegendTopBoundary
      );

      if (
        !hasDetachedKnowledgePanels &&
        Math.abs(resolvedStackTopBoundary - stackTopBoundary) > 1
      ) {
        stackTopBoundary = resolvedStackTopBoundary;
        applyKnowledgeStackBounds(stackTopBoundary);
      }

      if (!useOppositeViewportSide && !hasDetachedKnowledgePanels) {
        const stackRect = knowledgeStack.getBoundingClientRect();
        const knowledgeHeight = stackRect.height;

        panelBottom =
          knowledgeHeight > 0
            ? Math.max(
                panelBaseBottom,
                knowledgeBottom + knowledgeHeight + FLOATING_PANEL_GAP
              )
            : panelBaseBottom;
      } else if (hasDetachedKnowledgePanels) {
        knowledgeStack.style.top = "";
        knowledgeStack.style.maxHeight = "0px";
      }
    } else {
      knowledgeStack.classList.remove("is-opposite-edge", "is-below-panel");
      knowledgeStack.style.top = "";
      resetKnowledgeCardHeights();
    }
  }

  floatingPanel.style.bottom = `${panelBottom}px`;
  floatingPanel.style.maxHeight = floatingPanel.classList.contains("is-collapsed")
    ? "none"
    : `calc(100vh - ${panelBottom + inset}px)`;
  syncAtomLegendLayout(inset, legendLayoutPlan);
}

function requestFloatingPanelLayoutSync() {
  if (floatingLayoutSyncToken) {
    return;
  }

  floatingLayoutSyncToken = window.requestAnimationFrame(
    syncFloatingPanelLayout
  );
}

function flushFloatingPanelLayoutNow() {
  if (floatingLayoutSyncToken) {
    window.cancelAnimationFrame(floatingLayoutSyncToken);
    floatingLayoutSyncToken = 0;
  }

  syncFloatingPanelLayout();
}

function requestFloatingPanelLayoutResync() {
  const previousAtomLegendRect = getVisibleElementRect(atomLegendPanel);

  flushFloatingPanelLayoutNow();

  animatePanelMoveFrom(atomLegendPanel, previousAtomLegendRect, {
    durationMs: ATOM_LEGEND_MOVE_ANIMATION_MS
  });
  requestFloatingPanelLayoutSync();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(requestFloatingPanelLayoutSync);
  });

  if (floatingLayoutSettledSyncToken) {
    window.clearTimeout(floatingLayoutSettledSyncToken);
  }

  floatingLayoutSettledSyncToken = window.setTimeout(() => {
    floatingLayoutSettledSyncToken = 0;
    requestFloatingPanelLayoutSync();
  }, 280);
}

function renderList(items) {
  if (!items?.length) {
    return "";
  }

  return `
    <ul class="knowledge-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderRuleList(rules) {
  if (!rules?.length) {
    return "";
  }

  return `
    <div class="knowledge-rule-list">
      ${rules
        .map(
          (rule) => `
            <article class="knowledge-rule">
              <h5>${escapeHtml(rule.site)}</h5>
              <p class="knowledge-rule-equation">${escapeHtml(rule.equation)}</p>
              <p class="knowledge-rule-particle">${escapeHtml(rule.particles)}</p>
              <p class="knowledge-rule-note">${escapeHtml(rule.note)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderFinalCounts(items) {
  if (!items?.length) {
    return "";
  }

  return `
    <div class="knowledge-count-grid">
      ${items
        .map(
          (item) => `
            <div class="knowledge-count-item">
              <dt>${escapeHtml(item.label)}</dt>
              <dd>${escapeHtml(item.value)}</dd>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSection(title, body, className = "") {
  if (!body) {
    return "";
  }

  return `
    <section class="knowledge-section${className ? ` ${className}` : ""}">
      <h4>${escapeHtml(title)}</h4>
      ${body}
    </section>
  `;
}

function buildCountingPanelHtml(crystal) {
  const info = crystal.countingInfo;

  if (!info) {
    return `
      <p class="knowledge-empty">当前晶胞暂未提供计数说明。</p>
    `;
  }

  const headerHtml = `
    <div class="knowledge-intro">
      <p class="knowledge-kicker">${escapeHtml(info.countingTitle || "计数说明")}</p>
      <h3>${escapeHtml(crystal.displayName ?? crystal.name)}</h3>
      <p class="knowledge-summary">${escapeHtml(info.countingSummary)}</p>
    </div>
  `;

  const finalConclusionHtml = [
    renderFinalCounts(info.finalParticleCount),
    info.formulaConclusion
      ? `<p class="knowledge-conclusion-text">${escapeHtml(info.formulaConclusion)}</p>`
      : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    ${headerHtml}
    ${renderSection("最终结论", finalConclusionHtml, "is-highlight")}
    ${renderSection("计数规则", renderRuleList(info.equivalentContributionRules))}
  `;
}

function buildCoordinationPanelHtml(crystal) {
  const info = crystal.coordinationInfo;
  const label = crystal.coordinationLabel ?? info?.title ?? "配位说明";
  const summary =
    info?.summary ??
    crystal.coordinationDescription ??
    "当前晶胞支持代表性配位环境显示。";

  if (!crystal.supportsCoordinationDisplay || !info) {
    return `
      <p class="knowledge-empty">当前晶胞暂未提供配位说明。</p>
    `;
  }

  return `
    <div class="knowledge-intro">
      <p class="knowledge-kicker">代表性配位环境</p>
      <h3>${escapeHtml(label)}</h3>
      <p class="knowledge-summary">${escapeHtml(summary)}</p>
    </div>
  `;
}

function applyPanelLayoutState(state) {
  const panelSide = normalizePanelSide(state.panelSide);
  const panelCollapsed = Boolean(state.panelCollapsed);
  const shouldAnimatePanelBody =
    floatingPanelBody?.dataset.animationReady === "true";
  const previousPanelSide = floatingPanel?.dataset.side;
  const previousPanelCollapsed = floatingPanel?.classList.contains("is-collapsed");
  const previousPanelRect =
    shouldAnimatePanelBody &&
    (previousPanelSide !== panelSide ||
      (previousPanelCollapsed === true && !panelCollapsed))
      ? getVisibleElementRect(floatingPanel)
      : null;

  if (floatingPanel) {
    floatingPanel.classList.toggle("is-left", panelSide === "left");
    floatingPanel.classList.toggle("is-right", panelSide !== "left");
    if (!shouldAnimatePanelBody || !panelCollapsed) {
      floatingPanel.classList.toggle("is-collapsed", panelCollapsed);
    }
    floatingPanel.dataset.side = panelSide;
    floatingPanel.dataset.collapsed = String(panelCollapsed);
  }
  syncPanelToolbarSide(panelSide);

  if (knowledgeStack) {
    const knowledgeSide = panelSide === "left" ? "right" : "left";

    knowledgeStack.classList.toggle("is-left", knowledgeSide === "left");
    knowledgeStack.classList.toggle("is-right", knowledgeSide === "right");
    knowledgeStack.dataset.side = knowledgeSide;
  }

  if (floatingPanelBody) {
    if (shouldAnimatePanelBody) {
      if (!panelCollapsed) {
        floatingPanel?.classList.remove("is-collapsed");
        animatePanelMoveFrom(floatingPanel, previousPanelRect);
      }

      setAnimatedPanelVisibility(floatingPanelBody, !panelCollapsed, {
        animateHeight: false,
        onAfterShow: requestFloatingPanelLayoutResync,
        onAfterHide() {
          if (panelCollapsed) {
            const beforeCollapseRect = getVisibleElementRect(floatingPanel);
            floatingPanel?.classList.add("is-collapsed");
            animatePanelMoveFrom(floatingPanel, beforeCollapseRect);
          }
          requestFloatingPanelLayoutResync();
        }
      });
    } else {
      floatingPanel?.classList.toggle("is-collapsed", panelCollapsed);
      setImmediatePanelVisibility(floatingPanelBody, !panelCollapsed);
      floatingPanelBody.dataset.animationReady = "true";
    }
  }

  if (!(previousPanelCollapsed && !panelCollapsed)) {
    animatePanelMoveFrom(floatingPanel, previousPanelRect);
  }

  syncPanelToggleButtons({
    panelSide,
    panelCollapsed
  });
  requestFloatingPanelLayoutResync();
}

export function setPanelStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

export function setCrystalSummary(message) {
  if (crystalSummaryElement) {
    crystalSummaryElement.textContent = message;
  }
}

export function setCoordinationPanelVisibility(isVisible) {
  if (!coordinationPanel) {
    return;
  }

  if (isVisible) {
    delete coordinationPanel.dataset.layoutHidden;
  }

  setAnimatedPanelVisibility(coordinationPanel, isVisible, {
    onAfterShow: requestFloatingPanelLayoutResync,
    onAfterHide() {
      delete coordinationPanel.dataset.layoutHidden;
      updateKnowledgeStackVisibility();
      requestFloatingPanelLayoutResync();
    }
  });
  updateKnowledgeStackVisibility();
  requestFloatingPanelLayoutResync();
}

export function setCountingPanelVisibility(isVisible) {
  if (!countingPanel) {
    return;
  }

  if (isVisible) {
    delete countingPanel.dataset.layoutHidden;
  }

  setAnimatedPanelVisibility(countingPanel, isVisible, {
    onAfterShow: requestFloatingPanelLayoutResync,
    onAfterHide() {
      delete countingPanel.dataset.layoutHidden;
      updateKnowledgeStackVisibility();
      requestFloatingPanelLayoutResync();
    }
  });
  updateKnowledgeStackVisibility();
  requestFloatingPanelLayoutResync();
}

export function renderCoordinationPanel(crystal) {
  if (!coordinationContentElement) {
    return;
  }

  coordinationContentElement.innerHTML = buildCoordinationPanelHtml(crystal);
  requestFloatingPanelLayoutResync();
}

export function renderCountingPanel(crystal) {
  if (!countingContentElement) {
    return;
  }

  countingContentElement.innerHTML = buildCountingPanelHtml(crystal);
  requestFloatingPanelLayoutResync();
}

export function renderAtomLegend(crystal) {
  if (!atomLegendPanel || !atomLegendContentElement) {
    return;
  }

  const items = (crystal?.atomLegend ?? []).filter((item) => item?.label);


  if (!items.length) {
    atomLegendContentElement.innerHTML =
      '<p class="knowledge-empty">当前晶胞暂无原子示意。</p>';
    setAnimatedPanelVisibility(atomLegendPanel, false, {
      onAfterHide: requestFloatingPanelLayoutResync
    });
    requestFloatingPanelLayoutResync();
    return;
  }

  const shouldAnimateLegendOpen = atomLegendPanel.hidden;

  atomLegendContentElement.innerHTML = `
    <div class="atom-legend-list">
      ${items
        .map(
          (item) => `
            <article class="atom-legend-item">
              <span
                class="atom-legend-swatch"
                style="--swatch-color: ${escapeHtml(toCssColor(item.color))};"
                aria-hidden="true"
              ></span>
              <div class="atom-legend-copy">
                <p class="atom-legend-name">${escapeHtml(item.label)}</p>
                ${
                  item.note
                    ? `<p class="atom-legend-note">${escapeHtml(item.note)}</p>`
                    : ""
                }
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  if (shouldAnimateLegendOpen) {
    setAnimatedPanelVisibility(atomLegendPanel, true, {
      onAfterShow: requestFloatingPanelLayoutResync
    });
  } else {
    setImmediatePanelVisibility(atomLegendPanel, true);
  }

  requestFloatingPanelLayoutResync();
}

function renderSelectOptions(selectElement, options, selectedId) {
  if (!selectElement) {
    return;
  }

  selectElement.innerHTML = options
    .map(
      (option) =>
        `<option value="${option.id}" ${
          option.id === selectedId ? "selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");
}

export function setupUI({
  crystalOptions,
  viewOptions,
  initialState,
  onCrystalChange,
  onViewChange,
  onViewLockChange,
  onAutoRotateChange,
  onShowAxesChange,
  onShowAuxiliaryChange,
  onShowCoordinationChange,
  onShowCountChange
}) {
  const crystalSelect = document.getElementById("crystal-select");
  const viewSelect = document.getElementById("view-select");
  const viewLockButton = document.getElementById("btn-view-lock");
  const autoRotateButton = document.getElementById("btn-auto-rotate");
  const axesButton = document.getElementById("btn-show-axes");
  const coordinationButton = document.getElementById("btn-show-coordination");
  const auxiliaryButton = document.getElementById("btn-show-auxiliary");
  const countButton = document.getElementById("btn-show-count");
  const storedPanelLayout = readStoredPanelLayout();

  const state = {
    currentCrystalId: initialState?.currentCrystalId ?? "",
    selectedViewId: initialState?.selectedViewId ?? "default",
    viewLocked: Boolean(initialState?.viewLocked),
    autoRotate: Boolean(initialState?.autoRotate),
    showAxes: Boolean(initialState?.showAxes),
    showAuxiliary: Boolean(initialState?.showAuxiliary),
    showCoordination: Boolean(initialState?.showCoordination),
    showCount: Boolean(initialState?.showCount),
    panelSide: storedPanelLayout.panelSide,
    panelCollapsed: storedPanelLayout.panelCollapsed
  };
  let knowledgeVisibilityBeforePanelCollapse = null;
  showAxesState = state.showAxes;

  renderSelectOptions(
    crystalSelect,
    crystalOptions ?? [],
    state.currentCrystalId
  );
  renderSelectOptions(viewSelect, viewOptions ?? [], state.selectedViewId);
  updateButtonState(viewLockButton, state.viewLocked);
  updateButtonState(autoRotateButton, state.autoRotate);
  updateButtonState(axesButton, state.showAxes);
  updateButtonState(auxiliaryButton, state.showAuxiliary);
  updateButtonState(coordinationButton, state.showCoordination);
  updateButtonState(countButton, state.showCount);
  updateKnowledgeStackVisibility();
  applyPanelLayoutState(state);

  function handleCrystalSelectChange() {
    state.currentCrystalId = crystalSelect.value;
    onCrystalChange?.(state.currentCrystalId);
  }

  function handleViewSelectChange() {
    state.selectedViewId = viewSelect.value;
    onViewChange?.(state.selectedViewId);
  }

  function setSelectedView(nextViewId) {
    state.selectedViewId = nextViewId;

    if (viewSelect) {
      viewSelect.value = nextViewId;
    }
  }

  function setViewLock(nextValue) {
    state.viewLocked = Boolean(nextValue);
    updateButtonState(viewLockButton, state.viewLocked);
  }

  function setAutoRotate(nextValue) {
    state.autoRotate = Boolean(nextValue);
    updateButtonState(autoRotateButton, state.autoRotate);
  }

  function setShowAxes(nextValue) {
    state.showAxes = Boolean(nextValue);
    showAxesState = state.showAxes;
    updateButtonState(axesButton, state.showAxes);
    requestFloatingPanelLayoutResync();
  }

  function setShowCoordination(nextValue) {
    state.showCoordination = Boolean(nextValue);
    updateButtonState(coordinationButton, state.showCoordination);
    requestFloatingPanelLayoutResync();
  }

  function setShowAuxiliary(nextValue) {
    state.showAuxiliary = Boolean(nextValue);
    updateButtonState(auxiliaryButton, state.showAuxiliary);
  }

  function setShowCount(nextValue) {
    state.showCount = Boolean(nextValue);
    updateButtonState(countButton, state.showCount);
    requestFloatingPanelLayoutResync();
  }

  function setPanelCollapsed(nextValue) {
    const nextCollapsed = Boolean(nextValue);

    if (nextCollapsed === state.panelCollapsed) {
      applyPanelLayoutState(state);
      persistPanelLayout(state);
      return;
    }

    if (nextCollapsed) {
      knowledgeVisibilityBeforePanelCollapse = {
        showCoordination: state.showCoordination,
        showCount: state.showCount
      };

      if (state.showCoordination) {
        coordinationPanel.dataset.layoutHidden = "true";
      }

      if (state.showCount) {
        countingPanel.dataset.layoutHidden = "true";
      }

      if (state.showCoordination) {
        setCoordinationPanelVisibility(false);
      }

      if (state.showCount) {
        setCountingPanelVisibility(false);
      }
    }

    state.panelCollapsed = nextCollapsed;
    applyPanelLayoutState(state);
    persistPanelLayout(state);

    if (!nextCollapsed && knowledgeVisibilityBeforePanelCollapse) {
      const shouldRestoreCoordination =
        knowledgeVisibilityBeforePanelCollapse.showCoordination &&
        Boolean(coordinationButton && !coordinationButton.disabled);
      const shouldRestoreCount =
        knowledgeVisibilityBeforePanelCollapse.showCount &&
        Boolean(countButton && !countButton.disabled);

      knowledgeVisibilityBeforePanelCollapse = null;

      if (shouldRestoreCoordination) {
        setCoordinationPanelVisibility(true);
      }

      if (shouldRestoreCount) {
        setCountingPanelVisibility(true);
      }
    }
  }

  function setPanelSide(nextSide) {
    state.panelSide = normalizePanelSide(nextSide);
    applyPanelLayoutState(state);
    persistPanelLayout(state);
  }

  crystalSelect?.addEventListener("input", handleCrystalSelectChange);
  crystalSelect?.addEventListener("change", handleCrystalSelectChange);
  crystalSelect?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  crystalSelect?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  viewSelect?.addEventListener("input", handleViewSelectChange);
  viewSelect?.addEventListener("change", handleViewSelectChange);
  viewSelect?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  viewSelect?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  viewLockButton?.addEventListener("click", () => {
    setViewLock(!state.viewLocked);
    onViewLockChange?.(state.viewLocked);
  });

  autoRotateButton?.addEventListener("click", () => {
    if (autoRotateButton.disabled) {
      return;
    }

    setAutoRotate(!state.autoRotate);
    onAutoRotateChange?.(state.autoRotate);
  });

  axesButton?.addEventListener("click", () => {
    if (axesButton.disabled) {
      return;
    }

    setShowAxes(!state.showAxes);
    onShowAxesChange?.(state.showAxes);
  });

  auxiliaryButton?.addEventListener("click", () => {
    if (auxiliaryButton.disabled) {
      return;
    }

    setShowAuxiliary(!state.showAuxiliary);
    onShowAuxiliaryChange?.(state.showAuxiliary);
  });

  coordinationButton?.addEventListener("click", () => {
    if (coordinationButton.disabled) {
      return;
    }

    setShowCoordination(!state.showCoordination);
    onShowCoordinationChange?.(state.showCoordination);
  });

  countButton?.addEventListener("click", () => {
    if (countButton.disabled) {
      return;
    }

    setShowCount(!state.showCount);
    onShowCountChange?.(state.showCount);
  });

  panelCollapseButton?.addEventListener("click", () => {
    setPanelCollapsed(!state.panelCollapsed);
  });

  panelSideButton?.addEventListener("click", () => {
    setPanelSide(state.panelSide === "left" ? "right" : "left");
  });

  window.addEventListener("resize", requestFloatingPanelLayoutResync);

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => {
      requestFloatingPanelLayoutSync();
    });

    if (knowledgeStack) {
      resizeObserver.observe(knowledgeStack);
    }

    if (floatingPanel) {
      resizeObserver.observe(floatingPanel);
    }

    if (countingPanel) {
      resizeObserver.observe(countingPanel);
    }

    if (coordinationPanel) {
      resizeObserver.observe(coordinationPanel);
    }

    if (atomLegendPanel) {
      resizeObserver.observe(atomLegendPanel);
    }

    if (panelSideToolbar) {
      resizeObserver.observe(panelSideToolbar);
    }

    if (panelCollapseToolbar) {
      resizeObserver.observe(panelCollapseToolbar);
    }
  }

  requestFloatingPanelLayoutResync();

  return {
    getState() {
      return { ...state };
    },
    setSelectedCrystal(crystalId) {
      state.currentCrystalId = crystalId;

      if (crystalSelect) {
        crystalSelect.value = crystalId;
      }
    },
    setSelectedView,
    setViewLock,
    setAutoRotate,
    setAutoRotateAvailability(isEnabled) {
      setButtonAvailability(autoRotateButton, isEnabled);

      if (isEnabled) {
        updateButtonState(autoRotateButton, state.autoRotate);
      }
    },
    setAuxiliaryAvailability(isEnabled) {
      setButtonAvailability(auxiliaryButton, isEnabled);
    },
    setCoordinationAvailability(isEnabled) {
      if (!isEnabled) {
        setShowCoordination(false);
      }

      setButtonAvailability(coordinationButton, isEnabled);
    },
    setCountAvailability(isEnabled) {
      if (!isEnabled) {
        setShowCount(false);
      }

      setButtonAvailability(countButton, isEnabled);
    },
    setShowAxes,
    setShowAuxiliary,
    setShowCoordination,
    setShowCount,
    setPanelCollapsed,
    setPanelSide
  };
}
