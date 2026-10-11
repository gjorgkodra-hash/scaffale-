"""Test automatici di Spinyl.

Avviano l'app in un browser vero (Chromium, con Playwright) e simulano tutti i servizi esterni:
Google Drive, Discogs, MusicBrainz, Google Libri, Apple, Google Vision e il lettore di testo.
Nessuna chiamata va su internet, quindi i test sono veloci e sempre uguali.

Uso:  pip install playwright && playwright install chromium && python tests/run_tests.py
"""
import asyncio, json, re, sys, os, threading, itertools, functools, http.server, socketserver
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from png import png

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
IMG = {k: png(c) for k, c in {'a': (214, 64, 52), 'b': (40, 90, 160), 'f': (30, 30, 30)}.items()}
RESULTS = []

def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok), detail))
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else f'  → {detail}'))

# ── server locale ───────────────────────────────────────────────
def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=ROOT)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{httpd.server_address[1]}'

# ── Google Drive finto (in memoria) ─────────────────────────────
FILES = {}; _ids = itertools.count(1)
def nid(): return 'f%d' % next(_ids)
async def drive(r):
    u = r.request.url; p = urlparse(u); qs = parse_qs(p.query); m = r.request.method
    J = lambda o, st=200: r.fulfill(status=st, content_type='application/json', body=json.dumps(o), headers={'Access-Control-Allow-Origin': '*'})
    if p.path == '/drive/v3/about': return await J({'user': {'emailAddress': 'test@example.com'}})
    if p.path == '/drive/v3/files' and m == 'GET':
        q = qs.get('q', [''])[0]
        name = re.search(r"name='([^']+)'", q); parent = re.search(r"'([^']+)' in parents", q)
        out = [{'id': k, 'name': v['name'], 'size': str(len(v.get('content', b'')))} for k, v in FILES.items()
               if (not name or v['name'] == name.group(1)) and (not parent or v.get('parent') == parent.group(1)) and ('mimeType=' not in q or v.get('folder'))]
        if 'orderBy' in qs: out.sort(key=lambda f: f['name'], reverse=True)
        return await J({'files': out})
    if p.path == '/drive/v3/files' and m == 'POST':
        b = json.loads(r.request.post_data); k = nid(); FILES[k] = {'name': b['name'], 'parent': (b.get('parents') or [None])[0], 'folder': True}; return await J({'id': k})
    mm = re.match(r'/drive/v3/files/([^/]+)/copy$', p.path)
    if mm and m == 'POST':
        b = json.loads(r.request.post_data); k = nid(); FILES[k] = {'name': b['name'], 'parent': b['parents'][0], 'content': FILES[mm.group(1)]['content']}; return await J({'id': k})
    mm = re.match(r'/drive/v3/files/([^/]+)$', p.path)
    if mm and m == 'DELETE': FILES.pop(mm.group(1), None); return await r.fulfill(status=204, body='', headers={'Access-Control-Allow-Origin': '*'})
    if mm and m == 'GET':
        f = FILES.get(mm.group(1))
        if not f: return await J({'error': 'File not found'}, 404)
        return await r.fulfill(status=200, content_type='application/json', body=f['content'], headers={'Access-Control-Allow-Origin': '*'})
    if p.path == '/upload/drive/v3/files' and m == 'POST':
        body = r.request.post_data_buffer; bnd = re.search(r'boundary=(\S+)', r.request.headers['content-type']).group(1).encode()
        parts = [x for x in body.split(b'--' + bnd) if x.strip() not in (b'', b'--')]
        meta = json.loads(parts[0].split(b'\r\n\r\n', 1)[1].strip()); content = parts[1].split(b'\r\n\r\n', 1)[1].rsplit(b'\r\n', 1)[0]
        k = nid(); FILES[k] = {'name': meta['name'], 'parent': meta['parents'][0], 'content': content}; return await J({'id': k})
    mm = re.match(r'/upload/drive/v3/files/([^/]+)$', p.path)
    if mm and m == 'PATCH': FILES[mm.group(1)]['content'] = r.request.post_data_buffer; return await J({'id': mm.group(1)})
    return await J({'error': 'unhandled'}, 500)

