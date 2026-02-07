"""CLI entry point for running CBM benchmarks.

Usage:
  python -m benchmark.run_benchmark --dataset mmlu --variant all --sample-size 10
  python -m benchmark.run_benchmark --dataset truthfulqa --variant discrete_combined --vendors openai,claude
  python -m benchmark.run_benchmark --dataset all --variant all --temperatures 0.0,0.7 --repetitions 3
"""
import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

from benchmark.config import (
    UNIFIED_DIR, RAW_RESULTS_DIR, VARIANTS, AVAILABLE_DATASETS,
    TEMPERATURES, NUM_REPETITIONS, ensure_dirs,
)
from benchmark.datasets.downloader import download_all
from benchmark.datasets.converter import convert_all, convert_mmlu, convert_truthfulqa, convert_arc
from benchmark.engine.tester import BenchmarkRunner


def parse_args():
    parser = argparse.ArgumentParser(
        description="CBM AI Benchmarking System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--dataset",
        choices=AVAILABLE_DATASETS + ["all"],
        default="mmlu",
        help="Dataset to benchmark (default: mmlu)",
    )
    parser.add_argument(
        "--variant",
        default="all",
        help="Confidence variant(s): discrete_combined, discrete_linear, "
             "hlcc_combined, hlcc_linear, or 'all' (default: all)",
    )
    parser.add_argument(
        "--vendors",
        default=None,
        help="Comma-separated vendor keys: openai,claude,gemini,deepseek,xai (default: all with API keys)",
    )
    parser.add_argument(
        "--models",
        default=None,
        help="Comma-separated model names to test (default: all for selected vendors)",
    )
    parser.add_argument(
        "--temperatures",
        default=None,
        help=f"Comma-separated temperature values (default: {TEMPERATURES})",
    )
    parser.add_argument(
        "--repetitions",
        type=int,
        default=NUM_REPETITIONS,
        help=f"Repetitions per combination (default: {NUM_REPETITIONS})",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=None,
        help="Max questions per subject for MMLU (default: all)",
    )
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Only download and convert datasets, don't run benchmarks",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help=f"Output directory for results (default: {RAW_RESULTS_DIR})",
    )

    return parser.parse_args()


def ensure_dataset(dataset_name: str, sample_size: int = None):
    """Download and convert a dataset if not already present."""
    unified_file = UNIFIED_DIR / f"{dataset_name}.json"
    if unified_file.exists():
        print(f"Dataset {dataset_name} already converted: {unified_file}")
        return unified_file

    print(f"Preparing dataset: {dataset_name}")
    ensure_dirs()

    if dataset_name == "mmlu":
        from benchmark.datasets.downloader import download_mmlu
        download_mmlu()
        convert_mmlu(sample_size=sample_size)
    elif dataset_name == "truthfulqa":
        from benchmark.datasets.downloader import download_truthfulqa
        download_truthfulqa()
        convert_truthfulqa()
    elif dataset_name == "arc":
        from benchmark.datasets.downloader import download_arc
        download_arc()
        convert_arc()
    elif dataset_name == "ambiguous":
        from benchmark.datasets.ambiguous import load_ambiguous
        load_ambiguous()  # Copies from source file to unified dir
    else:
        raise ValueError(f"Unknown dataset: {dataset_name}")

    return unified_file


async def run_benchmark(args):
    """Main benchmark execution."""
    ensure_dirs()

    # Parse variants
    if args.variant == "all":
        variants = VARIANTS
    else:
        variants = [v.strip() for v in args.variant.split(",")]
        for v in variants:
            if v not in VARIANTS:
                print(f"Unknown variant: {v}. Available: {VARIANTS}")
                return

    # Parse vendors
    vendors = [v.strip() for v in args.vendors.split(",")] if args.vendors else None

    # Parse models
    models_filter = [m.strip() for m in args.models.split(",")] if args.models else None

    # Parse temperatures
    temps = (
        [float(t) for t in args.temperatures.split(",")]
        if args.temperatures
        else TEMPERATURES
    )

    # Determine datasets to run
    datasets = AVAILABLE_DATASETS if args.dataset == "all" else [args.dataset]

    # Ensure all datasets are available
    dataset_files = {}
    for ds in datasets:
        dataset_files[ds] = ensure_dataset(ds, sample_size=args.sample_size)

    if args.download_only:
        print("Download complete. Exiting (--download-only).")
        return

    # Run benchmarks
    output_dir = Path(args.output_dir) if args.output_dir else RAW_RESULTS_DIR
    runner = BenchmarkRunner()

    for ds_name, ds_path in dataset_files.items():
        print(f"\n{'='*60}")
        print(f"Running benchmark: {ds_name}")
        print(f"{'='*60}")

        results = await runner.run(
            dataset_path=ds_path,
            variants=variants,
            vendors=vendors,
            models_filter=models_filter,
            temperatures=temps,
            repetitions=args.repetitions,
        )

        if results:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = output_dir / f"{ds_name}_{timestamp}.json"
            runner.save_results(output_file)

    print(f"\nAll benchmarks complete. Results in: {output_dir}")


def main():
    args = parse_args()
    asyncio.run(run_benchmark(args))


if __name__ == "__main__":
    main()
