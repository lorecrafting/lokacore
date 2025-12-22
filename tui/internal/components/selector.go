// Package components provides reusable UI components for the TUI.
package components

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// SelectorItem represents an item that can be selected
type SelectorItem struct {
	Key         string
	Name        string
	Description string
	Type        string
	Tags        []string
}

// Selector is a searchable list selector component
type Selector struct {
	Title    string
	Items    []SelectorItem
	filtered []SelectorItem
	cursor   int
	search   string
	width    int
	height   int
}

// Selector styles
var (
	selectorBorder = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("39")).
			Padding(0, 1)

	selectorTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	selectorSearch = lipgloss.NewStyle().
			Foreground(lipgloss.Color("39")).
			MarginBottom(1)

	selectorItemStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("252"))

	selectorSelectedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("229")).
				Background(lipgloss.Color("236")).
				Bold(true)

	selectorKeyStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("241"))

	selectorTypeStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("39"))

	selectorHelpStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("241")).
				MarginTop(1)
)

// NewSelector creates a new Selector component
func NewSelector(title string, items []SelectorItem) *Selector {
	s := &Selector{
		Title:    title,
		Items:    items,
		filtered: items,
		cursor:   0,
		search:   "",
	}
	return s
}

// SetSize sets the dimensions of the selector
func (s *Selector) SetSize(width, height int) {
	s.width = width
	s.height = height
}

// Selected returns the currently selected item, or nil if none
func (s *Selector) Selected() *SelectorItem {
	if len(s.filtered) == 0 {
		return nil
	}
	if s.cursor >= 0 && s.cursor < len(s.filtered) {
		return &s.filtered[s.cursor]
	}
	return nil
}

// Update handles keyboard input and returns (closed, selected, item)
func (s *Selector) Update(msg tea.Msg) (closed bool, selected bool, item *SelectorItem) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if s.cursor > 0 {
				s.cursor--
			}
		case "down", "j":
			if s.cursor < len(s.filtered)-1 {
				s.cursor++
			}
		case "enter":
			if len(s.filtered) > 0 {
				return true, true, s.Selected()
			}
		case "esc":
			return true, false, nil
		case "backspace":
			if len(s.search) > 0 {
				s.search = s.search[:len(s.search)-1]
				s.updateFilter()
			}
		default:
			// Add to search if it's a printable character
			if len(msg.String()) == 1 {
				char := msg.String()[0]
				if char >= ' ' && char <= '~' {
					s.search += msg.String()
					s.updateFilter()
				}
			}
		}
	}
	return false, false, nil
}

func (s *Selector) updateFilter() {
	if s.search == "" {
		s.filtered = s.Items
	} else {
		search := strings.ToLower(s.search)
		var filtered []SelectorItem
		for _, item := range s.Items {
			// Match against key, name, or tags
			if strings.Contains(strings.ToLower(item.Key), search) ||
				strings.Contains(strings.ToLower(item.Name), search) ||
				containsTag(item.Tags, search) {
				filtered = append(filtered, item)
			}
		}
		s.filtered = filtered
	}

	// Reset cursor if out of bounds
	if s.cursor >= len(s.filtered) {
		s.cursor = len(s.filtered) - 1
	}
	if s.cursor < 0 {
		s.cursor = 0
	}
}

func containsTag(tags []string, search string) bool {
	for _, tag := range tags {
		if strings.Contains(strings.ToLower(tag), search) {
			return true
		}
	}
	return false
}

