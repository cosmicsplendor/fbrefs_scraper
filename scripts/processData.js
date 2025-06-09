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
            const uniquePlayers = new Map();
            mergedData[matchdayNum].forEach(player => {
                const playerName = player.player;
                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);
                if (!uniquePlayers.has(playerName) ||
                    FIELDS.reduce((sum, field) => sum + (uniquePlayers.get(playerName)[field] || 0), 0) < playerValue) {
                    uniquePlayers.set(playerName, player);
                }
            });
            mergedData[matchdayNum] = Array.from(uniquePlayers.values());
            const newCount = mergedData[matchdayNum].length;
            if (originalCount !== newCount) {
                console.log(`  MD${matchdayNum}: Removed ${originalCount - newCount} duplicates (${originalCount} -> ${newCount})`);
            }
        }
    });

    return { mergedData, maxMatchday };
}

// MODIFIED: Parameter changed from MIN_MATCHES to MIN_FULL_MATCHES_EQUIVALENT
function processGoalsData(filePaths, FIELDS, COUNT, MIN_FULL_MATCHES_EQUIVALENT, POSITION_FILTER = null, VALUE_TYPE = "aggregate") {
    // NEW: Calculate the minute threshold based on the "full matches" equivalent
    const MIN_MINUTES = MIN_FULL_MATCHES_EQUIVALENT * 90;

    console.log(`Processing data with fields: ${FIELDS.join(', ')}`);
    console.log(`Value calculation type: ${VALUE_TYPE}`);
    if (VALUE_TYPE === "average") {
        console.log(`Minimum minutes for average consideration: ${MIN_MINUTES} (equivalent to ${MIN_FULL_MATCHES_EQUIVALENT} full 90s)`);
    }
    if (POSITION_FILTER && POSITION_FILTER.length > 0) {
        console.log(`Filtering by positions: ${POSITION_FILTER.join(', ')}`);
    } else {
        console.log('No position filter applied');
    }

    const { mergedData: data, maxMatchday } = loadAndMergeData(filePaths, FIELDS);

    const matchesPositionFilter = (player) => {
        if (!POSITION_FILTER || POSITION_FILTER.length === 0) return true;
        const playerPosition = player.position;
        if (!playerPosition) return false;
        return POSITION_FILTER.some(pos => playerPosition.toLowerCase() === pos.toLowerCase());
    };

    const finalTotals = {};
    for (let md = 1; md <= maxMatchday; md++) {
        if (data[md]) {
            data[md].forEach(player => {
                if (!matchesPositionFilter(player)) return;
                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);
                finalTotals[player.player] = (finalTotals[player.player] || 0) + playerValue;
            });
        }
    }

    const frames = [];
    let cumulativeValues = {};
    let playerPositions = {};
    // MODIFIED: This now tracks total minutes played, not just appearances.
    let playerMinutesPlayed = {};

    for (let md = 1; md <= maxMatchday; md++) {
        if (data[md]) {
            data[md].forEach(player => {
                if (!matchesPositionFilter(player)) return;

                // MODIFIED: Accumulate minutes played.
                playerMinutesPlayed[player.player] = (playerMinutesPlayed[player.player] || 0) + (player.minutes || 0);

                if (player.position) {
                    playerPositions[player.player] = player.position;
                }
                
                const playerValue = FIELDS.reduce((sum, field) => sum + (player[field] || 0), 0);
                if (playerValue > 0) {
                    cumulativeValues[player.player] = (cumulativeValues[player.player] || 0) + playerValue;
                }
            });
        }

        // MODIFIED: Build the array from all players who have played any minutes.
        let playersArray = Object.keys(playerMinutesPlayed).map(name => {
            const totalMinutes = playerMinutesPlayed[name];
            const cumulativeValue = cumulativeValues[name] || 0;
            
            let displayValue;
            if (VALUE_TYPE === "average") {
                // Calculate "per 90 minutes" stat. Handle division by zero.
                displayValue = totalMinutes > 0 ? (cumulativeValue / totalMinutes) * 90 : 0;
            } else {
                displayValue = cumulativeValue;
            }
            
            return {
                name,
                value: displayValue,
                cumulativeValue: cumulativeValue,
                totalMinutes: totalMinutes, // MODIFIED: Track total minutes
                finalTotal: finalTotals[name] || 0
            };
        });

        // MODIFIED: Filter by MIN_MINUTES instead of MIN_MATCHES
        if (VALUE_TYPE === "average") {
            playersArray = playersArray.filter(player => player.totalMinutes >= MIN_MINUTES);
        }

        playersArray.sort((a, b) => {
            if (b.value === a.value) {
                return b.finalTotal - a.finalTotal;
            }
            return b.value - a.value;
        });

        playersArray = playersArray.slice(0, COUNT);

        const frame = {
            date: `MD${md}`,
            data: playersArray.map(p => ({
                name: p.name,
                value: p.value,
                position: playerPositions[p.name],
                // MODIFIED: Include totalMinutes in the output frame data
                ...(VALUE_TYPE === "average" && {
                    totalMinutes: p.totalMinutes,
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
    "progressive_passes", "take_ons_won", "gca", "progressive_carries", "assists", "goals", "sca"
]; 
const COUNT = 10;
// NEW: Define the minimum number of FULL 90-MINUTE MATCHES a player must have played.
// The script will calculate the total minute requirement (e.g., 15 * 90 = 1350 minutes).
const FULL_MATCHES = 10; 
const VALUE_TYPE = "average"; 
const POSITION_FILTER = ["LB"];

// MODIFIED: Pass the new constant to the function
const frames = processGoalsData(filePaths, FIELDS, COUNT, FULL_MATCHES, POSITION_FILTER, VALUE_TYPE);

// Optional: Save processed data to file
fs.writeFileSync('./scripts/data/multi_league_final.json', JSON.stringify(frames, null, 2));

// Optional: Print some stats
console.log(`Generated ${frames.length} frames`);
if (frames.length > 0) {
    console.log('Sample frame (early matchday):');
    console.log(JSON.stringify(frames[FULL_MATCHES] || frames[0], null, 2)); // Show a frame where players might appear

    console.log('Final frame:');
    console.log(JSON.stringify(frames[frames.length - 1], null, 2));
}

const allPlayers = new Set();
frames.forEach(frame => frame.data.forEach(player => allPlayers.add(player.name)));
console.log(`Total unique players across all frames (respecting filters): ${allPlayers.size}`);

// MODIFIED: Update logging for average mode to show minutes
if (VALUE_TYPE === "average") {
    console.log('\nAverage mode statistics:');
    const lastFrame = frames[frames.length - 1];
    if (lastFrame && lastFrame.data.length > 0) {
        console.log(`Top ${lastFrame.data.length} players by 'per 90' value (final frame, min ${FULL_MATCHES} matches):`);
        lastFrame.data.slice(0, 10).forEach((player, index) => {
            console.log(`  ${index + 1}. ${player.name} (${player.value.toFixed(2)} per 90 | ${player.cumulative} total in ${player.totalMinutes} mins)`);
        });
    }
}