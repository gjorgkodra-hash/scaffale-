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

# Community finta: stessa logica essenziale della funzione Supabase
COMM = {'members': {}, 'invites': {'AMICO1': 0}, 'reviews': [], 'comments': [], 'n': 0}
FEEDBACK = {'sent': [], 'errors': [], 'tokens': []}
def comm_handle(tok, b):
    import itertools
    if not tok: return 401, {'error': 'login'}
    gid = 'g-' + tok; me = COMM['members'].get(gid); a = b.get('action')
    nid_ = lambda: (COMM.__setitem__('n', COMM['n'] + 1), 'c%d' % COMM['n'])[1]
    if a == 'me': return 200, {'member': me}
    if a == 'join':
        if me: return 200, {'member': me}
        if COMM['invites'].get(b.get('code', '').upper(), 9) >= 5: return 403, {'error': 'invito'}
        if any(m['nick'] == b.get('nick') for m in COMM['members'].values()): return 409, {'error': 'nick-preso'}
        COMM['invites'][b['code'].upper()] += 1
        me = COMM['members'][gid] = {'id': nid_(), 'nick': b['nick'], 'admin': False}; return 200, {'member': me}
    if not me: return 403, {'error': 'membro'}
    if a == 'invite': c = 'NEW%d' % len(COMM['invites']); COMM['invites'][c] = 0; return 200, {'code': c}
    if a == 'review':
        COMM['reviews'] = [r for r in COMM['reviews'] if not (r['work'] == b['work'] and r['mid'] == me['id'])]
        COMM['reviews'].insert(0, {'id': nid_(), 'work': b['work'], 'tipo': b['tipo'], 'titolo': b['titolo'], 'autore': b.get('autore', ''), 'cover': b.get('cover', ''), 'stars': b.get('stars'), 'body': b.get('body', ''), 'mid': me['id'], 'nick': me['nick'], 'at': '2026-10-11T10:00:00Z', 'hidden': False})
        return 200, {'ok': True}
    if a == 'export': return 200, {'profile': {'nick': me['nick']}, 'reviews': [r for r in COMM['reviews'] if r['mid'] == me['id']]}
    if a == 'deleteAccount':
        if b.get('confirm') != me['nick']: return 400, {'error': 'conferma'}
        COMM['members'].pop(gid, None); COMM['reviews'] = [r for r in COMM['reviews'] if r['mid'] != me['id']]; return 200, {'ok': True}
    if a == 'feedbackList':
        if not me.get('admin'): return 400, {'error': 'azione'}
        return 200, {'feedback': [dict(id='f%d' % i, created_at='2026-10-12T10:00:00Z', kind=x['kind'], message=x['message'], contact=x.get('contact', ''), version=x.get('version', ''), diag=x.get('diag'), status='nuovo', nick='') for i, x in enumerate(FEEDBACK['sent'])],
                     'errors': [dict(hash='h%d' % i, message=e['message'], source=e.get('source', ''), stack=e.get('stack', ''), version='x', ua='', view=e.get('view', ''), count=1, last_seen='2026-10-12T10:00:00Z') for i, e in enumerate(FEEDBACK['errors'])]}
    if a == 'notifs':
        L = [n for n in COMM.get('notifs', []) if n['to'] == me['id']]
        out = [{'id': str(k), 'kind': n['kind'], 'data': n['data'], 'read': n['read'], 'at': '2026-10-11T21:00:00Z', 'nick': n['nick']} for k, n in enumerate(L)][::-1]
        if b.get('markRead'):
            for n in L: n['read'] = True
        return 200, {'items': out}
    if a == 'comment' and b.get('review'):
        r = next((x for x in COMM['reviews'] if x['id'] == b['review']), None)
        if r and r['mid'] != me['id']: COMM.setdefault('notifs', []).append({'to': r['mid'], 'kind': 'comment', 'nick': me['nick'], 'read': False, 'data': {'type': 'review', 'id': r['id'], 'titolo': r['titolo'], 'body': b['body'], 'yours': True}})
    if a == 'comment': COMM['comments'].append({'id': nid_(), 'review': b.get('review'), 'post': b.get('post'), 'share': (b['share']['member'], b['share']['work'], b['share']['kind']) if b.get('share') else None, 'body': b['body'], 'mid': me['id'], 'nick': me['nick'], 'at': '2026-10-11T11:00:00Z'}); return 200, {'ok': True}
    if a == 'report':
        for r in COMM['reviews']:
            if r['id'] == b['id']: r['hidden'] = True
        return 200, {'ok': True}
    if a == 'work':
        L = [r for r in COMM['reviews'] if r['work'] == b['work'] and not r['hidden']]
        st = [r['stars'] for r in L if r['stars']]
        sh = [dict(member=x['member'], nick=x['nick'], mine=x['member'] == me['id'], kind=x['kind'], offer=x['offer'], price=x['price'], formato=x['formato'], note='') for L in COMM.get('shares', {}).values() for x in L if x['work'] == b['work']]
        ps = [dict(id=p['id'], title=p['title'], excerpt=p['body'][:160], nick=p['nick'], mine=p['mid'] == me['id'], at=p['at']) for p in COMM.get('posts', []) if p['work'] == b['work']]
        return 200, {'shares': sh, 'posts': ps, 'avg': round(sum(st) / len(st), 1) if st else None, 'n': len(st), 'reviews': [{'id': r['id'], 'nick': r['nick'], 'mine': r['mid'] == me['id'], 'stars': r['stars'], 'body': r['body'], 'at': r['at'],
            'comments': [{'id': c['id'], 'nick': c['nick'], 'mine': c['mid'] == me['id'], 'body': c['body'], 'at': c['at']} for c in COMM['comments'] if c['review'] == r['id']]} for r in L]}
    if a == 'shares':
        COMM.setdefault('shares', {})[me['id']] = [dict(x, member=me['id'], nick=me['nick'], at='2026-10-11T12:00:00Z') for x in b.get('items', [])]; return 200, {'ok': True}
    allsh = [x for L in COMM.get('shares', {}).values() for x in L]
    if a == 'match':
        return 200, {'wanted': [x for x in allsh if x['kind'] == 'wish' and x['work'] in b.get('own', []) and x['member'] != me['id']],
                     'available': [x for x in allsh if x['kind'] == 'own' and x['work'] in b.get('wish', []) and x['member'] != me['id']]}
    if a == 'offer':
        key = tuple(sorted([me['id'], b['to']])) + (b['work'],)
        th = COMM.setdefault('threads', {}).setdefault(key, {'id': 't%d' % len(COMM['threads']), 'titolo': b['titolo'], 'cover': b.get('cover', ''), 'msgs': [], 'members': key[:2]})
        th['msgs'].append({'id': nid_(), 'from': me['id'], 'body': b.get('body', ''), 'offer': b.get('offer', ''), 'price': b.get('price'), 'at': '2026-10-11T12:00:00Z'})
        return 200, {'thread': th['id']}
    ths = list(COMM.get('threads', {}).values())
    nick = lambda mid: next((m['nick'] for m in COMM['members'].values() if m['id'] == mid), '?')
    if a == 'send':
        th = next(x for x in ths if x['id'] == b['thread']); th['msgs'].append({'id': nid_(), 'from': me['id'], 'body': b['body'], 'offer': '', 'price': None, 'at': '2026-10-11T12:05:00Z'}); return 200, {'ok': True}
    if a in ('threads', 'unread'):
        mine = [x for x in ths if me['id'] in x['members']]
        out = [{'id': x['id'], 'other': [m for m in x['members'] if m != me['id']][0], 'nick': nick([m for m in x['members'] if m != me['id']][0]), 'titolo': x['titolo'], 'cover': x['cover'], 'at': x['msgs'][-1]['at'],
                'unread': x['msgs'][-1]['from'] != me['id'], 'last': {'body': x['msgs'][-1]['body'], 'offer': x['msgs'][-1]['offer'], 'price': x['msgs'][-1]['price'], 'mine': x['msgs'][-1]['from'] == me['id']}} for x in mine]
        inv = sum(1 for e in COMM.get('events', {}).values() if me['id'] in e['invited'] and me['id'] not in e['rsvps'])
        nn = sum(1 for n in COMM.get('notifs', []) if n['to'] == me['id'] and not n['read'])
        return 200, ({'threads': out} if a == 'threads' else {'unread': sum(1 for o in out if o['unread']), 'invites': inv, 'notifs': nn})
    if a == 'thread':
        th = next(x for x in ths if x['id'] == b['id']); other = [m for m in th['members'] if m != me['id']][0]
        return 200, {'thread': {'id': th['id'], 'other': other, 'nick': nick(other), 'titolo': th['titolo'], 'cover': th['cover'], 'blocked': False}, 'messages': [{'id': m['id'], 'mine': m['from'] == me['id'], 'body': m['body'], 'offer': m['offer'], 'price': m['price'], 'at': m['at']} for m in th['msgs']]}
    if a == 'post':
        pid = nid_(); COMM.setdefault('posts', []).insert(0, dict(b, id=pid, nick=me['nick'], mid=me['id'], at='2026-10-11T13:00:00Z')); return 200, {'id': pid}
    if a == 'postGet':
        p = next(x for x in COMM.get('posts', []) if x['id'] == b['id'])
        return 200, {'post': {'id': p['id'], 'work': p['work'], 'tipo': p['tipo'], 'titolo': p['titolo'], 'autore': p['autore'], 'cover': p.get('cover', ''), 'title': p['title'], 'body': p['body'], 'nick': p['nick'], 'mine': p['mid'] == me['id'], 'at': p['at']},
            'comments': [{'id': c['id'], 'nick': c['nick'], 'mine': c['mid'] == me['id'], 'body': c['body'], 'at': c['at']} for c in COMM['comments'] if c.get('post') == p['id']]}
    if a == 'board':
        items = [dict(type='review', id=r['id'], work=r['work'], tipo=r['tipo'], titolo=r['titolo'], autore=r['autore'], cover=r['cover'], stars=r['stars'], body=r['body'], nick=r['nick'], at=r['at']) for r in COMM['reviews'] if not r['hidden']]
        items += [dict(type='post', id=p['id'], work=p['work'], tipo=p['tipo'], titolo=p['titolo'], autore=p['autore'], cover='', title=p['title'], body=p['body'], nick=p['nick'], at=p['at']) for p in COMM.get('posts', [])]
        items += [dict(x, type='share') for x in allsh]
        return 200, {'items': items}
    if a == 'discussion':
        cmt = lambda f: [{'id': c['id'], 'nick': c['nick'], 'mine': c['mid'] == me['id'], 'body': c['body'], 'at': c['at']} for c in COMM['comments'] if f(c)]
        if b['type'] == 'review':
            r = next(x for x in COMM['reviews'] if x['id'] == b['id'])
            return 200, {'item': dict(type='review', id=r['id'], work=r['work'], tipo=r['tipo'], titolo=r['titolo'], autore=r['autore'], cover=r['cover'], stars=r['stars'], body=r['body'], nick=r['nick'], member=r['mid'], mine=r['mid'] == me['id'], at=r['at']), 'comments': cmt(lambda c: c.get('review') == r['id'])}
        x = next(x for x in allsh if x['member'] == b['member'] and x['work'] == b['work'] and x['kind'] == b['kind'])
        return 200, {'item': dict(x, type='share', mine=x['member'] == me['id']), 'comments': cmt(lambda c: c.get('share') == (b['member'], b['work'], b['kind']))}
    EV = COMM.setdefault('events', {})
    if a == 'members': return 200, {'members': [{'id': m['id'], 'nick': m['nick']} for m in COMM['members'].values() if m['id'] != me['id']]}
    if a in ('eventCreate', 'eventEdit'):
        if a == 'eventEdit': e = EV[b['id']]; e.update({k: v for k, v in b.items() if k not in ('action', 'invite', 'id')})
        else: e = EV.setdefault('e%d' % (len(EV) + 1), dict(b, id='e%d' % (len(EV) + 1), creator=me['id'], nick=me['nick'], invited=[], rsvps={me['id']: 'si'}, msgs=[]))
        e['invited'] += [x for x in b.get('invite', []) if x not in e['invited']]
        return 200, {'id': e['id']}
    def evout(e):
        return {'id': e['id'], 'title': e['title'], 'kind': e['kind'], 'starts': e['starts'], 'place': e.get('place', ''), 'link': e.get('link', ''), 'work': e.get('work', ''), 'tipo': e.get('tipo', ''), 'titolo': e.get('titolo', ''), 'autore': e.get('autore', ''), 'cover': e.get('cover', ''),
                'visibility': e['visibility'], 'nick': e['nick'], 'mine': e['creator'] == me['id'], 'invited': me['id'] in e['invited'], 'my': e['rsvps'].get(me['id'], ''), 'going': sum(1 for v in e['rsvps'].values() if v == 'si')}
    vis = lambda e: e['visibility'] == 'all' or e['creator'] == me['id'] or me['id'] in e['invited']
    if a == 'events': return 200, {'upcoming': [evout(e) for e in EV.values() if vis(e)], 'past': []}
    if a == 'eventGet':
        e = EV[b['id']]; o = evout(e); o['body'] = e.get('body', ''); o['member'] = e['creator']
        return 200, {'event': o, 'rsvps': [{'nick': nick(k), 'status': v, 'mine': k == me['id']} for k, v in e['rsvps'].items()], 'invited': [{'id': x, 'nick': nick(x)} for x in e['invited']],
                     'messages': [{'id': str(i), 'nick': m['nick'], 'mine': m['mid'] == me['id'], 'body': m['body'], 'at': '2026-10-11T20:00:00Z'} for i, m in enumerate(e['msgs'])]}
    if a == 'rsvp': EV[b['id']]['rsvps'][me['id']] = b['status']; return 200, {'ok': True}
    if a == 'eventMsg': EV[b['id']]['msgs'].append({'mid': me['id'], 'nick': me['nick'], 'body': b['body']}); return 200, {'ok': True}
    if a == 'eventDelete': EV.pop(b['id'], None); return 200, {'ok': True}
    if a == 'recent': return 200, {'reviews': [{'work': r['work'], 'tipo': r['tipo'], 'titolo': r['titolo'], 'autore': r['autore'], 'cover': r['cover'], 'stars': r['stars'], 'body': r['body'], 'nick': r['nick'], 'at': r['at']} for r in COMM['reviews'] if not r['hidden']]}
    return 400, {'error': 'azione'}

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
            if p.path.startswith('/releases/'): return await J({'tracklist': [{'position': 'A1', 'title': 'Speak to Me', 'type_': 'track'}], 'images': [{'uri': 'https://img.test/f.png'}], 'identifiers': [], 'labels': [], 'community': {'rating': {'average': 4.56, 'count': 321}}})
            if p.path == '/database/search':
                bc = q.get('barcode', [''])[0]; qq = q.get('q', [''])[0].lower()
                if bc.startswith('0000'): return await J({'results': []})
                return await J({'results': DSOTM if bc.startswith('5099') or 'pink' in qq else NEVERMIND})
            return await J({})
        if h == 'musicbrainz.org':
            if '/release-group/' in p.path:
                return await J({'release-groups': [{'id': 'rg1', 'title': 'Nuovo album', 'score': 100, 'first-release-date': '2026-09-20', 'primary-type': 'Album', 'artist-credit': [{'name': 'Pink Floyd'}]}]})
            if q.get('query', [''])[0] == 'barcode:5099902987613': return await J({'releases': [{'id': 'mb1'}]})
            if p.path.endswith('/mb1'): return await J({'relations': [{'url': {'resource': 'https://www.discogs.com/release/1873013'}}]})
            return await J({'releases': []})
        if h == 'api.themoviedb.org':
            film = lambda i, t, d: {'id': i, 'title': t, 'release_date': d, 'overview': 'Trama di ' + t, 'poster_path': '/p%d.png' % i, 'popularity': 100 - i}
            if p.path.endswith('/movie/now_playing'): return await J({'results': [film(1, 'Film in sala', '2026-10-01'), film(2, 'Altro film', '2026-09-25')]})
            if p.path.endswith('/movie/upcoming'): return await J({'results': [film(3, 'Film in arrivo', '2099-12-01'), film(4, 'Già uscito', '2020-01-01')]})
            if p.path.endswith('/search/movie'):
                qq = q.get('query', [''])[0].lower()
                if 'street' in qq or 'fighter' in qq: return await J({'results': [film(11, 'Street Fighter', '2026-10-16'), film(12, 'Street Fighter II', '1994-01-01')]})
                if 'van damme' in qq: return await J({'results': [film(13, 'Bloodsport', '1988-01-01')]})
                return await J({'results': []})
            if p.path.endswith('/search/person'): return await J({'results': [{'id': 77, 'known_for_department': 'Directing'}]})
            if p.path.endswith('/movie_credits'): return await J({'crew': [dict(film(5, 'Nuovo film del regista', '2099-05-01'), job='Director'), dict(film(6, 'Vecchio', '1990-01-01'), job='Director')]})
            if re.search(r'/movie/\d+$', p.path): return await J({'credits': {'crew': [{'job': 'Director', 'name': 'Regista Prova'}], 'cast': []}, 'runtime': 120, 'genres': [{'name': 'Dramma'}]})
            return await J({'results': []})
        if h == 'image.tmdb.org': return await r.fulfill(status=200, content_type='image/png', body=IMG['a'])
        if h == 'coverartarchive.org': return await r.fulfill(status=404, body='')
        if h == 'www.googleapis.com' and '/books/' in p.path:
            qq = q.get('q', [''])[0]
            if 'subject:' in qq and 'newest' in u:
                return await J({'items': [{'volumeInfo': {'title': 'Romanzo appena uscito', 'authors': ['Autrice Nuova'], 'publishedDate': '2026-09-15', 'imageLinks': {'thumbnail': 'https://img.test/a.png'}}}]})
            if 'inauthor' in qq and 'Rowling' in qq:
                return await J({'items': [{'volumeInfo': {'title': 'Il nuovo libro', 'authors': ['J.K. Rowling'], 'publishedDate': '2026-09-01'}}, {'volumeInfo': {'title': 'Vecchio libro', 'authors': ['J.K. Rowling'], 'publishedDate': '2001-01-01'}}]})
            if '9788806219352' in qq: return await J({'items': [{'volumeInfo': {'title': 'Il nome della rosa', 'authors': ['Umberto Eco'], 'publishedDate': '1980', 'industryIdentifiers': [{'type': 'ISBN_13', 'identifier': '9788806219352'}]}}]})
            return await J({'items': []})
        if h == 'openlibrary.org' and 'ratings_average' in u:
            return await J({'docs': [{'key': '/works/1', 'ratings_average': 4.123, 'ratings_count': 57}]})
        if h == 'openlibrary.org': return await J({'docs': []} if p.path == '/search.json' else {})
        if h == 'itunes.apple.com':
            cb = q.get('callback', [''])[0]; return await r.fulfill(status=200, content_type='text/javascript', body=f'{cb}({{"results":[]}});')
        if h.endswith('.supabase.co'):
            if r.request.method == 'OPTIONS': return await r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST'})
            if p.path.endswith('/feedback'):
                fb = json.loads(r.request.post_data or '{}')
                if fb.get('action') == 'error': FEEDBACK['errors'].extend(fb.get('errors', [])); return await J({'ok': True})
                if len(fb.get('message', '')) < 3: return await J({'error': 'vuoto'}, 400)
                FEEDBACK['sent'].append(fb); FEEDBACK['tokens'].append(r.request.headers.get('x-google-token', '')); return await J({'ok': True})
            st, o = comm_handle(r.request.headers.get('x-google-token', ''), json.loads(r.request.post_data or '{}'))
            return await J(o, st)
        if h == 'api.rss2json.com':
            src = q.get('rss_url', [''])[0]
            return await J({'status': 'ok', 'items': [{'title': 'Articolo da ' + src, 'link': src + '#1', 'pubDate': '2026-10-10 09:00:00', 'thumbnail': 'https://img.test/a.png', 'description': ''}]})
        if h == 'api.deezer.com':
            cb = q.get('callback', [''])[0]
            data = {'data': [{'title': 'Album della settimana', 'release_date': '2026-10-09', 'cover_big': 'https://img.test/b.png', 'artist': {'name': 'Artista Nuovo'}}]}
            return await r.fulfill(status=200, content_type='text/javascript', body=f'{cb}({json.dumps(data)});')
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
    await page.add_init_script(f"if(!sessionStorage.getItem('t')){{sessionStorage.setItem('t','1'); localStorage.setItem('cfg_lang','{lang}'); localStorage.setItem('cfg_discogsToken','TEST'); localStorage.setItem('seenVersion', '9.9.9'); localStorage.setItem('mainTab', 'list'); localStorage.setItem('welcomed', '1'); {init}}}")
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

