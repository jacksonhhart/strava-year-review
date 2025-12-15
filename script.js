document.addEventListener("DOMContentLoaded", () => {
  /* ============================
     DOM ELEMENTS
  ============================ */
  const testBtn = document.getElementById("testBtn");
  const output = document.getElementById("output");
  const stravaBtn = document.getElementById("stravaConnect");
  const authOutput = document.getElementById("authOutput");

  testBtn.addEventListener("click", () => {
    output.textContent = "✅ JavaScript is running!";
  });

  const STRAVA_CLIENT_ID = "190062";
  const REDIRECT_URI = "http://localhost:5500";

  const STRAVA_ACCESS_TOKEN = "a85b789a72ff2542b857425b1e036ddb12dde353";

  /* ============================
     STRAVA OAUTH BUTTON
     (kept for re-auth if needed)
  ============================ */
  stravaBtn.addEventListener("click", () => {
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
        console.log("Using token: ", STRAVA_ACCESS_TOKEN)

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

  //helper functions
  function metersToMiles(meters) {
    return meters / 1609.34;
  }

  function secondsToHours(seconds) {
    return seconds / 3600;
  }

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

  function computeHighlights(activities) {
    const runs = activities.filter(a => a.type === "Run");
    if (runs.length === 0) return;

    //longest run
    const longestRun = runs.reduce(
        (max, r) => (r.distance > max.distance ? r : max),
        runs[0]
    );

    //fastest run
    const fastestRun = runs.reduce((best, r) => {
        const rPace = r.moving_time / (r.distance/1609.34);
        const bestPace = best.moving_time / (best.distance / 1609.34);
        return rPace < bestPace ? r : best;
    }, runs[0]);

    const longestMiles = (longestRun.distance / 1609.34).toFixed(2);

    const fastestPaceSec = 
        fastestRun.moving_time / (fastestRun.distance / 1609.34);
    const paceMin = Math.floor(fastestPaceSec / 60);
    const paceSec = Math.round (fastestPaceSec % 60)
        .toString()
        .padStart(2, "0");

    console.log(`LONGEST RUN: ${longestMiles} miles`);
    console.log(`FASTEST PACE:" ${paceMin}:${paceSec} /mi`);

    authOutput.textContent += 
        `\nLongest Run: ${longestMiles} mi` +
        `\nFastest Pace: ${paceMin}:${paceSec} /mi`;
  }

  function computeMonthlyMileage(activities) {
    const runs = activities.filter(a => a.type === "Run");
    const monthlyMiles = Array(12).fill(0);

    runs.forEach(run => {
        const month = new Date(run.start_date_local).getMonth();
        monthlyMiles[month] += metersToMiles(run.distance);
    });

    return monthlyMiles
  }
    
    fetchActivities().then(activities => {
        if (!activities) return;
        computeCoreStats(activities);
        computeHighlights(activities);

        const monthlyMiles = computeMonthlyMileage(activities);
        console.log("MONTHLY MILES:", monthlyMiles)
    });
});
