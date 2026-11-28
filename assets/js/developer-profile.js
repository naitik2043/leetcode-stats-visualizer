(() => {
  "use strict";
  const form = document.getElementById("developer-profile-form");
  const submit = document.getElementById("dev-submit");
  const status = document.getElementById("dev-status");
  const results = document.getElementById("developer-results");
  let snapshot = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function metric(label, value) {
    const item = el("div", "developer-metric");
    item.append(el("span", "", label), el("strong", "", value === null || value === undefined || value === "" ? "—" : String(value)));
    return item;
  }

  function statusMessage(message, kind) {
    status.textContent = message;
    status.className = "developer-status" + (kind ? " " + kind : "");
  }

  function renderPlatform(key, title, data, error) {
    const name = document.getElementById("developer-" + key + "-name");
    const note = document.getElementById("developer-" + key + "-note");
    const host = document.getElementById("developer-" + key + "-metrics");
    const link = document.getElementById("developer-" + key + "-link");
    const url = data && data.url;
    host.replaceChildren();
    link.hidden = !url;
    if (url) link.href = url;
    if (error) {
      name.textContent = title + " unavailable";
      note.textContent = error;
      return;
    }
    if (!data) {
      name.textContent = "Not requested";
      note.textContent = "No username was provided for this platform.";
      return;
    }
    name.textContent = data.name ? data.name + " · @" + data.username : "@" + data.username;
    note.textContent = data.bio || "Public platform profile loaded.";
    (data.metrics || []).forEach(([label, value]) => host.append(metric(label, value)));
  }

  function render(snapshotData) {
    snapshot = snapshotData;
    results.hidden = false;
    document.getElementById("developer-profile-heading").textContent =
      [snapshotData.leetcode && snapshotData.leetcode.username, snapshotData.codeforces && snapshotData.codeforces.username, snapshotData.github && snapshotData.github.username]
        .filter(Boolean).join(" · ") || "Developer profile";
    document.getElementById("developer-refreshed").textContent = "Fetched " + new Date(snapshotData.generatedAt).toLocaleString();

    const leetcode = snapshotData.leetcode && {
      username: snapshotData.leetcode.username,
      url: "https://leetcode.com/u/" + encodeURIComponent(snapshotData.leetcode.username) + "/",
      bio: window.LeetMetricFreshness.describe(snapshotData.leetcode),
      metrics: [
        ["Problems solved", Number(snapshotData.leetcode.stats.totalSolved).toLocaleString()],
        ["Easy / Medium / Hard", [snapshotData.leetcode.stats.solved.easy, snapshotData.leetcode.stats.solved.medium, snapshotData.leetcode.stats.solved.hard].join(" / ")],
        ["Acceptance rate", snapshotData.leetcode.stats.acceptanceRate + "%"],
        ["Contest rating", snapshotData.leetcode.contest && snapshotData.leetcode.contest.rating !== null ? Math.round(snapshotData.leetcode.contest.rating).toLocaleString() : "Not available"]
      ]
    };
    renderPlatform("leetcode", "LeetCode", leetcode, snapshotData.errors.leetcode);
    if (snapshotData.codeforces) {
      const cf = snapshotData.codeforces;
      renderPlatform("codeforces", "Codeforces", {
        username: cf.username, url: cf.url,
        metrics: [
          ["Current rating", cf.rating ? cf.rating.toLocaleString() : "Unrated"],
          ["Peak rating", cf.maxRating ? cf.maxRating.toLocaleString() : "—"],
          ["Current rank", cf.rank],
          ["Peak rank", cf.maxRank],
          ["Contribution", cf.contribution],
          ["Friends", cf.friendOfCount.toLocaleString()]
        ]
      }, null);
    } else renderPlatform("codeforces", "Codeforces", null, snapshotData.errors.codeforces);

    if (snapshotData.github) {
      const gh = snapshotData.github;
      renderPlatform("github", "GitHub", {
        username: gh.username, name: gh.name, bio: gh.bio, url: gh.url,
        metrics: [
          ["Public repositories", gh.publicRepositories.toLocaleString()],
          ["Followers", gh.followers.toLocaleString()],
          ["Following", gh.following.toLocaleString()],
          ["Stars · sampled repositories", gh.sampledStars.toLocaleString()],
          ["Repositories inspected", gh.repositoriesSampled.toLocaleString()]
        ]
      }, null);
      const languageHost = document.getElementById("developer-github-languages");
      languageHost.replaceChildren();
      if (gh.languagesSampled.length) {
        languageHost.append(el("h4", "", "Languages in sampled repositories"));
        const chips = el("div", "developer-language-chips");
        gh.languagesSampled.forEach((item) => chips.append(el("span", "", item.name + " · " + item.repositoriesCount)));
        languageHost.append(chips);
      }
      const repoHost = document.getElementById("developer-github-repositories");
      repoHost.replaceChildren();
      if (gh.latestRepositories.length) {
        repoHost.append(el("h4", "", "Recently updated public repositories"));
        gh.latestRepositories.forEach((repo) => {
          const row = el("a", "developer-repository");
          row.href = repo.url;
          row.target = "_blank";
          row.rel = "noopener noreferrer";
          const title = el("strong", "", repo.name);
          const description = el("span", "", repo.description || "No description provided.");
          row.append(title, description, el("small", "", repo.language + " · " + repo.stars + " stars"));
          repoHost.append(row);
        });
      }
      document.getElementById("developer-github-note").textContent = gh.samplingNote;
    } else {
      renderPlatform("github", "GitHub", null, snapshotData.errors.github);
      document.getElementById("developer-github-languages").replaceChildren();
      document.getElementById("developer-github-repositories").replaceChildren();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const usernames = {
      leetcode: document.getElementById("dev-leetcode").value.trim(),
      codeforces: document.getElementById("dev-codeforces").value.trim(),
      github: document.getElementById("dev-github").value.trim()
    };
    if (!Object.values(usernames).some(Boolean)) {
      statusMessage("Enter at least one public username.", "error");
      return;
    }
    if (usernames.leetcode && !/^[a-zA-Z0-9_-]{1,30}$/.test(usernames.leetcode)) {
      statusMessage("The LeetCode username format is invalid.", "error");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Loading profiles…";
    results.hidden = true;
    statusMessage("Fetching public profiles. A platform may respond more slowly or enforce its own rate limit.");
    const tasks = {};
    if (usernames.leetcode) tasks.leetcode = fetch("/api/leetcode/" + encodeURIComponent(usernames.leetcode), { headers: { Accept: "application/json" } }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "LeetCode profile unavailable.");
      return payload;
    });
    if (usernames.codeforces) tasks.codeforces = window.LeetMetricDeveloperPlatforms.fetchCodeforces(usernames.codeforces);
    if (usernames.github) tasks.github = window.LeetMetricDeveloperPlatforms.fetchGitHub(usernames.github);

    const keys = Object.keys(tasks);
    const settled = await Promise.allSettled(keys.map((key) => tasks[key]));
    const data = { generatedAt: new Date().toISOString(), errors: {} };
    settled.forEach((result, index) => {
      const key = keys[index];
      if (result.status === "fulfilled") data[key] = result.value;
      else data.errors[key] = result.reason && result.reason.message ? result.reason.message : "Unable to load this platform profile.";
    });
    render(data);
    const loaded = keys.filter((key) => data[key]).length;
    const freshness = data.leetcode ? " " + window.LeetMetricFreshness.describe(data.leetcode) : "";
    const stale = data.leetcode && window.LeetMetricFreshness.isStale(data.leetcode);
    statusMessage(loaded + " of " + keys.length + " requested platform profile(s) loaded. Failures remain isolated to their platform." + freshness, loaded ? (stale ? "warning" : "success") : "error");
    submit.disabled = false;
    submit.textContent = "Build developer profile →";
  });

  document.getElementById("developer-export").addEventListener("click", () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = el("a");
    anchor.href = url;
    anchor.download = "leetmetric-developer-profile.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("developer-copy").addEventListener("click", async () => {
    if (!snapshot) return;
    const url = new URL(window.location.href);
    ["leetcode", "codeforces", "github"].forEach((key) => {
      if (snapshot[key] && snapshot[key].username) url.searchParams.set(key, snapshot[key].username);
    });
    try {
      await navigator.clipboard.writeText(url.toString());
      statusMessage("Shareable lookup link copied. It contains public usernames only.", "success");
    } catch {
      statusMessage("Clipboard access is unavailable. Copy the current page URL manually after the usernames are loaded.", "error");
    }
  });

  const params = new URLSearchParams(window.location.search);
  document.getElementById("dev-leetcode").value = params.get("leetcode") || "";
  document.getElementById("dev-codeforces").value = params.get("codeforces") || "";
  document.getElementById("dev-github").value = params.get("github") || "";
  if (["leetcode", "codeforces", "github"].some((key) => params.get(key))) form.requestSubmit();
})();
