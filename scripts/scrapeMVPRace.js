// fetch_player_market_value.js
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---

// 1. List of players to process.
const PLAYERS_TO_FETCH = [{"name":"Lionel Messi","src":"https://www.transfermarkt.com/lionel-messi/profil/spieler/28003"},{"name":"Cristiano Ronaldo","src":"https://www.transfermarkt.com/cristiano-ronaldo/profil/spieler/8198"},{"name":"Gareth Bale","src":"https://www.transfermarkt.com/gareth-bale/profil/spieler/39381"},{"name":"Neymar","src":"https://www.transfermarkt.com/neymar/profil/spieler/68290"},{"name":"Edinson Cavani","src":"https://www.transfermarkt.com/edinson-cavani/profil/spieler/48280"},{"name":"Falcao","src":"https://www.transfermarkt.com/falcao/profil/spieler/39152"},{"name":"Mario Götze","src":"https://www.transfermarkt.com/mario-gotze/profil/spieler/74842"},{"name":"Andrés Iniesta","src":"https://www.transfermarkt.com/andres-iniesta/profil/spieler/7600"},{"name":"James Rodríguez","src":"https://www.transfermarkt.com/james-rodriguez/profil/spieler/88103"},{"name":"Luis Suárez","src":"https://www.transfermarkt.com/luis-suarez/profil/spieler/44352"},{"name":"Ángel di María","src":"https://www.transfermarkt.com/angel-di-maria/profil/spieler/45320"},{"name":"Thomas Müller","src":"https://www.transfermarkt.com/thomas-muller/profil/spieler/58358"},{"name":"Eden Hazard","src":"https://www.transfermarkt.com/eden-hazard/profil/spieler/50202"},{"name":"Antoine Griezmann","src":"https://www.transfermarkt.com/antoine-griezmann/profil/spieler/125781"},{"name":"Paul Pogba","src":"https://www.transfermarkt.com/paul-pogba/profil/spieler/122153"},{"name":"Kylian Mbappé","src":"https://www.transfermarkt.com/kylian-mbappe/profil/spieler/342229"},{"name":"Harry Kane","src":"https://www.transfermarkt.com/harry-kane/profil/spieler/132098"},{"name":"Kevin De Bruyne","src":"https://www.transfermarkt.com/kevin-de-bruyne/profil/spieler/88755"},{"name":"Mohamed Salah","src":"https://www.transfermarkt.com/mohamed-salah/profil/spieler/148455"},{"name":"Raheem Sterling","src":"https://www.transfermarkt.com/raheem-sterling/profil/spieler/134425"},{"name":"Sadio Mané","src":"https://www.transfermarkt.com/sadio-mane/profil/spieler/200512"},{"name":"Jadon Sancho","src":"https://www.transfermarkt.com/jadon-sancho/profil/spieler/401173"},{"name":"Trent Alexander-Arnold","src":"https://www.transfermarkt.com/trent-alexander-arnold/profil/spieler/314353"},{"name":"Erling Haaland","src":"https://www.transfermarkt.com/erling-haaland/profil/spieler/418560"},{"name":"Romelu Lukaku","src":"https://www.transfermarkt.com/romelu-lukaku/profil/spieler/96341"},{"name":"Vinicius Junior","src":"https://www.transfermarkt.com/vinicius-junior/profil/spieler/371998"},{"name":"Bruno Fernandes","src":"https://www.transfermarkt.com/bruno-fernandes/profil/spieler/240306"},{"name":"Phil Foden","src":"https://www.transfermarkt.com/phil-foden/profil/spieler/406635"},{"name":"Dušan Vlahović","src":"https://www.transfermarkt.com/du-scaron-an-vlahovi%C4%87/profil/spieler/357498"},{"name":"Jude Bellingham","src":"https://www.transfermarkt.com/jude-bellingham/profil/spieler/581678"},{"name":"Pedri","src":"https://www.transfermarkt.com/pedri/profil/spieler/683840"},{"name":"Jamal Musiala","src":"https://www.transfermarkt.com/jamal-musiala/profil/spieler/580195"},{"name":"Bukayo Saka","src":"https://www.transfermarkt.com/bukayo-saka/profil/spieler/433177"},{"name":"Victor Osimhen","src":"https://www.transfermarkt.com/victor-osimhen/profil/spieler/401923"},{"name":"Lautaro Martínez","src":"https://www.transfermarkt.com/lautaro-martinez/profil/spieler/406625"},{"name":"Florian Wirtz","src":"https://www.transfermarkt.com/florian-wirtz/profil/spieler/598577"},{"name":"Lamine Yamal","src":"https://www.transfermarkt.com/lamine-yamal/profil/spieler/937958"},{"name":"Adriano","src":"https://www.transfermarkt.com/adriano/profil/spieler/3422"},{"name":"Sergio Agüero","src":"https://www.transfermarkt.com/sergio-aguero/profil/spieler/26399"},{"name":"Gianluigi Buffon","src":"https://www.transfermarkt.com/gianluigi-buffon/profil/spieler/5023"},{"name":"Fabio Cannavaro","src":"https://www.transfermarkt.com/fabio-cannavaro/profil/spieler/5775"},{"name":"Iker Casillas","src":"https://www.transfermarkt.com/iker-casillas/profil/spieler/3979"},{"name":"Didier Drogba","src":"https://www.transfermarkt.com/didier-drogba/profil/spieler/3922"},{"name":"Samuel Eto'o","src":"https://www.transfermarkt.com/samuel-etoo/profil/spieler/4257"},{"name":"Cesc Fàbregas","src":"https://www.transfermarkt.com/cesc-fabregas/profil/spieler/8806"},{"name":"Steven Gerrard","src":"https://www.transfermarkt.com/steven-gerrard/profil/spieler/3109"},{"name":"Thierry Henry","src":"https://www.transfermarkt.com/thierry-henry/profil/spieler/3207"},{"name":"Zlatan Ibrahimović","src":"https://www.transfermarkt.com/zlatan-ibrahimovic/profil/spieler/3455"},{"name":"Kaká","src":"https://www.transfermarkt.com/kaka/profil/spieler/3366"},{"name":"Frank Lampard","src":"https://www.transfermarkt.com/frank-lampard/profil/spieler/3163"},{"name":"Pavel Nedvěd","src":"https://www.transfermarkt.com/pavel-nedved/profil/spieler/3523"},{"name":"Gerard Piqué","src":"https://www.transfermarkt.com/gerard-pique/profil/spieler/18944"},{"name":"Franck Ribéry","src":"https://www.transfermarkt.com/franck-ribery/profil/spieler/22068"},{"name":"Ronaldinho","src":"https://www.transfermarkt.com/ronaldinho/profil/spieler/3373"},{"name":"Wayne Rooney","src":"https://www.transfermarkt.com/wayne-rooney/profil/spieler/3332"},{"name":"Andriy Shevchenko","src":"https://www.transfermarkt.com/andriy-shevchenko/profil/spieler/3522"},{"name":"Wesley Sneijder","src":"https://www.transfermarkt.com/wesley-sneijder/profil/spieler/4673"},{"name":"Fernando Torres","src":"https://www.transfermarkt.com/fernando-torres/profil/spieler/7767"},{"name":"Ruud van Nistelrooy","src":"https://www.transfermarkt.com/ruud-van-nistelrooy/profil/spieler/3407"},{"name":"Robin van Persie","src":"https://www.transfermarkt.com/robin-van-persie/profil/spieler/8749"},{"name":"Nemanja Vidić","src":"https://www.transfermarkt.com/nemanja-vidic/profil/spieler/19726"},{"name":"Xavi Hernández","src":"https://www.transfermarkt.com/xavi/profil/spieler/7607"},{"name":"Zinedine Zidane","src":"https://www.transfermarkt.com/zinedine-zidane/profil/spieler/3111"}]

