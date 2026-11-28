(() => {
  const button = document.getElementById("open-code-vault");
  const status = document.getElementById("code-vault-status");
  if (!button || !status) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Creating a secure sign-in link…";
    try {
      const response = await fetch("/api/integrations/paste", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: "{}"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not open Code Vault.");
      if (!result.launchUrl) throw new Error("The Code Vault sign-in link was not returned.");
      status.textContent = "Secure link created. Opening your private workspace…";
      window.location.assign(result.launchUrl);
    } catch (error) {
      status.textContent = error.message || "Unable to open Code Vault. Please try again.";
      button.disabled = false;
    }
  });
})();
