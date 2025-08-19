const data = require("../data/messi_vs_ronaldo.json");

// Extract all games for each player with their goals and chronological order
function processPlayerData() {
    const messiGames = [];
    const ronaldoGames = [];
    
    // Go through all matches chronologically
    Object.keys(data).forEach(matchKey => {
        const match = data[matchKey];
        
        // Find Messi's data in this match
        const messiData = match.find(player => player.player === "Lionel Messi");
        if (messiData) {
            messiGames.push({
                matchNumber: matchKey,
                goals: messiData.goals || 0, // assuming goals field exists
                assists: messiData.assists || 0, // assuming goals field exists
                date: messiData.date || matchKey
            });
        }
        
        // Find Ronaldo's data in this match
        const ronaldoData = match.find(player => player.player === "Cristiano Ronaldo");
        if (ronaldoData) {
            ronaldoGames.push({
                matchNumber: matchKey,
                goals: ronaldoData.goals || 0,
                assists: ronaldoData.assists || 0,
                date: ronaldoData.date || matchKey
            });
        }
    });
    
    return { messiGames, ronaldoGames };
}

// Main processing function
function createHeadToHeadComparison() {
    const { messiGames, ronaldoGames } = processPlayerData();
    
    // Find minimum games played
    const minGames = Math.min(messiGames.length, ronaldoGames.length);
    console.log(`Messi games: ${messiGames.length}, Ronaldo games: ${ronaldoGames.length}`);
    console.log(`Using most recent ${minGames} games for comparison`);
    
    // Take the most recent games for both players
    const recentMessiGames = messiGames.slice(0,minGames);
    const recentRonaldoGames = ronaldoGames.slice(0,minGames);
    
    // Create the final comparison data with accumulated goals
    const comparisonData = [];
    let messiAccumulated = 0;
    let ronaldoAccumulated = 0;
    
    for (let i = 0; i < minGames; i++) {
        messiAccumulated += recentMessiGames[i].goals + recentMessiGames[i].assists;
        ronaldoAccumulated += recentRonaldoGames[i].goals + recentRonaldoGames[i].assists;
        
        comparisonData.push({
            date: `Game ${i + 1}`, // or use actual dates if available
            data: [
                {
                    player: "Lionel Messi",
                    value: messiAccumulated
                },
                {
                    player: "Cristiano Ronaldo", 
                    value: ronaldoAccumulated
                }
            ]
        });
    }
    
    return comparisonData;
}

// Alternative version if you want to use actual match numbers/dates
function createHeadToHeadWithActualDates() {
    const { messiGames, ronaldoGames } = processPlayerData();
    const minGames = Math.min(messiGames.length, ronaldoGames.length);
    
    const recentMessiGames = messiGames.slice(-minGames);
    const recentRonaldoGames = ronaldoGames.slice(-minGames);
    
    const comparisonData = [];
    let messiAccumulated = 0;
    let ronaldoAccumulated = 0;
    
    for (let i = 0; i < minGames; i++) {
        messiAccumulated += recentMessiGames[i].goals;
        ronaldoAccumulated += recentRonaldoGames[i].goals;
        
        comparisonData.push({
            date: recentMessiGames[i].date || recentRonaldoGames[i].date || `Game ${i + 1}`,
            data: [
                {
                    player: "Lionel Messi",
                    value: messiAccumulated
                },
                {
                    player: "Cristiano Ronaldo", 
                    value: ronaldoAccumulated
                }
            ]
        });
    }
    
    return comparisonData;
}

// Execute and log results
const finalData = createHeadToHeadComparison();
console.log("Head-to-head comparison data:");
console.log(JSON.stringify(finalData, null, 2));
require("fs").writeFileSync("./data/messi_vs_ronaldo_comparison.json.json", JSON.stringify(finalData, null, 2));