// View renders the selector
func (s *Selector) View() string {
	var content strings.Builder

	// Title
	content.WriteString(selectorTitle.Render(s.Title))
	content.WriteString("\n")

	// Search bar
	searchDisplay := s.search
	if searchDisplay == "" {
		searchDisplay = "(type to search)"
	}
	content.WriteString(selectorSearch.Render(fmt.Sprintf("Search: %s", searchDisplay)))
	content.WriteString("\n\n")

	// Item list
	maxItems := 10
	if s.height > 0 {
		maxItems = s.height - 8 // Account for title, search, help, borders
		if maxItems < 5 {
			maxItems = 5
		}
	}

	// Calculate visible window
	startIdx := 0
	if s.cursor >= maxItems {
		startIdx = s.cursor - maxItems + 1
	}

	if len(s.filtered) == 0 {
		content.WriteString(selectorItemStyle.Render("  (no matching items)"))
		content.WriteString("\n")
	} else {
		for i := startIdx; i < len(s.filtered) && i < startIdx+maxItems; i++ {
			item := s.filtered[i]

			// Format item line
			line := fmt.Sprintf("  %s", item.Name)
			if item.Key != item.Name {
				line += selectorKeyStyle.Render(fmt.Sprintf(" (%s)", item.Key))
			}
			if item.Type != "" {
				line += " " + selectorTypeStyle.Render(fmt.Sprintf("[%s]", item.Type))
			}

			if i == s.cursor {
				content.WriteString(selectorSelectedStyle.Render("> " + item.Name))
				if item.Key != item.Name {
					content.WriteString(selectorKeyStyle.Render(fmt.Sprintf(" (%s)", item.Key)))
				}
				if item.Type != "" {
					content.WriteString(" " + selectorTypeStyle.Render(fmt.Sprintf("[%s]", item.Type)))
				}
			} else {
				content.WriteString(selectorItemStyle.Render(line))
			}
			content.WriteString("\n")
		}

		// Scroll indicator
		if len(s.filtered) > maxItems {
			content.WriteString(selectorKeyStyle.Render(fmt.Sprintf("  ... showing %d-%d of %d",
				startIdx+1, min(startIdx+maxItems, len(s.filtered)), len(s.filtered))))
			content.WriteString("\n")
		}
	}

	// Help
	content.WriteString(selectorHelpStyle.Render("  ↑/↓: Navigate  Enter: Select  Esc: Cancel"))

	// Apply border
	return selectorBorder.Render(content.String())
}

// ViewOverlay renders the selector as a centered overlay
func (s *Selector) ViewOverlay(background string, width, height int) string {
	s.width = width
	s.height = height

	selector := s.View()

	// Get selector dimensions
	selectorHeight := lipgloss.Height(selector)
	selectorWidth := lipgloss.Width(selector)

	// Calculate position to center
	topPadding := (height - selectorHeight) / 2
	leftPadding := (width - selectorWidth) / 2

	if topPadding < 0 {
		topPadding = 0
	}
	if leftPadding < 0 {
		leftPadding = 0
	}

	// Build the overlay
	bgLines := strings.Split(background, "\n")
	var result strings.Builder

	// Top padding
	for i := 0; i < topPadding && i < len(bgLines); i++ {
		result.WriteString(overlayStyle.Render(bgLines[i]))
		result.WriteString("\n")
	}

	// Selector lines
	selectorLines := strings.Split(selector, "\n")
	for i, selectorLine := range selectorLines {
		bgLineIdx := topPadding + i
		var line strings.Builder

		// Left padding
		if bgLineIdx < len(bgLines) && leftPadding > 0 {
			bgLine := bgLines[bgLineIdx]
			if len(bgLine) >= leftPadding {
				line.WriteString(overlayStyle.Render(bgLine[:leftPadding]))
			} else {
				line.WriteString(overlayStyle.Render(bgLine))
				line.WriteString(strings.Repeat(" ", leftPadding-len(bgLine)))
			}
		} else {
			line.WriteString(strings.Repeat(" ", leftPadding))
		}

		// Selector content
		line.WriteString(selectorLine)

		// Right padding
		rightStart := leftPadding + lipgloss.Width(selectorLine)
		if bgLineIdx < len(bgLines) && rightStart < len(bgLines[bgLineIdx]) {
			line.WriteString(overlayStyle.Render(bgLines[bgLineIdx][rightStart:]))
		}

		result.WriteString(line.String())
		result.WriteString("\n")
	}

	// Bottom padding
	for i := topPadding + len(selectorLines); i < len(bgLines); i++ {
		result.WriteString(overlayStyle.Render(bgLines[i]))
		result.WriteString("\n")
	}

	return result.String()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
