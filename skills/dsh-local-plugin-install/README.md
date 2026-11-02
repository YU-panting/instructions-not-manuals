# Installing a local source plugin (DSH) - skill pack

### Install a local source plugin into DeepSeek Harness

In one line: **a local plugin does not need to be "installed", it needs to be "registered."** The files are already on your disk; what is missing is telling the host "this thing exists, load it".

---

## Three seconds

| Question | Answer |
|---|---|
| Who is this for | Anyone who wrote their own plugin for **DeepSeek Harness (DSH)** but cannot find it under Settings -> Plugins |
| What it solves | **How a local directory gets into DSH**: the CLI `dsh plugin add file:<dir>`, or Settings -> Plugins -> Add plugin, both accept an absolute path to a local directory, and **both write the registration**. After running it, read `package.json` again and confirm both places were written. Editing `package.json` by hand is the **fallback**, not the normal route |
| Can it be copied verbatim | Yes. Every path is a placeholder; the procedure and the criteria are machine-independent |
| The single worst trap | `locale/zh.json` missing the `meta` wrapper -> **the plugin never appears in the list and nothing reports an error** |

## What is in the pack

| File | What it is | When to use it |
|---|---|---|
| [`SKILL.md`](SKILL.md) | Main document: audit -> required layout -> three-step registration -> verification order -> troubleshooting | Read 0.0 first, then follow 1 -> 2 -> 3 -> 4 (for development/debugging see 1.5) |
| [`audit-plugin-package.cjs`](audit-plugin-package.cjs) | Static audit to run **before** installing any third-party package; read-only, it changes nothing | Exit code `0` safe / `1` conditional / `2` refuse |
| [`四类症状自检表.md`](四类症状自检表.md) | Five-row table: which symptoms are **not** caused by the plugin | Check it before changing your procedure |

## Three prerequisites for running the audit

```powershell
# 1) Node 16+ required (the script uses matchAll and require with the node: prefix)
# 2) Unpacking a .tgz relies on tar.exe, which ships with Windows 10+; on Linux / macOS unpack it yourself and pass the directory
# 3) To also check "this machine's host versions" and "profile patch collisions", set your profile directory; without it those two sections are skipped
$env:DSH_PROFILE_DIR = '<DSH_HOME>\profiles\<profile>'
node audit-plugin-package.cjs <package dir or .tgz>
```

A DSH install already ships a node; borrow it if you would rather not install one:

```powershell
& '<DSH install dir>\resources\runtime\primary-runtime\dependencies\node\bin\node.exe' `
  audit-plugin-package.cjs <package dir or .tgz>
```

## Not included in this pack

Sections 3.5 (naming) and 3.6 (receipt) of SKILL.md, plus the "profile already wrecked" paragraphs, reference things that only exist on the author's machine: the naming script `dsh-plugin-localization`, his AGENTS card section numbers, an `install-receipts/` directory, and his backup area.
**Treat those as background.** What stands on its own externally is: 0.0 audit -> 2 required layout -> 3 three-step registration -> 3.6 receipt (**drop it in your own directory**) -> 4 verification order -> 5 troubleshooting.

## Effect

This is a **command-line** skill: there is no UI, so there are no screenshots. The effect is the terminal output of two commands (the audit verdict, plus the two lines written into `package.json` after registration).

## License

Text **CC BY 4.0**, code **MIT**, as declared by [`LICENSE`](../../LICENSE) and [`LICENSE-DOCS`](../../LICENSE-DOCS) at the root of this repository (the root README states that they cover every subdirectory, including this one).

---

Author: **鱼人判庭虚之理** (YU-panting) - file created 2026-11-02
