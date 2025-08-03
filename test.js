const { scrapeMatchList, scrapeMatchdayStats } = require("./helpers");
const path = require("path");
const fs = require("fs");

// Simple rate limiter implementation
class RateLimiter {
    constructor(delayMs = 1000) {
        this.delayMs = delayMs;
        this.lastRequest = 0;
    }
    
    async executeWithRateLimit(fn) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        
        if (timeSinceLastRequest < this.delayMs) {
            await new Promise(resolve => setTimeout(resolve, this.delayMs - timeSinceLastRequest));
        }
        
        this.lastRequest = Date.now();
        return await fn();
    }
}

const rateLimiter = new RateLimiter(1000); // 1 second delay between requests

const urls = [
    // ronaldo
    "https://fbref.com/en/squads/6baef27f/2023-2024/matchlogs/c70/schedule/Al-Nassr-Scores-and-Fixtures-Saudi-Professional-League",
    "https://fbref.com/en/squads/6baef27f/2024-2025/matchlogs/c70/schedule/Al-Nassr-Scores-and-Fixtures-Saudi-Professional-League",
    // messi
    "https://fbref.com/en/squads/cb8b86a2/2025/matchlogs/c22/schedule/Inter-Miami-Scores-and-Fixtures-Major-League-Soccer",
    "https://fbref.com/en/squads/cb8b86a2/2024/matchlogs/c22/schedule/Inter-Miami-Scores-and-Fixtures-Major-League-Soccer"
];

Promise.all(urls.map(url => scrapeMatchList(url, "matchlogs_for")))
    .then(async data => {
        const matchDayList = data.flat();
        const leagueData = {};
        
        // Process each matchday entry from the list
        for (let i = 0; i < matchDayList.length; i++) {
            const matchday = matchDayList[i];

            // Handle flexible property names from scrapeMatchList
            const gameweek = i + 1;
            const date = matchday.date || 'Unknown';
            const matchUrl = matchday.matchdayUrl || matchday.url;

            console.log(`\nProcessing matchday ${i + 1}/${matchDayList.length}, Gameweek ${gameweek} (${date})`);

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
    })
    .catch(error => {
        console.error('Error in main process:', error);
    });