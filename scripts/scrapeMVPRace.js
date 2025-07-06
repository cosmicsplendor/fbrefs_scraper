// fetch_player_data.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// --- CONFIGURATION ---

// 1. List of players to process. Add more players here.
const PLAYERS_TO_FETCH = [{"name":"Lionel Messi","src":"https://www.transfermarkt.com/lionel-messi/profil/spieler/28003"},{"name":"Cristiano Ronaldo","src":"https://www.transfermarkt.com/cristiano-ronaldo/profil/spieler/8198"},{"name":"Gareth Bale","src":"https://www.transfermarkt.com/gareth-bale/profil/spieler/39381"},{"name":"Neymar","src":"https://www.transfermarkt.com/neymar/profil/spieler/68290"},{"name":"Edinson Cavani","src":"https://www.transfermarkt.com/edinson-cavani/profil/spieler/48280"},{"name":"Falcao","src":"https://www.transfermarkt.com/falcao/profil/spieler/39152"},{"name":"Mario Götze","src":"https://www.transfermarkt.com/mario-gotze/profil/spieler/74842"},{"name":"Andrés Iniesta","src":"https://www.transfermarkt.com/andres-iniesta/profil/spieler/7600"},{"name":"James Rodríguez","src":"https://www.transfermarkt.com/james-rodriguez/profil/spieler/88103"},{"name":"Luis Suárez","src":"https://www.transfermarkt.com/luis-suarez/profil/spieler/44352"},{"name":"Ángel di María","src":"https://www.transfermarkt.com/angel-di-maria/profil/spieler/45320"},{"name":"Thomas Müller","src":"https://www.transfermarkt.com/thomas-muller/profil/spieler/58358"},{"name":"Eden Hazard","src":"https://www.transfermarkt.com/eden-hazard/profil/spieler/50202"},{"name":"Antoine Griezmann","src":"https://www.transfermarkt.com/antoine-griezmann/profil/spieler/125781"},{"name":"Paul Pogba","src":"https://www.transfermarkt.com/paul-pogba/profil/spieler/122153"},{"name":"Kylian Mbappé","src":"https://www.transfermarkt.com/kylian-mbappe/profil/spieler/342229"},{"name":"Harry Kane","src":"https://www.transfermarkt.com/harry-kane/profil/spieler/132098"},{"name":"Kevin De Bruyne","src":"https://www.transfermarkt.com/kevin-de-bruyne/profil/spieler/88755"},{"name":"Mohamed Salah","src":"https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455"},{"name":"Raheem Sterling","src":"https://www.transfermarkt.com/raheem-sterling/profil/spieler/134425"},{"name":"Sadio Mané","src":"https://www.transfermarkt.com/sadio-mane/profil/spieler/200512"},{"name":"Jadon Sancho","src":"https://www.transfermarkt.com/jadon-sancho/profil/spieler/401173"},{"name":"Trent Alexander-Arnold","src":"https://www.transfermarkt.com/trent-alexander-arnold/profil/spieler/314353"},{"name":"Erling Haaland","src":"https://www.transfermarkt.com/erling-haaland/profil/spieler/418560"},{"name":"Romelu Lukaku","src":"https://www.transfermarkt.com/romelu-lukaku/profil/spieler/96341"},{"name":"Vinicius Junior","src":"https://www.transfermarkt.com/vinicius-junior/profil/spieler/371998"},{"name":"Bruno Fernandes","src":"https://www.transfermarkt.com/bruno-fernandes/profil/spieler/240306"},{"name":"Phil Foden","src":"https://www.transfermarkt.com/phil-foden/profil/spieler/406635"},{"name":"Dušan Vlahović","src":"https://www.transfermarkt.com/du-scaron-an-vlahovi%C4%87/profil/spieler/357498"},{"name":"Jude Bellingham","src":"https://www.transfermarkt.com/jude-bellingham/profil/spieler/581678"},{"name":"Pedri","src":"https://www.transfermarkt.com/pedri/profil/spieler/683840"},{"name":"Jamal Musiala","src":"https://www.transfermarkt.com/jamal-musiala/profil/spieler/580195"},{"name":"Bukayo Saka","src":"https://www.transfermarkt.com/bukayo-saka/profil/spieler/433177"},{"name":"Victor Osimhen","src":"https://www.transfermarkt.com/victor-osimhen/profil/spieler/401923"},{"name":"Lautaro Martínez","src":"https://www.transfermarkt.com/lautaro-martinez/profil/spieler/406625"},{"name":"Florian Wirtz","src":"https://www.transfermarkt.com/florian-wirtz/profil/spieler/598577"},{"name":"Lamine Yamal","src":"https://www.transfermarkt.com/lamine-yamal/profil/spieler/937958"},{"name":"Adriano","src":"https://www.transfermarkt.com/adriano/profil/spieler/3422"},{"name":"Sergio Agüero","src":"https://www.transfermarkt.com/sergio-aguero/profil/spieler/26399"},{"name":"Gianluigi Buffon","src":"https://www.transfermarkt.com/gianluigi-buffon/profil/spieler/5023"},{"name":"Fabio Cannavaro","src":"https://www.transfermarkt.com/fabio-cannavaro/profil/spieler/5775"},{"name":"Iker Casillas","src":"https://www.transfermarkt.com/iker-casillas/profil/spieler/3979"},{"name":"Didier Drogba","src":"https://www.transfermarkt.com/didier-drogba/profil/spieler/3922"},{"name":"Samuel Eto'o","src":"https://www.transfermarkt.com/samuel-etoo/profil/spieler/4257"},{"name":"Cesc Fàbregas","src":"https://www.transfermarkt.com/cesc-fabregas/profil/spieler/8806"},{"name":"Steven Gerrard","src":"https://www.transfermarkt.com/steven-gerrard/profil/spieler/3109"},{"name":"Thierry Henry","src":"https://www.transfermarkt.com/thierry-henry/profil/spieler/3207"},{"name":"Zlatan Ibrahimović","src":"https://www.transfermarkt.com/zlatan-ibrahimovic/profil/spieler/3455"},{"name":"Kaká","src":"https://www.transfermarkt.com/kaka/profil/spieler/3366"},{"name":"Frank Lampard","src":"https://www.transfermarkt.com/frank-lampard/profil/spieler/3163"},{"name":"Pavel Nedvěd","src":"https://www.transfermarkt.com/pavel-nedved/profil/spieler/3523"},{"name":"Gerard Piqué","src":"https://www.transfermarkt.com/gerard-pique/profil/spieler/18944"},{"name":"Franck Ribéry","src":"https://www.transfermarkt.com/franck-ribery/profil/spieler/22068"},{"name":"Ronaldinho","src":"https://www.transfermarkt.com/ronaldinho/profil/spieler/3373"},{"name":"Wayne Rooney","src":"https://www.transfermarkt.com/wayne-rooney/profil/spieler/3332"},{"name":"Andriy Shevchenko","src":"https://www.transfermarkt.com/andriy-shevchenko/profil/spieler/3522"},{"name":"Wesley Sneijder","src":"https://www.transfermarkt.com/wesley-sneijder/profil/spieler/4673"},{"name":"Fernando Torres","src":"https://www.transfermarkt.com/fernando-torres/profil/spieler/7767"},{"name":"Ruud van Nistelrooy","src":"https://www.transfermarkt.com/ruud-van-nistelrooy/profil/spieler/3407"},{"name":"Robin van Persie","src":"https://www.transfermarkt.com/robin-van-persie/profil/spieler/8749"},{"name":"Nemanja Vidić","src":"https://www.transfermarkt.com/nemanja-vidic/profil/spieler/19726"},{"name":"Xavi Hernández","src":"https://www.transfermarkt.com/xavi/profil/spieler/7607"},{"name":"Zinedine Zidane","src":"https://www.transfermarkt.com/zinedine-zidane/profil/spieler/3111"}]

