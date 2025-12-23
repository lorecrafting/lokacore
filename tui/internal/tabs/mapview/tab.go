// Package mapview implements the Map tab for the TUI.
package mapview

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textarea"
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
	ModeSelectTemplate // Selecting template to place
	ModeEntityDetail   // Viewing/editing entity details
)

// Constants for rendering
const (
	RoomWidth  = 5  // Width of room box (including borders) - square appearance
	RoomHeight = 3  // Height of room box (including borders)
	GridSpaceX = 3  // Horizontal space between rooms (for exit lines)
	GridSpaceY = 1  // Vertical space between rooms (for exit lines)
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

	emptyCursorStyle = lipgloss.NewStyle().
				Border(lipgloss.NormalBorder()).
				BorderForeground(lipgloss.Color("238")).
				Width(RoomWidth - 2).
				Height(RoomHeight - 2).
				Align(lipgloss.Center).
				Foreground(lipgloss.Color("238"))

	emptyStyle = lipgloss.NewStyle().
			Width(RoomWidth).
			Height(RoomHeight).
			Foreground(lipgloss.Color("238"))

	// Exit line styles
	exitLineStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("240"))

	// Online player indicator style (green dot)
	onlinePlayerStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("42"))

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

	inspectorSelectedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("229")).
				Background(lipgloss.Color("24")).
				Bold(true)

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
	Exits       []RoomExit // Exits from this room
}

