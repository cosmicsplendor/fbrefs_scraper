// Premier League Goal Scraper - Bar Race Ready (1992-2024)
// This script fetches final standings and outputs ALL data for bar race visualization

async function scrapeFinalStandings() {
  const startYear = 1992;
  const endYear = 2024;
  
  console.log(`Starting scrape for final standings: ${startYear}-${endYear}`);
  
  // Helper function to add random delay
  const randomDelay = () => new Promise(resolve => 
    setTimeout(resolve, Math.random() * 1000 + 500) // 0.5-1.5 seconds
  );
  
  // Season ID mapping
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
        date: seasonYear,
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
          date: seasonYear,
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
  
  // Generate bar race data
  const barRaceData = generateBarRaceData(allSeasonData);
  
  return {
    seasonData: allSeasonData,
    barRaceData: barRaceData
  };
}

function generateBarRaceData(seasonData) {
  console.log('\n--- Generating Bar Race Data with Interpolation ---');
  
  const interpolationSteps = 12; // Number of interpolated frames between seasons
  const topTeamsCount = 11; // Only show top 11 teams per frame
  
  // Track cumulative goals for each team
  const teamCumulativeGoals = new Map();
  const barRaceFrames = [];
  
  for (let i = 0; i < seasonData.length; i++) {
    const season = seasonData[i];
    console.log(`Processing ${season.season}...`);
    
    // Store previous state for interpolation
    const prevState = new Map(teamCumulativeGoals);
    
    // Update cumulative goals for each team in this season
    season.teams.forEach(team => {
      const teamName = team.name;
      const currentCumulative = teamCumulativeGoals.get(teamName) || 0;
      teamCumulativeGoals.set(teamName, currentCumulative + team.goalsFor);
    });
    
    // Create interpolated frames (0 to interpolationSteps-1, not including the final state)
    for (let step = 0; step < interpolationSteps; step++) {
      const progress = step / interpolationSteps;
      const frameDate = season.date + progress;
      
      // Interpolate between previous and current state
      const interpolatedGoals = new Map();
      
      // Get all teams that exist in either state
      const allTeams = new Set([...prevState.keys(), ...teamCumulativeGoals.keys()]);
      
      allTeams.forEach(teamName => {
        const prevGoals = prevState.get(teamName) || 0;
        const currentGoals = teamCumulativeGoals.get(teamName) || 0;
        const interpolatedValue = prevGoals + (currentGoals - prevGoals) * progress;
        interpolatedGoals.set(teamName, interpolatedValue);
      });
      
      // Sort and take top 11
      const sortedTeams = Array.from(interpolatedGoals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topTeamsCount)
        .map(([name, goals]) => ({
          name: name,
          value: Math.round(goals)
        }));
      
      barRaceFrames.push({
        date: frameDate,
        data: sortedTeams
      });
    }
    
    console.log(`  Created ${interpolationSteps} interpolated frames for ${season.season}`);
  }
  
  // Add the final frame at the end (the complete final state)
  const finalSortedTeams = Array.from(teamCumulativeGoals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topTeamsCount)
    .map(([name, goals]) => ({
      name: name,
      value: goals
    }));
  
  barRaceFrames.push({
    date: seasonData[seasonData.length - 1].date + 1,
    data: finalSortedTeams
  });
  
  return barRaceFrames;
}

function logAllData(data) {
  console.log('\n=== LOGGING ALL DATA FOR BAR RACE ===');
  
  console.log(`\nTotal seasons scraped: ${data.seasonData.length}`);
  console.log(`Total interpolated frames: ${data.barRaceData.length}`);
  
  // Show sample frames
  console.log(`\nSample frames:`);
  console.log(`First frame (${data.barRaceData[0].date}): ${data.barRaceData[0].data.length} teams`);
  console.log(`Last frame (${data.barRaceData[data.barRaceData.length - 1].date}): ${data.barRaceData[data.barRaceData.length - 1].data.length} teams`);
  
  // Show final top 11
  const finalFrame = data.barRaceData[data.barRaceData.length - 1];
  console.log(`\nFinal top 11:`);
  finalFrame.data.forEach((team, index) => {
    console.log(`${index + 1}. ${team.name}: ${team.value} goals`);
  });
  
  // LOG COMPLETE BAR RACE JSON
  console.log('\n=== BAR RACE JSON FORMAT ===');
  console.log(JSON.stringify(data.barRaceData));
  
  console.log('\n=== DATA LOGGING COMPLETE ===');
}

// Run the scraper
scrapeFinalStandings()
  .then(data => {
    logAllData(data);
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapeFinalStandings, generateBarRaceData };
}