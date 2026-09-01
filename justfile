environment := "local"

up env=environment:
  ENV={{env}} docker compose up -d

down:
  docker compose down

drop:
  docker compose down -v
