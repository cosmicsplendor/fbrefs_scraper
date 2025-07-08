// Premier League Goal Scraper (1992-2024) with Bar Racing Data Format
// This script fetches goal data for all seasons and formats it for bar racing visualization

async function scrapeGoalData() {
  const startYear = 1992;
  const endYear = 2024;
  const totalSeasons = endYear - startYear + 1;
  const totalRequests = totalSeasons * 38; 
  
  console.log(`Starting scrape for ${totalSeasons} seasons (${totalRequests} total requests estimated)`);
  console.log(`Estimated time with 1-2 second delays: ${Math.round(totalRequests * 1.5 / 60)} minutes`);
  
  const allSeasonData = []; // Will store { displayYear: ..., actualSeasonYear: ..., matchday: ..., data: [...] }
  
  // Helper function to add random delay (1-2 seconds)
  const randomDelay = () => new Promise(resolve => 
    setTimeout(resolve, 1000 + Math.random() * 1000) 
  );
  
  // Helper function to determine season display format (for bar racing axis label)
  const getDisplayYear = (seasonStartYear, matchday) => {
    // Split season roughly in half - first 19 matchdays = start year, last 19 = end year
    return matchday <= 19 ? seasonStartYear : seasonStartYear + 1;
  };

  // --- Season ID mapping (UPDATED with your findings) ---
  const seasonIdMap = {
    1992: 11, // 1992/93
    1993: 12, // 1993/94
    1994: 13, // 1994/95
    1995: 14, // 1995/96
    1996: 15, // 1996/97
    1997: 16, // 1997/98
    1998: 9,  // 1998/99
    1999: 10, // 1999/00
    2000: 1,  // 2000/01
    2001: 2,  // 2001/02
    2002: 3,  // 2002/03
    2003: 4,  // 2003/04
    2004: 5,  // 2004/05
    2005: 6,  // 2005/06
    2006: 7,  // 2006/07
    2007: 8   // 2007/08
  };

  const getSeasonId = (seasonYear) => {
    // For seasons 2008/09 (startYear 2008) onwards, the ID is simply the year itself.
    if (seasonYear >= 2008) {
      return seasonYear;
    }
    // For earlier seasons, use the lookup table.
    if (seasonIdMap[seasonYear]) {
      return seasonIdMap[seasonYear];
    }
    console.warn(`No season ID found for year ${seasonYear}. This season might be skipped.`);
    return null;
  };
  // --- END Season ID mapping ---
  
  // Process each season
  for (let seasonYear = startYear; seasonYear <= endYear; seasonYear++) {
    console.log(`\n--- Processing ${seasonYear}/${seasonYear + 1} season ---`);
    
    const seasonId = getSeasonId(seasonYear);
    if (seasonId === null) {
        console.error(`Skipping season ${seasonYear}/${seasonYear + 1} due to missing season ID.`);
        continue;
    }
    
    console.log(`Using seasonId: ${seasonId} for ${seasonYear}/${seasonYear + 1}`);
    
    // We can directly push to allSeasonData here, no need for an intermediate seasonData array
    
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
            continue; // Skip this matchday
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
        
        if (seasonYear < 1995 && matchday <= 3) {
          console.log(`${seasonYear}/${seasonYear + 1} MD${matchday} teams:`, teamGoals.map(t => t.name).join(', '));
        }
        
        // --- MATCHDAY INJECTION HERE ---
        allSeasonData.push({
          displayYear: getDisplayYear(seasonYear, matchday), // For the racing chart label (e.g., 1992 or 1993)
          actualSeasonYear: seasonYear, // The start year of the season (e.g., 1992)
          matchday: matchday, // The matchday number (1 to 38)
          data: teamGoals // Store all teams' data for this snapshot
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
          if (!response.ok) {
              throw new Error(`HTTP error on retry! status: ${response.status}`);
          }
          const data = await response.json();
          
          if (!data.tables || !data.tables[0] || !data.tables[0].entries) {
              throw new Error('Invalid data structure received on retry');
          }

          const teamGoals = data.tables[0].entries.map(entry => ({
            name: entry.team.shortName,
            goals: entry.overall.goalsFor
          }));
          
          // --- MATCHDAY INJECTION ON RETRY AS WELL ---
          allSeasonData.push({
            displayYear: getDisplayYear(seasonYear, matchday),
            actualSeasonYear: seasonYear,
            matchday: matchday,
            data: teamGoals
          });
          
          console.log(`✓ Retry successful for MD${matchday}`);
        } catch (retryError) {
          console.error(`Retry failed for ${seasonYear}/${seasonYear + 1} MD${matchday}:`, retryError.message);
        }
        
        await randomDelay();
      }
    }
    console.log(`Completed ${seasonYear}/${seasonYear + 1} season - ${allSeasonData.filter(d => d.actualSeasonYear === seasonYear).length} matchdays processed for this season`);
  }
  
  console.log('\n=== SCRAPING COMPLETE ===');
  console.log(`Total raw data points collected: ${allSeasonData.length}`);
  console.log(`Expected max possible points: ${totalRequests}`); 
  
  const cumulativeData = createCumulativeData(allSeasonData);
  
  return cumulativeData;
}