async def t_auto_online(b, base):
    print('\nPrezzo e voto online in automatico')
    for tok in ['TEST', '']:
        page, errs = await new_page(b, base, init=f"localStorage.setItem('cfg_discogsToken','{tok}');")
        await page.evaluate(SEED, ITEMS)
        await page.evaluate("go('detail','i1')")
        await page.wait_for_function("byId('i1').valoreDiscogs && byId('i1').votoWeb && !S.autoBusy", timeout=8000)
        await page.wait_for_timeout(200)
        lab = 'con token' if tok else 'senza token (via MusicBrainz)'
        check(f'prezzo automatico {lab}', await page.evaluate("valueOf(byId('i1'))") > 0)
        check(f'voto Discogs mostrato {lab}', '4,6' in await page.evaluate("(document.querySelector('.webrate')||{}).textContent||''"))
        check(f'nessun errore JavaScript {lab}', not errs, errs)

async def t_book_rating(b, base):
    print('\nVoto online dei libri')
    page, errs = await new_page(b, base)
    await page.evaluate(SEED, ITEMS)
    await page.evaluate("go('detail','i2')")
    await page.wait_for_function("byId('i2').votoWeb && !S.autoBusy", timeout=8000); await page.wait_for_timeout(200)
    check('voto Open Library mostrato', '4,1' in await page.evaluate("(document.querySelector('.webrate')||{}).textContent||''"))
    t1 = await page.evaluate("filmFromCover(['van damme', 'Jean-Claude Van Damme', 'IN SALA DAL 16 OTTOBRE', 'Street Fighter movie poster 2026'], 'street fighter movie poster Jean-Claude Van Damme STREET FIGHTER IN SALA')")
    check('locandina: titolo del film scelto bene', t1 == 'Street Fighter', t1)
    await page.evaluate("go('settings')")
    check('pulsante Cerca aggiornamenti', await page.evaluate("!!document.querySelector('[data-a=forceUpdate]')"))
    sig = await page.evaluate("JSON.parse(feedSig())[0]")
    check('la cache della Home dipende dalla versione', sig == await page.evaluate("VERSION"))
    check('nessun errore JavaScript', not errs, errs)

