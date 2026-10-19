import httpx
import json
import re

url = 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M'
headers = {'User-Agent': 'Mozilla/5.0'}
r = httpx.get(url, headers=headers)
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text)
if m:
    data = json.loads(m.group(1))
    props = data.get('props', {}).get('pageProps', {})
    entity = props.get('state', {}).get('data', {}).get('entity', {}) or props.get('entity', {})
    track_list = entity.get('trackList', [])
    print('Track list count:', len(track_list))
    print('Entity keys:', list(entity.keys()))
