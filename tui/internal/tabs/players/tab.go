// Package players implements the Players tab for the TUI.
package players

import (
	"fmt"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/lokacore/tui/internal/client"
	"github.com/lokacore/tui/internal/components"
)

// Styles for the players tab
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

	adminStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42"))
)

// KeyMap defines key bindings for the players tab
type KeyMap struct {
	Refresh     key.Binding
	ToggleAdmin key.Binding
	Up          key.Binding
	Down        key.Binding
}

var keys = KeyMap{
	Refresh:     key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "Refresh")),
	ToggleAdmin: key.NewBinding(key.WithKeys("a"), key.WithHelp("a", "Toggle Admin")),
	Up:          key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "Up")),
	Down:        key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "Down")),
}

// Player represents a player for display
type Player struct {
	ID          string
	Email       string
	IsAdmin     bool
	ConfirmedAt *string
	InsertedAt  string
}

// Messages for async operations
type playersLoadedMsg struct {
	players []Player
	total   int
}

type playersErrorMsg struct {
	err error
}

type actionResultMsg struct {
	action  string
	success bool
	message string
}

// Model is the Players tab model
type Model struct {
	client      *client.Client
	table       table.Model
	players     []Player
	loading     bool
	lastError   error
	lastAction  string
	lastResult  string
	lastSuccess bool
	width       int
	height      int

	// Search/filter
	searchBar *components.SearchBar
}

// New creates a new Players tab model
func New(c *client.Client) Model {
	columns := []table.Column{
		{Title: "Email", Width: 30},
		{Title: "Admin", Width: 6},
		{Title: "Confirmed", Width: 10},
		{Title: "Joined", Width: 12},
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
		client:    c,
		table:     t,
		loading:   true,
		searchBar: components.NewSearchBar(),
	}
}

// Init initializes the tab and fetches players
func (m Model) Init() tea.Cmd {
	return m.fetchPlayers()
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
	availWidth := width - 10
	if availWidth > 60 {
		columns := []table.Column{
			{Title: "Email", Width: availWidth / 2},
			{Title: "Admin", Width: 6},
			{Title: "Confirmed", Width: 10},
			{Title: "Joined", Width: 12},
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
			return m, m.fetchPlayers()

		case key.Matches(msg, keys.ToggleAdmin):
			if len(m.players) > 0 {
				idx := m.table.Cursor()
				if idx >= 0 && idx < len(m.players) {
					return m, m.toggleAdmin(m.players[idx].ID, m.players[idx].Email)
				}
			}
			return m, nil
		}

	case playersLoadedMsg:
		m.loading = false
		m.lastError = nil
		m.players = msg.players
		m.updateTableRows()
		return m, nil

	case playersErrorMsg:
		m.loading = false
		m.lastError = msg.err
		return m, nil

	case actionResultMsg:
		m.lastAction = msg.action
		m.lastResult = msg.message
		m.lastSuccess = msg.success
		// Refresh after action
		return m, m.fetchPlayers()
	}

	// Forward to table for navigation
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

func (m *Model) updateTableRows() {
	var rows []table.Row
	for _, player := range m.players {
		// Apply filter if search bar is present
		if m.searchBar != nil && m.searchBar.HasFilter() {
			if !m.searchBar.Matches(player.Email) {
				continue
			}
		}

		adminStr := "No"
		if player.IsAdmin {
			adminStr = "Yes"
		}

		confirmedStr := "No"
		if player.ConfirmedAt != nil {
			confirmedStr = "Yes"
		}

		// Format date (just take first 10 chars for YYYY-MM-DD)
		joined := player.InsertedAt
		if len(joined) > 10 {
			joined = joined[:10]
		}

		rows = append(rows, table.Row{
			player.Email,
			adminStr,
			confirmedStr,
			joined,
		})
	}
	m.table.SetRows(rows)
}

// View renders the Players tab
func (m Model) View() string {
	var content string

	// Title with count
	title := "Players"
	if len(m.players) > 0 {
		title = fmt.Sprintf("Players (%d)", len(m.players))
	}
	content += titleStyle.Render(title)

	// Search filter indicator
	if m.searchBar != nil && m.searchBar.HasFilter() && !m.searchBar.IsActive() {
		content += " " + m.searchBar.FilterIndicator()
	}
	content += "\n"

	// Search bar (when active)
	if m.searchBar != nil && m.searchBar.IsActive() {
		content += m.searchBar.View() + "\n"
	}

	// Loading or error state
	if m.loading && len(m.players) == 0 {
		content += "  Loading...\n"
	} else if m.lastError != nil && len(m.players) == 0 {
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
			help = "  ↑/↓:Navigate  a:Toggle Admin  r:Refresh  Esc:Clear filter  /:Search"
		} else {
			help = "  ↑/↓:Navigate  a:Toggle Admin  r:Refresh  /:Search"
		}
		content += helpStyle.Render(help) + "\n"
	}

	return content
}

// Async commands

func (m Model) fetchPlayers() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return playersErrorMsg{err: fmt.Errorf("not connected")}
		}

		players, total, err := m.client.ListPlayers(100, 0)
		if err != nil {
			return playersErrorMsg{err: err}
		}

		result := make([]Player, len(players))
		for i, p := range players {
			result[i] = Player{
				ID:          p.ID,
				Email:       p.Email,
				IsAdmin:     p.IsAdmin,
				ConfirmedAt: p.ConfirmedAt,
				InsertedAt:  p.InsertedAt,
			}
		}

		return playersLoadedMsg{
			players: result,
			total:   total,
		}
	}
}

func (m Model) toggleAdmin(id, email string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Toggle Admin",
				success: false,
				message: "Not connected",
			}
		}

		player, err := m.client.ToggleAdmin(id)
		if err != nil {
			return actionResultMsg{
				action:  "Toggle Admin",
				success: false,
				message: err.Error(),
			}
		}

		status := "removed from"
		if player.IsAdmin {
			status = "granted to"
		}

		return actionResultMsg{
			action:  "Toggle Admin",
			success: true,
			message: fmt.Sprintf("Admin %s %s", status, email),
		}
	}
}

// ShortHelp returns the short help text
func (m Model) ShortHelp() string {
	return "↑/↓:Navigate  a:Toggle Admin  r:Refresh  /:Search"
}
