const { scrapeMatchList, scrapeMatchdayStats, RateLimiter } = require("./helpers");
const path = require("path");
const fs = require("fs");

const rateLimiter = new RateLimiter(10, 60000);

const urls = [
    // ronaldo
    "https://fbref.com/en/squads/6baef27f/2023-2024/matchlogs/c70/schedule/Al-Nassr-Scores-and-Fixtures-Saudi-Professional-League",
    "https://fbref.com/en/squads/6baef27f/2024-2025/matchlogs/c70/schedule/Al-Nassr-Scores-and-Fixtures-Saudi-Professional-League",
    // messi
    "https://fbref.com/en/squads/cb8b86a2/2024/matchlogs/c22/schedule/Inter-Miami-Scores-and-Fixtures-Major-League-Soccer",
    "https://fbref.com/en/squads/cb8b86a2/2025/matchlogs/c22/schedule/Inter-Miami-Scores-and-Fixtures-Major-League-Soccer",
];

async function processUrlsSerially() {
    const allMatchLists = [];
    
    // Process URLs one by one instead of Promise.all
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\nFetching match list ${i + 1}/${urls.length}...`);
        console.log(`URL: ${url}`);
        
        try {
            const matchList = await rateLimiter.executeWithRateLimit(async () => {
                return await scrapeMatchList(url, "matchlogs_for");
            });
            
            console.log(`✓ Retrieved ${matchList.length} matches from URL ${i + 1}`);
            allMatchLists.push(...matchList); // Flatten as we go
            
        } catch (error) {
            console.error(`Error fetching URL ${i + 1}:`, error.message);
            // Continue with next URL instead of failing entirely
        }
    }
    
    console.log(`\n✓ Total matches collected: ${allMatchLists.length}`);
    
    const leagueData = {};
    
    // Process each matchday entry from the list
    for (let i = 0; i < allMatchLists.length; i++) {
        const matchday = allMatchLists[i];

        // Handle flexible property names from scrapeMatchList
        const gameweek = i + 1;
        const date = matchday.date || 'Unknown';
        const matchUrl = matchday.matchdayUrl || matchday.url;

        console.log(`\nProcessing matchday ${i + 1}/${allMatchLists.length}, Gameweek ${gameweek} (${date})`);

        // Skip if no URL available
        if (!matchUrl) {
            console.log(`No URL found for matchday entry, skipping...`);
            continue;
        }

        try {
            // Use executeWithRateLimit to properly account for request duration
            console.log(`Scraping matchday stats...`);
            const matchDayStats = await rateLimiter.executeWithRateLimit(async () => {
                return await scrapeMatchdayStats(matchUrl);
            });

            // Aggregate data by gameweek
            if (!leagueData[gameweek]) {
                leagueData[gameweek] = [];
            }
            // Append all stats from this matchday to the corresponding gameweek array
            leagueData[gameweek].push(...matchDayStats);

            console.log(`✓ Aggregated ${matchDayStats.length} matches for Gameweek ${gameweek}. Total for gameweek: ${leagueData[gameweek].length}`);
        } catch (error) {
            console.error(`Error processing matchday ${i + 1}:`, error.message);
            // Continue with next matchday instead of crashing
        }
    }

    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filepath = path.join(dataDir, "messi_vs_ronaldo.json");
    fs.writeFileSync(filepath, JSON.stringify(leagueData, null, 2));

    console.log(`\n✓ All data aggregated by gameweek saved to ${filepath}`);
    console.log(`Total gameweeks processed: ${Object.keys(leagueData).length}`);
}

// Run the serial processing
processUrlsSerially().catch(error => {
    console.error('Error in main process:', error);
});