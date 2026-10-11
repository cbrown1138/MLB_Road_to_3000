"""
Predict an active player's career total hits, total games and retirement age
from where retired players stood at the same age.

    python -m data_analysis.active_predict_total 514888
    python -m data_analysis.active_predict_total --all
    python -m data_analysis.active_predict_total 116539 --as-of-age 30   # backtest Jeter

Every retired player contributes one snapshot per season of their career:
their stats through that age (features) and what was still to come
(targets: remaining hits, remaining games, final age). A ridge regression per
target is fit on snapshots within a few years of the player's current age,
with the penalty picked by cross-validation grouped by player. The same
cross-validation gives the error bands.

Caveat: the retired players on file all finished with 2,000+ hits, so the
model learns from careers that lasted. Predictions are what a player would
reach on a career like theirs, and run high for players unlikely to get there.
"""
import argparse
import sys

import numpy as np

from data_analysis.tracked_match import load_player, resolve_player, season_factor
from data_processing.players import RETIRED_2000, RETIRED_3000, TRACKED
from data_processing.storage import write_json

FEATURES = [
    'age', 'year', 'debut_age', 'seasons',
    'cum_hits', 'cum_games', 'cum_PA',
    'hits_last1', 'hits_last3', 'games_last3', 'PA_last3',
    'avg', 'hits_per_game',
]
TARGETS = ['remaining_hits', 'remaining_games', 'final_age']
ALPHAS = [0.1, 1, 3, 10, 30, 100]
AGE_WINDOW = 2       # train on snapshots within this many years of the player's age
MIN_SNAPSHOTS = 80   # widen the window until at least this many
FOLDS = 5
BAND = (10, 90)      # percentile band from cross-validated errors


def career_by_age(player: dict, adjust: bool, exclude_year: int | None = None) -> list[dict]:
    """One row per age with that age's (schedule-adjusted) totals; seasons
    sharing an age are merged and missing ages are zero-stat rows."""
    rows = {}
    for y in sorted(int(y) for y in player['hits_per_season']):
        if y == exclude_year:
            continue
        s = str(y)
        f = season_factor(y) if adjust else 1
        row = rows.setdefault(player['age_per_season'][s], {'year': y, 'hits': 0, 'games': 0, 'PA': 0, 'AB': 0})
        row['year'] = y
        for stat in ('hits', 'games', 'PA', 'AB'):
            row[stat] += player[f'{stat}_per_season'][s] * f
    if not rows:
        return []
    out = []
    for age in range(min(rows), max(rows) + 1):
        row = rows.get(age) or {'year': out[-1]['year'] + 1, 'hits': 0, 'games': 0, 'PA': 0, 'AB': 0}
        out.append({'age': age, **row})
    return out


def snapshot(career: list[dict], i: int) -> dict:
    """Features through career[i]."""
    upto = career[:i + 1]
    last3 = upto[-3:]
    cum = {stat: sum(r[stat] for r in upto) for stat in ('hits', 'games', 'PA', 'AB')}
    return {
        'age': career[i]['age'],
        'year': career[i]['year'],
        'debut_age': career[0]['age'],
        'seasons': i + 1,
        'cum_hits': cum['hits'],
        'cum_games': cum['games'],
        'cum_PA': cum['PA'],
        'hits_last1': upto[-1]['hits'],
        'hits_last3': np.mean([r['hits'] for r in last3]),
        'games_last3': np.mean([r['games'] for r in last3]),
        'PA_last3': np.mean([r['PA'] for r in last3]),
        'avg': cum['hits'] / cum['AB'] if cum['AB'] else 0,
        'hits_per_game': cum['hits'] / cum['games'] if cum['games'] else 0,
    }


def training_snapshots(adjust: bool, exclude_id: int) -> list[dict]:
    snaps = []
    for pid in {**RETIRED_3000, **RETIRED_2000}:
        if pid == exclude_id:
            continue
        career = career_by_age(load_player(pid), adjust)
        total_hits = sum(r['hits'] for r in career)
        total_games = sum(r['games'] for r in career)
        for i in range(len(career)):
            s = snapshot(career, i)
            snaps.append({
                **s,
                'player_id': pid,
                'remaining_hits': total_hits - s['cum_hits'],
                'remaining_games': total_games - s['cum_games'],
                'final_age': career[-1]['age'],
            })
    return snaps


def fit_ridge(X: np.ndarray, y: np.ndarray, alpha: float):
    """Ridge on standardized features; returns a predict function."""
    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd == 0] = 1
    Z = (X - mu) / sd
    y_mu = y.mean()
    coef = np.linalg.solve(Z.T @ Z + alpha * np.eye(Z.shape[1]), Z.T @ (y - y_mu))
    return lambda Xn: ((Xn - mu) / sd) @ coef + y_mu


def grouped_folds(groups: np.ndarray, k: int, seed: int = 0) -> list[np.ndarray]:
    """Fold index per row, with every snapshot of a player in the same fold."""
    ids = np.unique(groups)
    np.random.default_rng(seed).shuffle(ids)
    fold_of = {pid: n % k for n, pid in enumerate(ids)}
    return np.array([fold_of[g] for g in groups])


def cross_validate(X, y, folds, alpha) -> np.ndarray:
    """Out-of-fold predictions."""
    pred = np.empty_like(y)
    for f in np.unique(folds):
        test = folds == f
        pred[test] = fit_ridge(X[~test], y[~test], alpha)(X[test])
    return pred