// 2. Directory to save the JSON output
const OUTPUT_DIR = path.join('scripts', 'market_value_data');

// 3. User-Agents for rotation
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

// 4. Random delay configuration (in milliseconds)
const MIN_DELAY_MS = 2500;
const MAX_DELAY_MS = 5000;

// 5. [CRITICAL] The full cookie string from your browser's network inspector.
const COOKIE_HEADER = 'TM_LINFO=1751784531; aname=transfermarkt.com; TM_TS=1751784530; LAYOUT_MODE=s; euconsent-v2=CQTQT4AQTQT4AAGABCENBvFsAP_gAELAABp4IzQHwAFAANAAqABwAEAALQAZAA0ACKAEwAKQAYgA3gBzAEIAI4ATQApACEAFDAPaAhsBGoC2gF5gMZAZIA0IBqIELgIzAIRADAAUAI4AhAA4SAYABUADgAIIAZABoAEwAN4AhABNAHtAXmAyQCFw6AWABUADgAIIAZABoAEwAMQAbwBNAHtAXmAyQhACADEAG8lAGAA4AEwAMQB7QF5gMkKQCQAKgAcABAADQAJgAYgD2gLzAZIVAAgAKKAAQAZA.YAAAAAAAAAAA; _sp_v1_ss=1:H4sIAAAAAAAAAItWqo5RKimOUbKKxs_IAzEMamN1YpRSQcy80pwcILsErKC6lpoSSrEA-EAOLpYAAAA%3D; _sp_v1_p=691; _sp_v1_data=745500; _sp_su=false; consentUUID=82cc2c92-2b64-40cc-adb7-d9c1e6596a8c_45; AMCV_B21B678254F601E20A4C98A5%40AdobeOrg=MCMID|89691121356868213770835858784851984069; pbjs-unifiedid=%7B%22TDID%22%3A%227b8a8bd1-9b6b-43ab-9598-649fe2d3501d%22%2C%22TDID_LOOKUP%22%3A%22TRUE%22%2C%22TDID_CREATED_AT%22%3A%222025-05-19T23%3A15%3A36%22%7D; pbjs-unifiedid_cst=uix1LEksYA%3D%3D; __vads=KnYR6L4JMWTVle0AVUIJlz6sQ; nadz_dailyVisits=1; kndctr_B21B678254F601E20A4C98A5_AdobeOrg_identity=CiY4OTY5MTEyMTM1Njg2ODIxMzc3MDgzNTg1ODc4NDg1MTk4NDA2OVIRCNTa59P4MhgBKgRJUkwxMAHwAa3hoNn9Mg%3D%3D; panoramaId_expiry=1751814941991; kndctr_B21B678254F601E20A4C98A5_AdobeOrg_cluster=irl1; cuukie=aDZuR3RMUlN4WHZDamRZTjB3SEdqc3NXaWQ4WWxRdklBS69ieQpl3d6xY8fedadeRv9FhENk1F4Ce1eB2Hx4fA%3D%3D; __gads=ID=392e5e14e3f96ff7:T=1750374937:RT=1751784506:S=ALNI_MbzEuCpvg02DIlgbPk8J7i9GgLlhQ; __gpi=UID=00001134a44ae821:T=1750374937:RT=1751784506:S=ALNI_MaY1FKL5JT3kZtgqOMMkKxnkzp7mw; __eoi=ID=a74242297627fa13:T=1750374937:RT=1751784506:S=AA-AfjZ82AUCZ2m3JkyToK3fQ-4U; cto_bundle=VKmLUF9aTEd0Wll2WHhUOWNxR3NmJTJGZDd0QThWV1NiQmtPUGpSYSUyRm1YcjZGdkxIN1NPclN0JTJGUzBFWVQ1QVRadlljamlLZG9CSWM5WjNGaDVxcVk0OFVVRFA4bjlmbVZlUXBJNSUyQkhLSDlaUGs1OVJQbTI1VTNqbVYxb09FbEttZEV1aUM5NDg2bzZoY0xNZHMySG9zNzBCNTVHczhhU3M1NmVBblo1dUl3WjVvYlJaayUzRA; cto_bidid=AgfKYV84Sk5oWFk4cyUyRldDZFlxQ01hMm5ickl6eHQ5N0cxdXVXbHMwc0Q1VFFjOEhJSGJ1QlJ4NTVMdGk2cnhQUFF5RiUyRmxzVyUyRnluU3A4R3RKeSUyQmlaU2p6V2xYYmdTRE91eWwzV0Roc3dWOWdxZDdNbFF6QWUyOWlCR2lHJTJGZUtXdVhWWkU';

