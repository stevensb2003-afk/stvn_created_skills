#!/usr/bin/env python3
"""Manage isolated per-TV CleanYourTV profile directories.

Each TV gets its own self-contained workspace under TVS_DIR/<slug>/ with
isolated launcher/, themes/, tools/, backup/, screenshots/, debloat.txt,
tv-profile.json, and README.md, while symlinking shared heavy assets
(.toolchain and tools/venv) from BASE_DIR.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional

DEFAULT_UPSTREAM_DIR = os.environ.get(
    "CLEANYOURTV_UPSTREAM",
    str(Path.home() / "Documents/Development/Plugins/cleanyourtv-upstream"),
)
DEFAULT_BASE_DIR = os.environ.get(
    "CLEANYOURTV_BASE",
    str(Path.home() / "Documents/Development/Plugins/cleanyourtv"),
)
DEFAULT_TVS_DIR = os.environ.get(
    "CLEANYOURTV_TVS_DIR",
    str(Path.home() / "Documents/Development/Plugins/cleanyourtv-tvs"),
)
CLEANYOURTV_REPO_URL = "https://github.com/Gathin23/cleanyourtv"


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def slugify(name: str) -> str:
    """Convert a TV name into a safe lowercase alphanumeric-and-hyphen slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        raise ValueError(f"Cannot derive a valid slug from name: {name!r}")
    return slug


def resolve_path(path_str: str) -> Path:
    """Expand user home and resolve a filesystem path."""
    return Path(path_str).expanduser().resolve()


def load_profile(profile_path: Path) -> Optional[Dict[str, Any]]:
    """Load and parse a tv-profile.json file, returning None on error."""
    try:
        with profile_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"Warning: failed to read {profile_path}: {exc}",
            file=sys.stderr,
        )
    return None


def save_profile(profile_path: Path, data: Dict[str, Any]) -> None:
    """Write a tv-profile.json file atomically with pretty formatting."""
    with profile_path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def scan_profiles(tvs_dir: Path) -> List[Dict[str, Any]]:
    """Scan TVS_DIR for tv-profile.json files and return profile records."""
    if not tvs_dir.exists():
        return []
    records: List[Dict[str, Any]] = []
    for entry in sorted(tvs_dir.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir():
            continue
        profile_path = entry / "tv-profile.json"
        if not profile_path.is_file():
            continue
        data = load_profile(profile_path)
        if data is None:
            continue
        data["_profile_dir"] = str(entry)
        records.append(data)
    return records


def cmd_check_deps(args: argparse.Namespace) -> int:
    """Check CleanYourTV base directory, scripts, venv, and toolchains."""
    base_dir = resolve_path(args.base)
    if not base_dir.exists():
        result = {
            "ok": False,
            "base_dir": str(base_dir),
            "error": (
                f"CleanYourTV base directory not found at {base_dir}. "
                f"Clone {CLEANYOURTV_REPO_URL} or set CLEANYOURTV_BASE."
            ),
        }
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"[MISSING] {result['error']}", file=sys.stderr)
        return 1

    launcher_script = base_dir / "launcher" / "build-and-install.sh"
    tv_script = base_dir / "tools" / "tv.py"
    venv_unix = base_dir / "tools" / "venv" / "bin" / "python"
    venv_win = base_dir / "tools" / "venv" / "Scripts" / "python.exe"
    venv_python = venv_unix if venv_unix.exists() else venv_win

    toolchain_jdk = base_dir / ".toolchain" / "jdk-17"
    env_java_home = os.environ.get("JAVA_HOME", "")
    jdk_ok = toolchain_jdk.exists() or (
        bool(env_java_home) and Path(env_java_home).exists()
    )

    toolchain_sdk = base_dir / ".toolchain" / "android-sdk"
    env_android_home = os.environ.get("ANDROID_HOME", "")
    sdk_ok = toolchain_sdk.exists() or (
        bool(env_android_home) and Path(env_android_home).exists()
    )

    upstream_dir = resolve_path(DEFAULT_UPSTREAM_DIR)
    checks = {
        "upstream_dir": {
            "ok": upstream_dir.is_dir(),
            "path": str(upstream_dir),
            "source": "archivo madre oficial (GitHub)",
        },
        "base_dir": {
            "ok": base_dir.is_dir(),
            "path": str(base_dir),
            "source": "versión personal instalable",
        },
        "launcher_build_and_install": {
            "ok": launcher_script.is_file(),
            "path": str(launcher_script),
        },
        "tools_tv_py": {"ok": tv_script.is_file(), "path": str(tv_script)},
        "tools_venv_python": {
            "ok": venv_python.exists(),
            "path": str(venv_python),
        },
        "jdk_17": {
            "ok": jdk_ok,
            "path": str(toolchain_jdk)
            if toolchain_jdk.exists()
            else (env_java_home or str(toolchain_jdk)),
            "source": ".toolchain/jdk-17"
            if toolchain_jdk.exists()
            else ("JAVA_HOME" if env_java_home else "missing"),
        },
        "android_sdk": {
            "ok": sdk_ok,
            "path": str(toolchain_sdk)
            if toolchain_sdk.exists()
            else (env_android_home or str(toolchain_sdk)),
            "source": ".toolchain/android-sdk"
            if toolchain_sdk.exists()
            else ("ANDROID_HOME" if env_android_home else "missing"),
        },
    }

    required_keys = [k for k in checks if k != "upstream_dir"]
    all_ok = all(checks[k]["ok"] for k in required_keys)
    payload = {
        "ok": all_ok,
        "base_dir": str(base_dir),
        "repo_url": CLEANYOURTV_REPO_URL,
        "checks": checks,
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"CleanYourTV base: {base_dir}")
        for name, info in checks.items():
            status = "OK" if info["ok"] else "MISSING"
            extra = f" ({info['source']})" if "source" in info else ""
            print(f"  [{status}] {name}: {info['path']}{extra}")
        if not all_ok:
            print(
                f"\nSome dependencies are missing. See {CLEANYOURTV_REPO_URL}",
                file=sys.stderr,
            )

    return 0 if all_ok else 1


