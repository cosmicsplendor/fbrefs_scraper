const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_DIR = path.join('scripts', 'market_value_data');
const OUTPUT_FILE = path.join('scripts', 'bar_racing_data.json');

// NEW: Choose granularity - 'year', 'month', or 'week'
const GRANULARITY = 'week'; // Change this to 'year', 'month', or 'week'

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
 * Converts timestamp to different formats based on granularity
 */
const timestampToFormat = (timestamp, granularity) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    
    switch (granularity) {
        case 'year':
            return year.toString();
        
        case 'month':
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}`;
        
        case 'week':
            const startOfYear = new Date(year, 0, 1);
            const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
            const weekNumber = Math.ceil(dayOfYear / 7);
            return `${year}-${String(weekNumber).padStart(2, '0')}`;
        
        default:
            throw new Error(`Invalid granularity: ${granularity}`);
    }
};

/**
 * Formats the period for display
 */
const formatPeriod = (period, granularity) => {
    switch (granularity) {
        case 'year':
            return period;
        
        case 'month':
            const [year, month] = period.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        
        case 'week':
            const [weekYear] = period.split('-');
            return weekYear; // For weeks, we'll just show the year to avoid clutter
        
        default:
            return period;
    }
};

/**
 * Generates all periods between start and end (inclusive)
 */
const generatePeriodRange = (startPeriod, endPeriod, granularity) => {
    const periods = [];
    
    switch (granularity) {
        case 'year':
            const startYear = parseInt(startPeriod);
            const endYear = parseInt(endPeriod);
            for (let year = startYear; year <= endYear; year++) {
                periods.push(year.toString());
            }
            break;
        
        case 'month':
            const [startY, startM] = startPeriod.split('-').map(Number);
            const [endY, endM] = endPeriod.split('-').map(Number);
            let currentYear = startY;
            let currentMonth = startM;
            
            while (currentYear < endY || (currentYear === endY && currentMonth <= endM)) {
                periods.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
            }
            break;
        
        case 'week':
            const [startWY, startWW] = startPeriod.split('-').map(Number);
            const [endWY, endWW] = endPeriod.split('-').map(Number);
            let currentWYear = startWY;
            let currentWeek = startWW;
            
            while (currentWYear < endWY || (currentWYear === endWY && currentWeek <= endWW)) {
                periods.push(`${currentWYear}-${String(currentWeek).padStart(2, '0')}`);
                currentWeek++;
                const weeksInYear = new Date(currentWYear, 11, 31).getDay() === 4 || 
                                  new Date(currentWYear - 1, 11, 31).getDay() === 3 ? 53 : 52;
                if (currentWeek > weeksInYear) {
                    currentWeek = 1;
                    currentWYear++;
                }
            }
            break;
        
        default:
            throw new Error(`Invalid granularity: ${granularity}`);
    }
    
    return periods;
};

/**
 * Interpolates market value data to specified granularity
 */
const interpolateData = (dataPoints, playerName, granularity) => {
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
    
    const periodData = filteredData.map(point => ({
        period: timestampToFormat(point.x, granularity),
        value: parseMarketValue(point.mw),
        originalTimestamp: point.x,
        club: point.verein,
        age: point.age
    }));
    
    periodData.sort((a, b) => a.period.localeCompare(b.period));
    return periodData;
};

/**
 * Fills missing periods with interpolated values
 */
const fillMissingPeriods = (periodData, allPeriods) => {
    if (!periodData || periodData.length === 0) {
        return [];
    }

    const filledData = [];
    const dataMap = new Map(periodData.map(d => [d.period, d]));
    let lastKnownPoint = null;

    for (const period of allPeriods) {
        if (dataMap.has(period)) {
            const currentPoint = dataMap.get(period);
            filledData.push(currentPoint);
            lastKnownPoint = currentPoint;
            continue;
        }

        if (!lastKnownPoint) {
            continue;
        }

        const nextPoint = periodData.find(d => d.period > period);
        let interpolatedValue = lastKnownPoint.value;

        if (nextPoint) {
            const beforeTime = new Date(lastKnownPoint.originalTimestamp);
            const afterTime = new Date(nextPoint.originalTimestamp);
            
            // Create approximate timestamp for current period
            let currentTime;
            if (GRANULARITY === 'year') {
                currentTime = new Date(parseInt(period), 0, 1);
            } else if (GRANULARITY === 'month') {
                const [year, month] = period.split('-').map(Number);
                currentTime = new Date(year, month - 1, 1);
            } else { // week
                const [year, week] = period.split('-').map(Number);
                currentTime = new Date(year, 0, 1 + (week - 1) * 7);
            }

            if (afterTime > beforeTime) {
                const ratio = (currentTime - beforeTime) / (afterTime - beforeTime);
                interpolatedValue = Math.round(lastKnownPoint.value + (nextPoint.value - lastKnownPoint.value) * ratio);
            }
        }
        
        filledData.push({
            period: period,
            value: Math.max(0, interpolatedValue),
            interpolated: true,
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
        const periodData = interpolateData(data.list, playerName, GRANULARITY);
        return {
            name: playerName,
            rawDataPoints: data.list.length,
            periodDataPoints: periodData.length,
            data: periodData
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
    console.log(`[INFO] Using granularity: ${GRANULARITY.toUpperCase()}`);
    
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
        
        let earliestPeriod = null;
        let latestPeriod = null;
        for (const player of playersData) {
            for (const dataPoint of player.data) {
                if (!earliestPeriod || dataPoint.period < earliestPeriod) {
                    earliestPeriod = dataPoint.period;
                }
                if (!latestPeriod || dataPoint.period > latestPeriod) {
                    latestPeriod = dataPoint.period;
                }
            }
        }
        
        console.log(`[INFO] Date range: ${earliestPeriod} to ${latestPeriod}`);
        
        const allPeriods = generatePeriodRange(earliestPeriod, latestPeriod, GRANULARITY);
        console.log(`[INFO] Total ${GRANULARITY}s to process: ${allPeriods.length}`);
        
        const processedPlayers = playersData.map(player => ({
            name: player.name,
            data: fillMissingPeriods(player.data, allPeriods)
        }));
        
        // Create bar racing format
        const barRacingData = allPeriods.map(period => {
            const periodData = [];
            for (const player of processedPlayers) {
                const playerDataForPeriod = player.data.find(d => d.period === period);
                if (playerDataForPeriod) {
                    periodData.push({
                        name: player.name,
                        value: playerDataForPeriod.value,
                        club: playerDataForPeriod.club
                    });
                }
            }
            periodData.sort((a, b) => b.value - a.value);
            const top10 = periodData.slice(0, 10);
            return {
                date: formatPeriod(period, GRANULARITY),
                data: top10
            };
        });

        // Update the output filename to include granularity
        const outputFile = OUTPUT_FILE.replace('.json', `_${GRANULARITY}.json`);
        await fs.writeFile(outputFile, JSON.stringify(barRacingData, null, 2));
        
        console.log(`[SUCCESS] Bar racing data saved to: ${outputFile}`);
        console.log(`[INFO] Generated ${barRacingData.length} ${GRANULARITY}ly data points`);
        console.log(`[INFO] Each ${GRANULARITY} contains top 10 players by market value`);
        
        console.log('\n--- Processing Summary ---');
        console.log(`Granularity: ${GRANULARITY.toUpperCase()}`);
        console.log(`Total players processed: ${processedPlayers.length}`);
        console.log(`Total ${GRANULARITY}s: ${barRacingData.length}`);
        
        if (barRacingData.length > 0) {
            console.log(`\n--- Sample Data (First ${GRANULARITY}) ---`);
            console.log(JSON.stringify(barRacingData[0], null, 2));
            if (barRacingData.length > 1) {
                console.log(`\n--- Sample Data (Last ${GRANULARITY}) ---`);
                console.log(JSON.stringify(barRacingData[barRacingData.length - 1], null, 2));
            }
        }
        
    } catch (error) {
        console.error('[FATAL] Unexpected error:', error.message);
    }
};

main();