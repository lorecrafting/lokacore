// Package system implements the System tab for the TUI.
package system

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/lokacore/tui/internal/client"
)

// Styles for the system tab
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	sectionStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			MarginTop(1)

	labelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			Width(14)

	valueStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("229"))

	actionStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("39")).
			MarginTop(1)

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42"))

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196"))

	connectionStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42")).
			MarginTop(2)

	disconnectedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("196")).
				MarginTop(2)
)

// KeyMap defines key bindings for the system tab
type KeyMap struct {
	ReloadProtos  key.Binding
	ReloadScripts key.Binding
	ExportWorld   key.Binding
	ImportWorld   key.Binding
	Refresh       key.Binding
}

var keys = KeyMap{
	ReloadProtos:  key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "Reload Prototypes")),
	ReloadScripts: key.NewBinding(key.WithKeys("s"), key.WithHelp("s", "Reload Scripts")),
	ExportWorld:   key.NewBinding(key.WithKeys("e"), key.WithHelp("e", "Export World")),
	ImportWorld:   key.NewBinding(key.WithKeys("i"), key.WithHelp("i", "Import World")),
	Refresh:       key.NewBinding(key.WithKeys("R"), key.WithHelp("R", "Refresh Stats")),
}

// Stats holds the server statistics
type Stats struct {
	Version         string
	ProtocolVersion string
	Node            string
	UptimeMs        int64
	Rooms           int
	NPCs            int
	Items           int
	Exits           int
	Scripts         int
	Players         int
}

// Messages for async operations
type statsLoadedMsg struct {
	stats *Stats
}

type statsErrorMsg struct {
	err error
}

type actionResultMsg struct {
	action  string
	success bool
	message string
}

// Model is the System tab model
type Model struct {
	client       *client.Client
	socketPath   string
	stats        *Stats
	loading      bool
	lastError    error
	lastAction   string
	lastResult   string
	lastSuccess  bool
	width        int
	height       int
}

// New creates a new System tab model
func New(c *client.Client, socketPath string) Model {
	return Model{
		client:     c,
		socketPath: socketPath,
		loading:    true,
	}
}

// Init initializes the tab and fetches stats
func (m Model) Init() tea.Cmd {
	return m.fetchStats()
}

// SetSize updates the tab dimensions
func (m *Model) SetSize(width, height int) {
	m.width = width
	m.height = height
}

// Update handles messages
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.ReloadProtos):
			m.lastAction = ""
			return m, m.reloadPrototypes()

		case key.Matches(msg, keys.ReloadScripts):
			m.lastAction = ""
			return m, m.reloadScripts()

		case key.Matches(msg, keys.ExportWorld):
			m.lastAction = ""
			return m, m.exportWorld()

		case key.Matches(msg, keys.ImportWorld):
			m.lastAction = ""
			return m, m.importWorld()

		case key.Matches(msg, keys.Refresh):
			m.loading = true
			return m, m.fetchStats()
		}

	case statsLoadedMsg:
		m.loading = false
		m.lastError = nil
		m.stats = msg.stats
		return m, nil

	case statsErrorMsg:
		m.loading = false
		m.lastError = msg.err
		return m, nil

	case actionResultMsg:
		m.lastAction = msg.action
		m.lastResult = msg.message
		m.lastSuccess = msg.success
		// Refresh stats after action
		return m, m.fetchStats()
	}

	return m, nil
}

// View renders the System tab
func (m Model) View() string {
	var content string

	// Title
	content += titleStyle.Render("System") + "\n\n"

	// Server Statistics section
	content += sectionStyle.Render("Server Statistics") + "\n"
	content += sectionStyle.Render("─────────────────") + "\n"

	if m.loading && m.stats == nil {
		content += "  Loading...\n"
	} else if m.lastError != nil && m.stats == nil {
		content += errorStyle.Render(fmt.Sprintf("  Error: %s", m.lastError.Error())) + "\n"
	} else if m.stats != nil {
		// Stats in two columns
		content += m.renderStatRow("Rooms", m.stats.Rooms, "Players", m.stats.Players)
		content += m.renderStatRow("NPCs", m.stats.NPCs, "Scripts", m.stats.Scripts)
		content += m.renderStatRow("Items", m.stats.Items, "Uptime", m.formatUptime(m.stats.UptimeMs))
		content += m.renderStatRow("Exits", m.stats.Exits, "Version", m.stats.Version)
	}

	// Actions section
	content += "\n" + sectionStyle.Render("Actions") + "\n"
	content += sectionStyle.Render("───────") + "\n"
	content += actionStyle.Render("  [r] Reload Prototypes    [s] Reload Scripts") + "\n"
	content += actionStyle.Render("  [e] Export World         [i] Import World") + "\n"
	content += actionStyle.Render("  [R] Refresh Stats") + "\n"

	// Last action result
	if m.lastAction != "" {
		content += "\n"
		if m.lastSuccess {
			content += successStyle.Render(fmt.Sprintf("  ✓ %s: %s", m.lastAction, m.lastResult)) + "\n"
		} else {
			content += errorStyle.Render(fmt.Sprintf("  ✗ %s: %s", m.lastAction, m.lastResult)) + "\n"
		}
	}

	// Connection status
	content += "\n"
	if m.client != nil && m.client.IsConnected() {
		content += connectionStyle.Render(fmt.Sprintf("  ● Connected via %s", m.socketPath)) + "\n"
		if m.stats != nil && m.stats.ProtocolVersion != "" {
			content += connectionStyle.Render(fmt.Sprintf("  Protocol: v%s", m.stats.ProtocolVersion)) + "\n"
		}
	} else {
		content += disconnectedStyle.Render("  ○ Disconnected") + "\n"
	}

	return content
}

