// Package mapview implements the Map tab for the TUI.
package mapview

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/lokacore/tui/internal/client"
	"github.com/lokacore/tui/internal/components"
)

// Mode represents the current input mode
type Mode int

const (
	ModeNormal Mode = iota
	ModeCreateRoom
	ModeConnect        // Selecting destination room for exit
	ModeConfirmReturn  // Asking whether to create return exit
	ModeConfirmDelete  // Confirming room deletion
	ModeSelectNPC      // Selecting NPC prototype to spawn
	ModeSelectItem     // Selecting item prototype to spawn
	ModeViewContents   // Viewing room contents
	ModeSelectTemplate // Selecting template to place
)

// Constants for rendering
const (
	RoomWidth  = 9  // Width of room box (including borders)
	RoomHeight = 3  // Height of room box
	GridSpaceX = 2  // Horizontal space between rooms
	GridSpaceY = 1  // Vertical space between rooms
	CellWidth  = RoomWidth + GridSpaceX
	CellHeight = RoomHeight + GridSpaceY
)

// Styles for the map tab
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	roomStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240")).
			Width(RoomWidth - 2).
			Height(RoomHeight - 2).
			Align(lipgloss.Center)

	selectedRoomStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("39")).
				Width(RoomWidth - 2).
				Height(RoomHeight - 2).
				Align(lipgloss.Center).
				Bold(true)

	cursorRoomStyle = lipgloss.NewStyle().
			Border(lipgloss.DoubleBorder()).
			BorderForeground(lipgloss.Color("226")).
			Width(RoomWidth - 2).
			Height(RoomHeight - 2).
			Align(lipgloss.Center).
			Bold(true)

	emptyStyle = lipgloss.NewStyle().
			Width(RoomWidth).
			Height(RoomHeight).
			Foreground(lipgloss.Color("238"))

	inspectorStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240")).
			Padding(0, 1)

	inspectorTitleStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("39"))

	inspectorLabelStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("241"))

	inspectorValueStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("229"))

	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			MarginTop(1)

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196"))

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42"))

	coordStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			MarginBottom(1)

	inputStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("39")).
			Padding(0, 1).
			MarginTop(1)

	inputLabelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("39")).
			Bold(true)
)

// KeyMap defines key bindings for the map tab
type KeyMap struct {
	Up           key.Binding
	Down         key.Binding
	Left         key.Binding
	Right        key.Binding
	Select       key.Binding
	Refresh      key.Binding
	ZUp          key.Binding
	ZDown        key.Binding
	NewRoom      key.Binding
	Delete       key.Binding
	Connect      key.Binding
	Cancel       key.Binding
	Confirm      key.Binding
	Yes          key.Binding
	No           key.Binding
	AddNPC       key.Binding
	AddItem      key.Binding
	ViewContents key.Binding
	Templates    key.Binding
	Undo         key.Binding
	Redo         key.Binding
}

var keys = KeyMap{
	Up:           key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "Up")),
	Down:         key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "Down")),
	Left:         key.NewBinding(key.WithKeys("left", "h"), key.WithHelp("←/h", "Left")),
	Right:        key.NewBinding(key.WithKeys("right", "l"), key.WithHelp("→/l", "Right")),
	Select:       key.NewBinding(key.WithKeys("enter"), key.WithHelp("Enter", "Select")),
	Refresh:      key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "Refresh")),
	ZUp:          key.NewBinding(key.WithKeys(">", "."), key.WithHelp(">", "Level Up")),
	ZDown:        key.NewBinding(key.WithKeys("<", ","), key.WithHelp("<", "Level Down")),
	NewRoom:      key.NewBinding(key.WithKeys("n", "+"), key.WithHelp("n", "New Room")),
	Delete:       key.NewBinding(key.WithKeys("d", "backspace"), key.WithHelp("d", "Delete")),
	Connect:      key.NewBinding(key.WithKeys("c"), key.WithHelp("c", "Connect")),
	Cancel:       key.NewBinding(key.WithKeys("esc"), key.WithHelp("Esc", "Cancel")),
	Confirm:      key.NewBinding(key.WithKeys("enter"), key.WithHelp("Enter", "Confirm")),
	Yes:          key.NewBinding(key.WithKeys("y"), key.WithHelp("y", "Yes")),
	No:           key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "No")),
	AddNPC:       key.NewBinding(key.WithKeys("a"), key.WithHelp("a", "Add NPC")),
	AddItem:      key.NewBinding(key.WithKeys("i"), key.WithHelp("i", "Add Item")),
	ViewContents: key.NewBinding(key.WithKeys("v"), key.WithHelp("v", "View Contents")),
	Templates:    key.NewBinding(key.WithKeys("t"), key.WithHelp("t", "Templates")),
	Undo:         key.NewBinding(key.WithKeys("ctrl+z", "u"), key.WithHelp("Ctrl+Z/u", "Undo")),
	Redo:         key.NewBinding(key.WithKeys("ctrl+y", "ctrl+shift+z"), key.WithHelp("Ctrl+Y", "Redo")),
}

