.PHONY: run tidy build docker-up docker-down

run:
	go run ./cmd/api

tidy:
	go mod tidy

build:
	go build -o bin/api ./cmd/api

docker-up:
	docker compose up -d

docker-down:
	docker compose down
