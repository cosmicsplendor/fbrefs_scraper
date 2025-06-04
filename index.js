const { scrapeMatchDayList } = require("./helpers");


const testUrl = 'https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures';

async function runScrape() {
    try {
        const matchStats = await scrapeMatchDayList(testUrl);
        console.log("\n--- Final Scraped Data ---");
        console.log(`Total player entries found: ${matchStats.length}`);
        // console.log(JSON.stringify(matchStats, null, 2)); // Log the data nicely
         if (matchStats.length > 0) {
            console.log("First entry:", matchStats[0]);
            console.log("Last entry:", matchStats[matchStats.length - 1]);
        }

    } catch (error) {
        console.error("\n--- Scraping Failed ---");
        console.error(error);
    }
}

// Execute the example usage
runScrape();