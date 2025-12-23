// Package components provides reusable UI components for the TUI.
package components

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// EntityData represents entity data for the inspector.
type EntityData struct {
	ID          string
	Type        string
	Key         string
	Name        string
	Description string
	Components  map[string]interface{}
	Tags        []string

	// Exit-specific fields
	Direction       string
	DestinationID   string
	DestinationName string
	DestinationKey  string
}

// EntityInspector displays full entity details in a modal.
type EntityInspector struct {
	Entity       *EntityData
	expanded     map[string]bool // Track which component sections are expanded
	scrollOffset int
	maxScroll    int
	selectedItem int // Currently selected item for expansion
	items        []inspectorItem
	width        int
	height       int
}

type inspectorItem struct {
	key      string
	isHeader bool
	depth    int
	content  string
}

// Styles for the inspector
var (
	inspectorBorder = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("39")).
			Padding(1, 2)

	inspectorTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	inspectorLabel = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241"))

	inspectorValue = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252"))

	inspectorKeyValue = lipgloss.NewStyle().
				Foreground(lipgloss.Color("39"))

	inspectorSection = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("229")).
				MarginTop(1)

	inspectorExpandable = lipgloss.NewStyle().
				Foreground(lipgloss.Color("39"))

	inspectorSelected = lipgloss.NewStyle().
				Background(lipgloss.Color("237")).
				Foreground(lipgloss.Color("229"))

	inspectorTag = lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Background(lipgloss.Color("236")).
			Padding(0, 1)

	inspectorHelp = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			MarginTop(1)
)

// NewEntityInspector creates a new entity inspector.
func NewEntityInspector(entity *EntityData) *EntityInspector {
	ei := &EntityInspector{
		Entity:   entity,
		expanded: make(map[string]bool),
	}
	ei.buildItems()
	return ei
}

// SetSize sets the available screen size.
func (ei *EntityInspector) SetSize(width, height int) {
	ei.width = width
	ei.height = height
}

// Update handles keyboard input. Returns true if inspector should close.
func (ei *EntityInspector) Update(msg tea.Msg) (closed bool) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "q":
			return true
		case "up", "k":
			if ei.selectedItem > 0 {
				ei.selectedItem--
				ei.ensureVisible()
			}
		case "down", "j":
			if ei.selectedItem < len(ei.items)-1 {
				ei.selectedItem++
				ei.ensureVisible()
			}
		case "enter", " ":
			ei.toggleExpand()
		case "pgup":
			ei.scrollOffset -= 10
			if ei.scrollOffset < 0 {
				ei.scrollOffset = 0
			}
		case "pgdown":
			ei.scrollOffset += 10
			if ei.scrollOffset > ei.maxScroll {
				ei.scrollOffset = ei.maxScroll
			}
		}
	}
	return false
}

func (ei *EntityInspector) toggleExpand() {
	if ei.selectedItem < 0 || ei.selectedItem >= len(ei.items) {
		return
	}
	item := ei.items[ei.selectedItem]
	if item.isHeader {
		ei.expanded[item.key] = !ei.expanded[item.key]
		ei.buildItems()
	}
}

func (ei *EntityInspector) ensureVisible() {
	// Ensure selected item is visible in scroll area
	visibleHeight := ei.height - 10 // Account for header and footer
	if visibleHeight < 5 {
		visibleHeight = 5
	}

	if ei.selectedItem < ei.scrollOffset {
		ei.scrollOffset = ei.selectedItem
	} else if ei.selectedItem >= ei.scrollOffset+visibleHeight {
		ei.scrollOffset = ei.selectedItem - visibleHeight + 1
	}
}

func (ei *EntityInspector) buildItems() {
	ei.items = nil
	e := ei.Entity

	// Basic properties (always shown, not expandable)
	ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("Type: %s", e.Type)})
	ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("Key: %s", e.Key)})
	ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("ID: %s", e.ID)})

	if e.Description != "" {
		ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("Description: %s", truncate(e.Description, 60))})
	}

	// Exit-specific fields
	if e.Direction != "" {
		ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("Direction: %s", e.Direction)})
	}
	if e.DestinationName != "" {
		ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("Destination: %s (%s)", e.DestinationName, e.DestinationKey)})
	}

	// Tags
	if len(e.Tags) > 0 {
		ei.items = append(ei.items, inspectorItem{content: fmt.Sprintf("Tags: %s", strings.Join(e.Tags, ", "))})
	}

	// Components section
	if len(e.Components) > 0 {
		ei.items = append(ei.items, inspectorItem{content: ""}) // Spacer

		// Sort component keys for consistent ordering
		keys := make([]string, 0, len(e.Components))
		for k := range e.Components {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, key := range keys {
			value := e.Components[key]
			isExpanded := ei.expanded[key]

			// Component header (expandable)
			prefix := "+"
			if isExpanded {
				prefix = "-"
			}
			ei.items = append(ei.items, inspectorItem{
				key:      key,
				isHeader: true,
				content:  fmt.Sprintf("%s %s", prefix, key),
			})

			// Component contents (if expanded)
			if isExpanded {
				ei.addComponentContents(key, value, 1)
			}
		}
	}

	// Calculate max scroll
	visibleHeight := ei.height - 10
	if visibleHeight < 5 {
		visibleHeight = 5
	}
	ei.maxScroll = len(ei.items) - visibleHeight
	if ei.maxScroll < 0 {
		ei.maxScroll = 0
	}
}

