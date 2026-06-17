package handler

import (
	"gdMahjong/server/internal/middleware"
	"gdMahjong/server/internal/service"
	"gdMahjong/server/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(a *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: a}
}

func (h *AuthHandler) WxLogin(c *gin.Context) {
	var req struct {
		Code      string `json:"code" binding:"required"`
		NickName  string `json:"nickName"`
		AvatarURL string `json:"avatarUrl"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, 400, "invalid request")
		return
	}
	res, err := h.auth.WxLogin(c.Request.Context(), req.Code, req.NickName, req.AvatarURL)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, res)
}

func (h *AuthHandler) Stats(c *gin.Context) {
	uid := middleware.UserID(c)
	st, err := h.auth.UserStats(uid)
	if err != nil {
		response.Fail(c, 404, err.Error())
		return
	}
	response.OK(c, st)
}

func (h *AuthHandler) Profile(c *gin.Context) {
	uid := middleware.UserID(c)
	p, err := h.auth.Profile(uid)
	if err != nil {
		response.Fail(c, 404, err.Error())
		return
	}
	response.OK(c, p)
}

type RoomHandler struct {
	room *service.RoomService
}

func NewRoomHandler(r *service.RoomService) *RoomHandler {
	return &RoomHandler{room: r}
}

func (h *RoomHandler) Create(c *gin.Context) {
	var req struct {
		RuleID    string `json:"ruleId"`
		BaseScore int    `json:"baseScore"`
	}
	_ = c.ShouldBindJSON(&req)
	dto, err := h.room.Create(c.Request.Context(), middleware.UserID(c), req.RuleID, req.BaseScore)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, dto)
}

func (h *RoomHandler) Join(c *gin.Context) {
	var req struct {
		RoomID string `json:"roomId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, 400, "invalid request")
		return
	}
	dto, err := h.room.Join(c.Request.Context(), middleware.UserID(c), req.RoomID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, dto)
}

func (h *RoomHandler) Info(c *gin.Context) {
	roomID := c.Query("roomId")
	if roomID == "" {
		response.Fail(c, 400, "roomId required")
		return
	}
	dto, err := h.room.Info(c.Request.Context(), roomID)
	if err != nil {
		response.Fail(c, 404, err.Error())
		return
	}
	response.OK(c, dto)
}

func (h *RoomHandler) Ready(c *gin.Context) {
	var req struct {
		Ready bool `json:"ready"`
	}
	_ = c.ShouldBindJSON(&req)
	dto, err := h.room.Ready(c.Request.Context(), middleware.UserID(c), req.Ready)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, dto)
}

func (h *RoomHandler) Leave(c *gin.Context) {
	var req struct {
		Abort bool `json:"abort"`
	}
	_ = c.ShouldBindJSON(&req)
	if err := h.room.Leave(c.Request.Context(), middleware.UserID(c), req.Abort); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, nil)
}

func (h *RoomHandler) QuickMatch(c *gin.Context) {
	dto, err := h.room.QuickMatch(c.Request.Context(), middleware.UserID(c))
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, dto)
}

func (h *RoomHandler) Start(c *gin.Context) {
	if err := h.room.Start(c.Request.Context(), middleware.UserID(c)); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, nil)
}

func (h *RoomHandler) Records(c *gin.Context) {
	roomID := c.Query("roomId")
	list, err := h.room.GameRecords(roomID, 20)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, list)
}

func (h *RoomHandler) RankList(c *gin.Context) {
	list, err := h.room.RankList(20)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.OK(c, list)
}

func (h *RoomHandler) Health(c *gin.Context) {
	response.OK(c, gin.H{"status": "ok"})
}
