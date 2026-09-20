"""
Lambda entry point for the daily stats refresh.

Runs everything in data_processing/daily in-process: player_active_get_stats
for every ID in player_active.player_ids, plus league_active_get_stats. Each
result is written to DATA_BUCKET in S3, and (on full success) the CodeBuild
project that rebuilds and redeploys the site with the fresh numbers is started.
"""
import os

import boto3

from data_processing.daily.league_active_get_stats import fetch_league_stats, save_s3 as save_league_s3
from data_processing.daily.player_active import player_ids
from data_processing.daily.player_active_get_stats import fetch_player_stats, save_s3 as save_player_s3

DATA_BUCKET = os.environ["DATA_BUCKET"]
CODEBUILD_PROJECT = os.environ.get("CODEBUILD_PROJECT", "site-build")


def handler(event, context):
    failed = []

    for player_id in player_ids:
        try:
            data = fetch_player_stats(player_id)
            save_player_s3(data, DATA_BUCKET)
        except Exception as exc:  # noqa: BLE001 - collect all failures before raising
            failed.append({"player_id": player_id, "error": str(exc)})

    try:
        save_league_s3(fetch_league_stats(), DATA_BUCKET)
    except Exception as exc:  # noqa: BLE001
        failed.append({"task": "league", "error": str(exc)})

    if failed:
        raise RuntimeError(f"Failed to refresh {len(failed)} item(s): {failed}")

    codebuild = boto3.client("codebuild")
    build = codebuild.start_build(projectName=CODEBUILD_PROJECT)

    return {
        "refreshed": len(player_ids),
        "codebuild_id": build["build"]["id"],
    }