# ── tutti gli altri servizi finti ───────────────────────────────
TESS_STUB = """window.Tesseract = { createWorker: async () => ({ recognize: async () => ({ data: { lines: window.__ocrLines || [
  {text:'PINK FLOYD', bbox:{y0:0,y1:60}, confidence:90}, {text:'THE DARK SIDE OF THE MOON', bbox:{y0:100,y1:150}, confidence:88},
  {text:'Harvest stereo', bbox:{y0:300,y1:315}, confidence:80} ] } }) }) };"""
DSOTM = [{'id': 4242, 'title': 'Pink Floyd - The Dark Side Of The Moon', 'year': '1973', 'label': ['Harvest'], 'catno': 'SHVL 804', 'country': 'UK', 'format': ['Vinyl', 'LP', 'Album'], 'genre': ['Rock'], 'style': [], 'cover_image': 'https://img.test/f.png', 'barcode': ['5099902987613']},
         {'id': 4243, 'title': 'Pink Floyd - The Dark Side Of The Moon', 'year': '2016', 'label': ['Pink Floyd Records'], 'catno': 'PFRLP8', 'country': 'Europe', 'format': ['Vinyl', 'LP'], 'genre': ['Rock'], 'style': [], 'cover_image': 'https://img.test/f.png', 'barcode': ['5099902987613']}]
NEVERMIND = [{'id': 5555, 'title': 'Nirvana - Nevermind', 'year': '1991', 'label': ['DGC'], 'catno': 'DGCD-24425', 'country': 'US', 'format': ['CD', 'Album'], 'genre': ['Rock'], 'style': ['Grunge'], 'cover_image': 'https://img.test/b.png', 'barcode': ['720642442524']}]
GRADES = ['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)']
OAUTH = {'mode': 'ok', 'hits': []}

def make_route(no_vision=False):
    async def route(r):
        u = r.request.url; p = urlparse(u); q = parse_qs(p.query); h = p.netloc
        J = lambda o, st=200: r.fulfill(status=st, content_type='application/json', body=json.dumps(o), headers={'Access-Control-Allow-Origin': '*'})
        if h.startswith('127.0.0.1'):
            if no_vision and p.path.endswith('/config.js'):
                body = open(os.path.join(ROOT, 'config.js')).read()
                body = re.sub(r"GOOGLE_VISION_KEY:\s*'[^']*'", "GOOGLE_VISION_KEY: ''", body)
                return await r.fulfill(status=200, content_type='text/javascript', body=body)
            return await r.continue_()
        if 'googleapis.com/drive' in u or 'googleapis.com/upload' in u: return await drive(r)
        if h == 'accounts.google.com':
            OAUTH['hits'].append(q.get('prompt', [''])[0])
            st = q['state'][0]; back = q['redirect_uri'][0]
            frag = f'access_token=NEW&expires_in=3599&state={st}' if OAUTH['mode'] == 'ok' else f'error=interaction_required&state={st}'
            return await r.fulfill(status=302, headers={'Location': back + '#' + frag})
        if 'tesseract.js@' in u: return await r.fulfill(status=200, content_type='text/javascript', body=TESS_STUB)
        if h == 'vision.googleapis.com':
            return await J({'responses': [{'webDetection': {'bestGuessLabels': [{'label': 'nirvana nevermind vinyl'}], 'webEntities': [{'description': 'Nevermind', 'score': 0.9}]}}]})
        if h == 'img.test': return await r.fulfill(status=200, content_type='image/png', body=IMG.get(p.path.strip('/')[0], IMG['a']))
        if h == 'api.discogs.com':
            if p.path.startswith('/marketplace/price_suggestions/'):
                return await J({g: {'currency': 'EUR', 'value': round(30 * f, 2)} for g, f in zip(GRADES, [1, .8, .6, .42, .3, .22, .14, .08])})
            if p.path.startswith('/marketplace/stats/'): return await J({'lowest_price': {'value': 18.5, 'currency': 'EUR'}, 'num_for_sale': 23})
            if p.path.startswith('/releases/'): return await J({'tracklist': [{'position': 'A1', 'title': 'Speak to Me', 'type_': 'track'}], 'images': [{'uri': 'https://img.test/f.png'}], 'identifiers': [], 'labels': []})
            if p.path == '/database/search':
                bc = q.get('barcode', [''])[0]; qq = q.get('q', [''])[0].lower()
                if bc.startswith('0000'): return await J({'results': []})
                return await J({'results': DSOTM if bc.startswith('5099') or 'pink' in qq else NEVERMIND})
            return await J({})
        if h == 'musicbrainz.org': return await J({'releases': []})
        if h == 'coverartarchive.org': return await r.fulfill(status=404, body='')
        if h == 'www.googleapis.com' and '/books/' in p.path:
            qq = q.get('q', [''])[0]
            if '9788806219352' in qq: return await J({'items': [{'volumeInfo': {'title': 'Il nome della rosa', 'authors': ['Umberto Eco'], 'publishedDate': '1980', 'industryIdentifiers': [{'type': 'ISBN_13', 'identifier': '9788806219352'}]}}]})
            return await J({'items': []})
        if h == 'openlibrary.org': return await J({'docs': []} if p.path == '/search.json' else {})
        if h == 'itunes.apple.com':
            cb = q.get('callback', [''])[0]; return await r.fulfill(status=200, content_type='text/javascript', body=f'{cb}({{"results":[]}});')
        if h == 'api.upcitemdb.com': return await J({'items': []})
        if h == 'www.wikidata.org': return await J({'search': [], 'entities': {}})
        return await r.abort()
    return route

