package styles

import "github.com/charmbracelet/lipgloss"

var (
	// Colors
	Primary   = lipgloss.Color("#7C3AED") // Purple
	Secondary = lipgloss.Color("#10B981") // Green
	Muted     = lipgloss.Color("#6B7280") // Gray
	Border    = lipgloss.Color("#374151") // Dark gray

	// Header styles
	Header = lipgloss.NewStyle().
		Bold(true).
		Foreground(Primary).
		Padding(0, 1)

	HeaderRight = lipgloss.NewStyle().
			Foreground(Muted).
			Padding(0, 1)

	// Tab styles
	ActiveTab = lipgloss.NewStyle().
			Bold(true).
			Foreground(Primary).
			Background(lipgloss.Color("#1F2937")).
			Padding(0, 2)

	InactiveTab = lipgloss.NewStyle().
			Foreground(Muted).
			Padding(0, 2)

	// Content area
	Content = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(Border).
		Padding(1, 2)

	// Status bar
	StatusBar = lipgloss.NewStyle().
			Foreground(Muted).
			Padding(0, 1)

	// Selection highlight
	Selected = lipgloss.NewStyle().
			Bold(true).
			Foreground(Secondary)

	// Error styling
	Error = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#EF4444"))

	// Success styling
	Success = lipgloss.NewStyle().
		Foreground(Secondary)
)
