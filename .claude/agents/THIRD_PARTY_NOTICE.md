# Third-party agent definitions

264 division-prefixed agent files in this directory (`engineering-*.md`,
`design-*.md`, `marketing-*.md`, etc.) are vendored from **The Agency**
(msitarzewski/agency-agents), an open-source collection of Claude Code
subagent definitions.

- Source: https://github.com/msitarzewski/agency-agents
- Pulled from commit `053ddbb` (2026-09-21)
- License: MIT (see below)

The three `swarm-*.md` files are project-specific and were written for
Reclipse, not part of the vendored set.

`nexus/` holds three orchestration-doctrine documents from the source
repo's `strategy/` division (`EXECUTIVE-BRIEF.md`, `QUICKSTART.md`,
`nexus-strategy.md`). They describe how to coordinate multiple agents on
one project ("NEXUS"), but have no YAML frontmatter, so they're not agent
definitions themselves and were moved out of the flat agent directory to
avoid confusing Claude Code's agent loader.

Most of the vendored agents (game development, GIS, healthcare, spatial
computing, academic, etc.) are not relevant to Reclipse's stack and are
kept only because a full, unmodified install was requested. Reference an
agent by the role name in its frontmatter when you want to use it. Note
that new agent files only become selectable `subagent_type`s in a fresh
Claude Code session, not the one that added them.

## MIT License (agency-agents)

MIT License

Copyright (c) 2025 AgentLand Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