def _md_cell(value: Any) -> str:
    """Format a value safely for a Markdown table cell."""
    text = str(value).strip() if value is not None else ""
    if not text:
        return "-"
    return text.replace("|", "\\|").replace("\n", " ")


def cmd_list(args: argparse.Namespace) -> int:
    """List all TV profiles in TVS_DIR as a Markdown table or JSON."""
    tvs_dir = resolve_path(args.tvs_dir)
    profiles = scan_profiles(tvs_dir)

    if args.json:
        cleaned = [
            {k: v for k, v in p.items() if k != "_profile_dir"}
            | {"path": p["_profile_dir"]}
            for p in profiles
        ]
        print(json.dumps(cleaned, indent=2))
        return 0

    if not profiles:
        print(f"No TV profiles found in {tvs_dir}.")
        return 0

    headers = [
        "Name",
        "Slug",
        "Brand/Model",
        "IP",
        "Serial",
        "Updated At",
        "Path",
    ]
    print("| " + " | ".join(headers) + " |")
    print("| " + " | ".join(["---"] * len(headers)) + " |")
    for prof in profiles:
        brand = (prof.get("brand") or "").strip()
        model = (prof.get("model") or "").strip()
        brand_model = " / ".join(part for part in (brand, model) if part) or "-"
        row = [
            _md_cell(prof.get("name")),
            _md_cell(prof.get("slug")),
            _md_cell(brand_model),
            _md_cell(prof.get("ip")),
            _md_cell(prof.get("serial")),
            _md_cell(prof.get("updated_at")),
            _md_cell(prof.get("_profile_dir")),
        ]
        print("| " + " | ".join(row) + " |")
    return 0


def cmd_find(args: argparse.Namespace) -> int:
    """Find matching TV profile(s) by serial (primary) or IP (secondary)."""
    if not args.serial and not args.ip:
        print(
            "Error: provide at least --serial or --ip to search.",
            file=sys.stderr,
        )
        return 2

    tvs_dir = resolve_path(args.tvs_dir)
    profiles = scan_profiles(tvs_dir)

    matches: List[Dict[str, Any]] = []
    if args.serial:
        target_serial = args.serial.strip().lower()
        matches = [
            p
            for p in profiles
            if (p.get("serial") or "").strip().lower() == target_serial
        ]

    if not matches and args.ip:
        target_ip = args.ip.strip()
        matches = [
            p for p in profiles if (p.get("ip") or "").strip() == target_ip
        ]

    if not matches:
        print("No matching TV profile found.", file=sys.stderr)
        return 1

    output = [
        {k: v for k, v in p.items() if k != "_profile_dir"}
        | {"path": p["_profile_dir"]}
        for p in matches
    ]
    print(json.dumps(output, indent=2))
    return 0


