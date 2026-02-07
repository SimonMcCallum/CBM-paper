"""CLI for exporting benchmark results to website-consumable JSON.

Usage:
  python -m benchmark.run_export
  python -m benchmark.run_export --results-dir benchmark/results/raw --output-dir benchmark/results/published
"""
import argparse
from pathlib import Path
from benchmark.config import RAW_RESULTS_DIR, PUBLISHED_DIR, ensure_dirs
from benchmark.results.storage import load_all_raw_results
from benchmark.results.exporter import export_all


def main():
    parser = argparse.ArgumentParser(description="Export benchmark results for website")
    parser.add_argument(
        "--results-dir",
        default=str(RAW_RESULTS_DIR),
        help=f"Directory with raw result JSON files (default: {RAW_RESULTS_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        default=str(PUBLISHED_DIR),
        help=f"Output directory for published JSON (default: {PUBLISHED_DIR})",
    )
    args = parser.parse_args()

    ensure_dirs()

    results_dir = Path(args.results_dir)
    output_dir = Path(args.output_dir)

    if not results_dir.exists():
        print(f"Results directory not found: {results_dir}")
        print("Run benchmarks first with: python -m benchmark.run_benchmark")
        return

    results = load_all_raw_results(results_dir)
    if not results:
        print(f"No results found in {results_dir}")
        return

    print(f"Loaded {len(results)} results from {results_dir}")
    export_all(results, output_dir)


if __name__ == "__main__":
    main()
