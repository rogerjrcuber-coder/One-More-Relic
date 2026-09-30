"""Isolated two-browser multiplayer regression; run server on port 8012."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / '.test-tools'))
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='msedge', headless=True)
    contexts = [browser.new_context(viewport={'width': 1400, 'height': 1000}, device_scale_factor=2) for _ in range(2)]
    pages = [c.new_page() for c in contexts]
    errors = []
    for index, page in enumerate(pages):
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8012')
        page.wait_for_function('!!window.OMRNetwork')
        if index == 0:
            page.locator('[data-menu=settings]').click()
            page.locator('#graphicsQuality').select_option('low')
            assert page.evaluate("JSON.parse(localStorage.getItem('one-more-relic:v11-meta')).settings.graphicsQuality") == 'low'
            page.locator('#graphicsQuality').select_option('high')
            page.locator('#frontClose').click()
        page.locator('[data-menu=play]').click()
    pages[0].get_by_role('button', name='Create / join room', exact=True).click()
    pages[0].wait_for_function('!!window.OMRNetwork.state')
    code = pages[0].evaluate('OMRNetwork.state.code')
    pages[1].locator('#frontBody input').nth(1).fill(code)
    pages[1].get_by_role('button', name='Create / join room', exact=True).click()
    pages[0].wait_for_function('Object.keys(OMRNetwork.state.players).length === 2')
    pages[0].get_by_role('button', name='Start run', exact=True).click()
    for p in pages: p.wait_for_function('OMRNetwork.active')
    pages[0].wait_for_timeout(300)
    assert pages[0].evaluate('OMRV11.meta.settings.graphicsQuality') == 'high'
    Path('test-results').mkdir(exist_ok=True)
    pages[0].locator('#canvasWrap').screenshot(path='test-results/v122-detailed.png')
    high_width = pages[0].evaluate('game.width')
    css_width = pages[0].evaluate('game.getBoundingClientRect().width')
    assert high_width > css_width
    pages[0].evaluate("OMRV11.meta.settings.graphicsQuality='low'")
    pages[0].wait_for_timeout(100)
    pages[0].locator('#canvasWrap').screenshot(path='test-results/v122-low.png')
    assert abs(pages[0].evaluate('game.width')-css_width) < 2
    pages[0].evaluate("OMRV11.meta.settings.graphicsQuality='high'")
    pages[0].bring_to_front()
    host = pages[0].evaluate('OMRNetwork.state.hostId')
    start = pages[0].evaluate('OMRNetwork.predicted.x')
    pages[0].keyboard.down('d')
    pages[0].wait_for_timeout(1500)
    pages[0].keyboard.up('d')
    pages[0].wait_for_timeout(300)
    moved = pages[0].evaluate('OMRNetwork.predicted.x')
    remote = pages[1].evaluate('(id)=>OMRNetwork.state.players[id].x', host)
    assert moved > start+140, (start,moved)
    assert abs(moved-remote)<10, (moved,remote)
    pages[0].locator('#codexOpen').click()
    before = pages[1].evaluate('OMRNetwork.state.world.time')
    pages[1].wait_for_timeout(700)
    after = pages[1].evaluate('OMRNetwork.state.world.time')
    assert after>before+.4
    assert not errors, errors
    print('PASS: detailed and low graphics modes render; movement exceeds 140 px, both clients agree, menus keep world running', flush=True)
    for c in contexts: c.close()
    browser.close()