ITEMS = [
    dict(id='i1', tipo='vinile', titolo='The Dark Side of the Moon', autore='Pink Floyd', anno='1973', codice='5099902987613', condizione='Ottimo', formato='LP 33 giri', stato='fatto'),
    dict(id='i2', tipo='libro', titolo='Harry Potter e la pietra filosofale', autore='J.K. Rowling', serie='Harry Potter', volume='1', prezzo='12,90'),
    dict(id='i3', tipo='libro', titolo='Harry Potter e il calice di fuoco', autore='J.K. Rowling', serie='Harry Potter', volume='4', stato='da', prestatoA='Luca', prestatoIl='2020-01-01'),
    dict(id='i4', tipo='cd', titolo='Nevermind', autore='Nirvana', anno='1991', codice='720642442524', valore='15'),
    dict(id='i5', tipo='libro', titolo='Il nome della rosa', autore='Umberto Eco', desiderio=True),
]
SEED = """async (items)=>{ const now=Date.now(); const L=items.map((x,i)=>normalize({...EMPTY(),...x,createdAt:now-i*1000,updatedAt:now})); await DB.putMany('items',L); await loadItems(); render(); }"""

async def new_page(b, base, lang='it', init='', no_vision=False):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    page = await ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.route('**/*', make_route(no_vision))
    await page.add_init_script(f"if(!sessionStorage.getItem('t')){{sessionStorage.setItem('t','1'); localStorage.setItem('cfg_lang','{lang}'); localStorage.setItem('cfg_discogsToken','TEST'); localStorage.setItem('seenVersion', '9.9.9'); {init}}}")
    await page.goto(base + '/index.html'); await page.wait_for_timeout(800)
    return page, errs

async def sync(page):
    await page.evaluate('sync()'); await page.wait_for_function('!Sync.running', timeout=10000); await page.wait_for_timeout(100)

# ── i test ──────────────────────────────────────────────────────
async def t_basics(b, base):
    print('\nBase, filtri, traduzioni')
    for lang, tutti in [('it', 'Tutti'), ('en', 'All'), ('es', 'Todo')]:
        page, errs = await new_page(b, base, lang)
        await page.evaluate(SEED, ITEMS); await page.wait_for_timeout(300)
        chip = await page.evaluate("document.querySelector('.chip[data-v=tutti]').childNodes[0].textContent.trim()")
        check(f'[{lang}] filtro Tutti tradotto', chip == tutti, chip)
        check(f'[{lang}] nessun errore JavaScript', not errs, errs)
        if lang == 'it':
            check('4 pezzi in collezione (desideri esclusi)', await page.evaluate("filtered().length") == 4)
            await page.click('.chip[data-v=scoprire]'); check('filtro Da scoprire', await page.evaluate("filtered().map(i=>i.id).join()") == 'i3')
            await page.click('.chip[data-v=tutti]')
            await page.evaluate("go('detail','i3')")
            check('prestito oltre 30 giorni evidenziato', await page.evaluate("!!document.querySelector('.loanbox.late')"))
            check('volume mancante della serie', 'volumi' in await page.evaluate("document.querySelector('.detail').textContent"))
            await page.evaluate("go('stats')"); check('statistiche', await page.evaluate("document.querySelectorAll('.tile').length") == 4)

