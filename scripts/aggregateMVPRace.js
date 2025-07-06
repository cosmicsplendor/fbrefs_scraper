const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_DIR = path.join('scripts', 'market_value_data');
const OUTPUT_FILE = path.join('scripts', 'bar_racing_data.json');

// --- HELPER FUNCTIONS ---

/**
 * Converts market value string to number
 */
const parseMarketValue = (marketValueStr) => {
    if (!marketValueStr || marketValueStr === '-') {
        return 0;
    }
    const cleanStr = marketValueStr.replace(/€|,/g, '').trim();
    if (cleanStr.toLowerCase().includes('m')) {
        const value = parseFloat(cleanStr.replace(/m/i, ''));
        return Math.round(value * 1000000);
    }
    if (cleanStr.toLowerCase().includes('k')) {
        const value = parseFloat(cleanStr.replace(/k/i, ''));
        return Math.round(value * 1000);
    }
    const value = parseFloat(cleanStr);
    return isNaN(value) ? 0 : Math.round(value);
};

/**
 * Converts timestamp to YYYY-WW format (year-week)
 */
const timestampToYearWeek = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
    const weekNumber = Math.ceil(dayOfYear / 7);
    return `${year}-${String(weekNumber).padStart(2, '0')}`;
};

/**
 * Converts YYYY-WW to just the year
 */
const formatYear = (yearWeek) => {
    const [year] = yearWeek.split('-');
    return year;
};

/**
 * Generates all weeks between start and end dates (inclusive)
 */
const generateWeekRange = (startYearWeek, endYearWeek) => {
    const weeks = [];
    const [startYear, startWeek] = startYearWeek.split('-').map(Number);
    const [endYear, endWeek] = endYearWeek.split('-').map(Number);
    let currentYear = startYear;
    let currentWeek = startWeek;
    while (currentYear < endYear || (currentYear === endYear && currentWeek <= endWeek)) {
        weeks.push(`${currentYear}-${String(currentWeek).padStart(2, '0')}`);
        currentWeek++;
        const weeksInYear = new Date(currentYear, 11, 31).getDay() === 4 || new Date(currentYear - 1, 11, 31).getDay() === 3 ? 53 : 52;
        if (currentWeek > weeksInYear) {
            currentWeek = 1;
            currentYear++;
        }
    }
    return weeks;
};

/**
 * Interpolates market value data to weekly granularity
 */
const interpolateWeeklyData = (dataPoints, playerName) => {
    if (!dataPoints || dataPoints.length === 0) {
        console.warn(`[WARNING] No data points for player: ${playerName}`);
        return [];
    }
    const sortedData = dataPoints.sort((a, b) => a.x - b.x);
    const filteredData = sortedData.filter((point, index) => {
        if (point.y === 0 || point.mw === '-') {
            return index === 0 || index === sortedData.length - 1;
        }
        return true;
    });
    if (filteredData.length === 0) {
        console.warn(`[WARNING] No valid data points after filtering for player: ${playerName}`);
        return [];
    }
    const weeklyData = filteredData.map(point => ({
        yearWeek: timestampToYearWeek(point.x),
        value: parseMarketValue(point.mw),
        originalTimestamp: point.x,
        club: point.verein,
        age: point.age
    }));
    weeklyData.sort((a, b) => a.yearWeek.localeCompare(b.yearWeek));
    return weeklyData;
};

/**
 * [CORRECTED VERSION] Fills missing weeks with interpolated values. This version correctly
 * propagates the 'club' field through all interpolated points.
 */
const fillMissingWeeks = (weeklyData, allWeeks) => {
    if (!weeklyData || weeklyData.length === 0) {
        return [];
    }

    const filledData = [];
    const dataMap = new Map(weeklyData.map(d => [d.yearWeek, d]));
    
    // This will hold the most recent *real* data point we've encountered.
    let lastKnownPoint = null; 

    for (const week of allWeeks) {
        // If there's a real data point for this week, use it and update our "memory".
        if (dataMap.has(week)) {
            const currentPoint = dataMap.get(week);
            filledData.push(currentPoint);
            lastKnownPoint = currentPoint; // Update the last known state
            continue;
        }

        // If we haven't encountered any data for this player yet, skip.
        if (!lastKnownPoint) {
            continue;
        }

        // --- Robust interpolation logic ---
        // Find the next real data point *after* the current week.
        const nextPoint = weeklyData.find(d => d.yearWeek > week);
        
        let interpolatedValue = lastKnownPoint.value; // Default to last known value (extrapolation)

        // If there is a future point, we interpolate between lastKnown and next.
        if (nextPoint) {
            const beforeTime = new Date(lastKnownPoint.originalTimestamp);
            const afterTime = new Date(nextPoint.originalTimestamp);
            const [currentYear, currentWeek] = week.split('-').map(Number);
            const currentTime = new Date(currentYear, 0, 1 + (currentWeek - 1) * 7);

            if (afterTime > beforeTime) {
                const ratio = (currentTime - beforeTime) / (afterTime - beforeTime);
                interpolatedValue = Math.round(lastKnownPoint.value + (nextPoint.value - lastKnownPoint.value) * ratio);
            }
        }
        
        filledData.push({
            yearWeek: week,
            value: Math.max(0, interpolatedValue),
            interpolated: true,
            // Always use the club from the last known real data point.
            club: lastKnownPoint.club,
        });
    }

    return filledData;
};


