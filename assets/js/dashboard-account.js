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

  document.getElementById("export-account-data")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const status = document.getElementById("export-account-status");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing export…";
    if (status) status.textContent = "Collecting your private account data securely…";
    try {
      const response = await fetch("/api/user/export", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Account export could not be completed.");
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "leetmetric-account-export-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (status) status.textContent = "Export ready. Keep this file private because it includes Code Vault snippet contents and personal notes.";
    } catch (error) {
      if (status) status.textContent = error.message || "Unable to export account data.";
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.confirmation !== "DELETE") {
      show('Type DELETE exactly in the confirmation field to continue.', "error");
      return;
    }
    const confirmed = window.confirm(
      "This permanently deletes your LeetMetric account, snapshots, goals, revisions, saved roadmaps, Code Vault snippets and integration tickets. This cannot be undone. Continue?"
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
      show((payload.message || "Your account has been deleted.") + (payload.verification ? " Remaining records: " + Object.entries(payload.verification).filter(([key, value]) => key !== "verified" && typeof value === "number").map(([key, value]) => key + "=" + value).join(", ") + "." : ""), "success");
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