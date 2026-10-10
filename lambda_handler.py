"""
Lambda entry point for the daily stats refresh.

Runs data_processing.jobs.daily in-process, which writes every result to
DATA_BUCKET in S3. On full success it starts the CodeBuild project that
rebuilds and redeploys the site with the fresh numbers.
"""
import os

import boto3

from data_processing.jobs import daily
from data_processing.players import TRACKED

CODEBUILD_PROJECT = os.environ.get("CODEBUILD_PROJECT", "site-build")


def handler(event, context):
    if not os.environ.get("DATA_BUCKET"):
        raise RuntimeError("DATA_BUCKET must be set; without it the job writes to local disk")

    failed = daily.run()
    if failed:
        raise RuntimeError(f"Failed to refresh {len(failed)} item(s): {failed}")

    codebuild = boto3.client("codebuild")
    build = codebuild.start_build(projectName=CODEBUILD_PROJECT)

    return {
        "refreshed": len(TRACKED),
        "codebuild_id": build["build"]["id"],
    }
