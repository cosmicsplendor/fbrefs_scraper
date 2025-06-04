const { JSDOM } = require('jsdom');
const getStealth = require("./getStealth"); // Assuming this helper exists

// --- Scraper Function ---
/**
 * Scrapes match dates from a FBRef page containing a schedule table.
 * Fetches the content, parses it, and extracts the 'date' from rows
 * within tables with class 'stats_table' and id containing 'sched'.
 * Returns an object containing an array of extracted dates and the original page URL.
 * @param {string} pageUrl The URL of the FBRef page containing the schedule table.
 * @returns {Promise<Object>} A promise that resolves with an object { data: Array<string>, matchdayUrl: string }.
 * @throws {Error} If fetching or parsing fails.
 */
async function scrapeMatchdayList(pageUrl) { // Renamed function
  console.log(`scrapeMatchdayList: Function started for URL: ${pageUrl}`);

  let htmlContent;
  try {
    // 1. Get the string content via helper that uses axios
    htmlContent = await getStealth(pageUrl);
    console.log(`scrapeMatchdayList: Successfully fetched HTML content.`);
  } catch (fetchError) {
    console.error(`scrapeMatchdayList: Failed to fetch HTML content for ${pageUrl}:`, fetchError);
    throw new Error(`Failed to fetch page content: ${fetchError.message}`);
  }

  // 2. Parse the content and query the tables
  let dom;
  try {
      dom = new JSDOM(htmlContent);
      console.log(`scrapeMatchdayList: Successfully parsed HTML content.`);
  } catch (parseError) {
      console.error(`scrapeMatchdayList: Failed to parse HTML content for ${pageUrl}:`, parseError);
      throw new Error(`Failed to parse HTML: ${parseError.message}`);
  }

  // Use the document object from JSDOM
  const document = dom.window.document;
  const extractedDates = []; // Array to hold only the date strings

  // Select tables with class 'stats_table' and id containing 'sched'
  const tables = Array.from(document.querySelectorAll(".stats_table[id*='sched']"));

  console.log(`scrapeMatchdayList: Found ${tables.length} tables with class '.stats_table' and ID containing 'sched'.`);

  if (tables.length === 0) {
    console.warn("scrapeMatchdayList: No relevant tables found on the page matching 'sched'. Returning empty data.");
    // Return the requested format even if no tables are found
    return {
      data: [],
      matchdayUrl: pageUrl // Use the original input URL
    };
  }

  tables.forEach((table, tableIndex) => {
    const tableId = table.id;
    console.log(`scrapeMatchdayList: Processing table #${tableIndex + 1}/${tables.length}, ID: '${tableId || 'N/A'}'.`);

    if (!tableId) {
      console.warn(`scrapeMatchdayList: Table #${tableIndex} has no ID. Skipping.`);
      return; // Skip to the next table
    }

    try {
      const tbody = table.querySelector("tbody");

      if (!tbody) {
        console.warn(`scrapeMatchdayList: Table '${tableId}' does not have a <tbody> element. Skipping rows for this table.`);
        return; // Skip to the next table
      }

      // Get only direct children <tr> elements of the <tbody>
      const rows = tbody.querySelectorAll(":scope > tr");
      console.log(`scrapeMatchdayList: Table '${tableId}': found ${rows.length} potential data rows within <tbody>.`);

      rows.forEach((row, rowIndex) => {
        try {
          // Skip rows that are likely headers or spacers
          if (row.classList.contains("spacer") || row.classList.contains("thead") || row.classList.contains("partial_table_thead")) {
            // console.log(`scrapeMatchdayList: Table '${tableId}', Row #${rowIndex}: Skipping spacer/header row.`);
            return; // Skip to the next row
          }
          // Skip if row only contains <th> elements (likely a header row within tbody)
          if (row.querySelectorAll("th").length === row.children.length && row.querySelectorAll("td").length === 0) {
             // console.log(`scrapeMatchdayList: Table '${tableId}', Row #${rowIndex}: Skipping potential header row (all th).`);
            return; // Skip to the next row
          }

          // Find the specific cell with data-stat="date"
          const dateCell = row.querySelector('th[data-stat="date"], td[data-stat="date"]');

          if (dateCell) {
             const dateValue = dateCell.textContent.trim();
             // Push only the date string into the array
             extractedDates.push(dateValue);
          } else {
             // console.log(`scrapeMatchdayList: Table '${tableId}', Row #${rowIndex}: No 'date' cell found. Skipping row data.`);
          }

        } catch (rowError) {
          console.error(`scrapeMatchdayList: Error processing row #${rowIndex} in table '${tableId}':`, rowError);
          console.error(`scrapeMatchdayList: Problematic row HTML (first 200 chars):`, row.outerHTML.substring(0, 200) + "...");
          // Continue to the next row
        }
      });

      console.log(`scrapeMatchdayList: Table '${tableId}': Finished processing rows.`);

    } catch (tableError) {
      console.error(`scrapeMatchdayList: Error processing table '${tableId}':`, tableError);
      console.error(`scrapeMatchdayList: Problematic table HTML (first 500 chars of outerHTML):`, table.outerHTML.substring(0, 500) + "...");
      // Continue to the next table
    }
  });

  console.log(`scrapeMatchdayList: Function finished. Successfully collected ${extractedDates.length} dates.`);
  // console.log(extractedDates); // Optional: Log the final array

  // 3. Return results in the specified format
  return {
    data: extractedDates, // Array of date strings
    matchdayUrl: pageUrl // Return the original URL that was passed in
  };
}

module.exports = scrapeMatchdayList;