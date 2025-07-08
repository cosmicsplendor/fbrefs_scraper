// Premier League Goal Scraper (1992-2024) with Bar Racing Data Format
// This script fetches goal data for all seasons and formats it for bar racing visualization

async function scrapeGoalData() {
  const startYear = 1992;
  const endYear = 2024;
  const TRANSITION_YEAR = 2016; // Seasons >= this year use /matchweeks endpoint (e.g., 2016/17 season)
  const INTERPOLATION_STEPS = 24; // User requested 24 artificial matchdays for interpolated seasons
  
  console.log(`Starting scrape for ${endYear - startYear + 1} seasons.`);
  console.log(`Live matchday data from ${TRANSITION_YEAR}/${TRANSITION_YEAR + 1} onwards.`);
  console.log(`Interpolating ${INTERPOLATION_STEPS} points for seasons prior to ${TRANSITION_YEAR}.`);
  
  const allProcessedDataPoints = []; // This will store all final snapshots (real and interpolated) for createCumulativeData
  
  // Helper function to add random delay (1-2 seconds)
  const randomDelay = () => new Promise(resolve => 
    setTimeout(resolve, 1000 + Math.random() * 1000) 
  );
  
  // Helper function to determine season display format (for bar racing axis label)
  // This is used to get the "half" year for display (e.g., 1992 or 1993 for 1992/93 season)
  const getDisplayYear = (seasonStartYear, matchday) => {
    // For real matchdays, split season roughly in half. For interpolated, just use start year.
    return matchday <= 19 || matchday <= Math.ceil(INTERPOLATION_STEPS / 2) ? seasonStartYear : seasonStartYear + 1;
  };

  // --- Season ID mapping (Consolidated and adjusted based on your findings) ---
  const seasonIdMap = {
    1992: 11, 1993: 12, 1994: 13, 1995: 14, 1996: 15, 1997: 16, 1998: 9, 1999: 10,
    2000: 1, 2001: 2, 2002: 3, 2003: 4, 2004: 5, 2005: 6, 2006: 7, 2007: 8,
    2008: 2008, 2009: 2009, 2010: 2010, 2011: 2011, 2012: 2012, 2013: 2013,
    2014: 2014, 2015: 2015 // Explicitly include 2015 as it needs final standings
  };

  const getSeasonId = (seasonYear) => {
    if (seasonIdMap[seasonYear]) {
      return seasonIdMap[seasonYear];
    }
    // For years beyond those in the map, assume the year itself is the ID (e.g., 2016, 2017...)
    if (seasonYear > 2015) { // Updated logic based on map going up to 2015
        return seasonYear;
    }
    console.warn(`No season ID found for year ${seasonYear}. This season might be skipped.`);
    return null;
  };
  // --- END Season ID mapping ---

  // --- Phase 1: Fetch Final Goals for Older Seasons (1992 to TRANSITION_YEAR - 1) ---
  const historicalFinalGoals = new Map(); // Map: seasonYear -> Map<teamName, totalGoalsForThatSeason>

  for (let seasonYear = startYear; seasonYear < TRANSITION_YEAR; seasonYear++) {
    console.log(`\n--- Fetching FINAL standings for OLD season: ${seasonYear}/${seasonYear + 1} ---`);
    const seasonId = getSeasonId(seasonYear);
    if (seasonId === null) {
      continue;
    }

    try {
      const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/${seasonId}/standings?live=false`;
      console.log(`Fetching final standings for ${seasonYear}/${seasonYear + 1}...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!data.tables || !data.tables[0] || !data.tables[0].entries) {
        throw new Error('Invalid data structure received for final standings');
      }

      const finalGoalsMap = new Map();
      data.tables[0].entries.forEach(entry => {
        finalGoalsMap.set(entry.team.shortName, entry.overall.goalsFor); // goalsFor is season total
      });
      historicalFinalGoals.set(seasonYear, finalGoalsMap);
      console.log(`✓ Processed final standings for ${seasonYear}/${seasonYear + 1}. ${finalGoalsMap.size} teams.`);
      await randomDelay();

    } catch (error) {
      console.error(`Error fetching final standings for ${seasonYear}/${seasonYear + 1}:`, error.message);
      // Retry once on error
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        console.log(`Retrying final standings for ${seasonYear}/${seasonYear + 1}...`);
        const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/${seasonId}/standings?live=false`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error on retry! status: ${response.status}`);
        const data = await response.json();
        if (!data.tables || !data.tables[0] || !data.tables[0].entries) throw new Error('Invalid data structure received on retry');
        const finalGoalsMap = new Map();
        data.tables[0].entries.forEach(entry => {
          finalGoalsMap.set(entry.team.shortName, entry.overall.goalsFor);
        });
        historicalFinalGoals.set(seasonYear, finalGoalsMap);
        console.log(`✓ Retry successful for final standings ${seasonYear}/${seasonYear + 1}.`);
      } catch(retryError) {
        console.error(`Retry failed for final standings ${seasonYear}/${seasonYear + 1}:`, retryError.message);
      }
      await randomDelay();
    }
  }

  // --- Phase 2: Generate Interpolated Data for Older Seasons ---
  console.log('\n--- Generating INTERPOLATED data points for old seasons ---');
  for (let seasonYear = startYear; seasonYear < TRANSITION_YEAR; seasonYear++) {
    if (historicalFinalGoals.has(seasonYear)) {
      const finalGoalsMap = historicalFinalGoals.get(seasonYear);
      const allTeamsInSeason = new Set(finalGoalsMap.keys()); // Teams active in this season

      for (let i = 1; i <= INTERPOLATION_STEPS; i++) {
        const stepFactor = i / INTERPOLATION_STEPS;
        const interpolatedGoals = [];
        
        allTeamsInSeason.forEach(teamName => {
          const teamFinalGoals = finalGoalsMap.get(teamName) || 0;
          const currentInterpolated = Math.round(teamFinalGoals * stepFactor);
          interpolatedGoals.push({ name: teamName, goals: currentInterpolated });
        });

        allProcessedDataPoints.push({
          displayYear: getDisplayYear(seasonYear, Math.ceil(i * 38 / INTERPOLATION_STEPS)), // Use artificial MD mapping for display year
          actualSeasonYear: seasonYear,
          matchday: i, // Artificial matchday (1 to INTERPOLATION_STEPS)
          isInterpolated: true, // Flag this as interpolated data
          data: interpolatedGoals
        });
      }
      console.log(`Generated ${INTERPOLATION_STEPS} interpolated points for ${seasonYear}/${seasonYear + 1}.`);
    } else {
      console.warn(`Skipping interpolation for ${seasonYear}/${seasonYear + 1} as final data was not retrieved.`);
    }
  }


  // --- Phase 3: Scrape Real Matchday Data for Newer Seasons (TRANSITION_YEAR to endYear) ---
  for (let seasonYear = TRANSITION_YEAR; seasonYear <= endYear; seasonYear++) {
    console.log(`\n--- Fetching REAL matchday data for NEW season: ${seasonYear}/${seasonYear + 1} ---`);
    
    const seasonId = getSeasonId(seasonYear); 
    if (seasonId === null) {
        console.error(`Skipping season ${seasonYear}/${seasonYear + 1} due to missing season ID.`);
        continue;
    }
    
    console.log(`Using seasonId: ${seasonId} for ${seasonYear}/${seasonYear + 1}`);
    
    for (let matchday = 1; matchday <= 38; matchday++) {
      try {
        const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/${seasonId}/matchweeks/${matchday}/standings?live=false`;
        
        console.log(`Fetching ${seasonYear}/${seasonYear + 1} - MD${matchday}...`);
        
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`Data not found for ${seasonYear}/${seasonYear + 1} MD${matchday}. This might be a future matchday or a data gap.`);
            if (seasonYear === endYear) { 
              console.log(`Assuming end of available data for ${seasonYear}/${seasonYear + 1}.`);
              break; 
            }
            await randomDelay(); 
            continue; 
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.tables || !data.tables[0] || !data.tables[0].entries) {
          if (matchday === 1 && seasonYear === endYear) { 
             console.warn(`No entries for ${seasonYear}/${seasonYear + 1} MD${matchday}. Assuming season not started or data not available yet.`);
             break; 
          }
          throw new Error('Invalid data structure received or no entries for this matchday.');
        }
        
        const teamGoals = data.tables[0].entries.map(entry => ({
          name: entry.team.shortName,
          goals: entry.overall.goalsFor // This is cumulative goals for *this season* up to *this matchday*
        }));
        
        allProcessedDataPoints.push({
          displayYear: getDisplayYear(seasonYear, matchday),
          actualSeasonYear: seasonYear,
          matchday: matchday,
          isInterpolated: false, // Flag to indicate real data
          data: teamGoals
        });
        
        console.log(`✓ Processed MD${matchday} - ${teamGoals.length} teams tracked`);
        
        await randomDelay();
        
      } catch (error) {
        console.error(`Error fetching ${seasonYear}/${seasonYear + 1} MD${matchday}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          console.log(`Retrying ${seasonYear}/${seasonYear + 1} MD${matchday}...`);
          const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/${seasonId}/matchweeks/${matchday}/standings?live=false`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error on retry! status: ${response.status}`);
          const data = await response.json();
          if (!data.tables || !data.tables[0] || !data.tables[0].entries) throw new Error('Invalid data structure received on retry');

          const teamGoals = data.tables[0].entries.map(entry => ({
            name: entry.team.shortName,
            goals: entry.overall.goalsFor
          }));
          
          allProcessedDataPoints.push({
            displayYear: getDisplayYear(seasonYear, matchday),
            actualSeasonYear: seasonYear,
            matchday: matchday,
            isInterpolated: false,
            data: teamGoals
          });
          console.log(`✓ Retry successful for MD${matchday}`);
        } catch (retryError) {
          console.error(`Retry failed for ${seasonYear}/${seasonYear + 1} MD${matchday}:`, retryError.message);
        }
        await randomDelay();
      }
    }
    console.log(`Completed ${seasonYear}/${seasonYear + 1} season.`);
  }
  
  console.log('\n=== SCRAPING COMPLETE ===');
  console.log(`Total raw data points collected: ${allProcessedDataPoints.length}`);
  
  // The createCumulativeData function processes the mixed (real + interpolated) data
  const cumulativeData = createCumulativeData(allProcessedDataPoints);
  
  return cumulativeData;
}

