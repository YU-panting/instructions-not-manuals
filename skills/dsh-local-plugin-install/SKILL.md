---
name: dsh-local-plugin-install
description: Install a local plugin into DSH safely - audit first, then register (both CLI and UI can register; editing files by hand is only the fallback), then re-verify. Triggers: installing a local plugin, a plugin missing from the list, auditing a third-party package.
---

> **This is the sanitized public version.** The copy actually in use on the author's machine lives in his skills directory (longer, with a private appendix). Do not mix the two.
> **About paths:** every path below is a **placeholder** (`<DSH install dir>`, `<DSH_HOME>\profiles\<profile>`, `<skills dir>`). Substitute the location on your own machine; the procedure and the criteria are machine-independent. **Real product names are kept on purpose** (DeepSeek Harness / DSH / `@deepseek-ai/*`) - this pack is written for DSH users, so hiding them would only make it harder to follow.

> ### Not included in this pack (four things that will hit "path not found" if you copy them literally)
>
> | What is missing | Where this file refers to it | Consequence |
> |---|---|---|
> | The skill `dsh-plugin-localization` (`scripts\dsh_plugin_title.mjs` + `assets\titles.json`) | section 3.5 (naming) and the closing section | Those two steps cannot run; do them by hand using the four criteria in 3.5 |
> | Your own AGENTS card (this file cites its section 0.7) | last row of the table in section 5 | That number does not exist here; read it as "a patch that the host may wash away" |
> | An `install-receipts/` directory in your repo | one of the three drop points in section 3.6 | **The drop point is only the author's own convention**: the receipt belongs in **your repo / your directory**. Writing the receipt is part of the procedure (you must be able to review the install later), not optional |
> | Backup material named `profile-@deepseek-ai-cleanup-*` and `00_directory-guide.md` | the "profile already wrecked" paragraph at the end of section 3 | That is the author's own rescue material; restore from **your** backup instead |
>
> **How to read this file:** the parts that stand on their own externally are 0.0 audit -> 2 required layout -> 3 three-step registration -> 3.6 receipt (drop it in your own directory) -> 4 verification order -> 5 troubleshooting. Section 3.5 and the "profile wrecked" paragraph reference the author's machine; treat them as background.

# Installing a local source plugin (DSH)

## 0.0 Audit first: the marketplace lets you install, but the plugin may not be installable (set 2026-10-22, after a real breakage)