// Room represents a room on the map
type Room struct {
	ID          string
	Key         string
	Name        string
	Description string
	X           int
	Y           int
	Z           int
	Tags        []string
}

// UndoActionType represents the type of undoable action
type UndoActionType int

const (
	UndoCreateRoom UndoActionType = iota
	UndoDeleteRoom
	UndoCreateExit
)

// UndoAction represents an undoable operation
type UndoAction struct {
	Type UndoActionType
	Room *Room  // For room operations
	Exit *Exit  // For exit operations
}

// Exit represents an exit for undo purposes
type Exit struct {
	ID          string
	SourceID    string
	DestID      string
	Direction   string
}

// Messages for async operations
type roomsLoadedMsg struct {
	rooms []Room
}

type roomsErrorMsg struct {
	err error
}

type roomCreatedMsg struct {
	room *Room
}

type roomDeletedMsg struct {
	room *Room // Store full room data for undo
}

type actionErrorMsg struct {
	action string
	err    error
}

type exitCreatedMsg struct {
	count int
}

type prototypesLoadedMsg struct {
	prototypes []client.Prototype
	entityType string
}

type roomContentsLoadedMsg struct {
	entities []client.Entity
}

type entitySpawnedMsg struct {
	entity *client.Entity
}

type templatesLoadedMsg struct {
	templates []client.Prototype
}

type templateSpawnedMsg struct {
	room *Room
}

type undoCompletedMsg struct {
	action UndoAction
}

type redoCompletedMsg struct {
	action UndoAction
}

// Model is the Map tab model
type Model struct {
	client     *client.Client
	rooms      []Room
	roomMap    map[string]*Room // key: "x,y,z" -> room
	cursorX    int
	cursorY    int
	cursorZ    int
	viewportX  int // Top-left of viewport
	viewportY  int
	loading    bool
	lastError  error
	lastAction string
	lastResult string
	width      int
	height     int
	gridWidth  int // Visible grid cells horizontally
	gridHeight int // Visible grid cells vertically

	// Input mode
	mode      Mode
	nameInput textinput.Model

	// Connection mode state
	connectSourceRoom *Room // Source room when connecting
	connectDestRoom   *Room // Destination room (after selecting)

	// Delete confirmation dialog
	deleteDialog      *components.Dialog
	deleteRoomPending *Room // Room pending deletion

	// Entity placement
	prototypeSelector *components.Selector
	spawnTargetRoom   *Room // Room to spawn entity in

	// Room contents view
	roomContents       []client.Entity
	roomContentsRoom   *Room
	roomContentsCursor int

	// Template selection
	templateSelector *components.Selector

	// Undo/Redo stacks
	undoStack []UndoAction
	redoStack []UndoAction
}

// New creates a new Map tab model
func New(c *client.Client) Model {
	ti := textinput.New()
	ti.Placeholder = "Room name..."
	ti.CharLimit = 50
	ti.Width = 30

	return Model{
		client:    c,
		roomMap:   make(map[string]*Room),
		loading:   true,
		mode:      ModeNormal,
		nameInput: ti,
	}
}

// Init initializes the tab and fetches rooms
func (m Model) Init() tea.Cmd {
	return m.fetchRooms()
}

// SetSize updates the tab dimensions
func (m *Model) SetSize(width, height int) {
	m.width = width
	m.height = height

	// Calculate grid dimensions (leave room for inspector panel)
	mapWidth := width * 2 / 3 // 2/3 for map, 1/3 for inspector
	m.gridWidth = mapWidth / CellWidth
	m.gridHeight = (height - 6) / CellHeight // Leave room for title, help, and input

	if m.gridWidth < 3 {
		m.gridWidth = 3
	}
	if m.gridHeight < 3 {
		m.gridHeight = 3
	}
}

