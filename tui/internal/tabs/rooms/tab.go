// Package rooms implements the Rooms tab for the TUI.
package rooms

import (
	"fmt"
	"strconv"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
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
	ModeCreate
	ModeEdit
)

// Styles for the rooms tab
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	tableStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("240"))

	selectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("229")).
			Background(lipgloss.Color("57")).
			Bold(true)

	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229"))

	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			MarginTop(1)

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196"))

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42"))

	formStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("39")).
			Padding(1, 2).
			MarginTop(1)

	formTitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("39")).
			MarginBottom(1)

	formLabelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			Width(12)

	formInputStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("229"))

	formFocusedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("39")).
				Bold(true)
)

// KeyMap defines key bindings for the rooms tab
type KeyMap struct {
	Refresh  key.Binding
	New      key.Binding
	Edit     key.Binding
	Delete   key.Binding
	Up       key.Binding
	Down     key.Binding
	Cancel   key.Binding
	Confirm  key.Binding
	Tab      key.Binding
	ShiftTab key.Binding
}

var keys = KeyMap{
	Refresh:  key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "Refresh")),
	New:      key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "New Room")),
	Edit:     key.NewBinding(key.WithKeys("e"), key.WithHelp("e", "Edit")),
	Delete:   key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "Delete")),
	Up:       key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "Up")),
	Down:     key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "Down")),
	Cancel:   key.NewBinding(key.WithKeys("esc"), key.WithHelp("Esc", "Cancel")),
	Confirm:  key.NewBinding(key.WithKeys("enter"), key.WithHelp("Enter", "Confirm")),
	Tab:      key.NewBinding(key.WithKeys("tab"), key.WithHelp("Tab", "Next Field")),
	ShiftTab: key.NewBinding(key.WithKeys("shift+tab"), key.WithHelp("Shift+Tab", "Prev Field")),
}

// Room represents a room for display
type Room struct {
	ID          string
	Key         string
	Name        string
	Description string
	X           int
	Y           int
	Z           int
}

// Messages for async operations
type roomsLoadedMsg struct {
	rooms []Room
	total int
}

type roomsErrorMsg struct {
	err error
}

type actionResultMsg struct {
	action  string
	success bool
	message string
}

// Form field indices
const (
	fieldName = iota
	fieldDesc
	fieldX
	fieldY
	fieldZ
	fieldCount
)

// Model is the Rooms tab model
type Model struct {
	client      *client.Client
	table       table.Model
	rooms       []Room
	loading     bool
	lastError   error
	lastAction  string
	lastResult  string
	lastSuccess bool
	width       int
	height      int

	// Form state
	mode         Mode
	formInputs   []textinput.Model
	focusedField int
	editingRoom  *Room // Room being edited (nil for create)

	// Search/filter
	searchBar *components.SearchBar
}

