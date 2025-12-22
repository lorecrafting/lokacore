// Package components provides reusable UI components for the TUI.
package components

import (
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// SearchBar provides search/filter functionality for tabs
type SearchBar struct {
	input   textinput.Model
	active  bool
	filter  string
	width   int
}

// SearchBar styles
var (
	searchBarStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("39")).
		Padding(0, 1)

	searchLabelStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("39")).
		Bold(true)

	searchFilterStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Padding(0, 1)
)

// SearchBar key bindings
type SearchKeyMap struct {
	Open   key.Binding
	Close  key.Binding
	Clear  key.Binding
	Submit key.Binding
}

var searchKeys = SearchKeyMap{
	Open:   key.NewBinding(key.WithKeys("/"), key.WithHelp("/", "Search")),
	Close:  key.NewBinding(key.WithKeys("esc"), key.WithHelp("Esc", "Cancel")),
	Clear:  key.NewBinding(key.WithKeys("esc"), key.WithHelp("Esc", "Clear")),
	Submit: key.NewBinding(key.WithKeys("enter"), key.WithHelp("Enter", "Apply")),
}

// NewSearchBar creates a new search bar
func NewSearchBar() *SearchBar {
	ti := textinput.New()
	ti.Placeholder = "Search..."
	ti.CharLimit = 50
	ti.Width = 30

	return &SearchBar{
		input:  ti,
		active: false,
	}
}

// SetWidth sets the width of the search bar
func (s *SearchBar) SetWidth(width int) {
	s.width = width
	s.input.Width = width - 15 // Account for label and padding
	if s.input.Width < 20 {
		s.input.Width = 20
	}
}

// IsActive returns whether the search bar is currently active
func (s *SearchBar) IsActive() bool {
	return s.active
}

// Filter returns the current filter string
func (s *SearchBar) Filter() string {
	return s.filter
}

// HasFilter returns whether a filter is currently applied
func (s *SearchBar) HasFilter() bool {
	return s.filter != ""
}

// Open activates the search bar
func (s *SearchBar) Open() tea.Cmd {
	s.active = true
	s.input.SetValue(s.filter)
	s.input.Focus()
	return textinput.Blink
}

// Close deactivates the search bar without applying
func (s *SearchBar) Close() {
	s.active = false
	s.input.Blur()
}

// Apply applies the current input as filter and closes
func (s *SearchBar) Apply() {
	s.filter = strings.TrimSpace(s.input.Value())
	s.active = false
	s.input.Blur()
}

// Clear clears the filter
func (s *SearchBar) Clear() {
	s.filter = ""
	s.input.SetValue("")
}

// Update handles messages when the search bar is active
// Returns: (handled, tea.Cmd)
// handled is true if the message was consumed by the search bar
func (s *SearchBar) Update(msg tea.Msg) (bool, tea.Cmd) {
	if !s.active {
		// Check for open key
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			if key.Matches(keyMsg, searchKeys.Open) {
				return true, s.Open()
			}
			// Check for clear when filter is active (esc when not searching)
			if key.Matches(keyMsg, searchKeys.Clear) && s.HasFilter() {
				s.Clear()
				return true, nil
			}
		}
		return false, nil
	}

	// Handle input when active
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, searchKeys.Close):
			s.Close()
			return true, nil
		case key.Matches(msg, searchKeys.Submit):
			s.Apply()
			return true, nil
		}
	}

	// Forward to input
	var cmd tea.Cmd
	s.input, cmd = s.input.Update(msg)
	return true, cmd
}

// View renders the search bar
func (s *SearchBar) View() string {
	if s.active {
		return searchBarStyle.Render(
			searchLabelStyle.Render("Search: ") + s.input.View(),
		)
	}
	return ""
}

// FilterIndicator renders a small indicator when filter is active
func (s *SearchBar) FilterIndicator() string {
	if s.filter != "" && !s.active {
		return searchFilterStyle.Render("Filter: " + s.filter)
	}
	return ""
}

// Matches returns true if the given text matches the current filter
func (s *SearchBar) Matches(text string) bool {
	if s.filter == "" {
		return true
	}
	return strings.Contains(strings.ToLower(text), strings.ToLower(s.filter))
}

// MatchesAny returns true if any of the given texts match the filter
func (s *SearchBar) MatchesAny(texts ...string) bool {
	if s.filter == "" {
		return true
	}
	filterLower := strings.ToLower(s.filter)
	for _, text := range texts {
		if strings.Contains(strings.ToLower(text), filterLower) {
			return true
		}
	}
	return false
}

// HelpText returns help text for the search bar
func (s *SearchBar) HelpText() string {
	if s.active {
		return "Enter: Apply  Esc: Cancel"
	}
	if s.HasFilter() {
		return "Esc: Clear filter  /: Search"
	}
	return "/: Search"
}
