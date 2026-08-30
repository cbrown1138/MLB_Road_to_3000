FROM public.ecr.aws/lambda/python:3.12

COPY data_player_get_stats.py data_player_run_all.py lambda_handler.py ${LAMBDA_TASK_ROOT}/
RUN pip install MLB-StatsAPI boto3 --target "${LAMBDA_TASK_ROOT}"

CMD ["lambda_handler.handler"]
