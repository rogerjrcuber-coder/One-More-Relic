"""Chest economy browser checks. Run the local server, then python chest_test.py."""
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
        'window.__test={get game(){return game;},interact,normalizeChestPricing,nextChestCost};window.OMR={validateMap')
    out = ROOT / 'test-results'
    out.mkdir(exist_ok=True)
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width':1500,'height':1050})
        context.route('**/game.js', lambda r:r.fulfill(body=source,content_type='text/javascript'))
        context.route('**/fonts.googleapis.com/**', lambda r:r.abort())
        page = context.new_page()
        page.on('pageerror', lambda e:errors.append(e.stack))
        page.goto('http://127.0.0.1:8000', wait_until='networkidle')
        page.evaluate('window.OMRV11.enterGame()')
        page.click('#editorOpen')
        page.fill('#chestBaseCost','7');page.fill('#chestIncrease','4');page.locator('#chestIncrease').blur()
        check('7 → 11 → 15 → 19' in page.locator('#chestPricePreview').inner_text(), 'Workshop previews configurable price progression')
        page.fill('#editorName','Chest economy test')
        page.screenshot(path=str(out/'chest-pricing-workshop.png'),full_page=True)
        page.get_by_role('button',name='Publish & play').click()
        check(page.evaluate('__test.nextChestCost()') == 7, 'Published run starts at the configured base cost')
        # Isolate transactions from combat and keep two chests within reach.
        page.evaluate('''() => {const g=__test.game;g.enemies=[];g.player.x=140;g.player.y=300;g.chests=[{x:140,y:300,opened:false},{x:160,y:300,opened:false}];g.gold=6;}''')
        page.keyboard.press('e')
        check(not page.locator('#modal').is_visible(), 'Insufficient gold does not open the relic choice')
        check(page.evaluate('__test.game.gold === 6 && __test.game.chestsOpened === 0 && !__test.game.chests[0].opened'), 'Failed purchase spends nothing and leaves chest and price unchanged')
        check('Need 1 more' in page.locator('#worldMessage').inner_text(), 'Insufficient funds message shows the exact shortfall')
        page.evaluate('__test.game.gold=7')
        page.keyboard.press('e')
        check(page.locator('.item-choice').count() == 3, 'Exact funds buy a relic choice')
        check(page.evaluate('__test.game.gold === 0 && __test.game.chestsOpened === 1 && __test.nextChestCost() === 11'), 'Purchase deducts once and raises the next price')
        page.evaluate('__test.interact()')
        check(page.evaluate('__test.game.chestsOpened') == 1, 'Repeated interaction during relic selection does not charge again')
        page.locator('.item-choice').first.click()
        page.wait_for_function('!__test.game.paused')
        page.evaluate('__test.game.gold=30')
        page.keyboard.press('e');page.locator('.item-choice').first.click()
        page.wait_for_function('!__test.game.paused')
        check(page.evaluate('__test.game.gold === 19 && __test.game.chestsOpened === 2 && __test.nextChestCost() === 15'), 'Second opening uses the increased price')
        page.keyboard.press('e')
        check(page.evaluate('__test.game.gold') == 19, 'Already opened chests cannot be purchased again')
        page.click('#leave');page.click('#start')
        check(page.evaluate('__test.game.gold === 0 && __test.game.chestsOpened === 0 && __test.nextChestCost() === 7'), 'A new run resets both wallet and price progression')
        page.click('#leave');page.click('#backupOpen')
        with page.expect_download() as pending:
            page.get_by_role('button',name='Export backup').click()
        exported = json.loads(Path(pending.value.path()).read_text())
        check(exported['blueprints'][0]['chestPricing'] == {'baseCost':7,'increase':4}, 'Export contains chest pricing but not run counters')
        exported['blueprints'][0]['chestPricing'] = {'baseCost':0,'increase':3}
        page.locator('input[type=file]').set_input_files({'name':'pricing.json','mimeType':'application/json','buffer':json.dumps(exported).encode()})
        page.wait_for_function('!document.getElementById("modal").open')
        page.reload(wait_until='networkidle'); page.evaluate('window.OMRV11.enterGame()')
        data = page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v1'))")
        check(data['blueprints'][0]['chestPricing'] == {'baseCost':0,'increase':3}, 'Import and reload preserve an editable free-first-chest configuration')
        page.click('#editorOpen');page.select_option('#blueprintSelect', data['blueprints'][0]['id'])
        page.get_by_role('button',name='Publish & play').click()
        page.evaluate('__test.game.enemies=[];__test.game.player.x=140;__test.game.player.y=300')
        page.keyboard.press('e')
        check(page.evaluate('__test.game.gold === 0 && __test.nextChestCost() === 3'), 'A free first chest still increases the next cost')
        if page.locator('.item-choice').count():
            page.locator('.item-choice').first.click();page.wait_for_function('!__test.game.paused')
        check(page.evaluate('__test.normalizeChestPricing({baseCost:-10,increase:Infinity})') == {'baseCost':0,'increase':2}, 'Invalid save pricing is bounded or defaulted')
        check(page.evaluate('__test.normalizeChestPricing({baseCost:99999,increase:0})') == {'baseCost':999,'increase':1}, 'Pricing enforces bounds and a positive increase')
        legacy = page.evaluate('''() => {const grid=OMR.demoMap().grid;const data={version:1,blueprints:[{id:'old',name:'Old blueprint',grid}],maps:[],presets:[]};const d=OMR.normalize(data);return {pricing:d.blueprints[0].chestPricing,sameGrid:JSON.stringify(grid)===JSON.stringify(d.blueprints[0].grid)};}''')
        check(legacy['pricing'] == {'baseCost':3,'increase':2} and not legacy['sameGrid'], 'Older chest tiles migrate to relic vaults while preserving pricing')
        check(not errors, f'No browser errors: {errors}')
        browser.close()
    print('Chest economy checks passed.',flush=True)


if __name__ == '__main__':run()