> **Origin:** installing `dsh-auto-review` straight from dshmarket left DSH **unable to start**, and no log said what had been changed.
> Real cause (the plugin's own CHANGELOG 0.13.8 / issue #74): the package declared **14 `@deepseek-ai/dsh-*` host implementation packages**
> as runtime `dependencies`. pnpm put them at the profile root, where they **displaced the host's own providers** ->
> `credentials` / `fs` / `subprocess` / `sandbox` / `sandboxPolicy` / `sessionPersistence` / `connection`
> all failed to activate -> the app would not start. The marketplace served <=0.13.7 and **never warned that the version was wrong**.

Before installing any third-party package, run `audit-plugin-package.cjs` from this same directory (read-only, it changes nothing):

> **The marketplace has no "download only" option** - the button installs. So if you want to audit first there are only two routes:
> (a) a source package (GitHub / local directory): download it, then audit that directory;
> (b) a package shown on the marketplace: **bypass the marketplace and pull the `.tgz` from the registry yourself**, audit it, then install (this script accepts `.tgz`).

```powershell
& '<DSH install dir>\resources\runtime\primary-runtime\dependencies\node\bin\node.exe' `
  '<skills dir>\dsh-local-plugin-install\audit-plugin-package.cjs' <package dir or .tgz>
```

Exit codes: `0` safe to install / `1` conditional (read the WARN lines) / `2` refuse (BLOCKER).
The single most important check is "`dependencies` contains `@deepseek-ai/*`" - **that is the class of package that can leave DSH unable to start.**

Only after the audit passes, continue with sections 1-3 for local registration.

## 0. One sentence

**A local plugin does not need to be "installed", it needs to be "registered".** The files are already on your disk; what is missing is telling the host "this thing exists, load it".

## 1. Installing a plugin is two separate things (corrected 2026-11-02 after re-testing; this supersedes the old version of this section)

| Step | What it does | Possible from a local directory? |
|---|---|---|
| 1. put the files in place | `pnpm add <source>` (npm / tarball / `file:` local directory all work) | yes, pnpm supports all three |
| 2. register it | the package name goes into `dsh.profile.bundles` in the profile's `package.json` | **both the CLI and the UI write this** (but re-verify, see below) |

**The normal route (2026-11-02 re-test + source reading):**

- **CLI**: `dsh plugin --profile <name> add file:<local dir>` - measured: it writes **both** `dependencies` and `dsh.profile.bundles`.
- **UI**: Settings -> Plugins -> Add plugin accepts **an absolute path to a local directory** (`<drive>:/path/to/plugin`, with or without the `file:` prefix).
  Source evidence: `parseInstallSpec` in `dsh-plugin-manager/lib/index.js` sorts input into five classes - registry / **path (local directory)** / tarball / git / relative path rejected.
  The same file contains `bundles.push(name)` + `saveManifest` - **the UI writes the registration itself; you do not have to edit it by hand.**
  The impression that it "can only go through the network" comes from two visual red herrings: the example placeholder is a package name, and the "install source / npm registry" dropdown only applies to package names - a local path never goes through it.
- **Re-verify after running it**: read `package.json` again and confirm both places were written. If they were not, fall back to the manual registration in section 3.

**Retired assertions:** this section used to claim that `dsh plugin add` only forwards to pnpm and **does not write bundles** ("installing it is the same as not installing it"), and that registration "has no UI and no CLI".
**Both halves were wrong**: the CLI half was overturned by an isolated re-test on the morning of 2026-11-02, the UI half by reading the source the same day.
**Where the misjudgment came from** (inference, not reproduced): it was tested on **a profile that had already been wrecked**. A live profile uses a hoisted flat layout plus an incomplete lock file; the pnpm run triggered by `add` fails or stops halfway on such a profile, so "it ran and nothing was written" was recorded as "the CLI does not do registration".

That dshmarket recognizes `file:` dependencies still holds: it shows a "local development" badge, and when the path is dead it reports that the install source is a local path on another machine.

## 1.5 Development mode: `--patch` points straight at the source, nothing to install (measured 2026-11-02)

While writing and debugging a plugin you need neither registration nor a copy inside node_modules - the patch's `name` can be **the absolute path of a `.js` file**:

```yaml
# dev/cordis.yml (forward slashes in the absolute path)
- insert:
    - id: dev
      name: '<drive>:/path/to/my-plugin.js'
```

```powershell
# the official CLI wrapper (<DSH install dir>\resources\runtime\cli\bin\dsh.cmd), or point at cli.js inside the asar
& '<DSH install dir>\resources\runtime\cli\bin\dsh.cmd' --profile web --patch '<drive>:/path/to/dev/cordis.yml'
```

Measured: in the `--dump-config` merged tree that `name` appears as an absolute-path URL starting with `file:` (i.e. `file:` + the absolute path of the plugin .js),
and the profile's `package.json` is **not touched at all** (no `dependencies`, no `bundles`, no node_modules write). `--patch` can be repeated and stacks after the profile layer.

**Positioning: for development.** Real plugins still go through the required layout in section 2 plus registration in section 3 - `--patch` disappears as soon as you start without it, and it gives you no marketplace badge, no locale naming, no packaging of the browser half.

## 2. Prerequisite: the plugin directory must pass

Missing any one of these makes the install useless:

```jsonc
// package.json
{
  "name": "dsh-xxx",                     // must match the name written in bundles
  "type": "module",
  "main": "index.js",                    // or exports["."]
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",           // needed only if there is a browser half
    "./locale/*.json": "./locale/*.json" // needed only if there is a display name
  },
  "files": ["index.js", "client.js", "cordis.patch.yml", "locale"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }   // <-- missing this always reports not-bundle
}
```

```
plugin dir/
  cordis.patch.yml     <- content: - insert: [{ id: dsh-xxx, name: dsh-xxx }]
  index.js             <- host half
  client.js            <- browser half (optional)
  locale/zh.json       <- display name (optional, but the structure must be right!)
```

**The locale structure must be wrapped in `meta`** (measured pitfall, 2026-10-22; see 5.1):
```jsonc
{ "meta": { "title": "plugin display name", "description": "one line about what it does" } }
```
Written as `{"name": ..., "description": ...}` instead, **the plugin does not appear in Settings -> Plugins at all, and nothing reports an error** - the hardest thing to find.

**The directory path must not contain non-ASCII characters**: pnpm writes such paths back as GBK garbage.

## 3. Registration: install via CLI/UI (they write the registration) + re-verify; editing by hand is the fallback (idempotent, safe to repeat)

> **What this looks like in effect:** this pack is a command-line skill - no UI, no screenshots. Its effect is the audit output in a terminal and the two lines written into `package.json`.
> **This is the fallback path**: the normal install is the CLI / UI from section 1 (they write the registration). **Only edit the two places below if those did not both get written.**
> Editing by hand is not a hack, but it is not the first choice.

Two edits in `<DSH_HOME>\profiles\<profile>\package.json` plus one directory copy:

```jsonc
{
  "dependencies": {
    "dsh-xxx": "file:<plugin source dir>/dsh-xxx"      // (1) the dependency, pointing at the source directory
  },
  "dsh": {
    "profile": {
      "bundles": [
        "...",
        "dsh-xxx"                                  // (2) the registration: this decides whether it loads
      ]
    }
  }
}
```

```powershell
# (3) put the package into the profile's node_modules (a file: dependency is a real copy, not a symlink)
Copy-Item '<plugin source dir>\dsh-xxx' '<DSH_HOME>\profiles\<profile>\node_modules\dsh-xxx' -Recurse -Force
```

Then **touch the pnpm timestamps** (without this pnpm may not realize anything has to be re-linked):

```powershell
$prof='<DSH_HOME>\profiles\<profile>'; $now=Get-Date
(Get-Item "$prof\node_modules\.modules.yaml").LastWriteTime = $now
(Get-Item "$prof\pnpm-lock.yaml").LastWriteTime = $now.AddSeconds(-30)
(Get-Item "$prof\node_modules\.pnpm\lock.yaml").LastWriteTime = $now.AddSeconds(-30)
```

**Finally you must fully restart DSH** (profile changes are only read at startup).

### 3.5 Naming: do it immediately after registering (set 2026-10-28; the trigger is exactly this step)

> **Why this is its own section**: on 2026-10-28, installing `dsh-session-shift` produced an install report that had a "naming" section - but what came out was
> a bare localized title (`"title": "Session Shift"` in one language only), **no en.json**, **no `package-name (localized name)` format**, and the output slot line
> from the closing section was missing. The root cause was not forgetting; it was **the wrong trigger**: the old trigger said "once it shows up in the settings list",
> which requires a full restart plus a human opening that page - a session that is installing plugins never gets to observe that.

**Trigger = the moment the four steps above are done** (`node_modules` copy in place, timestamps touched).
**Not** "wait until it appears in Settings -> Plugins".

**How**: add `<package-name>: "<localized name>"` to `assets\titles.json`, then run the naming script once
(it writes zh and en together, wires exports/files, syncs the source directory, self-checks - fully automatic):

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& '<DSH install dir>\DeepSeek Harness.exe' '<skills dir>\dsh-plugin-localization\scripts\dsh_plugin_title.mjs' `
  --map '<skills dir>\dsh-plugin-localization\assets\titles.json'
```

**Four criteria (all verifiable before a restart, no UI needed)**:
1. both `locale/zh.json` and `locale/en.json` exist;
2. both parse with `JSON.parse` and `meta.title` is not empty;
3. `zh.meta.title` equals `<package-name>(<localized name>)` with **full-width parentheses** - a bare localized name fails (the author wants "original name + localized name");
4. `package.json` has `"./locale/*.json"` in `exports` and `"locale"` in `files`.

**After the restart**, add one confirmation: the localized name is visible in the list. That line only proves "it was parsed"; it is not the trigger.

### 3.6 Hand in the receipt: it counts when it is on disk (set 2026-10-28; includes the sanitized public copy)

**Trigger**: section 3 registration + section 3.5 naming done.

**Action**: write the receipt from `<your template dir>\install-receipt-template.md`; three drop points, each with its own job:

| Drop point | Content | Nature |
|---|---|---|
| `<workspace>\.dsh\install\<package>-<YYYYMMDD-HHmm>.md` | **original**: real paths, verbatim audit output, rollback commands | private |
| `<workspace>\.dsh\install\latest.md` | one pointer line: relative path + generation time | private |
| `<your public repo>\install-receipts\<package>.md` | **sanitized**: paths collapsed to drive-letter level, workspace and account names removed | public |

**Three states of the public copy**: `public: staged` (written into the repo working tree, not committed) / `public: pushed` (committed and pushed) /
`public: pending` (repo unavailable, so parked in `<your internal archive>\install-receipts\`).
**Committing and pushing are not part of the install procedure** (house rule: the author pushes them himself); the receipt records `staged`, and the author changes it to `pushed`.
Before writing the public copy run `git -C <repo> status -sb`: if the working tree holds someone else's uncommitted changes, tell the author first - **what is public is the copy on GitHub, not the working tree** (D1).
Never put un-sanitized content into the public repo (D2).

**Criteria**: six sections complete (environment timeline / verbatim audit output + exit code / the five registration steps / the four naming criteria / verification evidence / rollback);
`latest.md` points at a file that exists; the verification section does not use `/api/*` as evidence; public-copy paths contain no concrete directory names below drive-letter level.

**Exits**: no audit output available -> paste the command + exit code; the plugin has no client half -> the verification section says "no UI item, look for the `.active` marker";
`package.json` broken -> `status: broken` + whether the rollback already ran.

**Never**: just say "installed" in chat; leave fields empty; hand-write `locale/*.json` and claim the naming step is done.

### Do NOT run `pnpm install` by hand inside the profile directory (this wrecked a machine once, 2026-10-21)

**Symptom**: afterwards DSH does not start - `Cannot find package`, or "1 required plugin did not activate".

**Cause**: this machine's profile `pnpm-lock.yaml` is **incomplete** (it covers only some packages and has no full `packages` section),
while `pnpm-workspace.yaml` says `nodeLinker: hoisted` (a flat real directory tree).
When pnpm prunes a hoisted layout against that incomplete lock, it **physically deletes packages that are not in the lock** -
on 2026-10-21 the profile's `@deepseek-ai` packages went from **306 to 36**
(`cordis`, `dsh-subprocess`, `dsh-skill`, `dsh-base`, `dsh-web-app` and the rest of the core layer were gone).

**Correct procedure**: **edit `package.json` + copy the directory by hand + touch the timestamps** (the three steps above),
**and never let pnpm touch the profile**. The plugin marketplace is safe when it runs pnpm itself (it fixes the lock first);
**a manual run is not necessarily safe**.

**If the profile has already been wrecked this way** (core packages missing): copy them back from `<backup area>\profile-@deepseek-ai-cleanup-*`.
**Note**: after copying, the profile holds a second copy of a host package -> the same library loads twice ->
toggling plugins in Settings -> Plugins fails with `profile reload requires the root Include entry`.
**The real fix is removing the duplicate**, see item 1 of `<backup area>\00_directory-guide.md`.

## 4. Verification order (in this order, or you will be guessing)

1. `package.json` parses with `JSON.parse` (a broken file kills startup outright)
2. it is in `dependencies` and in `dsh.profile.bundles` (**after a CLI/UI install these two are the thing to look at**; if incomplete, use the fallback in section 3)
3. `node_modules/<package>/` exists and `index.js` is in it
4. after the restart: it appears in the plugin list, or you see the activation marker the plugin writes itself (`<DSH_HOME>\<plugin-name>.active`)
5. if it has a client half, reload the page (some need a restart)

## 5. Troubleshooting table

| Symptom | Cause | Action |
|---|---|---|
| nothing happens after install | `dsh.profile.bundles` not written | write it, restart |
| **the plugin is simply not in Settings -> Plugins** (registration correct, files present, already restarted) | **`locale/zh.json` has the wrong structure**: DSH reads the display name from `meta.title` | **see 5.1 - the worst trap here** |
| `error: not-bundle` | the `dsh.bundle.patch` declaration is missing | fix the two places in section 2 |
| listed but does nothing | files listed in `files` were not actually shipped | copy the whole directory, not selected files |
| source edits have no effect | the UI reads the copy in `node_modules` | sync both sides after editing |
| path shows as garbage / install fails | path contains non-ASCII characters | move it to a pure-ASCII path |
| overwritten again after a restart | the official updater re-materializes `@deepseek-ai/*` | that is "a patch the host may wash away", see AGENTS section 0.7 plus a state-check plugin |

### 5.1 The biggest trap: the locale file needs the `meta` wrapper

**Symptom**: registration is entirely correct (`dependencies` has it, `bundles` has it, the `node_modules` directory is real, syntax is fine,
`import` succeeds, `apply` is a function, the slot registration is identical to a sibling plugin that works),
**but the plugin never appears in Settings -> Plugins**. **No error anywhere.** The entries in `cordis.patch.yml` are fine too,
and the plugin manager's "source information" does not even list it.

**Cause**: DSH loads the locale through `exports["./locale/*.json"]` in `package.json`, and **takes the display name from `meta.title`**.
Written as `{"name": ..., "description": ...}`, `meta` is `undefined` -> the title is empty -> **the plugin manager filters that entry out**.

**Correct shape** (every plugin on the machine uses this structure; `client.js` of `dsh-client-locale` contains `schema.meta ||= {}`,
which shows `meta` is a required field):

```jsonc
{
  "meta": {
    "title": "example plugin (localized name)",     // <- the display name shown in the plugin list
    "description": "one line about what this plugin does"
  }
}
```

**Self-check** (one command, much faster than working through the list):

```powershell
$prof = '<DSH_HOME>\profiles\<profile>'
Get-ChildItem "$prof\node_modules" -Directory | ForEach-Object {
  $z = Join-Path $_.FullName 'locale\zh.json'
  if (Test-Path $z) {
    $o = Get-Content $z -Raw | ConvertFrom-Json
    if ($null -eq $o.meta) { 'missing meta: ' + $_.Name }   # <- these plugins silently vanish from the list
  }
}
```

**Lesson**: `exports["./locale/*.json"]` written correctly, `locale` present in `files`, the file really copied - **none of those prove the locale will be parsed.**
The only reliable criterion is that `meta.title` can actually be read out.
**When writing a plugin, copy the locale file of a sibling plugin that works; do not design the structure from intuition.**

### 5.2 Note: the `.active` marker (how to tell whether the host half ran at all)

A plugin can write an activation marker into `DSH_HOME` from inside its own `apply()`:

```js
try {
  writeFileSync(join(dshHome(), '<plugin-name>.active'), new Date().toISOString(), 'utf8')
} catch { /* failing to write it must not break the real feature */ }
```

**Use**: when the card is not visible, or you suspect the host half never loaded, check whether `<DSH_HOME>\<plugin-name>.active` exists -
**faster than reading logs**, because DSH's runtime logs under `%APPDATA%\@deepseek-ai\dsh-desktop\logs\`
**contain crash dumps only, no runtime logging**.

**Careful**: `.active` is written **by the plugin**, not by DSH. A plugin that does not write such a file
(for example a hand-written guard plugin) has **no marker even when loaded** - do not conclude from its absence.

### 5.3 Note: this machine's profile `node_modules` is a flat copy, not a pnpm layout

Measured (2026-10-22): `<DSH_HOME>\profiles\<profile>\node_modules\.pnpm` **is empty**, everything under `node_modules` is a plain directory
(`LinkType` empty), and neither `pnpm-lock.yaml` nor `.modules.yaml` **contains this machine's `file:` plugins**.

**So these pnpm-based criteria do not apply in this environment at all**:
"is the package in the lockfile", "is it registered in `.modules.yaml`", "is it under `.pnpm`" -
**none of them tells you whether DSH loaded the plugin**. What actually matters is
`dsh.profile.bundles` in `package.json` + the real directory in `node_modules` + `meta.title` in the locale.

## 6. When to do this and when not to

- **Do it**: the plugin is yours, the marketplace does not have it, you will use it long term.
- **Don't**: if dshmarket can install it, use dshmarket (it does steps 1, 2 and 4 automatically and checks updates) - **but audit that plugin first** (section 0.0). Manual registration is only for what the marketplace cannot install.
- **Do not**: build an automation or a boot script for "installing local plugins". It happens a few times a year, and an automation would rewrite the profile at startup and push the hand-made edits back.
  **One manual pass plus this document is enough.**

---

## Closing - after every install: name it (has a trigger, has an output slot)

> Set 2026-10-26. **Why this is its own section**: naming used to live only in the skill `dsh-plugin-localization`,
> which is a passive item - "do it whenever someone remembers". The result was a pile of installed plugins with English-only names in the list,
> to be fixed later. **A trigger decides whether it should happen; an output slot decides whether it does happen. Missing either one zeroes it out** (same as S1c).

### Trigger (when this is mandatory)

**Do it the moment registration is finished (section 3's three steps + touched timestamps) - see 3.5.** Do not wait for a full restart, do not wait until it shows up in the settings list,
do not wait for the author to say "I cannot read this name". Finish it inside the same task, do not leave it for the next session.

> **Corrected 2026-10-28**: the old trigger was "once the plugin is inside the profile and shows up in Settings -> Plugins".
> That event needs a full restart **plus a human opening the settings page**, so the installing session can never observe it -> the condition never becomes true and the closing step never runs
> (measured: installing `dsh-session-shift` left a bare localized name, no en.json, no slot line).
> "Appears in the list" is now downgraded to **a confirmation after the restart**, not the trigger.

### Output slot (the one line that must be written when it is done)

The completion report **must contain this line** (verbatim; if it is not written, the work is not done):

```
plugin display name: <dsh-xxx> -> <localized name> (locale/zh.json in place, meta.title readable OK)
```

Three criteria, none optional: **1 the files exist** (`locale/zh.json` and `locale/en.json`),
**2 they are wired** (`exports["./locale/*.json"]` and `locale` in `files`),
**3 it is really parsed** (`meta.title` reads out - that only counts once the list shows the localized name; a correct export on its own does not).

### Only two cases may skip it

1. the plugin **already ships a localized name / its own locale** (check whether `locale/zh.json` exists; do not guess);
2. the author explicitly says "do not change this name".

Even then the report must carry `plugin display name: <dsh-xxx> skipped (reason: ...)` - **the slot may never disappear as a whole**.

> How exactly to do it (file structure, a `meta.title` without the `meta` wrapper gets silently filtered, wiring exports, what to check when the list does not refresh)
> -> skill **`dsh-plugin-localization`**. This section only decides **when it must happen and what it must produce**.
