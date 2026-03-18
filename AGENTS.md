# sqyrl

This is a TypeScript library for sanitising SQL produced by agents so it can safely run against multi-tenant DBs.

Uses vite+ (vp, see below) for typical npm stuff.
Vitest for tests.

Uses ohm-js to parse SQL.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific commands.

Commands you'll need (use these instead of npm/pnpm):

- `vp check --fix`: format, lint and typecheck
- `vp test`: test
- `vp run <script-name>`: run scripts
- `vp exec ...`: exec commands from node_modules bin
- `vp dlx ...`: what it sounds like
- `vp install ...`: ditto

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

## Useful scripts

- Run `vp run gen:types` any time you edit src/sql.ohm.
