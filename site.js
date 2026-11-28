
(() => {
  const headerHost = document.getElementById("site-header");
  const footerHost = document.getElementById("site-footer");
  const current = window.location.pathname.toLowerCase();
  const active = (path) => current === path ? ' aria-current="page"' : "";

  // Keep the selected color scheme across pages and respect the OS preference until the user chooses.
  const themeRoot = document.documentElement;
  const themeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  let storedTheme = null;
  try {
    const saved = window.localStorage.getItem("leetmetric-theme");
    storedTheme = saved === "light" || saved === "dark" ? saved : null;
  } catch { /* Storage can be unavailable in restricted browsing modes. */ }

  const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg>';
  const moonIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.7 8.7 0 1 0 20.2 15.4Z"></path></svg>';

  const applyTheme = (theme, persist = false) => {
    const next = theme === "light" ? "light" : "dark";
    themeRoot.dataset.theme = next;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", next === "light" ? "#f5f7f2" : "#090d18");
    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      const target = next === "dark" ? "light" : "dark";
      toggle.innerHTML = next === "dark" ? sunIcon : moonIcon;
      toggle.setAttribute("aria-label", `Switch to ${target} mode`);
      toggle.setAttribute("title", `Switch to ${target} mode`);
      toggle.setAttribute("aria-pressed", String(next === "light"));
    }
    if (persist) {
      try { window.localStorage.setItem("leetmetric-theme", next); storedTheme = next; } catch { /* Theme still applies for this page. */ }
    }
  };

  applyTheme(themeRoot.dataset.theme || "dark");
  if (!storedTheme && themeMedia) {
    themeMedia.addEventListener("change", (event) => applyTheme(event.matches ? "light" : "dark"));
  }
  window.addEventListener("storage", (event) => {
    if (event.key === "leetmetric-theme" && (event.newValue === "light" || event.newValue === "dark")) {
      storedTheme = event.newValue;
      applyTheme(event.newValue);
    }
  });

  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <a class="brand" href="/"><span class="brand-mark">L<span>.</span></span><span>leet<span class="brand-light">metric</span></span></a>
        <nav class="desktop-nav" aria-label="Main navigation">
          <a href="/" ${active("/")}>Home</a><a href="/features.html" ${active("/features.html")}>Features</a><a href="/intelligence.html" ${active("/intelligence.html")}>Intelligence</a><a href="/roadmap.html" ${active("/roadmap.html")}>Roadmap</a><a href="/code-lab.html" ${active("/code-lab.html")}>Code Lab</a><a href="/readiness.html" ${active("/readiness.html")}>Readiness</a><a href="/compare.html" ${active("/compare.html")}>Compare</a>
          <a href="/about.html" ${active("/about.html")}>About</a><a href="/faq.html" ${active("/faq.html")}>FAQ</a>
          <a href="/contact.html" ${active("/contact.html")}>Contact</a>
        </nav>
        <div class="header-right"><button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to light mode" title="Switch to light mode" aria-pressed="false">${sunIcon}</button><div class="header-actions" id="header-actions"><a class="header-login" href="/login.html">Log in</a><a class="header-signup" href="/signup.html">Create account</a></div></div>
        <button class="mobile-menu-button" type="button" aria-label="Toggle navigation" aria-expanded="false">Menu</button>
      </header>`;
    const themeButton = headerHost.querySelector("[data-theme-toggle]");
    if (themeButton) {
      applyTheme(themeRoot.dataset.theme || "dark");
      themeButton.addEventListener("click", () => {
        applyTheme(themeRoot.dataset.theme === "dark" ? "light" : "dark", true);
      });
    }
    const button = headerHost.querySelector(".mobile-menu-button");
    button.addEventListener("click", () => {
      const header = headerHost.querySelector(".site-header");
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      header.classList.toggle("menu-open", !expanded);
    });
  }
  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer">
        <div class="footer-main">
          <div class="footer-intro"><a class="brand footer-brand" href="/"><span class="brand-mark">L<span>.</span></span><span>leet<span class="brand-light">metric</span></span></a><p>Understand your practice. Build consistency. Make your next coding milestone intentional.</p></div>
          <div class="footer-column"><strong>PRODUCT</strong><a href="/features.html">Features</a><a href="/intelligence.html">Performance intelligence</a><a href="/roadmap.html">DSA roadmap</a><a href="/code-lab.html">Code review lab</a><a href="/readiness.html">Interview readiness</a><a href="/reports.html">Progress reports</a><a href="/compare.html">Compare profiles</a><a href="/#insights">Stats dashboard</a><a href="/faq.html">FAQ</a></div>
          <div class="footer-column"><strong>COMPANY</strong><a href="/about.html">About LeetMetric</a><a href="/contact.html">Contact</a><a href="https://github.com/naitik2043/leetcode-stats-visualizer" target="_blank" rel="noreferrer">GitHub ↗</a></div>
          <div class="footer-column"><strong>LEGAL</strong><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of use</a></div>
        </div>
        <small>© <span class="footer-year"></span> LeetMetric. Independent community project; not affiliated with LeetCode.</small>
      </footer>`;
  }
  document.querySelectorAll(".footer-year").forEach((item) => item.textContent = new Date().getFullYear());

  const status = (form, message, type) => {
    const target = form.querySelector(".form-status");
    if (!target) return;
    target.textContent = message;
    target.className = `form-status show ${type}`;
  };
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "HIDE" : "SHOW";
    });
  });

  document.querySelectorAll("form[data-auth]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const kind = form.dataset.auth;
      const button = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      if (kind === "signup" && data.password !== data.confirmPassword) {
        status(form, "Your passwords do not match.", "error"); return;
      }
      if (kind === "signup" && !data.terms) {
        status(form, "Please accept the Terms of Use and Privacy Policy.", "error"); return;
      }
      if (kind === "signup" && new TextEncoder().encode(data.password).length > 72) {
        status(form, "Password must be 72 bytes or fewer.", "error"); return;
      }
      if (kind === "reset" && new TextEncoder().encode(data.password).length > 72) {
        status(form, "Password must be 72 bytes or fewer.", "error"); return;
      }
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "Please wait…";
      try {
        const endpoints = {
          signup: "/api/auth/signup", login: "/api/auth/login",
          forgot: "/api/auth/forgot-password", reset: "/api/auth/reset-password"
        };
        const response = await fetch(endpoints[kind], {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(data)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "We couldn't complete that request. Please try again.");
        if (kind === "signup" || kind === "login") {
          status(form, "You're signed in. Opening your dashboard…", "success");
          window.location.assign("/dashboard.html");
        } else if (kind === "forgot") {
          status(form, payload.message || "If that address belongs to an account, password reset instructions will be sent.", "success");
        } else {
          status(form, "Password updated. You can now sign in.", "success");
          form.reset();
          window.setTimeout(() => window.location.assign("/login.html"), 1200);
        }
      } catch (error) {
        status(form, error.message || "Network error. Please try again.", "error");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  });

  document.querySelectorAll("form[data-contact]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const original = button.textContent;
      button.disabled = true; button.textContent = "Sending…";
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch("/api/contact", {
          method: "POST", headers: {"Content-Type":"application/json","Accept":"application/json"},
          credentials: "same-origin", body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Message could not be sent.");
        status(form, "Thanks — your message has been received.", "success");
        form.reset();
      } catch (error) {
        status(form, error.message || "Please try again.", "error");
      } finally { button.disabled = false; button.textContent = original; }
    });
  });

  const actions = document.getElementById("header-actions");
  if (actions) {
    fetch("/api/auth/me", {headers:{"Accept":"application/json"},credentials:"same-origin"})
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data || !data.user) return;
        actions.innerHTML = '<a class="header-dashboard" href="/dashboard.html">My dashboard</a><button class="header-logout" type="button">Log out</button>';
        actions.querySelector(".header-logout").addEventListener("click", async () => {
          try { await fetch("/api/auth/logout", {method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"}}); }
          finally { window.location.assign("/"); }
        });
      }).catch(() => {});
  }
})();
