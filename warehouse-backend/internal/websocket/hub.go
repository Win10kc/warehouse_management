package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// ─── Event types ──────────────────────────────────────────────

const (
	EventStockUpdate = "stock_update"
	EventAlert       = "alert"
	EventTransactionUpdate  = "transaction_update"
	EventBinSuggestion = "bin_suggestion"
)

type Message struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

type StockUpdatePayload struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	TotalQty    int    `json:"total_quantity"`
	Delta       int    `json:"delta"` // dương = nhập, âm = xuất
	TxCode      string `json:"tx_code"`
}

type AlertPayload struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	CurrentQty  int    `json:"current_quantity"`
	MinStock    int    `json:"min_stock"`
	Level       string `json:"level"` // "warning" | "critical"
	Message     string `json:"message,omitempty"`
}
// Thêm struct payload:
type TransactionUpdatePayload struct {
    TransactionID   string `json:"transaction_id"`
    TransactionCode string `json:"transaction_code"`
    Status          string `json:"status"`        // "processing" | "done" | "rejected"
    CreatedByID     string `json:"created_by_id"`
}

// ─── Hub ──────────────────────────────────────────────────────

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("[WS] client connected, total=%d", h.count())

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("[WS] client disconnected, total=%d", h.count())

		case msg := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- msg:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Publish gửi event đến tất cả clients
func (h *Hub) Publish(event string, data any) {
	b, err := json.Marshal(Message{Event: event, Data: data})
	if err != nil {
		log.Printf("[WS] marshal error: %v", err)
		return
	}
	h.broadcast <- b
}

func (h *Hub) count() int {
	return len(h.clients)
}

// ─── Client ───────────────────────────────────────────────────

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// ServeWS là gin handler, đăng ký tại GET /ws
func (h *Hub) ServeWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WS] upgrade error: %v", err)
		return
	}
	client := &Client{hub: h, conn: conn, send: make(chan []byte, 256)}
	h.register <- client
	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
}
type BinSuggestionPayload struct {
    TransactionID   string `json:"transaction_id"`
    TransactionCode string `json:"transaction_code"`
    ItemID          string `json:"item_id"`
    ProductName     string `json:"product_name"`
    SuggestedBinID  string `json:"suggested_bin_id"`
    SuggestedBinDisplay string `json:"suggested_bin_display"` // "Kho HN › Khu A › RACK-01 › BIN-03"
    CreatedByID     string `json:"created_by_id"`
}