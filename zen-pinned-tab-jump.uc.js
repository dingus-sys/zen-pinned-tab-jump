// Typing a site name (e.g. "amazon") + Enter jumps to the matching pinned tab, switching Space if needed.
(function zenPinnedTabJump() {
  if (window.__zenPinnedTabJump) return;
  window.__zenPinnedTabJump = true;

  const hostLabels = (tab) => {
    try {
      const host = tab.linkedBrowser?.currentURI?.host || "";
      return host.toLowerCase().split(".").slice(0, -1).filter((l) => l && l !== "www");
    } catch (_e) {
      return [];
    }
  };

  const titleWords = (tab) => {
    try {
      const title = (tab.getAttribute("zen-pin-title") || tab.label || "").toLowerCase();
      return title.split(/[^a-z0-9]+/).filter(Boolean);
    } catch (_e) {
      return [];
    }
  };

  // 3: exact site-name / title word / full title. 2: prefix (3+ chars) of a site-name label or title word.
  const scoreTab = (tab, q) => {
    const labels = hostLabels(tab);
    const words = titleWords(tab);
    const title = words.join(" ");
    if (labels.includes(q) || words.includes(q) || title === q) return 3;
    if (q.length >= 3 && (labels.some((l) => l.startsWith(q)) || words.some((w) => w.startsWith(q)) || title.startsWith(q))) return 2;
    return 0;
  };

  const zenSpaces = () => (window.gZenWorkspaces?.workspaceEnabled ? window.gZenWorkspaces : null);

  const candidateTabs = () => Array.from(zenSpaces()?.allStoredTabs || gBrowser.tabs);

  const findPinnedTab = (q) => {
    const ws = window.gZenWorkspaces?.activeWorkspace;
    let best = null;
    let bestScore = 0;
    for (const t of candidateTabs()) {
      if (!t.pinned || t.hasAttribute("zen-empty-tab")) continue;
      let sc = scoreTab(t, q);
      if (!sc) continue;
      // Prefer tabs in the current Space (or Essentials) on ties.
      if (t.hasAttribute("zen-essential") || (ws && t.getAttribute("zen-workspace-id") === ws)) sc += 0.5;
      if (sc > bestScore) {
        best = t;
        bestScore = sc;
      }
    }
    return best;
  };

  const selectTab = (tab) => {
    const spaces = zenSpaces();
    if (spaces?.switchTabIfNeeded) spaces.switchTabIfNeeded(tab);
    else gBrowser.selectedTab = tab;
  };

  const start = () => {
    const urlbar = document.getElementById("urlbar");
    if (!urlbar || !window.gURLBar) return;
    urlbar.addEventListener(
      "keydown",
      (e) => {
        try {
          if (e.key !== "Enter" || e.isComposing || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
          const word = (gURLBar.inputField.value || "").trim().toLowerCase().replace(/\s+/g, " ");
          if (!/^[a-z0-9][a-z0-9 -]+$/.test(word)) return;
          // If the user arrowed to a non-default suggestion, respect that choice.
          const selected = gURLBar.view?.selectedResult;
          if (selected && !selected.heuristic) return;
          const tab = findPinnedTab(word);
          if (!tab) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          selectTab(tab);
          gURLBar.handleRevert?.();
          gURLBar.view?.close?.();
          gURLBar.blur();
        } catch (err) {
          console.error("[PinnedTabJump]", err);
        }
      },
      true
    );
  };

  if (window.gBrowserInit?.delayedStartupFinished) {
    start();
  } else {
    const obs = (subject) => {
      if (subject !== window) return;
      Services.obs.removeObserver(obs, "browser-delayed-startup-finished");
      start();
    };
    Services.obs.addObserver(obs, "browser-delayed-startup-finished");
  }
})();