func (ei *EntityInspector) addComponentContents(key string, value interface{}, depth int) {
	indent := strings.Repeat("  ", depth)

	switch v := value.(type) {
	case map[string]interface{}:
		// Sort keys
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			subValue := v[k]
			switch sv := subValue.(type) {
			case map[string]interface{}:
				ei.items = append(ei.items, inspectorItem{
					depth:   depth,
					content: fmt.Sprintf("%s%s:", indent, k),
				})
				ei.addComponentContents(key+"."+k, sv, depth+1)
			default:
				ei.items = append(ei.items, inspectorItem{
					depth:   depth,
					content: fmt.Sprintf("%s%s: %v", indent, k, formatValue(sv)),
				})
			}
		}
	default:
		ei.items = append(ei.items, inspectorItem{
			depth:   depth,
			content: fmt.Sprintf("%s%v", indent, formatValue(v)),
		})
	}
}

func formatValue(v interface{}) string {
	switch val := v.(type) {
	case float64:
		// Check if it's a whole number
		if val == float64(int(val)) {
			return fmt.Sprintf("%d", int(val))
		}
		return fmt.Sprintf("%.2f", val)
	case string:
		if len(val) > 50 {
			return val[:47] + "..."
		}
		return val
	case []interface{}:
		if len(val) == 0 {
			return "[]"
		}
		items := make([]string, 0, len(val))
		for _, item := range val {
			items = append(items, fmt.Sprintf("%v", item))
		}
		result := "[" + strings.Join(items, ", ") + "]"
		if len(result) > 50 {
			return result[:47] + "...]"
		}
		return result
	case nil:
		return "null"
	default:
		// Try to JSON marshal complex values
		data, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprintf("%v", val)
		}
		s := string(data)
		if len(s) > 50 {
			return s[:47] + "..."
		}
		return s
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// View renders the inspector.
func (ei *EntityInspector) View() string {
	var content strings.Builder

	// Title
	title := inspectorTitle.Render(fmt.Sprintf("  %s", ei.Entity.Name))
	content.WriteString(title)
	content.WriteString("\n\n")

	// Calculate visible area
	visibleHeight := ei.height - 10
	if visibleHeight < 5 {
		visibleHeight = 5
	}

	// Render visible items
	for i := ei.scrollOffset; i < len(ei.items) && i < ei.scrollOffset+visibleHeight; i++ {
		item := ei.items[i]

		var line string
		if item.isHeader {
			// Expandable header
			line = inspectorExpandable.Render(item.content)
		} else if item.depth > 0 {
			// Indented component value
			line = inspectorValue.Render(item.content)
		} else {
			// Regular property
			parts := strings.SplitN(item.content, ": ", 2)
			if len(parts) == 2 {
				line = inspectorLabel.Render(parts[0]+": ") + inspectorValue.Render(parts[1])
			} else {
				line = inspectorValue.Render(item.content)
			}
		}

		// Highlight selected item
		if i == ei.selectedItem {
			line = inspectorSelected.Render(">" + line)
		} else {
			line = " " + line
		}

		content.WriteString(line)
		content.WriteString("\n")
	}

	// Scroll indicator
	if ei.maxScroll > 0 {
		scrollPct := float64(ei.scrollOffset) / float64(ei.maxScroll) * 100
		content.WriteString(inspectorLabel.Render(fmt.Sprintf("\n [%d%%]", int(scrollPct))))
	}

	// Help text
	help := inspectorHelp.Render("  ↑/↓:Navigate  Enter:Expand  Esc:Close")
	content.WriteString("\n")
	content.WriteString(help)

	// Apply border
	dialog := inspectorBorder.Render(content.String())

	return dialog
}

// ViewOverlay renders the inspector as a centered overlay.
func (ei *EntityInspector) ViewOverlay(background string, width, height int) string {
	ei.width = width
	ei.height = height
	ei.buildItems() // Rebuild with new dimensions

	// Render the inspector
	dialog := ei.View()

	// Get dialog dimensions
	dialogHeight := lipgloss.Height(dialog)
	dialogWidth := lipgloss.Width(dialog)

	// Calculate position to center
	topPadding := (height - dialogHeight) / 2
	leftPadding := (width - dialogWidth) / 2

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
	for i := 0; i < topPadding; i++ {
		if i < len(bgLines) {
			result.WriteString(overlayStyle.Render(bgLines[i]))
		}
		result.WriteString("\n")
	}

	// Dialog lines
	dialogLines := strings.Split(dialog, "\n")
	for i, dialogLine := range dialogLines {
		bgLineIdx := topPadding + i
		var line strings.Builder

		// Left padding (use dimmed background if available)
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

		// Dialog content
		line.WriteString(dialogLine)

		// Right padding
		rightStart := leftPadding + lipgloss.Width(dialogLine)
		if bgLineIdx < len(bgLines) && rightStart < len(bgLines[bgLineIdx]) {
			line.WriteString(overlayStyle.Render(bgLines[bgLineIdx][rightStart:]))
		}

		result.WriteString(line.String())
		result.WriteString("\n")
	}

	// Bottom padding
	for i := topPadding + len(dialogLines); i < len(bgLines); i++ {
		result.WriteString(overlayStyle.Render(bgLines[i]))
		result.WriteString("\n")
	}

	return result.String()
}
