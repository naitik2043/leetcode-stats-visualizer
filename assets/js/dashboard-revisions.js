(() => {
  const form = document.getElementById("revision-form");
  const list = document.getElementById("revision-list");
  const statusBox = document.getElementById("revision-status");
  const count = document.getElementById("revision-count");
  let savedUsername = "";
  let items = [];
  let submitting = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function message(text, kind) {
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.className = "feature-status show" + (kind ? " " + kind : "");
  }

  function dateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Saved recently"
      : "Updated " + date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  async function api(url, options) {
    const requestOptions = options || {};
    const response = await fetch(url, {
      ...requestOptions,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(requestOptions.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The revision request could not be completed.");
    return payload;
  }

  function render() {
    if (!list) return;
    list.replaceChildren();
    if (count) count.textContent = items.length + " / 100 ITEMS";

    if (!savedUsername) {
      list.append(element("p", "workspace-empty-state", "Save a preferred LeetCode profile to start a private revision queue."));
      return;
    }
    if (items.length === 0) {
      list.append(element("p", "workspace-empty-state", "Your revision queue is empty. Add a problem you want to revisit after your next practice session."));
      return;
    }

    const labels = {
      "pattern-recognition": "Pattern recognition",
      "edge-cases": "Edge cases",
      complexity: "Time / space complexity",
      implementation: "Implementation",
      recall: "Concept recall",
      other: "Other"
    };

    const statusOrder = { queued: 0, reviewing: 1, mastered: 2 };
    const orderedItems = items.slice().sort((a, b) =>
      (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    );

    orderedItems.forEach((item) => {
      const card = element("article", "revision-item");
      const top = element("div", "revision-item-top");
      const heading = element("div", "revision-item-heading");
      heading.append(element("h4", "", item.title));
      const meta = element("div", "revision-item-meta");
      meta.append(
        element("span", "revision-badge", item.difficulty),
        element("span", "revision-badge revision-badge-muted", item.topic || "Topic not set"),
        element("span", "revision-badge revision-badge-muted", labels[item.mistakeType] || "Other")
      );
      if (Number.isInteger(item.attemptsBeforeAccepted) && item.attemptsBeforeAccepted > 0) {
        meta.append(element("span", "revision-badge revision-badge-muted", "Accepted in " + item.attemptsBeforeAccepted + " attempt(s)"));
      }
      if (Number.isInteger(item.timeSpentMinutes) && item.timeSpentMinutes > 0) {
        meta.append(element("span", "revision-badge revision-badge-muted", item.timeSpentMinutes + " min logged"));
      }
      heading.append(meta);
      const statusWrap = element("label", "revision-status-control");
      statusWrap.append(element("span", "", "STATUS"));
      const status = document.createElement("select");
      status.setAttribute("aria-label", "Revision status for " + item.title);
      [
        ["queued", "To revisit"],
        ["reviewing", "Revisiting"],
        ["mastered", "Mastered"]
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        status.append(option);
      });
      status.value = item.status;
      status.addEventListener("change", () => updateItem(item.id, { status: status.value }));
      statusWrap.append(status);
      top.append(heading, statusWrap);

      card.append(top);
      if (item.problemUrl) {
        const link = element("a", "revision-problem-link", "Open problem ↗");
        link.href = item.problemUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.append(link);
      }
      if (item.notes) card.append(element("p", "revision-notes", item.notes));

      const footer = element("div", "revision-item-footer");
      footer.append(element("span", "", dateLabel(item.updatedAt)));
      const deleteButton = element("button", "revision-delete", "Delete");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", () => deleteItem(item.id));
      footer.append(deleteButton);
      card.append(footer);
      list.append(card);
    });
  }

  async function loadItems() {
    if (!savedUsername) {
      items = [];
      render();
      return;
    }
    try {
      const payload = await api("/api/revisions");
      items = Array.isArray(payload.revisions) ? payload.revisions : [];
      render();
    } catch (error) {
      message(error.message || "Unable to load your revision queue.", "error");
    }
  }

  async function updateItem(id, changes) {
    try {
      const payload = await api("/api/revisions/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
      });
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) items[index] = payload.revision;
      render();
      message(payload.message || "Revision updated.", "success");
    } catch (error) {
      message(error.message || "Unable to update this revision.", "error");
      await loadItems();
    }
  }

  async function deleteItem(id) {
    const item = items.find((entry) => entry.id === id);
    if (!item || !window.confirm('Delete "' + item.title + '" from your revision queue?')) return;
    try {
      const payload = await api("/api/revisions/" + encodeURIComponent(id), { method: "DELETE" });
      items = items.filter((entry) => entry.id !== id);
      render();
      message(payload.message || "Revision deleted.", "success");
    } catch (error) {
      message(error.message || "Unable to delete this revision.", "error");
    }
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      const data = Object.fromEntries(new FormData(form).entries());
      const button = form.querySelector('button[type="submit"]');
      const original = button.textContent;
      submitting = true;
      button.disabled = true;
      button.textContent = "Adding…";
      try {
        const payload = await api("/api/revisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        if (payload.revision) items.unshift(payload.revision);
        render();
        form.reset();
        message(payload.message || "Problem added to your revision queue.", "success");
      } catch (error) {
        message(error.message || "Unable to add this problem.", "error");
      } finally {
        submitting = false;
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  document.addEventListener("leetmetric:workspace-ready", (event) => {
    const nextUsername = String(event.detail && event.detail.username || "").trim();
    if (nextUsername.toLowerCase() !== savedUsername.toLowerCase()) {
      savedUsername = nextUsername;
      items = [];
      render();
      if (savedUsername) loadItems();
    }
  });

  render();
})();