import csv
import math
from collections import Counter
from statistics import mean, median
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent
AI_CSV = DATA_DIR / "AI_Scores.csv"
HUMAN_CSV = DATA_DIR / "Human_Scores.csv"
OUTPUT_DIR = DATA_DIR / "Documentation" / "generated" / "figures"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load human data
human_scores = []
human_correct = []
with open(HUMAN_CSV, newline="") as f:
    reader = csv.DictReader(f, skipinitialspace=True)
    for row in reader:
        try:
            human_scores.append(float(row["Score"]))
        except Exception:
            try:
                human_scores.append(float(row["Score"].strip()))
            except Exception:
                continue
        human_correct.append(int(row["Correct"]))

human_stats = {
    "mean_score": mean(human_scores),
    "median_score": median(human_scores),
    "mean_correct": mean(human_correct),
    "median_correct": median(human_correct),
    "count": len(human_scores),
}

# Histogram of scores (bin width 1)
hist = Counter()
for s in human_scores:
    hist[math.floor(s)] += 1
with open(OUTPUT_DIR / "human_hist.dat", "w") as f:
    f.write("bin,count\n")
    for b in sorted(hist):
        f.write(f"{b},{hist[b]}\n")

# Distribution of number correct
correct_dist = Counter(human_correct)
with open(OUTPUT_DIR / "human_correct_dist.dat", "w") as f:
    f.write("correct,count\n")
    for c in sorted(correct_dist):
        f.write(f"{c},{correct_dist[c]}\n")

# Load AI data
ai_entries = []
with open(AI_CSV, newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            score = float(row[" Score "])
        except Exception:
            try:
                score = float(row.get("Score", ""))
            except Exception:
                score = math.nan
        ai_entries.append({
            "AI": row["AI"],
            "Score": score,
            "Correct": int(row["Correct"]),
        })

ai_scores = [e["Score"] for e in ai_entries if not math.isnan(e["Score"])]
ai_correct = [e["Correct"] for e in ai_entries]
ai_stats = {
    "mean_score": mean(ai_scores),
    "median_score": median(ai_scores),
    "mean_correct": mean(ai_correct),
    "median_correct": median(ai_correct),
    "count": len(ai_entries),
}

name_count = {}
with open(OUTPUT_DIR / "ai_scores.dat", "w") as f:
    f.write("key,AI,Score\n")
    for e in ai_entries:
        if math.isnan(e["Score"]):
            continue
        base_name = e["AI"].replace(",", " ")
        count = name_count.get(base_name, 0) + 1
        name_count[base_name] = count
        key = base_name.replace(" ", "").replace("-", "")
        if count > 1:
            key += str(count)
        name = base_name if count == 1 else f"{base_name}-{count}"
        f.write(f"{key},{name},{e['Score']}\n")

with open(OUTPUT_DIR / "stats.txt", "w") as f:
    f.write("Human Statistics:\n")
    for k, v in human_stats.items():
        f.write(f"{k}: {v}\n")
    f.write("\nAI Statistics:\n")
    for k, v in ai_stats.items():
        f.write(f"{k}: {v}\n")

print("Data files written to", OUTPUT_DIR)