def _create_symlink(target: Path, link_path: Path) -> None:
    """Create a symlink at link_path pointing to target if target exists."""
    if not target.exists():
        return
    if link_path.exists() or link_path.is_symlink():
        link_path.unlink()
    link_path.symlink_to(target)


def _render_tv_readme(profile: Dict[str, Any], profile_dir: Path) -> str:
    """Generate a concise per-TV README.md."""
    brand_model = (
        " ".join(
            part
            for part in (profile.get("brand", ""), profile.get("model", ""))
            if part
        ).strip()
        or "Unknown"
    )
    ip_addr = profile.get("ip") or "Not set"
    serial = profile.get("serial") or "Not set"
    return (
        f"# {profile['name']}\n\n"
        f"- **Slug:** `{profile['slug']}`\n"
        f"- **Device:** {brand_model}\n"
        f"- **IP:** `{ip_addr}`\n"
        f"- **Serial:** `{serial}`\n"
        f"- **Base Repo:** `{profile['base_dir']}`\n"
        f"- **Profile Dir:** `{profile_dir}`\n"
        f"- **Created At:** `{profile['created_at']}`\n\n"
        "## Isolated Directories\n\n"
        "- `installed/` — Per-TV installed & customized CleanYourTV copy (`launcher/`, `themes/`, `tools/`, `debloat.txt`, `screenshots/`)\n"
        "- `backup/` — Original TV state backups (`getprop.txt`, `packages-*.txt`, `recovery-*.json`, APK exports)\n"
        "- `tv-profile.json` — Profile metadata\n"
    )


def cmd_create(args: argparse.Namespace) -> int:
    """Create an isolated per-TV CleanYourTV profile directory."""
    base_dir = resolve_path(args.base)
    if not base_dir.is_dir():
        print(
            f"Error: CleanYourTV base directory not found at {base_dir}. "
            f"Clone {CLEANYOURTV_REPO_URL} or set CLEANYOURTV_BASE.",
            file=sys.stderr,
        )
        return 1

    try:
        slug = slugify(args.name)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    tvs_dir = resolve_path(args.tvs_dir)
    profile_dir = tvs_dir / slug
    if profile_dir.exists():
        print(
            f"Error: profile directory already exists: {profile_dir}",
            file=sys.stderr,
        )
        return 1

    tvs_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.mkdir(parents=True, exist_ok=False)
    installed_dir = profile_dir / "installed"
    backup_dir = profile_dir / "backup"
    installed_dir.mkdir(exist_ok=False)
    backup_dir.mkdir(exist_ok=False)

    try:
        launcher_src = base_dir / "launcher"
        if launcher_src.is_dir():
            shutil.copytree(
                launcher_src,
                installed_dir / "launcher",
                ignore=shutil.ignore_patterns(
                    "build", ".gradle", "local.properties"
                ),
                symlinks=True,
            )

        themes_src = base_dir / "themes"
        if themes_src.is_dir():
            shutil.copytree(themes_src, installed_dir / "themes", symlinks=True)

        tools_src = base_dir / "tools"
        if tools_src.is_dir():
            shutil.copytree(
                tools_src,
                installed_dir / "tools",
                ignore=shutil.ignore_patterns("venv", "__pycache__", "adbkey"),
                symlinks=True,
            )

        _create_symlink(base_dir / ".toolchain", installed_dir / ".toolchain")
        if (installed_dir / "tools").is_dir():
            _create_symlink(
                base_dir / "tools" / "venv", installed_dir / "tools" / "venv"
            )

        android_sdk = base_dir / ".toolchain" / "android-sdk"
        if android_sdk.exists() and (installed_dir / "launcher").is_dir():
            local_props = installed_dir / "launcher" / "local.properties"
            local_props.write_text(
                f"sdk.dir={android_sdk}\n", encoding="utf-8"
            )

        (installed_dir / "screenshots").mkdir(exist_ok=True)
        (installed_dir / "debloat.txt").write_text("", encoding="utf-8")

        now = utc_now_iso()
        profile: Dict[str, Any] = {
            "name": args.name.strip(),
            "slug": slug,
            "ip": (args.ip or "").strip(),
            "brand": (args.brand or "").strip(),
            "model": (args.model or "").strip(),
            "serial": (args.serial or "").strip(),
            "base_dir": str(base_dir),
            "installed_dir": str(installed_dir),
            "backup_dir": str(backup_dir),
            "created_at": now,
            "updated_at": now,
            "notes": "",
        }
        save_profile(profile_dir / "tv-profile.json", profile)
        (profile_dir / "README.md").write_text(
            _render_tv_readme(profile, profile_dir), encoding="utf-8"
        )
    except Exception as exc:
        shutil.rmtree(profile_dir, ignore_errors=True)
        print(f"Error creating TV profile: {exc}", file=sys.stderr)
        return 1

    result = dict(profile)
    result["path"] = str(profile_dir)
    print(json.dumps(result, indent=2))
    return 0


