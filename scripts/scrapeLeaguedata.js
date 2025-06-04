const { scrapeMatchDayStats, scrapeMatchList } = require('../helpers');
const fs = require('fs');
const path = require('path');

// Rate limiter class to ensure we don't exceed 10 requests per minute
class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) { // 10 requests per 60 seconds
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    async waitForSlot() {
        const now = Date.now();
        
        // Remove requests older than the time window
        this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindow);
        
        // If we're at the limit, wait until we can make another request
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest) + 100; // Add 100ms buffer
            
            console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds before next request...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Clean up again after waiting
            const newNow = Date.now();
            this.requests = this.requests.filter(timestamp => newNow - timestamp < this.timeWindow);
        }
        
        // Record this request
        this.requests.push(Date.now());
        
        // Add a small delay between requests for good measure (6+ seconds between requests)
        const minDelay = Math.ceil(this.timeWindow / this.maxRequests) + 500; // ~6.5 seconds
        console.log(`Waiting ${minDelay}ms before making request...`);
        await new Promise(resolve => setTimeout(resolve, minDelay));
    }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

const leagues = [
    {
        league: "Premier League",
        seasonUrl: "https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures"
    },
    {
        league: "La Liga",
        seasonUrl: "https://fbref.com/en/comps/12/schedule/La-Liga-Scores-and-Fixtures"
    },
    {
        league: "Bundesliga",
        seasonUrl: "https://fbref.com/en/comps/20/schedule/Bundesliga-Scores-and-Fixtures"
    },
    {
        league: "Serie A",
        seasonUrl: "https://fbref.com/en/comps/11/schedule/Serie-A-Scores-and-Fixtures"
    },
    {
        league: "Ligue 1",
        seasonUrl: "https://fbref.com/en/comps/13/schedule/Ligue-1-Scores-and-Fixtures"
    }
];

async function scrapeLeagueData() {
    const dataDir = path.join(__dirname, 'data');
    // Ensure the 'data' directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Starting scrape with rate limiting: max 10 requests per minute');
    console.log('Expected minimum time between requests: ~6.5 seconds');

    for (const league of leagues) {
        console.log(`\n=== Scraping ${league.league} ===`);

        // Wait for rate limiter before making league request
        await rateLimiter.waitForSlot();
        console.log(`Scraping matchday list for ${league.league}...`);

        // Get the matchday list for this league (this list covers the whole season)
        const matchDayList = await scrapeMatchList(league.seasonUrl);

        // Check if we got any matches
        if (matchDayList.length === 0) {
            console.log(`No matches found for ${league.league}`);
            continue;
        }

        console.log(`Found ${matchDayList.length} match entries for ${league.league}`);

        // Initialize an object to hold all data for this league, aggregated by gameweek
        const leagueData = {};

        // Process each matchday entry from the list
        for (let i = 0; i < matchDayList.length; i++) {
            const matchday = matchDayList[i];
            
            // Handle flexible property names from scrapeMatchList
            const gameweek = matchday.gameweek || matchday.round || 'Unknown';
            const date = matchday.date || 'Unknown';
            const matchUrl = matchday.matchdayUrl || matchday.url;

            console.log(`\nProcessing matchday ${i + 1}/${matchDayList.length}: ${league.league}, Gameweek ${gameweek} (${date})`);

            // Skip if no URL available
            if (!matchUrl) {
                console.log(`No URL found for matchday entry, skipping...`);
                continue;
            }

            // Wait for rate limiter before making matchday request
            await rateLimiter.waitForSlot();
            console.log(`Scraping matchday stats...`);

            // Scrape the stats for this specific matchday URL
            const matchDayStats = await scrapeMatchDayStats(matchUrl);

            // Aggregate data by gameweek
            if (!leagueData[gameweek]) {
                leagueData[gameweek] = [];
            }
            // Append all stats from this matchday to the corresponding gameweek array
            leagueData[gameweek].push(...matchDayStats); // Use spread syntax to push individual match objects

            console.log(`✓ Aggregated ${matchDayStats.length} matches for Gameweek ${gameweek}. Total for gameweek: ${leagueData[gameweek].length}`);
        }

        // After processing all matchdays for the league, save the aggregated data
        const leagueName = league.league.replace(/[^a-z0-9]/gi, '_'); // Sanitize league name for filename
        const filename = `${leagueName}.json`; // Filename is just the league name
        const filepath = path.join(dataDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(leagueData, null, 2));

        console.log(`\n✓ All data for ${league.league} (aggregated by gameweek) saved to ${filepath}`);
        console.log(`Total gameweeks processed: ${Object.keys(leagueData).length}`);
        console.log('=====================================');
    }

    console.log('\n🎉 All leagues processed successfully!');
}

// Add error handling and graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Scraping interrupted by user. Exiting gracefully...');
    process.exit(0);
});

scrapeLeagueData().catch(error => {
    console.error('❌ Error during scraping:', error);
    process.exit(1);
});