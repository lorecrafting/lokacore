package cmd

import (
	"fmt"
	"os"

	"github.com/lokacore/tui/internal/app"
	"github.com/spf13/cobra"
)

var (
	socketPath string
	logLevel   string
)

var rootCmd = &cobra.Command{
	Use:   "exmud-tui",
	Short: "ExMUD Game Editor TUI",
	Long: `ExMUD Game Editor is a terminal-based interface for managing
your ExMUD game world. It connects to the Elixir server via Unix socket
and provides tools for editing rooms, entities, scripts, and more.`,
	Run: func(cmd *cobra.Command, args []string) {
		if err := app.Run(socketPath, logLevel); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.Flags().StringVar(&socketPath, "socket", "/tmp/exmud-tui-dev.sock", "Unix socket path to connect to")
	rootCmd.Flags().StringVar(&logLevel, "log-level", "info", "Log level (debug, info, warn, error)")
}

// Execute runs the root command
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
