import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))
from services.spotify_service import resolve_spotify_track_to_youtube

tracks = [
    ("Where We Started", "Lost Sky, Jex"),
    ("Control", "Unknown Brain, Rival, Jex"),
    ("Destiny", "NEFFEX"),
    ("Superhero", "Unknown Brain, Chris Linton"),
    ("Howling", "Cartoon, Asena")
]

async def test_resolve():
    for title, artist in tracks:
        m = await resolve_spotify_track_to_youtube(title, artist)
        if m:
            print(f"{title} -> poster: {m.get('poster')}, videoId: {m.get('videoId')}")
        else:
            print(f"{title} -> None")

asyncio.run(test_resolve())