def cmd_update(args: argparse.Namespace) -> int:
    """Update fields in an existing tv-profile.json and refresh updated_at."""
    tvs_dir = resolve_path(args.tvs_dir)
    profile_dir = tvs_dir / args.slug
    profile_path = profile_dir / "tv-profile.json"

    if not profile_path.is_file():
        print(
            f"Error: profile not found at {profile_path}",
            file=sys.stderr,
        )
        return 1

    profile = load_profile(profile_path)
    if profile is None:
        return 1

    updates = {
        "ip": args.ip,
        "brand": args.brand,
        "model": args.model,
        "serial": args.serial,
        "notes": args.note,
    }
    changed = False
    for key, value in updates.items():
        if value is not None:
            profile[key] = value.strip()
            changed = True

    if not changed:
        print(
            "Warning: no fields specified to update.",
            file=sys.stderr,
        )

    profile["updated_at"] = utc_now_iso()
    save_profile(profile_path, profile)

    result = dict(profile)
    result["path"] = str(profile_dir)
    print(json.dumps(result, indent=2))
    return 0


def _run_tv_probe(base_dir: Path, ip: str, shell_cmd: str) -> str:
    """Run a single ADB shell command on the TV via CleanYourTV's tools/tv.py."""
    py_bin = base_dir / "tools" / "venv" / "bin" / "python"
    tv_py = base_dir / "tools" / "tv.py"
    env = os.environ.copy()
    env["TV_HOST"] = ip
    proc = subprocess.run(
        [str(py_bin), "-I", str(tv_py), shell_cmd],
        env=env,
        capture_output=True,
        text=True,
        timeout=25,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"ADB probe failed ({proc.returncode})")
    return proc.stdout


