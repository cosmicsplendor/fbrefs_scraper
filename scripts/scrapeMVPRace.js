// fetch_player_market_value_v3.js
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---

const PLAYERS_TO_FETCH = [{"name":"Lionel Messi","src":"https://www.transfermarkt.com/lionel-messi/profil/spieler/28003"}]


const OUTPUT_DIR = path.join('scripts', 'market_value_data');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

const MIN_DELAY_MS = 2500;
const MAX_DELAY_MS = 5000;

const COOKIE_HEADER = 'TM_LINFO=1751784531; aname=transfermarkt.com; TM_TS=1751784530; LAYOUT_MODE=s; euconsent-v2=CQTQT4AQTQT4AAGABCENBvFsAP_gAELAABp4IzQHwAFAANAAqABwAEAALQAZAA0ACKAEwAKQAYgA3gBzAEIAI4ATQApACEAFDAPaAhsBGoC2gF5gMZAZIA0IBqIELgIzAIRADAAUAI4AhAA4SAYABUADgAIIAZABoAEwAN4AhABNAHtAXmAyQCFw6AWABUADgAIIAZABoAEwAMQAbwBNAHtAXmAyQhACADEAG8lAGAA4AEwAMQB7QF5gMkKQCQAKgAcABAADQAJgAYgD2gLzAZIVAAgAKKAAQAZA.YAAAAAAAAAAA; _sp_v1_ss=1:H4sIAAAAAAAAAItWqo5RKimOUbKKxs_IAzEMamN1YpRSQcy80pwcILsErKC6lpoSSrEA-EAOLpYAAAA%3D; _sp_v1_p=691; _sp_v1_data=745500; _sp_su=false; consentUUID=82cc2c92-2b64-40cc-adb7-d9c1e6596a8c_45; AMCV_B21B678254F601E20A4C98A5%40AdobeOrg=MCMID|89691121356868213770835858784851984069; pbjs-unifiedid=%7B%22TDID%22%3A%227b8a8bd1-9b6b-43ab-9598-649fe2d3501d%22%2C%22TDID_LOOKUP%22%3A%22TRUE%22%2C%22TDID_CREATED_AT%22%3A%222025-05-19T23%3A15%3A36%22%7D; pbjs-unifiedid_cst=uix1LEksYA%3D%3D; __vads=KnYR6L4JMWTVle0AVUIJlz6sQ; nadz_dailyVisits=1; kndctr_B21B678254F601E20A4C98A5_AdobeOrg_identity=CiY4OTY5MTEyMTM1Njg2ODIxMzc3MDgzNTg1ODc4NDg1MTk4NDA2OVIRCNTa59P4MhgBKgRJUkwxMAHwAa3hoNn9Mg%3D%3D; panoramaId_expiry=1751814941991; kndctr_B21B678254F601E20A4C98A5_AdobeOrg_cluster=irl1; cuukie=aDZuR3RMUlN4WHZDamRZTjB3SEdqc3NXaWQ4WWxRdklBS69ieQpl3d6xY8fedadeRv9FhENk1F4Ce1eB2Hx4fA%3D%3D; __gads=ID=392e5e14e3f96ff7:T=1750374937:RT=1751784506:S=ALNI_MbzEuCpvg02DIlgbPk8J7i9GgLlhQ; __gpi=UID=00001134a44ae821:T=1750374937:RT=1751784506:S=ALNI_MaY1FKL5JT3kZtgqOMMkKxnkzp7mw; __eoi=ID=a74242297627fa13:T=1750374937:RT=1751784506:S=AA-AfjZ82AUCZ2m3JkyToK3fQ-4U; cto_bundle=VKmLUF9aTEd0Wll2WHhUOWNxR3NmJTJGZDd0QThWV1NiQmtPUGpSYSUyRm1YcjZGdkxIN1NPclN0JTJGUzBFWVQ1QVRadlljamlLZG9CSWM5WjNGaDVxcVk0OFVVRFA4bjlmbVZlUXBJNSUyQkhLSDlaUGs1OVJQbTI1VTNqbVYxb09FbEttZEV1aUM5NDg2bzZoY0xNZHMySG9zNzBCNTVHczhhU3M1NmVBblo1dUl3WjVvYlJaayUzRA; cto_bidid=AgfKYV84Sk5oWFk4cyUyRldDZFlxQ01hMm5ickl6eHQ5N0cxdXVXbHMwc0Q1VFFjOEhJSGJ1QlJ4NTVMdGk2cnhQUFF5RiUyRmxzVyUyRnluU3A4R3RKeSUyQmlaU2p6V2xYYmdTRE91eWwzV0Roc3dWOWdxZDdNbFF6QWUyOWlCR2lHJTJGZUtXdVhWWkU';

