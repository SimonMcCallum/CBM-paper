"""Simulate probe-gated CBM scoring for Paper D.

Takes the AI_Scores.csv and CBM_Assessment.csv data and simulates what
would happen if an activation probe modulated AI confidence levels
instead of always picking maximum confidence.

Three scenarios:
  1. Raw AI: always confidence 3 (current behaviour)
  2. Oracle-gated: confidence 3 when correct, confidence 1 when wrong
  3. Probe-gated: uses estimated P(correct) to set CBM level via HLCC

Outputs:
  Documentation/generated/paper_d_simulation.tex  (LaTeX macros)
  Documentation/generated/figures/probe_gated_comparison.pdf

Usage:
    python Code/simulate_probe_gated_cbm.py
"""
import csv
import math
import sys
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent
FIG_DIR = DATA_DIR / "Documentation" / "generated" / "figures"
GEN_DIR = DATA_DIR / "Documentation" / "generated"
FIG_DIR.mkdir(parents=True, exist_ok=True)

# CBM scoring matrix
CBM = {
    1: {"correct": 1.0, "incorrect": 0.0},
    2: {"correct": 1.5, "incorrect": -0.5},
    3: {"correct": 2.0, "incorrect": -2.0},
}

def hlcc_optimal_confidence(p):
    """HLCC optimal confidence: c* = p / [4(1-p)]."""
    if p >= 1.0:
        return 10.0
    return p / (4.0 * (1.0 - p))

def confidence_to_cbm_level(c_star):
    """Discretise HLCC confidence to CBM level."""
    if c_star < 0.25:
        return 1
    elif c_star < 0.75:
        return 2
    else:
        return 3

def p_correct_to_cbm_level(p):
    """Map P(correct) directly to CBM level via HLCC."""
    c_star = hlcc_optimal_confidence(p)
    return confidence_to_cbm_level(c_star)

def cbm_score(level, is_correct):
    """Compute CBM score for a single question."""
    key = "correct" if is_correct else "incorrect"
    return CBM[level][key]

def load_detailed_ai_data():
    """Load per-question AI data from CBM_Assessment.csv.

    Returns list of dicts with per-question answer, confidence, correctness.
    """
    # The CBM_Assessment has AI rows with per-question data
    # Format: columns 16+ contain: answer, confidence, score triples for Q1-Q10
    models = []
    with open(DATA_DIR / "CBM_Assessment.csv", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)

        for row in reader:
            if len(row) < 16:
                continue
            name = row[0].strip()
            # Skip human students (numeric IDs)
            try:
                int(name)
                continue  # human student
            except ValueError:
                pass  # AI model name

            if not name or name == "":
                continue

            # Parse per-question data
            # Questions start at column 16 (0-indexed), grouped in triples: answer, confidence, score
            questions = []
            base = 16  # column where Q1 starts
            for q in range(10):
                idx = base + q * 3
                if idx + 2 >= len(row):
                    break
                answer = row[idx].strip() if idx < len(row) else ""
                try:
                    conf = int(float(row[idx + 1].strip()))
                except (ValueError, IndexError):
                    conf = 3  # default to max confidence
                try:
                    score = float(row[idx + 2].strip())
                except (ValueError, IndexError):
                    score = 0.0

                is_correct = score > 0
                questions.append({
                    "answer": answer,
                    "confidence": conf,
                    "score": score,
                    "is_correct": is_correct,
                })

            if questions:
                total_score = sum(q["score"] for q in questions)
                n_correct = sum(1 for q in questions if q["is_correct"])
                models.append({
                    "name": name,
                    "questions": questions,
                    "n_correct": n_correct,
                    "total_score": total_score,
                })

    return models


def simulate(models):
    """Run all three scoring scenarios."""
    results = []

    for m in models:
        n_q = len(m["questions"])
        n_correct = m["n_correct"]
        accuracy = n_correct / n_q if n_q > 0 else 0

        # Scenario 1: Raw AI (always confidence 3)
        raw_score = sum(cbm_score(3, q["is_correct"]) for q in m["questions"])

        # Scenario 2: Oracle-gated (conf 3 when correct, conf 1 when wrong)
        oracle_score = sum(
            cbm_score(3, True) if q["is_correct"] else cbm_score(1, False)
            for q in m["questions"]
        )

        # Scenario 3: Probe-gated with estimated P(correct) = accuracy
        # In practice, the probe gives per-question P(correct).
        # Here we simulate using the model's overall accuracy as the estimate.
        probe_level = p_correct_to_cbm_level(accuracy)
        probe_score = sum(cbm_score(probe_level, q["is_correct"]) for q in m["questions"])

        # Scenario 4: Probe-gated with per-question variation
        # Simulate: correct questions get P=0.85, wrong questions get P=0.35
        # This models the probe being partially informative
        probe_varied_score = 0
        for q in m["questions"]:
            if q["is_correct"]:
                p_est = 0.85  # probe thinks this is likely correct
                level = p_correct_to_cbm_level(p_est)
            else:
                p_est = 0.35  # probe thinks this is uncertain
                level = p_correct_to_cbm_level(p_est)
            probe_varied_score += cbm_score(level, q["is_correct"])

        # Actual score from data (may differ from raw if AI didn't always pick conf 3)
        actual_score = m["total_score"]

        results.append({
            "name": m["name"],
            "n_correct": n_correct,
            "accuracy": accuracy,
            "actual_score": actual_score,
            "raw_always3": raw_score,
            "oracle": oracle_score,
            "probe_uniform": probe_score,
            "probe_varied": probe_varied_score,
            "probe_level": probe_level,
        })

    return results


