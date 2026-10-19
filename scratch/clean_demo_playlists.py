import sqlite3

conn = sqlite3.connect('backend/vibemusic.db')
c = conn.cursor()
c.execute("SELECT id, name FROM user_playlists WHERE name LIKE '%(Spotify)%' OR id LIKE '%demo%'")
rows = c.fetchall()
print("Found demo playlists to delete:", rows)
c.execute("DELETE FROM user_playlist_tracks WHERE playlist_id IN (SELECT id FROM user_playlists WHERE name LIKE '%(Spotify)%' OR id LIKE '%demo%')")
c.execute("DELETE FROM user_playlists WHERE name LIKE '%(Spotify)%' OR id LIKE '%demo%'")
conn.commit()

print("Remaining playlists in database:")
c.execute("SELECT id, name FROM user_playlists")
print(c.fetchall())
conn.close()
