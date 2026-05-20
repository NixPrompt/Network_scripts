# FoxOps Demo Walkthrough

This is a short, low-drama demo path for showing what FoxOps does from a fresh
checkout. The commands are read-only and use explicitly provided targets.

## 1. Show The CLI Surface

```powershell
python .\monitor.py --help
```

Point out:

- network checks accept `--host`, `--hosts-file`, and `--url`
- output can be text or JSON
- `--output-file` captures the same JSON payload printed to stdout
- hardening checks are audit-only

## 2. Run A Small Network Check

```powershell
python .\monitor.py --host 127.0.0.1 --port 443 --timeout 1
```

What to say:

- FoxOps reports what this runner can observe.
- `FAIL` means the observed check failed, not that the whole system is unsafe.
- `WARN` is used when a check is skipped or inconclusive.

## 3. Generate Ticket-Friendly JSON

```powershell
python .\monitor.py --hosts-file .\examples\hosts.txt --port 443 --workers 4 --output json --output-file .\reports\demo.json
```

Point out:

- stdout still receives JSON
- `reports\demo.json` contains the same payload
- parent directories are created when possible
- JSON has stable top-level keys: `metadata`, `summary`, `groups`, `results`

## 4. Inspect The Evidence File

```powershell
python -m json.tool .\reports\demo.json
```

What to look for:

- `metadata` shows when and where the run happened
- `summary` counts `OK`, `WARN`, and `FAIL`
- `groups.hosts` keeps per-host result lists
- `groups.host_summaries` gives per-host status counts
- `results` keeps the flat result list for automation

## 5. Optional Windows Hardening Snapshot

Run from Windows PowerShell:

```powershell
python .\monitor.py --hardening --output json
```

What to say:

- This is read-only.
- It checks selected local account and password-policy posture.
- It does not remediate, certify security, or claim compliance.

## 6. Optional Linux Hardening Snapshot

Run from Linux or WSL:

```bash
python ./monitor.py --linux-hardening --output json
```

What to say:

- This is read-only.
- It checks Linux-native files and commands only.
- Under WSL, it reports WSL Linux state, not Windows posture.

## Cleanup

The demo may create:

```text
reports\demo.json
monitor.log
```

Both are local run artifacts.
