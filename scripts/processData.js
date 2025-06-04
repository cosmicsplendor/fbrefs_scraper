const fs = require('fs');

// Import your data file
const rawData = require('./data/Premier_League.json'); // Replace with your actual file path

function processGoalsData(data) {
    // Phase 1: Calculate final season totals for each player
    const finalTotals = {};
    
    // Go through all matchdays to get final totals
    for (let md = 1; md <= 38; md++) {
        if (data[md]) {
            data[md].forEach(player => {
                if (player.goals > 0) { // Only players with goals
                    finalTotals[player.player] = (finalTotals[player.player] || 0) + player.goals;
                }
            });
        }
    }
    
    // Phase 2: Process matchday by matchday with cumulative goals
    const frames = [];
    let cumulativeGoals = {}; // Track cumulative goals for each player
    
    for (let md = 1; md <= 38; md++) {
        // Add goals from current matchday
        if (data[md]) {
            data[md].forEach(player => {
                if (player.goals > 0) { // Filter out zero goals
                    cumulativeGoals[player.player] = (cumulativeGoals[player.player] || 0) + player.goals;
                }
            });
        }
        
        // Convert to array and sort for this matchday
        let playersArray = Object.entries(cumulativeGoals).map(([name, goals]) => ({
            name,
            value: goals,
            finalTotal: finalTotals[name] || 0
        }));
        
        // Sort by current goals, then by final season total for ties
        playersArray.sort((a, b) => {
            if (b.value === a.value) {
                return b.finalTotal - a.finalTotal; // Tie-breaker: higher final total wins
            }
            return b.value - a.value; // Primary sort: current goals descending
        });
        
        // Keep top 12
        playersArray = playersArray.slice(0, 12);
        
        // Create frame for this matchday
        const frame = {
            date: `MD${md}`,
            data: playersArray.map(p => ({
                name: p.name,
                value: p.value
            }))
        };
        
        frames.push(frame);
    }
    
    return frames;
}

// Process the data
const frames = processGoalsData(rawData);

// Optional: Save processed data to file
fs.writeFileSync('./scripts/data/prem_final.json', JSON.stringify(frames, null, 2));

// Optional: Print some stats
console.log(`Generated ${frames.length} frames`);
console.log('Sample frame (MD1):');
console.log(JSON.stringify(frames[0], null, 2));

console.log('Final frame (MD38):');
console.log(JSON.stringify(frames[frames.length - 1], null, 2));

// Optional: Count unique players across all frames
const allPlayers = new Set();
frames.forEach(frame => {
    frame.data.forEach(player => {
        allPlayers.add(player.name);
    });
});
console.log(`Total unique players across all frames: ${allPlayers.size}`);

// Export for use in other modules
module.exports = { processGoalsData, frames };