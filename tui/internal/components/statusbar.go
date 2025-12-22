// Package components provides reusable UI components for the TUI.
package components

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// StatusBar represents a status bar component for the TUI footer
type StatusBar struct {
	Connected   bool
	SocketPath  string
	Stats       map[string]int
	Error       string
	ErrorExpiry time.Time
	Hints       []string
	width       int
}

// Styles for the status bar
var (
	statusBarStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")).
			Padding(0, 1)

	connectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42")). // Green
			Bold(true)

	disconnectedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("196")). // Red
				Bold(true)

	statLabelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241"))

	statValueStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("229")).
			Bold(true)

	hintStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241"))

	errorBarStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("231")). // White
			Background(lipgloss.Color("196")). // Red background
			Padding(0, 1).
			Bold(true)

	warningBarStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("232")). // Dark
			Background(lipgloss.Color("214")). // Orange/yellow background
			Padding(0, 1).
			Bold(true)
)

// NewStatusBar creates a new StatusBar instance
func NewStatusBar() *StatusBar {
	return &StatusBar{
		Stats: make(map[string]int),
		Hints: []string{"1-6:Tab", "F1:Help", "Q:Quit"},
	}
}

// SetSize sets the width of the status bar
func (s *StatusBar) SetSize(width int) {
	s.width = width
}

// SetError sets an error message with a duration for auto-dismiss
func (s *StatusBar) SetError(err string, duration time.Duration) {
	s.Error = err
	s.ErrorExpiry = time.Now().Add(duration)
}

// ClearError clears the current error message
func (s *StatusBar) ClearError() {
	s.Error = ""
	s.ErrorExpiry = time.Time{}
}

// SetStats sets the stats to display
func (s *StatusBar) SetStats(stats map[string]int) {
	s.Stats = stats
}

// SetStat sets a single stat value
func (s *StatusBar) SetStat(key string, value int) {
	if s.Stats == nil {
		s.Stats = make(map[string]int)
	}
	s.Stats[key] = value
}

// SetHints sets the keyboard hints to display
func (s *StatusBar) SetHints(hints []string) {
	s.Hints = hints
}

// View renders the status bar
func (s *StatusBar) View(width int) string {
	s.width = width

	// Check if error has expired
	if s.Error != "" && !s.ErrorExpiry.IsZero() && time.Now().After(s.ErrorExpiry) {
		s.Error = ""
	}

	if s.Error != "" {
		return s.renderError(width)
	}
	return s.renderNormal(width)
}

func (s *StatusBar) renderNormal(width int) string {
	var leftParts []string

	// Connection status
	if s.Connected {
		leftParts = append(leftParts, connectedStyle.Render("● Connected"))
	} else {
		leftParts = append(leftParts, disconnectedStyle.Render("○ Disconnected"))
	}

	// Stats (sorted for consistent display order)
	if len(s.Stats) > 0 {
		var statKeys []string
		for k := range s.Stats {
			statKeys = append(statKeys, k)
		}
		sort.Strings(statKeys)

		for _, key := range statKeys {
			val := s.Stats[key]
			stat := statLabelStyle.Render(key+": ") + statValueStyle.Render(fmt.Sprintf("%d", val))
			leftParts = append(leftParts, stat)
		}
	}

	// Build left side
	left := strings.Join(leftParts, " │ ")

	// Build right side (hints)
	var rightParts []string
	for _, hint := range s.Hints {
		rightParts = append(rightParts, hintStyle.Render(hint))
	}
	right := strings.Join(rightParts, "  ")

	// Calculate padding to fill width
	leftWidth := lipgloss.Width(left)
	rightWidth := lipgloss.Width(right)
	padding := width - leftWidth - rightWidth - 2 // -2 for padding

	if padding < 1 {
		padding = 1
	}

	// Combine
	bar := left + strings.Repeat(" ", padding) + right
	return statusBarStyle.Width(width).Render(bar)
}

func (s *StatusBar) renderError(width int) string {
	// Warning icon and error message
	message := fmt.Sprintf(" %s", s.Error)

	// Truncate if too long
	maxLen := width - 4 // Leave room for icon and padding
	if len(message) > maxLen && maxLen > 3 {
		message = message[:maxLen-3] + "..."
	}

	return warningBarStyle.Width(width).Render(message)
}

// IsShowingError returns true if an error is currently being displayed
func (s *StatusBar) IsShowingError() bool {
	if s.Error == "" {
		return false
	}
	if !s.ErrorExpiry.IsZero() && time.Now().After(s.ErrorExpiry) {
		return false
	}
	return true
}