// RoomExit represents an exit from a room
type RoomExit struct {
	Direction     string
	DestinationID string
	DestX         int // Destination coordinates (for drawing lines)
	DestY         int
	DestZ         int
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

// editableField represents a field that can be edited in the detail view
type editableField struct {
	key      string // Field key (e.g., "name", "description", "components.combatant.health")
	label    string // Display label
	value    string // Current value as string
	fieldType string // "string", "number", "tags"
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

type roomContentsDetailedMsg struct {
	contents *client.RoomContentsDetailed
}

type onlinePlayersLoadedMsg struct {
	players []client.OnlinePlayer
}

type entitySpawnedMsg struct {
	entity *client.Entity
}

type entityDeletedMsg struct {
	entityID string
}

type entityUpdatedMsg struct {
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
	roomContents         []client.Entity
	roomContentsDetailed *client.RoomContentsDetailed
	roomContentsRoom     *Room
	roomContentsCursor   int
	inspectorFocused     bool // true = inspector has focus, false = map has focus

	// Entity detail view
	selectedEntity     *components.EntityData
	entityDetailScroll int
	detailCursor       int              // Which field is selected (0=name, 1=description, 2+=components)
	editingField       string           // Which field is being edited ("", "name", "description", "tag", etc.)
	editInput          textinput.Model  // Text input for editing single-line fields
	editTextarea       textarea.Model   // Textarea for editing multi-line fields (description)
	editableFields     []editableField  // List of editable fields for cursor navigation

	// Online players
	onlinePlayers []client.OnlinePlayer

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

	// Edit input for entity field editing (single-line)
	editTi := textinput.New()
	editTi.Placeholder = ""
	editTi.CharLimit = 500
	editTi.Width = 40

	// Textarea for multi-line editing (description)
	editTa := textarea.New()
	editTa.Placeholder = "Enter description..."
	editTa.CharLimit = 2000
	editTa.SetWidth(40)
	editTa.SetHeight(6)
	editTa.ShowLineNumbers = false

	return Model{
		client:       c,
		roomMap:      make(map[string]*Room),
		loading:      true,
		mode:         ModeNormal,
		nameInput:    ti,
		editInput:    editTi,
		editTextarea: editTa,
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

	// Calculate grid dimensions (50/50 split with inspector)
	mapWidth := width / 2
	m.gridWidth = mapWidth / CellWidth
	m.gridHeight = (height - 6) / CellHeight // Leave room for title, help, and input

	if m.gridWidth < 3 {
		m.gridWidth = 3
	}

	// Update edit input width based on panel size
	editWidth := width/2 - 20 // Leave room for label and borders
	if editWidth < 20 {
		editWidth = 20
	}
	if editWidth > 100 {
		editWidth = 100
	}
	m.editInput.Width = editWidth

	// Update textarea dimensions
	m.editTextarea.SetWidth(editWidth)
	textareaHeight := height/3 - 2
	if textareaHeight < 4 {
		textareaHeight = 4
	}
	if textareaHeight > 10 {
		textareaHeight = 10
	}
	m.editTextarea.SetHeight(textareaHeight)

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
	case ModeSelectTemplate:
		return m.updateSelectTemplateMode(msg)
	case ModeEntityDetail:
		return m.updateEntityDetailMode(msg)
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
					return m, m.loadCurrentRoomContents()
				}
			}
		}
		return m, nil

	case tea.KeyMsg:
		// Clear last action message on any key
		m.lastAction = ""
		m.lastResult = ""

		// Tab switches focus between map and inspector
		if msg.String() == "tab" {
			m.inspectorFocused = !m.inspectorFocused
			if m.inspectorFocused {
				m.roomContentsCursor = 0
			}
			return m, nil
		}

		// Handle navigation based on focus
		if m.inspectorFocused {
			// Inspector navigation
			switch {
			case key.Matches(msg, keys.Up):
				if m.roomContentsCursor > 0 {
					m.roomContentsCursor--
				}
				return m, nil
			case key.Matches(msg, keys.Down):
				maxCursor := m.getTotalContentItems() - 1
				if maxCursor >= 0 && m.roomContentsCursor < maxCursor {
					m.roomContentsCursor++
				}
				return m, nil
			case key.Matches(msg, keys.Select):
				// Open entity detail view
				entity := m.getSelectedContentEntity()
				if entity != nil {
					m.selectedEntity = entity
					m.entityDetailScroll = 0
					m.editableFields = nil
					m.detailCursor = 0
					m.mode = ModeEntityDetail
				}
				return m, nil
			case msg.String() == "e":
				// Edit the room at cursor (from inspector)
				room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
				if room != nil {
					m.selectedEntity = &components.EntityData{
						ID:          room.ID,
						Type:        "room",
						Key:         room.Key,
						Name:        room.Name,
						Description: room.Description,
						Tags:        room.Tags,
						Components:  make(map[string]interface{}),
					}
					m.selectedEntity.Components["coordinates"] = map[string]interface{}{
						"x": float64(room.X),
						"y": float64(room.Y),
						"z": float64(room.Z),
					}
					m.editableFields = nil
					m.detailCursor = 0
					m.mode = ModeEntityDetail
				}
				return m, nil
			case key.Matches(msg, keys.Delete):
				// Delete selected entity
				entity := m.getSelectedContentEntity()
				if entity != nil {
					m.selectedEntity = entity
					return m, m.deleteEntity(entity.ID)
				}
				return m, nil
			case key.Matches(msg, keys.Cancel):
				m.inspectorFocused = false
				return m, nil
			}
			return m, nil
		}

		// Map navigation (when map is focused)
		switch {
		case key.Matches(msg, keys.Up):
			m.cursorY--
			m.adjustViewport()
			return m, m.loadCurrentRoomContents()

		case key.Matches(msg, keys.Down):
			m.cursorY++
			m.adjustViewport()
			return m, m.loadCurrentRoomContents()

		case key.Matches(msg, keys.Left):
			m.cursorX--
			m.adjustViewport()
			return m, m.loadCurrentRoomContents()

		case key.Matches(msg, keys.Right):
			m.cursorX++
			m.adjustViewport()
			return m, m.loadCurrentRoomContents()

		case key.Matches(msg, keys.ZUp):
			m.cursorZ++
			return m, m.loadCurrentRoomContents()

		case key.Matches(msg, keys.ZDown):
			m.cursorZ--
			return m, m.loadCurrentRoomContents()

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

		case key.Matches(msg, keys.Templates):
			// Open template browser if cell is empty
			if m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ) == nil {
				return m, m.loadTemplates()
			}
			return m, nil

		case msg.String() == "e":
			// Edit the room at cursor
			room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
			if room != nil {
				// Create entity data from room for editing
				m.selectedEntity = &components.EntityData{
					ID:          room.ID,
					Type:        "room",
					Key:         room.Key,
					Name:        room.Name,
					Description: room.Description,
					Tags:        room.Tags,
					Components:  make(map[string]interface{}),
				}
				// Add coordinates as a component for editing
				m.selectedEntity.Components["coordinates"] = map[string]interface{}{
					"x": float64(room.X),
					"y": float64(room.Y),
					"z": float64(room.Z),
				}
				m.editableFields = nil
				m.detailCursor = 0
				m.mode = ModeEntityDetail
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
		// Load online players and contents for current cursor room
		return m, tea.Batch(
			m.loadOnlinePlayers(""),
			m.loadCurrentRoomContents(),
		)

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
		// Don't change mode - contents now display in inspector panel
		return m, nil

	case roomContentsDetailedMsg:
		m.roomContentsDetailed = msg.contents
		// Don't change mode - contents now display in inspector panel
		return m, nil

	case onlinePlayersLoadedMsg:
		m.onlinePlayers = msg.players
		return m, nil

	case entitySpawnedMsg:
		m.lastAction = "Spawned"
		m.lastResult = msg.entity.Name
		m.mode = ModeNormal
		m.prototypeSelector = nil
		m.spawnTargetRoom = nil
		return m, nil

	case entityDeletedMsg:
		m.lastAction = "Deleted"
		if m.selectedEntity != nil {
			m.lastResult = m.selectedEntity.Name
		}
		m.selectedEntity = nil
		m.editableFields = nil
		m.mode = ModeNormal
		// Reload room contents
		if m.roomContentsRoom != nil {
			return m, m.loadRoomContentsDetailed(m.roomContentsRoom.ID)
		}
		return m, nil

	case entityUpdatedMsg:
		m.lastAction = "Updated"
		m.lastResult = msg.entity.Name
		// Update the selected entity with new data
		if m.selectedEntity != nil && m.selectedEntity.ID == msg.entity.ID {
			m.selectedEntity.Name = msg.entity.Name
			m.selectedEntity.Description = msg.entity.Description
			m.selectedEntity.Tags = msg.entity.Tags
			m.selectedEntity.Components = msg.entity.Components
			// Rebuild editable fields with new values
			m.editableFields = nil
			m.buildEditableFields()
		}
		// Refresh rooms list to reflect changes (in case name/coords changed)
		var cmds []tea.Cmd
		cmds = append(cmds, m.fetchRooms())
		// Also reload room contents if viewing a room
		if m.roomContentsRoom != nil {
			cmds = append(cmds, m.loadRoomContentsDetailed(m.roomContentsRoom.ID))
		}
		return m, tea.Batch(cmds...)

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


// getTotalContentItems returns the total number of items across all sections
func (m Model) getTotalContentItems() int {
	if m.roomContentsDetailed == nil {
		return len(m.roomContents)
	}
	total := len(m.roomContentsDetailed.NPCs)
	total += len(m.roomContentsDetailed.Items)
	total += len(m.roomContentsDetailed.Exits)
	total += len(m.roomContentsDetailed.Characters)
	// Also count online players in this room
	for _, p := range m.onlinePlayers {
		if p.RoomID == m.roomContentsRoom.ID {
			total++
		}
	}
	return total
}

// getSelectedContentEntity returns the entity at the current cursor position
func (m Model) getSelectedContentEntity() *components.EntityData {
	if m.roomContentsDetailed == nil {
		// Fallback to basic contents
		if m.roomContentsCursor < len(m.roomContents) {
			e := m.roomContents[m.roomContentsCursor]
			return &components.EntityData{
				ID:          e.ID,
				Type:        e.Type,
				Key:         e.Key,
				Name:        e.Name,
				Description: e.Description,
				Components:  e.Components,
				Tags:        e.Tags,
			}
		}
		return nil
	}

	idx := m.roomContentsCursor
	contents := m.roomContentsDetailed

	// NPCs
	if idx < len(contents.NPCs) {
		e := contents.NPCs[idx]
		return &components.EntityData{
			ID:          e.ID,
			Type:        e.Type,
			Key:         e.Key,
			Name:        e.Name,
			Description: e.Description,
			Components:  e.Components,
			Tags:        e.Tags,
		}
	}
	idx -= len(contents.NPCs)

	// Items
	if idx < len(contents.Items) {
		e := contents.Items[idx]
		return &components.EntityData{
			ID:          e.ID,
			Type:        e.Type,
			Key:         e.Key,
			Name:        e.Name,
			Description: e.Description,
			Components:  e.Components,
			Tags:        e.Tags,
		}
	}
	idx -= len(contents.Items)

	// Exits
	if idx < len(contents.Exits) {
		e := contents.Exits[idx]
		return &components.EntityData{
			ID:              e.ID,
			Type:            e.Type,
			Key:             e.Key,
			Name:            e.Name,
			Description:     e.Description,
			Components:      e.Components,
			Tags:            e.Tags,
			Direction:       e.Direction,
			DestinationID:   e.DestinationID,
			DestinationName: e.DestinationName,
			DestinationKey:  e.DestinationKey,
		}
	}
	idx -= len(contents.Exits)

	// Characters
	if idx < len(contents.Characters) {
		e := contents.Characters[idx]
		return &components.EntityData{
			ID:          e.ID,
			Type:        e.Type,
			Key:         e.Key,
			Name:        e.Name,
			Description: e.Description,
			Components:  e.Components,
			Tags:        e.Tags,
		}
	}
	idx -= len(contents.Characters)

	// Online players (can't inspect players)
	return nil
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

func (m Model) updateEntityDetailMode(msg tea.Msg) (Model, tea.Cmd) {
	if m.selectedEntity == nil {
		m.mode = ModeNormal
		return m, nil
	}

	// Build editable fields list if not already built
	if len(m.editableFields) == 0 {
		m.buildEditableFields()
	}

	// Handle editing mode
	if m.editingField != "" {
		isDescriptionEdit := m.editingField == "description"

		switch msg := msg.(type) {
		case tea.KeyMsg:
			switch msg.String() {
			case "esc":
				// Cancel editing
				m.editingField = ""
				if isDescriptionEdit {
					m.editTextarea.Blur()
				} else {
					m.editInput.Blur()
				}
				return m, nil
			case "ctrl+s":
				// Save (for textarea, since Enter adds newlines)
				var value string
				if isDescriptionEdit {
					value = m.editTextarea.Value()
					m.editTextarea.Blur()
				} else {
					value = m.editInput.Value()
					m.editInput.Blur()
				}
				fieldKey := m.editingField
				m.editingField = ""
				return m, m.updateEntityField(m.selectedEntity.ID, fieldKey, value)
			case "enter":
				// For non-description fields, Enter saves. For description, Enter adds newline.
				if !isDescriptionEdit {
					value := m.editInput.Value()
					fieldKey := m.editingField
					m.editingField = ""
					m.editInput.Blur()
					return m, m.updateEntityField(m.selectedEntity.ID, fieldKey, value)
				}
				// For description, fall through to forward to textarea
				fallthrough
			default:
				// Forward to appropriate input
				var cmd tea.Cmd
				if isDescriptionEdit {
					m.editTextarea, cmd = m.editTextarea.Update(msg)
				} else {
					m.editInput, cmd = m.editInput.Update(msg)
				}
				return m, cmd
			}
		}
		return m, nil
	}

	// Normal navigation mode
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "q":
			m.mode = ModeNormal
			m.selectedEntity = nil
			m.editableFields = nil
			m.detailCursor = 0
			return m, nil
		case "up", "k":
			if m.detailCursor > 0 {
				m.detailCursor--
			}
			return m, nil
		case "down", "j":
			if m.detailCursor < len(m.editableFields)-1 {
				m.detailCursor++
			}
			return m, nil
		case "enter", "e":
			// Start editing the selected field
			if m.detailCursor < len(m.editableFields) {
				field := m.editableFields[m.detailCursor]
				m.editingField = field.key

				// Set edit input width based on panel size
				editWidth := m.width/2 - 20
				if editWidth < 20 {
					editWidth = 20
				}
				if editWidth > 100 {
					editWidth = 100
				}

				// Use textarea for description, textinput for other fields
				if field.key == "description" {
					m.editTextarea.SetWidth(editWidth)
					textareaHeight := m.height/3 - 2
					if textareaHeight < 4 {
						textareaHeight = 4
					}
					if textareaHeight > 10 {
						textareaHeight = 10
					}
					m.editTextarea.SetHeight(textareaHeight)
					m.editTextarea.SetValue(field.value)
					m.editTextarea.Focus()
					return m, textarea.Blink
				} else {
					m.editInput.Width = editWidth
					m.editInput.SetValue(field.value)
					m.editInput.Focus()
					m.editInput.CursorEnd()
					return m, textinput.Blink
				}
			}
			return m, nil
		case "d":
			// Delete this entity
			entityID := m.selectedEntity.ID
			return m, m.deleteEntity(entityID)
		}
	}

	return m, nil
}

func (m *Model) buildEditableFields() {
	m.editableFields = nil
	e := m.selectedEntity
	if e == nil {
		return
	}

	// Basic fields
	m.editableFields = append(m.editableFields, editableField{
		key:       "name",
		label:     "Name",
		value:     e.Name,
		fieldType: "string",
	})
	m.editableFields = append(m.editableFields, editableField{
		key:       "description",
		label:     "Description",
		value:     e.Description,
		fieldType: "string",
	})

	// Tags
	m.editableFields = append(m.editableFields, editableField{
		key:       "tags",
		label:     "Tags",
		value:     strings.Join(e.Tags, ", "),
		fieldType: "tags",
	})

	// Component fields (flatten for editing)
	if e.Components != nil {
		keys := make([]string, 0, len(e.Components))
		for k := range e.Components {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, compKey := range keys {
			compValue := e.Components[compKey]
			m.addComponentFields(compKey, compValue, "")
		}
	}
}

func (m *Model) addComponentFields(compKey string, value interface{}, prefix string) {
	fullKey := compKey
	if prefix != "" {
		fullKey = prefix + "." + compKey
	}

	switch v := value.(type) {
	case map[string]interface{}:
		// For nested maps, add each sub-field
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			m.addComponentFields(k, v[k], fullKey)
		}
	case string:
		m.editableFields = append(m.editableFields, editableField{
			key:       "components." + fullKey,
			label:     fullKey,
			value:     v,
			fieldType: "string",
		})
	case float64:
		m.editableFields = append(m.editableFields, editableField{
			key:       "components." + fullKey,
			label:     fullKey,
			value:     fmt.Sprintf("%v", v),
			fieldType: "number",
		})
	case bool:
		m.editableFields = append(m.editableFields, editableField{
			key:       "components." + fullKey,
			label:     fullKey,
			value:     fmt.Sprintf("%v", v),
			fieldType: "string",
		})
	case []interface{}:
		// Arrays - show as JSON-ish string
		items := make([]string, len(v))
		for i, item := range v {
			items[i] = fmt.Sprintf("%v", item)
		}
		m.editableFields = append(m.editableFields, editableField{
			key:       "components." + fullKey,
			label:     fullKey,
			value:     strings.Join(items, ", "),
			fieldType: "array",
		})
	default:
		// Fallback
		m.editableFields = append(m.editableFields, editableField{
			key:       "components." + fullKey,
			label:     fullKey,
			value:     fmt.Sprintf("%v", v),
			fieldType: "string",
		})
	}
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

// hasOnlinePlayers checks if a room has any online players
func (m Model) hasOnlinePlayers(roomID string) bool {
	for _, p := range m.onlinePlayers {
		if p.RoomID == roomID {
			return true
		}
	}
	return false
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

	// Title with room count and focus indicator
	var title string
	if m.inspectorFocused {
		title = fmt.Sprintf("Map (%d rooms)  [Tab: Inspector]", len(m.rooms))
	} else {
		title = fmt.Sprintf("Map (%d rooms)  [Tab: Map]", len(m.rooms))
	}

	// Coordinates indicator
	coords := fmt.Sprintf("Cursor: (%d, %d, Z=%d)", m.cursorX, m.cursorY, m.cursorZ)

	// Render grid
	grid := m.renderGrid()

	// Render inspector or entity detail
	var inspector string
	if m.mode == ModeEntityDetail {
		inspector = m.renderEntityDetail()
	} else {
		inspector = m.renderInspector()
	}

	// Combine grid and inspector side by side (50/50 split)
	mapWidth := m.width / 2
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
	}

	// Help
	var help string
	if m.mode == ModeNormal {
		help = "  ←↑↓→:Move  </>:Level  n:New  t:Template  e:Edit  d:Delete  c:Connect  u:Undo  r:Refresh"
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
	// Build a character grid that includes rooms and exit lines
	// Each cell is CellWidth x CellHeight, with room at top-left corner
	// Exit lines go between rooms

	gridChars := make([][]rune, m.gridHeight*CellHeight)
	gridColors := make([][]lipgloss.Style, m.gridHeight*CellHeight)
	totalWidth := m.gridWidth * CellWidth

	// Initialize grid with spaces
	for y := range gridChars {
		gridChars[y] = make([]rune, totalWidth)
		gridColors[y] = make([]lipgloss.Style, totalWidth)
		for x := range gridChars[y] {
			gridChars[y][x] = ' '
			gridColors[y][x] = lipgloss.NewStyle()
		}
	}

	// Draw rooms and exits
	for row := 0; row < m.gridHeight; row++ {
		worldY := m.viewportY + row
		for col := 0; col < m.gridWidth; col++ {
			worldX := m.viewportX + col
			room := m.getRoomAt(worldX, worldY, m.cursorZ)
			isCursor := worldX == m.cursorX && worldY == m.cursorY

			// Calculate pixel position for this cell
			px := col * CellWidth
			py := row * CellHeight

			if room != nil {
				m.drawRoomBox(gridChars, gridColors, px, py, room, isCursor)
				m.drawExitLines(gridChars, gridColors, px, py, room, col, row)
			} else if isCursor {
				m.drawEmptyCursor(gridChars, gridColors, px, py)
			}
		}
	}

	// Convert grid to string with colors
	var lines []string
	for y := range gridChars {
		var line strings.Builder
		for x := range gridChars[y] {
			style := gridColors[y][x]
			line.WriteString(style.Render(string(gridChars[y][x])))
		}
		lines = append(lines, line.String())
	}

	return strings.Join(lines, "\n")
}

func (m Model) drawRoomBox(chars [][]rune, colors [][]lipgloss.Style, px, py int, room *Room, isCursor bool) {
	// Draw a 5x3 box (bare, no title)
	// ╭───╮
	// │   │
	// ╰───╯
	var borderColor lipgloss.Color
	var topLeft, topRight, botLeft, botRight, hLine, vLine rune

	if isCursor {
		borderColor = lipgloss.Color("226") // Yellow for cursor
		topLeft, topRight, botLeft, botRight = '╔', '╗', '╚', '╝'
		hLine, vLine = '═', '║'
	} else if m.mode == ModeConnect && m.connectSourceRoom != nil && room.ID == m.connectSourceRoom.ID {
		borderColor = lipgloss.Color("39") // Blue for selected
		topLeft, topRight, botLeft, botRight = '╭', '╮', '╰', '╯'
		hLine, vLine = '─', '│'
	} else {
		borderColor = lipgloss.Color("240") // Gray
		topLeft, topRight, botLeft, botRight = '╭', '╮', '╰', '╯'
		hLine, vLine = '─', '│'
	}

	style := lipgloss.NewStyle().Foreground(borderColor)

	// Top row
	if py < len(chars) && px < len(chars[py]) {
		chars[py][px] = topLeft
		colors[py][px] = style
	}
	for x := 1; x < RoomWidth-1; x++ {
		if py < len(chars) && px+x < len(chars[py]) {
			chars[py][px+x] = hLine
			colors[py][px+x] = style
		}
	}
	if py < len(chars) && px+RoomWidth-1 < len(chars[py]) {
		chars[py][px+RoomWidth-1] = topRight
		colors[py][px+RoomWidth-1] = style
	}

	// Middle row (sides only, empty inside)
	if py+1 < len(chars) {
		if px < len(chars[py+1]) {
			chars[py+1][px] = vLine
			colors[py+1][px] = style
		}
		if px+RoomWidth-1 < len(chars[py+1]) {
			chars[py+1][px+RoomWidth-1] = vLine
			colors[py+1][px+RoomWidth-1] = style
		}
		// Add green dot in center if room has online players
		centerX := px + RoomWidth/2
		if m.hasOnlinePlayers(room.ID) && centerX < len(chars[py+1]) {
			chars[py+1][centerX] = '●'
			colors[py+1][centerX] = onlinePlayerStyle
		}
	}

	// Bottom row
	if py+2 < len(chars) {
		if px < len(chars[py+2]) {
			chars[py+2][px] = botLeft
			colors[py+2][px] = style
		}
		for x := 1; x < RoomWidth-1; x++ {
			if px+x < len(chars[py+2]) {
				chars[py+2][px+x] = hLine
				colors[py+2][px+x] = style
			}
		}
		if px+RoomWidth-1 < len(chars[py+2]) {
			chars[py+2][px+RoomWidth-1] = botRight
			colors[py+2][px+RoomWidth-1] = style
		}
	}
}

func (m Model) drawExitLines(chars [][]rune, colors [][]lipgloss.Style, px, py int, room *Room, col, row int) {
	style := exitLineStyle

	for _, exit := range room.Exits {
		// Only draw exits to adjacent rooms on the same Z level
		if exit.DestZ != room.Z {
			continue
		}

		dx := exit.DestX - room.X
		dy := exit.DestY - room.Y

		// Draw line based on direction
		switch {
		case dx == 1 && dy == 0: // East
			// Draw horizontal line to the right of the room
			lineY := py + 1 // Middle of room
			for x := px + RoomWidth; x < px+CellWidth && x < len(chars[0]); x++ {
				if lineY < len(chars) {
					chars[lineY][x] = '─'
					colors[lineY][x] = style
				}
			}
		case dx == -1 && dy == 0: // West
			// Line drawn by the western room's east exit
		case dx == 0 && dy == 1: // South
			// Draw vertical line below the room
			lineX := px + RoomWidth/2 // Center of room
			for y := py + RoomHeight; y < py+CellHeight && y < len(chars); y++ {
				if lineX < len(chars[y]) {
					chars[y][lineX] = '│'
					colors[y][lineX] = style
				}
			}
		case dx == 0 && dy == -1: // North
			// Line drawn by the northern room's south exit
		case dx == 1 && dy == -1: // Northeast
			// Diagonal line
			if py > 0 && px+RoomWidth < len(chars[0]) {
				lineY := py
				lineX := px + RoomWidth
				if lineY < len(chars) && lineX < len(chars[lineY]) {
					chars[lineY][lineX] = '╱'
					colors[lineY][lineX] = style
				}
			}
		case dx == -1 && dy == -1: // Northwest
			// Drawn by NW room
		case dx == 1 && dy == 1: // Southeast
			if py+RoomHeight < len(chars) && px+RoomWidth < len(chars[0]) {
				chars[py+RoomHeight][px+RoomWidth] = '╲'
				colors[py+RoomHeight][px+RoomWidth] = style
			}
		case dx == -1 && dy == 1: // Southwest
			// Drawn by SW room
		}
	}
}

func (m Model) drawEmptyCursor(chars [][]rune, colors [][]lipgloss.Style, px, py int) {
	// Draw a dotted box for empty cursor position
	style := lipgloss.NewStyle().Foreground(lipgloss.Color("238"))

	// Simple dotted corners
	if py < len(chars) && px < len(chars[py]) {
		chars[py][px] = '┌'
		colors[py][px] = style
	}
	if py < len(chars) && px+RoomWidth-1 < len(chars[py]) {
		chars[py][px+RoomWidth-1] = '┐'
		colors[py][px+RoomWidth-1] = style
	}
	if py+2 < len(chars) && px < len(chars[py+2]) {
		chars[py+2][px] = '└'
		colors[py+2][px] = style
	}
	if py+2 < len(chars) && px+RoomWidth-1 < len(chars[py+2]) {
		chars[py+2][px+RoomWidth-1] = '┘'
		colors[py+2][px+RoomWidth-1] = style
	}

	// Center dot
	if py+1 < len(chars) && px+RoomWidth/2 < len(chars[py+1]) {
		chars[py+1][px+RoomWidth/2] = '·'
		colors[py+1][px+RoomWidth/2] = style
	}
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
		return inspectorStyle.Width(m.width/2 - 4).Render(content.String())
	}

	// Room details
	content.WriteString(inspectorLabelStyle.Render("  Name: "))
	content.WriteString(inspectorValueStyle.Render(room.Name) + "\n")

	content.WriteString(inspectorLabelStyle.Render("  Key: "))
	content.WriteString(inspectorValueStyle.Render(room.Key) + "\n")

	content.WriteString(inspectorLabelStyle.Render("  Coords: "))
	content.WriteString(inspectorValueStyle.Render(fmt.Sprintf("(%d, %d, %d)", room.X, room.Y, room.Z)) + "\n")

	if len(room.Tags) > 0 {
		content.WriteString(inspectorLabelStyle.Render("  Tags: "))
		content.WriteString(inspectorValueStyle.Render(strings.Join(room.Tags, ", ")) + "\n")
	}

	if room.Description != "" {
		desc := room.Description
		if len(desc) > 80 {
			desc = desc[:77] + "..."
		}
		content.WriteString(inspectorLabelStyle.Render("  Desc: "))
		content.WriteString(inspectorValueStyle.Render(desc) + "\n")
	}

	// Show room contents from detailed data
	cursorIdx := 0

	if m.roomContentsDetailed != nil {
		contents := m.roomContentsDetailed

		// NPCs
		if len(contents.NPCs) > 0 {
			content.WriteString("\n")
			content.WriteString(inspectorTitleStyle.Render(fmt.Sprintf("  NPCs (%d)", len(contents.NPCs))) + "\n")
			for _, npc := range contents.NPCs {
				prefix := "    • "
				if m.inspectorFocused && cursorIdx == m.roomContentsCursor {
					content.WriteString(inspectorSelectedStyle.Render("  > " + npc.Name))
				} else {
					content.WriteString(inspectorValueStyle.Render(prefix + npc.Name))
				}
				content.WriteString("\n")
				cursorIdx++
			}
		}

		// Items
		if len(contents.Items) > 0 {
			content.WriteString("\n")
			content.WriteString(inspectorTitleStyle.Render(fmt.Sprintf("  Items (%d)", len(contents.Items))) + "\n")
			for _, item := range contents.Items {
				prefix := "    • "
				if m.inspectorFocused && cursorIdx == m.roomContentsCursor {
					content.WriteString(inspectorSelectedStyle.Render("  > " + item.Name))
				} else {
					content.WriteString(inspectorValueStyle.Render(prefix + item.Name))
				}
				content.WriteString("\n")
				cursorIdx++
			}
		}

		// Exits
		if len(contents.Exits) > 0 {
			content.WriteString("\n")
			content.WriteString(inspectorTitleStyle.Render(fmt.Sprintf("  Exits (%d)", len(contents.Exits))) + "\n")
			for _, exit := range contents.Exits {
				exitName := exit.Direction
				if exit.DestinationName != "" {
					exitName = fmt.Sprintf("%s → %s", exit.Direction, exit.DestinationName)
				}
				prefix := "    • "
				if m.inspectorFocused && cursorIdx == m.roomContentsCursor {
					content.WriteString(inspectorSelectedStyle.Render("  > " + exitName))
				} else {
					content.WriteString(inspectorValueStyle.Render(prefix + exitName))
				}
				content.WriteString("\n")
				cursorIdx++
			}
		}

		// Characters (player characters in room)
		if len(contents.Characters) > 0 {
			content.WriteString("\n")
			content.WriteString(inspectorTitleStyle.Render(fmt.Sprintf("  Characters (%d)", len(contents.Characters))) + "\n")
			for _, char := range contents.Characters {
				prefix := "    • "
				if m.inspectorFocused && cursorIdx == m.roomContentsCursor {
					content.WriteString(inspectorSelectedStyle.Render("  > " + char.Name))
				} else {
					content.WriteString(inspectorValueStyle.Render(prefix + char.Name))
				}
				content.WriteString("\n")
				cursorIdx++
			}
		}
	} else if len(room.Exits) > 0 {
		// Fallback to room exit data if detailed not loaded yet
		content.WriteString("\n")
		content.WriteString(inspectorTitleStyle.Render(fmt.Sprintf("  Exits (%d)", len(room.Exits))) + "\n")
		for _, exit := range room.Exits {
			prefix := "    • "
			if m.inspectorFocused && cursorIdx == m.roomContentsCursor {
				content.WriteString(inspectorSelectedStyle.Render("  > " + exit.Direction))
			} else {
				content.WriteString(inspectorValueStyle.Render(prefix + exit.Direction))
			}
			content.WriteString("\n")
			cursorIdx++
		}
	}

	// Show online players in this room
	playersHere := m.getPlayersInRoom(room.ID)
	if len(playersHere) > 0 {
		content.WriteString("\n")
		content.WriteString(successStyle.Render(fmt.Sprintf("  ● Players Online (%d)", len(playersHere))) + "\n")
		for _, player := range playersHere {
			content.WriteString(successStyle.Render("    • " + player.Name))
			if player.IsAdmin {
				content.WriteString(inspectorLabelStyle.Render(" [admin]"))
			}
			content.WriteString("\n")
		}
	}

	content.WriteString("\n")
	if m.inspectorFocused {
		content.WriteString(inspectorLabelStyle.Render("  ↑/↓:Navigate  Enter:Details  e:Edit Room  d:Delete  Tab:Map"))
	} else {
		content.WriteString(inspectorLabelStyle.Render("  Tab:Browse  e:Edit Room  a:NPC  i:Item"))
	}

	return inspectorStyle.Width(m.width/2 - 4).Render(content.String())
}

func (m Model) renderEntityDetail() string {
	if m.selectedEntity == nil {
		return ""
	}

	e := m.selectedEntity
	var content strings.Builder

	// Title with entity name
	content.WriteString(inspectorTitleStyle.Render(fmt.Sprintf("  Edit: %s", e.Name)) + "\n")
	content.WriteString(inspectorLabelStyle.Render(fmt.Sprintf("  Type: %s  Key: %s", e.Type, e.Key)) + "\n")
	content.WriteString(inspectorLabelStyle.Render(fmt.Sprintf("  ID: %s", e.ID)) + "\n\n")

	// Editable fields section
	content.WriteString(inspectorTitleStyle.Render("  Editable Fields") + "\n")

	maxWidth := m.width/2 - 12
	if maxWidth < 20 {
		maxWidth = 20
	}

	for i, field := range m.editableFields {
		isSelected := i == m.detailCursor
		isEditing := m.editingField == field.key

		// Format label
		label := field.label
		if len(label) > 20 {
			label = "..." + label[len(label)-17:]
		}

		// For description field, show full text with word wrap when selected
		isDescriptionField := field.key == "description"

		if isEditing && isDescriptionField {
			// Show textarea for description editing
			content.WriteString(inspectorSelectedStyle.Render(fmt.Sprintf("  > %s:", label)) + "\n")
			content.WriteString("    " + m.editTextarea.View() + "\n")
		} else if isEditing {
			// Show text input for other fields
			content.WriteString(inspectorSelectedStyle.Render(fmt.Sprintf("  > %s: ", label)))
			content.WriteString(m.editInput.View())
			content.WriteString("\n")
		} else if isSelected && isDescriptionField && len(field.value) > 0 {
			// Show full description with word wrap when selected
			content.WriteString(inspectorSelectedStyle.Render(fmt.Sprintf("  > %s:", label)) + "\n")
			// Word wrap the description
			wrapped := wrapText(field.value, maxWidth-4)
			for _, line := range wrapped {
				content.WriteString(inspectorSelectedStyle.Render("      "+line) + "\n")
			}
		} else if isSelected {
			// Highlight selected (non-description or empty)
			value := field.value
			if len(value) > maxWidth {
				value = value[:maxWidth-3] + "..."
			}
			line := fmt.Sprintf("  > %s: %s", label, value)
			content.WriteString(inspectorSelectedStyle.Render(line) + "\n")
		} else {
			// Normal display - truncate if too long
			value := field.value
			if len(value) > maxWidth {
				value = value[:maxWidth-3] + "..."
			}
			content.WriteString(inspectorLabelStyle.Render(fmt.Sprintf("    %s: ", label)))
			content.WriteString(inspectorValueStyle.Render(value) + "\n")
		}
	}

	// Exit-specific info (read-only)
	if e.Direction != "" {
		content.WriteString("\n" + inspectorTitleStyle.Render("  Exit Info (read-only)") + "\n")
		content.WriteString(inspectorLabelStyle.Render("    Direction: ") + inspectorValueStyle.Render(e.Direction) + "\n")
		if e.DestinationName != "" {
			content.WriteString(inspectorLabelStyle.Render("    Destination: ") + inspectorValueStyle.Render(e.DestinationName) + "\n")
		}
	}

	// Help footer
	content.WriteString("\n")
	if m.editingField == "description" {
		content.WriteString(inspectorLabelStyle.Render("  Ctrl+S:Save  Esc:Cancel  (Enter adds newline)"))
	} else if m.editingField != "" {
		content.WriteString(inspectorLabelStyle.Render("  Enter:Save  Esc:Cancel"))
	} else {
		content.WriteString(inspectorLabelStyle.Render("  ↑/↓:Select  Enter/e:Edit  d:Delete  Esc:Close"))
	}

	// Create bordered panel
	panelStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("39")).
		Padding(1, 2).
		Width(m.width/2 - 4).
		Height(m.height - 8)

	return panelStyle.Render(content.String())
}

