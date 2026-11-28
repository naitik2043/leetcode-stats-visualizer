(() => {
  "use strict";
  const profileForm = document.getElementById("readiness-profile-form");
  const usernameInput = document.getElementById("readiness-username");
  const status = document.getElementById("readiness-status");
  const workspace = document.getElementById("readiness-workspace");
  const ratingsForm = document.getElementById("readiness-ratings");
  const saveStatus = document.getElementById("readiness-save-status");
  const profileWeight = 40;
  const weightMap = { cs: 20, projects: 15, communication: 10, mocks: 10, resume: 5 };
  const labels = {
    cs: "Core CS fundamentals",
    projects: "Project ownership",
    communication: "Problem explanation",
    mocks: "Mock interview practice",
    resume: "Resume and role alignment"
  };
  let dsaScore = 0;
  let activeUsername = "";

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function storageKey(username) {
    return "leetmetric-readiness:" + username.toLowerCase();
  }

  function ratings() {
    const result = {};
    Object.keys(weightMap).forEach((key) => {
      result[key] = Number(ratingsForm.elements[key].value);
    });
    return result;
  }

  function scoreFor(values) {
    const dsaContribution = dsaScore * profileWeight / 100;
    const selfContribution = Object.keys(weightMap).reduce((sum, key) => {
      return sum + (values[key] / 4) * weightMap[key];
    }, 0);
    return Math.round(dsaContribution + selfContribution);
  }

  function updateLabels() {
    Object.keys(weightMap).forEach((key) => {
      document.getElementById("value-" + key).textContent = ratingsForm.elements[key].value + " / 4";
    });
    if (!workspace.hidden) renderScore();
  }

  function loadSavedRatings(username) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey(username)) || "{}"); }
    catch { saved = {}; }
    Object.keys(weightMap).forEach((key) => {
      const value = Number(saved[key]);
      ratingsForm.elements[key].value = Number.isInteger(value) && value >= 0 && value <= 4 ? value : 2;
    });
    updateLabels();
  }

  function renderScore() {
    const values = ratings();
    const score = scoreFor(values);
    const label = score >= 80 ? "Strong preparation signals" : score >= 65 ? "Progressing toward interview readiness" : score >= 45 ? "Preparation in progress" : "Build your foundations";
    document.getElementById("readiness-score").textContent = score;
    document.getElementById("readiness-label").textContent = label;
    document.getElementById("readiness-summary").textContent =
      "DSA practice contributes " + Math.round(dsaScore * 0.4) + " weighted points. The remaining score comes from your self-ratings. Update the sliders as your preparation improves.";

    const breakdown = document.getElementById("readiness-breakdown");
    breakdown.replaceChildren();
    const rows = [{ key: "dsa", title: "LeetCode practice signals", score: dsaScore, weight: 40 }];
    Object.keys(weightMap).forEach((key) => rows.push({
      key, title: labels[key], score: values[key] * 25, weight: weightMap[key]
    }));
    rows.forEach((item) => {
      const row = el("div", "readiness-breakdown-row");
      const heading = el("div", "readiness-breakdown-heading");
      heading.append(el("span", "", item.title), el("strong", "", Math.round(item.score) + "%"));
      const track = el("div", "readiness-track");
      const fill = el("span");
      fill.style.width = item.score + "%";
      track.append(fill);
      row.append(heading, track);
      breakdown.append(row);
    });

    const actions = document.getElementById("readiness-actions");
    actions.replaceChildren();
    const sorted = Object.keys(weightMap).sort((a, b) => values[a] - values[b]);
    const lowest = sorted.slice(0, 3);
    const suggestions = {
      cs: "Schedule focused revision for OOP, DBMS, OS and computer networks. Practice explaining concepts with small examples.",
      projects: "Prepare a 2-minute and a 10-minute walkthrough for each major project, including one difficult trade-off and how you tested it.",
      communication: "Practice narrating the brute-force approach first, then optimize while explaining time and space complexity.",
      mocks: "Complete a timed mock interview each week and review clarity, edge cases and time management afterward.",
      resume: "Align project bullets to the target role and make sure every metric, link and claimed contribution can be verified."
    };
    lowest.forEach((key) => {
      const card = el("article", "readiness-action");
      card.append(el("span", "readiness-action-score", values[key] + " / 4"), el("h3", "", labels[key]), el("p", "", suggestions[key]));
      actions.append(card);
    });
    const dsaCard = el("article", "readiness-action");
    dsaCard.append(el("span", "readiness-action-score", dsaScore + " / 100"), el("h3", "", "Continue deliberate DSA practice"), el("p", "", "Use Performance Intelligence and the personalized roadmap to improve topic breadth, Medium/Hard balance and practice consistency."));
    actions.append(dsaCard);
  }

  Object.keys(weightMap).forEach((key) => {
    ratingsForm.elements[key].addEventListener("input", updateLabels);
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
      status.textContent = "Enter a valid LeetCode username.";
      status.className = "readiness-status error";
      usernameInput.focus();
      return;
    }
    const button = profileForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Calculating…";
    workspace.hidden = true;
    status.textContent = "Loading public profile and calculating your practice component…";
    try {
      const response = await fetch("/api/leetcode/" + encodeURIComponent(username), {
        headers: { Accept: "application/json" }, credentials: "same-origin"
      });
      const profile = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(profile.error || "Unable to load the LeetCode profile.");
      dsaScore = window.LeetMetricIntelligence.analyzeProfile(profile).readiness.score;
      activeUsername = username;
      workspace.hidden = false;
      loadSavedRatings(username);
      renderScore();
      status.textContent = "Assessment ready. " + window.LeetMetricFreshness.describe(profile);
      status.className = "readiness-status " + (window.LeetMetricFreshness.isStale(profile) ? "warning" : "success");
      try { localStorage.setItem("leetmetric-last-username", username); } catch { /* Optional. */ }
    } catch (error) {
      status.textContent = error.message || "Unable to calculate the assessment.";
      status.className = "readiness-status error";
    } finally {
      button.disabled = false;
      button.textContent = "Calculate readiness →";
    }
  });

  document.getElementById("readiness-save").addEventListener("click", () => {
    if (!activeUsername) return;
    try {
      localStorage.setItem(storageKey(activeUsername), JSON.stringify(ratings()));
      saveStatus.textContent = "Assessment saved for " + activeUsername + " in this browser.";
    } catch {
      saveStatus.textContent = "Browser storage is unavailable; your current ratings remain visible until you leave this page.";
    }
  });

  const queryUsername = new URLSearchParams(window.location.search).get("username");
  if (queryUsername) usernameInput.value = queryUsername;
  else {
    try { usernameInput.value = localStorage.getItem("leetmetric-last-username") || ""; } catch { /* Optional. */ }
  }
})();
