(() => {
  const form = document.getElementById("delete-account-form");
  const statusBox = document.getElementById("delete-account-status");
  const emailInput = document.getElementById("delete-account-email");
  if (!form || !statusBox || !emailInput) return;

  function show(message, kind) {
    statusBox.textContent = message;
    statusBox.className = "feature-status show" + (kind ? " " + kind : "");
  }

  document.addEventListener("leetmetric:workspace-ready", (event) => {
    const email = String(event.detail && event.detail.email || "").trim();
    if (email && !emailInput.value) emailInput.value = email;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.confirmation !== "DELETE") {
      show('Type DELETE exactly in the confirmation field to continue.', "error");
      return;
    }
    const confirmed = window.confirm(
      "This permanently deletes your LeetMetric account and its saved snapshots, goals and revision notes. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    const button = form.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Deleting account…";
    try {
      const response = await fetch("/api/user/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Account deletion could not be completed.");
      show(payload.message || "Your account has been deleted.", "success");
      form.reset();
      window.setTimeout(() => window.location.replace("/"), 1200);
    } catch (error) {
      show(error.message || "Account deletion could not be completed.", "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
})();