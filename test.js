const { scrapeMatchList, scrapeMatchdayStats } = require("./helpers");
const path = require("path")
const urls = [
    // ronaldo
    "https://fbref.com/en/squads/6baef27f/2023-2024/matchlogs/c70/schedule/Al-Nassr-Scores-and-Fixtures-Saudi-Professional-League",
    "https://fbref.com/en/squads/6baef27f/2024-2025/matchlogs/c70/schedule/Al-Nassr-Scores-and-Fixtures-Saudi-Professional-League",
    // messi
    "https://fbref.com/en/squads/cb8b86a2/2025/matchlogs/c22/schedule/Inter-Miami-Scores-and-Fixtures-Major-League-Soccer",
    "https://fbref.com/en/squads/cb8b86a2/2024/matchlogs/c22/schedule/Inter-Miami-Scores-and-Fixtures-Major-League-Soccer"
]
Promise.all(urls.map(url => scrapeMatchList(url, "matchlogs_for")))
    .then(async data => {
        const matchDayList = data.flat()
        const leagueData = {}
        // Process each matchday entry from the list
        for (let i = 0; i < matchDayList.length; i++) {
            const matchday = matchDayList[i];

            // Handle flexible property names from scrapeMatchList
            const gameweek = i + 1;
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
        const dataDir = path.join(__dirname, 'data');
        const filepath = path.join(dataDir, "messi_vs_ronaldo.json");
        fs.writeFileSync(filepath, JSON.stringify(leagueData, null, 2));

        console.log(`\n✓ All data for ${league.league} (aggregated by gameweek) saved to ${filepath}`);
        console.log(`Total gameweeks processed: ${Object.keys(leagueData).length}`);
    })