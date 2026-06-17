package middleware

import (
	"strings"

	"gdMahjong/server/internal/auth"
	"gdMahjong/server/pkg/response"

	"github.com/gin-gonic/gin"
)

const ContextUserID = "userID"

func Auth(jwtSvc *auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c, "missing token")
			return
		}
		claims, err := jwtSvc.Parse(token)
		if err != nil {
			response.Unauthorized(c, "invalid token")
			return
		}
		c.Set(ContextUserID, claims.UserID)
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return c.Query("token")
}

func UserID(c *gin.Context) uint64 {
	v, _ := c.Get(ContextUserID)
	id, _ := v.(uint64)
	return id
}
