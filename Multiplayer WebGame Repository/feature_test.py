"""Regression checks for map sizes, lanterns, and authored creatures.
Run with the local server active: python feature_test.py.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.test-tools'))
from playwright.sync_api import sync_playwright
from smoke_test import check


def run():
    source = (ROOT / 'game.js').read_text(encoding='utf-8').replace(
        'window.OMR={validateMap',
        'window.__test={get game(){return game;},get editor(){return editor;},view,makeRun,mapDetails,loadStage,lightRadius,updateLantern,lineOfSight,shadowPolygon,updateEnemies,sanitizeCreature,creatureDefaults};window.OMR={validateMap')
    source = source.replace('const g=c.createRadialGradient(sx,sy,r*.08,sx,sy,r);',
        'if(![sx,sy,r].every(Number.isFinite))throw new Error(JSON.stringify({sx,sy,r,source,view}));const g=c.createRadialGradient(sx,sy,r*.08,sx,sy,r);')
    out = ROOT / 'test-results'
    out.mkdir(exist_ok=True)
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width':1500,'height':1050})
        context.route('**/game.js', lambda r: r.fulfill(body=source, content_type='text/javascript'))
        context.route('**/fonts.googleapis.com/**', lambda r:r.abort())
        page = context.new_page()
        page.on('pageerror', lambda e:errors.append(e.stack))
        page.goto('http://127.0.0.1:8000', wait_until='networkidle')
        page.evaluate('window.OMRV11.enterGame()')
        check(page.locator('#mapSize').inner_text() == '48 × 34', 'Default map is nearly three times the original area')
        page.click('#start')
        check(page.evaluate('__test.view.scale') > 1.1, 'Camera shows a smaller world area on desktop')
        page.evaluate('__test.game.enemies=[];__test.game.player.x=240;__test.game.player.y=140')
        page.keyboard.press('l')
        check(page.evaluate('__test.game.player.wideLight'), 'L activates the wide lantern beam')
        charge = page.evaluate('__test.game.player.lantern')
        page.wait_for_timeout(300)
        check(page.evaluate('__test.game.player.lantern') < charge, 'Wide beam consumes charge away from torches')
        page.evaluate('__test.game.player.lantern=1;__test.updateLantern(1)')
        check(page.evaluate('!__test.game.player.wideLight && __test.lightRadius() === 190'), 'Exhausting charge falls back to usable regular light')
        page.evaluate('__test.game.player.x=100;__test.game.player.y=220;__test.game.player.lantern=40;__test.updateLantern(1)')
        check(page.evaluate('__test.game.player.lantern >= 72 && __test.game.player.recharging'), 'Nearby torch replenishes lantern charge')
        check(not page.evaluate('__test.lineOfSight({x:320,y:340},{x:400,y:340})'), 'Walls block line of sight')
        check(page.evaluate('__test.shadowPolygon({x:320,y:340},290,__test.game.map.grid)[0].x <= 370'), 'Light rays stop at walls')
        page.screenshot(path=str(out / 'lantern-run.png'), full_page=True)
        # Verify actual ranged and charge behaviors with the same normalized data as the editor.
        page.evaluate('''() => {const g=__test.game;g.paused=true;g.player.x=140;g.player.y=220;g.player.inv=100;g.bullets=[];const c=__test.sanitizeCreature({...__test.creatureDefaults.seer,shots:9},true);g.enemies=[{...c,x:240,y:220,id:1,boss:true,maxHp:c.hp,r:16,flash:0,cd:0,alert:5,windup:0,chargeTime:0}];__test.updateEnemies(.01);}''')
        check(page.evaluate('__test.game.bullets.length') == 9, 'Custom radial boss emits its configured projectile count')
        page.evaluate('__test.game.enemies[0].hp=100;__test.updateEnemies(.01)')
        check(page.evaluate('__test.game.enemies[0].raging'), 'Boss enrages below its configured health threshold')
        page.evaluate('''() => {const g=__test.game,c=__test.sanitizeCreature(__test.creatureDefaults.charger);g.enemies=[{...c,x:250,y:220,id:2,boss:false,maxHp:c.hp,r:12,flash:0,cd:0,alert:5,windup:0,chargeTime:0}];__test.updateEnemies(.01);}''')
        check(page.evaluate('__test.game.enemies[0].windup > 0'), 'Charging monsters telegraph their attack')
        before = page.evaluate('__test.game.enemies[0].x')
        page.evaluate('__test.updateEnemies(.2)')
        check(page.evaluate('__test.game.enemies[0].x') == before, 'Charger stays still during its warning')
        page.evaluate('for(let i=0;i<35;i++)__test.updateEnemies(.02)')
        check(page.evaluate('__test.game.enemies[0].x') < before - 30, 'Charger lunges after warning ends')
        page.click('#leave')
        page.click('#editorOpen')
        page.locator('[data-tool="4"]').click()
        page.select_option('#creatureTemplate', 'spitter')
        page.fill('#creatureName', 'Needle sage');page.locator('#creatureName').blur()
        page.fill('#creature-hp', '120');page.locator('#creature-hp').blur()
        page.fill('#creature-damage', '17');page.locator('#creature-damage').blur()
        page.locator('#creatureColor').evaluate("e => {e.value='#60e0aa';e.dispatchEvent(new Event('input'));}")

        def paint(x, y):
            # First room is inside the scrollable workshop viewport.
            box = page.locator('#editorCanvas').bounding_box()
            w = page.evaluate('__test.editor.grid[0].length')
            h = page.evaluate('__test.editor.grid.length')
            page.mouse.click(box['x']+(x+.5)*box['width']/w, box['y']+(y+.5)*box['height']/h)

        paint(5,5)
        page.select_option('#creatureTemplate','charger');paint(6,5)
        page.locator('[data-tool="inspect"]').click();paint(5,5)
        check(page.input_value('#creatureName') == 'Needle sage', 'Inspector retrieves the selected monster, not the last brush')
        page.fill('#creature-hp','135');page.locator('#creature-hp').blur()
        check(page.evaluate('__test.editor.creatures["5,5"].hp') == 135 and page.evaluate('__test.editor.creatures["6,5"].hp') == 90, 'Editing one monster leaves other monsters unchanged')
        page.locator('[data-tool="7"]').click();page.select_option('#creatureTemplate','seer')
        page.fill('#creature-hp','1000');page.locator('#creature-hp').blur();paint(7,7)
        page.select_option('#editorLighting','dark')
        page.select_option('#editorSize','64,44')
        check(page.evaluate('__test.editor.grid.length === 44 && __test.editor.grid[0].length === 64'), 'Workshop expands maps to 64 × 44')
        check(page.evaluate('__test.editor.creatures["5,5"].hp') == 135, 'Expanding a map preserves authored creatures')
        page.fill('#editorName','The custom depths')
        page.screenshot(path=str(out / 'creature-workshop.png'), full_page=True)
        page.get_by_role('button', name='Publish & play').click()
        page.evaluate('__test.loadStage(__test.game.maxStages)')
        check(page.evaluate('__test.game.map.lighting') == 'dark', 'Published map uses chosen lighting')
        stats = page.evaluate('__test.game.map.creatures["5,5"]')
        check(stats['hp'] == 135 and stats['damage'] == 17 and stats['color'] == '#60e0aa' and stats['behavior'] == 'spitter', 'Published monsters use authored health, damage, color, and behavior')
        boss = page.evaluate('__test.game.map.creatures["7,7"]')
        check(boss['hp'] == 1000 and boss['behavior'] == 'ring', 'Published boss uses custom stats and attack style')
        page.click('#leave')
        page.click('#backupOpen')
        with page.expect_download() as download:
            page.get_by_role('button',name='Export backup').click()
        exported = json.loads(Path(download.value.path()).read_text())
        check(exported['blueprints'][0]['creatures']['5,5']['hp'] == 135, 'Backups include per-creature settings')
        page.click('#modalClose')
        page.reload(wait_until='networkidle')
        persisted = page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v1'))")
        check(persisted['blueprints'][0]['lighting'] == 'dark' and persisted['blueprints'][0]['creatures']['7,7']['hp'] == 1000, 'Reload retains custom boss and lighting settings')
        # Load a legacy save in a separate fresh context; never touch real user data.
        grid = [[1 if x in (0,27) or y in (0,19) else 0 for x in range(28)] for y in range(20)]
        for x,y,tile in [(3,5,2),(25,16,3),(23,15,7),(3,7,5)]:grid[y][x]=tile
        legacy = {'version':1,'presets':[], 'blueprints':[{'id':'legacy','name':'Old favorite','grid':grid}], 'maps':[{'id':'old-map','name':'Old favorite','grid':grid,'idleSince':9999999999999,'sessions':{}}], 'lastLoadout':{'weapon':'wand','perk':'vigor'}}
        old = context.new_page();old.on('pageerror',lambda e:errors.append(e.stack))
        old.goto('http://127.0.0.1:8000',wait_until='networkidle')
        old.evaluate('(data)=>localStorage.setItem("one-more-relic:v1",JSON.stringify(data))',legacy)
        old.reload(wait_until='networkidle');old.evaluate('window.OMRV11.enterGame()');old.select_option('#mapSelect','old-map');old.click('#start');old.evaluate('__test.loadStage(__test.game.maxStages)')
        check(old.evaluate('__test.game.map.grid[0].length') == 28, 'Old 28 × 20 maps remain playable without resizing or data loss')
        check(old.evaluate('__test.game.map.creatures["23,15"].hp') == 650, 'Legacy creatures receive safe default settings')
        # Verify mobile workshop is contained and touch lantern control responds.
        mobile = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile.route('**/fonts.googleapis.com/**',lambda r:r.abort())
        mobile.route('**/game.js',lambda r:r.fulfill(body=source,content_type='text/javascript'))
        mp = mobile.new_page();mp.on('pageerror',lambda e:errors.append(e.stack))
        mp.goto('http://127.0.0.1:8000',wait_until='networkidle');mp.evaluate('window.OMRV11.enterGame()');mp.click('#start');mp.click('#lanternToggle')
        check(mp.evaluate('__test.game.player.wideLight'), 'Mobile lantern button activates wide beam')
        mp.click('#leave');mp.click('#editorOpen');mp.locator('[data-tool="4"]').click()
        check(mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Expanded workshop does not overflow mobile viewport')
        mp.screenshot(path=str(out/'mobile-workshop.png'),full_page=True)
        check(not errors, f'No browser errors: {errors}')
        browser.close()
    print('Map, lighting, creature, and compatibility checks passed.',flush=True)


if __name__ == '__main__':run()
