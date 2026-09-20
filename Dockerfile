FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.12

COPY lambda_handler.py ${LAMBDA_TASK_ROOT}/
COPY data_processing/daily/ ${LAMBDA_TASK_ROOT}/data_processing/daily/
RUN pip install --no-cache-dir MLB-StatsAPI==1.9.0 --target "${LAMBDA_TASK_ROOT}"

CMD ["lambda_handler.handler"]
