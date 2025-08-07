const fs = require('fs');
const readline = require('readline');

// --- CONFIGURATION ---
const inputFile = 'Matches.csv';
const START_YEAR = 2018; // <<-- NEW: Ignore all data from before this year
const TOP_N = 12;      // Only keep top N teams in the final JSON for each month

// Teams to track (same list for both wins and goals)
const trackedTeams = ['Man United', 'Valencia', 'Lazio', 'Barcelona', 'Real Madrid', 'Arsenal', 'Bayern Munich', 'Juventus', 'Zaragoza', 'La Coruna', 'Milan', 'Mallorca', 'Roma', 'Leeds', 'Liverpool', 'Celta', 'Leverkusen', 'Dortmund', 'Inter', 'Sociedad', 'Chelsea', 'Monaco', 'Lyon', 'Villarreal', 'Sevilla', 'Ath Madrid', 'Everton', 'Bordeaux', 'Marseille', 'Werder Bremen', 'Tottenham', 'Man City', 'Schalke 04', 'Paris SG', 'Wolfsburg', 'Napoli', 'Ath Bilbao', 'RB Leipzig', 'Newcastle', 'Aston Villa', 'Atalanta'];

/**
 * Aggregates WINS for tracked teams from the dataset.
 */
async function countWins() {
  console.log(`--- STARTING WIN COUNT AGGREGATION (FROM YEAR ${START_YEAR}) ---`);

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

      const cols = line.split(',');
      if (cols.length < 14) continue;

      const date = cols[1];
      const homeTeam = cols[3];
      const awayTeam = cols[4];
      const result = cols[13];

      if (!date || !result || !['H', 'A', 'D'].includes(result)) continue;
      
      // --- NEW: Filter by Start Year ---
      const year = parseInt(date.substring(0, 4), 10);
      if (isNaN(year) || year < START_YEAR) {
        continue; // Skip this record if it's before the START_YEAR
      }
      // ------------------------------------
      
      lineCount++; // Only increment for lines we actually process

      // Check home team
      if (trackedTeams.includes(homeTeam)) {
        teamMatches.set(homeTeam, teamMatches.get(homeTeam) + 1);
        if (result === 'H') {
          teamWins.set(homeTeam, teamWins.get(homeTeam) + 1);
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
          const month = date.substring(0, 7); // YYYY-MM
          if (!monthlyWins.has(month)) monthlyWins.set(month, new Map());
          const monthData = monthlyWins.get(month);
          monthData.set(awayTeam, (monthData.get(awayTeam) || 0) + 1);
        }
      }

      if (lineCount > 0 && lineCount % 100000 === 0) {
        console.log(`Processed ${lineCount} lines for wins...`);
      }
    }

    console.log(`\nProcessed ${lineCount} total lines for wins (from ${START_YEAR} onwards).`);

    // ... (rest of the function is unchanged)

    const finalRankings = trackedTeams
      .map(team => ({ name: team, wins: teamWins.get(team) }))
      .sort((a, b) => b.wins - a.wins);

    const everTopNTeams = new Set();
    const runningTotals = new Map();
    trackedTeams.forEach(team => runningTotals.set(team, 0));
    const sortedMonths = Array.from(monthlyWins.keys()).sort();

    for (const month of sortedMonths) {
      const monthData = monthlyWins.get(month);
      trackedTeams.forEach(team => {
        runningTotals.set(team, runningTotals.get(team) + (monthData.get(team) || 0));
      });
      const monthTopN = Array.from(runningTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_N)
        .map(entry => entry[0]);
      monthTopN.forEach(team => everTopNTeams.add(team));
    }

    const dynamicTeamList = Array.from(everTopNTeams);
    console.log(`\nFound ${dynamicTeamList.length} teams that were in the Top ${TOP_N} for wins at some point.`);

    const finalResult = [];
    const dynamicRunningTotals = new Map();
    dynamicTeamList.forEach(team => dynamicRunningTotals.set(team, 0));

    for (const month of sortedMonths) {
      const monthData = monthlyWins.get(month);
      dynamicTeamList.forEach(team => {
        dynamicRunningTotals.set(team, dynamicRunningTotals.get(team) + (monthData.get(team) || 0));
      });

      const sortedMonthData = dynamicTeamList.map(team => ({
          name: team,
          value: dynamicRunningTotals.get(team)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_N);

      finalResult.push({ date: month, data: sortedMonthData });
    }

    fs.writeFileSync('team_wins.json', JSON.stringify(finalResult, null, 2));
    console.log(`Successfully saved cumulative win data to team_wins.json`);
    console.log('--- FINISHED WIN COUNT AGGREGATION ---\n');

  } catch (error) {
    console.error('Error during win count:', error);
  }
}