def t_files():
    print('\nFile dell\'app')
    import pathlib
    root = pathlib.Path(__file__).resolve().parent.parent
    sw = (root / 'sw.js').read_text(); app = (root / 'app.js').read_text()
    v = re.search(r"const VERSION = '([\d.]+)'", app).group(1)
    check('sw.js non vuoto e con la stessa versione di app.js', f"scaffale-v{v}" in sw and 'fetch' in sw)
    for f in ['index.html', 'app.css', 'i18n.js', 'config.js']: check(f'{f} non vuoto', (root / f).stat().st_size > 200)

async def t_community(b, base):
    print('\nCommunity')
    tok = lambda n: f"localStorage.setItem('gtoken', JSON.stringify({{t:'{n}', exp: Date.now()+3600e3}}));"
    page, errs = await new_page(b, base, init=tok('ANNA'))
    await page.evaluate(SEED, ITEMS)
    await page.evaluate("go('detail','i1')"); await page.wait_for_timeout(300)
    check('scheda: invito a entrare', await page.evaluate("!!document.querySelector('[data-a=commJoin]')"))
    await page.evaluate("commJoinSheet()"); await page.fill('#commNick', 'Anna'); await page.fill('#commCode', 'amico1')
    await page.evaluate("commJoin()"); await page.wait_for_timeout(300)
    check('senza accettare le regole non entra', await page.evaluate("!commMe()"))
    await page.check('#commOk'); await page.evaluate("commJoin()"); await page.wait_for_function("!!commMe()", timeout=5000)
    await page.wait_for_selector('#commBody .cmine', timeout=5000)
    await page.evaluate("S.commStars=4; document.querySelector('#commText').value='Capolavoro, stampa ottima'; commSend()")
    await page.wait_for_selector('.crev', timeout=5000)
    check('recensione pubblicata con voto medio', '4' in await page.evaluate("document.querySelector('.cavg').textContent"))
    # un secondo utente con un'edizione diversa dello stesso album vede la recensione
    page2, errs2 = await new_page(b, base, init=tok('BRUNO'))
    await page2.evaluate(SEED, [dict(id='x1', tipo='cd', titolo='The Dark Side of the Moon (Remastered)', autore='Pink Floyd')])
    await page2.evaluate("commJoinSheet()"); await page2.fill('#commNick', 'Bruno'); await page2.fill('#commCode', 'AMICO1'); await page2.check('#commOk')
    await page2.evaluate("commJoin()"); await page2.wait_for_function("!!commMe()", timeout=5000)
    await page2.evaluate("go('detail','x1')"); await page2.wait_for_selector('.crev', timeout=5000)
    check('stessa opera su edizioni diverse', 'Capolavoro' in await page2.evaluate("document.querySelector('.crev').textContent"))
    await page2.evaluate("document.querySelector('form.creply').classList.remove('hidden')")
    await page2.fill('form.creply textarea', 'Concordo!'); await page2.evaluate("document.querySelector('form.creply').requestSubmit()")
    await page2.wait_for_selector('.ccom', timeout=5000)
    check('risposta a una recensione', 'Concordo' in await page2.evaluate("document.querySelector('.ccom').textContent"))
    await page.evaluate("S.commUnreadAt=0; commUnreadCheck()"); await page.wait_for_timeout(400)
    check('notifica del commento (campanella)', await page.evaluate("S.commNotifs") == 1)
    await page.evaluate("notifsOpen()"); await page.wait_for_selector('.notif', timeout=5000)
    check('testo della notifica', 'Concordo' in await page.evaluate("document.querySelector('.notif').textContent"))
    await page.click('.notif'); await page.wait_for_selector('#discList', timeout=5000)
    check('notifica apre la discussione', 'Concordo' in await page.evaluate("document.querySelector('#discList').textContent"))
    await page.evaluate("closeSheet()")
    await page2.evaluate("go('home', null, true)"); await page2.click('[data-a=mainTab][data-v=community]')
    await page2.wait_for_selector('#commList .crow', timeout=8000)
    check('scheda Community accanto a Novità', await page2.evaluate("[...document.querySelectorAll('.maintabs button')].map(b=>b.dataset.v).join()") == 'home,community,list')
    check('ultime recensioni nella scheda Community', 'Anna' in await page2.evaluate("document.querySelector('#commList').textContent"))
    await page2.click('[data-a=commSeg][data-v=messaggi]'); await page2.wait_for_selector('#commList .cempty', timeout=5000)
    check('messaggi vuoti: propone una nuova conversazione', await page2.evaluate("!!document.querySelector('#commList .cempty [data-a=newChat]')"))
    # (i desideri di Bruno dipendono da cosa è già arrivato da Drive: senza desideri propone di aggiungerne, con desideri di condividerli)
    await page2.click('#commList [data-a=goScambi]'); await page2.wait_for_selector('#commList [data-a=wishSearch], #commList [data-a=shareWishOn]', timeout=8000)
    check('scambi vuoti: propone di offrire un pezzo e aggiungere/condividere i desideri', await page2.evaluate("!!document.querySelector('[data-a=newShare]') && !!document.querySelector('#commList [data-a=wishSearch], #commList [data-a=shareWishOn]')"))
    await page2.evaluate("actions.wishSearch()"); await page2.wait_for_selector('#sheet input', timeout=5000)
    check('aggiungi un desiderio apre la ricerca in modalità desideri', await page2.evaluate("S.pickWish === true && !$('#sheetWrap').classList.contains('hidden')"))
    await page2.evaluate("closeSheet(); S.pickWish=false; S.commSeg='bacheca'")
    await page.evaluate("go('community', null, true)"); await page.wait_for_timeout(300)
    check('invito ad attivare le notifiche push', await page.evaluate("!!document.querySelector('.pushhint')"))
    await page.evaluate("pushGo('review:' + COMM.x)".replace('COMM.x', "'" + [r for r in COMM['reviews']][0]['id'] + "'")); await page.wait_for_selector('#discList', timeout=5000)
    check('tocco su una notifica push apre la discussione', True)
    await page.evaluate("closeSheet()")
    await page.evaluate("go('settings')"); await page.click('[data-a=legal][data-v=privacy]')
    check('informativa privacy con contatto', 'gjorgkodra@gmail.com' in await page.evaluate("document.querySelector('.legal').textContent"))
    await page.evaluate("closeSheet()")
    async with page.expect_download() as dl:
        await page.evaluate("navigator.canShare=null; commExport()")
    check('scarica i miei dati', 'reviews' in open(await (await dl.value).path()).read())
    await page.evaluate("go('settings')")
    check('impostazioni: invita un amico', await page.evaluate("!!document.querySelector('[data-a=commInvite]')"))
    await page2.evaluate("go('settings')"); await page2.click('[data-a=commDelete]'); await page2.fill('#delNick', 'Sbagliato'); await page2.click('[data-a=commDeleteGo]')
    check('eliminazione chiede il nome giusto', await page2.evaluate("!!commMe()"))
    await page2.fill('#delNick', 'Bruno'); await page2.click('[data-a=commDeleteGo]'); await page2.wait_for_function("!commMe()", timeout=5000)
    check('account eliminato', not any(m['nick'] == 'Bruno' for m in COMM['members'].values()))
    check('nessun errore JavaScript', not (errs + errs2), errs + errs2)

