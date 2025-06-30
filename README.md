# CBM-paper
Confidence Based Marking paper

## Setup

Clone the repository with submodules so the Overleaf project is available:

```bash
git clone --recurse-submodules <repo>
```

If you already cloned without submodules, run:

```bash
git submodule update --init --recursive
```

Running the analysis script generates statistics and data for the graphs:

```bash
python3 Code/score_analysis.py
```

The PDF can be built from `Documentation/generated/main.tex`:

```bash
pdflatex Documentation/generated/main.tex
```
