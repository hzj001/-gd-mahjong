package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"gdMahjong/server/internal/auth"
	"gdMahjong/server/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Hub struct {
	mu      sync.RWMutex
	clients map[uint64]*Client // userID -> client
	rooms   *service.RoomManager
	jwt     *auth.JWTService
}

func NewHub(rm *service.RoomManager, jwt *auth.JWTService) *Hub {
	return &Hub{
		clients: map[uint64]*Client{},
		rooms:   rm,
		jwt:     jwt,
	}
}

func (h *Hub) HandleWS(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		token = c.GetHeader("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
	}
	claims, err := h.jwt.Parse(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "invalid token"})
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("ws upgrade:", err)
		return
	}
	client := &Client{
		hub:    h,
		conn:   conn,
		userID: claims.UserID,
		send:   make(chan []byte, 64),
	}
	h.register(client)
	go client.writePump()
	go client.readPump()
}

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	if old, ok := h.clients[c.userID]; ok {
		old.conn.Close()
	}
	h.clients[c.userID] = c
	h.mu.Unlock()
	h.rooms.BindUser(c.userID, c)
}

func (h *Hub) unregister(c *Client) {
	h.mu.Lock()
	if cur, ok := h.clients[c.userID]; ok && cur == c {
		delete(h.clients, c.userID)
	}
	h.mu.Unlock()
	h.rooms.UnbindUser(c.userID)
}

func (h *Hub) SendToUser(userID uint64, msg interface{}) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	c, ok := h.clients[userID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	select {
	case c.send <- b:
	default:
	}
}

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	userID uint64
	send   chan []byte
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister(c)
		c.conn.Close()
	}()
	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		var req map[string]interface{}
		if err := json.Unmarshal(data, &req); err != nil {
			continue
		}
		action, _ := req["action"].(string)
		tile, _ := req["tile"].(string)
		c.hub.rooms.HandleAction(c.userID, action, tile)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) Send(msg interface{}) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- b:
	default:
	}
}
