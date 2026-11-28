(function attachIntelligence(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LeetMetricIntelligence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createIntelligence() {
  "use strict";

  const DIFFICULTIES = ["easy", "medium", "hard"];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const round = (value) => Math.round(value * 10) / 10;

  function utcDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function activityWindow(daily, days, today) {
    const end = new Date(today);
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const byDate = new Map(
      (Array.isArray(daily) ? daily : []).map((item) => [String(item.date || "").slice(0, 10), numeric(item.count)])
    );
    let activeDays = 0;
    let submissions = 0;
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      const count = byDate.get(utcDateKey(date)) || 0;
      submissions += count;
      if (count > 0) activeDays += 1;
    }
    return { days, activeDays, submissions, averageSubmissionsPerActiveDay: activeDays ? round(submissions / activeDays) : 0 };
  }

  function normalizeProfile(profile) {
    const source = profile && typeof profile === "object" ? profile : {};
    const stats = source.stats && typeof source.stats === "object" ? source.stats : {};
    const rawSolved = stats.solved && typeof stats.solved === "object" ? stats.solved : {};
    const rawQuestions = stats.totalQuestions && typeof stats.totalQuestions === "object" ? stats.totalQuestions : {};
    const solved = {};
    const totalQuestions = {};
    DIFFICULTIES.forEach((key) => {
      solved[key] = numeric(rawSolved[key]);
      totalQuestions[key] = numeric(rawQuestions[key]);
    });
    const totalSolved = numeric(stats.totalSolved) || DIFFICULTIES.reduce((sum, key) => sum + solved[key], 0);
    const activity = source.activity && typeof source.activity === "object" ? source.activity : {};
    const topics = Array.isArray(source.topics)
      ? source.topics.filter((topic) => topic && typeof topic.name === "string" && topic.name.trim()).map((topic) => ({
        name: topic.name.trim(),
        slug: typeof topic.slug === "string" ? topic.slug : "",
        solved: numeric(topic.solved),
        level: typeof topic.level === "string" ? topic.level : "unknown"
      }))
      : [];
    const contest = source.contest && typeof source.contest === "object" ? source.contest : null;
    return {
      username: typeof source.username === "string" ? source.username : "",
      fetchedAt: source.fetchedAt || null,
      stats: {
        totalSolved,
        solved,
        totalQuestions,
        acceptedTotal: numeric(stats.acceptedTotal),
        submissionTotal: numeric(stats.submissionTotal),
        acceptanceRate: clamp(numeric(stats.acceptanceRate), 0, 100)
      },
      activity: {
        currentStreak: numeric(activity.currentStreak),
        totalActiveDays: numeric(activity.totalActiveDays),
        daily: Array.isArray(activity.daily) ? activity.daily : []
      },
      topics,
      contest
    };
  }

  function summarizeMistakes(revisions) {
    const items = Array.isArray(revisions) ? revisions : [];
    const counts = {};
    items.forEach((item) => {
      const type = item && typeof item.mistakeType === "string" ? item.mistakeType : "other";
      counts[type] = (counts[type] || 0) + 1;
    });
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      total: items.length,
      mastered: items.filter((item) => item && item.status === "mastered").length,
      open: items.filter((item) => item && item.status !== "mastered").length,
      byType: ranked.map(([type, count]) => ({ type, count })),
      topPattern: ranked.length ? ranked[0][0] : null
    };
  }

  function analyzeProfile(rawProfile, options) {
    const profile = normalizeProfile(rawProfile);
    const today = options && options.today ? new Date(options.today) : new Date();
    const last7 = activityWindow(profile.activity.daily, 7, today);
    const last30 = activityWindow(profile.activity.daily, 30, today);
    const last90 = activityWindow(profile.activity.daily, 90, today);
    const solved = profile.stats.solved;
    const totalSolved = profile.stats.totalSolved;
    const mediumHardShare = totalSolved ? (solved.medium + solved.hard) / totalSolved : 0;
    const availableTopics = profile.topics.filter((topic) => topic.solved > 0);
    const uniqueTopicCount = new Set(availableTopics.map((topic) => topic.slug || topic.name.toLowerCase())).size;

    const volumeScore = clamp((totalSolved / 300) * 100, 0, 100);
    const balanceScore = clamp((mediumHardShare / 0.45) * 100, 0, 100);
    const breadthScore = clamp((uniqueTopicCount / 15) * 100, 0, 100);
    const consistencyScore = clamp((last30.activeDays / 20) * 100, 0, 100);

    const components = [
      { key: "problemVolume", label: "Problem volume", score: volumeScore, weight: 25 },
      { key: "difficultyBalance", label: "Difficulty balance", score: balanceScore, weight: 25 },
      { key: "topicBreadth", label: "Topic breadth", score: breadthScore, weight: 25 },
      { key: "practiceConsistency", label: "Practice consistency", score: consistencyScore, weight: 25 }
    ];
    const readinessIndex = Math.round(components.reduce((sum, item) => sum + item.score * item.weight, 0) / 100);

    const sortedTopics = availableTopics.slice().sort((a, b) => a.solved - b.solved || a.name.localeCompare(b.name));
    const topicFocus = sortedTopics.slice(0, 5).map((topic) => ({
      name: topic.name,
      solved: topic.solved,
      level: topic.level,
      reason: "Lower recorded solved count among the topics returned by this profile."
    }));

    const recommendations = [];
    if (totalSolved === 0) {
      recommendations.push({ title: "Start with a small baseline", detail: "Solve a few Easy problems so future progress comparisons have a meaningful starting point.", evidence: "No solved-problem count was returned." });
    } else if (mediumHardShare < 0.35) {
      recommendations.push({ title: "Build Medium problem confidence", detail: "Add a gradual Medium-problem block while retaining regular Easy revision.", evidence: Math.round(mediumHardShare * 100) + "% of your solved problems are Medium or Hard." });
    } else {
      recommendations.push({ title: "Maintain balanced difficulty practice", detail: "Keep rotating across Easy, Medium and Hard problems instead of focusing on one level.", evidence: "Your current Medium/Hard share is " + Math.round(mediumHardShare * 100) + "%." });
    }
    if (topicFocus.length) {
      recommendations.push({ title: "Broaden topic coverage", detail: "Consider reviewing " + topicFocus.slice(0, 3).map((topic) => topic.name).join(", ") + " as possible next practice areas.", evidence: "These topics have the lowest non-zero solved counts in the available tag data." });
    } else {
      recommendations.push({ title: "Collect more topic data", detail: "Use a profile with public topic statistics to unlock topic-level recommendations.", evidence: "No topic tags with solved counts were returned." });
    }
    if (last7.activeDays < 3) {
      recommendations.push({ title: "Make practice more consistent", detail: "Try three focused practice days this week. Short, repeatable sessions are easier to sustain.", evidence: last7.activeDays + " active days were recorded in the last 7 days." });
    } else {
      recommendations.push({ title: "Protect your practice rhythm", detail: "Keep your current weekly cadence and add a short revision session after each practice block.", evidence: last7.activeDays + " active days were recorded in the last 7 days." });
    }

    const contest = profile.contest;
    if (contest && numeric(contest.attendedContestsCount) > 0) {
      recommendations.push({ title: "Review contest performance", detail: "Use your rating trend to choose one weak topic for deliberate practice before the next contest.", evidence: numeric(contest.attendedContestsCount) + " attended contests are available." });
    }

    return {
      username: profile.username,
      fetchedAt: profile.fetchedAt,
      totals: {
        solved: totalSolved,
        easy: solved.easy,
        medium: solved.medium,
        hard: solved.hard,
        mediumHardShare: round(mediumHardShare * 100),
        acceptanceRate: profile.stats.acceptanceRate
      },
      activity: {
        currentStreak: profile.activity.currentStreak,
        totalActiveDays: profile.activity.totalActiveDays,
        last7,
        last30,
        last90
      },
      topics: {
        available: profile.topics.length,
        practiced: uniqueTopicCount,
        lowerCoverageCandidates: topicFocus
      },
      readiness: {
        score: readinessIndex,
        label: readinessIndex >= 75 ? "Strong practice foundation" : readinessIndex >= 50 ? "Developing foundation" : "Early-stage foundation",
        disclaimer: "This is a transparent practice index, not a hiring prediction or a guarantee of interview readiness.",
        components,
        methodology: "Equal weights: problem volume (300 solved = 100), Medium/Hard balance (45% = 100), 15 practiced topic tags = 100, and 20 active days in the last 30 = 100. Missing activity or topic data scores zero; interpret the result alongside the data coverage notes."
      },
      recommendations,
      dataNotes: [
        profile.activity.daily.length ? "Activity is based on public calendar submissions, not unique accepted problems or time spent." : "No public activity calendar was returned; consistency scoring is therefore limited.",
        profile.topics.length ? "Topic counts are tag-level solved counts and can overlap across problems; they are not mastery scores." : "No public topic-tag data was returned.",
        "LeetCode's public profile endpoint is an upstream dependency and may return partial or stale fields."
      ]
    };
  }

  function predictProgress(snapshots) {
    if (!Array.isArray(snapshots) || snapshots.length < 2) {
      return { available: false, reason: "Save at least two daily snapshots to estimate your recent pace." };
    }
    const normalized = snapshots.map((item) => {
      const dateKey = String(item && item.dateKey || "");
      const totalSolved = Number(item && item.totalSolved);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isSafeInteger(totalSolved) || totalSolved < 0) return null;
      const timestamp = Date.parse(dateKey + "T00:00:00.000Z");
      return Number.isFinite(timestamp) ? { dateKey, timestamp, totalSolved } : null;
    }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);

    if (normalized.length < 2) {
      return { available: false, reason: "The saved history does not contain enough valid daily snapshots." };
    }
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    const elapsedDays = Math.floor((last.timestamp - first.timestamp) / 86400000);
    const solvedGrowth = last.totalSolved - first.totalSolved;
    if (elapsedDays < 7) {
      return { available: false, reason: "Save snapshots across at least 7 days to reduce noise in the pace estimate." };
    }
    if (solvedGrowth <= 0) {
      return { available: false, reason: "Your saved snapshots do not show positive net growth yet; keep recording progress before estimating a milestone date." };
    }

    const averageSolvedPerDay = solvedGrowth / elapsedDays;
    const nextMilestone = (Math.floor(last.totalSolved / 100) + 1) * 100;
    const daysToMilestone = Math.ceil((nextMilestone - last.totalSolved) / averageSolvedPerDay);
    const projectedDate = new Date(last.timestamp + daysToMilestone * 86400000);
    return {
      available: true,
      baselineDate: first.dateKey,
      latestDate: last.dateKey,
      baselineSolved: first.totalSolved,
      currentSolved: last.totalSolved,
      solvedGrowth,
      elapsedDays,
      averageSolvedPerDay: round(averageSolvedPerDay),
      nextMilestone,
      daysToMilestone,
      projectedDate: utcDateKey(projectedDate),
      methodology: "Linear estimate from net solved-count change across the first and latest valid saved snapshots. Assumes the same average pace continues; it is not a promise or a prediction of interview success."
    };
  }

  function createRoadmap(rawProfile, options) {
    const insights = analyzeProfile(rawProfile, options);
    const profile = normalizeProfile(rawProfile);
    const lowTopics = insights.topics.lowerCoverageCandidates.map((item) => item.name);
    const fallbackTopics = ["Arrays & Strings", "Binary Search", "Linked Lists", "Trees", "Graphs", "Dynamic Programming"];
    const topics = lowTopics.length ? lowTopics : fallbackTopics;
    const focusDifficulty = profile.stats.solved.medium < profile.stats.solved.easy ? "Medium" : "Hard";
    const requestedDays = Number(options && options.horizonDays);
    const horizonDays = [7, 30, 90].includes(requestedDays) ? requestedDays : 42;
    const weekCount = Math.ceil(horizonDays / 7);
    const weeks = [];
    for (let index = 0; index < weekCount; index += 1) {
      const topic = topics[index % topics.length];
      const secondary = topics[(index + 1) % topics.length];
      const earlyWeek = index < 2;
      const target = horizonDays === 7 ? 4 : earlyWeek ? 8 : 10;
      weeks.push({
        week: index + 1,
        title: "Week " + (index + 1) + " — " + topic,
        focus: topic,
        secondary,
        target,
        difficulty: earlyWeek ? "Easy → Medium" : focusDifficulty,
        tasks: [
          "Review the core pattern and write a short note.",
          "Solve " + Math.ceil(target * 0.6) + " problems on " + topic + ".",
          "Solve " + Math.floor(target * 0.4) + " problems on " + secondary + ".",
          "Revisit one previously incorrect or queued problem."
        ]
      });
    }
    return {
      generatedAt: new Date().toISOString(),
      username: insights.username,
      horizonDays,
      goal: "Build a more balanced and consistent DSA practice routine.",
      weeks,
      estimatedProblemTarget: weeks.reduce((sum, week) => sum + week.target, 0),
      note: "This roadmap uses public tag counts as directional signals. Confirm topic availability and adjust targets to your schedule."
    };
  }

  return {
    analyzeProfile,
    createRoadmap,
    summarizeMistakes,
    activityWindow,
    normalizeProfile,
    predictProgress
  };
});
