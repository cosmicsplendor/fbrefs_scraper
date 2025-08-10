const fs = require('fs').promises;
const path = require('path');

// --- FILE PATHS ---
const COUNTRY_DICT_PATH = path.join(__dirname, 'countryDict.tsv');
const GRAPH_DATA_PATH = path.join(__dirname, 'graphData.tsv');
const OUTPUT_JSON_PATH = path.join(__dirname, 'output.json');

/**
 * Parses the country dictionary TSV into a Map for easy lookup.
 */
async function parseCountryDict(filePath) {
    console.log('Parsing country dictionary...');
    const countryMap = new Map();
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const lines = fileContent.split('\n');

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            const columns = line.split('\t').map(col => col.trim()).filter(Boolean);
            if (columns.length >= 2) {
                const primaryCode = columns[0];
                const primaryName = columns[1];
                countryMap.set(primaryCode, primaryName);
                // Map all other codes/aliases on the line to the primary name
                for (const code of columns) {
                    if (code.length === 2 && !countryMap.has(code)) {
                         countryMap.set(code, primaryName);
                    }
                }
            }
        }

        // Manually add common historical/non-standard codes that might be missing
        const manualCodes = {
            'SQ': 'Scotland', 'WA': 'Wales', 'IE': 'Ireland', 'EN': 'England',
            'DD': 'East Germany', 'SU': 'Soviet Union', 'YU': 'Yugoslavia', 'CS': 'Czechoslovakia',
            'HA': 'Bohemia', 'DY': 'South Yemen', 'DN': 'North Yemen', 'ZR': 'Zaire',
            'RH': 'Rhodesia', 'BU': 'Burma', 'AN': 'Netherlands Antilles'
        };
        for(const [code, name] of Object.entries(manualCodes)) {
            if (!countryMap.has(code)) countryMap.set(code, name);
        }

        console.log(`Country dictionary parsed. Found ${countryMap.size} entries.`);
        return countryMap;
    } catch (error) {
        console.error(`Error reading or parsing country dictionary at ${filePath}:`, error);
        throw new Error('Could not process country dictionary. Halting.');
    }
}

/**
 * Iteratively parses a string containing multiple match/event segments.
 */
function parseMatchSegments(segmentString, date, eventId, countryMap, parsedData) {
    const getName = (code) => countryMap.get(code) || `Unknown (${code})`;
    let cursor = 0;

    while (cursor < segmentString.length) {
        let remainingSegment = segmentString.substring(cursor);
        let matchFound = false;
        
        // Pattern 1: Simple match (most common pattern, check first) e.g., ENSQ11 or USHT6
        let simpleMatch = remainingSegment.match(/^([A-Z]{2})([A-Z]{2})(\d+)/);
        if (simpleMatch) {
            parsedData.push({
                type: 'match', date, eventId,
                team1: { code: simpleMatch[1], name: getName(simpleMatch[1]) },
                team2: { code: simpleMatch[2], name: getName(simpleMatch[2]) },
                score: parseInt(simpleMatch[3])
            });
            cursor += simpleMatch[0].length;
            matchFound = true;
        }

        // Pattern 2: Full match with initial Elo e.g., SQ2000EN2000ENSQ3
        if (!matchFound) {
            let fullEloMatch = remainingSegment.match(/^([A-Z]{2})(\d{4})([A-Z]{2})(\d{4})([A-Z]{2})([A-Z]{2})(\d+)/);
            if (fullEloMatch) {
                parsedData.push({
                    type: 'match_with_elo', date, eventId,
                    team1: { code: fullEloMatch[1], name: getName(fullEloMatch[1]), initialElo: parseInt(fullEloMatch[2]) },
                    team2: { code: fullEloMatch[3], name: getName(fullEloMatch[3]), initialElo: parseInt(fullEloMatch[4]) },
                    result: { teams: [getName(fullEloMatch[5]), getName(fullEloMatch[6])], score: parseInt(fullEloMatch[7]) }
                });
                cursor += fullEloMatch[0].length;
                matchFound = true;
            }
        }

        // Pattern 3: Team Elo Initialization e.g., WA1500
        if (!matchFound) {
            let teamEloMatch = remainingSegment.match(/^([A-Z]{2})(\d{4})/);
            if (teamEloMatch) {
                parsedData.push({
                    type: 'team_elo_initialization', date, eventId,
                    team: { code: teamEloMatch[1], name: getName(teamEloMatch[1]), initialElo: parseInt(teamEloMatch[2]) }
                });
                cursor += teamEloMatch[0].length;
                matchFound = true;
            }
        }

        if (!matchFound) {
            // Add a check for single-digit scores which might have been missed
            let singleDigitScoreMatch = remainingSegment.match(/^([A-Z]{2})([A-Z]{2})(\d)/);
            if(singleDigitScoreMatch){
                parsedData.push({
                    type: 'match', date, eventId,
                    team1: { code: singleDigitScoreMatch[1], name: getName(singleDigitScoreMatch[1]) },
                    team2: { code: singleDigitScoreMatch[2], name: getName(singleDigitScoreMatch[2]) },
                    score: parseInt(singleDigitScoreMatch[3])
                });
                cursor += singleDigitScoreMatch[0].length;
                matchFound = true;
            } else {
                 console.warn(`Unparsable segment. Date: ${date}, EventID: ${eventId}, Remainder: "${remainingSegment}"`);
                 break; // Break to avoid an infinite loop
            }
        }
    }
}


/**
 * The main parser for the cryptic elo graph data.
 */
async function parseGraphData(filePath, countryMap) {
    console.log('Parsing graph data...');
    const parsedData = [];
    let currentDate = null;

    const fileContent = await fs.readFile(filePath, 'utf8');
    const lines = fileContent.split('\n');

    for (let line of lines) {
        // THIS IS THE CRITICAL FIX: Trim each line before processing
        line = line.trim();
        if (!line) continue;

        const dateLineMatch = line.match(/^(\d{8})(.*)$/);
        const continuationMatch = line.match(/^(\d+)(.*)$/);

        if (dateLineMatch) {
            const dateStr = dateLineMatch[1];
            currentDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
            const restOfLine = dateLineMatch[2];
            parseMatchSegments(restOfLine, currentDate, null, countryMap, parsedData);

        } else if (continuationMatch) {
            const eventId = parseInt(continuationMatch[1]);
            const restOfLine = continuationMatch[2];
            parseMatchSegments(restOfLine, currentDate, eventId, countryMap, parsedData);
        } else {
            console.warn(`Unparsable line format (not a date line, not a continuation line): "${line}"`);
        }
    }
    console.log(`Graph data parsed. Generated ${parsedData.length} records.`);
    return parsedData;
}

/**
 * Main execution function
 */
async function main() {
    try {
        const countryMap = await parseCountryDict(COUNTRY_DICT_PATH);
        const jsonData = await parseGraphData(GRAPH_DATA_PATH, countryMap);

        if (jsonData.length === 0) {
            console.error('\n❌ Error: The final result is empty. Check the input files and parsing logic.');
            return;
        }

        console.log(`\nWriting ${jsonData.length} records to ${OUTPUT_JSON_PATH}...`);
        await fs.writeFile(OUTPUT_JSON_PATH, JSON.stringify(jsonData, null, 2));
        console.log('✅ Success! JSON file created.');

    } catch (error) {
        console.error('\n❌ An error occurred during the process:', error.message);
    }
}

// Run the script
main();