// New creates a new Rooms tab model
func New(c *client.Client) Model {
	columns := []table.Column{
		{Title: "Key", Width: 20},
		{Title: "Name", Width: 25},
		{Title: "X", Width: 5},
		{Title: "Y", Width: 5},
		{Title: "Z", Width: 5},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(10),
	)

	s := table.DefaultStyles()
	s.Header = headerStyle
	s.Selected = selectedStyle
	t.SetStyles(s)

	// Initialize form inputs
	inputs := make([]textinput.Model, fieldCount)

	inputs[fieldName] = textinput.New()
	inputs[fieldName].Placeholder = "Room name"
	inputs[fieldName].CharLimit = 50
	inputs[fieldName].Width = 30

	inputs[fieldDesc] = textinput.New()
	inputs[fieldDesc].Placeholder = "Description (optional)"
	inputs[fieldDesc].CharLimit = 200
	inputs[fieldDesc].Width = 40

	inputs[fieldX] = textinput.New()
	inputs[fieldX].Placeholder = "0"
	inputs[fieldX].CharLimit = 5
	inputs[fieldX].Width = 8

	inputs[fieldY] = textinput.New()
	inputs[fieldY].Placeholder = "0"
	inputs[fieldY].CharLimit = 5
	inputs[fieldY].Width = 8

	inputs[fieldZ] = textinput.New()
	inputs[fieldZ].Placeholder = "0"
	inputs[fieldZ].CharLimit = 5
	inputs[fieldZ].Width = 8

	return Model{
		client:     c,
		table:      t,
		loading:    true,
		mode:       ModeNormal,
		formInputs: inputs,
		searchBar:  components.NewSearchBar(),
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
	// Adjust table height (leave room for title, search, and help)
	tableHeight := height - 8
	if tableHeight < 5 {
		tableHeight = 5
	}
	m.table.SetHeight(tableHeight)

	// Adjust column widths to fit
	availWidth := width - 10 // margins and borders
	if availWidth > 60 {
		columns := []table.Column{
			{Title: "Key", Width: availWidth / 4},
			{Title: "Name", Width: availWidth / 3},
			{Title: "X", Width: 5},
			{Title: "Y", Width: 5},
			{Title: "Z", Width: 5},
		}
		m.table.SetColumns(columns)
	}

	// Set search bar width
	if m.searchBar != nil {
		m.searchBar.SetWidth(width)
	}
}

// Update handles messages
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	var cmd tea.Cmd

	// Handle form modes
	if m.mode == ModeCreate || m.mode == ModeEdit {
		return m.updateFormMode(msg)
	}

	// Handle search bar
	if m.searchBar != nil {
		handled, searchCmd := m.searchBar.Update(msg)
		if handled {
			// If filter changed, update table
			m.updateTableRows()
			return m, searchCmd
		}
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Refresh):
			m.loading = true
			m.lastAction = ""
			return m, m.fetchRooms()

		case key.Matches(msg, keys.New):
			m.mode = ModeCreate
			m.editingRoom = nil
			m.resetForm()
			m.focusField(0)
			return m, textinput.Blink

		case key.Matches(msg, keys.Edit):
			if len(m.rooms) > 0 {
				idx := m.table.Cursor()
				if idx >= 0 && idx < len(m.rooms) {
					room := m.rooms[idx]
					m.mode = ModeEdit
					m.editingRoom = &room
					m.populateForm(&room)
					m.focusField(0)
					return m, textinput.Blink
				}
			}
			return m, nil

		case key.Matches(msg, keys.Delete):
			if len(m.rooms) > 0 {
				selected := m.table.SelectedRow()
				if len(selected) > 0 {
					return m, m.deleteRoom(selected[0]) // Key is first column
				}
			}
			return m, nil
		}

	case roomsLoadedMsg:
		m.loading = false
		m.lastError = nil
		m.rooms = msg.rooms
		m.updateTableRows()
		return m, nil

	case roomsErrorMsg:
		m.loading = false
		m.lastError = msg.err
		return m, nil

	case actionResultMsg:
		m.lastAction = msg.action
		m.lastResult = msg.message
		m.lastSuccess = msg.success
		// Refresh after action
		return m, m.fetchRooms()
	}

	// Forward to table for navigation
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

func (m Model) updateFormMode(msg tea.Msg) (Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Cancel):
			m.mode = ModeNormal
			m.editingRoom = nil
			return m, nil

		case key.Matches(msg, keys.Tab):
			m.focusField((m.focusedField + 1) % fieldCount)
			return m, nil

		case key.Matches(msg, keys.ShiftTab):
			m.focusField((m.focusedField - 1 + fieldCount) % fieldCount)
			return m, nil

		case key.Matches(msg, keys.Confirm):
			// Validate and submit
			name := m.formInputs[fieldName].Value()
			if name == "" {
				return m, nil // Name required
			}

			desc := m.formInputs[fieldDesc].Value()
			x := parseIntOrDefault(m.formInputs[fieldX].Value(), 0)
			y := parseIntOrDefault(m.formInputs[fieldY].Value(), 0)
			z := parseIntOrDefault(m.formInputs[fieldZ].Value(), 0)

			m.mode = ModeNormal

			if m.editingRoom != nil {
				// Edit existing room
				return m, m.updateRoom(m.editingRoom.ID, name, desc)
			} else {
				// Create new room
				return m, m.createRoom(name, desc, x, y, z)
			}
		}
	}

	// Forward to focused input
	m.formInputs[m.focusedField], cmd = m.formInputs[m.focusedField].Update(msg)
	return m, cmd
}

