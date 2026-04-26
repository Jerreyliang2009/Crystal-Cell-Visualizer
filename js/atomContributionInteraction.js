(function (window) {
  "use strict";

const THREE = window.THREE;
const namespace = window.CrystalCellVisualizer || {};

const CLICK_MOVE_TOLERANCE = 5;

class AtomContributionInteraction {
  constructor({
    domElement,
    camera,
    getInteractiveObjects,
    onHoverAtom,
    onSelectAtom,
    onClearSelection
  }) {
    this.domElement = domElement;
    this.camera = camera;
    this.getInteractiveObjects = getInteractiveObjects;
    this.onHoverAtom = onHoverAtom;
    this.onSelectAtom = onSelectAtom;
    this.onClearSelection = onClearSelection;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDown = null;
    this.enabled = true;

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleClick = this.handleClick.bind(this);

    this.domElement?.addEventListener("pointermove", this.handlePointerMove);
    this.domElement?.addEventListener("pointerleave", this.handlePointerLeave);
    this.domElement?.addEventListener("pointerdown", this.handlePointerDown);
    this.domElement?.addEventListener("click", this.handleClick);
  }

  dispose() {
    this.domElement?.removeEventListener("pointermove", this.handlePointerMove);
    this.domElement?.removeEventListener("pointerleave", this.handlePointerLeave);
    this.domElement?.removeEventListener("pointerdown", this.handlePointerDown);
    this.domElement?.removeEventListener("click", this.handleClick);
  }

  setEnabled(nextValue) {
    this.enabled = Boolean(nextValue);

    if (!this.enabled) {
      this.setCursor(false);
      this.onHoverAtom?.(null);
    }
  }

  setCursor(isPointingAtom) {
    if (!this.domElement) {
      return;
    }

    this.domElement.style.cursor = isPointingAtom ? "pointer" : "";
  }

  updatePointerFromEvent(event) {
    const rect = this.domElement.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return true;
  }

  getPointedAtom(event) {
    if (!this.enabled || !this.camera || !this.domElement) {
      return null;
    }

    const objects = this.getInteractiveObjects?.() ?? [];

    if (!objects.length || !this.updatePointerFromEvent(event)) {
      return null;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersections = this.raycaster.intersectObjects(objects, false);

    return intersections[0]?.object ?? null;
  }

  handlePointerMove(event) {
    if (!this.enabled) {
      return;
    }

    const atom = this.getPointedAtom(event);

    this.setCursor(Boolean(atom));
    this.onHoverAtom?.(atom);
  }

  handlePointerLeave() {
    if (!this.enabled) {
      return;
    }

    this.setCursor(false);
    this.onHoverAtom?.(null);
  }

  handlePointerDown(event) {
    if (!this.enabled) {
      return;
    }

    this.pointerDown = {
      x: event.clientX,
      y: event.clientY
    };
  }

  handleClick(event) {
    if (!this.enabled) {
      return;
    }

    if (this.pointerDown) {
      const dx = event.clientX - this.pointerDown.x;
      const dy = event.clientY - this.pointerDown.y;

      this.pointerDown = null;

      if (Math.hypot(dx, dy) > CLICK_MOVE_TOLERANCE) {
        return;
      }
    }

    const atom = this.getPointedAtom(event);

    if (atom) {
      this.onSelectAtom?.(atom);
      return;
    }

    this.onClearSelection?.();
  }
}

namespace.AtomContributionInteraction = AtomContributionInteraction;
window.CrystalCellVisualizer = namespace;
})(window);
