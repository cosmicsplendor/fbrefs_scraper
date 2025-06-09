const fs = require('fs');

// Configure fields here - change this array to modify what gets accumulated and sorted

function loadAndMergeData(filePaths, FIELDS) {
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

            // Create a map to track unique players and keep the one with highest total value if duplicates exist
            const uniquePlayers = new Map();

            mergedData[matchdayNum].forEach(player => {
                const playerName = player.player;
                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);

                if (!uniquePlayers.has(playerName) ||
                    FIELDS.reduce((sum, field) => sum + (uniquePlayers.get(playerName)[field] || 0), 0) < playerValue) {
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

function processGoalsData(filePaths, FIELDS, COUNT, POSITION_FILTER = null, VALUE_TYPE = "aggregate", MIN_MATCHES = 1) {
    console.log(`Processing data with fields: ${FIELDS.join(', ')}`);
    console.log(`Value calculation type: ${VALUE_TYPE}`);
    if (VALUE_TYPE === "average") {
        console.log(`Minimum matches required: ${MIN_MATCHES}`);
    }
    if (POSITION_FILTER && POSITION_FILTER.length > 0) {
        console.log(`Filtering by positions: ${POSITION_FILTER.join(', ')}`);
    } else {
        console.log('No position filter applied');
    }

    // Load and merge data from all files
    const { mergedData: data, maxMatchday } = loadAndMergeData(filePaths, FIELDS);

    // Helper function to check if player matches position filter
    const matchesPositionFilter = (player) => {
        if (!POSITION_FILTER || POSITION_FILTER.length === 0) {
            return true; // No filter applied
        }
        
        const playerPosition = player.position;
        if (!playerPosition) {
            return false; // Player has no position data
        }
        
        // Check if player's position exactly matches any of the filtered positions (case insensitive)
        return POSITION_FILTER.some(pos => 
            playerPosition.toLowerCase() === pos.toLowerCase()
        );
    };

    // Phase 1: Calculate final season totals for each player
    const finalTotals = {};

    // Go through all matchdays to get final totals
    for (let md = 1; md <= maxMatchday; md++) {
        if (data[md]) {
            data[md].forEach(player => {
                // Apply position filter
                if (!matchesPositionFilter(player)) {
                    return;
                }

                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);
                if (playerValue > 0) { // Only players with positive values
                    finalTotals[player.player] = (finalTotals[player.player] || 0) + playerValue;
                }
            });
        }
    }

    // Phase 2: Process matchday by matchday with cumulative values
    const frames = [];
    let cumulativeValues = {}; // Track cumulative values for each player
    let playerPositions = {}; // Track player positions for reference
    let playerAppearances = {}; // Track number of matchdays each player has appeared in

    for (let md = 1; md <= maxMatchday; md++) {
        // Add values from current matchday
        if (data[md]) {
            data[md].forEach(player => {
                // Apply position filter
                if (!matchesPositionFilter(player)) {
                    return;
                }

                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);
                if (playerValue > 0) { // Filter out zero values
                    cumulativeValues[player.player] = (cumulativeValues[player.player] || 0) + playerValue;
                    playerAppearances[player.player] = (playerAppearances[player.player] || 0) + 1;
                    // Store player position for reference
                    if (player.position) {
                        playerPositions[player.player] = player.position;
                    }
                }
            });
        }

        // Convert to array and sort for this matchday
        let playersArray = Object.entries(cumulativeValues).map(([name, cumulativeValue]) => {
            const appearances = playerAppearances[name] || 1;
            const displayValue = VALUE_TYPE === "average" ? cumulativeValue / appearances : cumulativeValue;
            
            return {
                name,
                value: displayValue,
                cumulativeValue: cumulativeValue,
                appearances: appearances,
                finalTotal: finalTotals[name] || 0
            };
        });

        // Apply minimum matches filter for average mode
        if (VALUE_TYPE === "average") {
            const beforeFilter = playersArray.length;
            playersArray = playersArray.filter(player => player.appearances >= MIN_MATCHES);
            const afterFilter = playersArray.length;
            
            if (md === maxMatchday && beforeFilter !== afterFilter) {
                console.log(`Final frame: Filtered out ${beforeFilter - afterFilter} players with less than ${MIN_MATCHES} matches`);
            }
        }

        // Sort by display values, then by final season total for ties
        playersArray.sort((a, b) => {
            if (b.value === a.value) {
                return b.finalTotal - a.finalTotal; // Tie-breaker: higher final total wins
            }
            return b.value - a.value; // Primary sort: display values descending
        });

        // Keep top COUNT
        playersArray = playersArray.slice(0, COUNT);

        // Create frame for this matchday
        const frame = {
            date: `MD${md}`,
            data: playersArray.map(p => ({
                name: p.name,
                value: p.value,
                position: p.position,
                ...(VALUE_TYPE === "average" && {
                    appearances: p.appearances,
                    cumulative: p.cumulativeValue
                })
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
    './data/Serie_A.json',
    // "./data/Saudi.json",
    // "./data/Liga_Nos.json"
    // Add more leagues as needed
];

const FIELDS = [
    "goals",
    "assists"
    // 'progressive_passes',

    // 'progressive_carries',
    // "take_ons_won"
]; // Examples: ['goals'], ['assists'], ['goals', 'assists']

const COUNT = 10;

// Value calculation type - "aggregate" (cumulative) or "average" (per match)
// "aggregate": Shows cumulative totals (current behavior)
// "average": Shows per-match averages (fairer for players with different playing time)
const VALUE_TYPE = "average"; // Change to "average" for per-match calculations

// Minimum matches required for average mode
// Only applies when VALUE_TYPE is "average"
// Players with fewer appearances will be filtered out
// Examples: 
// const MIN_MATCHES = 1;  // Include all players (no filtering)
// const MIN_MATCHES = 5;  // Require at least 5 matches
// const MIN_MATCHES = 10; // Require at least 10 matches for more stable averages
const MIN_MATCHES = 5; // Adjust this value based on your requirements

// Position filter - set to null, empty array, or specific positions
// Examples:
// const POSITION_FILTER = null; // No filter
// const POSITION_FILTER = []; // No filter
// const POSITION_FILTER = ["LB", "RB"]; // Filter for left and right backs
// const POSITION_FILTER = ["CM", "CDM", "CAM"]; // Filter for central midfielders
// const POSITION_FILTER = ["GK"]; // Filter for goalkeepers only
// const POSITION_FILTER = ["CF", "LW", "RW"]; // Filter for forwards/wingers
const POSITION_FILTER = [
    "LB", 
]; // Change this to filter by position

// Process the data
const frames = processGoalsData(filePaths, FIELDS, COUNT, POSITION_FILTER, VALUE_TYPE, MIN_MATCHES);

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
const positionCounts = {};
frames.forEach(frame => {
    frame.data.forEach(player => {
        allPlayers.add(player.name);
        // Count positions
        const pos = player.position || 'Unknown';
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
});

console.log(`Total unique players across all frames: ${allPlayers.size}`);
console.log('Position distribution across frames:');
Object.entries(positionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([position, count]) => {
        console.log(`  ${position}: ${count} appearances`);
    });

// Additional stats for average mode
if (VALUE_TYPE === "average") {
    console.log('\nAverage mode statistics:');
    const lastFrame = frames[frames.length - 1];
    if (lastFrame && lastFrame.data.length > 0) {
        console.log(`Top ${Math.min(10, lastFrame.data.length)} players by average (final frame, min ${MIN_MATCHES} matches):`);
        lastFrame.data.slice(0, 10).forEach((player, index) => {
            console.log(`  ${index + 1}. ${player.name} (${player.value.toFixed(2)} avg, ${player.cumulative} total in ${player.appearances} matches)`);
        });
    }
}