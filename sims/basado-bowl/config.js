// Basado Bowl — tuning knobs.
//
// Everything here is data. To rebalance the game, change a number. To add a
// item, add one object to `spells` and handle it in game.js.

export const CONFIG = {
  maxSpells: 1,
  draftInterval: 5,
  defaultRounds: 5,

  // Every question is worth the same, regardless of its internal level.
  questionPoints: 100,
  questionSeconds: 30,
  suddenDeathSeconds: 15,
  jinxPenaltySeconds: 5,
  jinxTurns: 5,

  // Turn order is the array order: Blue -> Red -> Yellow.
  teams: [
    {
      id: 'blue',
      name: 'Blue',
      character: 'blue',
      color: '#1e6bff',
      soft: '#dcecff',
      ink: '#0b3a9e',
    },
    {
      id: 'red',
      name: 'Red',
      character: 'red',
      color: '#ff3b5c',
      soft: '#ffe1e7',
      ink: '#9e0b2b',
    },
    {
      id: 'yellow',
      name: 'Yellow',
      character: 'yellow',
      color: '#ffd23f',
      soft: '#fff6c9',
      ink: '#713f12',
    },
  ],

  categories: [
    {
      id: 'SCI',
      name: 'Inquiry',
      short: 'SCI',
      icon: 'sci',
      color: '#1e6bff',
      blurb: 'Observation, units, measurement, graphs',
    },
    {
      id: 'KIN',
      name: 'Kinematics',
      short: 'KIN',
      icon: 'kin',
      color: '#18a96b',
      blurb: 'Position, speed, velocity, acceleration, graphs',
    },
    {
      id: 'FOR',
      name: 'Forces',
      short: 'FOR',
      icon: 'for',
      color: '#ff3b5c',
      blurb: "Newton's laws, gravity, friction, equilibrium",
    },
    {
      id: 'ENE',
      name: 'Machines',
      short: 'ENE',
      icon: 'ene',
      color: '#a855f7',
      blurb: 'Levers, pulleys, ramps, work, efficiency',
    },
    {
      id: 'ELE',
      name: 'Electricity',
      short: 'ELE',
      icon: 'ele',
      color: '#f59e0b',
      blurb: 'Charge, circuits, current, voltage, resistance',
    },
    {
      id: 'WAV',
      name: 'Waves',
      short: 'WAV',
      icon: 'wav',
      color: '#06b6d4',
      blurb: 'Wave properties, sound, light, interference',
    },
  ],

  // The four items. Each team holds one at a time and drafts again every 5 rounds.
  spells: [
    {
      id: 'shield',
      name: 'Shield',
      short: 'Shield',
      icon: 'shield',
      color: '#41e0ff',
      type: 'passive',
      desc: 'Block one spell.',
      draftDesc: 'Block one spell.',
    },
    {
      id: 'double',
      name: 'Double Down',
      short: 'Double',
      icon: 'bolt',
      color: '#ffd23f',
      type: 'self',
      desc: 'Double the points from your next correct answer.',
      draftDesc: 'Double your next correct answer.',
    },
    {
      id: 'missile',
      name: 'Magic Missile',
      short: 'Missile',
      icon: 'missile',
      color: '#f97316',
      type: 'attack',
      desc: 'Target loses 100 points.',
      draftDesc: 'Target loses 100 points.',
    },
    {
      id: 'jinx',
      name: 'Jinx',
      short: 'Jinx',
      icon: 'jinx',
      color: '#a855f7',
      type: 'attack',
      desc: 'Target loses 5 s for 5 turns.',
      draftDesc: 'Target loses 5 s for 5 turns.',
    },
  ],
};

export const SPELL_BY_ID = Object.fromEntries(CONFIG.spells.map((spell) => [spell.id, spell]));
export const CATEGORY_BY_ID = Object.fromEntries(
  CONFIG.categories.map((category) => [category.id, category])
);
