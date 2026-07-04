// catalog.js — POE2 Filter Studio item catalog (pure data, no imports).
//
// Every Class and BaseType string below is verified against real sources:
//   - NeverSink's PoE2 filter (NeverSink-Filter-for-PoE2, 1-REGULAR, fetched 2026-07-03)
//   - John's filter: test/fixtures/John-T1-Monk.filter (tier lists pre-verified 2026-06-26..07-01)
// No invented names. Entries whose items have no Class line in NeverSink's filter
// (relics, reliquary keys, trial keys) are kind:'special' with BaseType-only conditions.

export const CATALOG = [
  {
    id: 'currency',
    label: 'Currency',
    entries: [
      // --- individual chase / staple bases (Class "Stackable Currency") ---
      { id: 'cur-mirror', label: 'Mirror of Kalandra', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Mirror of Kalandra'] },
      { id: 'cur-divine', label: 'Divine Orb', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Divine Orb'] },
      { id: 'cur-perfect-jewellers', label: "Perfect Jeweller's Orb", kind: 'basetype', class: 'Stackable Currency', baseTypes: ["Perfect Jeweller's Orb"] },
      { id: 'cur-fracturing', label: 'Fracturing Orb', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Fracturing Orb'] },
      { id: 'cur-hinekoras-lock', label: "Hinekora's Lock", kind: 'basetype', class: 'Stackable Currency', baseTypes: ["Hinekora's Lock"] },
      { id: 'cur-annulment', label: 'Orb of Annulment', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Orb of Annulment'] },
      { id: 'cur-chance', label: 'Orb of Chance', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Orb of Chance'] },
      { id: 'cur-chaos', label: 'Chaos Orb', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Chaos Orb'] },
      { id: 'cur-exalted', label: 'Exalted Orb', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Exalted Orb'] },
      { id: 'cur-vaal', label: 'Vaal Orb', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Vaal Orb'] },
      { id: 'cur-greater-jewellers', label: "Greater Jeweller's Orb", kind: 'basetype', class: 'Stackable Currency', baseTypes: ["Greater Jeweller's Orb"] },
      { id: 'cur-gold', label: 'Gold', kind: 'basetype', class: 'Stackable Currency', baseTypes: ['Gold'] },
      // --- tier packs, seeded from John-T1-Monk.filter (value groupings from NeverSink) ---
      { id: 'cur-pack-s', label: 'S-tier pack (jackpot)', kind: 'basetype', class: 'Stackable Currency', baseTypes: [
        'Albino Rhoa Feather', 'Altered Collarbone', 'Ancient Collarbone', 'Ancient Jawbone', 'Ancient Rib',
        'Divine Orb', 'Fracturing Orb', "Hinekora's Lock", 'Mirror of Kalandra', 'Orb of Extraction',
        'Perfect Chaos Orb', 'Perfect Exalted Orb', "Perfect Jeweller's Orb", 'Vaal Cultivation Orb'
      ] },
      { id: 'cur-pack-high', label: 'High pack', kind: 'basetype', class: 'Stackable Currency', baseTypes: [
        'Ancient Infuser', "Architect's Orb", 'Chaos Orb', 'Core Destabiliser', 'Crystallised Corruption',
        'Greater Chaos Orb', 'Greater Exalted Orb', "Kamasa's Orb of Sacrifice", "Kopec's Orb of Sacrifice",
        'Orb of Annulment', 'Orb of Chance', 'Perfect Orb of Augmentation', 'Perfect Orb of Transmutation',
        'Perfect Regal Orb', 'Preserved Collarbone', 'Preserved Cranium', 'Preserved Rib',
        "Vaal Armourer's Infuser", "Vaal Blacksmith's Infuser", 'Vaal Catalysing Infuser',
        "Yaomac's Orb of Sacrifice", "Yugul's Orb of Sacrifice"
      ] },
      { id: 'cur-pack-mid', label: 'Mid pack', kind: 'basetype', class: 'Stackable Currency', baseTypes: [
        "Armourer's Scrap", "Artificer's Orb", "Blacksmith's Whetstone", 'Chance Shard', 'Exalted Orb',
        "Gemcutter's Prism", "Glassblower's Bauble", 'Gnawed Collarbone', 'Gnawed Jawbone', 'Gnawed Rib',
        "Greater Jeweller's Orb", 'Greater Orb of Augmentation', 'Greater Orb of Transmutation',
        'Greater Regal Orb', 'Orb of Alchemy', 'Preserved Jawbone', 'Regal Orb',
        "Vaal Arcanist's Infuser", 'Vaal Orb', 'Vaal Siphoner'
      ] },
      { id: 'cur-all', label: 'All currency (class)', kind: 'class', classes: ['Stackable Currency'] }
    ]
  },
  {
    id: 'runes',
    label: 'Runes & Soul Cores',
    entries: [
      // BaseType with op '' = substring match (e.g. "Soul Core" matches every soul core base)
      { id: 'rune-soulcores-idols', label: 'Soul Cores & Idols (chase)', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Augment'] },
        { type: 'BaseType', op: '', values: ['Soul Core', 'Idol'] }
      ] },
      { id: 'rune-greater', label: 'Greater runes', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Augment'] },
        { type: 'BaseType', op: '', values: ['Greater'] }
      ] },
      { id: 'rune-all', label: 'All runes & cores (class)', kind: 'class', classes: ['Augment'] }
    ]
  },
  {
    id: 'waystones',
    label: 'Waystones',
    entries: [
      { id: 'way-t15plus', label: 'T15+ (top maps)', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Waystones'] },
        { type: 'WaystoneTier', op: '>=', value: 15 }
      ] },
      { id: 'way-t11-14', label: 'T11-14', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Waystones'] },
        { type: 'WaystoneTier', op: '>=', value: 11 },
        { type: 'WaystoneTier', op: '<=', value: 14 }
      ] },
      { id: 'way-t6-10', label: 'T6-10', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Waystones'] },
        { type: 'WaystoneTier', op: '>=', value: 6 },
        { type: 'WaystoneTier', op: '<=', value: 10 }
      ] },
      { id: 'way-t1-5', label: 'T1-5', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Waystones'] },
        { type: 'WaystoneTier', op: '<=', value: 5 }
      ] },
      { id: 'way-all', label: 'All waystones (class)', kind: 'class', classes: ['Waystones'] }
    ]
  },
  {
    id: 'gems',
    label: 'Gems',
    entries: [
      { id: 'gem-skill', label: 'Skill Gems', kind: 'class', classes: ['Skill Gems'] },
      { id: 'gem-support', label: 'Support Gems', kind: 'class', classes: ['Support Gems'] },
      { id: 'gem-all', label: 'All gems', kind: 'class', classes: ['Skill Gems', 'Support Gems'] }
    ]
  },
  {
    id: 'jewellery',
    label: 'Jewellery & Jewels',
    entries: [
      { id: 'jwl-amulets', label: 'Amulets', kind: 'class', classes: ['Amulets'] },
      { id: 'jwl-rings', label: 'Rings', kind: 'class', classes: ['Rings'] },
      { id: 'jwl-belts', label: 'Belts', kind: 'class', classes: ['Belts'] },
      { id: 'jwl-jewels', label: 'Jewels', kind: 'class', classes: ['Jewels'] },
      { id: 'jwl-rare', label: 'Rare jewellery & jewels', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Amulets', 'Rings', 'Belts', 'Jewels'] },
        { type: 'Rarity', op: '', values: ['Rare'] }
      ] }
    ]
  },
  {
    id: 'flasks',
    label: 'Flasks & Charms',
    entries: [
      { id: 'flask-life', label: 'Life Flasks', kind: 'class', classes: ['Life Flasks'] },
      { id: 'flask-mana', label: 'Mana Flasks', kind: 'class', classes: ['Mana Flasks'] },
      { id: 'flask-charms', label: 'Charms', kind: 'class', classes: ['Charms'] },
      { id: 'flask-upgrades', label: 'Magic/Rare flasks & charms', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Life Flasks', 'Mana Flasks', 'Charms'] },
        { type: 'Rarity', op: '', values: ['Magic', 'Rare'] }
      ] }
    ]
  },
  {
    id: 'weapons',
    label: 'Weapons',
    entries: [
      { id: 'wpn-quarterstaves', label: 'Quarterstaves', kind: 'class', classes: ['Quarterstaves'] },
      { id: 'wpn-1h-maces', label: 'One Hand Maces', kind: 'class', classes: ['One Hand Maces'] },
      { id: 'wpn-2h-maces', label: 'Two Hand Maces', kind: 'class', classes: ['Two Hand Maces'] },
      { id: 'wpn-sceptres', label: 'Sceptres', kind: 'class', classes: ['Sceptres'] },
      { id: 'wpn-staves', label: 'Staves', kind: 'class', classes: ['Staves'] },
      { id: 'wpn-wands', label: 'Wands', kind: 'class', classes: ['Wands'] },
      { id: 'wpn-bows', label: 'Bows', kind: 'class', classes: ['Bows'] },
      { id: 'wpn-crossbows', label: 'Crossbows', kind: 'class', classes: ['Crossbows'] },
      { id: 'wpn-spears', label: 'Spears', kind: 'class', classes: ['Spears'] },
      { id: 'wpn-talismans', label: 'Talismans', kind: 'class', classes: ['Talismans'] },
      { id: 'wpn-fishing-rods', label: 'Fishing Rods', kind: 'class', classes: ['Fishing Rods'] }
    ]
  },
  {
    id: 'armour',
    label: 'Armour',
    entries: [
      { id: 'arm-body', label: 'Body Armours', kind: 'class', classes: ['Body Armours'] },
      { id: 'arm-helmets', label: 'Helmets', kind: 'class', classes: ['Helmets'] },
      { id: 'arm-gloves', label: 'Gloves', kind: 'class', classes: ['Gloves'] },
      { id: 'arm-boots', label: 'Boots', kind: 'class', classes: ['Boots'] },
      // Defence-profile specials. Filter conditions AND together, so a pure profile
      // needs the other defences pinned to 0 (op '' = equals), e.g. pure Evasion =
      // BaseArmour 0 + BaseEnergyShield 0 + BaseEvasion > 0. One special per profile.
      { id: 'arm-prof-armour', label: 'Armour only', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
        { type: 'BaseEvasion', op: '', value: 0 },
        { type: 'BaseEnergyShield', op: '', value: 0 },
        { type: 'BaseArmour', op: '>', value: 0 }
      ] },
      { id: 'arm-prof-evasion', label: 'Evasion only', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
        { type: 'BaseArmour', op: '', value: 0 },
        { type: 'BaseEnergyShield', op: '', value: 0 },
        { type: 'BaseEvasion', op: '>', value: 0 }
      ] },
      { id: 'arm-prof-es', label: 'Energy Shield only', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
        { type: 'BaseArmour', op: '', value: 0 },
        { type: 'BaseEvasion', op: '', value: 0 },
        { type: 'BaseEnergyShield', op: '>', value: 0 }
      ] },
      { id: 'arm-prof-armour-evasion', label: 'Armour/Evasion', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
        { type: 'BaseEnergyShield', op: '', value: 0 },
        { type: 'BaseArmour', op: '>', value: 0 },
        { type: 'BaseEvasion', op: '>', value: 0 }
      ] },
      { id: 'arm-prof-armour-es', label: 'Armour/ES', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
        { type: 'BaseEvasion', op: '', value: 0 },
        { type: 'BaseArmour', op: '>', value: 0 },
        { type: 'BaseEnergyShield', op: '>', value: 0 }
      ] },
      { id: 'arm-prof-evasion-es', label: 'Evasion/ES', kind: 'special', conditions: [
        { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
        { type: 'BaseArmour', op: '', value: 0 },
        { type: 'BaseEvasion', op: '>', value: 0 },
        { type: 'BaseEnergyShield', op: '>', value: 0 }
      ] }
    ]
  },
  {
    id: 'offhands',
    label: 'Off-hands & Quivers',
    entries: [
      { id: 'off-shields', label: 'Shields', kind: 'class', classes: ['Shields'] },
      { id: 'off-foci', label: 'Foci', kind: 'class', classes: ['Foci'] },
      { id: 'off-bucklers', label: 'Bucklers', kind: 'class', classes: ['Bucklers'] },
      { id: 'off-quivers', label: 'Quivers', kind: 'class', classes: ['Quivers'] }
    ]
  },
  {
    id: 'uniques',
    label: 'Uniques',
    entries: [
      { id: 'uni-all', label: 'All uniques', kind: 'special', conditions: [
        { type: 'Rarity', op: '', values: ['Unique'] }
      ] }
    ]
  },
  {
    id: 'other',
    label: 'Other valuables',
    entries: [
      { id: 'oth-omens', label: 'Omens', kind: 'class', classes: ['Omen'] },
      { id: 'oth-logbooks', label: 'Expedition Logbooks', kind: 'class', classes: ['Expedition Logbook'] },
      { id: 'oth-pinnacle-keys', label: 'Pinnacle Keys', kind: 'class', classes: ['Pinnacle Keys'] },
      { id: 'oth-vault-keys', label: 'Vault Keys', kind: 'class', classes: ['Vault Keys'] },
      { id: 'oth-tablets', label: 'Tablets', kind: 'class', classes: ['Tablet'] },
      { id: 'oth-map-fragments', label: 'Map Fragments', kind: 'class', classes: ['Map Fragments'] },
      { id: 'oth-incubators', label: 'Incubators', kind: 'class', classes: ['Incubators'] },
      { id: 'oth-quest-items', label: 'Quest & instance items', kind: 'class', classes: ['Quest Items', 'Instance Local Items'] },
      // No Class line exists for these in NeverSink's filter — BaseType-only specials.
      { id: 'oth-relics', label: 'Relics (Trial of the Sekhemas)', kind: 'special', conditions: [
        { type: 'BaseType', op: '==', values: ['Amphora Relic', 'Coffer Relic', 'Incense Relic', 'Seal Relic', 'Tapestry Relic', 'Urn Relic', 'Vase Relic'] }
      ] },
      { id: 'oth-trial-keys', label: 'Trial keys (Barya / Ultimatum)', kind: 'special', conditions: [
        { type: 'BaseType', op: '==', values: ['Djinn Barya', 'Inscribed Ultimatum'] }
      ] },
      { id: 'oth-reliquary-keys', label: 'Reliquary Keys', kind: 'special', conditions: [
        { type: 'BaseType', op: '==', values: ["Olroth's Reliquary Key", 'Ritualistic Reliquary Key', "Tangmazu's Reliquary Key", "The Arbiter's Reliquary Key", "The Trialmaster's Reliquary Key", "Xesht's Reliquary Key", "Zarokh's Reliquary Key"] }
      ] }
    ]
  }
];

