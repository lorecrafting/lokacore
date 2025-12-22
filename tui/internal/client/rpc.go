package client

import (
	"encoding/json"
	"fmt"
)

// Request represents a JSON-RPC 2.0 request.
type Request struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int64       `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// Response represents a JSON-RPC 2.0 response.
type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC 2.0 error.
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Error implements the error interface.
func (e *RPCError) Error() string {
	return fmt.Sprintf("RPC error %d: %s", e.Code, e.Message)
}

// Standard JSON-RPC 2.0 error codes
const (
	ErrCodeParseError     = -32700
	ErrCodeInvalidRequest = -32600
	ErrCodeMethodNotFound = -32601
	ErrCodeInvalidParams  = -32602
	ErrCodeInternalError  = -32603

	// Custom error codes
	ErrCodeNotFound     = -32001
	ErrCodeIncompatible = -32002
)

// Entity represents a game entity (room, NPC, item, exit).
type Entity struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Key         string                 `json:"key"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	LocationID  *string                `json:"location_id"`
	Components  map[string]interface{} `json:"components"`
	Tags        []string               `json:"tags"`
	InsertedAt  string                 `json:"inserted_at"`
	UpdatedAt   string                 `json:"updated_at"`
}

// Room represents a room entity with coordinates.
type Room struct {
	ID          string   `json:"id"`
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	X           int      `json:"x"`
	Y           int      `json:"y"`
	Z           int      `json:"z"`
	Tags        []string `json:"tags"`
}

// Exit represents an exit between rooms.
type Exit struct {
	ID             string `json:"id"`
	Key            string `json:"key"`
	Name           string `json:"name"`
	Direction      string `json:"direction"`
	SourceID       string `json:"source_id"`
	DestinationID  string `json:"destination_id"`
	DestinationKey string `json:"destination_key"`
}

// Script represents a Lua script.
type Script struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Source      string `json:"source"`
	Hook        string `json:"hook"`
	Enabled     bool   `json:"enabled"`
	InsertedAt  string `json:"inserted_at"`
	UpdatedAt   string `json:"updated_at"`
}

// Player represents a player account.
type Player struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	IsAdmin     bool    `json:"is_admin"`
	ConfirmedAt *string `json:"confirmed_at"`
	InsertedAt  string  `json:"inserted_at"`
}

// SystemInfo represents server system information.
type SystemInfo struct {
	Version         string `json:"version"`
	ProtocolVersion string `json:"protocol_version"`
	Node            string `json:"node"`
	UptimeMs        int64  `json:"uptime_ms"`
	Rooms           int    `json:"rooms"`
	NPCs            int    `json:"npcs"`
	Items           int    `json:"items"`
	Exits           int    `json:"exits"`
	Scripts         int    `json:"scripts"`
	Players         int    `json:"players"`
}

// --- Convenience methods ---

// GetSystemInfo retrieves server system information.
func (c *Client) GetSystemInfo() (*SystemInfo, error) {
	result, err := c.Call("system.info", nil)
	if err != nil {
		return nil, err
	}

	var info SystemInfo
	if err := json.Unmarshal(result, &info); err != nil {
		return nil, fmt.Errorf("failed to parse system info: %w", err)
	}
	return &info, nil
}

// ListEntities retrieves entities of the given type with pagination.
func (c *Client) ListEntities(entityType string, limit, offset int) ([]Entity, int, error) {
	params := map[string]interface{}{
		"limit":  limit,
		"offset": offset,
	}
	if entityType != "" {
		params["type"] = entityType
	}

	result, err := c.Call("entities.list", params)
	if err != nil {
		return nil, 0, err
	}

	var resp struct {
		Entities []Entity `json:"entities"`
		Total    int      `json:"total"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse entities: %w", err)
	}
	return resp.Entities, resp.Total, nil
}

// GetEntity retrieves a single entity by ID.
func (c *Client) GetEntity(id string) (*Entity, error) {
	result, err := c.Call("entities.get", map[string]interface{}{
		"id": id,
	})
	if err != nil {
		return nil, err
	}

	var entity Entity
	if err := json.Unmarshal(result, &entity); err != nil {
		return nil, fmt.Errorf("failed to parse entity: %w", err)
	}
	return &entity, nil
}

// UpdateEntity updates an entity's fields.
func (c *Client) UpdateEntity(id string, updates map[string]interface{}) (*Entity, error) {
	params := map[string]interface{}{
		"id": id,
	}
	for k, v := range updates {
		params[k] = v
	}

	result, err := c.Call("entities.update", params)
	if err != nil {
		return nil, err
	}

	var entity Entity
	if err := json.Unmarshal(result, &entity); err != nil {
		return nil, fmt.Errorf("failed to parse entity: %w", err)
	}
	return &entity, nil
}

// DeleteEntity deletes an entity by ID.
func (c *Client) DeleteEntity(id string) error {
	_, err := c.Call("entities.delete", map[string]interface{}{
		"id": id,
	})
	return err
}

// ListRooms retrieves rooms with coordinates.
func (c *Client) ListRooms(limit, offset int) ([]Room, int, error) {
	result, err := c.Call("rooms.list_with_coords", map[string]interface{}{
		"limit":  limit,
		"offset": offset,
	})
	if err != nil {
		return nil, 0, err
	}

	var resp struct {
		Rooms []Room `json:"rooms"`
		Total int    `json:"total"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse rooms: %w", err)
	}
	return resp.Rooms, resp.Total, nil
}