// --- HELPER FUNCTIONS ---

const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * Extracts the player ID from the Transfermarkt profile URL.
 * Now more robust to handle bad inputs.
 */
const extractPlayerId = (url) => {
    // **FIX**: Add a guard clause to ensure the URL is a valid string.
    if (!url || typeof url !== 'string') {
        throw new Error(`Invalid or missing URL provided to extractPlayerId. Received: ${url}`);
    }
    const parts = url.split('/');
    const id = parts[parts.length - 1];
    if (!/^\d+$/.test(id)) {
        throw new Error(`Could not extract a valid numeric ID from URL: ${url}`);
    }
    return id;
};

const sanitizeFileName = (name) => {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '');
};

const getRandomDelay = () => {
    return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- CORE LOGIC ---

const fetchPlayerMarketValue = async (playerId, playerProfileUrl) => {
    const requestUrl = `https://www.transfermarkt.com/ceapi/marketValueDevelopment/graph/${playerId}`;
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const headers = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': COOKIE_HEADER,
        'priority': 'u=1, i',
        'referer': playerProfileUrl,
        'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': userAgent,
    };

    console.log(`[NETWORK] Making GET request to: ${requestUrl}`);
    try {
        const response = await axios.get(requestUrl, { headers });
        console.log(`[SUCCESS] Received response for player ID ${playerId}. Status: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error(`[ERROR] Failed to fetch market value for player ID ${playerId}.`);
        if (error.response) {
            console.error(`[ERROR] Status: ${error.response.status} ${error.response.statusText}`);
            if (error.response.status === 403) {
                console.error("[HINT] A 403 Forbidden error often means your cookie is invalid or expired.");
            }
        } else {
            console.error('[ERROR] An unexpected error occurred during the request:', error.message);
        }
        throw error;
    }
};

const main = async () => {
    console.log('--- Starting Player Market Value Scraper ---');
    // ... setup logic ...
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
        console.error(`[FATAL] Could not create output directory.`, error);
        return;
    }

    for (const player of PLAYERS_TO_FETCH) {
        let delay = 0; // Initialize delay
        console.log(`\n--------------------------------------------------`);
        console.log(`[PROCESS] Checking player: ${player.name}`);

        try {
            const fileName = `${sanitizeFileName(player.name)}_market_value.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);

            if (await fileExists(filePath)) {
                console.log(`[SKIP] File already exists for ${player.name} at ${filePath}`);
                // **FIX**: We still need a delay after skipping
                delay = getRandomDelay();
                console.log(`[INFO] Waiting for ${(delay / 1000).toFixed(1)} seconds...`);
                await sleep(delay);
                continue;
            }

            // This code will only run if the file doesn't exist
            const playerId = extractPlayerId(player.src); // This is where the old error happened
            console.log(`[INFO] Extracted Player ID: ${playerId}`);

            const marketValueData = await fetchPlayerMarketValue(playerId, player.src);
            
            await fs.writeFile(filePath, JSON.stringify(marketValueData, null, 2));
            console.log(`[SAVE] Successfully saved data for ${player.name} to ${filePath}`);

        } catch (error) {
            // The catch block will now receive a more descriptive error from the helpers
            console.error(`[FAIL] Skipped processing for ${player.name}. Reason: ${error.message}`);
        }
        
        // **FIX**: The delay logic is now cleaner and will always run
        delay = getRandomDelay();
        console.log(`[INFO] Waiting for ${(delay / 1000).toFixed(1)} seconds before next request...`);
        await sleep(delay);
    }

    console.log('\n--------------------------------------------------');
    console.log('--- Script finished. ---');
};

main();