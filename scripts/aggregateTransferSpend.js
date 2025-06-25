const transferData = require("./data/transfers.js");

// Configuration
const CONFIG = {
    // Club filters - if present, overrides topN
    clubFilters: [
        // "Arsenal FC",
        // "Chelsea FC", 
        // "Liverpool FC",
        // "Manchester City",
        // "Manchester United",
        // "Tottenham Hotspur"
    ],
    
    // Top N clubs by spending (ignored if clubFilters is not empty)
    topN: 10,
    
    // Number of sub-intervals to split each window into
    striations: 12
};

/**
 * Parse fee string into numeric value in euros
 */
const parseFee = (feeString) => {
    if (!feeString || feeString === "-" || feeString === "Free transfer" || feeString === "End of loan") {
        return 0;
    }
    
    // Remove currency symbols and clean the string
    let cleanFee = feeString.replace(/[€$£,\s]/g, '');
    
    // Handle different suffixes
    const multipliers = {
        'k': 1000,
        'm': 1000000,
        'bn': 1000000000
    };
    
    // Extract number and suffix
    const match = cleanFee.match(/^(\d+\.?\d*)([kmbn]?)$/i);
    if (!match) return 0;
    
    const [, number, suffix] = match;
    const multiplier = multipliers[suffix.toLowerCase()] || 1;
    
    return parseFloat(number) * multiplier;
};

/**
 * Get all unique clubs from the data
 */
const getAllClubs = (data) => {
    const clubs = new Set();
    data.forEach(yearData => {
        ['summer', 'winter'].forEach(window => {
            if (yearData[window]) {
                yearData[window].forEach(clubData => {
                    clubs.add(clubData.club);
                });
            }
        });
    });
    return Array.from(clubs);
};

/**
 * Calculate total spending for each club across all seasons
 */
const calculateTotalSpending = (data) => {
    const clubSpending = {};
    
    data.forEach(yearData => {
        ['summer', 'winter'].forEach(window => {
            if (yearData[window]) {
                yearData[window].forEach(clubData => {
                    if (!clubSpending[clubData.club]) {
                        clubSpending[clubData.club] = 0;
                    }
                    
                    clubData.transfers
                        .filter(transfer => transfer.direction === "In")
                        .forEach(transfer => {
                            clubSpending[clubData.club] += parseFee(transfer.Fee);
                        });
                });
            }
        });
    });
    
    return clubSpending;
};

/**
 * Get relevant clubs based on filters or topN
 */
const getRelevantClubs = (data) => {
    if (CONFIG.clubFilters.length > 0) {
        return CONFIG.clubFilters;
    }
    
    const totalSpending = calculateTotalSpending(data);
    return Object.entries(totalSpending)
        .sort(([,a], [,b]) => b - a)
        .slice(0, CONFIG.topN)
        .map(([club]) => club);
};

/**
 * Process transfer data for aggregation
 */
const processTransferData = (data) => {
    const relevantClubs = getRelevantClubs(data);
    const result = [];
    
    // Track cumulative spending for each club
    const cumulativeSpending = {};
    relevantClubs.forEach(club => {
        cumulativeSpending[club] = 0;
    });
    
    // Process each season
    data.forEach(yearData => {
        const { season } = yearData;
        const windows = [];
        
        // Collect available windows
        if (yearData.summer) windows.push({ name: 'summer', data: yearData.summer });
        if (yearData.winter) windows.push({ name: 'winter', data: yearData.winter });
        
        // Skip if no windows available
        if (windows.length === 0) return;
        
        // Calculate spending for each window
        const windowSpending = {};
        relevantClubs.forEach(club => {
            windowSpending[club] = { summer: 0, winter: 0 };
        });
        
        windows.forEach(window => {
            window.data.forEach(clubData => {
                if (relevantClubs.includes(clubData.club)) {
                    const spending = clubData.transfers
                        .filter(transfer => transfer.direction === "In")
                        .reduce((sum, transfer) => sum + parseFee(transfer.Fee), 0);
                    
                    windowSpending[clubData.club][window.name] = spending;
                }
            });
        });
        
        // Generate striations for the year
        const totalStriations = windows.length * CONFIG.striations;
        
        for (let i = 0; i < totalStriations; i++) {
            // Determine which window and position within window
            const windowIndex = Math.floor(i / CONFIG.striations);
            const striationInWindow = i % CONFIG.striations;
            const progressInWindow = (striationInWindow + 1) / CONFIG.striations;
            
            if (windowIndex >= windows.length) continue;
            
            const currentWindow = windows[windowIndex].name;
            
            // Calculate interpolated spending
            const frameData = relevantClubs.map(club => {
                // Add spending proportionally based on progress in current window
                const windowSpendingAmount = windowSpending[club][currentWindow];
                const interpolatedSpending = windowSpendingAmount * progressInWindow;
                
                // Add any completed previous windows in this year
                let previousWindowsSpending = 0;
                if (windowIndex > 0) {
                    for (let j = 0; j < windowIndex; j++) {
                        const prevWindow = windows[j].name;
                        previousWindowsSpending += windowSpending[club][prevWindow];
                    }
                }
                
                const totalCurrentYearSpending = previousWindowsSpending + interpolatedSpending;
                const accumulatedValue = cumulativeSpending[club] + totalCurrentYearSpending;
                
                return {
                    name: club,
                    value: Math.round(accumulatedValue)
                };
            }).sort((a, b) => b.value - a.value);
            
            result.push({
                date: season.toString(),
                data: frameData
            });
        }
        
        // Update cumulative spending after processing the year
        relevantClubs.forEach(club => {
            const totalYearSpending = windowSpending[club].summer + windowSpending[club].winter;
            cumulativeSpending[club] += totalYearSpending;
        });
    });
    
    return result;
};

/**
 * Main function to run the aggregation
 */
const aggregateTransferData = () => {
    console.log('Starting transfer data aggregation...');
    console.log(`Club filters: ${CONFIG.clubFilters.length > 0 ? CONFIG.clubFilters.join(', ') : 'None (using top ' + CONFIG.topN + ')'}`);
    console.log(`Striations per window: ${CONFIG.striations}`);
    
    const aggregatedData = processTransferData(transferData);
    
    console.log(`Generated ${aggregatedData.length} data frames`);
    console.log(`Years covered: ${Math.min(...transferData.map(d => d.season))} - ${Math.max(...transferData.map(d => d.season))}`);
    
    // Save the result
    const fs = require('fs/promises');
    fs.writeFile('./aggregated_transfers.json', JSON.stringify(aggregatedData, null, 2))
        .then(() => console.log('Aggregated data saved to aggregated_transfers.json'))
        .catch(err => console.error('Error saving file:', err));
    
    return aggregatedData;
};

// Export for use in other modules
module.exports = {
    aggregateTransferData,
    CONFIG
};

// Run if called directly
if (require.main === module) {
    aggregateTransferData();
}