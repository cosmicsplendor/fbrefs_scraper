const transferData = require("./data/transfers.json");
const fs = require('fs/promises');

// --- CONFIGURATION ---
// This is the single source of truth for settings.
const CONFIG = {
    // To use topN, make sure this is an empty array: []
    clubFilters: [
        "Bayern Munich",
        "SV Werder Bremen",
        "Borussia Dortmund",
        "VfB Stuttgart",
        "Bayer 04 Leverkusen",
        "1.FC Kaiserslautern",
        "Hamburger SV",
        "FC Schalke 04",
        "Hertha BSC",
        "VfL Wolfsburg",
        "RB Leipzig"
    ],
    // Set the desired number of top clubs here.
    topN: 11,
    // Set the animation smoothness.
    striations: 12
};
// --------------------

/**
 * Parse fee string into a numeric value in euros.
 */
const parseFee = (feeString) => {
    if (!feeString || feeString === "-" || feeString === "Free transfer" || feeString === "End of loan") {
        return 0;
    }
    let cleanFee = feeString.replace(/[€$£,\s]/g, '');
    const multipliers = { 'k': 1000, 'm': 1000000, 'bn': 1000000000 };
    const match = cleanFee.match(/^(\d+\.?\d*)([kmbn]?)$/i);
    if (!match) return 0;
    const [, number, suffix] = match;
    const multiplier = multipliers[suffix.toLowerCase()] || 1;
    return parseFloat(number) * multiplier;
};

/**
 * Get a list of all unique clubs from the raw data.
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
 * Core processing engine.
 */
const processForGivenClubs = (data, clubList, config) => {
    const result = [];
    const cumulativeSpending = {};
    clubList.forEach(club => { cumulativeSpending[club] = 0; });

    data.forEach(yearData => {
        const { season } = yearData;
        const windows = [];
        if (yearData.summer) windows.push({ name: 'summer', data: yearData.summer });
        if (yearData.winter) windows.push({ name: 'winter', data: yearData.winter });
        if (windows.length === 0) return;

        const windowSpending = {};
        clubList.forEach(club => { windowSpending[club] = { summer: 0, winter: 0 }; });

        windows.forEach(window => {
            window.data.forEach(clubData => {
                if (clubList.includes(clubData.club)) {
                    const spending = clubData.transfers
                        .filter(transfer => transfer.direction === "In")
                        .reduce((sum, transfer) => sum + parseFee(transfer.Fee), 0);
                    windowSpending[clubData.club][window.name] = spending;
                }
            });
        });

        // --- START OF THE CORRECTED LOGIC ---
        // We iterate through each window explicitly.
        windows.forEach((window, windowIndex) => {
            // And then through the striations for THAT window.
            for (let striation = 0; striation < config.striations; striation++) {
                const progressInWindow = (striation + 1) / config.striations;

                const frameData = clubList.map(club => {
                    const windowSpendingAmount = windowSpending[club][window.name];
                    const interpolatedSpending = windowSpendingAmount * progressInWindow;

                    // Calculate spending from any PREVIOUS windows in the same season.
                    let previousWindowsSpending = 0;
                    for (let j = 0; j < windowIndex; j++) {
                        previousWindowsSpending += windowSpending[club][windows[j].name];
                    }

                    const totalCurrentYearSpending = previousWindowsSpending + interpolatedSpending;
                    const accumulatedValue = cumulativeSpending[club] + totalCurrentYearSpending;

                    return { name: club, value: Math.round(accumulatedValue) };
                }).sort((a, b) => b.value - a.value);

                result.push({ date: season.toString(), data: frameData });
            }
        });
        // --- END OF THE CORRECTED LOGIC ---

        clubList.forEach(club => {
            const totalYearSpending = windowSpending[club].summer + windowSpending[club].winter;
            cumulativeSpending[club] += totalYearSpending;
        });
    });
    return result;
};


/**
 * Main aggregator function.
 */
const processTransferData = (data, config) => {
    if (config.clubFilters.length > 0) {
        console.log("Processing with fixed club filters...");
        const clubData = processForGivenClubs(data, config.clubFilters, config);
        // Even with filters, we sort each frame, but don't slice.
        return clubData.map(frame => ({
            ...frame,
            data: frame.data.sort((a, b) => b.value - a.value)
        }));
    }

    // This is the TopN logic path.
    console.log(`Processing to find the top ${config.topN} clubs for each individual frame...`);
    const allClubs = getAllClubs(data);

    // Add a debug line to prove what the script is seeing.
    console.log(`[DEBUG] Found ${allClubs.length} unique clubs in the JSON file.`);

    const fullAggregatedData = processForGivenClubs(data, allClubs, config);

    const finalResult = fullAggregatedData.map(frame => {
        // Slice the already-sorted data array to the desired topN.
        const topNDataForThisFrame = frame.data.slice(0, config.topN);
        return {
            date: frame.date,
            data: topNDataForThisFrame
        };
    });
    return finalResult;
};

/**
 * Main function to run the aggregation.
 */
const aggregateTransferData = async () => {
    console.log('Starting transfer data aggregation...');
    console.log(`RUNNING WITH: Mode = ${CONFIG.clubFilters.length > 0 ? 'Filter' : 'TopN'}, TopN = ${CONFIG.topN}`);

    const aggregatedData = processTransferData(transferData, CONFIG);

    console.log(`Generated ${aggregatedData.length} data frames.`);

    // Add a check to inspect the first frame of the output.
    if (aggregatedData.length > 0) {
        console.log(`[DEBUG] The first data frame contains ${aggregatedData[0].data.length} clubs.`);
    }

    try {
        await fs.writeFile('./scripts/data/aggregated_transfers.json', JSON.stringify(aggregatedData, null, 2));
        console.log('Aggregated data saved successfully.');
    } catch (err) {
        console.error('Error saving file:', err);
    }
};

aggregateTransferData();