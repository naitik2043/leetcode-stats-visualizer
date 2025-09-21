document.addEventListener("DOMContentLoaded", function () {
  const searchButton = document.getElementById("search-btn");
  const usernameInput = document.getElementById("user-input");
  const easyProgressCircle = document.querySelector(".easy-progress");
  const mediumProgressCircle = document.querySelector(".medium-progress");
  const hardProgressCircle = document.querySelector(".hard-progress");
  const easyLabel = document.getElementById("easy-label");
  const mediumLabel = document.getElementById("medium-label");
  const hardLabel = document.getElementById("hard-label");
  const cardStatsContainer = document.querySelector(".stats-cards");

  function validateUsername(username) {
    if (username.trim() === "") {
      alert("Username should not be empty");
      return false;
    }
    const regex = /^[a-zA-Z0-9_-]{1,30}$/;
    if (!regex.test(username)) {
      alert("Invalid Username");
      return false;
    }
    return true;
  }

  async function fetchUserDetails(username) {
    try {
      searchButton.textContent = "Searching...";
      searchButton.disabled = true;

      const proxyUrl = "https://cors-anywhere.herokuapp.com/";
      const targetUrl = "https://leetcode.com/graphql";

      const headers = new Headers();
      headers.append("Content-Type", "application/json");

      const graphqlQuery = JSON.stringify({
        query: `
          query userSessionProgress($username: String!) {
            allQuestionsCount { difficulty count }
            matchedUser(username: $username) {
              submitStats {
                acSubmissionNum { difficulty count submissions }
                totalSubmissionNum { difficulty count submissions }
              }
            }
          }`,
        variables: { username: username },
      });

      const response = await fetch(proxyUrl + targetUrl, {
        method: "POST",
        headers: headers,
        body: graphqlQuery,
      });

      if (!response.ok) throw new Error("Unable to fetch user details");

      const parsedData = await response.json();

      if (!parsedData.data || !parsedData.data.matchedUser) {
        cardStatsContainer.innerHTML = `<div class="card"><p>User not found</p></div>`;
        return;
      }

      displayUserData(parsedData);

    } catch (error) {
      cardStatsContainer.innerHTML = `<div class="card"><p>${error.message}</p></div>`;
    } finally {
      searchButton.textContent = "Search";
      searchButton.disabled = false;
    }
  }

  function animateProgress(circle, label, solved, total) {
    let current = 0;
    const increment = solved / 60;
    const interval = setInterval(() => {
      current += increment;
      if (current >= solved) current = solved;
      const degree = (current / total) * 360;
      circle.style.setProperty("--progress-degree", `${degree}deg`);
      label.textContent = `${Math.floor(current)}/${total}`;
      if (current >= solved) clearInterval(interval);
    }, 16);
  }

  function displayUserData(parsedData) {
    const totalEasy = parsedData.data.allQuestionsCount[1].count;
    const totalMedium = parsedData.data.allQuestionsCount[2].count;
    const totalHard = parsedData.data.allQuestionsCount[3].count;

    const solvedEasy = parsedData.data.matchedUser.submitStats.acSubmissionNum[1].count;
    const solvedMedium = parsedData.data.matchedUser.submitStats.acSubmissionNum[2].count;
    const solvedHard = parsedData.data.matchedUser.submitStats.acSubmissionNum[3].count;

    animateProgress(easyProgressCircle, easyLabel, solvedEasy, totalEasy);
    animateProgress(mediumProgressCircle, mediumLabel, solvedMedium, totalMedium);
    animateProgress(hardProgressCircle, hardLabel, solvedHard, totalHard);

    const cards = [
      { label: "Overall Submissions", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[0].submissions },
      { label: "Overall Easy Submissions", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[1].submissions },
      { label: "Overall Medium Submissions", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[2].submissions },
      { label: "Overall Hard Submissions", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[3].submissions },
    ];

    cardStatsContainer.innerHTML = cards
      .map(
        data => `<div class="card"><h4>${data.label}</h4><p>${data.value}</p></div>`
      )
      .join("");
  }

  searchButton.addEventListener("click", function () {
    const username = usernameInput.value;
    if (validateUsername(username)) fetchUserDetails(username);
  });
});
