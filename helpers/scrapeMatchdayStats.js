const { JSDOM } = require('jsdom');
const getStealth = require("./getStealth")
// --- Main Scraper Function ---
/**
 * Scrapes match statistics tables from a FBRef match URL.
 * Fetches the content, parses it, and extracts data from relevant tables.
 * @param {string} matchUrl The URL of the FBRef match page.
 * @returns {Promise<Array<Object>>} A promise that resolves with a merged array of player data objects.
 * @throws {Error} If fetching or parsing fails.
 */
async function scrapeMatchDayStats(matchUrl) {
  console.log(`scrapeMatchDayStats: Function started for URL: ${matchUrl}`);

  let htmlContent;
  try {
    // 1. Get the string content via helper that uses axios
    htmlContent = await getStealth(matchUrl);
    console.log(`scrapeMatchDayStats: Successfully fetched HTML content.`);
  } catch (fetchError) {
    console.error(`scrapeMatchDayStats: Failed to fetch HTML content for ${matchUrl}:`, fetchError);
    throw new Error(`Failed to fetch page content: ${fetchError.message}`);
  }

  // 2. Parse the content and query the tables
  let dom;
  try {
      dom = new JSDOM(htmlContent);
      console.log(`scrapeMatchDayStats: Successfully parsed HTML content.`);
  } catch (parseError) {
      console.error(`scrapeMatchDayStats: Failed to parse HTML content for ${matchUrl}:`, parseError);
      throw new Error(`Failed to parse HTML: ${parseError.message}`);
  }

  // Use the document object from JSDOM
  const document = dom.window.document;
  const mergedStats = []; // Array to hold data from all tables

  // Select tables with class 'stats_table' and id containing 'summary'
  const tables = Array.from(document.querySelectorAll(".stats_table[id*='summary']"));

  console.log(`scrapeMatchDayStats: Found ${tables.length} tables with class '.stats_table' and ID containing 'summary'.`);

  if (tables.length === 0) {
    console.warn("scrapeMatchDayStats: No relevant tables found on the page. Returning empty array.");
    return []; // Return empty array if no relevant tables are found
  }

  tables.forEach((table, tableIndex) => {
    const tableId = table.id;
    console.log(`scrapeMatchDayStats: Processing table #${tableIndex + 1}/${tables.length}, ID: '${tableId || 'N/A'}'.`);

    if (!tableId) {
      console.warn(`scrapeMatchDayStats: Table #${tableIndex} has no ID. Skipping.`);
      return; // Skip to the next table in the forEach
    }

    try {
      const tbody = table.querySelector("tbody");

      if (!tbody) {
        console.warn(`scrapeMatchDayStats: Table '${tableId}' does not have a <tbody> element. Skipping rows for this table.`);
        return; // Skip to the next table in the forEach
      }

      // Get only direct children <tr> elements of the <tbody>
      const rows = tbody.querySelectorAll(":scope > tr");
      console.log(`scrapeMatchDayStats: Table '${tableId}': found ${rows.length} potential data rows within <tbody>.`);

      rows.forEach((row, rowIndex) => {
        try {
          // Skip rows that are likely headers or spacers
          if (row.classList.contains("spacer") || row.classList.contains("thead") || row.classList.contains("partial_table_thead")) {
            // console.log(`scrapeMatchDayStats: Table '${tableId}', Row #${rowIndex}: Skipping spacer/header row.`);
            return; // Skip to the next row
          }
          // Skip if row only contains <th> elements (likely a header row within tbody)
          if (row.querySelectorAll("th").length === row.children.length && row.querySelectorAll("td").length === 0) {
            // console.log(`scrapeMatchDayStats: Table '${tableId}', Row #${rowIndex}: Skipping potential header row (all th).`);
            return; // Skip to the next row
          }

          const playerData = {};
          const cells = row.querySelectorAll("th[data-stat], td[data-stat]");

          if (cells.length === 0) {
            // console.log(`scrapeMatchDayStats: Table '${tableId}', Row #${rowIndex}: Skipping row with no data-stat cells.`);
            return; // Skip to the next row
          }

          cells.forEach((cell) => {
            const statName = cell.dataset.stat;
            if (!statName) return; // Should not happen due to selector

            let statValue = cell.textContent.trim();

            if (statName === "player") {
              const playerLink = cell.querySelector("a");
              if (playerLink) {
                statValue = playerLink.textContent.trim();
              }
              // Remove leading non-breaking spaces or regular spaces (often for substitutes)
              statValue = statValue.replace(/^\s+/, '');
            } else if (statName === "nationality") {
              const nationLink = cell.querySelector("a");
              if (nationLink) {
                const fullText = nationLink.textContent.trim();
                const parts = fullText.split(/\s+/); // Split by any whitespace
                statValue = parts[parts.length - 1]; // Get the last part (e.g., "BRA")
              } else {
                // Fallback if no link
                const parts = cell.textContent.trim().split(/\s+/);
                statValue = parts.length > 0 ? parts[parts.length - 1] : cell.textContent.trim(); // Handle empty case
              }
            }

            // Handle numeric conversion
            // The class "iz" (is zero) often means the value is 0 but might be an empty string in textContent
             if (cell.classList.contains("iz") && statValue === "") {
              playerData[statName] = 0;
            } else if (statValue !== "" && !isNaN(statValue)) {
               // Check if it *should* be numeric and isn't a stat like 'player' or 'nationality'
               // A more robust check might look at typical numeric columns or try parsing
               // For now, let's assume data-stat names that *should* be strings are handled above
               // and everything else that looks like a number should be parsed.
                if (statName !== "player" && statName !== "nationality" && statName !== "position") { // Add other known string stats
                     playerData[statName] = parseFloat(statValue);
                 } else {
                     playerData[statName] = statValue; // Keep as string
                 }
            } else {
              playerData[statName] = statValue;
            }
          });

          // If the player data object has content, push it to the *merged* array
          if (Object.keys(playerData).length > 0) {
            mergedStats.push(playerData);
          } else {
             // console.log(`scrapeMatchDayStats: Table '${tableId}', Row #${rowIndex}: Generated empty playerData object. Skipping.`);
          }
        } catch (rowError) {
          console.error(`scrapeMatchDayStats: Error processing row #${rowIndex} in table '${tableId}':`, rowError);
          console.error(`scrapeMatchDayStats: Problematic row HTML (first 200 chars):`, row.outerHTML.substring(0, 200) + "...");
          // Continue to the next row
        }
      });

      console.log(`scrapeMatchDayStats: Table '${tableId}': Finished processing rows.`);

    } catch (tableError) {
      console.error(`scrapeMatchDayStats: Error processing table '${tableId}':`, tableError);
      console.error(`scrapeMatchDayStats: Problematic table HTML (first 500 chars of outerHTML):`, table.outerHTML.substring(0, 500) + "...");
      // Continue to the next table
    }
  });

  console.log(`scrapeMatchDayStats: Function finished. Successfully collected ${mergedStats.length} player entries.`);
  // console.log(mergedStats); // Optional: Log the final array

  // 3. Return results
  return mergedStats;
}

module.exports = scrapeMatchDayStats