async def t_exchange(b, base):
    print('\nScambi, messaggi e blog')
    tok = lambda n: f"localStorage.setItem('gtoken', JSON.stringify({{t:'{n}', exp: Date.now()+3600e3}}));"
    COMM['invites']['SCAMBI'] = 0
    async def member(name, items):
        page, errs = await new_page(b, base, init=tok(name.upper()))
        await page.evaluate(SEED, items)
        await page.evaluate("commJoinSheet()"); await page.fill('#commNick', name); await page.fill('#commCode', 'SCAMBI'); await page.check('#commOk')
        await page.evaluate("commJoin()"); await page.wait_for_function("!!commMe()", timeout=5000)
        return page, errs
    # Carla cerca Nevermind e condivide la lista desideri
    carla, e1 = await member('Carla', [dict(id='w1', tipo='cd', titolo='Nevermind', autore='Nirvana', desiderio=True)])
    await carla.evaluate("localStorage.setItem('shareWish','1'); commSyncShares(true)"); await carla.wait_for_timeout(300)
    # Dario ha Nevermind (non condiviso) e lo trova negli Scambi
    dario, e2 = await member('Dario', [dict(id='d1', tipo='vinile', titolo='Nevermind', autore='Nirvana', anno='1991')])
    await dario.evaluate("S.commSeg='scambi'; go('community', null, true)")
    await dario.wait_for_selector('[data-a=offerSheet][data-mode=give]', timeout=8000)
    check('Scambi: chi cerca cose che hai', 'Carla' in await dario.evaluate("document.querySelector('#commList').textContent"))
    await dario.click('[data-a=offerSheet][data-mode=give]')
    await dario.fill('#offerPrice', '25'); await dario.fill('#offerText', 'Ce l\'ho in ottimo stato')
    await dario.evaluate("offerSend()"); await dario.wait_for_selector('#msgs .msg', timeout=5000)
    check('proposta di vendita inviata', 'In vendita' in await dario.evaluate("document.querySelector('#msgs').textContent"))
    # Carla vede il messaggio non letto e risponde
    await carla.evaluate("S.commUnreadAt=0; commUnreadCheck()"); await carla.wait_for_timeout(400)
    check('messaggio non letto segnalato', await carla.evaluate("S.commUnread") == 1)
    await carla.evaluate("S.commSeg='messaggi'; go('community', null, true)"); await carla.wait_for_selector('[data-a=threadOpen]', timeout=5000)
    await carla.click('[data-a=threadOpen]'); await carla.wait_for_selector('#msgForm', timeout=5000)
    await carla.fill('#msgText', 'Affare fatto!'); await carla.evaluate("document.querySelector('#msgForm').requestSubmit()")
    await carla.wait_for_function("document.querySelector('#msgs').textContent.includes('Affare fatto')", timeout=5000)
    check('risposta nella conversazione', True)
    # Dario mette in vendita un pezzo e scrive un articolo nel blog dell'opera
    await dario.evaluate("closeSheet(); const it=byId('d1'); it.condiviso=true; it.offerta='vendo'; it.prezzoRichiesto='25'; saveItem(it)")
    await dario.wait_for_timeout(3200)
    await dario.evaluate("go('detail','d1')"); await dario.wait_for_selector('#commBody .cshare', timeout=5000)
    check('scheda: condiviso e in vendita', 'In vendita' in await dario.evaluate("document.querySelector('.cshare').textContent"))
    await dario.evaluate("postSheet()"); await dario.fill('#postTitle', 'La prima stampa'); await dario.fill('#postBody', 'Storia della copertina con il neonato.')
    await dario.evaluate("postSend()"); await dario.wait_for_selector('article.post', timeout=5000)
    check('articolo pubblicato nel blog', 'La prima stampa' in await dario.evaluate("document.querySelector('article.post').textContent"))
    await carla.evaluate("closeSheet(); S.commSeg='bacheca'; go('community', null, true)"); await carla.wait_for_selector('#commList .crow', timeout=5000)
    txt = await carla.evaluate("document.querySelector('#commList').textContent")
    check('bacheca: articolo e pezzo in vendita', 'Blog' in txt and 'In vendita' in txt, txt[:200])
    check('nessun errore JavaScript', not (e1 + e2), e1 + e2)

