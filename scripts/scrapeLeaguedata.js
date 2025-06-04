import { scrapeMatchDayStats, scrapeMatchdayList } from '../helpers';
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
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    for (const league of leagues) {
        console.log(`Scraping matchday list for ${league.league}...`);

        // Get the matchday list for this league
        const matchDayList = await scrapeMatchdayList(league.seasonUrl);

        // Process each matchday
        for (const matchday of matchDayList) {
            console.log(`Scraping matchday data for ${league.league} - ${matchday.matchday}...`);
            const matchDayData = await scrapeMatchDayStats(matchday.matchdayUrl);

            // Organize data by date
            const organizedData = {};
            matchDayData.forEach(match => {
                const date = match.date;
                if (!organizedData[date]) {
                    organizedData[date] = [];
                }
                organizedData[date].push(match);
            });

            // Save data to file
            const leagueName = league.league.replace(/[^a-z0-9]/gi, '_'); // Sanitize league name for filename
            const matchdayName = matchday.matchday.replace(/[^a-z0-9]/gi, '_'); // Sanitize matchday name
            const filename = `${leagueName}_${matchdayName}.json`;
            const filepath = path.join(__dirname, 'data', filename); // Assuming a 'data' directory

            // Ensure the 'data' directory exists


            fs.writeFileSync(filepath, JSON.stringify(organizedData, null, 2));

            console.log(`Data for ${league.league} - ${matchday.matchday} saved to ${filepath}`);
        }
    }
}

scrapeLeagueData().catch(console.error);