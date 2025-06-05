const fs = require('fs');

function loadAndMergeData(filePaths) {
    let mergedData = {};
    let maxMatchday = 0;

    // Load and merge data from all files
    filePaths.forEach(filePath => {
        try {
            console.log(`Loading data from: ${filePath}`);
            const rawData = require(filePath);

            // Find the maximum matchday in this dataset
            const matchdays = Object.keys(rawData).map(Number).filter(n => !isNaN(n));
            const fileMaxMD = Math.max(...matchdays);
            maxMatchday = Math.max(maxMatchday, fileMaxMD);

            // Merge the data
            Object.keys(rawData).forEach(md => {
                const matchdayNum = parseInt(md);
                if (!isNaN(matchdayNum)) {
                    if (!mergedData[matchdayNum]) {
                        mergedData[matchdayNum] = [];
                    }
                    // Add all players from this matchday to the merged data
                    mergedData[matchdayNum] = mergedData[matchdayNum].concat(rawData[md]);
                }
            });

            console.log(`  - Max matchday in file: ${fileMaxMD}`);
        } catch (error) {
            console.error(`Error loading file ${filePath}:`, error.message);
        }
    });

    console.log(`Overall max matchday: ${maxMatchday}`);

    // Phase 1.5: Remove duplicate players from each matchday
    console.log('Removing duplicate players from matchdays...');
    Object.keys(mergedData).forEach(md => {
        const matchdayNum = parseInt(md);
        if (!isNaN(matchdayNum) && mergedData[matchdayNum]) {
            const originalCount = mergedData[matchdayNum].length;

            // Create a map to track unique players and keep the one with highest goals if duplicates exist
            const uniquePlayers = new Map();

            mergedData[matchdayNum].forEach(player => {
                const playerName = player.player;
                if (!uniquePlayers.has(playerName) || uniquePlayers.get(playerName).goals < player.goals) {
                    uniquePlayers.set(playerName, player);
                }
            });

            // Convert back to array
            mergedData[matchdayNum] = Array.from(uniquePlayers.values());

            const newCount = mergedData[matchdayNum].length;
            if (originalCount !== newCount) {
                console.log(`  MD${matchdayNum}: Removed ${originalCount - newCount} duplicates (${originalCount} -> ${newCount})`);
            }
        }
    });

    return { mergedData, maxMatchday };
}

function processGoalsData(filePaths) {
    // Load and merge data from all files
    const { mergedData: data, maxMatchday } = loadAndMergeData(filePaths);

    // Phase 1: Calculate final season totals for each player
    const finalTotals = {};

    // Go through all matchdays to get final totals
    for (let md = 1; md <= maxMatchday; md++) {
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

    for (let md = 1; md <= maxMatchday; md++) {
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

// Example usage:
const filePaths = [
    './data/Premier_League.json',
    './data/Bundesliga.json',
    './data/La_Liga.json',
    './data/Ligue_1.json',
    './data/Serie_A.json'
    // Add more leagues as needed
];

// Process the data
const frames = processGoalsData(filePaths);

// Optional: Save processed data to file
fs.writeFileSync('./scripts/data/multi_league_final.json', JSON.stringify(frames, null, 2));

// Optional: Print some stats
console.log(`Generated ${frames.length} frames`);
if (frames.length > 0) {
    console.log('Sample frame (MD1):');
    console.log(JSON.stringify(frames[0], null, 2));

    console.log('Final frame:');
    console.log(JSON.stringify(frames[frames.length - 1], null, 2));
}

// Optional: Count unique players across all frames
const allPlayers = new Set();
frames.forEach(frame => {
    frame.data.forEach(player => {
        allPlayers.add(player.name);
    });
});
console.log(`Total unique players across all frames: ${allPlayers.size}`);

// Export for use in other modules
module.exports = { processGoalsData, loadAndMergeData, frames };