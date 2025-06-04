const { scrapeMatchDayStats, scrapeMatchList } = require('../helpers');
const fs = require('fs');
const path = require('path');

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

    for (const league of leagues) {
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
        for (const matchday of matchDayList) {
            // Handle flexible property names from scrapeMatchList
            const gameweek = matchday.gameweek || matchday.round || 'Unknown';
            const date = matchday.date || 'Unknown';
            const matchUrl = matchday.matchdayUrl || matchday.url;

            // Log using gameweek for clarity, though scraping by URL
            console.log(`Scraping matchday stats for ${league.league}, Gameweek ${gameweek} (${date})...`);

            // Skip if no URL available
            if (!matchUrl) {
                console.log(`No URL found for matchday entry, skipping...`);
                continue;
            }

            // Scrape the stats for this specific matchday URL
            const matchDayStats = await scrapeMatchDayStats(matchUrl);

            // Aggregate data by gameweek
            if (!leagueData[gameweek]) {
                leagueData[gameweek] = [];
            }
            // Append all stats from this matchday to the corresponding gameweek array
            leagueData[gameweek].push(...matchDayStats); // Use spread syntax to push individual match objects

            console.log(`Aggregated ${matchDayStats.length} matches for Gameweek ${gameweek}. Total for gameweek ${gameweek}: ${leagueData[gameweek].length}`);
        }

        // After processing all matchdays for the league, save the aggregated data
        const leagueName = league.league.replace(/[^a-z0-9]/gi, '_'); // Sanitize league name for filename
        const filename = `${leagueName}.json`; // Filename is just the league name
        const filepath = path.join(dataDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(leagueData, null, 2));

        console.log(`All data for ${league.league} (aggregated by gameweek) saved to ${filepath}`);
        console.log('---'); // Separator for the next league
    }
}

scrapeLeagueData().catch(console.error);