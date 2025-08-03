const METRIC_WEIGHTS = {
  // Category for what the player ACTUALLY produced on the scoresheet.
  // All metrics here are mutually exclusive.
  goals: {
    goals: 1,          // Still valuable, but less so than an open-play goal.
  },
  goalContribution: {
    goals: 1,          // Still valuable, but less so than an open-play goal.
    assists: 1,
  },
  
  // Category for the underlying quality of chances created and taken.
  // This measures process, not just outcome.
  expectedPerformance: {
    npxg: 10.0,      // Non-Penalty Expected Goals.
    xg_assist: 10.0, // Expected Assists.
  },

  // Category for actions that lead to shots but aren't the final pass/shot.
  // GCA/SCA are counts of involvement.
  creationAndThreat: {
    gca: 8.0,        // Goal-Creating Actions (value is high).
    sca: 3.0,        // Shot-Creating Actions (value is volume-based).
    shotsOnTarget: 2.0,
    shots: 1.0,
  },

  // Category for moving the ball into dangerous areas.
  ballProgression: {
    progressive_carries: 1.5,
    progressive_passes: 1.5,
    take_ons_won: 2.0,
  },

  // Defensive contributions.
  defense: {
    tackles: 3.0,
    interceptions: 3.0,
    blocks: 2.5,
  },
  
  // Negative actions.
  negativeImpact: {
    cards_yellow: -5.0,
    cards_red: -20.0,
  }
};
module.exports = METRIC_WEIGHTS