func (m Model) renderComponentValue(content *strings.Builder, value interface{}, indent int) {
	indentStr := strings.Repeat("  ", indent)

	switch v := value.(type) {
	case map[string]interface{}:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			subVal := v[k]
			switch sv := subVal.(type) {
			case map[string]interface{}:
				content.WriteString(inspectorLabelStyle.Render(indentStr+k+":") + "\n")
				m.renderComponentValue(content, sv, indent+1)
			case []interface{}:
				content.WriteString(inspectorLabelStyle.Render(indentStr+k+": ") + inspectorValueStyle.Render(m.formatArrayValue(sv)) + "\n")
			default:
				content.WriteString(inspectorLabelStyle.Render(indentStr+k+": ") + inspectorValueStyle.Render(fmt.Sprintf("%v", sv)) + "\n")
			}
		}
	case []interface{}:
		content.WriteString(inspectorValueStyle.Render(indentStr+m.formatArrayValue(v)) + "\n")
	default:
		content.WriteString(inspectorValueStyle.Render(indentStr+fmt.Sprintf("%v", v)) + "\n")
	}
}

func (m Model) formatArrayValue(arr []interface{}) string {
	if len(arr) == 0 {
		return "[]"
	}
	items := make([]string, len(arr))
	for i, v := range arr {
		items[i] = fmt.Sprintf("%v", v)
	}
	result := "[" + strings.Join(items, ", ") + "]"
	if len(result) > 50 {
		return result[:47] + "...]"
	}
	return result
}

