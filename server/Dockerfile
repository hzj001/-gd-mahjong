FROM golang:1.20-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY --from=builder /api /app/api
COPY config/config.docker.yaml /app/config/config.docker.yaml
ENV CONFIG_PATH=/app/config/config.docker.yaml
EXPOSE 8080
CMD ["/app/api"]
