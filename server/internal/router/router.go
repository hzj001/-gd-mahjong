package router

import (
	"gdMahjong/server/internal/auth"
	"gdMahjong/server/internal/handler"
	"gdMahjong/server/internal/middleware"
	"gdMahjong/server/internal/ws"

	"github.com/gin-gonic/gin"
)

func Setup(mode string, jwtSvc *auth.JWTService, ah *handler.AuthHandler, rh *handler.RoomHandler, hub *ws.Hub) *gin.Engine {
	if mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), middleware.CORS())

	r.GET("/health", rh.Health)
	r.GET("/ws", hub.HandleWS)

	api := r.Group("/api/v1")
	{
		api.POST("/auth/wx-login", ah.WxLogin)

		authG := api.Group("")
		authG.Use(middleware.Auth(jwtSvc))
		{
			authG.GET("/user/profile", ah.Profile)
			authG.GET("/user/stats", ah.Stats)
			authG.POST("/room/create", rh.Create)
			authG.POST("/room/join", rh.Join)
			authG.GET("/room/info", rh.Info)
			authG.POST("/room/ready", rh.Ready)
			authG.POST("/room/leave", rh.Leave)
			authG.POST("/room/start", rh.Start)
			authG.POST("/match/quick", rh.QuickMatch)
			authG.GET("/game/record", rh.Records)
			authG.GET("/rank/list", rh.RankList)
		}
	}
	return r
}
