const fs = require('fs')
const csv = require('csv-parser')
const path = require('path')

// Configuration
const INPUT_FILE = 'worldcup_goals.csv'
const OUTPUT_FILE = 'player_goals_race_data.json'

// Country name normalization mapping (for player team)
const COUNTRY_MAPPINGS = {
  'West Germany': 'Germany',
  'East Germany': 'Germany',
  'German DR': 'Germany',
  'Germany FR': 'Germany',
  'Soviet Union': 'Russia',
  'USSR': 'Russia',
  'Russian Federation': 'Russia',
  'Yugoslavia': 'Serbia',
  'Serbia and Montenegro': 'Serbia',
  'Czechoslovakia': 'Czech Republic',
  'Czech Republic': 'Czech Republic',
  'Czechia': 'Czech Republic'
}

// Data structures
const playerGoals = new Map() // player_id -> {name, country, Map(year -> Map(stage -> goal_count)) }
const tournaments = new Map() // tournament_name -> year
const stages = new Set() // collect all stage names

function processGoalsData() {
  return new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_FILE)
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: true
      }))
      .on('data', (row) => {
        try {
          const tournamentName = row.tournament_name?.trim()
          const yearMatch = tournamentName?.match(/(\d{4})/)
          if (!yearMatch) return

          const year = parseInt(yearMatch[1])
          const playerId = row.player_id?.trim()
          let country = row.player_team_name?.trim()
          const stage = row.stage_name?.trim() || 'Unknown Stage'

          if (!playerId || !country || !year) return
          country = COUNTRY_MAPPINGS[country] || country

          tournaments.set(tournamentName, year)
          stages.add(stage)

          if (!playerGoals.has(playerId)) {
            playerGoals.set(playerId, {
              name: `${row.given_name?.trim()} ${row.family_name?.trim()}`.trim(),
              country,
              goalsByYearStage: new Map()
            })
          }

          const playerData = playerGoals.get(playerId)

          if (!playerData.goalsByYearStage.has(year)) {
            playerData.goalsByYearStage.set(year, new Map())
          }
          const yearStages = playerData.goalsByYearStage.get(year)

          if (!yearStages.has(stage)) {
            yearStages.set(stage, 0)
          }

          yearStages.set(stage, yearStages.get(stage) + 1)
        } catch (error) {
          console.warn('Error processing row:', error.message)
        }
      })
      .on('end', () => {
        console.log('✅ CSV parsing complete')
        console.log(`👥 Found ${playerGoals.size} players`)
        console.log(`📅 Tournaments: ${Array.from(tournaments.values()).sort().join(', ')}`)
        console.log(`🎭 Stages: ${Array.from(stages).join(', ')}`)
        resolve()
      })
      .on('error', reject)
  })
}

function generateRaceData() {
  const allYears = new Set()
  tournaments.forEach(year => allYears.add(year))
  const sortedYears = Array.from(allYears).sort((a, b) => a - b)

  // desired stage order
  const stageOrder = [
    'Group Stage',
    'Round of 16',
    'Quarter-finals',
    'Semi-finals',
    'Final'
  ]

  console.log(`🏃 Generating player race data by year+stage`)

  const raceData = []
  const cumulativeGoals = new Map()

  playerGoals.forEach((_, playerId) => cumulativeGoals.set(playerId, 0))

  sortedYears.forEach(year => {
    stageOrder.forEach(stage => {
      // add goals for this stage
      playerGoals.forEach((playerData, playerId) => {
        const yearStages = playerData.goalsByYearStage.get(year) || new Map()
        const goalsThisStage = yearStages.get(stage) || 0
        const currentCumulative = cumulativeGoals.get(playerId) || 0
        cumulativeGoals.set(playerId, currentCumulative + goalsThisStage)
      })

      // snapshot
      const stageData = {
        date: `${stage} ${year}`,
        data: Array.from(cumulativeGoals.entries())
          .map(([playerId, goals]) => {
            const playerData = playerGoals.get(playerId)
            return {
              name: playerData.name,
              country: playerData.country,
              value: goals
            }
          })
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value)
      }

      // only push if stage had at least one goal
      if (stageData.data.length > 0) {
        raceData.push(stageData)
      }
    })
  })

  return raceData
}

function saveResults(raceData) {
  try {
    const jsonOutput = JSON.stringify(raceData, null, 2)
    fs.writeFileSync(OUTPUT_FILE, jsonOutput)

    console.log(`✅ Results saved to ${OUTPUT_FILE}`)
    console.log(`📁 File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`)

    const final = raceData[raceData.length - 1]
    console.log(`\n🏆 Final Rankings (${final.date}):`)
    final.data.slice(0, 10).forEach((player, i) => {
      console.log(`${i + 1}. ${player.name} (${player.country}): ${player.value} goals`)
    })
  } catch (error) {
    console.error('❌ Error saving file:', error.message)
  }
}

async function main() {
  try {
    console.log('🚀 Starting World Cup Player Goals Bar Race Data Generator')
    console.log(`📂 Processing: ${INPUT_FILE}`)

    if (!fs.existsSync(INPUT_FILE)) throw new Error(`Input file not found: ${INPUT_FILE}`)

    await processGoalsData()
    const raceData = generateRaceData()
    saveResults(raceData)
    console.log('🎉 Processing complete!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { processGoalsData, generateRaceData }
