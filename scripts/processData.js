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

// MODIFIED: Added MIN_MATCHES parameter to the function signature
function processGoalsData(filePaths, FIELDS, COUNT, MIN_MATCHES, POSITION_FILTER = null, VALUE_TYPE = "aggregate") {
    console.log(`Processing data with fields: ${FIELDS.join(', ')}`);
    console.log(`Value calculation type: ${VALUE_TYPE}`);
    // NEW: Log the minimum matches requirement if calculating by average
    if (VALUE_TYPE === "average") {
        console.log(`Minimum matches for average consideration: ${MIN_MATCHES}`);
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
                // NOTE: We only need to sum up final totals for this tie-breaker logic.
                // The main `playerValue > 0` check will be in the next phase.
                finalTotals[player.player] = (finalTotals[player.player] || 0) + playerValue;
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
                // Apply position filter first
                if (!matchesPositionFilter(player)) {
                    return;
                }

                // --- FIX ---
                // NOW: Always count the appearance if the player exists for this matchday
                // and passes the position filter. This correctly tracks "matches played".
                playerAppearances[player.player] = (playerAppearances[player.player] || 0) + 1;
                
                // Store/update player position for reference
                if (player.position) {
                    playerPositions[player.player] = player.position;
                }
                
                // Only add to cumulative score if they actually contributed.
                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);
                if (playerValue > 0) {
                    cumulativeValues[player.player] = (cumulativeValues[player.player] || 0) + playerValue;
                    // WAS: The appearance counter was incorrectly located inside this block.
                }
            });
        }

        // --- FIX ---
        // NOW: Build the array from all players who have appeared, not just those with scores.
        // WAS: let playersArray = Object.entries(cumulativeValues).map(...)
        let playersArray = Object.keys(playerAppearances).map(name => {
            const appearances = playerAppearances[name];
            // If a player appeared but never scored, their cumulative value is 0.
            const cumulativeValue = cumulativeValues[name] || 0;
            const displayValue = VALUE_TYPE === "average" ? (appearances > 0 ? cumulativeValue / appearances : 0) : cumulativeValue;
            
            return {
                name,
                value: displayValue,
                cumulativeValue: cumulativeValue,
                appearances: appearances,
                finalTotal: finalTotals[name] || 0
            };
        });

        // If calculating by average, filter out players with fewer than MIN_MATCHES
        if (VALUE_TYPE === "average") {
            playersArray = playersArray.filter(player => player.appearances >= MIN_MATCHES);
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
                // --- FIX ---
                // NOW: Get the position from our helper object.
                // WAS: `p.position` was undefined, as it wasn't added to the object.
                position: playerPositions[p.name],
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


// --- Your existing usage code remains the same ---

// Example usage:
const filePaths = [
    './data/Premier_League.json',
    './data/Bundesliga.json',
    './data/La_Liga.json',
    './data/Ligue_1.json',
    './data/Serie_A.json',
];

const FIELDS = [ 
    "goals",
    "assists",
    "progressive_carries",
    "progressive_passes",
    "take_ons_won",
    "carries"
    // "blocks",
    // "interceptions"

]; 
const COUNT = 10;
const MIN_MATCHES = 15; // Now correctly filters by "matches played"
const VALUE_TYPE = "average"; 
const POSITION_FILTER = [
    "LB"
];

// Call the corrected function
const frames = processGoalsData(filePaths, FIELDS, COUNT, MIN_MATCHES, POSITION_FILTER, VALUE_TYPE);

// Optional: Save processed data to file
fs.writeFileSync('./scripts/data/multi_league_final.json', JSON.stringify(frames, null, 2));

// Optional: Print some stats
console.log(`Generated ${frames.length} frames`);
if (frames.length > 0) {
    console.log('Sample frame (MD1 - note: will be empty if MIN_MATCHES > 1):');
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
        const pos = player.position || 'Unknown';
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
});

console.log(`Total unique players across all frames (respecting filters): ${allPlayers.size}`);
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
        console.log(`Top ${lastFrame.data.length} players by average (final frame, min ${MIN_MATCHES} matches):`);
        lastFrame.data.slice(0, 10).forEach((player, index) => {
            console.log(`  ${index + 1}. ${player.name} (${player.value.toFixed(2)} avg | ${player.cumulative} total in ${player.appearances} matches)`);
        });
    }
}