"""Controlled git/status inputs; run with python3 bin/test_board.py."""
import importlib.machinery
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

loader = importlib.machinery.SourceFileLoader('board', str(pathlib.Path(__file__).with_name('board')))
spec = importlib.util.spec_from_loader(loader.name, loader)
board = importlib.util.module_from_spec(spec)
loader.exec_module(board)


class BoardTest(unittest.TestCase):
    # Break: a dirty checkout is falsely displayed as an active build or review approval.
    def test_git_facts_do_not_invent_operational_phase(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = pathlib.Path(directory)
            def git(*args):
                subprocess.run(['git', '-C', directory, *args], check=True, capture_output=True)
            git('init', '-b', 'main')
            git('config', 'user.name', 'Board Test')
            git('config', 'user.email', 'board@example.invalid')
            (repo / 'docs').mkdir()
            (repo / 'docs/MISSING-CHILD-PLAN.md').write_text('| **A3 Finale: acknowledge an ending.** | A1, A2 | 1.0 |\n')
            (repo / 'docs/ROADMAP.md').write_text('completion slices (A1, B1).\n')
            git('add', 'docs')
            git('commit', '-m', 'Controlled baseline')
            git('update-ref', 'refs/remotes/origin/main', 'HEAD')
            (repo / 'dirty').write_text('work in progress')
            data = board.snapshot(repo, repo / 'notes')
            self.assertEqual(data['notes'], [])
            self.assertEqual(data['rows'][0]['roadmap'], 'candidate')
            self.assertEqual(data['rows'][0]['reports'], [])
            self.assertEqual(data['worktrees'][0]['dirty'], 1)
            self.assertEqual(data['divergence'].split(), ['0', '0'])

    # Break: malformed lines erase valid reports, or supplied paths/markup leak into HTML.
    def test_reports_keep_duration_and_redact_rendered_activity(self):
        with tempfile.TemporaryDirectory() as directory:
            notes = pathlib.Path(directory) / 'notes'
            notes.write_text('{broken\n{"unit":"A3","phase":"checks","at":"2026-10-05T22:00:00Z","activity":"<script> /Users/example/private","seconds":5.4}\n')
            reports, errors = board.read_notes(notes)
            self.assertEqual(errors, 1)
            self.assertEqual(reports[0]['seconds'], 5.4)
            output = board.render(dict(at='now', notes=reports, note_errors=errors, rows=[],
                                      worktrees=[], local=None, remote=None, divergence=None,
                                      commits=None, prs=None, github_requested=False))
            self.assertNotIn('/Users/example', output)
            self.assertNotIn('<script>', output)
            self.assertIn('&lt;script&gt; [local path]', output)
            self.assertIn('5.4', output)


if __name__ == '__main__':
    unittest.main()
