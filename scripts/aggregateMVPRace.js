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
 * Converts timestamp to YYYY-MM format
 */
const timestampToMonthYear = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

/**
 * Converts YYYY-MM to readable "Month Year" format
 */
const formatMonthYear = (yearMonth) => {
    const [year, month] = yearMonth.split('-');
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
};

/**
 * Generates all months between start and end dates (inclusive)
 */
const generateMonthRange = (startYearMonth, endYearMonth) => {
    const months = [];
    const [startYear, startMonth] = startYearMonth.split('-').map(Number);
    const [endYear, endMonth] = endYearMonth.split('-').map(Number);
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        months.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
        
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }
    
    return months;
};

/**
 * Interpolates market value data to monthly granularity
 */
const interpolateMonthlyData = (dataPoints, playerName) => {
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
    
    // Convert to monthly data with parsed values
    const monthlyData = filteredData.map(point => ({
        yearMonth: timestampToMonthYear(point.x),
        value: parseMarketValue(point.mw),
        originalTimestamp: point.x,
        club: point.verein,
        age: point.age
    }));
    
    // Sort by yearMonth
    monthlyData.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    return monthlyData;
};

/**
 * Fills missing months with interpolated values
 * Only interpolates between existing data points, doesn't extrapolate backwards
 */
const fillMissingMonths = (monthlyData, allMonths) => {
    if (!monthlyData || monthlyData.length === 0) {
        return [];
    }
    
    const filledData = [];
    const dataMap = new Map(monthlyData.map(d => [d.yearMonth, d]));
    
    // Get player's first and last data points
    const firstDataMonth = monthlyData[0].yearMonth;
    const lastDataMonth = monthlyData[monthlyData.length - 1].yearMonth;
    
    for (const month of allMonths) {
        // Skip months before player's first appearance
        if (month < firstDataMonth) {
            continue;
        }
        
        if (dataMap.has(month)) {
            filledData.push(dataMap.get(month));
        } else {
            // Find the closest data points for interpolation
            const beforeData = monthlyData.filter(d => d.yearMonth < month).slice(-1)[0];
            const afterData = monthlyData.filter(d => d.yearMonth > month)[0];
            
            let interpolatedValue = 0;
            
            if (beforeData && afterData) {
                // Linear interpolation between two known points
                const beforeTime = new Date(beforeData.yearMonth + '-01').getTime();
                const afterTime = new Date(afterData.yearMonth + '-01').getTime();
                const currentTime = new Date(month + '-01').getTime();
                
                const ratio = (currentTime - beforeTime) / (afterTime - beforeTime);
                interpolatedValue = Math.round(beforeData.value + (afterData.value - beforeData.value) * ratio);
            } else if (beforeData && month > lastDataMonth) {
                // For months after last data point, use the last known value (for active players)
                // If last value is 0 (retired), they'll naturally drop off the sorted list
                interpolatedValue = beforeData.value;
            }
            
            filledData.push({
                yearMonth: month,
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
        
        const monthlyData = interpolateMonthlyData(data.list, playerName);
        
        return {
            name: playerName,
            rawDataPoints: data.list.length,
            monthlyDataPoints: monthlyData.length,
            data: monthlyData
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
        let earliestMonth = null;
        let latestMonth = null;
        
        for (const player of playersData) {
            for (const dataPoint of player.data) {
                if (!earliestMonth || dataPoint.yearMonth < earliestMonth) {
                    earliestMonth = dataPoint.yearMonth;
                }
                if (!latestMonth || dataPoint.yearMonth > latestMonth) {
                    latestMonth = dataPoint.yearMonth;
                }
            }
        }
        
        console.log(`[INFO] Date range: ${earliestMonth} to ${latestMonth}`);
        
        // Generate all months in the range
        const allMonths = generateMonthRange(earliestMonth, latestMonth);
        console.log(`[INFO] Total months to process: ${allMonths.length}`);
        
        // Fill missing months for each player
        const processedPlayers = playersData.map(player => ({
            name: player.name,
            data: fillMissingMonths(player.data, allMonths)
        }));
        
        // Create bar racing format
        const barRacingData = allMonths.map(month => {
            const monthData = [];
            
            // Only include players who have data for this month (i.e., they've appeared by this point)
            for (const player of processedPlayers) {
                const playerDataForMonth = player.data.find(d => d.yearMonth === month);
                if (playerDataForMonth) {
                    monthData.push({
                        name: player.name,
                        value: playerDataForMonth.value
                    });
                }
            }
            
            // Sort by value (descending) and take top 10
            monthData.sort((a, b) => b.value - a.value);
            const top10 = monthData.slice(0, 10);
            
            return {
                date: formatMonthYear(month),
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
        console.log(`Date range: ${formatMonthYear(earliestMonth)} to ${formatMonthYear(latestMonth)}`);
        console.log(`Total months: ${allMonths.length}`);
        
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