async def t_check_and_value(b, base):
    print('\n"Ce l\'ho già?" e prezzi')
    page, errs = await new_page(b, base)
    await page.evaluate(SEED, ITEMS)
    await page.evaluate("checkCode('5099902987613')"); await page.wait_for_timeout(800)
    check('codice posseduto → Ce l\'hai già', await page.evaluate("!!document.querySelector('.verdict.ok')"))
    check('tabella prezzi per condizione', await page.evaluate("document.querySelectorAll('.prow').length") == 8)
    mv = await page.evaluate("marketValue(byId('i1'))")
    check('valore = prezzo VG+ per condizione Ottimo', mv.get('v') == 18 and mv.get('src') == 'discogs', mv)
    await page.evaluate("checkCode('9788806219352')"); await page.wait_for_timeout(1200)
    check('libro nei desideri riconosciuto dal titolo', await page.evaluate("!!document.querySelector('.verdict.wish')"))
    await page.evaluate("closeSheet(); S.filter='valore'; go('list')"); await page.wait_for_timeout(300)
    check('tab Valore: totale per categoria', await page.evaluate("document.querySelectorAll('.vgroup').length") >= 3)
    check('nessun errore JavaScript', not errs, errs)

async def t_batch_import(b, base):
    print('\nScansione a raffica e importazione')
    page, errs = await new_page(b, base)
    await page.evaluate(SEED, ITEMS)
    await page.evaluate("S.batchTipo='cd'; batchAdd('720642442524'); batchAdd('0000000000017')")
    await page.wait_for_function("S.batch.every(r=>r.status!=='wait'&&r.status!=='busy')", timeout=15000)
    st = await page.evaluate("S.batch.map(r=>[r.status, !!r.dup])")
    check('raffica: trovato + doppione segnalato, non trovato', st == [['ok', True], ['none', False]], st)
    csv = 'Book Id,Title,Author,ISBN,ISBN13,My Rating,Exclusive Shelf,Owned Copies,Date Added,Bookshelves\n1,"Dune (Dune, #1)",Frank Herbert,,"=""9780441013593""",5,read,1,2019/12/01,sci-fi\n'
    await page.evaluate("([t])=>importCsvFile(new File([t],'goodreads.csv'))", [csv]); await page.wait_for_timeout(300)
    await page.click('[data-a=importGo]'); await page.wait_for_timeout(300)
    d = await page.evaluate("(live().find(i=>i.titolo==='Dune')||{})")
    check('import Goodreads con serie e stato', d.get('serie') == 'Dune' and d.get('volume') == '1' and d.get('stato') == 'fatto', d)
    check('nessun errore JavaScript', not errs, errs)

async def t_cover(b, base):
    print('\nFoto della copertina')
    page, errs = await new_page(b, base, no_vision=True)
    await page.evaluate("startCover('add','vinile')")
    await page.set_input_files('#coverInput', files=[{'name': 'c.png', 'mimeType': 'image/png', 'buffer': IMG['f']}])
    await page.wait_for_function("document.querySelector('#titleQ')", timeout=10000)
    q = await page.evaluate("$('#titleQ').value")
    check('lettura del testo: solo le scritte grandi', q == 'PINK FLOYD THE DARK SIDE OF THE MOON', q)
    page2, errs2 = await new_page(b, base)
    await page2.evaluate("startCover('check','cd')")
    await page2.set_input_files('#coverInput', files=[{'name': 'c.png', 'mimeType': 'image/png', 'buffer': IMG['b']}])
    await page2.wait_for_function("document.querySelector('#titleQ')", timeout=10000)
    q2 = await page2.evaluate("$('#titleQ').value")
    check('Google Vision: copertina riconosciuta', q2 == 'nirvana nevermind', q2)
    check('contatore mensile Vision', await page2.evaluate("visionUsed()") == 1)
    check('nessun errore JavaScript', not (errs + errs2), errs + errs2)