// --- HELPER FUNCTIONS ---

/**
 * Checks if a file exists at the given path.
 * @param {string} filePath - The full path to the file.
 * @returns {Promise<boolean>} - True if the file exists, false otherwise.
 */
const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const extractPlayerId = (url) => { /* ... (no changes) ... */ };
const sanitizeFileName = (name) => { /* ... (no changes) ... */ };
const getRandomDelay = () => { /* ... (no changes) ... */ };
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Keep these helper functions from the previous script
const extractPlayerId_impl = (url) => { try { const parts = url.split('/'); return parts[parts.length - 1]; } catch (e) { throw new Error(`Could not extract player ID from URL: ${url}`); } };
const sanitizeFileName_impl = (name) => name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '');
const getRandomDelay_impl = () => Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
Object.assign(globalThis, {extractPlayerId: extractPlayerId_impl, sanitizeFileName: sanitizeFileName_impl, getRandomDelay: getRandomDelay_impl});

// --- CORE LOGIC ---

const fetchPlayerMarketValue = async (playerId, playerProfileUrl) => { /* ... (no changes) ... */ };
const fetchPlayerMarketValue_impl = async (playerId, playerProfileUrl) => {
    const requestUrl = `https://www.transfermarkt.com/ceapi/marketValueDevelopment/graph/${playerId}`;
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const headers = {
        'accept': '*/*', 'accept-language': 'en-US,en;q=0.9', 'cookie': COOKIE_HEADER,
        'priority': 'u=1, i', 'referer': playerProfileUrl, 'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"', 'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'user-agent': userAgent,
    };
    console.log(`[NETWORK] Making GET request to: ${requestUrl}`);
    console.log(`[NETWORK] Using User-Agent: ${userAgent}`);
    try {
        const response = await axios.get(requestUrl, { headers });
        console.log(`[SUCCESS] Received response for player ID ${playerId}. Status: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error(`[ERROR] Failed to fetch market value for player ID ${playerId}.`);
        if (error.response) {
            console.error(`[ERROR] Status: ${error.response.status} ${error.response.statusText}`);
            console.error(`[ERROR] Response Data: ${JSON.stringify(error.response.data).substring(0, 300)}...`);
            if (error.response.status === 403) console.error("[HINT] A 403 Forbidden error often means your cookie is invalid or expired. Please update the COOKIE_HEADER constant.");
        } else if (error.request) console.error('[ERROR] No response received.');
        else console.error('[ERROR] Error setting up the request:', error.message);
        throw error;
    }
};
Object.assign(globalThis, {fetchPlayerMarketValue: fetchPlayerMarketValue_impl});

/**
 * Main function to orchestrate the fetching and saving process.
 */
const main = async () => {
    console.log('--- Starting Player Market Value Scraper ---');
    console.log(`[INFO] Found ${PLAYERS_TO_FETCH.length} players to process.`);
    console.log(`[INFO] To re-scrape a player, delete their JSON file from the output directory.`);

    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        console.log(`[SETUP] Output directory ready at: ./${OUTPUT_DIR}`);
    } catch (error) {
        console.error(`[FATAL] Could not create output directory: ./${OUTPUT_DIR}`, error);
        return;
    }

    for (const player of PLAYERS_TO_FETCH) {
        console.log(`\n--------------------------------------------------`);
        console.log(`[PROCESS] Checking player: ${player.name}`);

        try {
            // ** NEW **: Determine the potential output path
            const fileName = `${sanitizeFileName(player.name)}_market_value.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);

            // ** NEW **: Check if the file already exists
            if (await fileExists(filePath)) {
                console.log(`[SKIP] File already exists for ${player.name}.`);
                console.log(`         Path: ${filePath}`);
                // Use 'continue' to skip the rest of the loop and move to the next player
                continue; 
            }

            // If the file does not exist, proceed with the original logic
            const playerId = extractPlayerId(player.src);
            console.log(`[INFO] Extracted Player ID: ${playerId}`);

            const marketValueData = await fetchPlayerMarketValue(playerId, player.src);
            
            await fs.writeFile(filePath, JSON.stringify(marketValueData, null, 2));
            console.log(`[SAVE] Successfully saved market value data for ${player.name} to ${filePath}`);

        } catch (error) {
            console.error(`[FAIL] Skipped processing for ${player.name} due to an error.`);
        }

        // The delay is now outside the 'try' block but still inside the loop
        // to ensure a delay happens even after a successful skip.
        // This is good practice to avoid hitting the server too rapidly in any scenario.
        const delay = getRandomDelay();
        console.log(`[INFO] Waiting for ${(delay / 1000).toFixed(1)} seconds before next request...`);
        await sleep(delay);
    }

    console.log('\n--------------------------------------------------');
    console.log('--- Script finished. ---');
};

// Run the main function
main();