func (m Model) renderStatRow(label1 string, value1 interface{}, label2 string, value2 interface{}) string {
	left := labelStyle.Render(fmt.Sprintf("  %s:", label1)) + valueStyle.Render(fmt.Sprintf("%-8v", value1))
	right := labelStyle.Render(fmt.Sprintf("%s:", label2)) + valueStyle.Render(fmt.Sprintf("%v", value2))
	return left + "    " + right + "\n"
}

func (m Model) formatUptime(ms int64) string {
	d := time.Duration(ms) * time.Millisecond
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60

	if hours > 24 {
		days := hours / 24
		hours = hours % 24
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

// Async commands

func (m Model) fetchStats() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return statsErrorMsg{err: fmt.Errorf("not connected")}
		}

		info, err := m.client.GetSystemInfo()
		if err != nil {
			return statsErrorMsg{err: err}
		}

		return statsLoadedMsg{
			stats: &Stats{
				Version:         info.Version,
				ProtocolVersion: info.ProtocolVersion,
				Node:            info.Node,
				UptimeMs:        info.UptimeMs,
				Rooms:           info.Rooms,
				NPCs:            info.NPCs,
				Items:           info.Items,
				Exits:           info.Exits,
				Scripts:         info.Scripts,
				Players:         info.Players,
			},
		}
	}
}

func (m Model) reloadPrototypes() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Reload Prototypes",
				success: false,
				message: "Not connected",
			}
		}

		count, err := m.client.ReloadPrototypes()
		if err != nil {
			return actionResultMsg{
				action:  "Reload Prototypes",
				success: false,
				message: err.Error(),
			}
		}

		return actionResultMsg{
			action:  "Reload Prototypes",
			success: true,
			message: fmt.Sprintf("Loaded %d prototypes", count),
		}
	}
}

func (m Model) reloadScripts() tea.Cmd {
	return func() tea.Msg {
		// Note: reload_scripts not implemented yet in handlers
		// For now, return a placeholder message
		return actionResultMsg{
			action:  "Reload Scripts",
			success: false,
			message: "Not implemented yet",
		}
	}
}

func (m Model) exportWorld() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Export World",
				success: false,
				message: "Not connected",
			}
		}

		// Export to default location
		err := m.client.ExportWorld("priv/world/export")
		if err != nil {
			return actionResultMsg{
				action:  "Export World",
				success: false,
				message: err.Error(),
			}
		}

		return actionResultMsg{
			action:  "Export World",
			success: true,
			message: "Exported to priv/world/export",
		}
	}
}

func (m Model) importWorld() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return actionResultMsg{
				action:  "Import World",
				success: false,
				message: "Not connected",
			}
		}

		// Import from default location (same as export)
		result, err := m.client.ImportWorld("priv/world/export", false)
		if err != nil {
			return actionResultMsg{
				action:  "Import World",
				success: false,
				message: err.Error(),
			}
		}

		total := result.Rooms + result.NPCs + result.Items + result.Exits
		return actionResultMsg{
			action:  "Import World",
			success: true,
			message: fmt.Sprintf("Imported %d entities (%d rooms, %d npcs, %d items, %d exits)",
				total, result.Rooms, result.NPCs, result.Items, result.Exits),
		}
	}
}

// ShortHelp returns the short help text
func (m Model) ShortHelp() string {
	return "r:Reload Protos  s:Scripts  e:Export  i:Import  R:Refresh"
}
