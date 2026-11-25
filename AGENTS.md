Help the user finish this poor man's reverse proxy that injects JavaScript code to make the OpenCode web version more polished and usable, especially on small mobile screens. 

Also, this is the first time the user has tried playing with this reverse proxy, HTTP interception, HTML rewriting, whatever, and he wants to learn it. So, if anything is a non-obvious concept, take the time to briefly explain it to him when it's relevant.

Decent level of engineering, prioritizing speed to personal use, learning along the way. Not production-grade: no premature optimization or over-engineering.


## Objectives
- Make the OpenCode web UI better, especially on small mobile screens.
- Focus on speed to personal use, a decent level of engineering is enough.
- Teach non-obvious concepts to user.

## Stack
Use Bun and anything that comes with it. Keep it as minimal as possible. Suggest installing a package if it would simplify the code. The user likes simple code, so try to please him, lol.

## Mandates
- Unless the user explicitly says so, no tests for now.
- No linting or related checks.

## Code styling and conventions
- **Explanatory Comments**: Every new block of code gets a short, concise comment explaining what it is, why it's needed, and how it works. These comments exist so the user can learn how things work — the user may remove or edit them later, so don't treat them as permanent documentation.
- **Blank Line Before Final Statement**: Always add a blank line before the final statement in a function. This visually separates the conclusion from the setup.

## Context and Resources

- `opencode/` is a gitignored copy of the OpenCode source, branch `dev`. Inspect it freely, and use the `file-search` subagent when possible. If missing, download it:

  `git clone --depth 1 --branch dev https://github.com/anomalyco/opencode.git opencode && rm -rf opencode/.git`

- The agent may ask the user to run a JS snippet in the Firefox console and paste the output.
- The user may provide annotated screenshots; ask for one when a UI fix isn't landing.
- No browser MCP, by design.
- Bun's HTMLRewriter docs: https://bun.com/docs/runtime/html-rewriter


