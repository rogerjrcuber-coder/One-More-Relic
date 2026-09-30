export const weapons = {
  wand:{damage:23,rate:.42,speed:440,spread:[0],pierce:2,color:'#f1bf79'},
  repeater:{damage:10,rate:.15,speed:600,spread:[0],pierce:1,color:'#c7e3a8'},
  scatter:{damage:13,rate:.58,speed:370,spread:[-.23,0,.23],pierce:1,color:'#c6b4ed'}
};
export const relics=['echo','cinder','beetle','crown','moss','storm','fang','quill'];
export const upgrades=['rapid','critical','poison','fire','dash','shield','triple','ice','chain'];
export const biomes = {
  moss:{name:'The Mosskeep',floor:'#1c2b20',wall:'#43513b',color:'#b4d48f',hazard:'roots',boss:'The Mosskeeper',enemies:['Briar stalker','Thorn spitter','Root ram','Vault sentinel']},
  crystal:{name:'Crystal Caverns',floor:'#172238',wall:'#526c94',color:'#8ed8fb',hazard:'crystal',boss:'The Crystal King',enemies:['Crystal charger','Shard spitter','Prism mage','Quartz tank']},
  sunken:{name:'Sunken Ruins',floor:'#102c35',wall:'#44717a',color:'#81cfce',hazard:'water',boss:'The Drowned Regent',enemies:['Drowned prowler','Tide spitter','Coral ram','Abyss watcher']},
  forge:{name:'Infernal Forge',floor:'#321d19',wall:'#795043',color:'#f6a16c',hazard:'lava',boss:'The Furnace Heart',enemies:['Cinder runner','Slag spitter','Iron charger','Furnace sentinel']},
  gardens:{name:'Forgotten Gardens',floor:'#202719',wall:'#5b7141',color:'#b7d77a',hazard:'poison',boss:'The Verdant Queen',enemies:['Vine stalker','Poison bloom','Bramble ram','Root guardian']}
};
export type Biome = keyof typeof biomes;
export const events=['Darkness','Treasure','Elite hunt','Double keys','Empowered boss','Wandering merchant'] as const;
export const duelArenas=[
  {name:'Ancient Garden',biome:'gardens',shape:'cross',cover:2},
  {name:'Lava Core',biome:'forge',shape:'ring',cover:3},
  {name:'Crystal Cavern',biome:'crystal',shape:'lanes',cover:2},
  {name:'Ruined Temple',biome:'moss',shape:'cross',cover:4},
  {name:'Frozen Fortress',biome:'crystal',shape:'fort',cover:3},
  {name:'Shadow Arena',biome:'moss',shape:'ring',cover:5},
  {name:'Sunken Ruins',biome:'sunken',shape:'lanes',cover:4},
  {name:'Storm Citadel',biome:'crystal',shape:'fort',cover:2},
  {name:'Void Platform',biome:'sunken',shape:'ring',cover:1},
  {name:'Forgotten Keep',biome:'gardens',shape:'fort',cover:5},
  {name:'Mirror Court',biome:'crystal',shape:'cross',cover:1},
  {name:'Skybridge',biome:'sunken',shape:'lanes',cover:1},
  {name:'Ember Warrens',biome:'forge',shape:'fort',cover:6},
  {name:'Windfield',biome:'gardens',shape:'open',cover:1}
] as const;
export const wavesArenas=[
  {name:'Root Ring',biome:'moss',shape:'ring',cover:2},
  {name:'Glass Causeway',biome:'crystal',shape:'lanes',cover:2},
  {name:'Lantern Pit',biome:'moss',shape:'cross',cover:3},
  {name:'Crooked Crown',biome:'gardens',shape:'fort',cover:2},
  {name:'Moss Circuit',biome:'moss',shape:'ring',cover:4},
  {name:'Ember Cross',biome:'forge',shape:'cross',cover:2},
  {name:'Flooded Vault',biome:'sunken',shape:'fort',cover:3},
  {name:'Hollow Spiral',biome:'moss',shape:'lanes',cover:3},
  {name:'Thorn Gallery',biome:'gardens',shape:'lanes',cover:4},
  {name:'Last Reliquary',biome:'crystal',shape:'open',cover:4},
  {name:'Corrupted Courtyard',biome:'gardens',shape:'cross',cover:4},
  {name:'The Furnace',biome:'forge',shape:'ring',cover:4},
  {name:'Collapsed Fortress',biome:'moss',shape:'fort',cover:5},
  {name:'Crystal Basin',biome:'crystal',shape:'open',cover:3}
] as const;