function createCumulativeData(allData) {
  console.log('\n--- Creating ALL-TIME cumulative bar racing data ---');
  
  const allTimeGoals = new Map();         // Key: Team Name, Value: All-time cumulative goals
  const seasonProgressGoals = new Map();  // Key: Team Name, Value: Goals for current season up to last matchday
  const cumulativeResults = [];
  let uniqueTeamsCount = 0;
  
  // --- Crucial: Sort allData chronologically using the new properties ---
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
    // --- USING INJECTED MATCHDAY FOR GRANULAR LABEL ---
    const displayLabel = `${entry.displayYear}/${entry.displayYear + 1} MD ${currentMatchday}`; 

    // If a new season starts, clear the `seasonProgressGoals` map.
    // This is crucial because `goalsFor` from the API resets to 0 for each new season.
    if (currentActualSeasonYear !== lastProcessedActualSeasonYear) {
        seasonProgressGoals.clear();
        lastProcessedActualSeasonYear = currentActualSeasonYear;
    }

    entry.data.forEach(team => {
        const teamName = team.name;
        const currentSeasonGoalsForTeam = team.goals; // Total goals for *this season* up to *this matchday*

        // Get the goals for this team from the *previous matchday in this season*.
        // If the team is new to this matchday or new season, prevSeasonGoalsForTeam will be 0.
        const prevSeasonGoalsForTeam = seasonProgressGoals.get(teamName) || 0;

        // Calculate goals scored *in this specific matchday* (or since last update).
        // This difference should represent only the new goals added by this team *since the last time we updated them for THIS season*.
        const goalsScoredInThisInterval = currentSeasonGoalsForTeam - prevSeasonGoalsForTeam;

        // Update all-time goals for the team.
        const currentAllTime = allTimeGoals.get(teamName) || 0;
        allTimeGoals.set(teamName, currentAllTime + goalsScoredInThisInterval);

        // Update season progress map for the next iteration (within the same season).
        seasonProgressGoals.set(teamName, currentSeasonGoalsForTeam);

        // Track unique teams appearing in the dataset
        if (currentAllTime === 0 && goalsScoredInThisInterval > 0) {
            uniqueTeamsCount++;
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
      console.log(`Processed ${entryIndex + 1}/${allData.length} entries - ${uniqueTeamsCount} unique teams tracked`);
    }
  });
  
  console.log('✓ Cumulative data creation complete');
  console.log(`Final data contains ${cumulativeResults.length} time points`);
  console.log(`Total unique teams ever tracked: ${uniqueTeamsCount}`);
  
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
  
  // Full data output
  // console.log('\n=== COMPLETE DATA OUTPUT ===');
  // console.log(JSON.stringify(data, null, 2)); // Uncomment if you want to see the full JSON
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