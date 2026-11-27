(() => {
  const welcomeName = document.getElementById("welcome-name");
  const welcomeEmail = document.getElementById("welcome-email");
  const savedInput = document.getElementById("saved-username");
  const saveForm = document.getElementById("save-profile-form");
  const profileStatus = document.getElementById("profile-status");

  function showProfileStatus(message, kind = "success") {
    profileStatus.textContent = message;
    profileStatus.className = `form-status show ${kind}`;
  }

  async function loadWorkspace() {
    try {
      const response = await fetch("/api/auth/me", {credentials:"same-origin",headers:{Accept:"application/json"}});
      if (response.status === 503) throw new Error("Account storage is not configured on this deployment yet.");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.user) {
        window.location.replace("/login.html?next=%2Fdashboard.html");
        return;
      }
      welcomeName.textContent = `Welcome, ${payload.user.name}.`;
      welcomeEmail.textContent = payload.user.email;
      savedInput.value = payload.user.leetcodeUsername || "";
      if (payload.user.leetcodeUsername) {
        document.getElementById("user-input").value = payload.user.leetcodeUsername;
      }
    } catch (error) {
      welcomeName.textContent = "Your workspace is not ready yet.";
      welcomeEmail.textContent = error.message || "Could not load account information.";
      showProfileStatus(error.message || "Unable to load account information.", "error");
    }
  }

  saveForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = savedInput.value.trim();
    if (username && !/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
      showProfileStatus("Enter a valid LeetCode username.", "error");
      return;
    }
    const button = saveForm.querySelector("button");
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Saving…";
    try {
      const response = await fetch("/api/user/profile", {
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({leetcodeUsername:username})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to save your profile.");
      savedInput.value = payload.user.leetcodeUsername || "";
      document.getElementById("user-input").value = savedInput.value;
      showProfileStatus(savedInput.value ? "Your preferred LeetCode profile is saved." : "Saved profile removed.", "success");
    } catch (error) {
      showProfileStatus(error.message || "Unable to save your profile.", "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  loadWorkspace();
})();