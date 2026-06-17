package main

import (
	"log"

	"gdMahjong/server/internal/auth"
	"gdMahjong/server/internal/cache"
	appcfg "gdMahjong/server/internal/config"
	"gdMahjong/server/internal/handler"
	"gdMahjong/server/internal/repository"
	"gdMahjong/server/internal/router"
	"gdMahjong/server/internal/service"
	"gdMahjong/server/internal/ws"
)

func main() {
	cfg, err := appcfg.Load()
	if err != nil {
		log.Fatal(err)
	}

	db, err := repository.NewDB(cfg.MySQL.DSN)
	if err != nil {
		log.Fatal("mysql:", err)
	}
	if err := repository.AutoMigrate(db); err != nil {
		log.Fatal("migrate:", err)
	}
	repos := repository.NewRepositories(db)

	rdb, err := cache.NewRedis(cfg.Redis)
	if err != nil {
		log.Fatal("redis:", err)
	}
	defer rdb.Close()

	jwtSvc := auth.NewJWT(cfg.JWT)
	wxAuth := auth.NewWeChatAuth(cfg.WeChat)

	rm := service.NewRoomManager(repos, rdb, service.NewRankService(repos))
	authSvc := service.NewAuthService(repos, rdb, jwtSvc, wxAuth)
	roomSvc := service.NewRoomService(repos, rdb, rm)

	hub := ws.NewHub(rm, jwtSvc)
	ah := handler.NewAuthHandler(authSvc)
	rh := handler.NewRoomHandler(roomSvc)

	engine := router.Setup(cfg.Server.Mode, jwtSvc, ah, rh, hub)
	log.Printf("gd-mahjong server listening on %s", cfg.Server.Addr)
	if err := engine.Run(cfg.Server.Addr); err != nil {
		log.Fatal(err)
	}
}