// Update handles messages
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	var cmd tea.Cmd

	// Handle input modes separately
	switch m.mode {
	case ModeCreateRoom:
		return m.updateCreateMode(msg)
	case ModeConnect:
		return m.updateConnectMode(msg)
	case ModeConfirmReturn:
		return m.updateConfirmReturnMode(msg)
	case ModeConfirmDelete:
		return m.updateConfirmDeleteMode(msg)
	case ModeSelectNPC, ModeSelectItem:
		return m.updateSelectPrototypeMode(msg)
	case ModeViewContents:
		return m.updateViewContentsMode(msg)
	case ModeSelectTemplate:
		return m.updateSelectTemplateMode(msg)
	}

	switch msg := msg.(type) {
	case tea.MouseMsg:
		// Handle mouse clicks on the grid
		if msg.Action == tea.MouseActionPress && msg.Button == tea.MouseButtonLeft {
			// Calculate grid cell from mouse position
			// Account for title (1 line) + coords (1 line) + margin
			gridOffsetY := 3 // lines before grid starts
			gridOffsetX := 0 // grid starts at left edge

			// Check if click is within grid area
			if msg.Y >= gridOffsetY && msg.X >= gridOffsetX {
				// Calculate which cell was clicked
				cellX := (msg.X - gridOffsetX) / CellWidth
				cellY := (msg.Y - gridOffsetY) / CellHeight

				// Convert to world coordinates
				worldX := m.viewportX + cellX
				worldY := m.viewportY + cellY

				// Check if within visible grid bounds
				if cellX < m.gridWidth && cellY < m.gridHeight {
					m.cursorX = worldX
					m.cursorY = worldY
					m.adjustViewport()
				}
			}
		}
		return m, nil

	case tea.KeyMsg:
		// Clear last action message on any key
		m.lastAction = ""
		m.lastResult = ""

		switch {
		case key.Matches(msg, keys.Up):
			m.cursorY--
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.Down):
			m.cursorY++
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.Left):
			m.cursorX--
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.Right):
			m.cursorX++
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.ZUp):
			m.cursorZ++
			return m, nil

		case key.Matches(msg, keys.ZDown):
			m.cursorZ--
			return m, nil

		case key.Matches(msg, keys.Refresh):
			m.loading = true
			return m, m.fetchRooms()

		case key.Matches(msg, keys.NewRoom):
			// Only create if cell is empty
			if m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ) == nil {
				m.mode = ModeCreateRoom
				m.nameInput.Reset()
				m.nameInput.Focus()
				return m, textinput.Blink
			}
			return m, nil

		case key.Matches(msg, keys.Delete):
			room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if room != nil {
				// Show delete confirmation dialog
				m.mode = ModeConfirmDelete
				m.deleteRoomPending = room
				m.deleteDialog = components.NewDangerDialog(
					"Delete Room",
					fmt.Sprintf("Are you sure you want to delete %q?\n\nThis action cannot be undone.", room.Name),
					"Delete",
				)
				m.deleteDialog.SetSize(m.width, m.height)
			}
			return m, nil

		case key.Matches(msg, keys.Connect):
			// Start connection mode if cursor is on a room
			room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if room != nil {
				m.mode = ModeConnect
				m.connectSourceRoom = room
				m.connectDestRoom = nil
			}
			return m, nil

		case key.Matches(msg, keys.AddNPC):
			// Open NPC prototype selector if cursor is on a room
			room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if room != nil {
				m.spawnTargetRoom = room
				return m, m.loadPrototypes("npc")
			}
			return m, nil

		case key.Matches(msg, keys.AddItem):
			// Open item prototype selector if cursor is on a room
			room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if room != nil {
				m.spawnTargetRoom = room
				return m, m.loadPrototypes("item")
			}
			return m, nil

		case key.Matches(msg, keys.ViewContents):
			// View room contents if cursor is on a room
			room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if room != nil {
				m.roomContentsRoom = room
				m.roomContentsCursor = 0
				return m, m.loadRoomContents(room.ID)
			}
			return m, nil

		case key.Matches(msg, keys.Templates):
			// Open template browser if cell is empty
			if m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ) == nil {
				return m, m.loadTemplates()
			}
			return m, nil

		case key.Matches(msg, keys.Undo):
			if len(m.undoStack) > 0 {
				return m, m.performUndo()
			}
			return m, nil

		case key.Matches(msg, keys.Redo):
			if len(m.redoStack) > 0 {
				return m, m.performRedo()
			}
			return m, nil
		}

	case roomsLoadedMsg:
		m.loading = false
		m.lastError = nil
		m.rooms = msg.rooms
		m.buildRoomMap()
		return m, nil

	case roomsErrorMsg:
		m.loading = false
		m.lastError = msg.err
		return m, nil

	case roomCreatedMsg:
		m.lastAction = "Created"
		m.lastResult = msg.room.Name
		// Push to undo stack (undo = delete this room)
		m.undoStack = append(m.undoStack, UndoAction{
			Type: UndoCreateRoom,
			Room: msg.room,
		})
		// Clear redo stack on new action
		m.redoStack = nil
		// Refresh to show new room
		return m, m.fetchRooms()

	case roomDeletedMsg:
		m.lastAction = "Deleted"
		m.lastResult = msg.room.Name
		// Push to undo stack (undo = recreate this room)
		m.undoStack = append(m.undoStack, UndoAction{
			Type: UndoDeleteRoom,
			Room: msg.room,
		})
		// Clear redo stack on new action
		m.redoStack = nil
		return m, m.fetchRooms()

	case exitCreatedMsg:
		if msg.count == 1 {
			m.lastAction = "Created"
			m.lastResult = "exit"
		} else {
			m.lastAction = "Created"
			m.lastResult = fmt.Sprintf("%d exits", msg.count)
		}
		return m, m.fetchRooms()

	case actionErrorMsg:
		m.lastAction = msg.action
		m.lastResult = msg.err.Error()
		m.lastError = msg.err
		return m, nil

	case prototypesLoadedMsg:
		// Create selector from prototypes
		var items []components.SelectorItem
		for _, p := range msg.prototypes {
			items = append(items, components.SelectorItem{
				Key:         p.Key,
				Name:        p.Name,
				Description: p.Description,
				Type:        p.Type,
				Tags:        p.Tags,
			})
		}
		title := "Select NPC"
		if msg.entityType == "item" {
			title = "Select Item"
			m.mode = ModeSelectItem
		} else {
			m.mode = ModeSelectNPC
		}
		m.prototypeSelector = components.NewSelector(title, items)
		m.prototypeSelector.SetSize(m.width, m.height)
		return m, nil

	case roomContentsLoadedMsg:
		m.roomContents = msg.entities
		m.mode = ModeViewContents
		return m, nil

	case entitySpawnedMsg:
		m.lastAction = "Spawned"
		m.lastResult = msg.entity.Name
		m.mode = ModeNormal
		m.prototypeSelector = nil
		m.spawnTargetRoom = nil
		return m, nil

	case templatesLoadedMsg:
		// Create selector from templates
		var items []components.SelectorItem
		for _, t := range msg.templates {
			items = append(items, components.SelectorItem{
				Key:         t.Key,
				Name:        t.Name,
				Description: t.Description,
				Type:        t.Type,
				Tags:        t.Tags,
			})
		}
		m.templateSelector = components.NewSelector("Select Template", items)
		m.templateSelector.SetSize(m.width, m.height)
		m.mode = ModeSelectTemplate
		return m, nil

	case templateSpawnedMsg:
		m.lastAction = "Created from template"
		m.lastResult = msg.room.Name
		// Push to undo stack (undo = delete this room)
		m.undoStack = append(m.undoStack, UndoAction{
			Type: UndoCreateRoom,
			Room: msg.room,
		})
		// Clear redo stack on new action
		m.redoStack = nil
		m.mode = ModeNormal
		m.templateSelector = nil
		return m, m.fetchRooms()

	case undoCompletedMsg:
		// Pop from undo stack, push to redo stack
		if len(m.undoStack) > 0 {
			m.redoStack = append(m.redoStack, m.undoStack[len(m.undoStack)-1])
			m.undoStack = m.undoStack[:len(m.undoStack)-1]
		}
		switch msg.action.Type {
		case UndoCreateRoom:
			m.lastAction = "Undo create"
			m.lastResult = msg.action.Room.Name
		case UndoDeleteRoom:
			m.lastAction = "Undo delete"
			m.lastResult = msg.action.Room.Name
		}
		return m, m.fetchRooms()

	case redoCompletedMsg:
		// Pop from redo stack, push to undo stack
		if len(m.redoStack) > 0 {
			m.undoStack = append(m.undoStack, m.redoStack[len(m.redoStack)-1])
			m.redoStack = m.redoStack[:len(m.redoStack)-1]
		}
		switch msg.action.Type {
		case UndoCreateRoom:
			m.lastAction = "Redo create"
			m.lastResult = msg.action.Room.Name
		case UndoDeleteRoom:
			m.lastAction = "Redo delete"
			m.lastResult = msg.action.Room.Name
		}
		return m, m.fetchRooms()
	}

	return m, cmd
}