func (m *Model) resetForm() {
	for i := range m.formInputs {
		m.formInputs[i].SetValue("")
		m.formInputs[i].Blur()
	}
	m.focusedField = 0
}

func (m *Model) populateForm(room *Room) {
	m.formInputs[fieldName].SetValue(room.Name)
	m.formInputs[fieldDesc].SetValue(room.Description)
	m.formInputs[fieldX].SetValue(fmt.Sprintf("%d", room.X))
	m.formInputs[fieldY].SetValue(fmt.Sprintf("%d", room.Y))
	m.formInputs[fieldZ].SetValue(fmt.Sprintf("%d", room.Z))
}

func (m *Model) focusField(idx int) {
	// Blur all
	for i := range m.formInputs {
		m.formInputs[i].Blur()
	}
	// Focus selected
	m.focusedField = idx
	m.formInputs[idx].Focus()
}

func parseIntOrDefault(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func (m *Model) updateTableRows() {
	var rows []table.Row
	for _, room := range m.rooms {
		// Apply filter if search bar is present
		if m.searchBar != nil && m.searchBar.HasFilter() {
			if !m.searchBar.MatchesAny(room.Key, room.Name) {
				continue
			}
		}
		rows = append(rows, table.Row{
			room.Key,
			room.Name,
			fmt.Sprintf("%d", room.X),
			fmt.Sprintf("%d", room.Y),
			fmt.Sprintf("%d", room.Z),
		})
	}
	m.table.SetRows(rows)
}

// View renders the Rooms tab
func (m Model) View() string {
	var content string

	// Title with count
	title := "Rooms"
	if len(m.rooms) > 0 {
		title = fmt.Sprintf("Rooms (%d)", len(m.rooms))
	}
	content += titleStyle.Render(title)

	// Filter indicator
	if m.searchBar != nil && m.searchBar.HasFilter() && !m.searchBar.IsActive() {
		content += " " + m.searchBar.FilterIndicator()
	}
	content += "\n"

	// Search bar (when active)
	if m.searchBar != nil && m.searchBar.IsActive() {
		content += m.searchBar.View() + "\n"
	}

	// Loading or error state
	if m.loading && len(m.rooms) == 0 {
		content += "  Loading...\n"
	} else if m.lastError != nil && len(m.rooms) == 0 {
		content += errorStyle.Render(fmt.Sprintf("  Error: %s", m.lastError.Error())) + "\n"
	} else {
		// Table
		content += tableStyle.Render(m.table.View()) + "\n"
	}

	// Last action result
	if m.lastAction != "" && m.mode == ModeNormal && !m.searchBar.IsActive() {
		if m.lastSuccess {
			content += successStyle.Render(fmt.Sprintf("  ✓ %s: %s", m.lastAction, m.lastResult)) + "\n"
		} else {
			content += errorStyle.Render(fmt.Sprintf("  ✗ %s: %s", m.lastAction, m.lastResult)) + "\n"
		}
	}

	// Form overlay
	if m.mode == ModeCreate || m.mode == ModeEdit {
		content += m.renderForm()
	}

	// Help
	if m.mode == ModeNormal {
		if m.searchBar != nil && m.searchBar.IsActive() {
			content += helpStyle.Render("  " + m.searchBar.HelpText()) + "\n"
		} else {
			var help string
			if m.searchBar != nil && m.searchBar.HasFilter() {
				help = "  ↑/↓:Navigate  r:Refresh  n:New  e:Edit  d:Delete  Esc:Clear filter  /:Search"
			} else {
				help = "  ↑/↓:Navigate  r:Refresh  n:New  e:Edit  d:Delete  /:Search"
			}
			content += helpStyle.Render(help) + "\n"
		}
	}

	return content
}

func (m Model) renderForm() string {
	var title string
	if m.mode == ModeCreate {
		title = "Create New Room"
	} else {
		title = fmt.Sprintf("Edit Room: %s", m.editingRoom.Key)
	}

	var fields string
	fieldLabels := []string{"Name:", "Desc:", "X:", "Y:", "Z:"}

	for i, label := range fieldLabels {
		labelStyle := formLabelStyle
		if i == m.focusedField {
			labelStyle = formFocusedStyle
		}
		fields += labelStyle.Render(label) + " " + m.formInputs[i].View() + "\n"
	}

	help := "Tab: Next Field  Enter: Save  Esc: Cancel"

	return formStyle.Render(
		formTitleStyle.Render(title) + "\n" +
			fields +
			helpStyle.Render(help),
	)
}

// Async commands

func (m Model) fetchRooms() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return roomsErrorMsg{err: fmt.Errorf("not connected")}
		}

		rooms, total, err := m.client.ListRooms(100, 0)
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
			}
		}

		return roomsLoadedMsg{
			rooms: result,
			total: total,
		}
	}
}

