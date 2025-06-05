const { scrapeMatchdayStats, scrapeMatchList, RateLimiter } = require('../helpers/index.js');
const fs = require('fs');
const path = require('path');

// Create rate limiter instance
const rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

const leagues = [
    // {
    //     league: "Premier League",
    //     seasonUrl: "https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures"
    // },
    // {
    //     league: "La Liga",
    //     seasonUrl: "https://fbref.com/en/comps/12/schedule/La-Liga-Scores-and-Fixtures"
    // },
    // {
    //     league: "Bundesliga",
    //     seasonUrl: "https://fbref.com/en/comps/20/schedule/Bundesliga-Scores-and-Fixtures"
    // },
    // {
    //     league: "Serie A",
    //     seasonUrl: "https://fbref.com/en/comps/11/schedule/Serie-A-Scores-and-Fixtures"
    // },
    // {
    //     league: "Ligue 1",
    //     seasonUrl: "https://fbref.com/en/comps/13/schedule/Ligue-1-Scores-and-Fixtures"
    // },
    // {
    //     "league": "Saudi",
    //     "seasonUrl": "https://fbref.com/en/comps/70/schedule/Saudi-Professional-League-Scores-and-Fixtures"
    // }
    {
        "league": "Liga Nos",
        "seasonUrl": "https://fbref.com/en/comps/32/schedule/Liga-Portugal-Scores-and-Fixtures"
    }
];

async function scrapeLeagueData() {
    const dataDir = path.join(__dirname, 'data');
    // Ensure the 'data' directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Starting scrape with optimized rate limiting: max 10 requests per minute');
    console.log('Rate limiter now accounts for actual request duration');

    for (const league of leagues) {
        console.log(`\n=== Scraping ${league.league} ===`);

        // Use the new executeWithRateLimit method that accounts for request duration
        console.log(`Scraping matchday list for ${league.league}...`);
        const matchDayList = await rateLimiter.executeWithRateLimit(async () => {
            return await scrapeMatchList(league.seasonUrl);
        });

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