environment := "local"

up env=environment:
  ENV={{env}} docker compose up -d

down env=environment:
  ENV={{env}} docker compose down

drop env=environment:
  ENV={{env}} docker compose down -v

config env=environment:
  ENV={{env}} docker compose config

status env=environment:
  ENV={{env}} docker compose ps