function createCumulativeData(allData) {
  console.log('\n--- Creating ALL-TIME cumulative bar racing data ---');
  
  const allTimeGoals = new Map();         // Key: Team Name, Value: All-time cumulative goals
  const seasonProgressGoals = new Map();  // Key: Team Name, Value: Goals for current season up to last matchday
                                          // This map effectively resets for new seasons.
  const cumulativeResults = [];
  let uniqueTeamsCount = 0;
  
  // Crucial: Sort allData chronologically using the new properties for proper accumulation
  allData.sort((a, b) => {
      if (a.actualSeasonYear !== b.actualSeasonYear) {
          return a.actualSeasonYear - b.actualSeasonYear;
      }
      return a.matchday - b.matchday;
  });

  let lastProcessedActualSeasonYear = null;

  allData.forEach((entry, entryIndex) => {
    const currentActualSeasonYear = entry.actualSeasonYear;
    const currentMatchday = entry.matchday;
    
    // Construct the display label, differentiating interpolated points
    const displayLabel = entry.isInterpolated 
                         ? `${entry.displayYear}/${entry.displayYear + 1} (Interp. ${currentMatchday}/${INTERPOLATION_STEPS})`
                         : `${entry.displayYear}/${entry.displayYear + 1} MD ${currentMatchday}`; 

    // If a new season starts, clear the `seasonProgressGoals` map.
    // This is crucial because `goalsFor` from the API (and our interpolation logic)
    // resets to 0 for each new season's cumulative tally.
    if (currentActualSeasonYear !== lastProcessedActualSeasonYear) {
        seasonProgressGoals.clear();
        lastProcessedActualSeasonYear = currentActualSeasonYear;
    }

    // Process each team's goals for the current snapshot (real or interpolated)
    entry.data.forEach(team => {
        const teamName = team.name;
        const currentSeasonGoalsForTeam = team.goals; // Total goals for *this season* up to *this snapshot*

        // Get the goals for this team from the *previous snapshot in this season*.
        // If the team is new to this snapshot or new season, prevSeasonGoalsForTeam will be 0.
        const prevSeasonGoalsForTeam = seasonProgressGoals.get(teamName) || 0;

        // Calculate goals scored *in this specific interval/step*.
        // This difference should represent only the new goals added by this team
        // since the last time we updated them for THIS season.
        const goalsScoredInThisInterval = currentSeasonGoalsForTeam - prevSeasonGoalsForTeam;

        // Update all-time goals for the team.
        const currentAllTime = allTimeGoals.get(teamName) || 0;
        allTimeGoals.set(teamName, currentAllTime + goalsScoredInThisInterval);

        // Update season progress map for the next iteration (within the same season).
        seasonProgressGoals.set(teamName, currentSeasonGoalsForTeam);

        // Track unique teams appearing in the dataset
        if (!allTimeGoals.has(teamName) || (currentAllTime === 0 && goalsScoredInThisInterval > 0)) {
             // Only count as unique if it's truly a new team, or it's its first goal.
             // This logic needs to be careful not to overcount on interpolation where team "goals" go from 0 to something.
             // A team is unique if it's the first time we ever see it.
             if (!allTimeGoals.has(teamName)) { // If team not in allTimeGoals, it's new
                 uniqueTeamsCount++;
             }
        }
    });

    // Create the bar racing frame based on the current all-time totals.
    const sortedTeams = Array.from(allTimeGoals.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by all-time goals (descending)
        .slice(0, 12) // Get top 12 teams
        .map(([name, value]) => ({ name, value }));
    
    cumulativeResults.push({
        date: displayLabel, // Use the more specific label for the time point
        data: sortedTeams
    });
    
    if ((entryIndex + 1) % 100 === 0) {
      console.log(`Processed ${entryIndex + 1}/${allData.length} entries.`);
    }
  });
  
  console.log('✓ Cumulative data creation complete');
  console.log(`Final data contains ${cumulativeResults.length} time points`);
  console.log(`Total unique teams ever tracked: ${Array.from(allTimeGoals.keys()).length}`); // More accurate unique team count
  
  return cumulativeResults;
}

// Enhanced logging function
function logFinalData(data) {
  console.log('\n=== FINAL BAR RACING DATA ===');
  console.log(`Total time points: ${data.length}`);
  
  // Show first few entries
  console.log('\nFirst 3 entries:');
  data.slice(0, 3).forEach(entry => {
    console.log(`${entry.date}:`, entry.data.slice(0, 3).map(d => `${d.name}: ${d.value}`).join(', '));
  });
  
  // Show last few entries
  console.log('\nLast 3 entries:');
  data.slice(-3).forEach(entry => {
    console.log(`${entry.date}:`, entry.data.slice(0, 3).map(d => `${d.name}: ${d.value}`).join(', '));
  });
  
  // Show all unique teams
  const allTeams = new Set();
  data.forEach(entry => {
    entry.data.forEach(team => allTeams.add(team.name));
  });
  console.log(`\nUnique teams (${allTeams.size}):`, Array.from(allTeams).sort().join(', '));
  
  // Full data output (uncomment if you want to see the full JSON)
  // console.log('\n=== COMPLETE DATA OUTPUT ===');
  // console.log(JSON.stringify(data, null, 2)); 
}

// Run the scraper
scrapeGoalData()
  .then(data => {
    logFinalData(data);
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapeGoalData, createCumulativeData };
}