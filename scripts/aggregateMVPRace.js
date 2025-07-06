// process_market_value_data.js
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_DIR = path.join('scripts', 'market_value_data');
const OUTPUT_FILE = path.join('scripts', 'bar_racing_data.json');

// --- HELPER FUNCTIONS ---

/**
 * Converts market value string to number
 * Examples: "€25.00m" -> 25000000, "€500.00k" -> 500000, "-" -> 0
 */
const parseMarketValue = (marketValueStr) => {
    if (!marketValueStr || marketValueStr === '-') {
        return 0;
    }
    
    // Remove € symbol and spaces
    const cleanStr = marketValueStr.replace(/€|,/g, '').trim();
    
    // Handle millions (m)
    if (cleanStr.toLowerCase().includes('m')) {
        const value = parseFloat(cleanStr.replace(/m/i, ''));
        return Math.round(value * 1000000);
    }
    
    // Handle thousands (k)
    if (cleanStr.toLowerCase().includes('k')) {
        const value = parseFloat(cleanStr.replace(/k/i, ''));
        return Math.round(value * 1000);
    }
    
    // Handle plain numbers
    const value = parseFloat(cleanStr);
    return isNaN(value) ? 0 : Math.round(value);
};

/**
 * Converts timestamp to YYYY-WW format (year-week)
 */
const timestampToYearWeek = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    
    // Calculate week number
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
        // Approximate 52 weeks per year (some years have 53)
        const weeksInYear = currentYear % 4 === 0 ? 53 : 52;
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
    
    // Sort by timestamp
    const sortedData = dataPoints.sort((a, b) => a.x - b.x);
    
    // Filter out middle blanks (keep only first and last if they are blanks)
    const filteredData = sortedData.filter((point, index) => {
        if (point.y === 0 || point.mw === '-') {
            // Keep if it's the first or last point
            return index === 0 || index === sortedData.length - 1;
        }
        return true;
    });
    
    if (filteredData.length === 0) {
        console.warn(`[WARNING] No valid data points after filtering for player: ${playerName}`);
        return [];
    }
    
    // Convert to weekly data with parsed values
    const weeklyData = filteredData.map(point => ({
        yearWeek: timestampToYearWeek(point.x),
        value: parseMarketValue(point.mw),
        originalTimestamp: point.x,
        club: point.verein,
        age: point.age
    }));
    
    // Sort by yearWeek
    weeklyData.sort((a, b) => a.yearWeek.localeCompare(b.yearWeek));
    
    return weeklyData;
};

/**
 * Fills missing weeks with interpolated values
 * Only interpolates between existing data points, doesn't extrapolate backwards
 */
const fillMissingWeeks = (weeklyData, allWeeks) => {
    if (!weeklyData || weeklyData.length === 0) {
        return [];
    }
    
    const filledData = [];
    const dataMap = new Map(weeklyData.map(d => [d.yearWeek, d]));
    
    // Get player's first and last data points
    const firstDataWeek = weeklyData[0].yearWeek;
    const lastDataWeek = weeklyData[weeklyData.length - 1].yearWeek;
    
    for (const week of allWeeks) {
        // Skip weeks before player's first appearance
        if (week < firstDataWeek) {
            continue;
        }
        
        if (dataMap.has(week)) {
            filledData.push(dataMap.get(week));
        } else {
            // Find the closest data points for interpolation
            const beforeData = weeklyData.filter(d => d.yearWeek < week).slice(-1)[0];
            const afterData = weeklyData.filter(d => d.yearWeek > week)[0];
            
            let interpolatedValue = 0;
            
            if (beforeData && afterData) {
                // Linear interpolation between two known points
                const beforeTime = new Date(beforeData.originalTimestamp);
                const afterTime = new Date(afterData.originalTimestamp);
                const [currentYear, currentWeek] = week.split('-').map(Number);
                const currentTime = new Date(currentYear, 0, 1 + (currentWeek - 1) * 7);
                
                const ratio = (currentTime - beforeTime) / (afterTime - beforeTime);
                interpolatedValue = Math.round(beforeData.value + (afterData.value - beforeData.value) * ratio);
            } else if (beforeData && week > lastDataWeek) {
                // For weeks after last data point, use the last known value (for active players)
                // If last value is 0 (retired), they'll naturally drop off the sorted list
                interpolatedValue = beforeData.value;
            }
            
            filledData.push({
                yearWeek: week,
                value: Math.max(0, interpolatedValue), // Ensure non-negative
                interpolated: true
            });
        }
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
    // Remove _market_value.json and convert underscores to spaces
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
        // Check if input directory exists
        const inputDirExists = await fs.access(INPUT_DIR).then(() => true).catch(() => false);
        if (!inputDirExists) {
            console.error(`[FATAL] Input directory does not exist: ${INPUT_DIR}`);
            return;
        }
        
        // Get all JSON files in the input directory
        const files = await fs.readdir(INPUT_DIR);
        const jsonFiles = files.filter(file => file.endsWith('_market_value.json'));
        
        if (jsonFiles.length === 0) {
            console.error(`[FATAL] No market value JSON files found in ${INPUT_DIR}`);
            return;
        }
        
        console.log(`[INFO] Found ${jsonFiles.length} player data files`);
        
        // Process each player's data
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
        
        // Find the overall date range
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
        
        // Generate all weeks in the range
        const allWeeks = generateWeekRange(earliestWeek, latestWeek);
        console.log(`[INFO] Total weeks to process: ${allWeeks.length}`);
        
        // Fill missing weeks for each player
        const processedPlayers = playersData.map(player => ({
            name: player.name,
            data: fillMissingWeeks(player.data, allWeeks)
        }));
        
        // Create bar racing format
        const barRacingData = allWeeks.map(week => {
            const weekData = [];
            
            // Only include players who have data for this week (i.e., they've appeared by this point)
            for (const player of processedPlayers) {
                const playerDataForWeek = player.data.find(d => d.yearWeek === week);
                if (playerDataForWeek) {
                    weekData.push({
                        name: player.name,
                        value: playerDataForWeek.value
                    });
                }
            }
            
            // Sort by value (descending) and take top 10
            weekData.sort((a, b) => b.value - a.value);
            const top10 = weekData.slice(0, 10);
            
            return {
                date: formatYear(week),
                data: top10
            };
        });
        
        // Save the result
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(barRacingData, null, 2));
        
        console.log(`[SUCCESS] Bar racing data saved to: ${OUTPUT_FILE}`);
        console.log(`[INFO] Generated ${barRacingData.length} monthly data points`);
        console.log(`[INFO] Each month contains top 10 players by market value`);
        
        // Print summary
        console.log('\n--- Processing Summary ---');
        console.log(`Total players processed: ${processedPlayers.length}`);
        
        // Show sample data for verification
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

// Run the script
main();