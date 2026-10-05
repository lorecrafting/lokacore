# Reuse documents already read in the current agent context

**Owner direction, 2026-10-05:** A document tree can point back to a file an agent
already loaded. Avoid rereading it and consuming tokens merely because another
link or instruction names it again.

Each agent keeps a small in-context list of documents it has read and reuses that
content when following links. Reopen only the relevant section if the file has
changed, the earlier output was truncated, or a necessary detail is missing.
Each fresh subagent reads its own governing documents; another agent's context
does not transfer to it.

This changes reading practice, not the governing authority of any document.
