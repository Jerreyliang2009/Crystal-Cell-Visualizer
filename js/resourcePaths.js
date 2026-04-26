(function (window) {
  "use strict";

  const namespace = window.CrystalCellVisualizer || {};

  function isExternalOrSpecialPath(path) {
    return /^(?:[a-z][a-z\d+\-.]*:|\/\/|#)/i.test(path);
  }

  function normalizeRelativePath(relativePath) {
    const path = String(relativePath || "").trim().replace(/\\/g, "/");

    if (!path) {
      return "./";
    }

    if (isExternalOrSpecialPath(path)) {
      return path;
    }

    return `./${path.replace(/^\.?\//, "").replace(/^\/+/, "")}`;
  }

  function getAssetUrl(relativePath) {
    return normalizeRelativePath(relativePath);
  }

  namespace.getAssetUrl = getAssetUrl;
  namespace.resolveAssetPath = getAssetUrl;

  window.CrystalCellVisualizer = namespace;
  window.getAssetUrl = getAssetUrl;
  window.resolveAssetPath = getAssetUrl;
})(window);
