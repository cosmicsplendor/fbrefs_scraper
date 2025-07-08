// Premier League Goal Scraper (1992-2024) with Bar Racing Data Format
// This script fetches goal data for all seasons and formats it for bar racing visualization

async function scrapeGoalData() {
  const startYear = 1992;
  const endYear = 2024;
  const totalSeasons = endYear - startYear + 1;
  const totalRequests = totalSeasons * 38;
  
  console.log(`Starting scrape for ${totalSeasons} seasons (${totalRequests} total requests)`);
  console.log(`Estimated time with 1-2 second delays: ${Math.round(totalRequests * 1.5 / 60)} minutes`);
  
  const allSeasonData = [];
  
  // Helper function to add random delay
  const randomDelay = () => new Promise(resolve => 
    setTimeout(resolve, Math.random() * 1000) // 1-2 seconds
  );
  
  // Helper function to determine season display format
  const getSeasonYear = (seasonStartYear, matchday) => {
    // Split season roughly in half - first 19 matchdays = start year, last 19 = end year
    return matchday <= 19 ? seasonStartYear : seasonStartYear + 1;
  };
  
  // Process each season
  for (let seasonYear = startYear; seasonYear <= endYear; seasonYear++) {
    console.log(`\n--- Processing ${seasonYear}/${seasonYear + 1} season ---`);
    
    const season = seasonYear;
    const compSeasonId = season - 2015 + 42; // API formula for season ID
    
    console.log(`Using compSeasonId: ${compSeasonId} for ${seasonYear}/${seasonYear + 1}`);
    
    const seasonData = [];
    
    // Process each matchday for the season
    for (let matchday = 1; matchday <= 38; matchday++) {
      try {
        const url = `https://footballapi.pulselive.com/football/standings?compSeasons=${compSeasonId}&altIds=true&detail=2&FOOTBALL_COMPETITION=1&gameweekNumbers=1-${matchday}`;
        
        console.log(`Fetching ${seasonYear}/${seasonYear + 1} - MD${matchday}...`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate data quality
        if (!data.tables || !data.tables[0] || !data.tables[0].entries) {
          throw new Error('Invalid data structure received');
        }
        
        const teamCount = data.tables[0].entries.length;
        const expectedTeams = seasonYear <= 1994 ? 22 : 20; // 22 teams until 1994-95
        
        if (teamCount !== expectedTeams) {
          console.warn(`⚠️ Expected ${expectedTeams} teams for ${seasonYear}/${seasonYear + 1}, but got ${teamCount}`);
        }
        
        // Extract team goal data (keep ALL teams, not just top 12)
        const teamGoals = data.tables[0].entries.map(entry => ({
          name: entry.team.shortName,
          goals: entry.overall.goalsFor
        }));
        
        // Debug: show team names for first few matchdays of early seasons
        if (seasonYear <= 1994 && matchday <= 3) {
          console.log(`${seasonYear}/${seasonYear + 1} MD${matchday} teams:`, teamGoals.map(t => t.name).join(', '));
        }
        
        seasonData.push({
          date: getSeasonYear(seasonYear, matchday),
          data: teamGoals // Store all teams
        });
        
        console.log(`✓ Processed MD${matchday} - ${teamGoals.length} teams tracked`);
        
        // Add delay between requests
        await randomDelay();
        
      } catch (error) {
        console.error(`Error fetching ${seasonYear}/${seasonYear + 1} MD${matchday}:`, error.message);
        
        // Add longer delay on error before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Retry once
        try {
          console.log(`Retrying ${seasonYear}/${seasonYear + 1} MD${matchday}...`);
          const url = `https://footballapi.pulselive.com/football/standings?compSeasons=${compSeasonId}&altIds=true&detail=2&FOOTBALL_COMPETITION=1&gameweekNumbers=1-${matchday}`;
          const response = await fetch(url);
          const data = await response.json();
          
          const teamGoals = data.tables[0].entries.map(entry => ({
            name: entry.team.shortName,
            goals: entry.overall.goalsFor
          }));
          
          seasonData.push({
            date: getSeasonYear(seasonYear, matchday),
            data: teamGoals // Store all teams
          });
          
          console.log(`✓ Retry successful for MD${matchday}`);
        } catch (retryError) {
          console.error(`Retry failed for ${seasonYear}/${seasonYear + 1} MD${matchday}:`, retryError.message);
          // Skip this matchday and continue
        }
        
        await randomDelay();
      }
    }
    
    allSeasonData.push(...seasonData);
    console.log(`Completed ${seasonYear}/${seasonYear + 1} season - ${seasonData.length} matchdays processed`);
  }
  
  console.log('\n=== SCRAPING COMPLETE ===');
  console.log(`Total data points collected: ${allSeasonData.length}`);
  console.log(`Expected: ${totalRequests}`);
  
  // Create cumulative data for bar racing
  const cumulativeData = createCumulativeData(allSeasonData);
  
  return cumulativeData;
}

function createCumulativeData(allData) {
  console.log('\n--- Creating cumulative bar racing data ---');
  
  const teamTotals = new Map();
  const cumulativeResults = [];
  let uniqueTeamsCount = 0;
  
  allData.forEach((entry, index) => {
    // Track new teams as they appear
    let newTeamsThisEntry = 0;
    
    // Add current matchday goals to cumulative totals for ALL teams
    entry.data.forEach(team => {
      if (!teamTotals.has(team.name)) {
        // This is a new team we've never seen before
        teamTotals.set(team.name, 0);
        newTeamsThisEntry++;
        uniqueTeamsCount++;
      }
      
      const currentTotal = teamTotals.get(team.name);
      teamTotals.set(team.name, currentTotal + team.goals);
    });
    
    // Log when new teams appear
    if (newTeamsThisEntry > 0) {
      console.log(`📈 ${newTeamsThisEntry} new team(s) appeared - Total unique teams: ${uniqueTeamsCount}`);
    }
    
    // NOW sort and slice to get top 12 teams by cumulative goals
    const sortedTeams = Array.from(teamTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, value]) => ({ name, value }));
    
    cumulativeResults.push({
      date: entry.date,
      data: sortedTeams
    });
    
    // Log progress every 100 entries
    if ((index + 1) % 100 === 0) {
      console.log(`Processed ${index + 1}/${allData.length} entries - ${uniqueTeamsCount} unique teams tracked`);
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
  console.log('\n=== COMPLETE DATA OUTPUT ===');
  console.log(JSON.stringify(data, null, 2));
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