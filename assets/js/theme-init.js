(() => {
  const root = document.documentElement;
  try {
    const saved = window.localStorage.getItem("leetmetric-theme");
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    root.dataset.theme = saved === "light" || saved === "dark"
      ? saved
      : prefersLight ? "light" : "dark";
  } catch {
    root.dataset.theme = "dark";
  }
})();