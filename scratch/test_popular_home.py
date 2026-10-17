import sys
sys.stdout.reconfigure(encoding='utf-8')
from concurrent.futures import ThreadPoolExecutor, as_completed
from ytmusicapi import YTMusic
yt = YTMusic()

def _format_track(item):
    if not item or not isinstance(item, dict): return None
    vid = item.get('videoId')
    if not vid: return None
    title = item.get('title') or ''
    artists = item.get('artists', [])
    art_names = [a.get('name') for a in artists if isinstance(a, dict) and a.get('name')]
    return {'videoId': vid, 'title': title, 'artists': art_names}

categories = [
    ("Top Global Hits", "Global Trending Songs"),
    ("Today's Biggest Hits", "Top 50 Global songs"),
    ("Pop Superstars & Hits", "Pop Hits Radio songs"),
    ("Hip-Hop & R&B Hits", "Top Hip Hop Hits songs"),
    ("Bollywood Top Hits", "Top Bollywood Hits songs")
]

def fetch_cat(item):
    title, q = item
    try:
        res = yt.search(q, filter='songs')
        tracks = [_format_track(x) for x in res if _format_track(x)]
        return title, tracks
    except Exception as e:
        return title, []

results = {}
with ThreadPoolExecutor(max_workers=5) as ex:
    futs = [ex.submit(fetch_cat, c) for c in categories]
    for f in as_completed(futs):
        t, trks = f.result()
        results[t] = trks

for title, _ in categories:
    trks = results.get(title, [])
    print(f"=== {title} === (Total tracks: {len(trks)})")
    for trk in trks[:4]:
        print(f"   {trk['title']} by {trk['artists']}")
