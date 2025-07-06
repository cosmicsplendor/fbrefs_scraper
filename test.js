const fs = require('fs');
const path = require('path');

// Define the source directory and the output file path
const testDir = path.join(__dirname, 'test');
const outputFile = path.join(__dirname, 'final.json');

try {
    // 1. Read all filenames from the 'test' directory
    const allFiles = fs.readdirSync(testDir);

    // Filter for .json files only, in case other files are present (e.g., .DS_Store)
    const jsonFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.json');
    
    if (jsonFiles.length === 0) {
        console.log("No JSON files found in the 'test' directory.");
        return;
    }

    console.log(`Found ${jsonFiles.length} JSON files to process...`);

    let combinedPlayers = [];

    // 2. Loop through each JSON file
    for (const file of jsonFiles) {
        const filePath = path.join(testDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        try {
            const playersFromFile = JSON.parse(fileContent);
            
            // 3. Slice the top 8 players and add them to our combined list
            if (Array.isArray(playersFromFile)) {
                const top8 = playersFromFile.slice(0, 8);
                combinedPlayers.push(...top8);
            } else {
                console.warn(`! Warning: ${file} does not contain a JSON array. Skipping.`);
            }
        } catch (e) {
            console.warn(`! Warning: Could not parse JSON from ${file}. Skipping.`);
        }
    }

    // 4. Generate unique data using a Map (efficient for uniqueness by a key)
    const uniquePlayersMap = new Map();
    for (const player of combinedPlayers) {
        // The Map will only store the *first* entry for any given name.
        if (player && player.name && !uniquePlayersMap.has(player.name)) {
            uniquePlayersMap.set(player.name, player);
        }
    }

    // Convert the Map values back to an array
    const uniquePlayersArray = Array.from(uniquePlayersMap.values());

    console.log(`\nCollected ${combinedPlayers.length} players in total.`);
    console.log(`Found ${uniquePlayersArray.length} unique players.`);

    // 5. Store the output to 'final.json' with pretty formatting
    fs.writeFileSync(outputFile, JSON.stringify(uniquePlayersArray, null, 2), 'utf-8');

    console.log(`\n✅ Success! Unique data has been saved to '${outputFile}'.`);

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`Error: The directory '${testDir}' does not exist. Please create it.`);
    } else {
        console.error("An unexpected error occurred:", error);
    }
}