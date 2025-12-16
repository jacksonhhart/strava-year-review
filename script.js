document.addEventListener("DOMContentLoaded", () => {
  /* ============================
     DOM ELEMENTS
  ============================ */
  const testBtn = document.getElementById("testBtn");
  const output = document.getElementById("output");
  const stravaBtn = document.getElementById("stravaConnect");
  const authOutput = document.getElementById("authOutput");
  let monthlyChart = null;


  testBtn?.addEventListener("click", () => {
    output.textContent = "✅ JavaScript is running!";
  });

  /* ============================
     STRAVA CONFIG
  ============================ */
  const STRAVA_CLIENT_ID = "190062";
  const REDIRECT_URI = "http://localhost:5500";

  //Prompt for token (NOT stored, NOT committed)
  const STRAVA_ACCESS_TOKEN = prompt("Paste your Strava access token:");

  /* ============================
     STRAVA OAUTH BUTTON
     (ONLY use when you need a NEW token)
     Clicking this WILL revoke the current token
  ============================ */
  stravaBtn?.addEventListener("click", () => {
    const authUrl =
      "https://www.strava.com/oauth/authorize" +
      `?client_id=${STRAVA_CLIENT_ID}` +
      "&response_type=code" +
      `&redirect_uri=${REDIRECT_URI}` +
      "&approval_prompt=force" +
      "&scope=read,activity:read_all";

    window.location.href = authUrl;
  });

  /* ============================
     FETCH ACTIVITIES
  ============================ */
  async function fetchActivities() {
    try {
      console.log("Using token:", STRAVA_ACCESS_TOKEN);

    if (!STRAVA_ACCESS_TOKEN) {
        authOutput.textContent = "No access token provided.";
        return;
    }


      let page = 1;
      let allActivities = [];

      while (true) {
        const response = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
          {
            headers: {
              Authorization: "Bearer " + STRAVA_ACCESS_TOKEN,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Strava API error: ${response.status}`);
        }

        const batch = await response.json();
        if (batch.length === 0) break;

        allActivities = allActivities.concat(batch);
        page++;
      }

      console.log("ALL ACTIVITIES:", allActivities);
      authOutput.textContent = `Loaded ${allActivities.length} activities`;
      return allActivities;

    } catch (err) {
      console.error(err);
      authOutput.textContent = "Failed to load activities";
    }
  }

  /* ============================
     HELPERS
  ============================ */
  function metersToMiles(meters) {
    return meters / 1609.34;
  }

  function secondsToHours(seconds) {
    return seconds / 3600;
  }

  /* ============================
     CORE STATS
  ============================ */
  function computeCoreStats(activities) {
    const runs = activities.filter(a => a.type === "Run");

    const totalMiles = runs.reduce(
      (sum, r) => sum + metersToMiles(r.distance),
      0
    );

    const totalHours = runs.reduce(
      (sum, r) => sum + secondsToHours(r.moving_time),
      0
    );

    const totalSeconds = runs.reduce(
      (sum, r) => sum + r.moving_time,
      0
    );

    const avgPaceSeconds = totalSeconds / totalMiles;
    const paceMin = Math.floor(avgPaceSeconds / 60);
    const paceSec = Math.round(avgPaceSeconds % 60)
      .toString()
      .padStart(2, "0");

    authOutput.textContent =
      `Runs: ${runs.length}\n` +
      `Miles: ${totalMiles.toFixed(1)}\n` +
      `Time: ${totalHours.toFixed(1)} hours\n` +
      `Average Pace: ${paceMin}:${paceSec} /mi`;
  }

  /* ============================
     HIGHLIGHTS
  ============================ */
  function computeHighlights(activities) {
    const runs = activities.filter(a => a.type === "Run");
    if (runs.length === 0) return;

    const longestRun = runs.reduce(
      (max, r) => (r.distance > max.distance ? r : max),
      runs[0]
    );

    const fastestRun = runs.reduce((best, r) => {
      const rPace = r.moving_time / (r.distance / 1609.34);
      const bestPace = best.moving_time / (best.distance / 1609.34);
      return rPace < bestPace ? r : best;
    }, runs[0]);

    const longestMiles = metersToMiles(longestRun.distance).toFixed(2);

    const fastestPaceSec =
      fastestRun.moving_time / metersToMiles(fastestRun.distance);
    const paceMin = Math.floor(fastestPaceSec / 60);
    const paceSec = Math.round(fastestPaceSec % 60)
      .toString()
      .padStart(2, "0");

    authOutput.textContent +=
      `\nLongest Run: ${longestMiles} mi` +
      `\nFastest Pace: ${paceMin}:${paceSec} /mi`;
  }

  /* ============================
     MONTHLY MILEAGE
  ============================ */
  function computeMonthlyMileage(activities) {
    const runs = activities.filter(a => a.type === "Run");
    const monthlyMiles = Array(12).fill(0);

    runs.forEach(run => {
      const month = new Date(run.start_date_local).getMonth();
      monthlyMiles[month] += metersToMiles(run.distance);
    });

    return monthlyMiles;
  }

  /* ============================
     YEAR FILTERING
  ============================ */
  let allActivities = [];

  function populateYearDropdown(activities) {
    const yearSelect = document.getElementById("yearSelect");

    const years = new Set(
      activities
        .filter(a => a.type === "Run")
        .map(a => new Date(a.start_date_local).getFullYear())
    );

    [...years].sort((a, b) => b - a).forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
  }

  function updateStats(selectedYear) {
    let filteredActivities;

    if (selectedYear === "all") {
      filteredActivities = allActivities;
    } else {
      filteredActivities = allActivities.filter(a => {
        const year = new Date(a.start_date_local).getFullYear();
        return year === Number(selectedYear);
      });
    }

    authOutput.textContent = "";
    computeCoreStats(filteredActivities);
    computeHighlights(filteredActivities);
    const monthlyMiles = computeMonthlyMileage(filteredActivities);
    renderMonthlyChart(monthlyMiles)
  }

function renderMonthlyChart(monthlyMiles) {
  const ctx = document.getElementById("monthlyChart").getContext("2d");

  const labels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // destroy old chart if it exists
  if (monthlyChart) {
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Miles Run",
        data: monthlyMiles.map(m => Number(m.toFixed(1))),
        backgroundColor: "#4ade80"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw} miles`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Miles"
          }
        }
      }
    }
  });
}


  document.getElementById("yearSelect")?.addEventListener("change", e => {
    updateStats(e.target.value);
  });

  /* ============================
     INIT
  ============================ */
let hasFetched = false;

async function init() {
  if (hasFetched) return;
    hasFetched = true;

  const activities = await fetchActivities();
  if (!activities) return;

  allActivities = activities;
  populateYearDropdown(allActivities);
  updateStats("all");
}

init();

});