func (m Model) updateCreateMode(msg tea.Msg) (Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Cancel):
			m.mode = ModeNormal
			m.nameInput.Blur()
			return m, nil

		case key.Matches(msg, keys.Confirm):
			name := strings.TrimSpace(m.nameInput.Value())
			if name != "" {
				m.mode = ModeNormal
				m.nameInput.Blur()
				return m, m.createRoom(name)
			}
			return m, nil
		}
	}

	// Forward to text input
	m.nameInput, cmd = m.nameInput.Update(msg)
	return m, cmd
}

func (m Model) updateConnectMode(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Cancel):
			m.mode = ModeNormal
			m.connectSourceRoom = nil
			return m, nil

		case key.Matches(msg, keys.Up):
			m.cursorY--
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.Down):
			m.cursorY++
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.Left):
			m.cursorX--
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.Right):
			m.cursorX++
			m.adjustViewport()
			return m, nil

		case key.Matches(msg, keys.ZUp):
			m.cursorZ++
			return m, nil

		case key.Matches(msg, keys.ZDown):
			m.cursorZ--
			return m, nil

		case key.Matches(msg, keys.Confirm):
			// Select destination room
			destRoom := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if destRoom != nil && destRoom.ID != m.connectSourceRoom.ID {
				m.connectDestRoom = destRoom
				m.mode = ModeConfirmReturn
			}
			return m, nil
		}
	}

	return m, nil
}

func (m Model) updateConfirmReturnMode(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Cancel):
			m.mode = ModeNormal
			m.connectSourceRoom = nil
			m.connectDestRoom = nil
			return m, nil

		case key.Matches(msg, keys.Yes):
			// Create exit with return
			m.mode = ModeNormal
			src := m.connectSourceRoom
			dst := m.connectDestRoom
			m.connectSourceRoom = nil
			m.connectDestRoom = nil
			return m, m.createExit(src, dst, true)

		case key.Matches(msg, keys.No):
			// Create exit without return
			m.mode = ModeNormal
			src := m.connectSourceRoom
			dst := m.connectDestRoom
			m.connectSourceRoom = nil
			m.connectDestRoom = nil
			return m, m.createExit(src, dst, false)
		}
	}

	return m, nil
}