func (m Model) getPlayersInRoom(roomID string) []client.OnlinePlayer {
	var players []client.OnlinePlayer
	for _, p := range m.onlinePlayers {
		if p.RoomID == roomID {
			players = append(players, p)
		}
	}
	return players
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
			// Convert exits
			exits := make([]RoomExit, len(r.Exits))
			for j, e := range r.Exits {
				exits[j] = RoomExit{
					Direction:     e.Direction,
					DestinationID: e.DestinationID,
					DestX:         e.DestX,
					DestY:         e.DestY,
					DestZ:         e.DestZ,
				}
			}

			result[i] = Room{
				ID:          r.ID,
				Key:         r.Key,
				Name:        r.Name,
				Description: r.Description,
				X:           r.X,
				Y:           r.Y,
				Z:           r.Z,
				Tags:        r.Tags,
				Exits:       exits,
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

func (m Model) loadRoomContentsDetailed(roomID string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Load Contents", err: fmt.Errorf("not connected")}
		}

		contents, err := m.client.GetRoomContentsDetailed(roomID)
		if err != nil {
			return actionErrorMsg{action: "Load Contents", err: err}
		}

		return roomContentsDetailedMsg{contents: contents}
	}
}

// loadCurrentRoomContents loads contents for the room at the current cursor position
func (m Model) loadCurrentRoomContents() tea.Cmd {
	room := m.getRoomAt(m.cursorX, m.cursorY, m.cursorZ)
	if room == nil {
		// Clear contents when moving to empty cell
		return func() tea.Msg {
			return roomContentsDetailedMsg{contents: nil}
		}
	}
	return m.loadRoomContentsDetailed(room.ID)
}