/**
 * Aggregates GOALS for tracked teams from the dataset.
 */
async function countGoals() {
  console.log(`--- STARTING GOAL COUNT AGGREGATION (FROM YEAR ${START_YEAR}) ---`);

  const teamGoals = new Map();
  const monthlyGoals = new Map();

  // Initialize
  trackedTeams.forEach(team => {
    teamGoals.set(team, 0);
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

      const cols = line.split(',');
      if (cols.length < 13) continue;

      const date = cols[1];
      const homeTeam = cols[3];
      const awayTeam = cols[4];
      const homeGoals = parseInt(cols[11], 10);
      const awayGoals = parseInt(cols[12], 10);

      if (!date || isNaN(homeGoals) || isNaN(awayGoals)) continue;

      // --- NEW: Filter by Start Year ---
      const year = parseInt(date.substring(0, 4), 10);
      if (isNaN(year) || year < START_YEAR) {
        continue; // Skip this record if it's before the START_YEAR
      }
      // ------------------------------------

      lineCount++; // Only increment for lines we actually process

      const month = date.substring(0, 7); // YYYY-MM
      if (!monthlyGoals.has(month)) monthlyGoals.set(month, new Map());
      const monthData = monthlyGoals.get(month);

      if (trackedTeams.includes(homeTeam)) {
        teamGoals.set(homeTeam, teamGoals.get(homeTeam) + homeGoals);
        monthData.set(homeTeam, (monthData.get(homeTeam) || 0) + homeGoals);
      }

      if (trackedTeams.includes(awayTeam)) {
        teamGoals.set(awayTeam, teamGoals.get(awayTeam) + awayGoals);
        monthData.set(awayTeam, (monthData.get(awayTeam) || 0) + awayGoals);
      }
      
      if (lineCount > 0 && lineCount % 100000 === 0) {
        console.log(`Processed ${lineCount} lines for goals...`);
      }
    }

    console.log(`\nProcessed ${lineCount} total lines for goals (from ${START_YEAR} onwards).`);
    
    // ... (rest of the function is unchanged)

    const finalRankings = trackedTeams
      .map(team => ({ name: team, goals: teamGoals.get(team) }))
      .sort((a, b) => b.goals - a.goals);

    const everTopNTeams = new Set();
    const runningTotals = new Map();
    trackedTeams.forEach(team => runningTotals.set(team, 0));
    const sortedMonths = Array.from(monthlyGoals.keys()).sort();
    
    for (const month of sortedMonths) {
        const monthData = monthlyGoals.get(month);
        trackedTeams.forEach(team => {
            runningTotals.set(team, runningTotals.get(team) + (monthData.get(team) || 0));
        });
        const monthTopN = Array.from(runningTotals.entries())
            .sort((a,b) => b[1] - a[1])
            .slice(0, TOP_N)
            .map(entry => entry[0]);
        monthTopN.forEach(team => everTopNTeams.add(team));
    }

    const dynamicTeamList = Array.from(everTopNTeams);
    console.log(`\nFound ${dynamicTeamList.length} teams that were in the Top ${TOP_N} for goals at some point.`);

    const finalResult = [];
    const dynamicRunningTotals = new Map();
    dynamicTeamList.forEach(team => dynamicRunningTotals.set(team, 0));

    for (const month of sortedMonths) {
      const monthData = monthlyGoals.get(month);
      dynamicTeamList.forEach(team => {
        dynamicRunningTotals.set(team, dynamicRunningTotals.get(team) + (monthData.get(team) || 0));
      });

      const sortedMonthData = dynamicTeamList.map(team => ({
          name: team,
          value: dynamicRunningTotals.get(team)
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_N);

      finalResult.push({ date: month, data: sortedMonthData });
    }

    fs.writeFileSync('team_goals.json', JSON.stringify(finalResult, null, 2));
    console.log(`Successfully saved cumulative goal data to team_goals.json`);
    console.log('--- FINISHED GOAL COUNT AGGREGATION ---');

  } catch (error) {
    console.error('Error during goal count:', error);
  }
}

// --- MAIN EXECUTION ---
async function main() {
  await countWins();
  await countGoals();
}

main();