func (m Model) updateConfirmDeleteMode(msg tea.Msg) (Model, tea.Cmd) {
	if m.deleteDialog == nil {
		m.mode = ModeNormal
		return m, nil
	}

	closed, confirmed := m.deleteDialog.Update(msg)
	if closed {
		if confirmed && m.deleteRoomPending != nil {
			// Proceed with deletion
			room := m.deleteRoomPending
			m.deleteRoomPending = nil
			m.deleteDialog = nil
			m.mode = ModeNormal
			return m, m.deleteRoom(room)
		}
		// Cancelled
		m.deleteRoomPending = nil
		m.deleteDialog = nil
		m.mode = ModeNormal
	}

	return m, nil
}

func (m Model) updateSelectPrototypeMode(msg tea.Msg) (Model, tea.Cmd) {
	if m.prototypeSelector == nil {
		m.mode = ModeNormal
		return m, nil
	}

	closed, selected, item := m.prototypeSelector.Update(msg)
	if closed {
		if selected && item != nil && m.spawnTargetRoom != nil {
			// Spawn the entity in the room
			room := m.spawnTargetRoom
			m.prototypeSelector = nil
			m.spawnTargetRoom = nil
			m.mode = ModeNormal
			return m, m.spawnEntity(item.Key, room.ID)
		}
		// Cancelled
		m.prototypeSelector = nil
		m.spawnTargetRoom = nil
		m.mode = ModeNormal
	}

	return m, nil
}

func (m Model) updateViewContentsMode(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Cancel):
			m.mode = ModeNormal
			m.roomContentsRoom = nil
			m.roomContents = nil
			return m, nil

		case key.Matches(msg, keys.Up):
			if m.roomContentsCursor > 0 {
				m.roomContentsCursor--
			}
			return m, nil

		case key.Matches(msg, keys.Down):
			if m.roomContentsCursor < len(m.roomContents)-1 {
				m.roomContentsCursor++
			}
			return m, nil
		}
	}

	return m, nil
}

func (m Model) updateSelectTemplateMode(msg tea.Msg) (Model, tea.Cmd) {
	if m.templateSelector == nil {
		m.mode = ModeNormal
		return m, nil
	}

	closed, selected, item := m.templateSelector.Update(msg)
	if closed {
		if selected && item != nil {
			// Spawn room from template at cursor position
			templateKey := item.Key
			m.templateSelector = nil
			m.mode = ModeNormal
			return m, m.spawnFromTemplate(templateKey)
		}
		// Cancelled
		m.templateSelector = nil
		m.mode = ModeNormal
	}

	return m, nil
}

func (m *Model) buildRoomMap() {
	m.roomMap = make(map[string]*Room)
	for i := range m.rooms {
		room := &m.rooms[i]
		key := fmt.Sprintf("%d,%d,%d", room.X, room.Y, room.Z)
		m.roomMap[key] = room
	}
}

func (m *Model) adjustViewport() {
	// Pan viewport when cursor reaches edge
	margin := 1

	// Horizontal
	if m.cursorX < m.viewportX+margin {
		m.viewportX = m.cursorX - margin
	}
	if m.cursorX >= m.viewportX+m.gridWidth-margin {
		m.viewportX = m.cursorX - m.gridWidth + margin + 1
	}

	// Vertical
	if m.cursorY < m.viewportY+margin {
		m.viewportY = m.cursorY - margin
	}
	if m.cursorY >= m.viewportY+m.gridHeight-margin {
		m.viewportY = m.cursorY - m.gridHeight + margin + 1
	}
}

func (m Model) getRoomAt(x, y, z int) *Room {
	key := fmt.Sprintf("%d,%d,%d", x, y, z)
	return m.roomMap[key]
}

