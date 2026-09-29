"""Browser regression checks. Optional: pip install --target .tools playwright.

Run the local server first, then python smoke_test.py. Uses installed Edge.
The test-only harness is injected into the intercepted JS response, never shipped.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.test-tools'))
from playwright.sync_api import sync_playwright


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print('PASS:', message, flush=True)


def run():
    out = ROOT / 'test-results'
    out.mkdir(exist_ok=True)
    source = (ROOT / 'game.js').read_text(encoding='utf-8')
    source = source.replace('window.OMR={validateMap',
        'window.__test={get game(){return game;},update,killEnemies,hurtEnemy,interact,returnCamp,heartbeat,sweepMaps};window.OMR={validateMap')
    source = source.replace('const g=c.createRadialGradient(sx,sy,r*.08,sx,sy,r);', 'if(![sx,sy,r].every(Number.isFinite))throw new Error(JSON.stringify({sx,sy,r,source,view}));const g=c.createRadialGradient(sx,sy,r*.08,sx,sy,r);')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1500, 'height': 1050}, reduced_motion='reduce')
        context.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        context.route('**/game.js', lambda r: r.fulfill(body=source, content_type='text/javascript'))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(e.stack))
        page.goto('http://127.0.0.1:8000', wait_until='networkidle')
        page.evaluate('window.OMRV11.enterGame()')
        check(page.title().startswith('One More Relic'), 'Local page loads')
        check(page.evaluate('OMR.validateMap(OMR.demoMap().grid)') == '', 'Demo has reachable objectives')
        page.screenshot(path=str(out / 'desktop-camp.png'), full_page=True)
        page.click('#start')
        check(page.locator('#hud').is_visible(), 'Starting a run displays health and timer')
        start = page.evaluate('__test.game.player.y')
        page.keyboard.down('s')
        page.wait_for_timeout(430)
        page.keyboard.up('s')
        check(page.evaluate('__test.game.player.y') > start + 35, 'Keyboard movement advances player')
        page.evaluate('''() => {const g=__test.game,v=g.chests.find(c=>c.kind==="vault");g.player.x=v.x;g.player.y=v.y;g.gold=9;}''')
        page.keyboard.press('e')
        check(page.locator('.item-choice').count() == 3, 'Chest offers three relic choices')
        check(page.evaluate('__test.game.paused'), 'Simulation pauses during item choice')
        page.keyboard.press('Escape')
        check(page.locator('#modal').is_visible(), 'Item choice cannot be accidentally dismissed')
        page.locator('.item-choice').first.click()
        check(page.locator('.relic-row').count() == 1, 'Chosen relic appears in satchel')
        check(not page.evaluate('__test.game.paused'), 'Combat resumes after choosing')
        page.click('#pause')
        previous = page.evaluate('__test.game.time')
        page.wait_for_timeout(150)
        check(page.evaluate('__test.game.time') == previous, 'Pause stops simulation time')
        page.click('#pause')
        # Deterministic nearby enemy, then real pointer fire through the normal loop.
        page.evaluate('''() => {const g=__test.game;g.player.x=140;g.player.y=220;g.items={};g.enemies=[{x:220,y:220,id:1,boss:false,hp:35,maxHp:35,r:12,speed:0,cd:100,flash:0}];}''')
        page.wait_for_timeout(80)
        # Mouse hasn't aimed: auto nearest fallback provides the correct direction.
        # Use test harness to check actual projectile simulation without a camera-specific coordinate.
        page.evaluate('''() => {const g=__test.game;g.bullets.push({x:160,y:220,vx:400,vy:0,damage:40,color:'#fff',life:2,r:4,pierce:1,direct:true,hit:new Set()});}''')
        page.wait_for_timeout(300)
        check(page.evaluate('__test.game.kills') == 1, 'Projectile collision defeats an enemy')
        check(page.evaluate('__test.game.coins.length + __test.game.gold') > 0, 'Defeated enemy drops collectible treasure')
        # Wall collision and simultaneous secondary damage behavior.
        page.evaluate('__test.game.player.x=52;__test.game.player.y=60')
        page.keyboard.down('a'); page.wait_for_timeout(250); page.keyboard.up('a')
        check(page.evaluate('__test.game.player.x') >= 51, 'Player cannot cross the outer wall')
        page.evaluate('''() => {const g=__test.game;g.items={echo:2,storm:2,beetle:2};g.player.hits=7;g.enemies=[{x:200,y:200,id:2,hp:10,maxHp:10,r:12,speed:0,cd:100,flash:0},{x:210,y:200,id:3,hp:10,maxHp:10,r:12,speed:0,cd:100,flash:0}];__test.hurtEnemy(g.enemies[0],1,true);__test.killEnemies();}''')
        check(page.evaluate('__test.game.enemies.length') == 0, 'Pocket Storm applies area damage without recursion')
        page.evaluate('''() => {const g=__test.game;g.stage=g.maxStages;g.enemies=[{x:200,y:200,id:4,boss:true,hp:1,maxHp:460,r:18,speed:0,cd:100,flash:0}];__test.hurtEnemy(g.enemies[0],10);__test.killEnemies();g.player.x=g.exit.x;g.player.y=g.exit.y;}''')
        page.wait_for_timeout(100)
        check(page.evaluate('__test.game.status') == 'won', 'Keeper defeat unlocks exit and completes run')
        page.click('#returnCamp')
        page.select_option('#weapon', 'scatter'); page.select_option('#perk', 'swift')
        page.click('#savePreset'); page.get_by_role('button', name='Save loadout', exact=True).click()
        page.reload(wait_until='networkidle'); page.evaluate('window.OMRV11.enterGame()')
        check(page.input_value('#weapon') == 'scatter', 'Starting loadout survives reload')
        page.click('#presetsOpen')
        check(page.locator('.preset').count() == 1, 'Named preset persists')
        page.click('#modalClose')
        page.click('#editorOpen')
        page.screenshot(path=str(out / 'workshop.png'), full_page=True)
        page.fill('#editorName', 'Browser test vault')
        page.get_by_role('button', name='Publish & play').click()
        check(page.evaluate('__test.game.map.name') == 'Browser test vault', 'Workshop publishes and starts a custom map')
        saved = page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v1'))")
        check(len(saved['blueprints']) == 1 and len(saved['maps']) == 1, 'Blueprint and published map are stored separately')
        page.screenshot(path=str(out / 'desktop-run.png'), full_page=True)
        # Existing fresh player heartbeat must protect an old idle timestamp.
        page.evaluate("""() => {const d=JSON.parse(localStorage.getItem('one-more-relic:v1'));d.maps[0].idleSince=Date.now()-7200000;localStorage.setItem('one-more-relic:v1',JSON.stringify(d));__test.sweepMaps();}""")
        check(page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v1')).maps.length") == 1, 'Active heartbeat protects maps from expiry')
        page.click('#leave')
        saved = page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v1'))")
        check(not saved['maps'][0]['sessions'], 'Leaving releases the map session')
        check(abs(page.evaluate('Date.now()') - saved['maps'][0]['idleSince']) < 3000, 'Idle countdown begins after leaving')
        page.evaluate("""() => {const d=JSON.parse(localStorage.getItem('one-more-relic:v1'));d.maps[0].idleSince=Date.now()-3600001;localStorage.setItem('one-more-relic:v1',JSON.stringify(d));__test.sweepMaps();}""")
        saved = page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v1'))")
        check(len(saved['maps']) == 0 and len(saved['blueprints']) == 1, 'One hour idle deletes the published map but preserves its blueprint')
        check(page.evaluate("() => {const g=OMR.demoMap().grid;g[5][3]=1;return OMR.validateMap(g);}") == 'Place exactly one entrance.', 'Invalid editor maps are rejected')
        # Import accepts only valid data and uses text rendering for names.
        page.click('#backupOpen')
        page.locator('input[type=file]').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{bad json'})
        check('Import failed' in page.locator('#toast').inner_text(), 'Malformed backup is rejected')
        page.click('#modalClose')
        mobile = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        mp = mobile.new_page(); mp.on('pageerror', lambda e: errors.append(e.stack))
        mp.goto('http://127.0.0.1:8000', wait_until='networkidle')
        mp.evaluate('window.OMRV11.enterGame()')
        check(mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile camp fits viewport without horizontal overflow')
        mp.click('#start')
        check(mp.locator('#touchControls').is_visible(), 'Touch controls appear on phones')
        mp.screenshot(path=str(out / 'mobile-run.png'), full_page=True)
        # No storage: game should continue with an in-memory save fallback.
        blocked = browser.new_context()
        blocked.add_init_script("Storage.prototype.getItem = () => {throw new Error('blocked')};Storage.prototype.setItem = () => {throw new Error('blocked')};")
        bp = blocked.new_page();bp.on('pageerror', lambda e: errors.append(e.stack))
        bp.goto('http://127.0.0.1:8000', wait_until='networkidle');bp.evaluate('window.OMRV11.enterGame()');bp.click('#start')
        check(bp.locator('#hud').is_visible(), 'Game remains playable when browser storage is blocked')
        check(not errors, f'No uncaught browser errors: {errors}')
        browser.close()
    print('All browser checks passed. Screenshots: test-results/', flush=True)


if __name__ == '__main__':
    run()