def cmd_check_compat(args: argparse.Namespace) -> int:
    """Audit a connected TV over ADB for CleanYourTV & custom feature compatibility."""
    base_dir = resolve_path(args.base)
    if not (base_dir / "tools" / "tv.py").exists() or not (base_dir / "tools" / "venv" / "bin" / "python").exists():
        print(json.dumps({"error": "CleanYourTV tools/tv.py or tools/venv missing; run check-deps first."}, indent=2))
        return 1

    probe_script = "; ".join([
        'echo "MFR=$(getprop ro.product.manufacturer)"',
        'echo "MODEL=$(getprop ro.product.model)"',
        'echo "REL=$(getprop ro.build.version.release)"',
        'echo "SDK=$(getprop ro.build.version.sdk)"',
        'echo "HOME=$(cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME 2>/dev/null | tail -n 1)"',
        'echo "SOMNAMBULATOR=$(cmd package resolve-activity --brief com.android.systemui/.Somnambulator 2>/dev/null | tail -n 1)"',
        'echo "DREAMX=$(pm path com.google.android.apps.tv.dreamx 2>/dev/null | head -n 1)"',
        'echo "SCREENSAVER_EN=$(settings get secure screensaver_enabled 2>/dev/null)"',
        'echo "SCREENSAVER_CMP=$(settings get secure screensaver_components 2>/dev/null)"',
        'echo "FEAT_BT=$(pm list features 2>/dev/null | grep -c android.hardware.bluetooth)"',
        'echo "FEAT_WIFI=$(pm list features 2>/dev/null | grep -c android.hardware.wifi)"',
        'echo "FEAT_TV=$(pm list features 2>/dev/null | grep -c android.software.live_tv)"',
        'echo "SETTINGS_ACT=$(cmd package resolve-activity --brief -a android.settings.SETTINGS 2>/dev/null | tail -n 1)"',
        'echo "TVHOME=$(pm path com.gathin.tvhome 2>/dev/null | head -n 1)"',
    ])

    try:
        raw = _run_tv_probe(base_dir, args.ip, probe_script)
    except Exception as exc:
        print(json.dumps({"ok": False, "ip": args.ip, "error": str(exc)}, indent=2))
        return 1

    kv: Dict[str, str] = {}
    for line in raw.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            kv[k.strip()] = v.strip()

    sdk = int(kv.get("SDK", "0") or 0)
    has_bt = kv.get("FEAT_BT", "0") != "0"
    has_wifi = kv.get("FEAT_WIFI", "0") != "0"
    has_live_tv = kv.get("FEAT_TV", "0") != "0"
    has_somnambulator = "Somnambulator" in kv.get("SOMNAMBULATOR", "")
    has_dreamx = kv.get("DREAMX", "").startswith("package:")
    has_std_settings = "/" in kv.get("SETTINGS_ACT", "")

    checks = [
        {
            "feature": "Android SDK / Launcher Base",
            "status": "ok" if sdk >= 26 else "warn",
            "detail": f"Android {kv.get('REL', '?')} (SDK {sdk}) — {kv.get('MFR', '')} {kv.get('MODEL', '')}".strip(),
        },
        {
            "feature": "Stock Home / Launcher Swap",
            "status": "ok" if kv.get("HOME") else "warn",
            "detail": f"Home actual: {kv.get('HOME') or 'desconocido'}",
        },
        {
            "feature": "Modo Ambiente (Atrás en Inicio)",
            "status": "ok" if (has_somnambulator and has_dreamx) else ("warn" if has_somnambulator else "unsupported"),
            "detail": (
                f"Somnambulator={'sí' if has_somnambulator else 'no'}, dreamx={'sí' if has_dreamx else 'no'}, "
                f"screensaver_enabled={kv.get('SCREENSAVER_EN', '?')}"
            ),
        },
        {
            "feature": "Wi-Fi Popover",
            "status": "ok" if (has_wifi and sdk <= 28) else ("warn" if has_wifi else "unsupported"),
            "detail": (
                "SDK <= 28: conexión directa desde launcher"
                if sdk <= 28
                else "SDK >= 29: redes guardadas directas; redes nuevas hacen fallback a Ajustes de Wi-Fi"
            ),
        },
        {
            "feature": "Bluetooth Popover y Batería",
            "status": "ok" if has_bt else "unsupported",
            "detail": (
                f"Bluetooth presente; permiso {'BLUETOOTH_CONNECT (SDK 31+)' if sdk >= 31 else 'BLUETOOTH (SDK <= 30)'}; "
                "% batería depende del accesorio"
            ),
        },
        {
            "feature": "Entradas HDMI (TvInputManager)",
            "status": "ok" if has_live_tv else "warn",
            "detail": "Live TV / entradas HDMI soportadas" if has_live_tv else "TV Box/Stick o sin android.software.live_tv (se ocultan entradas HDMI si no hay)",
        },
        {
            "feature": "Ajustes del Sistema",
            "status": "ok" if has_std_settings else "warn",
            "detail": f"Intent estándar: {kv.get('SETTINGS_ACT') or 'no resuelve (usará fallback Xiaomi/OEM)'}",
        },
    ]

    report = {
        "ok": True,
        "ip": args.ip,
        "device": {
            "manufacturer": kv.get("MFR", ""),
            "model": kv.get("MODEL", ""),
            "android_release": kv.get("REL", ""),
            "sdk": sdk,
            "tvhome_installed": kv.get("TVHOME", "").startswith("package:"),
        },
        "checks": checks,
    }

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        icons = {"ok": "✅", "warn": "⚠️", "unsupported": "❌"}
        print(f"Compatibilidad CleanYourTV — {report['device']['manufacturer']} {report['device']['model']} "
              f"(Android {report['device']['android_release']} / SDK {sdk}) [{args.ip}]")
        for c in checks:
            print(f"  {icons[c['status']]} {c['feature']}: {c['detail']}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser for tv_manager.py."""
    parser = argparse.ArgumentParser(
        prog="tv_manager.py",
        description="Manage isolated per-TV CleanYourTV profile directories.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_check = subparsers.add_parser(
        "check-deps",
        help="Verify CleanYourTV base repository and toolchains.",
    )
    p_check.add_argument(
        "--base",
        default=DEFAULT_BASE_DIR,
        help=f"Path to CleanYourTV base repo (default: {DEFAULT_BASE_DIR})",
    )
    p_check.add_argument(
        "--json",
        action="store_true",
        help="Output dependency status as JSON.",
    )
    p_check.set_defaults(func=cmd_check_deps)

    p_list = subparsers.add_parser(
        "list",
        help="List all TV profiles in TVS_DIR.",
    )
    p_list.add_argument(
        "--tvs-dir",
        default=DEFAULT_TVS_DIR,
        help=f"Directory containing TV profiles (default: {DEFAULT_TVS_DIR})",
    )
    p_list.add_argument(
        "--json",
        action="store_true",
        help="Output profiles as JSON.",
    )
    p_list.set_defaults(func=cmd_list)

    p_find = subparsers.add_parser(
        "find",
        help="Find existing TV profile(s) by serial or IP.",
    )
    p_find.add_argument("--ip", help="TV IP address (secondary match).")
    p_find.add_argument("--serial", help="TV ADB serial (primary match).")
    p_find.add_argument(
        "--tvs-dir",
        default=DEFAULT_TVS_DIR,
        help=f"Directory containing TV profiles (default: {DEFAULT_TVS_DIR})",
    )
    p_find.set_defaults(func=cmd_find)

    p_create = subparsers.add_parser(
        "create",
        help="Create a new isolated per-TV profile directory.",
    )
    p_create.add_argument("--name", required=True, help="Human-readable TV name.")
    p_create.add_argument("--ip", default="", help="TV IP address.")
    p_create.add_argument("--brand", default="", help="TV brand.")
    p_create.add_argument("--model", default="", help="TV model.")
    p_create.add_argument("--serial", default="", help="TV ADB serial.")
    p_create.add_argument(
        "--base",
        default=DEFAULT_BASE_DIR,
        help=f"Path to CleanYourTV base repo (default: {DEFAULT_BASE_DIR})",
    )
    p_create.add_argument(
        "--tvs-dir",
        default=DEFAULT_TVS_DIR,
        help=f"Directory containing TV profiles (default: {DEFAULT_TVS_DIR})",
    )
    p_create.set_defaults(func=cmd_create)

    p_update = subparsers.add_parser(
        "update",
        help="Update metadata in an existing tv-profile.json.",
    )
    p_update.add_argument("--slug", required=True, help="TV profile slug.")
    p_update.add_argument("--ip", help="Updated TV IP address.")
    p_update.add_argument("--brand", help="Updated TV brand.")
    p_update.add_argument("--model", help="Updated TV model.")
    p_update.add_argument("--serial", help="Updated TV ADB serial.")
    p_update.add_argument("--note", help="Updated notes.")
    p_update.add_argument(
        "--tvs-dir",
        default=DEFAULT_TVS_DIR,
        help=f"Directory containing TV profiles (default: {DEFAULT_TVS_DIR})",
    )
    p_update.set_defaults(func=cmd_update)

    p_compat = subparsers.add_parser(
        "check-compat",
        help="Probe a connected TV over ADB for CleanYourTV & custom feature compatibility.",
    )
    p_compat.add_argument("--ip", required=True, help="TV IP address.")
    p_compat.add_argument(
        "--base",
        default=DEFAULT_BASE_DIR,
        help=f"Path to CleanYourTV base repo (default: {DEFAULT_BASE_DIR})",
    )
    p_compat.add_argument(
        "--json",
        action="store_true",
        help="Output compatibility report as JSON.",
    )
    p_compat.set_defaults(func=cmd_check_compat)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    """Entry point for tv_manager.py."""
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