// View renders the Map tab
func (m Model) View() string {
	if m.loading && len(m.rooms) == 0 {
		return titleStyle.Render("Map") + "\n\n  Loading..."
	}

	if m.lastError != nil && len(m.rooms) == 0 {
		return titleStyle.Render("Map") + "\n\n" +
			errorStyle.Render(fmt.Sprintf("  Error: %s", m.lastError.Error()))
	}

	// Title with room count
	title := fmt.Sprintf("Map (%d rooms)", len(m.rooms))

	// Coordinates indicator
	coords := fmt.Sprintf("Cursor: (%d, %d, Z=%d)", m.cursorX, m.cursorY, m.cursorZ)

	// Render grid
	grid := m.renderGrid()

	// Render inspector
	inspector := m.renderInspector()

	// Combine grid and inspector side by side
	mapWidth := m.width * 2 / 3
	inspectorWidth := m.width - mapWidth - 2

	gridStyled := lipgloss.NewStyle().Width(mapWidth).Render(grid)
	inspectorStyled := lipgloss.NewStyle().Width(inspectorWidth).Render(inspector)

	content := lipgloss.JoinHorizontal(lipgloss.Top, gridStyled, inspectorStyled)

	// Action result
	var actionLine string
	if m.lastAction != "" {
		if m.lastError != nil {
			actionLine = errorStyle.Render(fmt.Sprintf("  ✗ %s: %s", m.lastAction, m.lastResult))
		} else {
			actionLine = successStyle.Render(fmt.Sprintf("  ✓ %s: %s", m.lastAction, m.lastResult))
		}
	}

	// Input overlay for various modes
	var inputSection string
	switch m.mode {
	case ModeCreateRoom:
		inputSection = inputStyle.Render(
			inputLabelStyle.Render("New Room Name: ") + m.nameInput.View() +
				"\n" + helpStyle.Render("Enter: Create  Esc: Cancel"),
		)
	case ModeConnect:
		srcName := m.connectSourceRoom.Name
		if len(srcName) > 20 {
			srcName = srcName[:17] + "..."
		}
		inputSection = inputStyle.Render(
			inputLabelStyle.Render(fmt.Sprintf("Connecting from: %s", srcName)) +
				"\n" + helpStyle.Render("Move to destination, Enter: Select  Esc: Cancel"),
		)
	case ModeConfirmReturn:
		srcName := m.connectSourceRoom.Name
		dstName := m.connectDestRoom.Name
		if len(srcName) > 15 {
			srcName = srcName[:12] + "..."
		}
		if len(dstName) > 15 {
			dstName = dstName[:12] + "..."
		}
		direction := inferDirection(
			m.connectSourceRoom.X, m.connectSourceRoom.Y, m.connectSourceRoom.Z,
			m.connectDestRoom.X, m.connectDestRoom.Y, m.connectDestRoom.Z,
		)
		inputSection = inputStyle.Render(
			inputLabelStyle.Render(fmt.Sprintf("Create exit: %s → %s (%s)", srcName, dstName, direction)) +
				"\n" + helpStyle.Render("Create return exit? [Y]es  [N]o  Esc: Cancel"),
		)
	case ModeViewContents:
		inputSection = m.renderContentsView()
	}

	// Help
	var help string
	if m.mode == ModeNormal {
		help = "  ←↑↓→:Move  </>:Level  n:New  t:Template  d:Delete  c:Connect  u:Undo  Ctrl+Y:Redo  r:Refresh"
	}

	parts := []string{
		titleStyle.Render(title),
		coordStyle.Render(coords),
		content,
	}
	if actionLine != "" {
		parts = append(parts, actionLine)
	}
	if inputSection != "" {
		parts = append(parts, inputSection)
	}
	if help != "" {
		parts = append(parts, helpStyle.Render(help))
	}

	result := lipgloss.JoinVertical(lipgloss.Left, parts...)

	// Render delete confirmation dialog as overlay
	if m.mode == ModeConfirmDelete && m.deleteDialog != nil {
		return m.deleteDialog.ViewOverlay(result, m.width, m.height)
	}

	// Render prototype selector as overlay
	if (m.mode == ModeSelectNPC || m.mode == ModeSelectItem) && m.prototypeSelector != nil {
		return m.prototypeSelector.ViewOverlay(result, m.width, m.height)
	}

	// Render template selector as overlay
	if m.mode == ModeSelectTemplate && m.templateSelector != nil {
		return m.templateSelector.ViewOverlay(result, m.width, m.height)
	}

	return result
}

func (m Model) renderGrid() string {
	var lines []string

	for row := 0; row < m.gridHeight; row++ {
		var rowParts []string
		worldY := m.viewportY + row

		for col := 0; col < m.gridWidth; col++ {
			worldX := m.viewportX + col
			room := m.getRoomAt(worldX, worldY, m.cursorZ)

			isCursor := worldX == m.cursorX && worldY == m.cursorY

			if room != nil {
				rowParts = append(rowParts, m.renderRoomBox(room, isCursor))
			} else {
				rowParts = append(rowParts, m.renderEmptyCell(isCursor))
			}
		}

		lines = append(lines, lipgloss.JoinHorizontal(lipgloss.Top, rowParts...))
	}

	return strings.Join(lines, "\n")
}

func (m Model) renderRoomBox(room *Room, isCursor bool) string {
	// Abbreviate room key to fit
	label := abbreviate(room.Key, RoomWidth-4)

	var style lipgloss.Style
	if isCursor {
		style = cursorRoomStyle
	} else if m.mode == ModeConnect && m.connectSourceRoom != nil && room.ID == m.connectSourceRoom.ID {
		// Highlight source room in connect mode
		style = selectedRoomStyle
	} else {
		style = roomStyle
	}

	return style.Render(label)
}

func (m Model) renderEmptyCell(isCursor bool) string {
	if isCursor {
		// Show cursor position even on empty cells
		marker := "·"
		if m.mode == ModeCreateRoom {
			marker = "+"
		}
		return lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("238")).
			Width(RoomWidth - 2).
			Height(RoomHeight - 2).
			Align(lipgloss.Center).
			Foreground(lipgloss.Color("238")).
			Render(marker)
	}

	// Empty cell
	return lipgloss.NewStyle().
		Width(RoomWidth).
		Height(RoomHeight).
		Render("")
}