// GetRoom retrieves a single room by ID.
func (c *Client) GetRoom(id string) (*Room, error) {
	result, err := c.Call("rooms.get", map[string]interface{}{
		"id": id,
	})
	if err != nil {
		return nil, err
	}

	var room Room
	if err := json.Unmarshal(result, &room); err != nil {
		return nil, fmt.Errorf("failed to parse room: %w", err)
	}
	return &room, nil
}

// CreateRoom creates a new room at the given coordinates.
func (c *Client) CreateRoom(name, description string, x, y, z int) (*Room, error) {
	result, err := c.Call("rooms.create", map[string]interface{}{
		"name":        name,
		"description": description,
		"x":           x,
		"y":           y,
		"z":           z,
	})
	if err != nil {
		return nil, err
	}

	var room Room
	if err := json.Unmarshal(result, &room); err != nil {
		return nil, fmt.Errorf("failed to parse room: %w", err)
	}
	return &room, nil
}

// CreateExit creates an exit between two rooms.
// If createReturn is true, a return exit is also created.
func (c *Client) CreateExit(sourceID, destID, direction string, createReturn bool) ([]Exit, error) {
	result, err := c.Call("rooms.connect", map[string]interface{}{
		"source_id":      sourceID,
		"destination_id": destID,
		"direction":      direction,
		"create_return":  createReturn,
	})
	if err != nil {
		return nil, err
	}

	// Response can be either {exit: ...} or {exits: [...]}
	var singleResp struct {
		Exit *Exit `json:"exit"`
	}
	if err := json.Unmarshal(result, &singleResp); err == nil && singleResp.Exit != nil {
		return []Exit{*singleResp.Exit}, nil
	}

	var multiResp struct {
		Exits []Exit `json:"exits"`
	}
	if err := json.Unmarshal(result, &multiResp); err != nil {
		return nil, fmt.Errorf("failed to parse exit response: %w", err)
	}
	return multiResp.Exits, nil
}

// ListScripts retrieves all scripts.
func (c *Client) ListScripts(limit, offset int) ([]Script, int, error) {
	result, err := c.Call("scripts.list", map[string]interface{}{
		"limit":  limit,
		"offset": offset,
	})
	if err != nil {
		return nil, 0, err
	}

	var resp struct {
		Scripts []Script `json:"scripts"`
		Total   int      `json:"total"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse scripts: %w", err)
	}
	return resp.Scripts, resp.Total, nil
}

// GetScript retrieves a script by ID.
func (c *Client) GetScript(id string) (*Script, error) {
	result, err := c.Call("scripts.get", map[string]interface{}{
		"id": id,
	})
	if err != nil {
		return nil, err
	}

	var script Script
	if err := json.Unmarshal(result, &script); err != nil {
		return nil, fmt.Errorf("failed to parse script: %w", err)
	}
	return &script, nil
}

// ToggleScript toggles a script's enabled status.
func (c *Client) ToggleScript(id string) (*Script, error) {
	result, err := c.Call("scripts.toggle", map[string]interface{}{
		"id": id,
	})
	if err != nil {
		return nil, err
	}

	var script Script
	if err := json.Unmarshal(result, &script); err != nil {
		return nil, fmt.Errorf("failed to parse script: %w", err)
	}
	return &script, nil
}

// TestScript tests a script by ID and returns the result.
func (c *Client) TestScript(id string) (bool, string, error) {
	result, err := c.Call("scripts.test", map[string]interface{}{
		"id": id,
	})
	if err != nil {
		return false, "", err
	}

	var resp struct {
		Success bool   `json:"success"`
		Result  string `json:"result,omitempty"`
		Error   string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return false, "", fmt.Errorf("failed to parse test result: %w", err)
	}

	if resp.Success {
		return true, resp.Result, nil
	}
	return false, resp.Error, nil
}

// ListPlayers retrieves all players.
func (c *Client) ListPlayers(limit, offset int) ([]Player, int, error) {
	result, err := c.Call("players.list", map[string]interface{}{
		"limit":  limit,
		"offset": offset,
	})
	if err != nil {
		return nil, 0, err
	}

	var resp struct {
		Players []Player `json:"players"`
		Total   int      `json:"total"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse players: %w", err)
	}
	return resp.Players, resp.Total, nil
}

// ToggleAdmin toggles a player's admin status.
func (c *Client) ToggleAdmin(id string) (*Player, error) {
	result, err := c.Call("players.toggle_admin", map[string]interface{}{
		"id": id,
	})
	if err != nil {
		return nil, err
	}

	var player Player
	if err := json.Unmarshal(result, &player); err != nil {
		return nil, fmt.Errorf("failed to parse player: %w", err)
	}
	return &player, nil
}

