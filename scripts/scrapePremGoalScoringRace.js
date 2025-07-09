// Simplified Premier League Goal Scraper - Final Standings Only (1992-2024)
// This script fetches ONLY final standings for each season to get accurate total goals

async function scrapeFinalStandings() {
  const startYear = 1992;
  const endYear = 2024;
  
  console.log(`Starting scrape for final standings: ${startYear}-${endYear}`);
  
  // Helper function to add random delay
  const randomDelay = () => new Promise(resolve => 
    setTimeout(resolve, Math.random() * 1000 + 500) // 0.5-1.5 seconds
  );
  
  // Season ID mapping (from your original script)
  const seasonIdMap = {
    1992: 11, 1993: 12, 1994: 13, 1995: 14, 1996: 15, 1997: 16, 1998: 9, 1999: 10,
    2000: 1, 2001: 2, 2002: 3, 2003: 4, 2004: 5, 2005: 6, 2006: 7, 2007: 8,
    2008: 2008, 2009: 2009, 2010: 2010, 2011: 2011, 2012: 2012, 2013: 2013,
    2014: 2014, 2015: 2015, 2016: 2016, 2017: 2017, 2018: 2018, 2019: 2019,
    2020: 2020, 2021: 2021, 2022: 2022, 2023: 2023, 2024: 2024
  };

  const getSeasonId = (seasonYear) => {
    return seasonIdMap[seasonYear] || seasonYear;
  };

  const allSeasonData = [];
  
  for (let seasonYear = startYear; seasonYear <= endYear; seasonYear++) {
    console.log(`\n--- Fetching final standings for ${seasonYear}/${seasonYear + 1} ---`);
    
    const seasonId = getSeasonId(seasonYear);
    
    try {
      const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/${seasonId}/standings?live=false`;
      console.log(`Fetching: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.tables || !data.tables[0] || !data.tables[0].entries) {
        throw new Error('Invalid data structure received');
      }
      
      const seasonFinalData = {
        season: `${seasonYear}/${seasonYear + 1}`,
        seasonYear: seasonYear,
        teams: []
      };
      
      data.tables[0].entries.forEach(entry => {
        seasonFinalData.teams.push({
          name: entry.team.shortName,
          fullName: entry.team.name,
          position: entry.position,
          played: entry.overall.played,
          won: entry.overall.won,
          drawn: entry.overall.drawn,
          lost: entry.overall.lost,
          goalsFor: entry.overall.goalsFor,
          goalsAgainst: entry.overall.goalsAgainst,
          goalDifference: entry.overall.goalDifference,
          points: entry.overall.points
        });
      });
      
      allSeasonData.push(seasonFinalData);
      
      console.log(`✓ Successfully processed ${seasonYear}/${seasonYear + 1}`);
      console.log(`  Teams: ${seasonFinalData.teams.length}`);
      console.log(`  Sample: ${seasonFinalData.teams[0].name} (${seasonFinalData.teams[0].goalsFor} goals)`);
      
      await randomDelay();
      
    } catch (error) {
      console.error(`Error fetching ${seasonYear}/${seasonYear + 1}:`, error.message);
      
      // Retry once
      try {
        console.log(`Retrying ${seasonYear}/${seasonYear + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/${seasonId}/standings?live=false`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error on retry! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.tables || !data.tables[0] || !data.tables[0].entries) {
          throw new Error('Invalid data structure received on retry');
        }
        
        const seasonFinalData = {
          season: `${seasonYear}/${seasonYear + 1}`,
          seasonYear: seasonYear,
          teams: []
        };
        
        data.tables[0].entries.forEach(entry => {
          seasonFinalData.teams.push({
            name: entry.team.shortName,
            fullName: entry.team.name,
            position: entry.position,
            played: entry.overall.played,
            won: entry.overall.won,
            drawn: entry.overall.drawn,
            lost: entry.overall.lost,
            goalsFor: entry.overall.goalsFor,
            goalsAgainst: entry.overall.goalsAgainst,
            goalDifference: entry.overall.goalDifference,
            points: entry.overall.points
          });
        });
        
        allSeasonData.push(seasonFinalData);
        console.log(`✓ Retry successful for ${seasonYear}/${seasonYear + 1}`);
        
      } catch (retryError) {
        console.error(`Retry failed for ${seasonYear}/${seasonYear + 1}:`, retryError.message);
        console.log(`Skipping ${seasonYear}/${seasonYear + 1}...`);
      }
      
      await randomDelay();
    }
  }
  
  console.log('\n=== SCRAPING COMPLETE ===');
  console.log(`Successfully scraped ${allSeasonData.length} seasons`);
  
  // Calculate all-time totals
  const allTimeGoals = calculateAllTimeTotals(allSeasonData);
  
  return {
    seasonData: allSeasonData,
    allTimeTotals: allTimeGoals
  };
}

function calculateAllTimeTotals(seasonData) {
  console.log('\n--- Calculating All-Time Goal Totals ---');
  
  const allTimeGoals = new Map();
  const teamSeasonCount = new Map();
  
  seasonData.forEach(season => {
    console.log(`Processing ${season.season}...`);
    
    season.teams.forEach(team => {
      const teamName = team.name;
      const currentTotal = allTimeGoals.get(teamName) || 0;
      const currentSeasonCount = teamSeasonCount.get(teamName) || 0;
      
      allTimeGoals.set(teamName, currentTotal + team.goalsFor);
      teamSeasonCount.set(teamName, currentSeasonCount + 1);
    });
  });
  
  // Sort by total goals
  const sortedTeams = Array.from(allTimeGoals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, goals]) => ({
      name,
      totalGoals: goals,
      seasons: teamSeasonCount.get(name)
    }));
  
  console.log('\n=== ALL-TIME GOAL TOTALS ===');
  sortedTeams.forEach((team, index) => {
    console.log(`${index + 1}. ${team.name}: ${team.totalGoals} goals (${team.seasons} seasons)`);
  });
  
  return sortedTeams;
}

function analyzeData(data) {
  console.log('\n=== DATA ANALYSIS ===');
  
  // Show sample season data
  console.log('\nSample Season Data (first 3 seasons):');
  data.seasonData.slice(0, 3).forEach(season => {
    console.log(`\n${season.season}:`);
    season.teams.slice(0, 5).forEach(team => {
      console.log(`  ${team.position}. ${team.name}: ${team.goalsFor} goals`);
    });
  });
  
  // Show all unique teams
  const allTeams = new Set();
  data.seasonData.forEach(season => {
    season.teams.forEach(team => {
      allTeams.add(team.name);
    });
  });
  
  console.log(`\nTotal unique teams across all seasons: ${allTeams.size}`);
  console.log('All teams:', Array.from(allTeams).sort());
  
  // Show top 10 all-time
  console.log('\nTop 10 All-Time Goal Scorers:');
  data.allTimeTotals.slice(0, 10).forEach((team, index) => {
    console.log(`${index + 1}. ${team.name}: ${team.totalGoals} goals (${team.seasons} seasons)`);
  });
  
  // Full data output
  console.log('\n=== COMPLETE SEASON DATA ===');
  console.log(JSON.stringify(data.seasonData, null, 2));
  
  console.log('\n=== COMPLETE ALL-TIME TOTALS ===');
  console.log(JSON.stringify(data.allTimeTotals, null, 2));
}

// Run the scraper
scrapeFinalStandings()
  .then(data => {
    analyzeData(data);
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapeFinalStandings, calculateAllTimeTotals };
}