func (m Model) renderInspector() string {
	room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)

	var content strings.Builder
	content.WriteString(inspectorTitleStyle.Render("Inspector") + "\n\n")

	if room == nil {
		content.WriteString(inspectorLabelStyle.Render("  Empty cell\n"))
		content.WriteString(inspectorLabelStyle.Render(fmt.Sprintf("  Position: (%d, %d, %d)\n", m.cursorX, m.cursorY, m.cursorZ)))
		content.WriteString("\n")
		content.WriteString(inspectorLabelStyle.Render("  Press 'n' to create room"))
		return inspectorStyle.Width(m.width/3 - 4).Render(content.String())
	}

	// Room details
	content.WriteString(inspectorLabelStyle.Render("  Key: "))
	content.WriteString(inspectorValueStyle.Render(room.Key) + "\n")

	content.WriteString(inspectorLabelStyle.Render("  Name: "))
	content.WriteString(inspectorValueStyle.Render(room.Name) + "\n")

	content.WriteString(inspectorLabelStyle.Render("  Coords: "))
	content.WriteString(inspectorValueStyle.Render(fmt.Sprintf("(%d, %d, %d)", room.X, room.Y, room.Z)) + "\n")

	if len(room.Tags) > 0 {
		content.WriteString(inspectorLabelStyle.Render("  Tags: "))
		content.WriteString(inspectorValueStyle.Render(strings.Join(room.Tags, ", ")) + "\n")
	}

	if room.Description != "" {
		content.WriteString("\n")
		content.WriteString(inspectorLabelStyle.Render("  Description:\n"))
		// Wrap description
		desc := room.Description
		if len(desc) > 100 {
			desc = desc[:97] + "..."
		}
		content.WriteString(inspectorValueStyle.Render("  " + desc) + "\n")
	}

	content.WriteString("\n")
	content.WriteString(inspectorLabelStyle.Render("  Press 'd' to delete"))

	return inspectorStyle.Width(m.width/3 - 4).Render(content.String())
}

func (m Model) renderContentsView() string {
	var content strings.Builder

	if m.roomContentsRoom == nil {
		return ""
	}

	content.WriteString(inputLabelStyle.Render(fmt.Sprintf("Contents of: %s", m.roomContentsRoom.Name)))
	content.WriteString("\n\n")

	if len(m.roomContents) == 0 {
		content.WriteString(inspectorLabelStyle.Render("  (empty room)"))
	} else {
		for i, entity := range m.roomContents {
			prefix := "  "
			if i == m.roomContentsCursor {
				prefix = "> "
				content.WriteString(selectedRoomStyle.Foreground(lipgloss.Color("229")).Render(prefix + entity.Name))
			} else {
				content.WriteString(inspectorValueStyle.Render(prefix + entity.Name))
			}
			content.WriteString(" ")
			content.WriteString(inspectorLabelStyle.Render(fmt.Sprintf("[%s]", entity.Type)))
			content.WriteString("\n")
		}
	}

	content.WriteString("\n")
	content.WriteString(helpStyle.Render("  ↑/↓: Navigate  Esc: Close"))

	return inputStyle.Render(content.String())
}

// Async commands

func (m Model) fetchRooms() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return roomsErrorMsg{err: fmt.Errorf("not connected")}
		}

		rooms, _, err := m.client.ListRooms(500, 0) // Get more rooms for map
		if err != nil {
			return roomsErrorMsg{err: err}
		}

		result := make([]Room, len(rooms))
		for i, r := range rooms {
			result[i] = Room{
				ID:          r.ID,
				Key:         r.Key,
				Name:        r.Name,
				Description: r.Description,
				X:           r.X,
				Y:           r.Y,
				Z:           r.Z,
				Tags:        r.Tags,
			}
		}

		return roomsLoadedMsg{rooms: result}
	}
}

func (m Model) createRoom(name string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Create", err: fmt.Errorf("not connected")}
		}

		room, err := m.client.CreateRoom(name, "", m.cursorX, m.cursorY, m.cursorZ)
		if err != nil {
			return actionErrorMsg{action: "Create", err: err}
		}

		return roomCreatedMsg{
			room: &Room{
				ID:   room.ID,
				Key:  room.Key,
				Name: room.Name,
				X:    room.X,
				Y:    room.Y,
				Z:    room.Z,
			},
		}
	}
}

func (m Model) deleteRoom(room *Room) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Delete", err: fmt.Errorf("not connected")}
		}

		err := m.client.DeleteEntity(room.ID)
		if err != nil {
			return actionErrorMsg{action: "Delete", err: err}
		}

		return roomDeletedMsg{room: room}
	}
}

func (m Model) createExit(source, dest *Room, createReturn bool) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Connect", err: fmt.Errorf("not connected")}
		}

		// Infer direction from relative positions
		direction := inferDirection(source.X, source.Y, source.Z, dest.X, dest.Y, dest.Z)

		exits, err := m.client.CreateExit(source.ID, dest.ID, direction, createReturn)
		if err != nil {
			return actionErrorMsg{action: "Connect", err: err}
		}

		return exitCreatedMsg{count: len(exits)}
	}
}

func (m Model) loadPrototypes(entityType string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Load Prototypes", err: fmt.Errorf("not connected")}
		}

		prototypes, _, err := m.client.ListPrototypes(entityType, 100, 0)
		if err != nil {
			return actionErrorMsg{action: "Load Prototypes", err: err}
		}

		return prototypesLoadedMsg{prototypes: prototypes, entityType: entityType}
	}
}

func (m Model) loadRoomContents(roomID string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Load Contents", err: fmt.Errorf("not connected")}
		}

		contents, err := m.client.GetRoomContents(roomID)
		if err != nil {
			return actionErrorMsg{action: "Load Contents", err: err}
		}

		return roomContentsLoadedMsg{entities: contents}
	}
}