func (m Model) loadOnlinePlayers(roomID string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Load Players", err: fmt.Errorf("not connected")}
		}

		players, err := m.client.GetOnlinePlayers(roomID)
		if err != nil {
			// Don't fail if players can't be loaded - just return empty
			return onlinePlayersLoadedMsg{players: nil}
		}

		return onlinePlayersLoadedMsg{players: players}
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

func (m Model) deleteEntity(entityID string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Delete Entity", err: fmt.Errorf("not connected")}
		}

		err := m.client.DeleteEntity(entityID)
		if err != nil {
			return actionErrorMsg{action: "Delete Entity", err: err}
		}

		return entityDeletedMsg{entityID: entityID}
	}
}

func (m Model) updateEntityField(entityID, fieldKey, value string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionErrorMsg{action: "Update Entity", err: fmt.Errorf("not connected")}
		}

		updates := make(map[string]interface{})

		// Handle different field types
		switch {
		case fieldKey == "name":
			updates["name"] = value
		case fieldKey == "description":
			updates["description"] = value
		case fieldKey == "tags":
			// Parse comma-separated tags
			tags := strings.Split(value, ",")
			cleanTags := make([]string, 0, len(tags))
			for _, t := range tags {
				t = strings.TrimSpace(t)
				if t != "" {
					cleanTags = append(cleanTags, t)
				}
			}
			updates["tags"] = cleanTags
		case strings.HasPrefix(fieldKey, "components."):
			// Handle component field updates
			// Parse the path: components.combatant.health.current -> ["combatant", "health", "current"]
			path := strings.TrimPrefix(fieldKey, "components.")
			parts := strings.Split(path, ".")

			// Build nested map structure
			if m.selectedEntity != nil && m.selectedEntity.Components != nil {
				// Clone the components
				newComponents := deepCopyMap(m.selectedEntity.Components)

				// Navigate to the parent and set the value
				setNestedValue(newComponents, parts, value)
				updates["components"] = newComponents
			}
		}

		entity, err := m.client.UpdateEntity(entityID, updates)
		if err != nil {
			return actionErrorMsg{action: "Update Entity", err: err}
		}

		return entityUpdatedMsg{entity: entity}
	}
}

