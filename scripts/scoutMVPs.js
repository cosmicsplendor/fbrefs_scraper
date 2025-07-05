// scout_topPlayers.js
// This script's purpose is to discover the URLs of the top players from the top 5 leagues
// for each season from 2004 to 2024. It saves the unique URLs to a JSON file.

const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require("fs/promises");

// --- Configuration ---
const BASE_URL = 'https://www.transfermarkt.com';
const SEASONS_TO_SCAN = range(2004, 2024); // Use helper to generate years
const PLAYERS_PER_CLUB_TO_SCOUT = 2;
const OUTPUT_FILE = './scoutedPlayers.json';

const leagueIdMap = {
    "premier-league": "GB1",
    "primera-division": "ES1", 
    "1-bundesliga": "L1",
    "serie-a": "IT1",
    "ligue-1": "FR1",
};
const LEAGUES_TO_SCAN = Object.keys(leagueIdMap);

// --- Helper Functions (from your pattern) ---
function range(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function wait(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// --- Modified/New Core Functions ---

/**
 * Generates the URL for a league's main page for a specific season.
 * This is our entry point for discovering clubs in that season.
 */
const generateLeagueUrl = (leagueName, season) => {
    return `${BASE_URL}/${leagueName}/startseite/wettbewerb/${leagueIdMap[leagueName]}/plus/?saison_id=${season}`;
}

/**
 * A generic page fetcher that uses a standard User-Agent header.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string|null>} The HTML content of the page or null on error.
 */
const fetchHtml = async (url) => {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000,
        });
        return response.data;
    } catch(e) {
        console.error(`Error scraping ${url}: ${e.message}`);
        return null;
    }
}

/**
 * Parses the HTML of a league page to find all the club squad URLs for that season.
 * @param {string} html - The raw HTML of the league page.
 * @returns {string[]} An array of full URLs to club squad pages.
 */
const extractClubUrls = (html) => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const clubUrls = new Set(); // Use a set to avoid duplicates from the page

    // The links to the clubs are in the first column of the main table
    const clubLinkElements = document.querySelectorAll('.items tbody tr .hauptlink a');
    
    clubLinkElements.forEach(element => {
        // We need the link to the SQUAD page (kader), not the team's start page
        const clubUrl = element.href.replace('/startseite/', '/kader/');
        if (clubUrl.includes('/kader/')) {
            clubUrls.add(BASE_URL + clubUrl);
        }
    });

    return Array.from(clubUrls);
};

/**
 * Parses the HTML of a club squad page to find the profile URLs of the top N players.
 * The table is pre-sorted by market value, so we just take the first N rows.
 * @param {string} html - The raw HTML of the club squad page.
 * @returns {string[]} An array of full URLs to player profiles.
 */
const extractTopPlayerUrls = (html) => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const playerUrls = [];

    const playerRows = Array.from(document.querySelectorAll('.items tbody tr'));
    const topPlayerRows = playerRows.slice(0, PLAYERS_PER_CLUB_TO_SCOUT);

    topPlayerRows.forEach(row => {
        const playerLinkElement = row.querySelector('.posrela .hauptlink a');
        if (playerLinkElement && playerLinkElement.href) {
            playerUrls.push(BASE_URL + playerLinkElement.href);
        }
    });
    return playerUrls;
}

/**
 * Main scraping orchestration function.
 */
const initScraping = async () => {
    console.log("🚀 Starting player scouting script...");
    const allPlayerUrls = new Set();
    
    for (const season of SEASONS_TO_SCAN) {
        console.log(`\n--- Processing Season: ${season}/${season + 1} ---`);
        for (const league of LEAGUES_TO_SCAN) {
            console.log(`[${league}] Fetching clubs...`);
            const leagueUrl = generateLeagueUrl(league, season);
            const leagueHtml = await fetchHtml(leagueUrl);
            
            if (!leagueHtml) continue; // Skip if there was an error
            
            const clubUrls = extractClubUrls(leagueHtml);
            console.log(`[${league}] Found ${clubUrls.length} clubs. Scouting top players...`);

            for (const clubUrl of clubUrls) {
                await wait(1.5); // Be respectful to the server
                const clubHtml = await fetchHtml(clubUrl);
                if (!clubHtml) continue;

                const topPlayerUrls = extractTopPlayerUrls(clubHtml);
                topPlayerUrls.forEach(url => allPlayerUrls.add(url));
            }
            console.log(`[${league}] Season scan complete. Total unique players found so far: ${allPlayerUrls.size}`);
        }
        await wait(3); // Longer wait between full season scans
    }
    
    console.log("\n🎉 Scouting completed!");
    console.log(`Found a total of ${allPlayerUrls.size} unique player URLs.`);
    
    // Convert Set to a sorted Array for clean output
    const sortedUrls = Array.from(allPlayerUrls).sort();

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(sortedUrls, null, 2));
    console.log(`💾 Data successfully saved to ${OUTPUT_FILE}`);
}

// Execute the main function
initScraping().catch(error => {
    console.error("A critical error occurred during the scraping process:", error);
});