// ReloadPrototypes reloads all YAML prototypes.
func (c *Client) ReloadPrototypes() (int, error) {
	result, err := c.Call("system.reload_prototypes", nil)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Reloaded bool `json:"reloaded"`
		Count    int  `json:"count"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return 0, fmt.Errorf("failed to parse reload result: %w", err)
	}
	return resp.Count, nil
}

// ExportWorld exports the world to YAML at the given path.
func (c *Client) ExportWorld(path string) error {
	_, err := c.Call("system.export_world", map[string]interface{}{
		"path": path,
	})
	return err
}

// ImportWorldResult contains the stats from a world import.
type ImportWorldResult struct {
	Rooms       int    `json:"rooms"`
	NPCs        int    `json:"npcs"`
	Items       int    `json:"items"`
	Exits       int    `json:"exits"`
	ExitsLinked int    `json:"exits_linked"`
	InputDir    string `json:"input_dir"`
}

// ImportWorld imports world entities from YAML files at the given path.
func (c *Client) ImportWorld(path string, clearExisting bool) (*ImportWorldResult, error) {
	result, err := c.Call("system.import_world", map[string]interface{}{
		"path":           path,
		"clear_existing": clearExisting,
		"link_exits":     true,
	})
	if err != nil {
		return nil, err
	}

	var stats ImportWorldResult
	if err := json.Unmarshal(result, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse import result: %w", err)
	}
	return &stats, nil
}

// Prototype represents a prototype template.
type Prototype struct {
	Key         string   `json:"key"`
	Type        string   `json:"type"`
	Parent      string   `json:"parent"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	IsTemplate  bool     `json:"is_template"`
}

// ListPrototypes retrieves prototypes with optional type filter.
func (c *Client) ListPrototypes(entityType string, limit, offset int) ([]Prototype, int, error) {
	params := map[string]interface{}{
		"limit":  limit,
		"offset": offset,
	}
	if entityType != "" {
		params["type"] = entityType
	}

	result, err := c.Call("prototypes.list", params)
	if err != nil {
		return nil, 0, err
	}

	var resp struct {
		Prototypes []Prototype `json:"prototypes"`
		Total      int         `json:"total"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse prototypes: %w", err)
	}
	return resp.Prototypes, resp.Total, nil
}

// GetPrototype retrieves a prototype by key.
func (c *Client) GetPrototype(key string) (*Prototype, error) {
	result, err := c.Call("prototypes.get", map[string]interface{}{
		"key": key,
	})
	if err != nil {
		return nil, err
	}

	var proto Prototype
	if err := json.Unmarshal(result, &proto); err != nil {
		return nil, fmt.Errorf("failed to parse prototype: %w", err)
	}
	return &proto, nil
}

// SpawnEntity spawns an entity from a prototype at an optional location.
func (c *Client) SpawnEntity(prototypeKey, locationID string) (*Entity, error) {
	params := map[string]interface{}{
		"prototype_key": prototypeKey,
	}
	if locationID != "" {
		params["location_id"] = locationID
	}

	result, err := c.Call("entities.spawn", params)
	if err != nil {
		return nil, err
	}

	var entity Entity
	if err := json.Unmarshal(result, &entity); err != nil {
		return nil, fmt.Errorf("failed to parse entity: %w", err)
	}
	return &entity, nil
}

// ListTemplates retrieves room templates (prototypes with is_template: true).
func (c *Client) ListTemplates(entityType string, limit, offset int) ([]Prototype, int, error) {
	params := map[string]interface{}{
		"limit":  limit,
		"offset": offset,
	}
	if entityType != "" {
		params["type"] = entityType
	}

	result, err := c.Call("prototypes.templates", params)
	if err != nil {
		return nil, 0, err
	}

	var resp struct {
		Prototypes []Prototype `json:"prototypes"`
		Total      int         `json:"total"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse templates: %w", err)
	}
	return resp.Prototypes, resp.Total, nil
}

// SpawnFromTemplate creates a room from a template at the given coordinates.
func (c *Client) SpawnFromTemplate(templateKey string, x, y, z int, name string) (*Room, error) {
	params := map[string]interface{}{
		"template_key": templateKey,
		"x":            x,
		"y":            y,
		"z":            z,
	}
	if name != "" {
		params["name"] = name
	}

	result, err := c.Call("rooms.spawn_from_template", params)
	if err != nil {
		return nil, err
	}

	var room Room
	if err := json.Unmarshal(result, &room); err != nil {
		return nil, fmt.Errorf("failed to parse room: %w", err)
	}
	return &room, nil
}

// GetRoomContents retrieves entities located in a room.
func (c *Client) GetRoomContents(roomID string) ([]Entity, error) {
	// Get all entities and filter by location_id
	// TODO: Add a dedicated server method for this
	entities, _, err := c.ListEntities("", 500, 0)
	if err != nil {
		return nil, err
	}

	var contents []Entity
	for _, e := range entities {
		if e.LocationID != nil && *e.LocationID == roomID {
			contents = append(contents, e)
		}
	}
	return contents, nil
}