func (m Model) spawnEntity(prototypeKey, roomID string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Spawn", err: fmt.Errorf("not connected")}
		}

		entity, err := m.client.SpawnEntity(prototypeKey, roomID)
		if err != nil {
			return actionErrorMsg{action: "Spawn", err: err}
		}

		return entitySpawnedMsg{entity: entity}
	}
}

func (m Model) loadTemplates() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Load Templates", err: fmt.Errorf("not connected")}
		}

		templates, _, err := m.client.ListTemplates("room", 100, 0)
		if err != nil {
			return actionErrorMsg{action: "Load Templates", err: err}
		}

		return templatesLoadedMsg{templates: templates}
	}
}

func (m Model) spawnFromTemplate(templateKey string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Spawn Template", err: fmt.Errorf("not connected")}
		}

		room, err := m.client.SpawnFromTemplate(templateKey, m.cursorX, m.cursorY, m.cursorZ, "")
		if err != nil {
			return actionErrorMsg{action: "Spawn Template", err: err}
		}

		return templateSpawnedMsg{
			room: &Room{
				ID:   room.ID,
				Key:  room.Key,
				Name: room.Name,
				X:    room.X,
				Y:    room.Y,
				Z:    room.Z,
			},
		}
	}
}

func (m Model) performUndo() tea.Cmd {
	return func() tea.Msg {
		if len(m.undoStack) == 0 {
			return nil
		}

		action := m.undoStack[len(m.undoStack)-1]

		if m.client == nil {
			return actionErrorMsg{action: "Undo", err: fmt.Errorf("not connected")}
		}

		switch action.Type {
		case UndoCreateRoom:
			// Undo room creation = delete the room
			err := m.client.DeleteEntity(action.Room.ID)
			if err != nil {
				return actionErrorMsg{action: "Undo", err: err}
			}
			return undoCompletedMsg{action: action}

		case UndoDeleteRoom:
			// Undo room deletion = recreate the room at same position
			_, err := m.client.CreateRoom(action.Room.Name, action.Room.Description,
				action.Room.X, action.Room.Y, action.Room.Z)
			if err != nil {
				return actionErrorMsg{action: "Undo", err: err}
			}
			return undoCompletedMsg{action: action}
		}

		return nil
	}
}

func (m Model) performRedo() tea.Cmd {
	return func() tea.Msg {
		if len(m.redoStack) == 0 {
			return nil
		}

		action := m.redoStack[len(m.redoStack)-1]

		if m.client == nil {
			return actionErrorMsg{action: "Redo", err: fmt.Errorf("not connected")}
		}

		switch action.Type {
		case UndoCreateRoom:
			// Redo room creation = recreate the room
			_, err := m.client.CreateRoom(action.Room.Name, action.Room.Description,
				action.Room.X, action.Room.Y, action.Room.Z)
			if err != nil {
				return actionErrorMsg{action: "Redo", err: err}
			}
			return redoCompletedMsg{action: action}

		case UndoDeleteRoom:
			// Redo room deletion = delete the room again
			// Note: The room ID might have changed if it was recreated
			// We need to find the room by coordinates
			room := m.getRoomAt(action.Room.X, action.Room.Y, action.Room.Z)
			if room == nil {
				return actionErrorMsg{action: "Redo", err: fmt.Errorf("room not found at coordinates")}
			}
			err := m.client.DeleteEntity(room.ID)
			if err != nil {
				return actionErrorMsg{action: "Redo", err: err}
			}
			return redoCompletedMsg{action: action}
		}

		return nil
	}
}

// inferDirection determines the exit direction from source to destination based on coordinates
func inferDirection(srcX, srcY, srcZ, dstX, dstY, dstZ int) string {
	dx := dstX - srcX
	dy := dstY - srcY
	dz := dstZ - srcZ

	// Check Z first (up/down takes priority)
	if dz > 0 {
		return "up"
	}
	if dz < 0 {
		return "down"
	}

	// Determine cardinal/ordinal direction from X/Y
	// Note: In our coordinate system, positive Y is typically south (down on screen)
	// and positive X is east (right on screen)

	// Pure cardinal directions
	if dx == 0 && dy < 0 {
		return "north"
	}
	if dx == 0 && dy > 0 {
		return "south"
	}
	if dx > 0 && dy == 0 {
		return "east"
	}
	if dx < 0 && dy == 0 {
		return "west"
	}

	// Ordinal directions (diagonal)
	if dx > 0 && dy < 0 {
		return "northeast"
	}
	if dx > 0 && dy > 0 {
		return "southeast"
	}
	if dx < 0 && dy < 0 {
		return "northwest"
	}
	if dx < 0 && dy > 0 {
		return "southwest"
	}

	// Same location (shouldn't happen)
	return "out"
}

// Helper functions

func abbreviate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-2] + ".."
}

// ShortHelp returns the short help text
func (m Model) ShortHelp() string {
	return "←↑↓→:Move  </>:Level  n:New  t:Template  d:Delete  c:Connect  u:Undo  Ctrl+Y:Redo  r:Refresh"
}
