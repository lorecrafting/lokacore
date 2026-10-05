"""Controlled git/status inputs; run with python3 bin/test_board.py."""
import concurrent.futures
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
            (repo / 'docs/MISSING-CHILD-PLAN.md').write_text('| **A3 Finale:** acknowledge an ending. | A1, A2 | 1.0 |\n| **A1 Bell:** choose prior. | Q2 | 0.9 |\n')
            (repo / 'docs/ROADMAP.md').write_text('This completes **4 of the 33** proposed Chapter 1 completion slices (A1, B1, A2, B2).\n')
            git('add', 'docs')
            git('commit', '-m', 'Controlled baseline')
            git('update-ref', 'refs/remotes/origin/main', 'HEAD')
            (repo / 'dirty').write_text('work in progress')
            data = board.snapshot(repo, repo / 'notes')
            self.assertEqual(data['notes'], [])
            self.assertEqual(data['rows'][0]['roadmap'], 'candidate')
            self.assertEqual(data['rows'][0]['reports'], [])
            self.assertEqual(data['rows'][1]['roadmap'], 'complete (roadmap)')
            self.assertEqual(data['rows'][0]['outcome'], 'Finale: acknowledge an ending.')
            self.assertEqual(data['worktrees'][0]['dirty'], 1)
            self.assertEqual(data['divergence'].split(), ['0', '0'])

            # Break: a nested clone's local origin is mistaken for published GitHub history.
            git('remote', 'add', 'origin', directory)
            self.assertIn('local mirror; publication unknown', board.snapshot(repo, repo / 'notes')['remote_label'])
            git('update-ref', 'refs/remotes/upstream/main', 'HEAD')
            (repo / 'next').write_text('unpublished change')
            git('add', 'next')
            git('commit', '-m', 'Local only')
            git('update-ref', 'refs/remotes/origin/main', 'HEAD')
            data = board.snapshot(repo, repo / 'notes')
            self.assertEqual(data['divergence'].split(), ['0', '1'])
            self.assertEqual(data['remote_label'], 'Cached upstream/main (publication baseline)')

    # Break: concurrent watch/note refreshes rename another writer's shared temporary file.
    def test_concurrent_refreshes_do_not_share_temporary_files(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / 'board.html'
            payloads = [f'<html>report {n}</html>' for n in range(72)]
            with concurrent.futures.ThreadPoolExecutor(max_workers=24) as workers:
                list(workers.map(lambda content: board.write_output(output, content), payloads))
            self.assertIn(output.read_text(), payloads)
            self.assertEqual([p.name for p in output.parent.iterdir()], ['board.html'])

    # Break: malformed lines erase valid reports, or supplied paths/markup leak into HTML.
    def test_reports_keep_duration_and_redact_rendered_activity(self):
        with tempfile.TemporaryDirectory() as directory:
            notes = pathlib.Path(directory) / 'notes'
            notes.write_text('{broken\n{"unit":"A3","phase":"checks","at":"2026-10-05T22:00:00Z","activity":"<script> /Users/example/private tmp/loka-live-board-review ~/private","seconds":5.4}\n')
            reports, errors = board.read_notes(notes)
            self.assertEqual(errors, 1)
            self.assertEqual(reports[0]['seconds'], 5.4)
            output = board.render(dict(at='now', notes=reports, note_errors=errors, rows=[],
                                      worktrees=[], local=None, remote=None, divergence=None,
                                      commits=None, prs=None, github_requested=False))
            self.assertNotIn('/Users/example', output)
            self.assertNotIn('tmp/loka-live-board-review', output)
            self.assertNotIn('~/private', output)
            self.assertNotIn('<script>', output)
            self.assertIn('&lt;script&gt; [local path]', output)
            self.assertIn('5.4', output)


if __name__ == '__main__':
    unittest.main()
