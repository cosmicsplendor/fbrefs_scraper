const season = 2015
const urls = Array(38).fill(0).map((_, i) => 
  `https://footballapi.pulselive.com/football/standings?compSeasons=${season - 2015 + 42}&altIds=true&detail=2&FOOTBALL_COMPETITION=1&gameweekNumbers=1-${i + 1}`
)
Promise.all(urls.map(url => fetch(url).then(d => d.json())))
  .then(result => {
    const finalData = result.map((data, i) => ({
      date: `MD${i + 1}`,
      data: data.tables[0].entries.map(d => ({
        points: d.overall.points,
        name: d.team.shortName
      }))
    }))
    console.log(finalData) // 👈 this is the missing part
  })