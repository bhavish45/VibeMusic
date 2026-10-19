import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath('backend'))
from services.spotify_service import import_spotify_playlist_by_url

async def test():
    import httpx, re, json
    r = httpx.get('https://open.spotify.com/embed/playlist/37i9dQZF1DX4o1oenSJRJd', headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text)
    d = json.loads(m.group(1))
    props = d.get('props', {}).get('pageProps', {})
    entity = props.get('state', {}).get('data', {}).get('entity', {}) or props.get('entity', {})
    data_node = props.get('state', {}).get('data', {})
    print('state data keys:', list(data_node.keys()))
    for k, v in data_node.items():
        if k != 'entity':
            print(k, ':', str(v)[:200])

if __name__ == '__main__':
    asyncio.run(test())
