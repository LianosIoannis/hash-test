# Issue tracker: Local Markdown

Issues and specs live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Specs: `.scratch/<feature-slug>/spec.md`.
- Implementation tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from `01`, with one file per ticket.
- Record triage state in a `Status:` line near the top of each issue.
  Use the role strings in `triage-labels.md`.
- Append conversation history under `## Comments`.

## Publish to the issue tracker

Create the appropriate spec or issue file using the paths above.
Create parent directories as needed.

## Fetch the relevant ticket

Read the referenced file. If given only a number, resolve it within the
relevant feature directory; ask if multiple tickets match.

## Wayfinding operations

For `/wayfinder`:

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far,
  and Fog sections.
- Child ticket: `.scratch/<effort>/issues/<NN>-<slug>.md`, numbered
  from `01`, with the question in the body.
- Type: record `research`, `prototype`, `grilling`, or `task` in `Type:`.
- Workflow state: use `Status: claimed` or `Status: resolved`.
- Blocking: list dependencies in `Blocked by: NN, NN`.
  A ticket is unblocked when all listed tickets are resolved.
- Frontier: select the first open, unblocked, unclaimed ticket by number.
- Claim: save `Status: claimed` before starting work.
- Resolve: append the answer under `## Answer`, set `Status: resolved`,
  and add a gist and ticket link to the map's Decisions-so-far section.
