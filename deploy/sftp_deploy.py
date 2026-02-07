"""Deploy benchmark website via SFTP.

Usage:
  python deploy/sftp_deploy.py
  python deploy/sftp_deploy.py --config deploy/deploy_config.json
  python deploy/sftp_deploy.py --dry-run

Workflow:
  1. Build Vue SPA (npm run build in website/)
  2. Copy published results to website/dist/data/
  3. SFTP upload website/dist/ to remote server
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent.parent
WEBSITE_DIR = PROJECT_ROOT / "website"
DIST_DIR = WEBSITE_DIR / "dist"
PUBLISHED_DIR = PROJECT_ROOT / "benchmark" / "results" / "published"
DEFAULT_CONFIG = Path(__file__).parent / "deploy_config.json"


def build_website():
    """Build the Vue SPA."""
    print("Building website...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(WEBSITE_DIR),
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Build failed:\n{result.stderr}")
        sys.exit(1)
    print("Website built successfully.")


def copy_data():
    """Copy published benchmark results to the dist/data/ directory."""
    data_dir = DIST_DIR / "data"
    if data_dir.exists():
        shutil.rmtree(data_dir)

    if PUBLISHED_DIR.exists():
        shutil.copytree(PUBLISHED_DIR, data_dir)
        print(f"Copied results: {PUBLISHED_DIR} -> {data_dir}")
    else:
        data_dir.mkdir(parents=True, exist_ok=True)
        print(f"Warning: No published results found at {PUBLISHED_DIR}")


def sftp_upload(config: dict, dry_run: bool = False):
    """Upload dist/ to remote server via SFTP using paramiko."""
    try:
        import paramiko
    except ImportError:
        print("paramiko not installed. Install with: pip install paramiko")
        print("Alternatively, use rsync:")
        remote = f"{config['username']}@{config['host']}:{config['remote_path']}"
        print(f"  rsync -avz -e 'ssh -p {config.get('port', 22)}' {DIST_DIR}/ {remote}")
        return

    host = config["host"]
    port = config.get("port", 22)
    username = config["username"]
    key_path = os.path.expanduser(config.get("key_path", "~/.ssh/id_rsa"))
    remote_path = config["remote_path"]

    if dry_run:
        print(f"DRY RUN: Would upload {DIST_DIR} -> {username}@{host}:{remote_path}")
        for f in DIST_DIR.rglob("*"):
            if f.is_file():
                rel = f.relative_to(DIST_DIR)
                print(f"  {rel}")
        return

    print(f"Connecting to {host}:{port}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=username, key_filename=key_path)
    sftp = ssh.open_sftp()

    # Upload all files
    uploaded = 0
    for local_file in DIST_DIR.rglob("*"):
        if local_file.is_file():
            rel = local_file.relative_to(DIST_DIR)
            remote_file = f"{remote_path}/{rel.as_posix()}"
            remote_dir = f"{remote_path}/{rel.parent.as_posix()}"

            # Ensure remote directory exists
            _mkdir_p(sftp, remote_dir)

            sftp.put(str(local_file), remote_file)
            uploaded += 1

    sftp.close()
    ssh.close()
    print(f"Uploaded {uploaded} files to {host}:{remote_path}")


def _mkdir_p(sftp, remote_dir: str):
    """Recursively create remote directories."""
    dirs_to_create = []
    current = remote_dir
    while current and current != "/":
        try:
            sftp.stat(current)
            break
        except FileNotFoundError:
            dirs_to_create.insert(0, current)
            current = str(Path(current).parent.as_posix())

    for d in dirs_to_create:
        try:
            sftp.mkdir(d)
        except IOError:
            pass


def main():
    parser = argparse.ArgumentParser(description="Deploy benchmark website via SFTP")
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
        help=f"Path to deploy config JSON (default: {DEFAULT_CONFIG})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be uploaded without actually deploying",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip the npm build step",
    )
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Deploy config not found: {config_path}")
        print(f"Copy deploy_config.example.json to deploy_config.json and fill in your server details.")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = json.load(f)

    if not args.skip_build:
        build_website()

    copy_data()
    sftp_upload(config, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