/**
 * Processes a single player's market value data
 */
const processPlayerData = async (filePath, playerName) => {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        if (!data.list || !Array.isArray(data.list)) {
            console.error(`[ERROR] Invalid data structure in ${filePath}`);
            return null;
        }
        console.log(`[PROCESS] Processing ${playerName} - ${data.list.length} data points`);
        const weeklyData = interpolateWeeklyData(data.list, playerName);
        return {
            name: playerName,
            rawDataPoints: data.list.length,
            weeklyDataPoints: weeklyData.length,
            data: weeklyData
        };
    } catch (error) {
        console.error(`[ERROR] Failed to process ${playerName}:`, error.message);
        return null;
    }
};

/**
 * Extracts player name from filename
 */
const extractPlayerName = (filename) => {
    return filename
        .replace('_market_value.json', '')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Main processing function
 */
const main = async () => {
    console.log('--- Starting Market Value Data Processing ---');
    try {
        const inputDirExists = await fs.access(INPUT_DIR).then(() => true).catch(() => false);
        if (!inputDirExists) {
            console.error(`[FATAL] Input directory does not exist: ${INPUT_DIR}`);
            return;
        }
        const files = await fs.readdir(INPUT_DIR);
        const jsonFiles = files.filter(file => file.endsWith('_market_value.json'));
        if (jsonFiles.length === 0) {
            console.error(`[FATAL] No market value JSON files found in ${INPUT_DIR}`);
            return;
        }
        console.log(`[INFO] Found ${jsonFiles.length} player data files`);
        const playersData = [];
        for (const file of jsonFiles) {
            const playerName = extractPlayerName(file);
            const filePath = path.join(INPUT_DIR, file);
            const playerData = await processPlayerData(filePath, playerName);
            if (playerData) {
                playersData.push(playerData);
            }
        }
        if (playersData.length === 0) {
            console.error('[FATAL] No valid player data was processed');
            return;
        }
        let earliestWeek = null;
        let latestWeek = null;
        for (const player of playersData) {
            for (const dataPoint of player.data) {
                if (!earliestWeek || dataPoint.yearWeek < earliestWeek) {
                    earliestWeek = dataPoint.yearWeek;
                }
                if (!latestWeek || dataPoint.yearWeek > latestWeek) {
                    latestWeek = dataPoint.yearWeek;
                }
            }
        }
        console.log(`[INFO] Date range: ${earliestWeek} to ${latestWeek}`);
        const allWeeks = generateWeekRange(earliestWeek, latestWeek);
        console.log(`[INFO] Total weeks to process: ${allWeeks.length}`);
        const processedPlayers = playersData.map(player => ({
            name: player.name,
            data: fillMissingWeeks(player.data, allWeeks)
        }));
        
        // Create bar racing format
        const barRacingData = allWeeks.map(week => {
            const weekData = [];
            for (const player of processedPlayers) {
                const playerDataForWeek = player.data.find(d => d.yearWeek === week);
                if (playerDataForWeek) {
                    // [CORRECTED] Include the club in the final output
                    weekData.push({
                        name: player.name,
                        value: playerDataForWeek.value,
                        club: playerDataForWeek.club
                    });
                }
            }
            weekData.sort((a, b) => b.value - a.value);
            const top10 = weekData.slice(0, 10);
            return {
                date: formatYear(week),
                data: top10
            };
        });

        await fs.writeFile(OUTPUT_FILE, JSON.stringify(barRacingData, null, 2));
        console.log(`[SUCCESS] Bar racing data saved to: ${OUTPUT_FILE}`);
        console.log(`[INFO] Generated ${barRacingData.length} weekly data points`);
        console.log(`[INFO] Each week contains top 10 players by market value`);
        console.log('\n--- Processing Summary ---');
        console.log(`Total players processed: ${processedPlayers.length}`);
        if (barRacingData.length > 0) {
            console.log('\n--- Sample Data (First Month) ---');
            console.log(JSON.stringify(barRacingData[0], null, 2));
            if (barRacingData.length > 1) {
                console.log('\n--- Sample Data (Last Month) ---');
                console.log(JSON.stringify(barRacingData[barRacingData.length - 1], null, 2));
            }
        }
    } catch (error) {
        console.error('[FATAL] Unexpected error:', error.message);
    }
};

main();