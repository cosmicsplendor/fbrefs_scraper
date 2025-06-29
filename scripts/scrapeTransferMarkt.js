// club_name,player_name,age,position,club_involved_name,fee,transfer_movement,transfer_period,fee_cleaned,league_name,year,season
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { stealthHeaders } = require("../helpers/getStealth");
const fs = require("fs/promises");

const leagueIdMap = {
    "premier-league": "GB1",
    "championship": "GB2",
    "primera-division": "ES1", 
    "1-bundesliga": "L1",
    "serie-a": "IT1",
    "ligue-1": "FR1",
    "liga-nos": "PO1",
    "eredivisie": "NL1",
    "premier-liga": "RU",
}

const generateUrl = (leagueName = "premier-league", season = "2022", window = "w") => {
    return `https://www.transfermarkt.com/${leagueName}/transfers/wettbewerb/${leagueIdMap[leagueName]}/plus/?saison_id=${season}&s_w=${window}`
}

const extractData = (html) => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const clubBoxes = Array.from(document.querySelectorAll(".box"))
        .filter(box => box.querySelector("h2") && box.querySelector("table"));
    
    const extractRows = table => {
        const nameFieldNameRegex = /^(in|out)$/i;
        const colHeaders = Array.from(table.querySelector("tr").querySelectorAll("th"))
            .map(th => th.textContent.trim());
        
        const rows = Array.from(table.querySelectorAll("tr"))
            .filter(tr => tr.querySelector("td"))
            .map(tr => Array.from(tr.querySelectorAll("td")))
            .reduce((rows, rawRow) => {
                const values = rawRow
                    .filter(cell => {
                        const cn = cell.className.trim();
                        return cn === "" || cn.match("cell") || (cn === "rechts" || cn === "rechts bg_blau_20");
                    })
                    .map(cell => {
                        const val = cell.textContent.trim();
                        return val ? val :
                            cell.querySelector("[alt]")?.alt ?? "";
                    });
                
                const row = values.reduce((row, val, index) => {
                    const fieldName = colHeaders[index];
                    if (!nameFieldNameRegex.test(fieldName)) {
                        return { ...row, [fieldName]: val };
                    }
                    return { ...row, name: val, direction: fieldName };
                }, {});
                
                return rows.concat(row);
            }, []);
        
        return rows;
    };
    
    const transfers = clubBoxes.reduce((clubs, clubBox) => {
        const clubName = clubBox.querySelector("h2").textContent.trim();
        const tables = Array.from(clubBox.querySelectorAll("table"));
        
        return clubs.concat({
            club: clubName,
            transfers: tables.map(extractRows)
                .reduce((flattened, x) => flattened.concat(x), [])
        });
    }, []);
    
    return transfers;
}

const scrapeTransfers = async (league, season, window) => {
    console.log(`[${league}] ${season} ${window}-window`);
    const url = generateUrl(league, season, window);
    
    try {
        const randomHeader = stealthHeaders[Math.floor(Math.random() * stealthHeaders.length)];
        const response = await axios.get(url, {
            headers: randomHeader,
            timeout: 30000,
        });
        
        const data = extractData(response.data);
        return data;
    } catch(e) {
        console.log(`Error scraping ${url}: ${e.message}`);
        console.log(e.response?.status, e.response?.statusText);
        return [];
    }
}

const range = (start, end) => {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const wait = (seconds) => {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

const initScraping = async () => {
    const seasons = range(1992, 2025);
    const league = "1-bundesliga";
    const data = [];
    
    for (const season of seasons) {
        try {
            const [summer, winter] = await Promise.all([
                scrapeTransfers(league, season, "s"),
                scrapeTransfers(league, season, "w")
            ]);
            
            data.push({
                season, 
                summer, 
                winter
            });
            
            // Be respectful to the server
            await wait(2);
        } catch (error) {
            console.error(`Failed to scrape season ${season}:`, error);
        }
    }
    
    await fs.writeFile("./scripts/data/transfers.json", JSON.stringify(data, undefined, 2));
    console.log("Scraping completed");
}

initScraping();