import subprocess
import sys

player_ids = [
    514888, # Jose Altuve
#    545361, # Mike Trout
    605141, # Mookie Betts
    518692, # Freddie Freeman
#    592450, # Aaron Judge
    592518, # Manny Machado
#    660271, # Shohei Ohtani
]

failed = []

for player_id in player_ids:
    result = subprocess.run(
        [sys.executable, "data_player_get_stats.py", str(player_id)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"--- player {player_id} failed ---")
        print(result.stderr)
        failed.append(player_id)

if failed:
    print(f"\nFailed player IDs: {failed}")