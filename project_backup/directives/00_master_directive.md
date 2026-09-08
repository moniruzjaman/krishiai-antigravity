# Master Directive: 3-Layer Architecture

## Goal

Establish a reliable, self-annealing system for executing complex tasks by separating intent (directives) from execution (scripts).

## The Architecture

1. **Directives (`directives/`)**: SOPs in Markdown. These are the "managers" that tell the "orchestrator" (the agent) what to do.
2. **Orchestration (Agent)**: You read the directives and call the tools.
3. **Execution (`execution/`)**: Deterministic Python scripts. These are the "workers" that do the actual file/API/data manipulation.

## Operating Principles

* **Check first**: Before writing a script, check `execution/` for existing tools.
* **Self-anneal**: If a script fails, fix it, then update the directive if the process changes.
* **Intermediates**: Store temp files in `.tmp/`.

## Workflow

1. Read a directive.
2. Gather inputs.
3. Run `execution/script_name.py`.
4. Verify output.
5. Report results.
