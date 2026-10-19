import sqlite3

conn = sqlite3.connect('backend/vibemusic.db')
conn.row_factory = sqlite3.Row
print("Tables:", [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()])
users = conn.execute("SELECT * FROM users").fetchall()
print("Users count:", len(users))
for u in users:
    print(dict(u))
playlists = conn.execute("SELECT * FROM user_playlists").fetchall()
print("Playlists count:", len(playlists))
for p in playlists:
    print(dict(p))