func (m Model) deleteRoom(key string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Delete Room",
				success: false,
				message: "Not connected",
			}
		}

		// Find room ID by key
		var roomID string
		for _, room := range m.rooms {
			if room.Key == key {
				roomID = room.ID
				break
			}
		}

		if roomID == "" {
			return actionResultMsg{
				action:  "Delete Room",
				success: false,
				message: "Room not found",
			}
		}

		err := m.client.DeleteEntity(roomID)
		if err != nil {
			return actionResultMsg{
				action:  "Delete Room",
				success: false,
				message: err.Error(),
			}
		}

		return actionResultMsg{
			action:  "Delete Room",
			success: true,
			message: fmt.Sprintf("Deleted %s", key),
		}
	}
}

func (m Model) createRoom(name, desc string, x, y, z int) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Create Room",
				success: false,
				message: "Not connected",
			}
		}

		room, err := m.client.CreateRoom(name, desc, x, y, z)
		if err != nil {
			return actionResultMsg{
				action:  "Create Room",
				success: false,
				message: err.Error(),
			}
		}

		return actionResultMsg{
			action:  "Create Room",
			success: true,
			message: fmt.Sprintf("Created %s", room.Key),
		}
	}
}

func (m Model) updateRoom(id, name, desc string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Update Room",
				success: false,
				message: "Not connected",
			}
		}

		updates := map[string]interface{}{
			"name":        name,
			"description": desc,
		}

		_, err := m.client.UpdateEntity(id, updates)
		if err != nil {
			return actionResultMsg{
				action:  "Update Room",
				success: false,
				message: err.Error(),
			}
		}

		return actionResultMsg{
			action:  "Update Room",
			success: true,
			message: fmt.Sprintf("Updated %s", name),
		}
	}
}

// GetSelectedRoom returns the currently selected room, if any
func (m Model) GetSelectedRoom() *Room {
	if len(m.rooms) == 0 {
		return nil
	}
	idx := m.table.Cursor()
	if idx >= 0 && idx < len(m.rooms) {
		return &m.rooms[idx]
	}
	return nil
}

// ShortHelp returns the short help text
func (m Model) ShortHelp() string {
	return "↑/↓:Navigate  r:Refresh  n:New  e:Edit  d:Delete  /:Search"
}