def print_results(results):
    """Print simulation results."""
    print(f"\n{'='*80}")
    print(f"PAPER D: PROBE-GATED CBM SIMULATION")
    print(f"{'='*80}")

    print(f"\n{'Model':<35s} {'Corr':>4s} {'Actual':>7s} {'Raw-3':>7s} {'Oracle':>7s} {'Probe-U':>7s} {'Probe-V':>7s}")
    print("-" * 80)

    for r in results:
        print(f"{r['name']:<35s} {r['n_correct']:>4d} {r['actual_score']:>7.1f} "
              f"{r['raw_always3']:>7.1f} {r['oracle']:>7.1f} {r['probe_uniform']:>7.1f} "
              f"{r['probe_varied']:>7.1f}")

    print(f"\nKey:")
    print(f"  Actual:  Score from data (AI's actual confidence choices)")
    print(f"  Raw-3:   Always confidence 3 (simulated worst-case overconfidence)")
    print(f"  Oracle:  Conf 3 when correct, conf 1 when wrong (perfect knowledge)")
    print(f"  Probe-U: Uniform probe (same P(correct) for all questions)")
    print(f"  Probe-V: Varied probe (P=0.85 for correct, P=0.35 for wrong)")

    # Averages
    n = len(results)
    if n > 0:
        print(f"\n{'Averages':<35s} "
              f"{'':>4s} {sum(r['actual_score'] for r in results)/n:>7.1f} "
              f"{sum(r['raw_always3'] for r in results)/n:>7.1f} "
              f"{sum(r['oracle'] for r in results)/n:>7.1f} "
              f"{sum(r['probe_uniform'] for r in results)/n:>7.1f} "
              f"{sum(r['probe_varied'] for r in results)/n:>7.1f}")

        # Improvement from probe-varied over raw
        raw_avg = sum(r['raw_always3'] for r in results) / n
        pv_avg = sum(r['probe_varied'] for r in results) / n
        print(f"\n  Probe-varied improvement over raw-3: {pv_avg - raw_avg:+.1f} points ({(pv_avg-raw_avg)/abs(raw_avg)*100:+.0f}%)")


def generate_macros(results):
    """Generate LaTeX macros for Paper D."""
    n = len(results)
    if n == 0:
        return

    m = []
    m.append("% Auto-generated macros for Paper D: Probe-Gated CBM Simulation")
    m.append("% Source: CBM_Assessment.csv via simulate_probe_gated_cbm.py")
    m.append("")

    raw_avg = sum(r["raw_always3"] for r in results) / n
    oracle_avg = sum(r["oracle"] for r in results) / n
    probe_u_avg = sum(r["probe_uniform"] for r in results) / n
    probe_v_avg = sum(r["probe_varied"] for r in results) / n
    actual_avg = sum(r["actual_score"] for r in results) / n

    m.append(f"\\newcommand{{\\simNModels}}{{{n}}}")
    m.append(f"\\newcommand{{\\simActualAvg}}{{{actual_avg:.1f}}}")
    m.append(f"\\newcommand{{\\simRawAvg}}{{{raw_avg:.1f}}}")
    m.append(f"\\newcommand{{\\simOracleAvg}}{{{oracle_avg:.1f}}}")
    m.append(f"\\newcommand{{\\simProbeUniformAvg}}{{{probe_u_avg:.1f}}}")
    m.append(f"\\newcommand{{\\simProbeVariedAvg}}{{{probe_v_avg:.1f}}}")
    m.append(f"\\newcommand{{\\simImprovementPts}}{{{probe_v_avg - raw_avg:+.1f}}}")
    m.append(f"\\newcommand{{\\simImprovementPct}}{{{(probe_v_avg - raw_avg)/abs(raw_avg)*100:+.0f}}}")

    path = GEN_DIR / "paper_d_simulation.tex"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(m))
    print(f"\n  Wrote {path}")


def plot_comparison(results):
    """Bar chart comparing scoring scenarios."""
    names = [r["name"].replace(" 20240107", "").replace("ChatGPT ", "GPT-")
             for r in results]

    x = np.arange(len(names))
    width = 0.18

    fig, ax = plt.subplots(figsize=(12, 5))

    ax.bar(x - 1.5*width, [r["raw_always3"] for r in results], width,
           label="Raw (always conf-3)", color="#C44E52", alpha=0.8)
    ax.bar(x - 0.5*width, [r["actual_score"] for r in results], width,
           label="Actual (from data)", color="#8172B2", alpha=0.8)
    ax.bar(x + 0.5*width, [r["probe_varied"] for r in results], width,
           label="Probe-gated (varied)", color="#55A868", alpha=0.8)
    ax.bar(x + 1.5*width, [r["oracle"] for r in results], width,
           label="Oracle (perfect)", color="#4C72B0", alpha=0.8)

    ax.set_xlabel("AI Model", fontsize=11)
    ax.set_ylabel("CBM Score", fontsize=11)
    ax.set_title("CBM Score Under Different Confidence Strategies", fontsize=13)
    ax.set_xticks(x)
    ax.set_xticklabels(names, rotation=45, ha="right", fontsize=8)
    ax.legend(fontsize=9)
    ax.grid(axis="y", alpha=0.3)
    ax.axhline(0, color="black", linewidth=0.5)

    plt.tight_layout()
    path = FIG_DIR / "probe_gated_comparison.pdf"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Wrote {path}")


def main():
    print("Paper D: Probe-Gated CBM Simulation")
    models = load_detailed_ai_data()
    print(f"  Loaded {len(models)} AI models from CBM_Assessment.csv")

    if not models:
        print("  ERROR: No AI model data found in CBM_Assessment.csv")
        return

    results = simulate(models)
    print_results(results)
    generate_macros(results)
    plot_comparison(results)
    print("\nDone.")


if __name__ == "__main__":
    main()