// 2. Directory to save the JSON output
const OUTPUT_DIR = path.join('scripts', 'data');

// 3. A list of User-Agents to rotate through to avoid being blocked.
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

// 4. Random delay configuration (in milliseconds)
const MIN_DELAY_MS = 2000;  // Minimum 2 seconds
const MAX_DELAY_MS = 8000;  // Maximum 8 seconds

// --- HELPER FUNCTIONS ---

/**
 * Extracts the player ID from the Transfermarkt profile URL.
 * @param {string} url - The player's profile URL.
 * @returns {string} The player ID.
 */
const extractPlayerId = (url) => {
    try {
        const parts = url.split('/');
        const id = parts[parts.length - 1];
        if (!/^\d+$/.test(id)) {
            throw new Error('ID is not numeric');
        }
        return id;
    } catch (error) {
        throw new Error(`[FATAL] Could not extract a valid player ID from URL: ${url}`);
    }
};

/**
 * Sanitizes a player's name to create a safe filename.
 * e.g., "Lionel Messi" -> "lionel_messi"
 * @param {string} name - The player's name.
 * @returns {string} A sanitized string for use as a filename.
 */
const sanitizeFileName = (name) => {
    return name
        .toLowerCase()
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^a-z0-9_.-]/g, ''); // Remove any non-alphanumeric characters except _ . -
};

