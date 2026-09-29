"""v1.1 menu, stage, key/door, chest split, duel, and live lobby checks."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.test-tools'))
from playwright.sync_api import sync_playwright
from smoke_test import check


def run():
    source = (ROOT / 'game.js').read_text(encoding='utf-8').replace(
        'window.OMR={validateMap',
        'window.__v11={get game(){return game;},update,interact,loadStage,startDuel};window.OMR={validateMap')
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 960}, reduced_motion='reduce')
        context.route('**/game.js', lambda route: route.fulfill(body=source, content_type='text/javascript'))
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(error.stack))
        page.goto('http://127.0.0.1:8000', wait_until='networkidle')
        labels = ' '.join(page.locator('[data-menu]').all_text_contents())
        check(all(label in labels for label in ['PLAY', 'QUICKPLAY', 'DUNGEON CREATOR', 'LOADOUTS', 'SKINS', 'SETTINGS']), 'Title screen exposes every v1.1 destination')

        page.locator('[data-menu="play"]').click()
        page.get_by_role('button', name='Rolling duels').click()
        page.get_by_role('button', name='Play solo').click()
        check(page.evaluate('__v11.game.mode') == 'duel' and page.locator('#hud').is_visible(), 'Rolling duel playlist starts locally')
        check(page.locator('#arenaName').inner_text() == 'ROOT RING', 'Duel playlist starts on its first named arena')

        page.reload(wait_until='networkidle')
        page.locator('[data-menu="play"]').click()
        page.get_by_role('button', name='Play solo').click()
        check(page.evaluate('__v11.game.maxStages >= 2'), 'Dungeon run starts with multiple stages')
        page.evaluate('''() => {const g=__v11.game,k=g.stageKeys[0];g.player.x=k.x;g.player.y=k.y;__v11.update(.02);}''')
        check(page.evaluate('__v11.game.keysOwned') == 1, 'Dungeon keys are collectible')
        page.evaluate('''() => {const g=__v11.game,d=g.doors[0];g.player.x=d.x;g.player.y=d.y;__v11.interact();}''')
        check(page.evaluate('__v11.game.doors[0].open && __v11.game.keysOwned === 0'), 'A key opens a nearby locked door')
        page.evaluate('''() => {const g=__v11.game,c=g.chests.find(x=>x.kind==='upgrade');g.player.x=c.x;g.player.y=c.y;g.gold=100;__v11.interact();}''')
        check(page.evaluate('Object.keys(__v11.game.upgrades).length') == 1, 'Upgrade chests grant direct run upgrades')
        page.evaluate('''() => {const g=__v11.game;g.player.x=g.exit.x;g.player.y=g.exit.y;__v11.update(.02);}''')
        check('STAGE 1 CLEARED' in page.locator('#modal').inner_text(), 'Exit portal opens the stage transition')
        page.get_by_role('button', name='Descend').click()
        page.wait_for_function('__v11.game.stage === 2')
        check(page.evaluate('__v11.game.stage') == 2, 'Descending loads the next stage')

        page.reload(wait_until='networkidle')
        page.locator('[data-menu="play"]').click()
        page.fill('#joinName', 'Browser Host')
        page.get_by_role('button', name='Create / join room').click()
        page.wait_for_selector('.lobby-list .preset')
        check(page.locator('#roomCode').inner_text().startswith('ROOM '), 'Live room creation returns a shareable code')
        page.get_by_role('button', name='Start run').click()
        page.wait_for_function('window.__v11.game && window.__v11.game.status === "playing"')
        check(page.evaluate('__v11.game.partySize') == 1, 'Server room state reaches the running dungeon')
        check(not errors, f'No v1.1 browser errors: {errors}')
        browser.close()
    print('v1.1 gameplay and lobby checks passed.', flush=True)


if __name__ == '__main__':
    run()