export const RARITIES = ['Normal', 'Magic', 'Rare', 'Unique'];

// UI swatch approximations only — never written to filter output.
export const ALERT_COLORS = {
  Red:    [220, 40, 40],
  Green:  [80, 200, 80],
  Blue:   [80, 120, 255],
  Brown:  [150, 100, 50],
  White:  [240, 240, 240],
  Yellow: [255, 215, 60],
  Cyan:   [0, 210, 210],
  Grey:   [130, 130, 130],
  Orange: [255, 150, 40],
  Pink:   [255, 110, 190],
  Purple: [175, 80, 255]
};

export const MINIMAP_SHAPES = ['Circle', 'Diamond', 'Hexagon', 'Square', 'Star', 'Triangle', 'Cross', 'Moon', 'Raindrop', 'Kite', 'Pentagon', 'UpsideDownHouse'];

export const SOUNDS = [
  { id: 1, label: 'Alert 1' },
  { id: 2, label: 'Alert 2' },
  { id: 3, label: 'Alert 3' },
  { id: 4, label: 'Alert 4' },
  { id: 5, label: 'Alert 5' },
  { id: 6, label: 'Alert 6' },
  { id: 7, label: 'Alert 7' },
  { id: 8, label: 'Alert 8' },
  { id: 9, label: 'Alert 9' },
  { id: 10, label: 'Alert 10' },
  { id: 11, label: 'Alert 11' },
  { id: 12, label: 'Alert 12' },
  { id: 13, label: 'Alert 13' },
  { id: 14, label: 'Alert 14' },
  { id: 15, label: 'Alert 15' },
  { id: 16, label: 'Alert 16' }
];
