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
    
    // Recreate monthly data with only top N teams
    const finalResult = [];
    const topNRunningTotals = new Map();
    
    topNTeams.forEach(team => topNRunningTotals.set(team, 0));
    
    for (const month of sortedMonths) {
      const monthData = monthlyWins.get(month);
      
      topNTeams.forEach(team => {
        const monthWinsCount = monthData.get(team) || 0;
        topNRunningTotals.set(team, topNRunningTotals.get(team) + monthWinsCount);
      });
      
      finalResult.push({
        date: month,
        data: topNTeams.map(team => ({
          name: team,
          value: topNRunningTotals.get(team)
        }))
      });
    }
    
    // Save only top N teams
    fs.writeFileSync('team_wins.json', JSON.stringify(finalResult, null, 2));
    console.log(`Saved ${finalResult.length} monthly entries with top ${TOP_N} teams to team_wins.json`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

countWins();