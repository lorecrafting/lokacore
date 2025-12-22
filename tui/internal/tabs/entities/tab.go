// Package entities implements the Entities tab for the TUI.
package entities

import (
	"fmt"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/lokacore/tui/internal/client"
	"github.com/lokacore/tui/internal/components"
)

// Styles for the entities tab
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	filterStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("39")).
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
)

// Entity types for filtering
var entityTypes = []string{"", "npc", "item", "exit"}
var entityTypeLabels = []string{"All", "NPCs", "Items", "Exits"}

// KeyMap defines key bindings for the entities tab
type KeyMap struct {
	Refresh    key.Binding
	Delete     key.Binding
	CycleType  key.Binding
	Up         key.Binding
	Down       key.Binding
}

var keys = KeyMap{
	Refresh:   key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "Refresh")),
	Delete:    key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "Delete")),
	CycleType: key.NewBinding(key.WithKeys("tab"), key.WithHelp("Tab", "Cycle Type")),
	Up:        key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "Up")),
	Down:      key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "Down")),
}

// Entity represents an entity for display
type Entity struct {
	ID          string
	Type        string
	Key         string
	Name        string
	LocationID  *string
}

// Messages for async operations
type entitiesLoadedMsg struct {
	entities []Entity
	total    int
}

type entitiesErrorMsg struct {
	err error
}

type actionResultMsg struct {
	action  string
	success bool
	message string
}

// Model is the Entities tab model
type Model struct {
	client       *client.Client
	table        table.Model
	entities     []Entity
	typeFilter   int // index into entityTypes
	loading      bool
	lastError    error
	lastAction   string
	lastResult   string
	lastSuccess  bool
	width        int
	height       int

	// Search/filter
	searchBar *components.SearchBar
}