async def t_events(b, base):
    print('\nEventi')
    tok = lambda n: f"localStorage.setItem('gtoken', JSON.stringify({{t:'{n}', exp: Date.now()+3600e3}}));"
    COMM['invites']['EVENTI'] = 0
    async def member(name, items):
        page, errs = await new_page(b, base, init=tok(name.upper()))
        await page.evaluate(SEED, items)
        await page.evaluate("commJoinSheet()"); await page.fill('#commNick', name); await page.fill('#commCode', 'EVENTI'); await page.check('#commOk')
        await page.evaluate("commJoin()"); await page.wait_for_function("!!commMe()", timeout=5000)
        return page, errs
    elena, e1 = await member('Elena', [])
    fabio, e2 = await member('Fabio', [dict(id='v1', tipo='vinile', titolo='Kind of Blue', autore='Miles Davis', tracklist='A1. So What (9:22)\nA2. Freddie Freeloader (9:46)')])
    # Fabio crea un ascolto dalla scheda del disco e invita Elena
    await fabio.evaluate("go('detail','v1')"); await fabio.wait_for_selector('[data-a=eventFromWork]', timeout=5000)
    await fabio.click('[data-a=eventFromWork]'); await fabio.wait_for_selector('#evMembers [data-mem]', timeout=5000)
    check('evento precompilato dal disco', 'Kind of Blue' in await fabio.evaluate("document.querySelector('#evTitle').value") and await fabio.evaluate("S.evDraft.kind") == 'ascolto')
    await fabio.evaluate("const d=new Date(Date.now()+5*60e3); document.querySelector('#evWhen').value=new Date(d-d.getTimezoneOffset()*60e3).toISOString().slice(0,16)")
    await fabio.click('#evMembers label:has-text("Elena") input')
    await fabio.click('[data-a=evVis][data-v=invite]')
    await fabio.evaluate("eventCreate()"); await fabio.wait_for_selector('.evhead', timeout=5000)
    check('ascolto in corso con le tracce del disco', await fabio.evaluate("!!document.querySelector('.evchip.live') && document.querySelectorAll('#evTrack option').length === 3"))
    await fabio.select_option('#evTrack', index=1); await fabio.fill('#evText', 'Che attacco!')
    await fabio.evaluate("document.querySelector('#evForm').requestSubmit()")
    await fabio.wait_for_function("document.querySelector('#emsgs').textContent.includes('[A1. So What] Che attacco!')", timeout=5000)
    check('commento in diretta legato alla traccia', True)
    # Elena vede l'invito, risponde Partecipo e scarica il calendario
    await elena.evaluate("S.commUnreadAt=0; commUnreadCheck()"); await elena.wait_for_timeout(400)
    check('invito segnalato nella linguetta', await elena.evaluate("S.commInvites") == 1)
    await elena.evaluate("S.commSeg='eventi'; go('community', null, true)"); await elena.wait_for_selector('.evcard', timeout=5000)
    check('evento solo-invitati visibile all\'invitata', 'Sei invitato' in await elena.evaluate("document.querySelector('.evcard').textContent"))
    await elena.click('.evcard'); await elena.wait_for_selector('.evrsvp', timeout=5000)
    await elena.click('[data-a=rsvp][data-v=si]'); await elena.wait_for_function("document.querySelector('.evrsvp .on') && document.querySelector('.evrsvp .on').dataset.v==='si'", timeout=5000)
    check('risposta Partecipo', 'Elena' in await elena.evaluate("document.querySelector('.evrsvp').nextElementSibling.textContent"))
    async with elena.expect_download() as dl:
        await elena.evaluate("navigator.canShare=null; eventIcs()")
    ics = open(await (await dl.value).path()).read()
    check('file calendario con promemoria', 'BEGIN:VEVENT' in ics and 'TRIGGER:-P1D' in ics and 'Kind of Blue' in ics)
    # Nuovo: condividi un pezzo con un commento e nuova conversazione
    await fabio.evaluate("closeSheet(); S.commSeg='bacheca'; go('community', null, true)"); await fabio.wait_for_selector('[data-a=commNew]', timeout=5000)
    await fabio.click('[data-a=commNew]'); await fabio.click('[data-a=newShare]'); await fabio.click('[data-a=pickDo]')
    await fabio.fill('#shNote', 'Stampa italiana del 1959, suona benissimo'); await fabio.click('#shGo')
    await fabio.wait_for_function("document.querySelector('#commList') && document.querySelector('#commList').textContent.includes('suona benissimo')", timeout=8000)
    check('pezzo condiviso con commento in bacheca', True)
    # Elena commenta il pezzo condiviso da Fabio dalla bacheca
    await elena.evaluate("closeSheet(); S.commSeg='bacheca'; go('community', null, true)")
    await elena.wait_for_function("document.querySelector('#commList') && document.querySelector('#commList').textContent.includes('suona benissimo')", timeout=8000)
    await elena.evaluate("const i=S.commBoard.findIndex(x=>x.type==='share'&&x.note); boardOpen(i)"); await elena.wait_for_selector('#discForm', timeout=5000)
    await elena.fill('#discForm textarea', 'Che bella stampa!'); await elena.evaluate("document.querySelector('#discForm').requestSubmit()")
    await elena.wait_for_function("document.querySelector('#discList') && document.querySelector('#discList').textContent.includes('Che bella stampa')", timeout=5000)
    check('commento su un pezzo condiviso', True)
    await fabio.click('[data-a=commNew]'); await fabio.click('[data-a=newChat]'); await fabio.wait_for_selector('#chatTo', timeout=5000)
    await fabio.select_option('#chatTo', label='Elena'); await fabio.fill('#chatText', 'Ciao Elena!'); await fabio.click('#chatGo')
    await fabio.wait_for_selector('#msgs .msg', timeout=5000)
    check('nuova conversazione', 'Ciao Elena' in await fabio.evaluate("document.querySelector('#msgs').textContent"))
    await fabio.evaluate("closeSheet(); go('home', null, true)")
    check('Aggiungi solo in Collezione', await fabio.evaluate("!document.querySelector('.fab')"))
    check('nessun errore JavaScript', not (e1 + e2), e1 + e2)

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