// deepCopyMap creates a deep copy of a map
func deepCopyMap(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		switch val := v.(type) {
		case map[string]interface{}:
			result[k] = deepCopyMap(val)
		case []interface{}:
			newSlice := make([]interface{}, len(val))
			copy(newSlice, val)
			result[k] = newSlice
		default:
			result[k] = v
		}
	}
	return result
}

// setNestedValue sets a value in a nested map structure
func setNestedValue(m map[string]interface{}, path []string, value string) {
	if len(path) == 0 {
		return
	}

	if len(path) == 1 {
		// Try to parse as number if it looks like one
		if num, err := strconv.ParseFloat(value, 64); err == nil {
			m[path[0]] = num
		} else if value == "true" {
			m[path[0]] = true
		} else if value == "false" {
			m[path[0]] = false
		} else {
			m[path[0]] = value
		}
		return
	}

	// Navigate deeper
	key := path[0]
	if _, ok := m[key]; !ok {
		m[key] = make(map[string]interface{})
	}
	if nested, ok := m[key].(map[string]interface{}); ok {
		setNestedValue(nested, path[1:], value)
	}
}

// wrapText wraps text to fit within maxWidth characters per line
func wrapText(text string, maxWidth int) []string {
	if maxWidth <= 0 {
		maxWidth = 40
	}

	var lines []string
	words := strings.Fields(text)
	if len(words) == 0 {
		return lines
	}

	currentLine := words[0]
	for _, word := range words[1:] {
		if len(currentLine)+1+len(word) <= maxWidth {
			currentLine += " " + word
		} else {
			lines = append(lines, currentLine)
			currentLine = word
		}
	}
	if currentLine != "" {
		lines = append(lines, currentLine)
	}

	return lines
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
	return "←↑↓→:Move  </>:Level  n:New  t:Template  e:Edit  d:Delete  c:Connect  u:Undo  r:Refresh"
}
