"""
Read and write JSON by storage key (see config.py).

With DATA_BUCKET set (Lambda), keys are S3 objects and every write also saves
a dated copy under history/<date>/<key>. Otherwise keys are files under
site/data/.
"""

import json
import os

from data_processing.config import DATA_DIR, local_today


def _bucket() -> str | None:
    return os.environ.get('DATA_BUCKET')


def read_json(key: str):
    """Return the parsed JSON at key, or None if it doesn't exist."""
    bucket = _bucket()
    if bucket:
        import boto3
        s3 = boto3.client('s3')
        try:
            return json.loads(s3.get_object(Bucket=bucket, Key=key)['Body'].read())
        except s3.exceptions.NoSuchKey:
            return None

    path = os.path.join(DATA_DIR, key)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def write_json(key: str, data) -> str:
    """Write data to key; returns where it went (local path or s3:// URI)."""
    body = json.dumps(data, indent=2, ensure_ascii=False)
    bucket = _bucket()
    if bucket:
        import boto3
        s3 = boto3.client('s3')
        history_key = f'history/{local_today().isoformat()}/{key}'
        for k in (key, history_key):
            s3.put_object(Bucket=bucket, Key=k, Body=body.encode('utf-8'), ContentType='application/json')
        return f's3://{bucket}/{key}'

    path = os.path.join(DATA_DIR, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(body + '\n')
    return path
