// Package components provides reusable UI components for the TUI.
package components

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Dialog represents a modal confirmation dialog
type Dialog struct {
	Title       string
	Message     string
	ConfirmText string
	CancelText  string
	Danger      bool
	focused     int // 0=cancel, 1=confirm
	width       int
	height      int
}

// Styles for the dialog
var (
	dialogBorder = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240")).
			Padding(1, 2)

	dialogDangerBorder = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("196")).
				Padding(1, 2)

	dialogTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("229")).
			MarginBottom(1)

	dialogDangerTitle = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("196")).
				MarginBottom(1)

	dialogMessage = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")).
			MarginBottom(1)

	buttonStyle = lipgloss.NewStyle().
			Padding(0, 2).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240"))

	buttonFocusedStyle = lipgloss.NewStyle().
				Padding(0, 2).
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("39")).
				Bold(true)

	buttonDangerStyle = lipgloss.NewStyle().
				Padding(0, 2).
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("196")).
				Foreground(lipgloss.Color("196"))

	buttonDangerFocusedStyle = lipgloss.NewStyle().
					Padding(0, 2).
					Border(lipgloss.RoundedBorder()).
					BorderForeground(lipgloss.Color("196")).
					Background(lipgloss.Color("196")).
					Foreground(lipgloss.Color("231")).
					Bold(true)

	overlayStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241"))
)

// NewConfirmDialog creates a standard confirmation dialog
func NewConfirmDialog(title, message string) *Dialog {
	return &Dialog{
		Title:       title,
		Message:     message,
		ConfirmText: "Confirm",
		CancelText:  "Cancel",
		focused:     0, // Default to Cancel
	}
}

// NewDangerDialog creates a danger/destructive action dialog
func NewDangerDialog(title, message, confirmText string) *Dialog {
	return &Dialog{
		Title:       title,
		Message:     message,
		ConfirmText: confirmText,
		CancelText:  "Cancel",
		Danger:      true,
		focused:     0, // Default to Cancel for safety
	}
}

// SetSize sets the available screen size for centering
func (d *Dialog) SetSize(width, height int) {
	d.width = width
	d.height = height
}

// Update handles keyboard input and returns (closed, confirmed)
func (d *Dialog) Update(msg tea.Msg) (closed bool, confirmed bool) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab", "left", "right", "h", "l":
			d.focused = (d.focused + 1) % 2
		case "enter":
			return true, d.focused == 1
		case "esc":
			return true, false
		case "y", "Y":
			// Quick confirm with 'y'
			return true, true
		case "n", "N":
			// Quick cancel with 'n'
			return true, false
		}
	}
	return false, false
}

// View renders the dialog
func (d *Dialog) View() string {
	// Build title
	var title string
	if d.Danger {
		title = dialogDangerTitle.Render(d.Title)
	} else {
		title = dialogTitle.Render(d.Title)
	}

	// Build message (wrap long lines)
	message := dialogMessage.Render(d.Message)

	// Build buttons
	cancelBtn := d.renderButton(d.CancelText, d.focused == 0, false)
	confirmBtn := d.renderButton(d.ConfirmText, d.focused == 1, d.Danger)

	buttons := lipgloss.JoinHorizontal(lipgloss.Center, cancelBtn, "  ", confirmBtn)

	// Help text
	help := lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		MarginTop(1).
		Render("Tab/←→: Switch  Enter: Select  Esc: Cancel")

	// Combine content
	content := lipgloss.JoinVertical(
		lipgloss.Center,
		title,
		message,
		"",
		buttons,
		help,
	)

	// Apply dialog border
	var dialog string
	if d.Danger {
		dialog = dialogDangerBorder.Render(content)
	} else {
		dialog = dialogBorder.Render(content)
	}

	// Center the dialog on screen if dimensions are set
	if d.width > 0 && d.height > 0 {
		return d.centerDialog(dialog)
	}

	return dialog
}

// ViewOverlay renders the dialog as a centered overlay on top of existing content
func (d *Dialog) ViewOverlay(background string, width, height int) string {
	d.width = width
	d.height = height

	// Render the dialog
	dialog := d.View()

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
	// First, dim the background
	bgLines := strings.Split(background, "\n")
	var dimmedBg strings.Builder
	for _, line := range bgLines {
		dimmedBg.WriteString(overlayStyle.Render(line))
		dimmedBg.WriteString("\n")
	}

	// Create the overlay with the dialog centered
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

		// Right padding (fill rest of line)
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

func (d *Dialog) renderButton(text string, focused bool, danger bool) string {
	if danger {
		if focused {
			return buttonDangerFocusedStyle.Render(text)
		}
		return buttonDangerStyle.Render(text)
	}

	if focused {
		return buttonFocusedStyle.Render(text)
	}
	return buttonStyle.Render(text)
}

func (d *Dialog) centerDialog(dialog string) string {
	dialogHeight := lipgloss.Height(dialog)
	dialogWidth := lipgloss.Width(dialog)

	// Calculate padding to center
	topPadding := (d.height - dialogHeight) / 2
	leftPadding := (d.width - dialogWidth) / 2

	if topPadding < 0 {
		topPadding = 0
	}
	if leftPadding < 0 {
		leftPadding = 0
	}

	// Add padding
	centered := lipgloss.NewStyle().
		MarginTop(topPadding).
		MarginLeft(leftPadding).
		Render(dialog)

	return centered
}
