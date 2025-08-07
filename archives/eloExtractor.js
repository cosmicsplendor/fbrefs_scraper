const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function processEloRankings() {
  const inputFile = 'EloRatings.csv';
  const outputFile = 'test.json';
  
  // Map to store data grouped by date
  const dateGroups = new Map();
  
  try {
    // Create readline interface for streaming
    const fileStream = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let isFirstLine = true;
    let lineCount = 0;
    
    console.log('Processing CSV file...');
    
    for await (const line of rl) {
      // Skip header line
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      
      lineCount++;
      
      // Parse CSV line (handle quoted values)
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      
      if (matches && matches.length >= 4) {
        const date = matches[0].replace(/"/g, '');
        const club = matches[1].replace(/"/g, '');
        const country = matches[2].replace(/"/g, '');
        const elo = parseFloat(matches[3].replace(/"/g, ''));
        
        // Skip invalid entries
        if (isNaN(elo)) continue;
        
        // Group by date
        if (!dateGroups.has(date)) {
          dateGroups.set(date, []);
        }
        
        dateGroups.get(date).push({
          name: club,
          value: elo,
          country: country
        });
      }
      
      // Progress indicator
      if (lineCount % 10000 === 0) {
        console.log(`Processed ${lineCount} lines...`);
      }
    }
    
    console.log(`Total lines processed: ${lineCount}`);
    console.log(`Unique dates found: ${dateGroups.size}`);
    
    // Process each date group to get top 14
    const result = [];
    
    for (const [date, clubs] of dateGroups) {
      // Sort by ELO rating (descending) and take top 14
      const top14 = clubs
        .sort((a, b) => b.value - a.value)
        .slice(0, 14)
        .map(club => ({
          name: club.name,
          value: club.value
        }));
      
      result.push({
        date: date,
        data: top14
      });
    }
    
    // Sort results by date
    result.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Write to JSON file
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    
    console.log(`Results saved to ${outputFile}`);
    console.log(`Total date entries: ${result.length}`);
    
    // Show sample of first entry
    if (result.length > 0) {
      console.log('\nSample output (first date):');
      console.log(JSON.stringify(result[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error processing file:', error.message);
  }
}

// Run the processor
processEloRankings();