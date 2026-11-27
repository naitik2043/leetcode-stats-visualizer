
(() => {
  const headerHost = document.getElementById("site-header");
  const footerHost = document.getElementById("site-footer");
  const current = window.location.pathname.toLowerCase();
  const active = (path) => current === path ? ' aria-current="page"' : "";
  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <a class="brand" href="/"><span class="brand-mark">L<span>.</span></span><span>leet<span class="brand-light">metric</span></span></a>
        <nav class="desktop-nav" aria-label="Main navigation">
          <a href="/" ${active("/")}>Home</a><a href="/features.html" ${active("/features.html")}>Features</a>
          <a href="/about.html" ${active("/about.html")}>About</a><a href="/faq.html" ${active("/faq.html")}>FAQ</a>
          <a href="/contact.html" ${active("/contact.html")}>Contact</a>
        </nav>
        <div class="header-actions" id="header-actions"><a class="header-login" href="/login.html">Log in</a><a class="header-signup" href="/signup.html">Create account</a></div>
        <button class="mobile-menu-button" type="button" aria-label="Toggle navigation" aria-expanded="false">Menu</button>
      </header>`;
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
          <div class="footer-column"><strong>PRODUCT</strong><a href="/features.html">Features</a><a href="/#insights">Stats dashboard</a><a href="/faq.html">FAQ</a></div>
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
