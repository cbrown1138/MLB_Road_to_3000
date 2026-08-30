"""
Lambda entry point for the daily stats refresh.

Runs data_player_get_stats.fetch_player_stats() in-process for every player in
data_player_run_all.player_ids, writes each result to DATA_BUCKET in S3, and
(on full success) triggers the CodeBuild project that rebuilds and redeploys
the site with the fresh numbers.
"""
import os

import boto3

from data_player_get_stats import fetch_player_stats, save_s3
from data_player_run_all import player_ids

DATA_BUCKET = os.environ["DATA_BUCKET"]
CODEBUILD_PROJECT = os.environ.get("CODEBUILD_PROJECT", "site-build")


def handler(event, context):
    failed = []

    for player_id in player_ids:
        try:
            data = fetch_player_stats(player_id)
            save_s3(data, DATA_BUCKET)
        except Exception as exc:  # noqa: BLE001 - collect all failures before raising
            failed.append({"player_id": player_id, "error": str(exc)})

    if failed:
        raise RuntimeError(f"Failed to refresh stats for {len(failed)} player(s): {failed}")

    codebuild = boto3.client("codebuild")
    build = codebuild.start_build(projectName=CODEBUILD_PROJECT)

    return {
        "refreshed": len(player_ids),
        "codebuild_id": build["build"]["id"],
    }
