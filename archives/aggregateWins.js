const fs = require('fs');
const readline = require('readline');

async function countWins() {
  const inputFile = 'Matches.csv';
  
  // Teams to track
  const trackedTeams = ['Man United', 'Valencia', 'Lazio', 'Barcelona', 'Real Madrid', 'Arsenal', 'Bayern Munich', 'Juventus', 'Zaragoza', 'La Coruna', 'Milan', 'Mallorca', 'Roma', 'Leeds', 'Liverpool', 'Celta', 'Leverkusen', 'Dortmund', 'Inter', 'Sociedad', 'Chelsea', 'Monaco', 'Lyon', 'Villarreal', 'Sevilla', 'Ath Madrid', 'Everton', 'Bordeaux', 'Marseille', 'Werder Bremen', 'Tottenham', 'Man City', 'Schalke 04', 'Paris SG', 'Wolfsburg', 'Napoli', 'Ath Bilbao', 'RB Leipzig', 'Newcastle', 'Aston Villa', 'Atalanta'];
  
  const TOP_N = 12; // Only keep top 12 teams in final output
  
  const teamWins = new Map();
  const teamMatches = new Map();
  const monthlyWins = new Map();
  
  // Initialize
  trackedTeams.forEach(team => {
    teamWins.set(team, 0);
    teamMatches.set(team, 0);
  });
  
  try {
    const fileStream = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let lineCount = 0;
    let headerSkipped = false;
    
    for await (const line of rl) {
      if (!headerSkipped) {
        headerSkipped = true;
        continue;
      }
      
      lineCount++;
      const cols = line.split(',');
      
      if (cols.length < 14) continue;
      
      const date = cols[1];
      const homeTeam = cols[3];
      const awayTeam = cols[4];
      const result = cols[13]; // FTResult
      
      if (!date || !result || !['H', 'A', 'D'].includes(result)) continue;
      
      // Check home team
      if (trackedTeams.includes(homeTeam)) {
        teamMatches.set(homeTeam, teamMatches.get(homeTeam) + 1);
        
        if (result === 'H') {
          teamWins.set(homeTeam, teamWins.get(homeTeam) + 1);
          
          // Monthly tracking
          const month = date.substring(0, 7); // YYYY-MM
          if (!monthlyWins.has(month)) monthlyWins.set(month, new Map());
          const monthData = monthlyWins.get(month);
          monthData.set(homeTeam, (monthData.get(homeTeam) || 0) + 1);
        }
      }
      
      // Check away team
      if (trackedTeams.includes(awayTeam)) {
        teamMatches.set(awayTeam, teamMatches.get(awayTeam) + 1);
        
        if (result === 'A') {
          teamWins.set(awayTeam, teamWins.get(awayTeam) + 1);
          
          // Monthly tracking
          const month = date.substring(0, 7); // YYYY-MM
          if (!monthlyWins.has(month)) monthlyWins.set(month, new Map());
          const monthData = monthlyWins.get(month);
          monthData.set(awayTeam, (monthData.get(awayTeam) || 0) + 1);
        }
      }
      
      if (lineCount % 100000 === 0) {
        console.log(`Processed ${lineCount} lines...`);
      }
    }
    
    console.log(`\nProcessed ${lineCount} lines total`);
    
    // Show results
    console.log('\n=== TEAM STATISTICS ===');
    trackedTeams.forEach(team => {
      const matches = teamMatches.get(team);
      const wins = teamWins.get(team);
      const winRate = matches > 0 ? (wins / matches * 100).toFixed(1) : 0;
      
      console.log(`${team}:`);
      console.log(`  Matches: ${matches}`);
      console.log(`  Wins: ${wins}`);
      console.log(`  Win Rate: ${winRate}%`);
      console.log('');
    });
    
    // Create cumulative monthly data
    const sortedMonths = Array.from(monthlyWins.keys()).sort();
    const result = [];
    const runningTotals = new Map();
    
    trackedTeams.forEach(team => runningTotals.set(team, 0));
    
    for (const month of sortedMonths) {
      const monthData = monthlyWins.get(month);
      
      trackedTeams.forEach(team => {
        const monthWinsCount = monthData.get(team) || 0;
        runningTotals.set(team, runningTotals.get(team) + monthWinsCount);
      });
      
      result.push({
        date: month,
        data: trackedTeams.map(team => ({
          name: team,
          value: runningTotals.get(team)
        }))
      });
    }
    
    // Show final rankings for ALL teams
    const rankings = trackedTeams
      .map(team => ({ name: team, wins: teamWins.get(team) }))
      .sort((a, b) => b.wins - a.wins);

    console.log('\n=== FINAL RANKINGS (ALL TRACKED TEAMS) ===');
    rankings.forEach((team, i) => {
      console.log(`${i+1}. ${team.name}: ${team.wins} wins`);
    });
    
    // Get top N teams for the JSON output
    const topNTeams = rankings.slice(0, TOP_N).map(team => team.name);
    
    console.log(`\n=== TOP ${TOP_N} TEAMS FOR JSON OUTPUT ===`);
    topNTeams.forEach((team, i) => {
      const wins = teamWins.get(team);
      console.log(`${i+1}. ${team}: ${wins} wins`);
    });
    
    // Find ALL teams that were ever in top N at any point in time
    const everTopNTeams = new Set();
    const allRunningTotals = new Map();
    
    // Initialize running totals for all teams
    trackedTeams.forEach(team => allRunningTotals.set(team, 0));
    
    // Track which teams enter top N over time
    for (const month of sortedMonths) {
      const monthData = monthlyWins.get(month);
      
      // Update running totals
      trackedTeams.forEach(team => {
        const monthWinsCount = monthData.get(team) || 0;
        allRunningTotals.set(team, allRunningTotals.get(team) + monthWinsCount);
      });
      
      // Get top N teams for this month
      const monthTopN = Array.from(allRunningTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_N)
        .map(entry => entry[0]);
      
      // Add these teams to our "ever top N" set
      monthTopN.forEach(team => everTopNTeams.add(team));
    }
    
    const dynamicTeamList = Array.from(everTopNTeams);
    console.log(`\n=== TEAMS THAT WERE EVER IN TOP ${TOP_N} ===`);
    console.log(`Found ${dynamicTeamList.length} teams that were in top ${TOP_N} at some point:`);
    dynamicTeamList.forEach(team => {
      console.log(`- ${team}: ${teamWins.get(team)} final wins`);
    });
    
    // Recreate monthly data with all teams that were ever in top N
    const finalResult = [];
    const dynamicRunningTotals = new Map();
    
    dynamicTeamList.forEach(team => dynamicRunningTotals.set(team, 0));
    
    for (const month of sortedMonths) {
      const monthData = monthlyWins.get(month);
      
      dynamicTeamList.forEach(team => {
        const monthWinsCount = monthData.get(team) || 0;
        dynamicRunningTotals.set(team, dynamicRunningTotals.get(team) + monthWinsCount);
      });
      
      // Create data array, sort by current wins, and keep only top N
      const sortedMonthData = dynamicTeamList.map(team => ({
        name: team,
        value: dynamicRunningTotals.get(team)
      }))
      .sort((a, b) => b.value - a.value) // Sort by wins descending
      .slice(0, TOP_N); // Keep only top N teams for this month
      
      finalResult.push({
        date: month,
        data: sortedMonthData
      });
    }
    
    // Save all teams that were ever in top N
    fs.writeFileSync('team_wins.json', JSON.stringify(finalResult, null, 2));
    console.log(`Saved ${finalResult.length} monthly entries with ${dynamicTeamList.length} teams (all who were ever in top ${TOP_N}) to team_wins.json`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

countWins();