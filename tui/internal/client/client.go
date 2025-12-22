// Package client provides a Unix socket client for communicating with the
// ExMUD TUI server using JSON-RPC 2.0.
package client

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// Client manages a connection to the ExMUD TUI server over a Unix socket.
type Client struct {
	conn          net.Conn
	reader        *bufio.Reader
	writer        *bufio.Writer
	mu            sync.Mutex
	requestID     atomic.Int64
	pending       map[int64]chan *Response
	pendingMu     sync.RWMutex
	notifications chan Notification
	done          chan struct{}
	connected     atomic.Bool
	socketPath    string
}

// Notification represents a server-push notification (no ID field).
type Notification struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params"`
}

// ErrNotConnected is returned when attempting to use a disconnected client.
var ErrNotConnected = errors.New("client not connected")

// ErrTimeout is returned when a request times out.
var ErrTimeout = errors.New("request timeout")

// New creates a new client and connects to the Unix socket at the given path.
func New(socketPath string) (*Client, error) {
	c := &Client{
		socketPath:    socketPath,
		pending:       make(map[int64]chan *Response),
		notifications: make(chan Notification, 100),
		done:          make(chan struct{}),
	}

	if err := c.connect(); err != nil {
		return nil, err
	}

	return c, nil
}

// connect establishes the socket connection.
func (c *Client) connect() error {
	conn, err := net.Dial("unix", c.socketPath)
	if err != nil {
		return fmt.Errorf("failed to connect to socket %s: %w", c.socketPath, err)
	}

	c.conn = conn
	c.reader = bufio.NewReader(conn)
	c.writer = bufio.NewWriter(conn)
	c.connected.Store(true)

	// Start read loop in background
	go c.readLoop()

	return nil
}

// Close closes the connection to the server.
func (c *Client) Close() error {
	if !c.connected.Load() {
		return nil
	}

	c.connected.Store(false)
	close(c.done)

	// Cancel all pending requests
	c.pendingMu.Lock()
	for id, ch := range c.pending {
		close(ch)
		delete(c.pending, id)
	}
	c.pendingMu.Unlock()

	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// IsConnected returns true if the client is connected.
func (c *Client) IsConnected() bool {
	return c.connected.Load()
}

// Notifications returns a channel that receives server-push notifications.
func (c *Client) Notifications() <-chan Notification {
	return c.notifications
}

// readLoop continuously reads from the socket and dispatches responses/notifications.
func (c *Client) readLoop() {
	for {
		select {
		case <-c.done:
			return
		default:
		}

		line, err := c.reader.ReadBytes('\n')
		if err != nil {
			// Connection closed or error
			c.connected.Store(false)
			return
		}

		// Parse the JSON to determine if it's a response or notification
		var msg struct {
			ID     *int64          `json:"id"`
			Result json.RawMessage `json:"result,omitempty"`
			Error  *RPCError       `json:"error,omitempty"`
			Method string          `json:"method,omitempty"`
			Params json.RawMessage `json:"params,omitempty"`
		}

		if err := json.Unmarshal(line, &msg); err != nil {
			// Invalid JSON, skip
			continue
		}

		if msg.ID != nil {
			// This is a response to a request we made
			c.handleResponse(*msg.ID, msg.Result, msg.Error)
		} else if msg.Method != "" {
			// This is a server-push notification
			c.handleNotification(msg.Method, msg.Params)
		}
	}
}

// handleResponse dispatches a response to the waiting caller.
func (c *Client) handleResponse(id int64, result json.RawMessage, rpcErr *RPCError) {
	c.pendingMu.RLock()
	ch, ok := c.pending[id]
	c.pendingMu.RUnlock()

	if !ok {
		// No one waiting for this response
		return
	}

	resp := &Response{
		ID:     id,
		Result: result,
		Error:  rpcErr,
	}

	select {
	case ch <- resp:
	default:
		// Channel full or closed, drop response
	}
}

// handleNotification sends a notification to the notifications channel.
func (c *Client) handleNotification(method string, params json.RawMessage) {
	var paramsMap map[string]interface{}
	if len(params) > 0 {
		json.Unmarshal(params, &paramsMap)
	}

	notification := Notification{
		Method: method,
		Params: paramsMap,
	}

	select {
	case c.notifications <- notification:
	default:
		// Channel full, drop notification
	}
}

// send writes a JSON-RPC request to the socket.
func (c *Client) send(req *Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected.Load() {
		return ErrNotConnected
	}

	data, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	data = append(data, '\n')
	if _, err := c.writer.Write(data); err != nil {
		return fmt.Errorf("failed to write request: %w", err)
	}

	return c.writer.Flush()
}

// Call sends a JSON-RPC request and waits for the response.
// Returns the result as raw JSON, or an error if the call failed.
func (c *Client) Call(method string, params interface{}) (json.RawMessage, error) {
	return c.CallWithTimeout(method, params, 30*time.Second)
}

// CallWithTimeout sends a JSON-RPC request with a custom timeout.
func (c *Client) CallWithTimeout(method string, params interface{}, timeout time.Duration) (json.RawMessage, error) {
	if !c.connected.Load() {
		return nil, ErrNotConnected
	}

	id := c.requestID.Add(1)

	req := &Request{
		JSONRPC: "2.0",
		ID:      id,
		Method:  method,
		Params:  params,
	}

	// Create response channel and register it
	respChan := make(chan *Response, 1)
	c.pendingMu.Lock()
	c.pending[id] = respChan
	c.pendingMu.Unlock()

	// Clean up on exit
	defer func() {
		c.pendingMu.Lock()
		delete(c.pending, id)
		c.pendingMu.Unlock()
	}()

	// Send request
	if err := c.send(req); err != nil {
		return nil, err
	}

	// Wait for response with timeout
	select {
	case resp, ok := <-respChan:
		if !ok {
			return nil, ErrNotConnected
		}
		if resp.Error != nil {
			return nil, resp.Error
		}
		return resp.Result, nil

	case <-time.After(timeout):
		return nil, ErrTimeout

	case <-c.done:
		return nil, ErrNotConnected
	}
}

// Handshake performs the initial protocol handshake with the server.
func (c *Client) Handshake(clientVersion string) error {
	result, err := c.Call("system.handshake", map[string]interface{}{
		"version": clientVersion,
	})
	if err != nil {
		return fmt.Errorf("handshake failed: %w", err)
	}

	var resp struct {
		Version    string `json:"version"`
		Server     string `json:"server"`
		Compatible bool   `json:"compatible"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return fmt.Errorf("failed to parse handshake response: %w", err)
	}

	if !resp.Compatible {
		return fmt.Errorf("incompatible server version: %s", resp.Version)
	}

	return nil
}

// Ping checks if the server is responsive.
func (c *Client) Ping() error {
	_, err := c.CallWithTimeout("system.ping", nil, 5*time.Second)
	return err
}
