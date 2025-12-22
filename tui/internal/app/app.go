package app

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/lokacore/tui/internal/client"
	"github.com/lokacore/tui/internal/components"
	"github.com/lokacore/tui/internal/styles"
	"github.com/lokacore/tui/internal/tabs/entities"
	"github.com/lokacore/tui/internal/tabs/mapview"
	"github.com/lokacore/tui/internal/tabs/players"
	"github.com/lokacore/tui/internal/tabs/rooms"
	"github.com/lokacore/tui/internal/tabs/scripts"
	"github.com/lokacore/tui/internal/tabs/system"
)

// Tab represents a tab in the TUI
type Tab int

const (
	TabMap Tab = iota
	TabRooms
	TabEntities
	TabScripts
	TabPlayers
	TabSystem
)

var tabNames = []string{"Map", "Rooms", "Entities", "Scripts", "Players", "System"}

// NotificationMsg represents a server-push notification
type NotificationMsg struct {
	Method string
	Params map[string]interface{}
}

// Model is the main application model
type Model struct {
	socketPath string
	logLevel   string
	activeTab  Tab
	width      int
	height     int
	showHelp   bool
	quitting   bool

	// Client connection
	client    *client.Client
	connected bool
	connError error

	// Tabs
	mapTab      mapview.Model
	roomsTab    rooms.Model
	entitiesTab entities.Model
	scriptsTab  scripts.Model
	playersTab  players.Model
	systemTab   system.Model

	// Status bar
	statusBar *components.StatusBar
}

// KeyMap defines the key bindings
type KeyMap struct {
	Tab1 key.Binding
	Tab2 key.Binding
	Tab3 key.Binding
	Tab4 key.Binding
	Tab5 key.Binding
	Tab6 key.Binding
	Help key.Binding
	Quit key.Binding
}

var keys = KeyMap{
	Tab1: key.NewBinding(key.WithKeys("1"), key.WithHelp("1", "Map")),
	Tab2: key.NewBinding(key.WithKeys("2"), key.WithHelp("2", "Rooms")),
	Tab3: key.NewBinding(key.WithKeys("3"), key.WithHelp("3", "Entities")),
	Tab4: key.NewBinding(key.WithKeys("4"), key.WithHelp("4", "Scripts")),
	Tab5: key.NewBinding(key.WithKeys("5"), key.WithHelp("5", "Players")),
	Tab6: key.NewBinding(key.WithKeys("6"), key.WithHelp("6", "System")),
	Help: key.NewBinding(key.WithKeys("f1", "?"), key.WithHelp("F1/?", "Help")),
	Quit: key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "Quit")),
}

// New creates a new application model
func New(socketPath, logLevel string) Model {
	m := Model{
		socketPath: socketPath,
		logLevel:   logLevel,
		activeTab:  TabSystem, // Start on System tab to show connection status
	}

	// Try to connect to the server
	c, err := client.New(socketPath)
	if err != nil {
		m.connError = err
		m.connected = false
	} else {
		m.client = c
		m.connected = true
	}

	// Initialize tabs with client
	m.mapTab = mapview.New(m.client)
	m.roomsTab = rooms.New(m.client)
	m.entitiesTab = entities.New(m.client)
	m.scriptsTab = scripts.New(m.client)
	m.playersTab = players.New(m.client)
	m.systemTab = system.New(m.client, socketPath)

	// Initialize status bar
	m.statusBar = components.NewStatusBar()
	m.statusBar.Connected = m.connected
	m.statusBar.SocketPath = socketPath
	if m.connError != nil {
		m.statusBar.SetError(m.connError.Error(), 10*time.Second)
	}

	return m
}

// Init initializes the application
func (m Model) Init() tea.Cmd {
	var cmds []tea.Cmd

	// Start listening for notifications if connected
	if m.client != nil && m.connected {
		cmds = append(cmds, m.listenForNotifications())
	}

	// Initialize active tab
	if m.activeTab == TabSystem {
		cmds = append(cmds, m.systemTab.Init())
	}

	return tea.Batch(cmds...)
}

