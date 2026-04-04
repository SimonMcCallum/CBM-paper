"""Generate figures for Paper B: AI vs Human Metacognition.

Produces:
  Documentation/generated/figures/score_distribution.pdf
  Documentation/generated/figures/calibration_by_accuracy.pdf
  Documentation/generated/figures/spc_comparison.pdf

Usage:
    python Code/generate_paper_b_figures.py
"""
import csv
import math
import sys
import os
from pathlib import Path
from collections import Counter

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent
FIG_DIR = DATA_DIR / "Documentation" / "generated" / "figures"
FIG_DIR.mkdir(parents=True, exist_ok=True)


def load_humans():
    rows = []
    with open(DATA_DIR / "Human_Scores.csv", newline="") as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for row in reader:
            try:
                score = float(row["Score"].strip())
                correct = int(row["Correct"].strip())
                rows.append({"score": score, "correct": correct})
            except (ValueError, KeyError):
                continue
    return rows


def load_ais():
    rows = []
    with open(DATA_DIR / "AI_Scores.csv", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["AI"].strip()
            score_val = None
            for k, v in row.items():
                if "score" in k.strip().lower():
                    try:
                        score_val = float(v.strip())
                    except (ValueError, AttributeError):
                        pass
                    break
            correct = None
            for k, v in row.items():
                if "correct" in k.strip().lower():
                    try:
                        correct = int(v.strip())
                    except (ValueError, AttributeError):
                        pass
                    break
            rows.append({"name": name, "score": score_val, "correct": correct})
    return rows


def fig1_score_distribution(humans, ais):
    """Histogram of CBM scores: humans vs AI models."""
    h_scores = [h["score"] for h in humans]
    ai_initial = [a for a in ais if "combined" not in a["name"].lower()
                  and a["score"] is not None]
    ai_scores = [a["score"] for a in ai_initial]

    fig, ax = plt.subplots(figsize=(8, 4.5))

    # Human histogram
    bins = np.arange(-6, 22, 1)
    ax.hist(h_scores, bins=bins, alpha=0.6, color="#4C72B0", label=f"Human students (n={len(humans)})",
            edgecolor="white", linewidth=0.5, density=True)

    # AI as individual markers on a rug plot at top
    for a in ai_initial:
        ax.axvline(a["score"], color="#C44E52", alpha=0.7, linewidth=2, linestyle="-")

    # AI label
    ax.plot([], [], color="#C44E52", linewidth=2, label=f"AI models (n={len(ai_initial)})")

    ax.set_xlabel("CBM Score", fontsize=12)
    ax.set_ylabel("Density (humans) / Individual (AI)", fontsize=11)
    ax.set_title("CBM Score Distribution: Human Students vs AI Models", fontsize=13)
    ax.legend(fontsize=10)
    ax.set_xlim(-6, 22)
    ax.grid(axis="y", alpha=0.3)

    # Annotate key AI models
    label_offset = 0
    for a in ai_initial:
        if a["name"] in ["ChatGPT 4o1", "Claude 3 opus 20240107", "Gemini 2.0 Flash"]:
            short = a["name"].replace(" 20240107", "").replace(" 2.0", "")
            ax.annotate(short, xy=(a["score"], 0), xytext=(a["score"] + 0.3, 0.12 + label_offset),
                        fontsize=7, color="#C44E52", rotation=45,
                        arrowprops=dict(arrowstyle="-", color="#C44E52", alpha=0.4))
            label_offset += 0.03

    plt.tight_layout()
    path = FIG_DIR / "score_distribution.pdf"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Wrote {path}")


def fig2_calibration_by_accuracy(humans, ais):
    """Scatter: number correct vs CBM score for humans and AI."""
    fig, ax = plt.subplots(figsize=(7, 5))

    # Humans
    h_correct = [h["correct"] for h in humans]
    h_scores = [h["score"] for h in humans]

    # Jitter for visibility
    jitter = np.random.default_rng(42).normal(0, 0.12, len(h_correct))
    ax.scatter(np.array(h_correct) + jitter, h_scores, alpha=0.35, s=20,
               color="#4C72B0", label="Human students", zorder=2)

    # AI
    ai_initial = [a for a in ais if "combined" not in a["name"].lower()
                  and a["score"] is not None and a["correct"] is not None]
    ai_c = [a["correct"] for a in ai_initial]
    ai_s = [a["score"] for a in ai_initial]
    ax.scatter(ai_c, ai_s, s=80, color="#C44E52", marker="D", edgecolors="black",
               linewidth=0.5, label="AI models", zorder=3)

    # Reference lines for different confidence strategies
    x = np.arange(0, 11)
    ax.plot(x, x * 1.0, "--", color="gray", alpha=0.5, label="All conf-1 (guessing)")
    ax.plot(x, x * 1.5 - (10 - x) * 0.5, "--", color="orange", alpha=0.5, label="All conf-2")
    ax.plot(x, x * 2.0 - (10 - x) * 2.0, "--", color="red", alpha=0.5, label="All conf-3")

    ax.set_xlabel("Number Correct (out of 10)", fontsize=12)
    ax.set_ylabel("CBM Score", fontsize=12)
    ax.set_title("Confidence Calibration: Score vs Accuracy", fontsize=13)
    ax.legend(fontsize=9, loc="upper left")
    ax.set_xlim(-0.5, 10.5)
    ax.set_ylim(-8, 22)
    ax.grid(alpha=0.3)

    plt.tight_layout()
    path = FIG_DIR / "calibration_by_accuracy.pdf"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Wrote {path}")


def fig3_spc_comparison(humans, ais):
    """Bar chart: score per correct answer for humans vs AI."""
    ai_initial = [a for a in ais if "combined" not in a["name"].lower()
                  and a["score"] is not None and a["correct"] is not None
                  and a["correct"] > 0]

    # Human SPC by accuracy bucket
    buckets = {}
    for h in humans:
        if h["correct"] == 0:
            continue
        bucket = h["correct"]
        if bucket not in buckets:
            buckets[bucket] = []
        buckets[bucket].append(h["score"] / h["correct"])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.5))

    # Left: Human SPC by accuracy
    sorted_buckets = sorted(buckets.keys())
    means = [np.mean(buckets[b]) for b in sorted_buckets]
    counts = [len(buckets[b]) for b in sorted_buckets]
    bars = ax1.bar(sorted_buckets, means, color="#4C72B0", alpha=0.7, edgecolor="white")
    ax1.axhline(2.0, color="green", linestyle="--", alpha=0.5, label="Perfect (all conf-3 correct)")
    ax1.axhline(1.0, color="gray", linestyle="--", alpha=0.5, label="All conf-1")
    ax1.set_xlabel("Number Correct", fontsize=11)
    ax1.set_ylabel("Score Per Correct Answer", fontsize=11)
    ax1.set_title("Human: Confidence Adapts to Knowledge", fontsize=12)
    ax1.legend(fontsize=8)
    ax1.set_ylim(0, 2.5)
    ax1.grid(axis="y", alpha=0.3)

    # Add count labels
    for bar, n in zip(bars, counts):
        ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                 f"n={n}", ha="center", fontsize=7, color="gray")

    # Right: AI SPC per model
    ai_names = [a["name"].replace(" 20240107", "").replace("ChatGPT ", "GPT-")
                for a in ai_initial]
    ai_spc = [a["score"] / a["correct"] for a in ai_initial]
    colors = ["#C44E52" if spc < 1.5 else "#55A868" for spc in ai_spc]

    y_pos = range(len(ai_names))
    ax2.barh(y_pos, ai_spc, color=colors, alpha=0.7, edgecolor="white")
    ax2.set_yticks(y_pos)
    ax2.set_yticklabels(ai_names, fontsize=8)
    ax2.axvline(2.0, color="green", linestyle="--", alpha=0.5)
    ax2.axvline(np.mean([h["score"]/h["correct"] for h in humans if h["correct"] > 0]),
                color="#4C72B0", linestyle="--", alpha=0.7, label="Human mean")
    ax2.set_xlabel("Score Per Correct Answer", fontsize=11)
    ax2.set_title("AI: Penalised by Overconfidence", fontsize=12)
    ax2.legend(fontsize=8)
    ax2.set_xlim(0, 2.5)
    ax2.grid(axis="x", alpha=0.3)

    plt.tight_layout()
    path = FIG_DIR / "spc_comparison.pdf"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Wrote {path}")


def main():
    print("Generating Paper B figures...")
    humans = load_humans()
    ais = load_ais()

    fig1_score_distribution(humans, ais)
    fig2_calibration_by_accuracy(humans, ais)
    fig3_spc_comparison(humans, ais)

    print(f"Done. Figures written to {FIG_DIR}")


if __name__ == "__main__":
    main()