TOKEN = "localStorage.setItem('gtoken', JSON.stringify({t:'TOK', exp: Date.now()+3600e3}));"
async def t_sync(b, base):
    print('\nSincronizzazione con Google Drive')
    FILES.clear()
    A, ea = await new_page(b, base, init=TOKEN); B, eb = await new_page(b, base, init=TOKEN)
    await A.evaluate("""async()=>{ const now=Date.now(); const L=[]; for(let i=0;i<25;i++) L.push(normalize({...EMPTY(), id:'x'+i, titolo:'Pezzo '+i, createdAt:now-i, updatedAt:now})); await DB.putMany('items',L); await loadItems(); S.dirty=true; }""")
    await sync(A); await sync(B)
    check('il secondo telefono riceve la collezione', await B.evaluate("live().length") == 25)
    await A.evaluate("(async()=>{ const it=byId('x1'); it.note='nota A'; await saveItem(it); })()")
    await B.evaluate("(async()=>{ const it=byId('x1'); it.valutazione=4; await saveItem(it); })()")
    await sync(A); await sync(B); await sync(A)
    a = await A.evaluate("[byId('x1').note, byId('x1').valutazione]"); bb = await B.evaluate("[byId('x1').note, byId('x1').valutazione]")
    check('modifiche a campi diversi: si tengono entrambe', a == ['nota A', 4] and bb == ['nota A', 4], (a, bb))
    check('copia del giorno creata', any(v['name'].startswith('scaffale-20') for v in FILES.values()))
    await B.evaluate("(async()=>{ for(let i=5;i<25;i++){ const it=byId('x'+i); await saveItem({id:it.id, deleted:true, createdAt:it.createdAt}); } })()")
    await sync(B)
    main = next(v for v in FILES.values() if v['name'] == 'scaffale.json')
    live = lambda: len([i for i in json.loads(main['content'])['items'] if not i.get('deleted')])
    check('cancellazione di massa bloccata', await B.evaluate("S.syncState") == 'error' and live() == 25, live())
    await B.evaluate("S.allowMass=true"); await sync(B)
    check('dopo la conferma viene applicata', live() == 5, live())
    check('nessun errore JavaScript', not (ea + eb), ea + eb)

async def t_silent_login(b, base):
    print('\nRinnovo dell\'accesso a Google')
    OAUTH['mode'] = 'ok'; OAUTH['hits'].clear()
    init = "localStorage.setItem('gtoken', JSON.stringify({t:'OLD', exp: Date.now()-1000}));"
    C, ec = await new_page(b, base, init=init); await C.wait_for_timeout(2500)
    check('accesso rinnovato senza chiedere niente', OAUTH['hits'] == ['none'] and await C.evaluate("Drive.token()") == 'NEW', OAUTH['hits'])
    OAUTH['mode'] = 'err'
    await C.evaluate("localStorage.setItem('gtoken', JSON.stringify({t:'OLD', exp: Date.now()-1000})); localStorage.removeItem('gSilentAt')")
    await C.reload(); await C.wait_for_timeout(2500)
    check('se Google chiede di accedere: pallino arancione, nessun errore', await C.evaluate("S.syncState") == 'login')
    n = len(OAUTH['hits']); await C.reload(); await C.wait_for_timeout(1500)
    check('nessun ciclo di tentativi', len(OAUTH['hits']) == n)
    check('nessun errore JavaScript', not ec, ec)

async def main():
    base = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for t in (t_basics, t_check_and_value, t_batch_import, t_cover, t_sync, t_silent_login):
            try: await t(b, base)
            except Exception as e: check(t.__name__ + ' (eccezione)', False, repr(e)[:300])
        await b.close()
    bad = [r for r in RESULTS if not r[1]]
    print(f'\n{len(RESULTS) - len(bad)} di {len(RESULTS)} controlli superati')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    asyncio.run(main())