// listenForNotifications returns a command that listens for server notifications
func (m Model) listenForNotifications() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return nil
		}
		// Block until we receive a notification
		notification := <-m.client.Notifications()
		return NotificationMsg{
			Method: notification.Method,
			Params: notification.Params,
		}
	}
}

// Update handles messages
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		// Global key handling (not passed to tabs)
		switch {
		case key.Matches(msg, keys.Quit):
			m.quitting = true
			if m.client != nil {
				m.client.Close()
			}
			return m, tea.Quit
		case key.Matches(msg, keys.Help):
			m.showHelp = !m.showHelp
			return m, nil
		case key.Matches(msg, keys.Tab1):
			if m.activeTab != TabMap {
				m.activeTab = TabMap
				cmds = append(cmds, m.mapTab.Init())
			}
			return m, tea.Batch(cmds...)
		case key.Matches(msg, keys.Tab2):
			if m.activeTab != TabRooms {
				m.activeTab = TabRooms
				cmds = append(cmds, m.roomsTab.Init())
			}
			return m, tea.Batch(cmds...)
		case key.Matches(msg, keys.Tab3):
			if m.activeTab != TabEntities {
				m.activeTab = TabEntities
				cmds = append(cmds, m.entitiesTab.Init())
			}
			return m, tea.Batch(cmds...)
		case key.Matches(msg, keys.Tab4):
			if m.activeTab != TabScripts {
				m.activeTab = TabScripts
				cmds = append(cmds, m.scriptsTab.Init())
			}
			return m, tea.Batch(cmds...)
		case key.Matches(msg, keys.Tab5):
			if m.activeTab != TabPlayers {
				m.activeTab = TabPlayers
				cmds = append(cmds, m.playersTab.Init())
			}
			return m, tea.Batch(cmds...)
		case key.Matches(msg, keys.Tab6):
			if m.activeTab != TabSystem {
				m.activeTab = TabSystem
				cmds = append(cmds, m.systemTab.Init())
			}
			return m, tea.Batch(cmds...)
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		// Update tab sizes
		contentHeight := m.height - 4 // header + tabs + status
		m.mapTab.SetSize(m.width, contentHeight)
		m.roomsTab.SetSize(m.width, contentHeight)
		m.entitiesTab.SetSize(m.width, contentHeight)
		m.scriptsTab.SetSize(m.width, contentHeight)
		m.playersTab.SetSize(m.width, contentHeight)
		m.systemTab.SetSize(m.width, contentHeight)

	case NotificationMsg:
		// Handle server-push notifications
		// Continue listening for more notifications
		cmds = append(cmds, m.listenForNotifications())

		// Dispatch notification to relevant tabs based on type
		switch msg.Method {
		case "entity.changed", "script.changed":
			// Refresh System tab stats when entities change
			if m.activeTab == TabSystem {
				cmds = append(cmds, m.systemTab.Init())
			}
		}
		return m, tea.Batch(cmds...)
	}

	// Forward messages to active tab
	switch m.activeTab {
	case TabMap:
		m.mapTab, cmd = m.mapTab.Update(msg)
		cmds = append(cmds, cmd)
	case TabRooms:
		m.roomsTab, cmd = m.roomsTab.Update(msg)
		cmds = append(cmds, cmd)
	case TabEntities:
		m.entitiesTab, cmd = m.entitiesTab.Update(msg)
		cmds = append(cmds, cmd)
	case TabScripts:
		m.scriptsTab, cmd = m.scriptsTab.Update(msg)
		cmds = append(cmds, cmd)
	case TabPlayers:
		m.playersTab, cmd = m.playersTab.Update(msg)
		cmds = append(cmds, cmd)
	case TabSystem:
		m.systemTab, cmd = m.systemTab.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

// View renders the application
func (m Model) View() string {
	if m.quitting {
		return ""
	}

	// Header
	header := styles.Header.Render("ExMUD Game Editor")
	headerRight := styles.HeaderRight.Render("[F1]Help  [Q]Quit")
	headerLine := lipgloss.JoinHorizontal(
		lipgloss.Top,
		header,
		lipgloss.NewStyle().Width(m.width-lipgloss.Width(header)-lipgloss.Width(headerRight)).Render(""),
		headerRight,
	)

	// Tabs
	var tabs []string
	for i, name := range tabNames {
		if Tab(i) == m.activeTab {
			tabs = append(tabs, styles.ActiveTab.Render(fmt.Sprintf("[%d]%s", i+1, name)))
		} else {
			tabs = append(tabs, styles.InactiveTab.Render(fmt.Sprintf("[%d]%s", i+1, name)))
		}
	}
	tabBar := lipgloss.JoinHorizontal(lipgloss.Top, tabs...)

	// Content
	content := m.renderTabContent()

	// Status bar (using component)
	status := m.statusBar.View(m.width)

	// Help overlay
	if m.showHelp {
		content = m.renderHelp()
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		headerLine,
		tabBar,
		content,
		status,
	)
}

func (m Model) renderTabContent() string {
	contentHeight := m.height - 4

	switch m.activeTab {
	case TabMap:
		return styles.Content.Height(contentHeight).Render(m.mapTab.View())
	case TabRooms:
		return styles.Content.Height(contentHeight).Render(m.roomsTab.View())
	case TabEntities:
		return styles.Content.Height(contentHeight).Render(m.entitiesTab.View())
	case TabScripts:
		return styles.Content.Height(contentHeight).Render(m.scriptsTab.View())
	case TabPlayers:
		return styles.Content.Height(contentHeight).Render(m.playersTab.View())
	case TabSystem:
		return styles.Content.Height(contentHeight).Render(m.systemTab.View())
	default:
		placeholder := fmt.Sprintf("\n\n  %s tab content will appear here.\n  Press 1-6 to switch tabs.", tabNames[m.activeTab])
		return styles.Content.Height(contentHeight).Render(placeholder)
	}
}

func (m Model) renderHelp() string {
	help := `
  ╭─────────────────────────────────────────────────────────╮
  │                   ExMUD TUI Help                        │
  ╰─────────────────────────────────────────────────────────╯

  Global Shortcuts
  ────────────────
  1-6         Switch tabs (Map, Rooms, Entities, Scripts, Players, System)
  F1 / ?      Toggle this help overlay
  Q / Ctrl+C  Quit application

`
	// Add context-sensitive help based on active tab
	switch m.activeTab {
	case TabSystem:
		help += `  System Tab
  ──────────
  r           Reload prototypes from YAML files
  s           Reload Lua scripts
  e           Export world to YAML
  i           Import world from YAML
  R           Refresh statistics
`
	case TabMap:
		help += `  Map Tab
  ───────
  Arrow keys  Navigate the map grid
  Enter       Select room at cursor
  n           Create new room at cursor
  t           Place from template
  d           Delete selected room
  c           Connect rooms with exit
  Ctrl+Z/u    Undo last action
  Ctrl+Y      Redo last action
`
	case TabRooms:
		help += `  Rooms Tab
  ─────────
  ↑/↓/j/k     Navigate room list
  r           Refresh room list
  n           Create new room
  d           Delete selected room
`
	case TabEntities:
		help += `  Entities Tab
  ────────────
  ↑/↓/j/k     Navigate entity list
  Tab         Cycle type filter (All/NPCs/Items/Exits)
  r           Refresh entity list
  d           Delete selected entity
`
	case TabScripts:
		help += `  Scripts Tab
  ───────────
  ↑/↓         Navigate script list
  Enter       Edit script in $EDITOR
  t           Test selected script
  Space       Toggle script enabled/disabled
  n           Create new script
`
	case TabPlayers:
		help += `  Players Tab
  ───────────
  ↑/↓/j/k     Navigate player list
  a           Toggle admin status
  r           Refresh player list
`
	}

	help += `
  ─────────────────────────────────────────────────────────
  Press F1 or ? to close this help
`
	return styles.Content.Height(m.height - 4).Render(help)
}

// Run starts the TUI application
func Run(socketPath, logLevel string) error {
	p := tea.NewProgram(
		New(socketPath, logLevel),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(), // Enable mouse support
	)

	_, err := p.Run()
	return err
}