// New creates a new Entities tab model
func New(c *client.Client) Model {
	columns := []table.Column{
		{Title: "Type", Width: 6},
		{Title: "Key", Width: 25},
		{Title: "Name", Width: 25},
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

	return Model{
		client:     c,
		table:      t,
		loading:    true,
		typeFilter: 0, // All
		searchBar:  components.NewSearchBar(),
	}
}

// Init initializes the tab and fetches entities
func (m Model) Init() tea.Cmd {
	return m.fetchEntities()
}

// SetSize updates the tab dimensions
func (m *Model) SetSize(width, height int) {
	m.width = width
	m.height = height
	// Adjust table height (leave room for title, filter, search, and help)
	tableHeight := height - 9
	if tableHeight < 5 {
		tableHeight = 5
	}
	m.table.SetHeight(tableHeight)

	// Adjust column widths to fit
	availWidth := width - 10
	if availWidth > 60 {
		columns := []table.Column{
			{Title: "Type", Width: 6},
			{Title: "Key", Width: availWidth / 3},
			{Title: "Name", Width: availWidth / 2},
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
			return m, m.fetchEntities()

		case key.Matches(msg, keys.CycleType):
			m.typeFilter = (m.typeFilter + 1) % len(entityTypes)
			m.loading = true
			return m, m.fetchEntities()

		case key.Matches(msg, keys.Delete):
			if len(m.entities) > 0 {
				idx := m.table.Cursor()
				if idx >= 0 && idx < len(m.entities) {
					return m, m.deleteEntity(m.entities[idx].ID, m.entities[idx].Key)
				}
			}
			return m, nil
		}

	case entitiesLoadedMsg:
		m.loading = false
		m.lastError = nil
		m.entities = msg.entities
		m.updateTableRows()
		return m, nil

	case entitiesErrorMsg:
		m.loading = false
		m.lastError = msg.err
		return m, nil

	case actionResultMsg:
		m.lastAction = msg.action
		m.lastResult = msg.message
		m.lastSuccess = msg.success
		// Refresh after action
		return m, m.fetchEntities()
	}

	// Forward to table for navigation
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

func (m *Model) updateTableRows() {
	var rows []table.Row
	for _, entity := range m.entities {
		// Apply filter if search bar is present
		if m.searchBar != nil && m.searchBar.HasFilter() {
			if !m.searchBar.MatchesAny(entity.Key, entity.Name) {
				continue
			}
		}
		rows = append(rows, table.Row{
			entity.Type,
			entity.Key,
			entity.Name,
		})
	}
	m.table.SetRows(rows)
}

// View renders the Entities tab
func (m Model) View() string {
	var content string

	// Title with count
	title := "Entities"
	if len(m.entities) > 0 {
		title = fmt.Sprintf("Entities (%d)", len(m.entities))
	}
	content += titleStyle.Render(title)

	// Search filter indicator
	if m.searchBar != nil && m.searchBar.HasFilter() && !m.searchBar.IsActive() {
		content += " " + m.searchBar.FilterIndicator()
	}
	content += "\n"

	// Type filter indicator
	filterText := fmt.Sprintf("Type: [%s]", entityTypeLabels[m.typeFilter])
	content += filterStyle.Render(filterText) + "\n"

	// Search bar (when active)
	if m.searchBar != nil && m.searchBar.IsActive() {
		content += m.searchBar.View() + "\n"
	}

	// Loading or error state
	if m.loading && len(m.entities) == 0 {
		content += "  Loading...\n"
	} else if m.lastError != nil && len(m.entities) == 0 {
		content += errorStyle.Render(fmt.Sprintf("  Error: %s", m.lastError.Error())) + "\n"
	} else {
		// Table
		content += tableStyle.Render(m.table.View()) + "\n"
	}

	// Last action result
	if m.lastAction != "" && (m.searchBar == nil || !m.searchBar.IsActive()) {
		if m.lastSuccess {
			content += successStyle.Render(fmt.Sprintf("  ✓ %s: %s", m.lastAction, m.lastResult)) + "\n"
		} else {
			content += errorStyle.Render(fmt.Sprintf("  ✗ %s: %s", m.lastAction, m.lastResult)) + "\n"
		}
	}

	// Help
	if m.searchBar != nil && m.searchBar.IsActive() {
		content += helpStyle.Render("  " + m.searchBar.HelpText()) + "\n"
	} else {
		var help string
		if m.searchBar != nil && m.searchBar.HasFilter() {
			help = "  ↑/↓:Navigate  Tab:Type  r:Refresh  d:Delete  Esc:Clear filter  /:Search"
		} else {
			help = "  ↑/↓:Navigate  Tab:Type  r:Refresh  d:Delete  /:Search"
		}
		content += helpStyle.Render(help) + "\n"
	}

	return content
}

// Async commands

func (m Model) fetchEntities() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return entitiesErrorMsg{err: fmt.Errorf("not connected")}
		}

		entityType := entityTypes[m.typeFilter]
		entities, total, err := m.client.ListEntities(entityType, 100, 0)
		if err != nil {
			return entitiesErrorMsg{err: err}
		}

		result := make([]Entity, len(entities))
		for i, e := range entities {
			result[i] = Entity{
				ID:         e.ID,
				Type:       e.Type,
				Key:        e.Key,
				Name:       e.Name,
				LocationID: e.LocationID,
			}
		}

		return entitiesLoadedMsg{
			entities: result,
			total:    total,
		}
	}
}

func (m Model) deleteEntity(id, key string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Delete Entity",
				success: false,
				message: "Not connected",
			}
		}

		err := m.client.DeleteEntity(id)
		if err != nil {
			return actionResultMsg{
				action:  "Delete Entity",
				success: false,
				message: err.Error(),
			}
		}

		return actionResultMsg{
			action:  "Delete Entity",
			success: true,
			message: fmt.Sprintf("Deleted %s", key),
		}
	}
}

// ShortHelp returns the short help text
func (m Model) ShortHelp() string {
	return "↑/↓:Navigate  Tab:Type  r:Refresh  d:Delete  /:Search"
}