async def t_welcome(b, base):
    print('\nBenvenuto e controlli in background')
    page, errs = await new_page(b, base, init="localStorage.removeItem('welcomed'); localStorage.removeItem('seenVersion');")
    await page.wait_for_selector('.welcome', timeout=5000)
    check('primo avvio: benvenuto passo 1', 'Cataloga' in await page.evaluate("document.querySelector('.welcome h2').textContent"))
    await page.click('[data-a=welcomeStep]'); await page.click('[data-a=welcomeStep]')
    check('passo 3: community', 'community' in await page.evaluate("document.querySelector('.welcome h2').textContent"))
    check('tre pallini, l\'ultimo acceso', await page.evaluate("[...document.querySelectorAll('.wdots i')].map(i=>i.className).join()") == ',,on')
    await page.click('[data-a=welcomeAdd]'); await page.wait_for_selector('[data-a=addScan]', timeout=3000)
    check('aggiungi il primo pezzo apre Aggiungi', True)
    check('novità non mostrate a un nuovo utente', await page.evaluate("localStorage.getItem('seenVersion') === VERSION"))
    await page.reload(); await page.wait_for_timeout(1200)
    check('benvenuto solo la prima volta', await page.evaluate("!document.querySelector('.welcome')"))
    await page.evaluate("go('settings')"); await page.click('[data-a=welcome]')
    check('guida introduttiva dalle Impostazioni', await page.evaluate("!!document.querySelector('.welcome')"))
    # chi ha già pezzi non vede il benvenuto
    p2, e2 = await new_page(b, base, init="localStorage.removeItem('welcomed');")
    await p2.evaluate(SEED, ITEMS); await p2.reload(); await p2.wait_for_timeout(1200)
    check('utente con collezione: niente benvenuto', await p2.evaluate("!document.querySelector('.welcome')"))
    # controllo novità community: ogni 3 minuti, ogni 10 con le notifiche push
    gaps = await p2.evaluate("(()=>{ const a = COMM_GAP(); localStorage.setItem('pushOn','1'); const pn = window.Notification; window.Notification = {permission:'granted'}; const b = COMM_GAP(); window.Notification = pn; localStorage.removeItem('pushOn'); return [a, b]; })()")
    check('controllo in background: 3 min, 10 con il push', gaps == [180000, 600000], gaps)
    check('nessun errore JavaScript', not (errs + e2), errs + e2)

