import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SHORTCUT_DEFINITIONS, registerWorldBuilderShortcuts } from '../KeyboardShortcuts.js'

describe('KeyboardShortcuts', () => {
  describe('SHORTCUT_DEFINITIONS', () => {
    it('is an array of shortcut definitions', () => {
      expect(Array.isArray(SHORTCUT_DEFINITIONS)).toBe(true)
      expect(SHORTCUT_DEFINITIONS.length).toBeGreaterThan(0)
    })

    it('all definitions have required fields', () => {
      for (const shortcut of SHORTCUT_DEFINITIONS) {
        expect(shortcut).toHaveProperty('id')
        expect(shortcut).toHaveProperty('combo')
        expect(shortcut).toHaveProperty('action')
        expect(typeof shortcut.id).toBe('string')
        expect(typeof shortcut.action).toBe('string')
        expect(typeof shortcut.combo).toBe('object')
        expect(shortcut.combo).toHaveProperty('key')
      }
    })

    it('all IDs are prefixed with wb-', () => {
      for (const shortcut of SHORTCUT_DEFINITIONS) {
        expect(shortcut.id.startsWith('wb-')).toBe(true)
      }
    })

    it('all IDs are unique', () => {
      const ids = SHORTCUT_DEFINITIONS.map((s) => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    describe('undo/redo shortcuts', () => {
      it('has undo shortcut (Cmd/Ctrl+Z)', () => {
        const undo = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-undo')
        expect(undo).toBeDefined()
        expect(undo.combo.key).toBe('z')
        expect(undo.combo.mod).toBe(true)
        expect(undo.combo.shift).toBe(false)
        expect(undo.action).toBe('undo')
      })

      it('has redo shortcut with Shift+Z', () => {
        const redo = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-redo-z')
        expect(redo).toBeDefined()
        expect(redo.combo.key).toBe('z')
        expect(redo.combo.mod).toBe(true)
        expect(redo.combo.shift).toBe(true)
        expect(redo.action).toBe('redo')
      })

      it('has redo shortcut with Y', () => {
        const redo = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-redo-y')
        expect(redo).toBeDefined()
        expect(redo.combo.key).toBe('y')
        expect(redo.combo.mod).toBe(true)
        expect(redo.action).toBe('redo')
      })
    })

    describe('save shortcut', () => {
      it('has save shortcut (Cmd/Ctrl+S)', () => {
        const save = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-save')
        expect(save).toBeDefined()
        expect(save.combo.key).toBe('s')
        expect(save.combo.mod).toBe(true)
        expect(save.action).toBe('save')
      })
    })

    describe('delete shortcuts', () => {
      it('has delete key shortcut with skipInputs', () => {
        const del = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-delete')
        expect(del).toBeDefined()
        expect(del.combo.key).toBe('delete')
        expect(del.action).toBe('deleteSelected')
        expect(del.options.skipInputs).toBe(true)
      })

      it('has backspace shortcut with skipInputs', () => {
        const backspace = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-backspace')
        expect(backspace).toBeDefined()
        expect(backspace.combo.key).toBe('backspace')
        expect(backspace.action).toBe('deleteSelected')
        expect(backspace.options.skipInputs).toBe(true)
      })
    })

    describe('duplicate shortcut', () => {
      it('has duplicate shortcut (Cmd/Ctrl+D)', () => {
        const duplicate = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-duplicate')
        expect(duplicate).toBeDefined()
        expect(duplicate.combo.key).toBe('d')
        expect(duplicate.combo.mod).toBe(true)
        expect(duplicate.action).toBe('duplicate')
      })
    })

    describe('select all shortcut', () => {
      it('has select all shortcut (Cmd/Ctrl+A)', () => {
        const selectAll = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-select-all')
        expect(selectAll).toBeDefined()
        expect(selectAll.combo.key).toBe('a')
        expect(selectAll.combo.mod).toBe(true)
        expect(selectAll.action).toBe('selectAll')
      })
    })

    describe('escape shortcut', () => {
      it('has escape shortcut that fires even in inputs and modals', () => {
        const escape = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-escape')
        expect(escape).toBeDefined()
        expect(escape.combo.key).toBe('escape')
        expect(escape.action).toBe('escape')
        expect(escape.options.skipInputs).toBe(false)
        expect(escape.options.skipModals).toBe(false)
      })
    })

    describe('panel toggle shortcuts', () => {
      it('has panel toggle shortcuts for keys 1-4', () => {
        const panels = ['hierarchy', 'inspector', 'console', 'chat']
        panels.forEach((panel, i) => {
          const shortcut = SHORTCUT_DEFINITIONS.find((s) => s.id === `wb-panel-${i + 1}`)
          expect(shortcut).toBeDefined()
          expect(shortcut.combo.key).toBe(String(i + 1))
          expect(shortcut.action).toBe(`togglePanel_${panel}`)
        })
      })

      it('has backtick shortcut for console toggle', () => {
        const console = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-console')
        expect(console).toBeDefined()
        expect(console.combo.key).toBe('`')
        expect(console.action).toBe('togglePanel_console')
      })
    })

    describe('new room shortcut', () => {
      it('has N key for new room', () => {
        const newRoom = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-new-room')
        expect(newRoom).toBeDefined()
        expect(newRoom.combo.key).toBe('n')
        expect(newRoom.action).toBe('newRoom')
      })
    })

    describe('search shortcut', () => {
      it('has / key for search focus', () => {
        const search = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-search')
        expect(search).toBeDefined()
        expect(search.combo.key).toBe('/')
        expect(search.action).toBe('focusSearch')
      })
    })

    describe('git shortcut', () => {
      it('has Cmd/Ctrl+G for git commit', () => {
        const git = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-git')
        expect(git).toBeDefined()
        expect(git.combo.key).toBe('g')
        expect(git.combo.mod).toBe(true)
        expect(git.action).toBe('gitCommit')
      })
    })

    describe('viewport control shortcuts', () => {
      it('has G key for grid toggle', () => {
        const grid = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-grid')
        expect(grid).toBeDefined()
        expect(grid.combo.key).toBe('g')
        expect(grid.combo.mod).toBeFalsy()
        expect(grid.action).toBe('toggleGrid')
      })

      it('has F key for fit to rooms', () => {
        const fit = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-fit')
        expect(fit).toBeDefined()
        expect(fit.combo.key).toBe('f')
        expect(fit.action).toBe('fitToRooms')
      })

      it('has R key for reset camera', () => {
        const reset = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-reset')
        expect(reset).toBeDefined()
        expect(reset.combo.key).toBe('r')
        expect(reset.action).toBe('resetCamera')
      })
    })

    describe('z-level shortcuts', () => {
      it('has Cmd/Ctrl+ArrowUp for z-level up', () => {
        const zUp = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-zlevel-up')
        expect(zUp).toBeDefined()
        expect(zUp.combo.key).toBe('arrowup')
        expect(zUp.combo.mod).toBe(true)
        expect(zUp.action).toBe('zLevelUp')
      })

      it('has Cmd/Ctrl+ArrowDown for z-level down', () => {
        const zDown = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-zlevel-down')
        expect(zDown).toBeDefined()
        expect(zDown.combo.key).toBe('arrowdown')
        expect(zDown.combo.mod).toBe(true)
        expect(zDown.action).toBe('zLevelDown')
      })
    })

    describe('display toggle shortcuts', () => {
      it('has Z key for zone colors toggle', () => {
        const zones = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-zones')
        expect(zones).toBeDefined()
        expect(zones.combo.key).toBe('z')
        expect(zones.combo.mod).toBeFalsy()
        expect(zones.action).toBe('toggleZoneColors')
      })

      it('has P key for NPC paths toggle', () => {
        const paths = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-paths')
        expect(paths).toBeDefined()
        expect(paths.combo.key).toBe('p')
        expect(paths.action).toBe('toggleNPCPaths')
      })
    })

    describe('help shortcut', () => {
      it('has ? key for help modal', () => {
        const help = SHORTCUT_DEFINITIONS.find((s) => s.id === 'wb-help')
        expect(help).toBeDefined()
        expect(help.combo.key).toBe('?')
        expect(help.action).toBe('showHelp')
      })
    })
  })

  describe('registerWorldBuilderShortcuts', () => {
    let mockKm
    let actions

    beforeEach(() => {
      mockKm = {
        register: vi.fn(),
        unregisterAll: vi.fn(),
      }

      actions = {
        undo: vi.fn(),
        redo: vi.fn(),
        save: vi.fn(),
        deleteSelected: vi.fn(),
        duplicate: vi.fn(),
        selectAll: vi.fn(),
        escape: vi.fn(),
        togglePanel_hierarchy: vi.fn(),
        togglePanel_inspector: vi.fn(),
        togglePanel_console: vi.fn(),
        togglePanel_chat: vi.fn(),
        newRoom: vi.fn(),
        focusSearch: vi.fn(),
        gitCommit: vi.fn(),
        toggleGrid: vi.fn(),
        fitToRooms: vi.fn(),
        resetCamera: vi.fn(),
        zLevelUp: vi.fn(),
        zLevelDown: vi.fn(),
        toggleZoneColors: vi.fn(),
        toggleNPCPaths: vi.fn(),
        showHelp: vi.fn(),
      }
    })

    it('registers all shortcuts with matching handlers', () => {
      registerWorldBuilderShortcuts(mockKm, actions)

      // Should have registered all shortcuts that have handlers
      expect(mockKm.register).toHaveBeenCalledTimes(SHORTCUT_DEFINITIONS.length)
    })

    it('passes correct arguments to km.register', () => {
      registerWorldBuilderShortcuts(mockKm, actions)

      // Check the undo shortcut registration
      expect(mockKm.register).toHaveBeenCalledWith(
        'wb-undo',
        { key: 'z', mod: true, shift: false },
        actions.undo,
        {}
      )
    })

    it('passes options when defined', () => {
      registerWorldBuilderShortcuts(mockKm, actions)

      // Check delete shortcut has skipInputs option
      expect(mockKm.register).toHaveBeenCalledWith(
        'wb-delete',
        { key: 'delete', mod: false },
        actions.deleteSelected,
        { skipInputs: true }
      )
    })

    it('warns for missing handlers', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const partialActions = { undo: vi.fn() }

      registerWorldBuilderShortcuts(mockKm, partialActions)

      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('No handler for action')

      consoleSpy.mockRestore()
    })

    it('skips registration for missing handlers', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const partialActions = { undo: vi.fn() }

      registerWorldBuilderShortcuts(mockKm, partialActions)

      // Should only register shortcuts that have handlers
      expect(mockKm.register).toHaveBeenCalledTimes(1)
      expect(mockKm.register).toHaveBeenCalledWith(
        'wb-undo',
        expect.any(Object),
        partialActions.undo,
        expect.any(Object)
      )
    })

    it('uses the correct handler for each action', () => {
      registerWorldBuilderShortcuts(mockKm, actions)

      // Find the registration call for save
      const saveCall = mockKm.register.mock.calls.find((call) => call[0] === 'wb-save')
      expect(saveCall).toBeDefined()
      expect(saveCall[2]).toBe(actions.save)

      // Find the registration call for duplicate
      const dupCall = mockKm.register.mock.calls.find((call) => call[0] === 'wb-duplicate')
      expect(dupCall).toBeDefined()
      expect(dupCall[2]).toBe(actions.duplicate)
    })

    it('handles empty actions gracefully', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(() => {
        registerWorldBuilderShortcuts(mockKm, {})
      }).not.toThrow()

      expect(mockKm.register).not.toHaveBeenCalled()
    })
  })
})
