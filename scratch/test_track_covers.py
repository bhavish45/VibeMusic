import asyncio
import httpx
import time
import re
import json

async def main():
    url = "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=headers)
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text)
        data = json.loads(m.group(1))
        entity = data['props']['pageProps']['state']['data']['entity']
        tracks = entity['trackList']
        print("Track 0 raw:", json.dumps(tracks[0], indent=2))
        print(f"Testing {len(tracks)} tracks oEmbed fetching...")
        t0 = time.time()
        
        async def fetch_thumb(t):
            sp_id = t["uri"].replace("spotify:track:", "")
            oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{sp_id}"
            try:
                res = await client.get(oembed_url)
                if res.status_code == 200:
                    thumb = res.json().get("thumbnail_url")
                    if thumb:
                        # High-res upgrade
                        thumb = thumb.replace("ab67616d00001e02", "ab67616d0000b273")
                    return thumb
            except Exception as e:
                pass
            return None

        results = await asyncio.gather(*(fetch_thumb(t) for t in tracks))
        print(f"Completed in {time.time() - t0:.2f}s")
        for t, thumb in zip(tracks, results):
            print(f"{t['title'][:30]} -> {thumb}")

asyncio.run(main())
