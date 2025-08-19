const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Configuration
const INPUT_FILE = 'worldcup_goals.csv'; // Change to your file path
const OUTPUT_FILE = 'goals_race_data.json';

// Country name normalization mapping
const COUNTRY_MAPPINGS = {
    'West Germany': 'Germany',
    'East Germany': 'Germany',
    'German DR': 'Germany',
    'Germany FR': 'Germany',
    'Soviet Union': 'Russia',
    'USSR': 'Russia',
    'Russian Federation': 'Russia',
    'Yugoslavia': 'Serbia', // Or could map to 'Yugoslavia (historical)'
    'Serbia and Montenegro': 'Serbia',
    'Czechoslovakia': 'Czech Republic', // Or could split/keep separate
    'Czech Republic': 'Czech Republic',
    'Czechia': 'Czech Republic'
};

// Data structures
const countryGoals = new Map(); // country -> Map(year -> goal_count)
const tournaments = new Map(); // tournament_name -> year

function processGoalsData() {
    return new Promise((resolve, reject) => {
        const results = [];
        
        fs.createReadStream(INPUT_FILE)
            .pipe(csv({
                // Handle potential BOM and encoding issues
                skipEmptyLines: true,
                skipLinesWithError: true
            }))
            .on('data', (row) => {
                try {
                    // Extract year from tournament name (e.g., "1930 FIFA World Cup" -> 1930)
                    const tournamentName = row.tournament_name?.trim();
                    const yearMatch = tournamentName?.match(/(\d{4})/);
                    
                    if (!yearMatch) return; // Skip if no year found
                    
                    const year = parseInt(yearMatch[1]);
                    let country = row.player_team_name?.trim();
                    
                    if (!country || !year) return; // Skip incomplete data
                    
                    // Normalize country names (combine historical variants)
                    country = COUNTRY_MAPPINGS[country] || country;
                    
                    // Store tournament year mapping
                    tournaments.set(tournamentName, year);
                    
                    // Initialize country if not exists
                    if (!countryGoals.has(country)) {
                        countryGoals.set(country, new Map());
                    }
                    
                    // Initialize year for country if not exists
                    const countryYearMap = countryGoals.get(country);
                    if (!countryYearMap.has(year)) {
                        countryYearMap.set(year, 0);
                    }
                    
                    // Increment goal count
                    countryYearMap.set(year, countryYearMap.get(year) + 1);
                    
                } catch (error) {
                    console.warn('Error processing row:', error.message);
                }
            })
            .on('end', () => {
                console.log('✅ CSV parsing complete');
                console.log(`📊 Found ${countryGoals.size} countries`);
                console.log(`📅 Tournaments: ${Array.from(tournaments.values()).sort().join(', ')}`);
                resolve();
            })
            .on('error', reject);
    });
}

function generateRaceData() {
    // Get all unique years and sort them
    const allYears = new Set();
    tournaments.forEach(year => allYears.add(year));
    const sortedYears = Array.from(allYears).sort((a, b) => a - b);
    
    console.log(`🏃 Generating race data for years: ${sortedYears.join(', ')}`);
    
    // Build cumulative data
    const raceData = [];
    const cumulativeGoals = new Map(); // country -> cumulative_goals
    
    // Initialize all countries with 0 goals
    countryGoals.forEach((_, country) => {
        cumulativeGoals.set(country, 0);
    });
    
    sortedYears.forEach(year => {
        // Add goals from this year to cumulative totals
        countryGoals.forEach((yearGoalMap, country) => {
            const goalsThisYear = yearGoalMap.get(year) || 0;
            const currentCumulative = cumulativeGoals.get(country) || 0;
            cumulativeGoals.set(country, currentCumulative + goalsThisYear);
        });
        
        // Create snapshot for this year
        const yearData = {
            date: year,
            data: Array.from(cumulativeGoals.entries())
                .map(([country, goals]) => ({
                    name: country,
                    value: goals
                }))
                .filter(item => item.value > 0) // Only include countries with goals
                .sort((a, b) => b.value - a.value) // Sort by goals desc
        };
        
        raceData.push(yearData);
        
        // Log progress
        const topCountry = yearData.data[0];
        console.log(`📈 ${year}: ${topCountry?.name} leads with ${topCountry?.value} goals (${yearData.data.length} countries)`);
    });
    
    return raceData;
}

function saveResults(raceData) {
    try {
        const jsonOutput = JSON.stringify(raceData, null, 2);
        fs.writeFileSync(OUTPUT_FILE, jsonOutput);
        
        console.log(`✅ Results saved to ${OUTPUT_FILE}`);
        console.log(`📁 File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
        
        // Display summary stats
        const finalYear = raceData[raceData.length - 1];
        console.log(`\n🏆 Final Rankings (${finalYear.date}):`);
        finalYear.data.slice(0, 10).forEach((country, index) => {
            console.log(`${index + 1}. ${country.name}: ${country.value} goals`);
        });
        
    } catch (error) {
        console.error('❌ Error saving file:', error.message);
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting World Cup Goals Bar Race Data Generator');
        console.log(`📂 Processing: ${INPUT_FILE}`);
        
        // Check if input file exists
        if (!fs.existsSync(INPUT_FILE)) {
            throw new Error(`Input file not found: ${INPUT_FILE}`);
        }
        
        // Process the CSV data
        await processGoalsData();
        
        // Generate race format data
        const raceData = generateRaceData();
        
        // Save to JSON
        saveResults(raceData);
        
        console.log('🎉 Processing complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { processGoalsData, generateRaceData };