def window(snaps: list[dict], age: int) -> tuple[list[dict], int]:
    width = AGE_WINDOW
    while True:
        rows = [s for s in snaps if abs(s['age'] - age) <= width]
        if len(rows) >= MIN_SNAPSHOTS or width > 10:
            return rows, width
        width += 1


def predict(player: dict, args) -> dict:
    exclude_year = player.get('season') if args.exclude_current else None
    career = career_by_age(player, args.adjust, exclude_year)
    if args.as_of_age is not None:
        career = [r for r in career if r['age'] <= args.as_of_age]
    if not career:
        raise SystemExit(f'{player["full_name"]} has no seasons to predict from')
    current = snapshot(career, len(career) - 1)
    # report from real (unadjusted) totals; the model only predicts what's left
    real = career_by_age(player, False, exclude_year)
    real = [r for r in real if r['age'] <= current['age']]
    real_hits = round(sum(r['hits'] for r in real))
    real_games = round(sum(r['games'] for r in real))

    rows, width = window(training_snapshots(args.adjust, player['player_id']), current['age'])
    X = np.array([[s[f] for f in FEATURES] for s in rows], dtype=float)
    x = np.array([[current[f] for f in FEATURES]], dtype=float)
    folds = grouped_folds(np.array([s['player_id'] for s in rows]), FOLDS)

    out = {}
    for target in TARGETS:
        y = np.array([s[target] for s in rows], dtype=float)
        scored = []
        for alpha in ALPHAS:
            err = cross_validate(X, y, folds, alpha) - y
            scored.append((np.abs(err).mean(), alpha, err))
        mae, alpha, err = min(scored, key=lambda t: t[0])
        point = float(fit_ridge(X, y, alpha)(x)[0])
        # error = predicted - actual, so actual ~ point - error
        lo, hi = point - np.percentile(err, BAND[1]), point - np.percentile(err, BAND[0])
        floor = current['age'] if target == 'final_age' else 0
        out[target] = {
            'point': max(point, floor),
            'low': max(lo, floor),
            'high': max(hi, floor),
            'cv_mae': float(mae),
            'alpha': alpha,
        }

    def total(target, base):
        return {k: round(base + out[target][k]) for k in ('point', 'low', 'high')}

    hits = total('remaining_hits', real_hits)
    # flag a player whose hits sit outside what the training players had at this age
    same_age = [s['cum_hits'] for s in rows if s['age'] == current['age']]
    return {
        'player_id': player['player_id'],
        'name': player['full_name'],
        'as_of_age': current['age'],
        'as_of_year': current['year'],
        'career_hits': real_hits,
        'career_games': real_games,
        'predicted': {
            'career_hits': hits,
            'career_games': total('remaining_games', real_games),
            'retirement_age': {k: round(out['final_age'][k]) for k in ('point', 'low', 'high')},
        },
        'reaches_3000': hits['point'] >= 3000,
        'model': {
            'training_snapshots': len(rows),
            'training_players': len({s['player_id'] for s in rows}),
            'age_window': width,
            'cv_mae': {t: round(out[t]['cv_mae'], 1) for t in TARGETS},
            'alpha': {t: out[t]['alpha'] for t in TARGETS},
        },
        'below_training_range': bool(same_age) and current['cum_hits'] < min(same_age),
    }


def print_result(r: dict) -> None:
    p, m = r['predicted'], r['model']
    print(f"\n{r['name']} — {r['career_hits']} hits, {r['career_games']} games through age "
          f"{r['as_of_age']} ({r['as_of_year']})")
    print(f"{'':<16}{'Predicted':>10}{'Range (' + str(BAND[0]) + '–' + str(BAND[1]) + '%)':>18}{'CV MAE':>9}")
    for label, key, target in (('Career hits', 'career_hits', 'remaining_hits'),
                               ('Career games', 'career_games', 'remaining_games'),
                               ('Retirement age', 'retirement_age', 'final_age')):
        v = p[key]
        print(f"{label:<16}{v['point']:>10}{f'{v['low']}–{v['high']}':>18}{m['cv_mae'][target]:>9}")
    print(f"Trained on {m['training_snapshots']} snapshots of {m['training_players']} retired players "
          f"aged {r['as_of_age']}±{m['age_window']}")
    if r['below_training_range']:
        print('! fewer hits than any training player had at this age — prediction is an extrapolation')


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('player', nargs='?', help='MLBAM ID or part of a tracked/club name')
    parser.add_argument('--all', action='store_true', help='run every tracked player')
    parser.add_argument('--no-adjust', dest='adjust', action='store_false', help="don't scale short seasons")
    parser.add_argument('--exclude-current', action='store_true', help='drop the in-progress season')
    parser.add_argument('--as-of-age', type=int, help='backtest: cut the career off at this age')
    parser.add_argument('--write', action='store_true', help='save to analysis/predictions/<id>.json')
    args = parser.parse_args(argv)

    if args.all:
        ids = list(TRACKED)
    elif args.player:
        ids = [resolve_player(args.player)]
    else:
        parser.error('give a player or --all')

    for pid in ids:
        player = load_player(pid)
        if 'final_date' in player and args.as_of_age is None:
            print(f"{player['full_name']} is retired; use --as-of-age to backtest")
            continue
        result = predict(player, args)
        print_result(result)
        if args.write:
            print(f"wrote {write_json(f'analysis/predictions/{pid}.json', result)}")


if __name__ == '__main__':
    main(sys.argv[1:])