async def t_feedback(b, base):
    print('\nSegnalazioni ed errori')
    page, errs = await new_page(b, base, init="localStorage.setItem('gtoken', JSON.stringify({t:'FB', exp: Date.now()+3600e3}));")
    await page.evaluate(SEED, ITEMS)
    await page.evaluate("go('settings')"); await page.click('[data-a=feedback][data-v=bug]')
    await page.fill('#fbText', 'ok'); await page.click('[data-a=fbSend]'); await page.wait_for_timeout(300)
    check('messaggio troppo corto: non invia', len(FEEDBACK['sent']) == 0)
    await page.fill('#fbText', 'La scansione si blocca'); await page.click('[data-a=fbKind][data-v=idea]')
    check('cambiando tipo il testo resta', await page.input_value('#fbText') == 'La scansione si blocca')
    await page.click('[data-a=fbKind][data-v=bug]'); await page.fill('#fbContact', 'mario@example.com')
    await page.click('[data-a=fbSend]'); await page.wait_for_function("document.querySelector('#sheetWrap').classList.contains('hidden')", timeout=5000)
    x = FEEDBACK['sent'][-1] if FEEDBACK['sent'] else {}
    check('segnalazione inviata con contatto', x.get('kind') == 'bug' and x.get('contact') == 'mario@example.com')
    d = json.dumps(x.get('diag') or {})
    check('dati tecnici: versione e telefono, niente collezione', '"version"' in d and '"ua"' in d and 'Dark Side' not in d and 'Pink Floyd' not in d, d[:200])
    check('senza community: segnalazione anonima', FEEDBACK['tokens'][-1] == '')
    # errori dell'app: inviati una volta sola, si possono disattivare
    await page.evaluate("setTimeout(() => { nonEsiste1() }); setTimeout(() => { nonEsiste1() }, 50); setTimeout(() => { Promise.reject(new Error('promessa rotta')) }, 10); 0")
    await page.wait_for_timeout(3600)
    msgs = [e['message'] for e in FEEDBACK['errors']]
    check('errore inviato una sola volta', sum('nonEsiste1' in m for m in msgs) == 1, msgs)
    check('anche le promesse rifiutate', any('promessa rotta' in m for m in msgs), msgs)
    check('niente indirizzo del sito nei dati', not any('localhost' in (e.get('source', '') + e.get('stack', '')) or '127.0.0.1' in (e.get('source', '') + e.get('stack', '')) for e in FEEDBACK['errors']))
    await page.evaluate("go('settings')"); await page.click('#errT')
    await page.evaluate("setTimeout(() => { nonEsiste2() })"); await page.wait_for_timeout(3400)
    check('errori automatici disattivabili', not any('nonEsiste2' in e['message'] for e in FEEDBACK['errors']))
    await page.evaluate("errCatch('Script error.', '', ''); errCatch('x', 'chrome-extension://abc/x.js', '')"); await page.wait_for_timeout(100)
    # amministratore: vede le segnalazioni
    admin, e2 = await new_page(b, base, init="localStorage.setItem('gtoken', JSON.stringify({t:'ADM', exp: Date.now()+3600e3}));")
    await admin.evaluate("commJoinSheet()"); await admin.fill('#commNick', 'Gjorg'); await admin.fill('#commCode', 'AMICO1'); await admin.check('#commOk')
    await admin.evaluate("commJoin()"); await admin.wait_for_function("!!commMe()", timeout=5000)
    COMM['members']['g-ADM']['admin'] = True
    await admin.evaluate("setCommMe({...commMe(), admin: true}); go('settings')")
    await admin.click('[data-a=feedbackAdmin]'); await admin.wait_for_selector('.fbrow', timeout=5000)
    t = await admin.evaluate("document.querySelector('#fbList').textContent")
    check('amministratore: segnalazioni ed errori', 'La scansione si blocca' in t and 'nonEsiste1' in t, t[:200])
    await admin.evaluate("closeSheet(); go('settings')"); await admin.click('[data-a=feedback][data-v=idea]')
    await admin.fill('#fbText', 'Vorrei la modalità scura'); await admin.click('[data-a=fbSend]'); await admin.wait_for_timeout(400)
    check('membro: segnalazione con il token Google', FEEDBACK['tokens'][-1] == 'ADM')
    check('nessun errore JavaScript (oltre a quelli di prova)', not [x for x in errs + e2 if 'nonEsiste' not in x and 'promessa rotta' not in x], errs + e2)

