// Package scripts implements the Scripts tab for the TUI.
package scripts

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/lokacore/tui/internal/client"
	"github.com/lokacore/tui/internal/components"
)

// Styles for the scripts tab
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

	previewTitleStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("39")).
				MarginTop(1)

	previewStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("245")).
			MarginTop(0)

	enabledStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42"))

	disabledStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241"))
)

// KeyMap defines key bindings for the scripts tab
type KeyMap struct {
	Refresh key.Binding
	Toggle  key.Binding
	Test    key.Binding
	Up      key.Binding
	Down    key.Binding
}

var keys = KeyMap{
	Refresh: key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "Refresh")),
	Toggle:  key.NewBinding(key.WithKeys(" "), key.WithHelp("Space", "Toggle")),
	Test:    key.NewBinding(key.WithKeys("t"), key.WithHelp("t", "Test")),
	Up:      key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "Up")),
	Down:    key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "Down")),
}

// Script represents a script for display
type Script struct {
	ID          string
	Name        string
	Description string
	Source      string
	Hook        string
	Enabled     bool
}

// Messages for async operations
type scriptsLoadedMsg struct {
	scripts []Script
	total   int
}

type scriptsErrorMsg struct {
	err error
}

type actionResultMsg struct {
	action  string
	success bool
	message string
}

type testResultMsg struct {
	success bool
	output  string
}

// Model is the Scripts tab model
type Model struct {
	client       *client.Client
	table        table.Model
	scripts      []Script
	loading      bool
	lastError    error
	lastAction   string
	lastResult   string
	lastSuccess  bool
	testOutput   string
	testSuccess  *bool // nil = no test run, true/false = test result
	width        int
	height       int

	// Search/filter
	searchBar *components.SearchBar
}

