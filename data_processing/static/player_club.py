import subprocess
import sys

player_ids = [
    110284, # Cap Anson
    110001, # Hank Aaron
    134181, # Adrian Beltre
    110987, # Craig Biggio
    111153, # Wade Boggs
    111437, # George Brett
    111495, # Lou Brock
    408234, # Miguel Cabrera
    111986, # Rod Carew
    112391, # Roberto Clemente
    112431, # Ty Cobb
    112506, # Eddie Collins
    115270, # Tony Gwynn
    115749, # Rickey Henderson
    116539, # Derek Jeter
    116822, # Al Kaline
    117414, # Nap Lajoie
    118495, # Willie Mays
    119236, # Paul Molitor
    119579, # Eddie Murray
    119602, # Stan Musial
    120191, # Rafael Palmeiro
    405395, # Albert Pujols
    121222, # Cal Ripken Jr.
    121347, # Alex Rodriguez
    121454, # Pete Rose
    122566, # Tris Speaker
    400085, # Ichiro Suzuki
    123784, # Honus Wagner
    123905, # Paul Waner
    124448, # Dave Winfield
    124650, # Carl Yastrzemski
    124721, # Robin Yount
    
]

def main():
    failed = []

    for player_id in player_ids:
        result = subprocess.run(
            [sys.executable, "data_processing/static/player_club_get_stats.py", str(player_id)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"--- player {player_id} failed ---")
            print(result.stderr)
            failed.append(player_id)

    if failed:
        print(f"\nFailed player IDs: {failed}")


if __name__ == "__main__":
    main()