async def t_home(b, base):
    print('\nHome "Novità"')
    page, errs = await new_page(b, base)
    items = ITEMS + [dict(id='i6', tipo='film', titolo='Blade Runner', autore='Ridley Scott', anno='1982')]
    await page.evaluate(SEED, items)
    await page.evaluate("S.main='home'; go('home', null, true)")
    await page.wait_for_function("!feedLoading && S.feed && S.feed.rows && S.feed.rows.artisti", timeout=30000); await page.wait_for_timeout(300)
    rows = await page.evaluate("[...document.querySelectorAll('.feedrow')].map(r=>r.dataset.row)")
    for k in ['continua', 'ricorda', 'cinema', 'articoli', 'artisti', 'autori', 'registi', 'album', 'libri']:
        check(f'riga {k}', k in rows, rows)
    check('cinema: in sala + solo i futuri in arrivo', await page.evaluate("S.feed.rows.cinema.map(f=>f.titolo).join()") == 'Film in sala,Altro film,Film in arrivo')
    check('articoli da più fonti', await page.evaluate("new Set(S.feed.rows.articoli.map(a=>a.kind)).size") >= 3)
    check('articolo apre il sito', await page.evaluate("!!document.querySelector('.feedrow[data-row=articoli] a.fcard[target=_blank]')"))
    check('nuovi album da Deezer', await page.evaluate("S.feed.rows.album.map(f=>f.titolo).join()") == 'Album della settimana')
    check('nuovi libri', await page.evaluate("S.feed.rows.libri.map(f=>f.titolo).join()") == 'Romanzo appena uscito')
    check('autori: solo libri recenti', await page.evaluate("S.feed.rows.autori.map(f=>f.titolo).join()") == 'Il nuovo libro')
    await page.screenshot(path=os.path.join(os.path.dirname(__file__), 'home.png'), full_page=True)
    n0 = await page.evaluate("live().filter(i=>i.desiderio).length")
    await page.click('.feedrow[data-row=cinema] .fcard'); await page.wait_for_timeout(200)
    await page.click('[data-a=feedWish]'); await page.wait_for_timeout(800)
    check('aggiunto ai desideri dalla Home', await page.evaluate("live().filter(i=>i.desiderio).length") == n0 + 1)
    await page.click('.maintabs [data-v=list]'); check('scheda Collezione', await page.evaluate("S.view") == 'list')
    page2, errs2 = await new_page(b, base); await page2.wait_for_timeout(300)
    check('si riapre sull\'ultima scheda', await page2.evaluate("S.view") == 'list')
    check('nessun errore JavaScript', not (errs + errs2), errs + errs2)

async def main():
    t_files()
    base = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for t in (t_basics, t_check_and_value, t_auto_online, t_book_rating, t_community, t_exchange, t_events, t_batch_import, t_cover, t_sync, t_silent_login, t_welcome, t_feedback, t_home):
            try: await t(b, base)
            except Exception as e: check(t.__name__ + ' (eccezione)', False, repr(e)[:300])
        await b.close()
    bad = [r for r in RESULTS if not r[1]]
    print(f'\n{len(RESULTS) - len(bad)} di {len(RESULTS)} controlli superati')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    asyncio.run(main())