// New creates a new Scripts tab model
func New(c *client.Client) Model {
	columns := []table.Column{
		{Title: "St", Width: 3},
		{Title: "Name", Width: 20},
		{Title: "Hook", Width: 20},
		{Title: "Description", Width: 30},
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

// Init initializes the tab and fetches scripts
func (m Model) Init() tea.Cmd {
	return m.fetchScripts()
}

// SetSize updates the tab dimensions
func (m *Model) SetSize(width, height int) {
	m.width = width
	m.height = height
	// Adjust table height (leave room for title, help, search, and preview)
	tableHeight := height - 16 // room for preview section
	if tableHeight < 5 {
		tableHeight = 5
	}
	m.table.SetHeight(tableHeight)

	// Adjust column widths to fit
	availWidth := width - 10
	if availWidth > 60 {
		columns := []table.Column{
			{Title: "St", Width: 3},
			{Title: "Name", Width: availWidth / 4},
			{Title: "Hook", Width: availWidth / 5},
			{Title: "Description", Width: availWidth / 3},
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
			m.testOutput = ""
			m.testSuccess = nil
			return m, m.fetchScripts()

		case key.Matches(msg, keys.Toggle):
			if len(m.scripts) > 0 {
				idx := m.table.Cursor()
				if idx >= 0 && idx < len(m.scripts) {
					return m, m.toggleScript(m.scripts[idx].ID, m.scripts[idx].Name)
				}
			}
			return m, nil

		case key.Matches(msg, keys.Test):
			if len(m.scripts) > 0 {
				idx := m.table.Cursor()
				if idx >= 0 && idx < len(m.scripts) {
					m.testOutput = ""
					m.testSuccess = nil
					return m, m.testScript(m.scripts[idx].ID, m.scripts[idx].Name)
				}
			}
			return m, nil
		}

	case scriptsLoadedMsg:
		m.loading = false
		m.lastError = nil
		m.scripts = msg.scripts
		m.updateTableRows()
		return m, nil

	case scriptsErrorMsg:
		m.loading = false
		m.lastError = msg.err
		return m, nil

	case actionResultMsg:
		m.lastAction = msg.action
		m.lastResult = msg.message
		m.lastSuccess = msg.success
		// Refresh after action
		return m, m.fetchScripts()

	case testResultMsg:
		m.testSuccess = &msg.success
		m.testOutput = msg.output
		return m, nil
	}

	// Forward to table for navigation
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

func (m *Model) updateTableRows() {
	var rows []table.Row
	for _, script := range m.scripts {
		// Apply filter if search bar is present
		if m.searchBar != nil && m.searchBar.HasFilter() {
			if !m.searchBar.MatchesAny(script.Name, script.Hook, script.Description) {
				continue
			}
		}

		status := disabledStyle.Render("✗")
		if script.Enabled {
			status = enabledStyle.Render("✓")
		}
		hook := script.Hook
		if hook == "" {
			hook = "-"
		}
		desc := script.Description
		if len(desc) > 40 {
			desc = desc[:37] + "..."
		}
		rows = append(rows, table.Row{
			status,
			script.Name,
			hook,
			desc,
		})
	}
	m.table.SetRows(rows)
}

// View renders the Scripts tab
func (m Model) View() string {
	var content string

	// Title with count
	title := "Scripts"
	if len(m.scripts) > 0 {
		title = fmt.Sprintf("Scripts (%d)", len(m.scripts))
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
	if m.loading && len(m.scripts) == 0 {
		content += "  Loading...\n"
	} else if m.lastError != nil && len(m.scripts) == 0 {
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

	// Test output
	if m.testSuccess != nil && (m.searchBar == nil || !m.searchBar.IsActive()) {
		content += "\n" + previewTitleStyle.Render("Test Result:") + "\n"
		if *m.testSuccess {
			content += successStyle.Render("  ✓ Test passed") + "\n"
		} else {
			content += errorStyle.Render("  ✗ Test failed") + "\n"
		}
		// Show output (truncate if too long)
		output := m.testOutput
		lines := strings.Split(output, "\n")
		if len(lines) > 5 {
			output = strings.Join(lines[:5], "\n") + "\n..."
		}
		if output != "" {
			content += previewStyle.Render("  " + strings.ReplaceAll(output, "\n", "\n  ")) + "\n"
		}
	}

	// Source preview for selected script (when not searching)
	if len(m.scripts) > 0 && m.testSuccess == nil && (m.searchBar == nil || !m.searchBar.IsActive()) {
		idx := m.table.Cursor()
		if idx >= 0 && idx < len(m.scripts) {
			script := m.scripts[idx]
			content += "\n" + previewTitleStyle.Render("Source Preview:") + "\n"
			source := script.Source
			// Truncate preview
			lines := strings.Split(source, "\n")
			if len(lines) > 5 {
				source = strings.Join(lines[:5], "\n") + "\n-- ..."
			}
			content += previewStyle.Render("  " + strings.ReplaceAll(source, "\n", "\n  ")) + "\n"
		}
	}

	// Help
	if m.searchBar != nil && m.searchBar.IsActive() {
		content += helpStyle.Render("  " + m.searchBar.HelpText()) + "\n"
	} else {
		var help string
		if m.searchBar != nil && m.searchBar.HasFilter() {
			help = "  ↑/↓:Navigate  Space:Toggle  t:Test  r:Refresh  Esc:Clear filter  /:Search"
		} else {
			help = "  ↑/↓:Navigate  Space:Toggle  t:Test  r:Refresh  /:Search"
		}
		content += helpStyle.Render(help) + "\n"
	}

	return content
}

// Async commands

func (m Model) fetchScripts() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return scriptsErrorMsg{err: fmt.Errorf("not connected")}
		}

		scripts, total, err := m.client.ListScripts(100, 0)
		if err != nil {
			return scriptsErrorMsg{err: err}
		}

		result := make([]Script, len(scripts))
		for i, s := range scripts {
			result[i] = Script{
				ID:          s.ID,
				Name:        s.Name,
				Description: s.Description,
				Source:      s.Source,
				Hook:        s.Hook,
				Enabled:     s.Enabled,
			}
		}

		return scriptsLoadedMsg{
			scripts: result,
			total:   total,
		}
	}
}

func (m Model) toggleScript(id, name string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Toggle Script",
				success: false,
				message: "Not connected",
			}
		}

		script, err := m.client.ToggleScript(id)
		if err != nil {
			return actionResultMsg{
				action:  "Toggle Script",
				success: false,
				message: err.Error(),
			}
		}

		status := "disabled"
		if script.Enabled {
			status = "enabled"
		}

		return actionResultMsg{
			action:  "Toggle Script",
			success: true,
			message: fmt.Sprintf("%s is now %s", name, status),
		}
	}
}

func (m Model) testScript(id, name string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return testResultMsg{
				success: false,
				output:  "Not connected",
			}
		}

		success, output, err := m.client.TestScript(id)
		if err != nil {
			return testResultMsg{
				success: false,
				output:  err.Error(),
			}
		}

		return testResultMsg{
			success: success,
			output:  output,
		}
	}
}

// ShortHelp returns the short help text
func (m Model) ShortHelp() string {
	return "↑/↓:Navigate  Space:Toggle  t:Test  r:Refresh  /:Search"
}
