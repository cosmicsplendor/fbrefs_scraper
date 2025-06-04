import { scrapeMatchDayStats, scrapeMatchList } from '../helpers';
import fs from 'fs';
import path from 'path';

const leagues = [
    {
        league: "Premier League",
        seasonUrl: "https://fbref.com/en/comps/9/Premier-League-Stats"
    },
    {
        league: "La Liga",
        seasonUrl: "https://fbref.com/en/comps/12/La-Liga-Stats"
    },
    {
        league: "Bundesliga",
        seasonUrl: "https://fbref.com/en/comps/20/Bundesliga-Stats"
    },
    {
        league: "Serie A",
        seasonUrl: "https://fbref.com/en/comps/11/Serie-A-Stats"
    },
    {
        league: "Ligue 1",
        seasonUrl: "https://fbref.com/en/comps/13/Ligue-1-Stats"
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

        // Initialize an object to hold all data for this league, aggregated by gameweek
        const leagueData = {};

        // Process each matchday entry from the list
        for (const matchday of matchDayList) {
            // Log using gameweek for clarity, though scraping by URL
            console.log(`Scraping matchday stats for ${league.league}, Gameweek ${matchday.gameweek} (${matchday.date})...`);

            // Scrape the stats for this specific matchday URL
            const matchDayStats = await scrapeMatchDayStats(matchday.matchdayUrl);

            // Get the gameweek number
            const gameweek = matchday.gameweek;

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