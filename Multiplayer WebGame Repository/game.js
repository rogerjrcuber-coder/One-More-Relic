'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const W = 48, H = 34, TILE = 40, HOUR = 3600000;
  const STORE = 'one-more-relic:v1';
  const icons = {0:'·',1:'■',2:'⇧',3:'◎',4:'◆',5:'▣',6:'✹',7:'♜',8:'☀',9:'⚿',10:'▥',11:'♧'};
  const relics = [
    {id:'echo', name:'Echo Bell', icon:'♧', rarity:'UNCOMMON', text:'Every fifth attack fires an extra ghost volley.', stack:'Each copy adds another echo volley.', short:'Extra volleys every fifth attack', color:'#b0c8f0'},
    {id:'cinder', name:'Cinder Boots', icon:'♨', rarity:'COMMON', text:'Your dash leaves a trail that burns enemies.', stack:'Each copy adds 1 second of fire.', short:'Dash leaves a burning trail', color:'#f0a06b'},
    {id:'beetle', name:'Glass Beetle', icon:'◇', rarity:'UNCOMMON', text:'Defeated enemies release a seeking shard.', stack:'Each copy adds another shard.', short:'Kills release seeking shards', color:'#b6dcbe'},
    {id:'crown', name:'Hollow Crown', icon:'♛', rarity:'RARE', text:'Below half health, deal 35% more damage.', stack:'Each copy adds 35% bonus damage.', short:'More damage below half health', color:'#ddb6ef'},
    {id:'moss', name:'Moss Heart', icon:'♥', rarity:'COMMON', text:'Collecting treasure restores 3 health.', stack:'Each copy adds 3 healing.', short:'Treasure restores health', color:'#cee8a5'},
    {id:'storm', name:'Pocket Storm', icon:'ϟ', rarity:'RARE', text:'Every eighth direct hit bursts for 28 area damage.', stack:'Each copy expands the burst by 24 pixels.', short:'Repeated hits unleash lightning', color:'#e9d591'},
    {id:'fang', name:'Amber Fang', icon:'⌁', rarity:'COMMON', text:'All attacks deal 15% more damage.', stack:'Each copy adds 15% damage.', short:'More damage on every attack', color:'#e8b678'},
    {id:'quill', name:'Quick Quill', icon:'↟', rarity:'COMMON', text:'Fire your weapon 12% faster.', stack:'Stacks with diminishing returns.', short:'Faster attacks', color:'#b9d3bd'}
  ];
  const weapons = {wand:{name:'Ember wand',damage:23,rate:.42,speed:440,spread:[0],pierce:2,color:'#f1bf79'},repeater:{name:'Needle repeater',damage:10,rate:.15,speed:600,spread:[0],pierce:1,color:'#c7e3a8'},scatter:{name:'Shard lantern',damage:13,rate:.58,speed:370,spread:[-.23,0,.23],pierce:1,color:'#c6b4ed'}};
  const perks = {vigor:'Stout heart',swift:'Light feet',moss:'Moss blessing'};
  const upgrades = [
    {id:'rapid',name:'Quick Trigger',text:'+15% attack speed'},{id:'critical',name:'Lucky Edge',text:'+12% critical chance'},
    {id:'poison',name:'Venom Rounds',text:'Hits deal lingering poison damage'},{id:'fire',name:'Cinder Shot',text:'Hits splash fire damage'},
    {id:'dash',name:'Second Wind',text:'Gain an extra dash charge'},{id:'shield',name:'Ward Shell',text:'Block the next hit every 12 seconds'}
  ];
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  let storageOK = true, toastTimer, game = null, selectedMap, activeMapId = null;
  let sessionId = uid(), editor = null, tool = 1, editorDrawing = false, selectedCreature = null;
  let keys = new Set(), pointer = {x:0,y:0,down:false,seen:false}, stick = {x:0,y:0};
  let canvas = $('game'), ctx = canvas.getContext('2d'), view = {x:0,y:0,scale:1,w:1120,h:800};
  let lastFrame = performance.now(), lastHUD = 0, modalPause = false;
  const isTouch = () => matchMedia('(pointer:coarse)').matches;
  function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),4200);}
  function freshData(){return {version:1,presets:[],blueprints:[],maps:[],lastLoadout:{weapon:'wand',perk:'vigor'}};}
  function validLoadout(x){return x && Object.hasOwn(weapons,x.weapon) && Object.hasOwn(perks,x.perk);}
  const creatureDefaults = {
    stalker:{name:'Moss stalker',behavior:'chaser',hp:55,speed:62,damage:12,cooldown:1.8,shots:1,projectileSpeed:170,color:'#80926c',enrage:false},
    spitter:{name:'Briar spitter',behavior:'spitter',hp:45,speed:42,damage:9,cooldown:1.8,shots:3,projectileSpeed:165,color:'#c19a67',enrage:false},
    charger:{name:'Thorn ram',behavior:'charger',hp:90,speed:45,damage:18,cooldown:2.5,shots:1,projectileSpeed:170,color:'#c98572',enrage:false},
    sentry:{name:'Vault sentinel',behavior:'sentry',hp:70,speed:0,damage:11,cooldown:2.2,shots:3,projectileSpeed:190,color:'#80b9ba',enrage:false},
    keeper:{name:'The Mosskeeper',behavior:'fan',hp:650,speed:40,damage:20,cooldown:2.4,shots:5,projectileSpeed:155,color:'#aa86c0',enrage:true},
    seer:{name:'The Hollow Seer',behavior:'ring',hp:550,speed:30,damage:14,cooldown:2.8,shots:12,projectileSpeed:125,color:'#6cafbb',enrage:true},
    juggernaut:{name:'Rootbound Colossus',behavior:'charger',hp:850,speed:35,damage:25,cooldown:3,shots:5,projectileSpeed:140,color:'#bf8969',enrage:true}
  };
  const brushes = {4:clone(creatureDefaults.stalker),7:clone(creatureDefaults.keeper)};
  const dimensions = grid => ({w:grid[0].length,h:grid.length});
  function blankGrid(w=W,h=H){return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>x===0||y===0||x===w-1||y===h-1?1:0));}
  function validGrid(grid){return Array.isArray(grid)&&grid.length>=16&&grid.length<=44&&Array.isArray(grid[0])&&grid[0].length>=20&&grid[0].length<=64&&grid.every(row=>Array.isArray(row)&&row.length===grid[0].length&&row.every(t=>Number.isInteger(t)&&t>=0&&t<=11));}
  function sanitizeCreature(value,boss=false){
    const defaults=boss?creatureDefaults.keeper:creatureDefaults.stalker;
    const raw=value&&typeof value==='object'?value:{};
    const number=(key,min,max)=>typeof raw[key]==='number'&&Number.isFinite(raw[key])?clamp(raw[key],min,max):defaults[key];
    const behaviors=boss?['fan','ring','charger']:['chaser','spitter','charger','sentry'];
    return {name:typeof raw.name==='string'&&raw.name.trim()?raw.name.trim().slice(0,32):defaults.name,behavior:behaviors.includes(raw.behavior)?raw.behavior:defaults.behavior,
      hp:Math.round(number('hp',boss?80:10,boss?3000:500)),speed:number('speed',0,160),damage:number('damage',1,50),cooldown:number('cooldown',.6,8),
      shots:Math.round(number('shots',1,boss?20:8)),projectileSpeed:number('projectileSpeed',70,300),color:typeof raw.color==='string'&&/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color:defaults.color,enrage:boss&&typeof raw.enrage==='boolean'?raw.enrage:defaults.enrage};
  }
  function mapDetails(map){
    const creatures={};for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[0].length;x++)if([4,7].includes(map.grid[y][x])){
      const key=`${x},${y}`;creatures[key]=sanitizeCreature(map.creatures?.[key],map.grid[y][x]===7);
    }
    const legacy=map.chestSchema!=='v11',grid=legacy?map.grid.map(row=>row.map(tile=>tile===5?11:tile)):map.grid;
    const keep=(source,tile)=>Object.fromEntries(Object.entries(source&&typeof source==='object'?source:{}).filter(([key])=>{const [x,y]=key.split(',').map(Number);return grid[y]?.[x]===tile;}));
    const keyTypes=keep(map.keyTypes,9),doorTypes=keep(map.doorTypes,10),bosses=keep(map.bosses,7);
    const features=Array.isArray(map.features)?map.features.filter(f=>f&&f.kind==='merchant'&&Number.isFinite(f.x)&&Number.isFinite(f.y)).slice(0,20).map((f,i)=>({id:'merchant-'+i,kind:'merchant',x:Math.round(f.x/40)*40+20,y:Math.round(f.y/40)*40+20,value:clamp(Math.round(Number(f.value)||8),1,99)})):[];
    return {grid,creatures,keyTypes,doorTypes,bosses,features,lighting:['gloom','dark','bright'].includes(map.lighting)?map.lighting:'gloom',chestPricing:normalizeChestPricing(map.chestPricing),stageCount:clamp(Math.round(Number(map.stageCount)||2),2,5),chestSchema:'v11'};
  }
  // Additive v1 migration: older maps receive pricing defaults without changing their content.
  function normalizeChestPricing(value){
    const number=(key,fallback,min)=>typeof value?.[key]==='number'&&Number.isFinite(value[key])?clamp(Math.round(value[key]),min,999):fallback;
    return {baseCost:number('baseCost',3,0),increase:number('increase',2,1)};
  }
  function chestPrice(pricing,opened=0){return pricing.baseCost+pricing.increase*opened;}
  function nextChestCost(){return chestPrice(game.chestPricing,game.chestsOpened);}
  function chestPrompt(){const cost=nextChestCost(),action=isTouch()?'Tap OPEN':'Press E';return game.gold>=cost?`${action} · Open chest for ${cost} gold`:`Chest costs ${cost} gold · You have ${game.gold} · Need ${cost-game.gold} more`;}
  function normalize(data){
    if(!data||data.version!==1) throw new Error('This is not a One More Relic v1 save.');
    const out=freshData();
    out.presets=(Array.isArray(data.presets)?data.presets:[]).filter(x=>validLoadout(x)&&typeof x.name==='string').slice(0,20).map(x=>({id:typeof x.id==='string'?x.id:uid(),name:x.name.slice(0,32),weapon:x.weapon,perk:x.perk}));
    out.blueprints=(Array.isArray(data.blueprints)?data.blueprints:[]).filter(x=>validGrid(x.grid)&&typeof x.name==='string').slice(0,20).map(x=>({id:typeof x.id==='string'?x.id:uid(),name:x.name.slice(0,32),...mapDetails(x)}));
    out.maps=(Array.isArray(data.maps)?data.maps:[]).filter(x=>validGrid(x.grid)&&typeof x.name==='string'&&typeof x.id==='string'&&Number.isFinite(x.idleSince)).slice(0,20).map(x=>({id:x.id,name:x.name.slice(0,32),idleSince:x.idleSince,...mapDetails(x),sessions:x.sessions&&typeof x.sessions==='object'&&!Array.isArray(x.sessions)?x.sessions:{}}));
    if(validLoadout(data.lastLoadout))out.lastLoadout=data.lastLoadout;
    return out;
  }
  let volatileData=freshData();
  function readData(){if(!storageOK)return clone(volatileData);try {const raw=localStorage.getItem(STORE);return raw?normalize(JSON.parse(raw)):freshData();}catch {storageOK=false;return clone(volatileData);}}
  function writeData(data){volatileData=clone(data);try{localStorage.setItem(STORE,JSON.stringify(data));}catch{storageOK=false;toast('Browser storage is unavailable or full. Export a backup before closing.');}}
  function mutate(fn){const d=readData();fn(d);writeData(d);return d;}
  function sweepMaps(){
    let removed=0;
    mutate(d=>{const now=Date.now();d.maps=d.maps.filter(m=>{
      for(const [id,at] of Object.entries(m.sessions))if(!Number.isFinite(at)||now-at>15000){if(Number.isFinite(at))m.idleSince=Math.max(m.idleSince,at);delete m.sessions[id];}
      const keep=Object.keys(m.sessions).length>0||now-m.idleSince<HOUR;if(!keep)removed++;return keep;
    });});return removed;
  }
  function heartbeat(){if(!activeMapId)return;mutate(d=>{const m=d.maps.find(x=>x.id===activeMapId);if(m){m.sessions[sessionId]=Date.now();m.idleSince=Date.now();}});}
  function releaseMap(){if(!activeMapId)return;const id=activeMapId;activeMapId=null;mutate(d=>{const m=d.maps.find(x=>x.id===id);if(m){delete m.sessions[sessionId];m.idleSince=Date.now();}});}
  function demoMap(){
    const grid=blankGrid(),creatures={};
    for(const wallX of [9,18,28,38])for(let y=1;y<H-1;y++)if(![5,6,14,15,25,26].includes(y))grid[y][wallX]=1;
    for(const wallY of [10,21])for(let x=1;x<W-1;x++)if(![4,5,13,14,22,23,32,33,42,43].includes(x))grid[wallY][x]=1;
    for(const [x,y]of[[4,3],[5,3],[13,7],[14,7],[22,3],[23,3],[3,15],[4,15],[14,15],[24,16]])grid[y][x]=1;
    grid[5][3]=2;grid[29][44]=3;grid[27][42]=7;creatures['42,27']=clone(creatureDefaults.keeper);grid[5][13]=9;grid[5][18]=10;
    for(const [x,y]of[[6,6],[12,4],[16,8],[22,6],[6,13],[14,13],[21,15],[25,12],[16,17]])grid[y][x]=4;
    for(const [x,y]of[[3,7],[6,16],[12,6],[16,3],[15,16],[22,8],[25,17]])grid[y][x]=5;
    for(const [x,y]of[[8,5],[10,14],[17,5],[19,14],[22,12],[13,11]])grid[y][x]=6;
    for(const [i,[x,y]]of [[32,5],[35,8],[42,5],[44,15],[33,16],[25,25],[14,28],[6,26],[32,28],[39,25],[43,30],[23,18],[4,30],[35,25]].entries()){
      grid[y][x]=4;creatures[`${x},${y}`]=clone(creatureDefaults[['stalker','spitter','charger','sentry'][i%4]]);
    }
    for(const [x,y]of [[32,7],[43,7],[34,18],[43,17],[5,28],[15,30],[24,28],[33,30],[45,30]])grid[y][x]=5;
    for(const [x,y]of [[16,3],[22,8],[33,30]])grid[y][x]=11;
    for(const [x,y]of [[2,5],[7,8],[12,8],[24,4],[6,18],[16,18],[24,18],[30,4],[35,15],[44,9],[41,19],[7,24],[16,26],[25,31],[31,24],[40,28]])grid[y][x]=8;
    for(const [x,y]of [[30,5],[37,14],[39,26],[22,24],[14,24],[32,22]])grid[y][x]=6;
    return {id:'mosskeep',name:'The Mosskeep',grid,creatures,lighting:'gloom',stageCount:2,chestSchema:'v11',builtin:true};
  }
  const demo=demoMap();
  function allMaps(){return [demo,...readData().maps];}
  function updateMaps(prefer){sweepMaps();const previous=prefer||$('mapSelect').value;$('mapSelect').replaceChildren();for(const m of allMaps()){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;$('mapSelect').append(o);}if(allMaps().some(x=>x.id===previous))$('mapSelect').value=previous;selectMap();}
  function selectMap(){selectedMap=allMaps().find(m=>m.id===$('mapSelect').value)||demo;if(game&&game.status==='playing')return;$('arenaName').textContent=selectedMap.name.toUpperCase();$('mapSize').textContent=`${selectedMap.grid[0].length} × ${selectedMap.grid.length}`;$('mapKind').textContent=selectedMap.builtin?'CURATED DUNGEON':'YOUR PUBLISHED MAP';$('mapDescription').textContent=selectedMap.builtin?'A sprawling, torchlit vault. Bring a lantern; something waits in the far southeast.':'Your creation, ready for a local expedition. Saved blueprint kept separately.';}
  function showModal(title,eyebrow='ONE MORE RELIC'){
    $('modal').classList.remove('workshop-modal');
    if(game&&game.status==='playing'&&!game.paused){game.paused=true;modalPause=true;}
    keys.clear();pointer.down=false;stick={x:0,y:0};$('modalEyebrow').textContent=eyebrow;$('modalBody').replaceChildren();const h=document.createElement('h2');h.textContent=title;$('modalBody').append(h);if(!$('modal').open)$('modal').showModal();return $('modalBody');
  }
  function closeModal(){if($('modal').dataset.choice==='true')return;$('modal').close();}
  $('modalClose').onclick=closeModal;
  $('modal').addEventListener('cancel',e=>{if($('modal').dataset.choice==='true')e.preventDefault();});
  $('modal').addEventListener('close',()=>{if(modalPause&&game&&game.status==='playing')game.paused=false;modalPause=false;keys.clear();pointer.down=false;stick={x:0,y:0};$('pause').textContent=game?.paused?'Resume ▷':'Pause Ⅱ';});
  function paragraph(parent,text,cls='modal-copy'){const p=document.createElement('p');p.className=cls;p.textContent=text;parent.append(p);return p;}
  function button(parent,text,handler,cls='subtle'){const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=handler;parent.append(b);return b;}
  function relicCard(r,count=0){const card=document.createElement('div');card.className='codex-card';const icon=document.createElement('span');icon.className='relic-icon';icon.style.color=r.color;icon.textContent=r.icon;card.append(icon);const h=document.createElement('h3');h.textContent=r.name;card.append(h);paragraph(card,r.text);const small=document.createElement('small');small.textContent=count?`OWNED ×${count} · ${r.stack}`:`${r.rarity} · ${r.stack}`;card.append(small);return card;}
  function openCodex(){const body=showModal('A little power goes a long way.','THE RELIC CODEX / 8 DISCOVERIES');paragraph(body,'Every relic is passive. Find duplicates to stack their effects. Echo attacks can trigger storms; all kills can release shards. Shards and storm damage cannot trigger more storms.');const grid=document.createElement('div');grid.className='codex-grid';for(const r of relics)grid.append(relicCard(r,game?.items[r.id]||0));body.append(grid);}
  $('codexOpen').onclick=$('inventoryCodex').onclick=openCodex;
  $('helpOpen').onclick=()=>{
    const body=showModal('The essentials.','FIELD GUIDE'),list=document.createElement('ul');list.className='help-list';
    for(const text of [
      'Move with WASD or arrow keys. Aim with your mouse; hold the left mouse button to fire.',
      'On a phone, drag the movement pad. Your weapon automatically targets nearby enemies visible from your lantern.',
      'Press Space to dash. You are briefly invulnerable; dash recharges in 1.4 seconds.',
      'Press L, or tap the lantern meter, to toggle wide light. It uses charge and attracts enemies from farther away. Switch it off to recharge; stand near a torch for a faster refill. Your regular light never runs out.',
      'Walls cast shadows. The small exploration map remembers where you have been. In The Mosskeep, the boss and exit are in the southeast.',
      'Defeat enemies and collect their gold. Stand next to a glowing chest and press E to buy a relic choice. Every opened chest increases the price of all remaining chests for this run. The workshop sets the starting price and increase. Coins also heal you if you have Moss Heart or Moss blessing.',
      'Defeat the boss, then step onto the green exit. Chargers show a warning line before lunging; enraged bosses attack faster.',
      'In the workshop, choose a map size and lighting mood. Monster and Boss brushes have editable stats, colors, and attack styles. Inspect edits one placed creature. Pan lets you drag around a large map.',
      'Published maps expire after one hour without an active player. Saved blueprints do not expire.',
      'Dungeon and Waves are cooperative. Duel is PvP. Multiplayer menus never pause the world. E also revives nearby teammates; Q pings, H drinks a potion, and the party panel supports trading and build inspection.'
    ]){const li=document.createElement('li');li.textContent=text;list.append(li);}body.append(list);
  };
  function saveLoadout(){mutate(d=>d.lastLoadout={weapon:$('weapon').value,perk:$('perk').value});}
  $('weapon').onchange=$('perk').onchange=saveLoadout;
  $('savePreset').onclick=()=>{const body=showModal('Pack for the next attempt.','SAVE LOADOUT');paragraph(body,'Saves your starting weapon and perk. Relics found during a run stay in that run.');const input=document.createElement('input');input.placeholder='Loadout name';input.maxLength=32;input.value=`${weapons[$('weapon').value].name} build`;input.setAttribute('aria-label','Loadout name');body.append(input);const actions=document.createElement('div');actions.className='modal-actions';button(actions,'Save loadout',()=>{const name=input.value.trim();if(!name){input.focus();return;}if(readData().presets.length>=20){toast('You can save 20 loadouts. Delete one first.');return;}mutate(d=>d.presets.push({id:uid(),name,weapon:$('weapon').value,perk:$('perk').value}));closeModal();toast('Loadout saved in this browser.');},'primary');body.append(actions);};
  function presetsModal(){const body=showModal('Your starting lineup.','SAVED LOADOUTS');const presets=readData().presets;if(!presets.length)paragraph(body,'No saved loadouts yet. Choose a weapon and starter perk, then select “Save this loadout.”');for(const p of presets){const row=document.createElement('div');row.className='preset';const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=p.name;const small=document.createElement('small');small.textContent=`${weapons[p.weapon].name} / ${perks[p.perk]}`;text.append(strong,small);row.append(text);button(row,'Equip',()=>{$('weapon').value=p.weapon;$('perk').value=p.perk;saveLoadout();closeModal();toast('Equipped for your next run.');});button(row,'Delete',()=>{mutate(d=>d.presets=d.presets.filter(x=>x.id!==p.id));presetsModal();},'text-button');body.append(row);}}
  $('presetsOpen').onclick=presetsModal;
  $('backupOpen').onclick=()=>{const body=showModal('Keep your favorite things.','BROWSER SAVE BACKUP');paragraph(body,'Export loadouts and workshop blueprints as a file. Import merges them into this browser. Published maps and active runs are not included.');button(body,'Export backup ↓',()=>{const d=readData();const blob=new Blob([JSON.stringify({version:1,presets:d.presets,blueprints:d.blueprints,lastLoadout:d.lastLoadout},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='one-more-relic-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});const label=document.createElement('label');label.className='file-label';label.textContent='Import a backup';const input=document.createElement('input');input.type='file';input.accept='.json,application/json';label.append(input);body.append(label);input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>1000000)throw new Error('Backup is too large (maximum 1 MB).');const raw=JSON.parse(await f.text());if(!Array.isArray(raw.presets)||!Array.isArray(raw.blueprints))throw new Error('Missing loadouts or blueprints.');const imported=normalize(raw);if(imported.presets.length!==raw.presets.length||imported.blueprints.length!==raw.blueprints.length)throw new Error('Some entries are invalid. Nothing was imported.');mutate(d=>{for(const kind of ['presets','blueprints'])for(const x of imported[kind]){const at=d[kind].findIndex(y=>y.id===x.id);if(at>=0)d[kind][at]=x;else if(d[kind].length<20)d[kind].push(x);}});closeModal();toast('Backup imported. Existing matching entries were updated.');}catch(e){toast(`Import failed: ${e.message}`);}};};
  function validateMap(grid){
    if(!validGrid(grid))return 'Use a rectangular map between 20 × 16 and 64 × 44 tiles.';
    const {w:W,h:H}=dimensions(grid);
    const positions={2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[],10:[],11:[]};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=grid[y][x];if((x===0||y===0||x===W-1||y===H-1)&&t!==1)return 'Keep the outer border walled.';if(positions[t])positions[t].push([x,y]);}
    if(positions[2].length!==1)return 'Place exactly one entrance.';if(positions[3].length!==1)return 'Place exactly one exit portal.';if(positions[7].length<1)return 'Place at least one boss.';if(!positions[5].length&&!positions[11].length)return 'Place at least one upgrade chest or relic vault.';
    if(positions[10].length>positions[9].length)return 'Place at least one key for every locked door.';
    if(positions[4].length>70||positions[5].length+positions[11].length>32||positions[6].length>60||positions[8].length>40)return 'Budget: at most 70 monsters, 32 total chests, 60 traps, and 40 torches.';
    const seen=new Set(),queue=[positions[2][0]];while(queue.length){const [x,y]=queue.shift(),key=`${x},${y}`;if(x<0||y<0||x>=W||y>=H||grid[y][x]===1||seen.has(key))continue;seen.add(key);queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);}
    for(const type of [3,4,5,6,7,8,9,10,11])for(const [x,y]of positions[type])if(!seen.has(`${x},${y}`))return 'Connect every exit, enemy, door, key, trap, chest, vault, and torch to the entrance.';
    return '';
  }
  function openEditor(){
    if(!editor)editor={id:uid(),name:'My little catastrophe',...clone(mapDetails(demo))};
    editor={...editor,...mapDetails(editor)};selectedCreature=null;
    const {w:W,h:H}=dimensions(editor.grid);
    const body=showModal('Make a little trouble.','THE WORKSHOP / LOCAL DUNGEON EDITOR');
    $('modal').classList.add('workshop-modal');
    paragraph(body,'Paint a dungeon, place torches, and design your enemies. Inspect a monster or boss to edit just that creature. Saves stay in this browser.');
    const fields=document.createElement('div');fields.className='editor-fields';const nameLabel=document.createElement('label');nameLabel.textContent='DUNGEON NAME';const name=document.createElement('input');name.maxLength=32;name.value=editor.name;name.id='editorName';name.oninput=()=>editor.name=name.value;nameLabel.append(name);
    const bpLabel=document.createElement('label');bpLabel.textContent='LOAD A BLUEPRINT';const select=document.createElement('select');select.id='blueprintSelect';const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose saved blueprint…';select.append(placeholder);for(const bp of readData().blueprints){const o=document.createElement('option');o.value=bp.id;o.textContent=bp.name;select.append(o);}select.onchange=()=>{const bp=readData().blueprints.find(x=>x.id===select.value);if(bp){editor=clone(bp);openEditor();}};bpLabel.append(select);fields.append(nameLabel,bpLabel);body.append(fields);
    const options=document.createElement('div');options.className='editor-fields';
    const sizeLabel=document.createElement('label');sizeLabel.textContent='MAP SIZE';const size=document.createElement('select');size.id='editorSize';
    for(const [value,label]of [['28,20','Compact · 28 × 20'],['48,34','Large · 48 × 34'],['64,44','Vast · 64 × 44']]){const opt=document.createElement('option');opt.value=value;opt.textContent=label;size.append(opt);}
    if(![...size.options].some(o=>o.value===`${W},${H}`)){const opt=document.createElement('option');opt.value=`${W},${H}`;opt.textContent=`Custom · ${W} × ${H}`;size.append(opt);}size.value=`${W},${H}`;
    size.onchange=()=>{const [w,h]=size.value.split(',').map(Number);if(w<W||h<H){size.value=`${W},${H}`;toast('To keep your work safe, choose a smaller size on a new blank map.');return;}resizeEditor(w,h);openEditor();};sizeLabel.append(size);
    const lightLabel=document.createElement('label');lightLabel.textContent='DUNGEON LIGHT';const light=document.createElement('select');light.id='editorLighting';for(const [value,label]of [['gloom','Gloom · lantern & torchlight'],['dark','Deep dark · bring your lantern'],['bright','Daylit · gentle shadows']]){const o=document.createElement('option');o.value=value;o.textContent=label;light.append(o);}light.value=editor.lighting;light.onchange=()=>editor.lighting=light.value;lightLabel.append(light);
    const stageLabel=document.createElement('label');stageLabel.textContent='STAGES';const stages=document.createElement('select');stages.id='editorStages';for(let n=2;n<=5;n++){const o=document.createElement('option');o.value=n;o.textContent=`${n} stages${n===2?' · minimum':''}`;stages.append(o);}stages.value=editor.stageCount;stages.onchange=()=>editor.stageCount=Number(stages.value);stageLabel.append(stages);
    const lockLabel=document.createElement('label');lockLabel.textContent='KEY / DOOR TYPE';const lockType=document.createElement('select');for(const type of ['red','blue','green','purple','gold']){const o=document.createElement('option');o.value=type;o.textContent=type[0].toUpperCase()+type.slice(1);}lockType.value=editor.lockType||'blue';lockType.onchange=()=>editor.lockType=lockType.value;lockLabel.append(lockType);options.append(sizeLabel,lightLabel,stageLabel,lockLabel);body.append(options);
    const prices=document.createElement('fieldset');prices.className='chest-pricing';const legend=document.createElement('legend');legend.textContent='CHEST PRICING';prices.append(legend);
    const priceFields=document.createElement('div');priceFields.className='editor-fields';prices.append(priceFields);
    const pricePreview=document.createElement('p');pricePreview.id='chestPricePreview';pricePreview.className='editor-status';
    const refreshPrices=()=>{pricePreview.textContent=`First four chests: ${[0,1,2,3].map(n=>chestPrice(editor.chestPricing,n)).join(' → ')} gold. Prices reset each run. Gold comes from defeated enemies.`;};
    for(const [key,label,id,min]of [['baseCost','STARTING COST (GOLD)','chestBaseCost',0],['increase','INCREASE PER OPENED CHEST','chestIncrease',1]]){
      const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement('input');input.type='number';input.id=id;input.min=min;input.max=999;input.step=1;input.value=editor.chestPricing[key];input.setAttribute('aria-describedby','chestPricePreview');wrapper.append(input);priceFields.append(wrapper);
      input.oninput=()=>{editor.chestPricing=normalizeChestPricing({...editor.chestPricing,[key]:input.value===''?NaN:Number(input.value)});refreshPrices();};input.onchange=()=>{input.oninput();input.value=editor.chestPricing[key];};
    }
    prices.append(pricePreview);body.append(prices);refreshPrices();
    const toolbar=document.createElement('div');toolbar.className='editor-toolbar';const names=['Floor','Wall','Entrance','Exit portal','Monster','Upgrade chest','Spikes','Boss','Torch','Key','Locked door','Relic vault'];
    for(let t=0;t<12;t++){const b=button(toolbar,`${icons[t]} ${names[t]}`,()=>{tool=t;selectedCreature=null;selectEditorTool();},'tool');b.dataset.tool=t;b.setAttribute('aria-pressed',String(tool===t));}const merchantTool=button(toolbar,'⚗ Merchant',()=>{tool='merchant';selectedCreature=null;selectEditorTool();},'tool');merchantTool.dataset.tool='merchant';const inspect=button(toolbar,'⌖ Inspect',()=>{tool='inspect';selectedCreature=null;selectEditorTool();},'tool');inspect.dataset.tool='inspect';const pan=button(toolbar,'✥ Pan',()=>{tool='pan';selectedCreature=null;selectEditorTool();},'tool');pan.dataset.tool='pan';body.append(toolbar);
    const workspace=document.createElement('div');workspace.className='editor-workspace';const mapPanel=document.createElement('div');const scroll=document.createElement('div');scroll.className='editor-scroll';
    const ec=document.createElement('canvas');ec.width=W*24;ec.height=H*24;ec.className='editor-canvas';ec.id='editorCanvas';ec.style.width=`${W*20}px`;ec.setAttribute('aria-label','Dungeon editor. Choose a tile type above, then click or drag on the grid.');scroll.append(ec);mapPanel.append(scroll);paragraph(mapPanel,'The full map scales to the available desktop width. Inspect selects a creature; painting uses your current creature brush.','editor-status');
    const status=document.createElement('div');status.className='editor-status';status.id='editorStatus';mapPanel.append(status);const inspector=document.createElement('section');inspector.id='creatureInspector';inspector.className='creature-inspector';workspace.append(mapPanel,inspector);body.append(workspace);
    const error=document.createElement('div');error.className='error';error.id='editorError';error.setAttribute('role','status');body.append(error);
    function paint(e){if(tool==='pan')return;const r=ec.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*W),y=Math.floor((e.clientY-r.top)/r.height*H);if(x<=0||y<=0||x>=W-1||y>=H-1)return;const key=`${x},${y}`;
      if(tool==='inspect'){if([4,7].includes(editor.grid[y][x])){selectedCreature={x,y,key,type:editor.grid[y][x]};renderInspector();drawEditor();}return;}
      if(tool==='merchant'){editor.features=editor.features||[];const at=editor.features.findIndex(f=>f.kind==='merchant'&&Math.floor(f.x/40)===x&&Math.floor(f.y/40)===y);if(at>=0)editor.features.splice(at,1);else if(editor.grid[y][x]===0)editor.features.push({id:'merchant-'+Date.now(),kind:'merchant',x:x*40+20,y:y*40+20,value:8});drawEditor();return;}
      if([2,3,7].includes(tool))for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(editor.grid[yy][xx]===tool){editor.grid[yy][xx]=0;delete editor.creatures[`${xx},${yy}`];}
      delete editor.creatures[key];delete (editor.keyTypes||{})[key];delete (editor.doorTypes||{})[key];delete (editor.bosses||{})[key];editor.grid[y][x]=tool;if(tool===4||tool===7){editor.creatures[key]=sanitizeCreature(brushes[tool],tool===7);if(tool===7){editor.bosses=editor.bosses||{};editor.bosses[key]={required:true,final:false};}}if(tool===9){editor.keyTypes=editor.keyTypes||{};editor.keyTypes[key]=editor.lockType||'blue';}if(tool===10){editor.doorTypes=editor.doorTypes||{};const type=editor.lockType||'blue';editor.doorTypes[key]={type,name:type[0].toUpperCase()+type.slice(1)+' door'};}drawEditor();}
    let panPoint=null;ec.onpointerdown=e=>{editorDrawing=true;panPoint={x:e.clientX,y:e.clientY};ec.setPointerCapture(e.pointerId);paint(e);};ec.onpointermove=e=>{if(!editorDrawing)return;if(tool==='pan'&&panPoint){scroll.scrollLeft-=e.clientX-panPoint.x;scroll.scrollTop-=e.clientY-panPoint.y;panPoint={x:e.clientX,y:e.clientY};}else paint(e);};ec.onpointerup=ec.onpointercancel=()=>{editorDrawing=false;panPoint=null;};
    const actions=document.createElement('div');actions.className='modal-actions';
    button(actions,'Publish & play ↗',async()=>{const issue=validateMap(editor.grid);if(issue){error.textContent=issue;return;}if(!editor.name.trim()){error.textContent='Give your dungeon a name.';return;}if(!saveBlueprint())return;try{await window.OMRNetwork.publish({name:editor.name.trim(),...clone(mapDetails(editor))});closeModal();}catch(e){error.textContent=e.message;}},'primary');
    button(actions,'Save blueprint',()=>{if(saveBlueprint())toast('Blueprint saved. It will not expire.');});
    button(actions,'New blank map',()=>{const [w,h]=size.value.split(',').map(Number);editor={id:uid(),name:'Untitled dungeon',grid:blankGrid(w,h),creatures:{},lighting:'gloom',stageCount:2,chestSchema:'v11'};openEditor();});
    button(actions,'New compact map',()=>{editor={id:uid(),name:'Untitled dungeon',grid:blankGrid(28,20),creatures:{},lighting:'gloom',stageCount:2,chestSchema:'v11'};openEditor();});
    button(actions,'Manage maps',manageMaps);body.append(actions);selectEditorTool();drawEditor();
  }
  function resizeEditor(w,h){const old=editor.grid,{w:ow,h:oh}=dimensions(old),grid=blankGrid(w,h);for(let y=1;y<oh-1;y++)for(let x=1;x<ow-1;x++)grid[y][x]=old[y][x];editor.grid=grid;}
  function selectEditorTool(){document.querySelectorAll('.tool').forEach(b=>{const selected=b.dataset.tool===String(tool);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});renderInspector();drawEditor();}
  function renderInspector(){
    const panel=$('creatureInspector');panel.replaceChildren();const type=selectedCreature?.type||tool;
    if(type!==4&&type!==7){const title=document.createElement('h3');title.textContent=tool==='inspect'?'Choose a creature.':'Light the way.';panel.append(title);paragraph(panel,tool==='inspect'?'Click any monster or boss to edit its name, appearance, behavior, and stats.':'Torches illuminate nearby rooms and recharge your wide-beam lantern. Choose Monster or Boss to design your next encounter.');return;}
    const boss=type===7;let config=selectedCreature?editor.creatures[selectedCreature.key]:brushes[type];config=sanitizeCreature(config,boss);
    const heading=document.createElement('h3');heading.textContent=selectedCreature?`Editing ${boss?'boss':'monster'} · ${selectedCreature.x}, ${selectedCreature.y}`:`${boss?'Boss':'Monster'} brush`;panel.append(heading);
    paragraph(panel,selectedCreature?'Changes apply to this creature only.':'New placements use these settings. Existing creatures stay as they are.','editor-status');
    const fields=document.createElement('div');fields.className='creature-fields';panel.append(fields);
    const commit=()=>{config=sanitizeCreature(config,boss);if(selectedCreature)editor.creatures[selectedCreature.key]=clone(config);else brushes[type]=clone(config);drawEditor();};
    function field(label,id,input){const wrapper=document.createElement('label');wrapper.textContent=label;input.id=id;wrapper.append(input);fields.append(wrapper);return input;}
    const templates=document.createElement('select');const custom=document.createElement('option');custom.value='';custom.textContent='Choose a template…';templates.append(custom);for(const id of boss?['keeper','seer','juggernaut']:['stalker','spitter','charger','sentry']){const o=document.createElement('option');o.value=id;o.textContent=creatureDefaults[id].name;templates.append(o);}field('TEMPLATE','creatureTemplate',templates);templates.onchange=()=>{if(!templates.value)return;config=clone(creatureDefaults[templates.value]);commit();renderInspector();};
    const name=document.createElement('input');name.value=config.name;name.maxLength=32;field('NAME','creatureName',name);name.onchange=()=>{config.name=name.value;commit();name.value=config.name;};
    const behavior=document.createElement('select');const labels={chaser:'Chase & bite',spitter:'Keep distance & spit',sentry:'Stationary turret',charger:'Telegraphed charge',fan:'Projectile fan',ring:'Radial burst'};for(const id of boss?['fan','ring','charger']:['chaser','spitter','sentry','charger']){const o=document.createElement('option');o.value=id;o.textContent=labels[id];behavior.append(o);}behavior.value=config.behavior;field('ATTACK STYLE','creatureBehavior',behavior);behavior.onchange=()=>{config.behavior=behavior.value;commit();};
    const color=document.createElement('input');color.type='color';color.value=config.color;field('COLOR','creatureColor',color);color.oninput=()=>{config.color=color.value;commit();};
    for(const [key,label,min,max,step]of [['hp','HEALTH',boss?80:10,boss?3000:500,5],['speed','MOVE SPEED',0,160,5],['damage','DAMAGE',1,50,1],['cooldown','ATTACK DELAY (SEC)',.6,8,.1],['shots','PROJECTILES',1,boss?20:8,1],['projectileSpeed','SHOT SPEED',70,300,5]]){const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=config[key];field(label,`creature-${key}`,input);input.onchange=()=>{config[key]=input.value===''?NaN:Number(input.value);commit();input.value=config[key];};}
    if(boss){const rage=document.createElement('input');rage.type='checkbox';rage.checked=config.enrage;field('ENRAGE BELOW 35% HEALTH','creatureEnrage',rage);rage.onchange=()=>{config.enrage=rage.checked;commit();};if(selectedCreature){editor.bosses=editor.bosses||{};const objective=editor.bosses[selectedCreature.key]||{required:true,final:false};const required=document.createElement('input');required.type='checkbox';required.checked=objective.required!==false;field('REQUIRED OBJECTIVE','bossRequired',required);required.onchange=()=>{objective.required=required.checked;editor.bosses[selectedCreature.key]=objective;};const final=document.createElement('input');final.type='checkbox';final.checked=objective.final===true;field('FINAL BOSS','bossFinal',final);final.onchange=()=>{if(final.checked)for(const key of Object.keys(editor.bosses))editor.bosses[key].final=false;objective.final=final.checked;editor.bosses[selectedCreature.key]=objective;};}}
    paragraph(panel,'Charges warn before lunging. Ranged attacks stop at walls. Projectile settings apply to ranged styles. Enraged bosses move and attack faster.','editor-status');
    if(selectedCreature)button(panel,'Use as placement brush',()=>{brushes[type]=clone(config);tool=type;selectedCreature=null;selectEditorTool();});
  }
  function saveBlueprint(){if(!editor.name.trim()){toast('Give your blueprint a name.');return false;}const data=readData(),index=data.blueprints.findIndex(b=>b.id===editor.id);if(index<0&&data.blueprints.length>=20){toast('Maximum 20 blueprints. Delete one from Manage maps first.');return false;}const bp={id:editor.id,name:editor.name.trim().slice(0,32),...clone(mapDetails(editor))};if(index<0)data.blueprints.push(bp);else data.blueprints[index]=bp;writeData(data);return true;}
  function drawEditor(){const ec=$('editorCanvas');if(!ec)return;const {w:W,h:H}=dimensions(editor.grid),c=ec.getContext('2d'),colors={2:'#d0e8a2',3:'#81d4c0',4:'#dc9b79',5:'#d6b46a',6:'#b37d75',7:'#c3a0e4',8:'#ecc57c',9:'#79aee8',10:'#557ca8',11:'#e4b0dc'};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=editor.grid[y][x];c.fillStyle=t===1?'#3e5039':(x+y)%2?'#19271d':'#1c2b20';c.fillRect(x*24,y*24,24,24);c.strokeStyle='#0d170f';c.strokeRect(x*24,y*24,24,24);if(t>1){c.fillStyle=editor.creatures[`${x},${y}`]?.color||colors[t];c.font='18px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(icons[t],x*24+12,y*24+13);}}if(selectedCreature){c.strokeStyle='#e4f9b4';c.lineWidth=2;c.strokeRect(selectedCreature.x*24+1,selectedCreature.y*24+1,22,22);c.lineWidth=1;}const counts=editor.grid.flat();$('editorStatus').textContent=`${W} × ${H} · ${editor.stageCount} stages · ${counts.filter(t=>t===4).length}/70 monsters · ${counts.filter(t=>[5,11].includes(t)).length}/32 chests & vaults · ${counts.filter(t=>t===6).length}/60 traps · ${counts.filter(t=>t===8).length}/40 torches`;}
  function manageMaps(){const body=showModal('Your little worlds.','WORKSHOP / SAVED MAPS');sweepMaps();const data=readData();paragraph(body,'Published maps are local to this browser. Their inactivity clock pauses while a local run is active, including when paused. Cleanup runs while the app is open and when you next open it.');for(const [kind,label]of [['maps','PUBLISHED'],['blueprints','BLUEPRINT']]){for(const m of data[kind]){const row=document.createElement('div');row.className='preset';const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=m.name;const small=document.createElement('small');small.textContent=kind==='blueprints'?`${label} · no expiry`:Object.keys(m.sessions).length?`${label} · in use`:`${label} · ${Math.max(0,Math.ceil((HOUR-(Date.now()-m.idleSince))/60000))} minutes until expiry`;text.append(strong,small);row.append(text);if(kind==='blueprints')button(row,'Edit',()=>{editor=clone(m);openEditor();});button(row,'Delete',()=>{if(m.id===activeMapId){toast('Leave the active run before deleting this map.');return;}mutate(d=>d[kind]=d[kind].filter(x=>x.id!==m.id));updateMaps();manageMaps();},'text-button');body.append(row);}}if(!data.maps.length&&!data.blueprints.length)paragraph(body,'No saved maps yet. Your next dungeon starts in the workshop.');button(body,'Back to workshop',openEditor);}
  $('editorOpen').onclick=openEditor;
  $('playTab').onclick=()=>{$('canvasWrap').scrollIntoView({behavior:'smooth',block:'center'});};
  $('mapSelect').onchange=selectMap;

  // Local simulation. All run power is derived from validated starting choices.
  function stageEntities(map,stage,partySize=1){
    const {w:W,h:H}=dimensions(map.grid),entities={enemies:[],chests:[],traps:[],torches:[],stageKeys:[],doors:[]};let spawn={x:140,y:220},exit={x:1020,y:660},n=stage*1000;
    const finalStage=stage>=map.stageCount,stageScale=1+(stage-1)*.28,partyScale=1+Math.max(0,partySize-1)*.42;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const t=map.grid[y][x],pos={x:x*TILE+20,y:y*TILE+20};if(t===2)spawn=pos;if(t===3)exit=pos;
      if(t===4||(t===7&&finalStage)){
        const boss=t===7,config=sanitizeCreature(map.creatures?.[`${x},${y}`],boss),elite=!boss&&stage>1&&((x+y+stage)%Math.max(2,5-stage)===0);
        const hp=Math.round(config.hp*stageScale*(boss?partyScale:1+Math.max(0,partySize-1)*.12)*(elite?1.65:1));
        entities.enemies.push({...pos,...config,id:++n,boss,elite,hp,maxHp:hp,damage:Math.round(config.damage*(1+(stage-1)*.12)*(elite?1.25:1)),speed:config.speed*(elite?1.12:1),r:boss?16:elite?14:12,cd:1.5,flash:0,alert:0,windup:0,chargeTime:0,chargeAngle:0,raging:false,summonCD:6});
      }
      if(t===5)entities.chests.push({...pos,opened:false,kind:'upgrade'});
      if(t===11)entities.chests.push({...pos,opened:false,kind:'vault'});
      if(t===6)entities.traps.push(pos);if(t===8)entities.torches.push(pos);
      if(t===9)entities.stageKeys.push({...pos,collected:false});if(t===10)entities.doors.push({...pos,open:false});
    }
    return {...entities,spawn,exit};
  }
  function makeRun(map){
    map={...clone(map),...clone(mapDetails(map))};const partySize=clamp(Number(window.OMRV11?.partySize||1),1,8),entities=stageEntities(map,1,partySize),perk=$('perk').value,hp=perk==='vigor'?125:100;
    const skinColor=window.OMRV11?.skins?.find(s=>s.id===window.OMRV11.meta.skin)?.color||'#cce6a2';return {map,...entities,exit:entities.exit,stage:1,maxStages:map.stageCount,partySize,keysOwned:0,chestPricing:normalizeChestPricing(map.chestPricing),chestsOpened:0,goldEarned:0,player:{...entities.spawn,hp,maxHp:hp,r:11,inv:0,dash:0,dashCD:0,dashX:0,dashY:0,perk,weapon:$('weapon').value,skinColor,fireCD:0,attacks:0,hits:0,lantern:100,wideLight:false,recharging:false,shield:0,shieldTimer:12},items:{},upgrades:{},bullets:[],hazards:[],effects:[],coins:[],time:0,kills:0,gold:0,paused:false,status:'playing',bossDead:false,message:'',messageUntil:0,explored:new Set(),exploreCD:0,pathCD:0,paths:null,remotePlayers:[]};
  }
  function loadStage(stage){
    const e=stageEntities(game.map,stage,game.partySize),p=game.player;Object.assign(game,e,{stage,exit:e.exit,bossDead:false,bullets:[],hazards:[],coins:[],effects:[],explored:new Set(),paths:null});Object.assign(p,e.spawn,{hp:Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*.3)),lantern:100});
    $('phase').textContent=stage===game.maxStages?'DEFEAT THE KEEPER · FIND THE EXIT':`STAGE ${stage} · FIND THE EXIT`;worldMessage(stage===game.maxStages?'The keeper is close. Its arena shifts with your party.':`Stage ${stage} twists deeper. Elites are waking.`,4);updateHUD();
  }
  function advanceStage(){
    if(game.stage>=game.maxStages){endRun('won');return;}game.paused=true;const next=game.stage+1,body=showModal(`Stage ${next} waits below.`,`STAGE ${game.stage} CLEARED`);paragraph(body,'You recover 30% health. Enemy health, damage, elite frequency, and encounter pressure rise.');button(body,'Descend',()=>{$('modal').dataset.choice='false';closeModal();game.paused=false;const room=window.OMRV11?.room;if(room?.hostId===room?.playerId&&room?.socket)room.socket.emit('stage:advance');loadStage(next);},'primary');
  }
  const arenaNames=['Root Ring','Glass Causeway','Lantern Pit','Crooked Crown','Moss Circuit','Ember Cross','Flooded Vault','Hollow Spiral','Thorn Gallery','Last Reliquary'];
  function duelMap(index){const w=28,h=20,grid=blankGrid(w,h);for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++)if((x*7+y*11+index*5)%23===0&&Math.abs(x-4)>2)grid[y][x]=1;grid[4][4]=2;grid[h-5][w-5]=3;grid[h-4][4]=7;for(const [x,y]of [[w-5,4],[4,h-5],[Math.floor(w/2),Math.floor(h/2)]])grid[y][x]=4;return {id:`arena-${index}`,name:arenaNames[index],builtin:true,grid,creatures:{},lighting:index%3===0?'dark':'gloom',stageCount:2,chestSchema:'v11',chestPricing:{baseCost:0,increase:1}};}
  function loadDuelRound(round=1){const map=duelMap((round-1)%10),fresh=makeRun(map),p=game?.player||fresh.player,score=game?.duelScore||0;game={...fresh,mode:'duel',round,arenaIndex:(round-1)%10,duelScore:score,player:{...fresh.player,weapon:p.weapon,perk:p.perk},maxStages:1,stage:1};for(const e of game.enemies){e.name='Relic rival';e.hp=e.maxHp=70+round*8;e.damage=10+Math.floor(round/3);e.color=['#df8f74','#79bfc5','#b493df'][e.id%3];}game.bossDead=true;$('arenaName').textContent=map.name.toUpperCase();$('phase').textContent=`DUEL ROUND ${round} · LAST WANDERER STANDING`;updateInventory();updateHUD();worldMessage('Temporary upgrades drop from defeated rivals. Power resets next round.',4);}
  function startDuel(){if(game?.status==='playing')return;game=makeRun(duelMap(0));loadDuelRound(1);$('preview').classList.add('hidden');$('result').classList.add('hidden');$('hud').classList.remove('hidden');$('pause').disabled=false;$('leave').disabled=false;$('start').disabled=true;$('mapSelect').disabled=true;document.body.classList.add('playing');resize();}
  function advanceDuel(){if(game.roundTransition)return;game.roundTransition=true;game.paused=true;game.duelScore++;window.dispatchEvent(new CustomEvent('omr:achievement',{detail:{key:'duelWins'}}));const room=window.OMRV11?.room;if(room?.hostId===room?.playerId&&room?.socket)room.socket.emit('stage:advance');const body=showModal('The arena keeps rolling.',`ROUND ${game.round} WON · ${game.duelScore} POINT${game.duelScore===1?'':'S'}`);paragraph(body,`Next: ${arenaNames[game.round%10]}. Temporary upgrades and relics reset for every player.`);button(body,'Next arena',()=>{closeModal();loadDuelRound(game.round+1);},'primary');}
  function startRun(){
    if(game?.status==='playing'){toast('Leave the current run before starting another.');return;}
    const id=$('mapSelect').value;updateMaps(id);const map=allMaps().find(x=>x.id===$('mapSelect').value)||demo;const issue=validateMap(map.grid);if(issue){toast(issue);return;}
    releaseMap();game=makeRun(map);if(!map.builtin){window.dispatchEvent(new CustomEvent('omr:achievement',{detail:{key:'published',id:map.id}}));activeMapId=map.id;heartbeat();}saveLoadout();pointer.down=false;pointer.seen=false;keys.clear();stick={x:0,y:0};
    $('preview').classList.add('hidden');$('result').classList.add('hidden');$('hud').classList.remove('hidden');$('touchControls').classList.toggle('hidden',!isTouch());$('pause').disabled=false;$('leave').disabled=false;$('start').disabled=true;$('mapSelect').disabled=true;$('pause').textContent='Pause Ⅱ';$('arenaName').textContent=map.name.toUpperCase();$('phase').textContent='STAGE 1 · FIND THE EXIT';document.body.classList.add('playing');updateInventory();updateHUD();worldMessage(`Clear ${game.maxStages} stages. Upgrade chests build your kit; relic vaults change the run.`,5);resize();if(isTouch())$('canvasWrap').scrollIntoView({block:'start'});
  }
  function endRun(status){
    if(!game||game.status!=='playing')return;game.status=status;if(status==='won'){window.dispatchEvent(new CustomEvent('omr:achievement',{detail:{key:'clears'}}));window.dispatchEvent(new CustomEvent('omr:achievement',{detail:{key:'bosses'}}));}releaseMap();keys.clear();pointer.down=false;stick={x:0,y:0};
    $('touchControls').classList.add('hidden');$('worldMessage').classList.add('hidden');$('pause').disabled=true;$('leave').disabled=true;$('start').disabled=false;$('mapSelect').disabled=false;$('result').classList.remove('hidden');
    $('phase').textContent=status==='won'?'VAULT CLEARED':status==='dead'?'EXPEDITION LOST':'BACK AT CAMP';
    $('resultLabel').textContent=status==='won'?'EXPEDITION COMPLETE':status==='dead'?'THE DUNGEON KEEPS ITS SECRETS':'EXPEDITION ENDED';
    $('resultTitle').textContent=status==='won'?'A little richer.':status==='dead'?'One room too many.':'Catch your breath.';
    $('resultText').textContent=`${formatTime(game.time)} explored · ${game.kills} defeated · ${game.goldEarned} gold collected / ${game.gold} unspent · ${Object.values(game.items).reduce((a,b)=>a+b,0)} relics. Your next run starts fresh.`;updateHUD();
  }
  function returnCamp(){if(game?.status==='playing')endRun('left');game=null;document.body.classList.remove('playing');$('result').classList.add('hidden');$('preview').classList.remove('hidden');$('hud').classList.add('hidden');$('touchControls').classList.add('hidden');$('worldMessage').classList.add('hidden');$('phase').textContent='READY TO EXPLORE';updateInventory();updateMaps();updateHUD();resize();}
  $('start').onclick=$('quickStart').onclick=startRun;$('retry').onclick=startRun;$('returnCamp').onclick=returnCamp;$('leave').onclick=returnCamp;
  function pauseRun(){if(!game||game.status!=='playing')return;game.paused=!game.paused;keys.clear();pointer.down=false;$('pause').textContent=game.paused?'Resume ▷':'Pause Ⅱ';}
  $('pause').onclick=pauseRun;
  function solid(x,y){return wallAt(game.map.grid,x,y)||game.doors?.some(d=>!d.open&&Math.abs(d.x-x)<TILE/2&&Math.abs(d.y-y)<TILE/2);}
  function wallAt(grid,x,y){const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);return tx<0||ty<0||ty>=grid.length||tx>=grid[0].length||grid[ty][tx]===1;}
  function lineOfSight(a,b,grid=game.map.grid){const d=distance(a,b),steps=Math.ceil(d/8);for(let i=1;i<steps;i++)if(wallAt(grid,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;return true;}
  function lightRadius(){return game.player.wideLight?290:190;}
  function toggleLantern(){if(!game||game.paused||game.status!=='playing'||$('modal').open)return;const p=game.player;if(!p.wideLight&&p.lantern<15){worldMessage('Let the lantern recharge, or stand near a torch.');return;}p.wideLight=!p.wideLight;worldMessage(p.wideLight?'Wide beam on · uses charge. Torches recharge it.':'Wide beam off · lantern recharging.',2);}
  function updateLantern(dt){const p=game.player;p.recharging=game.torches.some(t=>distance(t,p)<85&&lineOfSight(p,t));p.lantern=clamp(p.lantern+(p.recharging?32:p.wideLight?-14:8)*dt,0,100);if(p.wideLight&&p.lantern===0){p.wideLight=false;worldMessage('Wide beam depleted. Your regular light still works.',3);}}
  function rebuildPaths(){
    const grid=game.map.grid,{w,h}=dimensions(grid),values=new Int16Array(w*h).fill(-1),queue=new Int32Array(w*h);
    const sx=Math.floor(game.player.x/TILE),sy=Math.floor(game.player.y/TILE);let head=0,tail=1;queue[0]=sy*w+sx;values[queue[0]]=0;
    while(head<tail){const key=queue[head++],x=key%w,y=Math.floor(key/w);for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const k=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||grid[ny][nx]===1||game.doors?.some(d=>!d.open&&Math.floor(d.x/TILE)===nx&&Math.floor(d.y/TILE)===ny)||values[k]>=0)continue;values[k]=values[key]+1;queue[tail++]=k;}}
    game.paths=values;
  }
  function chaseDirection(e,visible){const p=game.player;if(visible){const d=distance(e,p)||1;return {x:(p.x-e.x)/d,y:(p.y-e.y)/d};}
    const {w,h}=dimensions(game.map.grid),x=Math.floor(e.x/TILE),y=Math.floor(e.y/TILE);let best=game.paths?.[y*w+x]??-1,target=null;if(best<0)return {x:0,y:0};
    for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=w||ny>=h)continue;const v=game.paths[ny*w+nx];if(v>=0&&v<best){best=v;target={x:nx*TILE+20,y:ny*TILE+20};}}
    if(!target)return {x:0,y:0};
    // Center in the corridor before turning so wide bosses don't snag corners.
    if(Math.abs(target.x-e.x)>TILE*.6&&Math.abs(e.y-(y*TILE+20))>3)target={x:x*TILE+20,y:y*TILE+20};
    else if(Math.abs(target.y-e.y)>TILE*.6&&Math.abs(e.x-(x*TILE+20))>3)target={x:x*TILE+20,y:y*TILE+20};
    const d=distance(e,target)||1;return {x:(target.x-e.x)/d,y:(target.y-e.y)/d};
  }
  function enemyAttack(e){const p=game.player,angle=Math.atan2(p.y-e.y,p.x-e.x),behavior=e.behavior||(e.boss?'fan':'chaser');
    if(behavior==='charger'){e.windup=.65;e.chargeAngle=angle;return;}
    const count=e.shots||1;for(let i=0;i<count;i++){const a=behavior==='ring'?angle+i*Math.PI*2/count:angle+(i-(count-1)/2)*.2;spawnBullet(e.x,e.y,a,e.projectileSpeed||155,e.damage||12,e.color||'#cba7da',{hostile:true,life:4});}
    effect('ring',e.x,e.y,e.color||'#cba7da',.3,35);
  }
  function updateEnemies(dt){const p=game.player;
    for(const e of game.enemies){if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.cd-=dt;const d=distance(p,e),visible=d<520&&lineOfSight(e,p);
      if(visible&&d<(p.wideLight?420:330))e.alert=5;else e.alert=Math.max(0,(e.alert||0)-dt);
      const rage=e.boss&&e.enrage&&e.hp<e.maxHp*.35;if(rage&&!e.raging){e.raging=true;worldMessage(`${e.name} is enraged!`,3);effect('ring',e.x,e.y,'#f4a881',.7,80);}
      if(e.boss&&game.partySize>=4){e.summonCD-=dt;if(e.summonCD<=0){e.summonCD=Math.max(3,8-game.partySize*.45);const count=game.partySize>=8?3:1;for(let i=0;i<count;i++){const a=i*Math.PI*2/count+game.time,id=9000+Math.floor(game.time*100)+i;game.enemies.push({x:e.x+Math.cos(a)*55,y:e.y+Math.sin(a)*55,...sanitizeCreature(creatureDefaults.stalker,false),id,boss:false,elite:true,hp:55,maxHp:55,r:13,cd:1,flash:0,alert:5,windup:0,chargeTime:0,chargeAngle:0,raging:false});}worldMessage(`${e.name} calls reinforcements!`,2);}}
      if(e.boss&&game.partySize>=8&&Math.floor(game.time)%7===0&&Math.floor((game.time-dt)%7)!==Math.floor(game.time%7)){for(let i=0;i<12;i++)spawnBullet(e.x,e.y,i*Math.PI/6,125,e.damage*.7,'#d8a7e8',{hostile:true,life:4});effect('ring',e.x,e.y,'#d8a7e8',.8,110);}
      const rageScale=e.raging?1.3:1,behavior=e.behavior||(e.boss?'fan':'chaser');
      if(e.windup>0){e.windup=Math.max(0,e.windup-dt);if(e.windup===0)e.chargeTime=.42;}
      else if(e.chargeTime>0){e.chargeTime-=dt;const before={x:e.x,y:e.y};move(e,Math.cos(e.chargeAngle)*(e.speed*4+130)*dt,Math.sin(e.chargeAngle)*(e.speed*4+130)*dt);if(distance(before,e)<.1)e.chargeTime=0;}
      else if(e.alert>0){const dir=chaseDirection(e,visible);let sign=1;if(behavior==='sentry')sign=0;else if(behavior==='spitter'&&visible)sign=d<150?-1:d<235?0:1;else if(e.boss&&behavior!=='charger'&&d<170)sign=0;move(e,dir.x*e.speed*rageScale*sign*dt,dir.y*e.speed*rageScale*sign*dt);
        if(behavior!=='chaser'&&e.cd<=0&&visible&&d<(behavior==='charger'?300:420)){e.cd=(e.cooldown||2.4)/(e.raging?1.5:1);enemyAttack(e);}
      }
      if(distance(p,e)<e.r+p.r+2)hurtPlayer(e.damage||(e.boss?22:12));
    }
  }
  function updateExploration(dt){game.exploreCD-=dt;if(game.exploreCD>0)return;game.exploreCD=.2;const p=game.player,grid=game.map.grid,r=lightRadius();for(let y=Math.max(0,Math.floor((p.y-r)/TILE));y<Math.min(grid.length,Math.ceil((p.y+r)/TILE));y++)for(let x=Math.max(0,Math.floor((p.x-r)/TILE));x<Math.min(grid[0].length,Math.ceil((p.x+r)/TILE));x++){const pos={x:x*TILE+20,y:y*TILE+20};if(distance(p,pos)<r&&lineOfSight(p,pos))game.explored.add(y*grid[0].length+x);}}
  function canMove(x,y,r){return !solid(x-r,y-r)&&!solid(x+r,y-r)&&!solid(x-r,y+r)&&!solid(x+r,y+r);}
  function move(e,dx,dy){if(canMove(e.x+dx,e.y,e.r))e.x+=dx;if(canMove(e.x,e.y+dy,e.r))e.y+=dy;}
  function movement(){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x,y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}return {x,y};}
  function dash(){if(!game||game.paused||game.status!=='playing'||$('modal').open)return;const p=game.player;if(p.dashCD>0)return;let {x,y}=movement();if(Math.hypot(x,y)<.1){const aim=aimPoint();const angle=Math.atan2(aim.y-p.y,aim.x-p.x);x=Math.cos(angle);y=Math.sin(angle);}const len=Math.hypot(x,y)||1;p.dashX=x/len;p.dashY=y/len;p.dash=.18;p.inv=.3;p.dashCD=1.4/(1+.2*(game.upgrades.dash||0));effect('ring',p.x,p.y,'#c8dfac',.3,35);}
  function aimPoint(){const p=game.player;if(isTouch()||!pointer.seen){let nearest=null,best=lightRadius();for(const e of game.enemies){const d=distance(p,e);if(d<best&&lineOfSight(p,e)){nearest=e;best=d;}}return nearest||{x:p.x+100,y:p.y};}return {x:pointer.x/view.scale+view.x,y:pointer.y/view.scale+view.y};}
  function effect(type,x,y,color,life=.35,size=20){if(game.effects.length<200)game.effects.push({type,x,y,color,life,max:life,size});}
  function damageMultiplier(){const p=game.player;return (1+.15*(game.items.fang||0))*(p.hp<p.maxHp*.5?1+.35*(game.items.crown||0):1);}
  function shoot(){const p=game.player,w=weapons[p.weapon],target=aimPoint(),angle=Math.atan2(target.y-p.y,target.x-p.x);p.attacks++;const echoes=p.attacks%5===0?(game.items.echo||0):0;for(let copy=0;copy<=Math.min(echoes,12);copy++)for(const spread of w.spread){const a=angle+spread+(copy?((copy%2?1:-1)*Math.ceil(copy/2)*.08):0),critical=Math.random()<.08*(game.upgrades.critical||0),damage=w.damage*damageMultiplier()*(critical?1.8:1);spawnBullet(p.x,p.y,a,w.speed,damage,critical?'#fff1a6':copy?'#bbccef':w.color,{pierce:w.pierce,direct:true,burn:game.upgrades.fire||0,poison:game.upgrades.poison||0});}p.fireCD=w.rate/(1+.12*(game.items.quill||0)+.15*(game.upgrades.rapid||0));}
  function spawnBullet(x,y,angle,speed,damage,color,extra={}){if(game.bullets.length>=300)return;game.bullets.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,color,life:1.9,r:4,pierce:1,hit:new Set(),...extra});}
  function hurtEnemy(e,amount,direct=false){if(e.hp<=0)return;e.hp-=amount;e.flash=.12;effect('spark',e.x,e.y,'#eed8a2',.2,8);if(direct){game.player.hits++;if(game.items.storm&&game.player.hits%8===0){const radius=64+24*game.items.storm;effect('ring',e.x,e.y,'#e1e6aa',.4,radius);for(const other of game.enemies)if(other.hp>0&&distance(e,other)<radius)hurtEnemy(other,28*damageMultiplier(),false);}}}
  function hurtPlayer(amount){const p=game.player;if(p.inv>0)return;if(p.shield>0){const blocked=Math.min(p.shield,amount);p.shield-=blocked;amount-=blocked;if(amount<=0){p.inv=.25;effect('ring',p.x,p.y,'#8fdbe5',.3,30);return;}}p.hp=Math.max(0,p.hp-amount);p.inv=.65;effect('ring',p.x,p.y,'#dc8873',.3,30);if(p.hp<=0)endRun('dead');}
  function killEnemies(){for(const e of game.enemies){if(e.hp>0||e.dead)continue;e.dead=true;game.kills++;if(e.boss){game.bossDead=true;worldMessage('The keeper has fallen. Find the glowing exit!',5);}effect('burst',e.x,e.y,e.boss?'#d4b9ed':'#b2c494',.6,e.boss?45:22);const coins=e.boss?12:3;for(let i=0;i<coins;i++)game.coins.push({x:e.x+(Math.random()-.5)*20,y:e.y+(Math.random()-.5)*20});const targets=game.enemies.filter(t=>t.hp>0);for(let i=0;i<Math.min(game.items.beetle||0,12)&&targets.length;i++){const t=targets[i%targets.length],angle=Math.atan2(t.y-e.y,t.x-e.x);spawnBullet(e.x,e.y,angle,300,18*damageMultiplier(),'#b4e9c7',{homing:t.id,life:2.5,direct:false});}}game.enemies=game.enemies.filter(e=>!e.dead);}
  function worldMessage(text,seconds=2){if(!game)return;game.message=text;game.messageUntil=game.time+seconds;}
  function interact(){
    if(!game||game.paused||game.status!=='playing'||$('modal').open)return;
    const door=game.doors.find(d=>!d.open&&distance(d,game.player)<58);
    if(door){if(game.keysOwned<1){worldMessage('This door needs a dungeon key.',3);return;}game.keysOwned--;door.open=true;game.paths=null;effect('burst',door.x,door.y,'#7fc3dc',.5,28);worldMessage('The lock gives way.',2);updateHUD();return;}
    const chest=game.chests.find(c=>!c.opened&&distance(c,game.player)<62&&lineOfSight(game.player,c));
    if(!chest){worldMessage('Move close to a chest or locked door.');return;}
    const cost=chest.kind==='vault'?nextChestCost()*3:nextChestCost();
    const useKey=chest.kind==='vault'&&game.keysOwned>0;
    if(!useKey&&game.gold<cost){worldMessage(`${chest.kind==='vault'?'Relic vault':'Chest'} costs ${cost} gold · You have ${game.gold} · Need ${cost-game.gold} more`,3);updateHUD();return;}
    // One transaction per opening: failed attempts and relic selection never charge twice.
    if(useKey)game.keysOwned--;else game.gold-=cost;chest.opened=true;game.chestsOpened++;if(chest.kind==='vault')window.dispatchEvent(new CustomEvent('omr:achievement',{detail:{key:'vaults'}}));updateHUD();
    if(chest.kind==='upgrade'){
      const choice=upgrades[Math.floor(Math.random()*upgrades.length)];game.upgrades[choice.id]=(game.upgrades[choice.id]||0)+1;if(choice.id==='shield')game.player.shield+=18;updateInventory();worldMessage(`${choice.name} ×${game.upgrades[choice.id]} · ${choice.text}`,4);return;
    }
    const pool=[...relics],choices=[];
    for(let i=0;i<3;i++){const weights=pool.map(r=>r.rarity==='COMMON'?4:r.rarity==='UNCOMMON'?2:1);let roll=Math.random()*weights.reduce((a,b)=>a+b,0),index=0;while(index<weights.length-1&&(roll-=weights[index])>0)index++;choices.push(pool.splice(index,1)[0]);}
    const body=showModal('A dangerous little decision.',`${useKey?'SPENT 1 KEY':`PAID ${cost} GOLD`} / CHOOSE ONE RELIC`);
    $('modal').dataset.choice='true';$('modalClose').classList.add('hidden');
    paragraph(body,`Take one relic for this run. Duplicates strengthen existing relics. The next chest costs ${nextChestCost()} gold.`);
    const grid=document.createElement('div');grid.className='choice-grid';let chosen=false;
    for(const r of choices){const card=relicCard(r,game.items[r.id]||0),b=document.createElement('button');b.className='codex-card item-choice';b.setAttribute('aria-label',`Take ${r.name}`);b.append(...card.childNodes);b.onclick=()=>{if(chosen)return;chosen=true;game.items[r.id]=(game.items[r.id]||0)+1;$('modal').dataset.choice='false';$('modalClose').classList.remove('hidden');closeModal();updateInventory();worldMessage(`${r.name} ×${game.items[r.id]} · ${r.short}`,3);};grid.append(b);}body.append(grid);
  }
  function update(dt){
    if(!game||game.status!=='playing'||game.paused)return;game.time+=dt;const p=game.player;p.inv=Math.max(0,p.inv-dt);p.fireCD-=dt;p.dashCD=Math.max(0,p.dashCD-dt);if(game.upgrades.shield){p.shieldTimer-=dt;if(p.shieldTimer<=0){p.shield=Math.max(p.shield,18*game.upgrades.shield);p.shieldTimer=12;}}const m=movement();
    if(p.dash>0){p.dash-=dt;move(p,p.dashX*510*dt,p.dashY*510*dt);if(game.items.cinder)game.hazards.push({x:p.x,y:p.y,life:1+game.items.cinder,r:22});}else move(p,m.x*155*(p.perk==='swift'?1.15:1)*dt,m.y*155*(p.perk==='swift'?1.15:1)*dt);if(game.networked&&game.netTarget&&distance(p,game.netTarget)>140){p.x=game.netTarget.x;p.y=game.netTarget.y;}
    updateLantern(dt);for(const key of game.stageKeys)if(!key.collected&&distance(key,p)<20){key.collected=true;game.keysOwned++;effect('burst',key.x,key.y,'#75bce0',.5,24);worldMessage('Dungeon key found. Press E near a locked door.',3);}updateExploration(dt);game.pathCD-=dt;if(game.pathCD<=0){game.pathCD=.35;rebuildPaths();}
    const auto=isTouch()&&game.enemies.some(e=>distance(p,e)<lightRadius()&&lineOfSight(p,e));if((pointer.down||auto)&&p.fireCD<=0)shoot();
    updateEnemies(dt);
    for(const b of game.bullets){b.life-=dt;if(b.homing){const target=game.enemies.find(e=>e.id===b.homing);if(target){const a=Math.atan2(target.y-b.y,target.x-b.x);b.vx=Math.cos(a)*300;b.vy=Math.sin(a)*300;}}b.x+=b.vx*dt;b.y+=b.vy*dt;if(solid(b.x,b.y)){b.life=0;continue;}if(b.hostile){if(distance(b,p)<p.r+b.r){hurtPlayer(b.damage);b.life=0;}}else for(const e of game.enemies){if(e.hp>0&&!b.hit.has(e.id)&&distance(b,e)<e.r+b.r){b.hit.add(e.id);hurtEnemy(e,b.damage+b.damage*(b.poison||0)*.12,b.direct);if(b.burn){const radius=34+8*b.burn;effect('ring',e.x,e.y,'#e38a55',.3,radius);for(const other of game.enemies)if(other!==e&&other.hp>0&&distance(e,other)<radius)hurtEnemy(other,b.damage*.22*b.burn,false);}if(--b.pierce<=0){b.life=0;break;}}}}
    game.bullets=game.bullets.filter(b=>b.life>0);
    for(const hazard of game.hazards)hazard.life-=dt;game.hazards=game.hazards.filter(h=>h.life>0);
    for(const e of game.enemies)if(game.hazards.some(h=>distance(h,e)<h.r+e.r))hurtEnemy(e,22*dt,false);
    if(Math.sin(game.time*2.2)>0.25)for(const trap of game.traps)if(distance(p,trap)<20)hurtPlayer(10);
    killEnemies();for(const c of game.coins){const d=distance(c,p);if(d<85){c.x+=(p.x-c.x)*dt*8;c.y+=(p.y-c.y)*dt*8;}if(d<16){c.taken=true;game.gold++;game.goldEarned++;p.hp=Math.min(p.maxHp,p.hp+3*(game.items.moss||0)+(p.perk==='moss'?2:0));}}game.coins=game.coins.filter(c=>!c.taken);
    if(game.mode==='duel'&&game.kills>(game.lastDropKills||0)){game.lastDropKills=game.kills;const drop=upgrades[Math.floor(Math.random()*upgrades.length)];game.upgrades[drop.id]=(game.upgrades[drop.id]||0)+1;worldMessage(`Arena drop · ${drop.name}: ${drop.text}`,3);updateInventory();}
    for(const fx of game.effects)fx.life-=dt;game.effects=game.effects.filter(fx=>fx.life>0);
    if(game.mode==='duel'&&!game.enemies.length)advanceDuel();else if(game.mode!=='duel'&&distance(p,game.exit)<25&&(game.stage<game.maxStages||game.bossDead))advanceStage();
    if(game.time>game.messageUntil){const door=game.doors.find(d=>!d.open&&distance(d,p)<58),chest=game.chests.find(c=>!c.opened&&distance(c,p)<62&&lineOfSight(p,c));game.message=door?(game.keysOwned?'Press E · Use a dungeon key':'Locked · find a dungeon key'):chest?(chest.kind==='vault'?`Press E · Relic vault · ${game.keysOwned?'1 key':`${nextChestCost()*3} gold`}`:chestPrompt()):distance(p,game.exit)<65&&game.stage===game.maxStages&&!game.bossDead?'The keeper seals this exit.':'';}
  }
  function updateInventory(){const inv=$('inventory');inv.replaceChildren();const items=game?Object.entries(game.items):[];$('relicCount').textContent=items.reduce((n,[,v])=>n+v,0);if(!items.length){const empty=document.createElement('div');empty.className='empty-inventory';const icon=document.createElement('span');icon.textContent='♧';empty.append(icon);paragraph(empty,'A suspicious amount of room for treasure.');const small=document.createElement('small');small.textContent='Open chests to discover relics. Duplicates make them stronger.';empty.append(small);inv.append(empty);}for(const [id,count]of items){const r=relics.find(x=>x.id===id);const row=document.createElement('div');row.className='relic-row';row.title=`${r.text} ${r.stack}`;const icon=document.createElement('span');icon.className='relic-icon';icon.textContent=r.icon;icon.style.color=r.color;const text=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),b=document.createElement('b');strong.textContent=r.name;small.textContent=r.short;b.textContent=`×${count}`;text.append(strong,small);row.append(icon,text,b);inv.append(row);}const note=$('synergy').querySelector('p');note.textContent=game?.items.echo&&game?.items.storm?'A storm in every echo. Extra volleys charge your lightning burst faster.':game?.items.beetle&&game?.items.storm?'Lightning clears the room. Glass Beetle sends shards after the survivors.':'Echoes can spark storms. Storms can scatter shards. Choose a little chaos.';}
  const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
  function updateHUD(){const p=game?.player,pricing=game?.chestPricing||normalizeChestPricing(selectedMap?.chestPricing);$('chestCost').textContent=`${chestPrice(pricing,game?.chestsOpened||0)} gold`;$('chestCostNote').textContent=`+${pricing.increase} gold after each opening`;$('kills').textContent=game?.kills||0;$('gold').textContent=game?.gold||0;if(p){$('healthText').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('healthBar').style.width=`${p.hp/p.maxHp*100}%`;$('runClock').textContent=formatTime(game.time);$('touchDash').textContent=p.dashCD>0?`${p.dashCD.toFixed(1)}s`:'DASH';$('lanternText').textContent=`${isTouch()?'☀':'L'} · ${p.recharging?'RECHARGING':p.wideLight?'WIDE BEAM ON':'WIDE BEAM OFF'} · ${Math.floor(p.lantern)}%`;$('lanternBar').style.width=`${p.lantern}%`;$('lanternToggle').setAttribute('aria-pressed',String(p.wideLight));$('lanternToggle').classList.toggle('lit',p.wideLight);}const visible=game&&game.status==='playing'&&(game.message||game.paused)&&!$('modal').open;$('worldMessage').classList.toggle('hidden',!visible);if(visible)$('worldMessage').textContent=game.paused?'Paused · press P or Resume to continue':game.message;}

  updateInventory=function(){const inv=$('inventory'),items=game?Object.entries(game.items):[],kit=game?Object.entries(game.upgrades||{}):[];inv.replaceChildren();$('relicCount').textContent=items.reduce((n,[,v])=>n+v,0);if(!items.length&&!kit.length){const empty=document.createElement('div');empty.className='empty-inventory';empty.innerHTML='<span>♧</span><p>A suspicious amount of room for treasure.</p><small>Upgrade chests build your kit. Relic vaults bend its rules.</small>';inv.append(empty);}for(const [id,count]of kit){const u=upgrades.find(x=>x.id===id),row=document.createElement('div');row.className='relic-row';row.innerHTML=`<span class="relic-icon">⬡</span><div><strong>${u.name}</strong><small>${u.text}</small></div><b>×${count}</b>`;inv.append(row);}for(const [id,count]of items){const r=relics.find(x=>x.id===id),row=document.createElement('div');row.className='relic-row';row.innerHTML=`<span class="relic-icon" style="color:${r.color}">${r.icon}</span><div><strong>${r.name}</strong><small>${r.short}</small></div><b>×${count}</b>`;inv.append(row);}}
  function updateV11HUD(){if(!game)return;const p=game.player;if($('stageText'))$('stageText').textContent=game.mode==='duel'?`ROUND ${game.round}`:`${game.stage} / ${game.maxStages}`;if($('stageBar'))$('stageBar').style.width=game.mode==='duel'?`${(game.arenaIndex+1)/10*100}%`:`${game.stage/game.maxStages*100}%`;if(p&&game.keysOwned)$('lanternText').textContent+=` · ${game.keysOwned} KEY${game.keysOwned===1?'':'S'}`;}
  // Drawn locally on canvas: no downloaded art or game assets.
  function resize(){const r=$('canvasWrap').getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);view.w=r.width;view.h=r.height;view.dpr=dpr;}
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function diamond(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.7,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.7,y);ctx.closePath();ctx.fill();}
  function draw(){
    // A hidden or unloading document can briefly report a zero-sized canvas.
    if(view.w<1||view.h<1)return;
    const map=game?.map||selectedMap||demo,t=game?.time||performance.now()/1000;
    const {w:W,h:H}=dimensions(map.grid);
    ctx.setTransform(view.dpr||1,0,0,view.dpr||1,0,0);ctx.fillStyle='#0a100d';ctx.fillRect(0,0,view.w,view.h);
    const fullScale=Math.min(view.w/(W*TILE),view.h/(H*TILE));view.scale=game?Math.max(fullScale,Math.min(1.2,view.w/580)):fullScale;
    const visibleW=view.w/view.scale,visibleH=view.h/view.scale;const p=game?.player;
    view.x=p?clamp(p.x-visibleW/2,Math.min(0,(W*TILE-visibleW)/2),Math.max(0,W*TILE-visibleW)):(W*TILE-visibleW)/2;
    view.y=p?clamp(p.y-visibleH/2,Math.min(0,(H*TILE-visibleH)/2),Math.max(0,H*TILE-visibleH)):(H*TILE-visibleH)/2;
    ctx.scale(view.scale,view.scale);ctx.translate(-view.x,-view.y);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const px=x*TILE,py=y*TILE,tile=map.grid[y][x],hash=(x*31+y*73)%17;
      if(px+TILE<view.x||px>view.x+visibleW||py+TILE<view.y||py>view.y+visibleH)continue;
      ctx.fillStyle=['#1b2922','#1c2b24','#202e26','#1e2b23'][hash%4];ctx.fillRect(px,py,TILE,TILE);ctx.strokeStyle='#0f1b1555';ctx.lineWidth=1;ctx.strokeRect(px+1,py+1,TILE-2,TILE-2);
      if(hash%5===0){ctx.fillStyle='#34463480';ctx.fillRect(px+8,py+28,9,2);ctx.fillRect(px+12,py+23,2,7);}
      if(tile===1){ctx.fillStyle='#09110c';ctx.fillRect(px,py+8,TILE,TILE);rounded(px+1,py-3,38,37,3,hash%3?'#3a4a38':'#43513b');ctx.fillStyle='#596448';ctx.fillRect(px+3,py-3,34,3);ctx.fillStyle='#2c3b2c';ctx.fillRect(px+2,py+30,36,4);ctx.strokeStyle='#263629';ctx.beginPath();ctx.moveTo(px+20,py+1);ctx.lineTo(px+20,py+14);ctx.lineTo(px+38,py+14);ctx.stroke();if(hash%3===0){circle(px+7,py+2,5,'#596c43');circle(px+11,py+4,3,'#6c8050');}}
      if(tile===2){ctx.strokeStyle='#94b37750';ctx.lineWidth=2;ctx.strokeRect(px+9,py+9,22,22);}
      if(tile===3){ctx.save();ctx.shadowBlur=22;ctx.shadowColor='#a5d993';ctx.strokeStyle=game?.bossDead?'#d1ed9d':'#718965';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(px+20,py+21,15,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();diamond(px+20,py+15+Math.sin(t*2)*3,7,game?.bossDead?'#d1ed9d':'#759470');}
      if(tile===6){const active=Math.sin(t*2.2)>.25;for(let i=0;i<3;i++)diamond(px+10+i*10,py+20,active?9:4,active?'#c78c75':'#58644d');}
      if(tile===8){rounded(px+14,py+18,12,14,3,'#66543b');ctx.save();ctx.shadowColor='#ffb45d';ctx.shadowBlur=24;diamond(px+20,py+12,9+Math.sin(t*7+x)*1.5,'#edb767');diamond(px+20,py+14,5,'#ffe3a3');ctx.restore();}
      if(!game&&tile===9){circle(px+16,py+20,6,'#76bce0');ctx.fillStyle='#76bce0';ctx.fillRect(px+20,py+18,12,4);}
      if(!game&&tile===10){rounded(px+5,py+3,30,36,3,'#42677d');circle(px+27,py+21,2,'#e3c979');}
    }
    const chests=game?.chests||map.grid.flatMap((row,y)=>row.flatMap((tile,x)=>[5,11].includes(tile)?[{x:x*TILE+20,y:y*TILE+20,opened:false,kind:tile===11?'vault':'upgrade'}]:[]));
    for(const c of chests){circle(c.x,c.y+9,16,'#0a140b90');ctx.save();if(!c.opened){ctx.shadowColor=c.kind==='vault'?'#df94dd':'#efc479';ctx.shadowBlur=14;}rounded(c.x-12,c.y-7,24,18,3,c.opened?'#584b33':c.kind==='vault'?'#8e5790':'#bc9050');ctx.restore();rounded(c.x-12,c.y-9,24,c.opened?4:8,2,c.opened?'#786343':c.kind==='vault'?'#e0a8e0':'#d9b675');ctx.fillStyle='#4b4128';ctx.fillRect(c.x-2,c.y-3,4,9);if(!c.opened){diamond(c.x,c.y-19+Math.sin(t*3+c.x)*3,3,c.kind==='vault'?'#f2b8ef':'#ecd497');}}
    if(game)for(const c of game.chests)if(!c.opened&&distance(c,game.player)<lightRadius()&&lineOfSight(game.player,c)){const cost=c.kind==='vault'?nextChestCost()*3:nextChestCost(),label=c.kind==='vault'&&game.keysOwned?'1 key':`${cost} gold`;rounded(c.x-28,c.y+16,56,16,3,'#0b140fe8');ctx.fillStyle=(game.gold>=cost||game.keysOwned&&c.kind==='vault')?'#d5e8a7':'#e6bb81';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(label,c.x,c.y+27);}
    if(game){
      for(const key of game.stageKeys)if(!key.collected){ctx.save();ctx.shadowBlur=15;ctx.shadowColor='#72c8ef';circle(key.x-4,key.y,7,'#82c8e8');ctx.fillStyle='#82c8e8';ctx.fillRect(key.x+2,key.y-2,13,4);ctx.fillRect(key.x+10,key.y+2,3,5);ctx.restore();}
      for(const door of game.doors)if(!door.open){rounded(door.x-15,door.y-18,30,36,3,'#42677d');ctx.strokeStyle='#79a9bd';ctx.strokeRect(door.x-12,door.y-15,24,30);circle(door.x+7,door.y+1,2,'#e3c979');}
      for(const h of game.hazards){circle(h.x,h.y,h.r,'#cf772e22');diamond(h.x,h.y-4,8,'#d99b4c77');}
      for(const c of game.coins){ctx.save();ctx.shadowBlur=8;ctx.shadowColor='#e6c984';diamond(c.x,c.y,5,'#e6c984');ctx.restore();}
      for(const e of game.enemies)drawEnemy(e,t);
      for(const remote of game.remotePlayers||[]){circle(remote.x,remote.y+10,13,'#07100bcc');circle(remote.x,remote.y,11,remote.color||'#8fd1c0');ctx.fillStyle='#e7f2d5';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(remote.name||'RELIC HUNTER',remote.x,remote.y-17);}
      for(const b of game.bullets){ctx.strokeStyle=b.color;ctx.lineWidth=b.hostile?5:3;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();circle(b.x,b.y,b.hostile?5:3,b.color);}
      drawPlayer(game.player,t);
      for(const fx of game.effects){ctx.save();ctx.globalAlpha=fx.life/fx.max;const progress=1-fx.life/fx.max;if(fx.type==='ring'){ctx.strokeStyle=fx.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(fx.x,fx.y,fx.size*(.3+.7*progress),0,Math.PI*2);ctx.stroke();}else for(let i=0;i<8;i++){const angle=i*Math.PI/4;diamond(fx.x+Math.cos(angle)*fx.size*progress,fx.y+Math.sin(angle)*fx.size*progress,3,fx.color);}ctx.restore();}
    }else{for(let y=0;y<H;y++)for(let x=0;x<W;x++)if([4,7].includes(map.grid[y][x]))drawEnemy({x:x*TILE+20,y:y*TILE+20,...sanitizeCreature(map.creatures?.[`${x},${y}`],map.grid[y][x]===7),boss:map.grid[y][x]===7,maxHp:650,flash:0},t);}
    if(game)drawLighting();
    ctx.setTransform(view.dpr||1,0,0,view.dpr||1,0,0);const gradient=ctx.createRadialGradient(view.w/2,view.h/2,view.w*.18,view.w/2,view.h/2,Math.max(view.w,view.h)*.72);gradient.addColorStop(0,'#06100800');gradient.addColorStop(1,'#040b0770');ctx.fillStyle=gradient;ctx.fillRect(0,0,view.w,view.h);
    if(game)drawMinimap();
  }
  function drawEnemy(e,t){
    if(e.windup>0){ctx.save();ctx.strokeStyle='#f8b182';ctx.setLineDash([7,5]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.chargeAngle)*210,e.y+Math.sin(e.chargeAngle)*210);ctx.stroke();ctx.restore();circle(e.x,e.y,25,'#ed996622');}
    circle(e.x,e.y+10,e.boss?22:14,'#060e0a90');const bob=Math.sin(t*3+e.x)*2,color=e.color||(e.boss?'#aa86c0':'#80926c');ctx.save();ctx.translate(e.x,e.y+bob);if(e.elite){ctx.shadowBlur=14;ctx.shadowColor='#eac86f';ctx.strokeStyle='#eac86f';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();}
    if(e.raging){ctx.shadowBlur=15;ctx.shadowColor='#f39c72';}
    if(e.boss){rounded(-19,-19,38,37,8,e.flash?'#f2e6c8':color);diamond(-16,-20,10,color);diamond(16,-20,10,color);rounded(-12,-8,24,14,5,'#343543');circle(-6,-3,3,'#efe5ac');circle(6,-3,3,'#efe5ac');diamond(0,13,6,'#e5d3eb');}
    else if(e.behavior==='sentry'){rounded(-13,-12,26,25,3,e.flash?'#eee4bb':color);diamond(0,0,7,'#233c38');circle(0,-1,3,'#f8dc99');}
    else{ctx.fillStyle=e.flash?'#eee4bb':color;ctx.beginPath();ctx.ellipse(0,1,14,12,0,Math.PI,0);ctx.lineTo(14,9);ctx.quadraticCurveTo(0,14,-14,9);ctx.closePath();ctx.fill();circle(-5,1,2,'#172317');circle(5,1,2,'#172317');if(e.behavior==='charger'){diamond(-11,-11,6,'#e1c79d');diamond(11,-11,6,'#e1c79d');}else if(e.behavior==='spitter')circle(0,7,4,'#493825');else{ctx.fillStyle='#b8c492';ctx.fillRect(-6,-9,6,2);}}
    ctx.restore();if(e.hp<e.maxHp||e.boss){rounded(e.x-20,e.y-(e.boss?35:23),40,4,2,'#332b30');rounded(e.x-20,e.y-(e.boss?35:23),40*Math.max(0,e.hp/e.maxHp),4,2,color);}
    if(e.boss&&game){ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillStyle=e.raging?'#ffc28e':'#dfd5e5';ctx.fillText(`${e.name}${e.raging?' · ENRAGED':''}`,e.x,e.y-43);}
  }
  const lightCanvas=document.createElement('canvas'),lightContext=lightCanvas.getContext('2d');
  function shadowPolygon(source,radius,grid){const points=[];for(let i=0;i<112;i++){const a=i/112*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let r=0;for(r=0;r<radius;r+=7)if(wallAt(grid,source.x+dx*r,source.y+dy*r))break;points.push({x:source.x+dx*Math.min(r+4,radius),y:source.y+dy*Math.min(r+4,radius)});}return points;}
  function drawLighting(){
    const w=Math.ceil(view.w),h=Math.ceil(view.h);if(lightCanvas.width!==w||lightCanvas.height!==h){lightCanvas.width=w;lightCanvas.height=h;}
    const c=lightContext;c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,w,h);const alpha=game.map.lighting==='dark'?.98:game.map.lighting==='bright'?.42:.89;c.fillStyle=`rgba(3,9,9,${alpha})`;c.fillRect(0,0,w,h);
    const sources=[{...game.player,radius:lightRadius()},...game.torches.map(t=>({...t,radius:165,torch:t}))];
    c.globalCompositeOperation='destination-out';
    for(const source of sources){const sx=(source.x-view.x)*view.scale,sy=(source.y-view.y)*view.scale,r=source.radius*view.scale;if(sx+r<0||sy+r<0||sx-r>w||sy-r>h)continue;
      const points=source.torch?(source.torch.polygon||=shadowPolygon(source,source.radius,game.map.grid)):shadowPolygon(source,source.radius,game.map.grid);
      c.save();c.beginPath();points.forEach((p,i)=>{const x=(p.x-view.x)*view.scale,y=(p.y-view.y)*view.scale;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.closePath();c.clip();
      const g=c.createRadialGradient(sx,sy,r*.08,sx,sy,r);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.48,'rgba(0,0,0,.95)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(sx-r,sy-r,r*2,r*2);c.restore();
    }
    c.globalCompositeOperation='source-over';ctx.save();ctx.setTransform(view.dpr||1,0,0,view.dpr||1,0,0);ctx.drawImage(lightCanvas,0,0,view.w,view.h);ctx.restore();
  }
  function drawMinimap(){
    const {w,h}=dimensions(game.map.grid),scale=(view.w<500?88:125)/w,x=view.w-w*scale-18,y=64;
    rounded(x-5,y-5,w*scale+10,h*scale+23,4,'#08120fdd');ctx.fillStyle='#3d4e3e';
    for(const key of game.explored){const tx=key%w,ty=Math.floor(key/w);ctx.fillStyle=game.map.grid[ty][tx]===1?'#75876a':'#344e3b';ctx.fillRect(x+tx*scale,y+ty*scale,Math.max(1,scale-.3),Math.max(1,scale-.3));}
    for(const [tile,color]of [[3,'#8ef1c3'],[5,'#ddbc79'],[8,'#edb767']])for(const key of game.explored){const tx=key%w,ty=Math.floor(key/w);if(game.map.grid[ty][tx]===tile){ctx.fillStyle=color;ctx.fillRect(x+tx*scale,y+ty*scale,2,2);}}
    circle(x+game.player.x/TILE*scale,y+game.player.y/TILE*scale,2.5,'#dfefbb');ctx.fillStyle='#93a486';ctx.font='8px sans-serif';ctx.textAlign='left';ctx.fillText('EXPLORED',x,y+h*scale+13);
  }
  function drawPlayer(p,t){ctx.save();circle(p.x,p.y+12,14,'#030c08a0');if(p.inv>0&&Math.floor(t*20)%2)ctx.globalAlpha=.5;const bob=Math.sin(t*8)*1.2;ctx.translate(p.x,p.y+bob);ctx.fillStyle=p.skinColor||'#cce6a2';ctx.beginPath();ctx.moveTo(0,-14);ctx.quadraticCurveTo(15,-7,13,12);ctx.lineTo(-13,12);ctx.quadraticCurveTo(-15,-7,0,-14);ctx.fill();rounded(-8,-6,16,10,4,'#273d2c');circle(-3,-2,1.5,'#f0efd4');circle(3,-2,1.5,'#f0efd4');ctx.strokeStyle='#e0c491';ctx.lineWidth=3;const target=aimPoint(),a=Math.atan2(target.y-p.y,target.x-p.x);ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a)*24,Math.sin(a)*24);ctx.stroke();diamond(Math.cos(a)*24,Math.sin(a)*24,4,weapons[p.weapon].color);ctx.restore();if(p.dashCD<=0){ctx.strokeStyle='#bbd59460';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y+1,19,0,Math.PI*2);ctx.stroke();}}
  function frame(now){if(window.OMRNetwork?.active){lastFrame=now;requestAnimationFrame(frame);return;}let dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;while(dt>0){const step=Math.min(dt,1/120);update(step);dt-=step;}draw();if(now-lastHUD>100){updateHUD();lastHUD=now;}requestAnimationFrame(frame);}
  window.addEventListener('keydown',e=>{if($('modal').open||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)&&game?.status==='playing')e.preventDefault();keys.add(k);if(!e.repeat){if(k===' ')dash();if(k==='e')interact();if(k==='p')pauseRun();if(k==='l')toggleLantern();}});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();pointer.down=false;stick={x:0,y:0};if(game?.status==='playing'&&!game.paused){game.paused=true;$('pause').textContent='Resume ▷';}});
  function pointerPosition(e){const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;pointer.seen=true;}
  canvas.addEventListener('pointermove',pointerPosition);canvas.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch')return;pointerPosition(e);pointer.down=true;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointerup',()=>pointer.down=false);canvas.addEventListener('pointercancel',()=>pointer.down=false);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let joystickId=null;const joystick=$('joystick');function moveStick(e){if(e.pointerId!==joystickId)return;const r=joystick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/35,dy=(e.clientY-r.top-r.height/2)/35,l=Math.max(1,Math.hypot(dx,dy));stick={x:dx/l,y:dy/l};joystick.firstElementChild.style.transform=`translate(${stick.x*27}px,${stick.y*27}px)`;}
  joystick.onpointerdown=e=>{joystickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);};joystick.onpointermove=moveStick;joystick.onpointerup=joystick.onpointercancel=()=>{joystickId=null;stick={x:0,y:0};joystick.firstElementChild.style.transform='';};$('touchDash').onclick=dash;$('touchInteract').onclick=interact;$('lanternToggle').onclick=toggleLantern;
  window.addEventListener('omr:mode',e=>{if(e.detail?.mode==='duel')startDuel();else startRun();});
  window.addEventListener('omr:skin',e=>{if(game?.player)game.player.skinColor=e.detail?.color;});
  window.addEventListener('omr:room',e=>{const {socket,mode,playerId}=e.detail||{};if(!socket)return;if(mode==='duel')startDuel();else startRun();if(game){game.networked=true;game.netTarget={x:game.player.x,y:game.player.y};}socket.on('room:state',room=>window.dispatchEvent(new CustomEvent('omr:networkState',{detail:{...room,playerId}})));setInterval(()=>{if(!game||game.status!=='playing'||socket.disconnected)return;const m=movement();socket.emit('player:input',{x:game.player.x,y:game.player.y,moveX:m.x,moveY:m.y,aimX:aimPoint().x,aimY:aimPoint().y});},50);});
  window.addEventListener('omr:networkState',e=>{if(!game)return;const room=e.detail,players=Object.values(room.players||{});game.partySize=clamp(players.length||1,1,8);const self=room.players?.[room.playerId];if(self&&game.networked){game.netTarget={x:self.x,y:self.y};game.player.hp=self.hp;}game.remotePlayers=players.filter(p=>p.id!==room.playerId).map(p=>({...p,color:{moss:'#cce6a2',ember:'#ee9b6b',frost:'#8fc9e8',void:'#bb9be5',gold:'#e4c36f',creator:'#ec719c'}[p.skin]||'#8fd1c0'}));if(game.mode==='duel'&&room.arenaIndex!==undefined&&room.round>game.round)loadDuelRound(room.round);if(game.mode!=='duel'&&room.stage>game.stage&&room.stage<=game.maxStages)loadStage(room.stage);});
  window.addEventListener('resize',resize);new ResizeObserver(resize).observe($('canvasWrap'));
  window.addEventListener('pagehide',releaseMap);
  window.addEventListener('pageshow',e=>{if(e.persisted&&game?.status==='playing'&&!game.map.builtin){if(readData().maps.some(m=>m.id===game.map.id)){activeMapId=game.map.id;heartbeat();}else endRun('left');}});
  setInterval(()=>{heartbeat();const removed=sweepMaps();if(removed&&!game){updateMaps();toast(`${removed} idle dungeon${removed>1?'s':''} expired. Blueprints are safe.`);}},5000);setInterval(updateV11HUD,200);
  const initial=readData();$('weapon').value=initial.lastLoadout.weapon;$('perk').value=initial.lastLoadout.perk;updateMaps();resize();requestAnimationFrame(frame);if(!storageOK)toast('Storage is unavailable. You can play, but export saves before closing.');
  // Expose pure validation for smoke tests; no gameplay or persistence bypass.
  window.OMR={validateMap,demoMap,normalize,selectedMap:()=>clone(allMaps().find(m=>m.id===$('mapSelect').value)||demo),getSelectedMapGrid:()=>{const id=$('mapSelect')?.value;const map=allMaps().find(x=>x.id===id)||demo;return map.grid.map(row=>row.slice());},version:'1.2.1'};
})();