/**
 * Pauses execution for a specified amount of time.
 * @param {number} ms - The number of milliseconds to wait.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a random delay between MIN_DELAY_MS and MAX_DELAY_MS.
 * @returns {number} Random delay in milliseconds.
 */
const getRandomDelay = () => {
    return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
};

// --- CORE LOGIC ---

/**
 * Fetches the transfer history for a single player.
 * @param {string} playerId - The ID of the player.
 * @param {string} playerProfileUrl - The full profile URL, used for the Referer header.
 */
const fetchPlayerTransferHistory = async (playerId, playerProfileUrl) => {
    const requestUrl = `https://tmapi-alpha.transfermarkt.technology/transfer/history/player/${playerId}`;
    
    // Rotate User-Agent
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    // Meticulously construct headers to mimic a real browser request
    const headers = {
        'authority': 'tmapi-alpha.transfermarkt.technology',
        'method': 'GET',
        'path': `/transfer/history/player/${playerId}`,
        'scheme': 'https',
        'accept': 'application/json',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://www.transfermarkt.com',
        'priority': 'u=1, i',
        // Using the specific player profile URL as the referer is a "wise" way to make the request look more legitimate
        'referer': playerProfileUrl, 
        'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': userAgent,
    };

    console.log(`[NETWORK] Making GET request to: ${requestUrl}`);
    console.log(`[NETWORK] Using User-Agent: ${userAgent}`);
    console.log(`[NETWORK] Using Referer: ${playerProfileUrl}`);

    try {
        const response = await axios.get(requestUrl, { headers });
        console.log(`[SUCCESS] Received response for player ID ${playerId}. Status: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error(`[ERROR] Failed to fetch data for player ID ${playerId}.`);
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`[ERROR] Status: ${error.response.status}`);
            console.error(`[ERROR] Headers:`, JSON.stringify(error.response.headers, null, 2));
            console.error(`[ERROR] Data:`, JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // The request was made but no response was received
            console.error('[ERROR] No response received from server. Request details:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('[ERROR] Error setting up request:', error.message);
        }
        // Re-throw the error to be caught by the main loop, so it can skip this player
        throw error;
    }
};

/**
 * Main function to orchestrate the fetching and saving process.
 */
const main = async () => {
    console.log('--- Starting Player Transfer History Scraper ---');
    console.log(`[INFO] Found ${PLAYERS_TO_FETCH.length} players to process.`);
    console.log(`[INFO] Using random delays between ${MIN_DELAY_MS/1000}s and ${MAX_DELAY_MS/1000}s`);

    // Ensure the output directory exists
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        console.log(`[SETUP] Output directory ready at: ./${OUTPUT_DIR}`);
    } catch (error) {
        console.error(`[FATAL] Could not create output directory: ./${OUTPUT_DIR}`, error);
        return; // Exit if we can't create the directory
    }
    
    // Process each player sequentially
    for (const player of PLAYERS_TO_FETCH) {
        console.log(`\n--------------------------------------------------`);
        console.log(`[PROCESS] Now processing: ${player.name}`);

        try {
            // 1. Extract ID
            const playerId = extractPlayerId(player.src);
            console.log(`[INFO] Extracted Player ID: ${playerId}`);

            // 2. Fetch data from the API
            const transferData = await fetchPlayerTransferHistory(playerId, player.src);
            
            // 3. Prepare file path and save data
            const fileName = `${sanitizeFileName(player.name)}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);
            
            await fs.writeFile(filePath, JSON.stringify(transferData, null, 2));
            console.log(`[SAVE] Successfully saved transfer history for ${player.name} to ${filePath}`);

        } catch (error) {
            console.error(`[FAIL] Could not complete process for ${player.name}. Skipping to next player. Reason: ${error.message}`);
        }

        // 4. Wait with random delay before the next request
        const randomDelay = getRandomDelay();
        console.log(`[INFO] Waiting for ${randomDelay / 1000} seconds before next request...`);
        await sleep(randomDelay);
    }

    console.log('\n--------------------------------------------------');
    console.log('--- Script finished. All players have been processed. ---');
};

// Run the main function
main();