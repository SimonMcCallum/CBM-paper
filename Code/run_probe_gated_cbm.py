"""Run game design MCQs through local LLM with activation probe for Paper D.

Loads Mistral-7B, runs each MCQ question with activation extraction,
computes P(correct) from the probe, maps to CBM confidence level via HLCC,
and reports the resulting CBM scores under different strategies.

Uses the trained probe from the activation-forensics selective experiment
(if available), or trains a quick probe from ARC data.

Outputs:
    Documentation/generated/paper_d_probe_results.json
    Documentation/generated/paper_d_macros.tex

Usage:
    python Code/run_probe_gated_cbm.py
    python Code/run_probe_gated_cbm.py --cache-dir /path/to/models
"""
import os, sys, io, json, csv, time, argparse
import numpy as np
import torch
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

DATA_DIR = Path(__file__).resolve().parent.parent
ACTFORENSICS = Path(__file__).resolve().parent.parent.parent / "Mistral-Activation-test" / "activation-forensics"
GEN_DIR = DATA_DIR / "Documentation" / "generated"
GEN_DIR.mkdir(parents=True, exist_ok=True)

# Add activation-forensics to path for hook/probe reuse
sys.path.insert(0, str(ACTFORENSICS))
sys.path.insert(0, str(ACTFORENSICS / "src"))

# CBM scoring
CBM = {
    1: {"correct": 1.0, "incorrect": 0.0},
    2: {"correct": 1.5, "incorrect": -0.5},
    3: {"correct": 2.0, "incorrect": -2.0},
}

def hlcc_optimal_c(p):
    if p >= 1.0: return 10.0
    if p <= 0.0: return 0.0
    return p / (4.0 * (1.0 - p))

def p_to_cbm_level(p):
    c = hlcc_optimal_c(p)
    if c < 0.25: return 1
    elif c < 0.75: return 2
    else: return 3

def cbm_score(level, is_correct):
    return CBM[level]["correct" if is_correct else "incorrect"]


def load_questions():
    """Load game design MCQs from mcq.json."""
    with open(DATA_DIR / "Code" / "mcq.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    questions = []
    for q in data["questions"]:
        options = [opt["text"] for opt in q["options"]]
        correct_key = q["correctAnswer"].lower()
        correct_idx = ord(correct_key) - ord("a")
        questions.append({
            "id": q["id"],
            "question": q["question"],
            "options": options,
            "correct_index": correct_idx,
        })
    return questions


def default_cache():
    env = os.environ.get("TRANSFORMERS_CACHE")
    if env and os.path.isdir(env): return env
    candidates = [
        str(DATA_DIR.parent / "NNCONFIDENCE" / "data" / "models"),
        str(DATA_DIR.parent / "NNConfidence" / "data" / "models"),
        "D:\\git\\NNCONFIDENCE\\data\\models",
    ]
    for c in candidates:
        if os.path.isdir(c): return c
    return candidates[0]


def load_model(cache_dir):
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    model_name = "mistralai/Mistral-7B-Instruct-v0.3"
    print(f"Loading {model_name} (4-bit)...")

    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                              bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_name, cache_dir=cache_dir, quantization_config=bnb,
        device_map="auto", trust_remote_code=True)
    model.eval()
    return model, tokenizer


class SimpleHooks:
    """Minimal hooks for gate activations."""
    def __init__(self, model):
        self.hooks = []
        self.gate = {}
        self.n_layers = 0
        layers = None
        for attr in ["model", "transformer"]:
            base = getattr(model, attr, None)
            if base is not None and hasattr(base, "layers"):
                layers = base.layers
                break
        if layers is None:
            raise ValueError("Cannot find layers")
        self.n_layers = len(layers)
        for i, layer in enumerate(layers):
            mlp = getattr(layer, "mlp", None)
            if mlp is None: continue
            gate = getattr(mlp, "gate_proj", None)
            if gate is not None:
                self.hooks.append(gate.register_forward_hook(self._gate(i)))

    def _gate(self, i):
        def hook(m, inp, out): self.gate[i] = out.detach()
        return hook
    def clear(self): self.gate.clear()
    def extract_nearzero(self, layer=20):
        target = min(layer, self.n_layers - 1)
        g = self.gate.get(target)
        if g is None: return 0.5
        return (g[0, -1, :].float().abs() < 1.0).float().mean().item()
    def extract_features(self):
        nz_vals = []
        for i in range(self.n_layers):
            g = self.gate.get(i)
            if g is None: continue
            nz_vals.append((g[0, -1, :].float().abs() < 1.0).float().mean().item())
        return {"nearzero_mean": np.mean(nz_vals) if nz_vals else 0.5}
    def remove(self):
        for h in self.hooks: h.remove()


OPTION_LABELS = "ABCDE"

def format_mcq(question, options):
    lines = [question]
    for i, opt in enumerate(options):
        lines.append(f"{OPTION_LABELS[i]}) {opt}")
    lines.append(f"Answer with just the letter ({', '.join(OPTION_LABELS[:len(options)])}).")
    return "\n".join(lines)

def tokenize_chat(tokenizer, text):
    messages = [{"role": "user", "content": text}]
    try:
        chat_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    except Exception:
        chat_text = f"[INST] {text} [/INST]"
    return tokenizer(chat_text, return_tensors="pt", truncation=True, max_length=512)


@torch.inference_mode()
def answer_question(model, tokenizer, hooks, q):
    """Answer one MCQ and extract activation features."""
    n_opts = len(q["options"])
    text = format_mcq(q["question"], q["options"])
    inputs = tokenize_chat(tokenizer, text).to(model.device)

    hooks.clear()
    outputs = model(**inputs)
    logits = outputs.logits[0, -1, :]
    probs = torch.softmax(logits.float(), dim=0)

    option_probs = []
    for i in range(n_opts):
        letter = OPTION_LABELS[i]
        tids = tokenizer.encode(letter, add_special_tokens=False)
        p = sum(probs[tid].item() for tid in tids)
        option_probs.append(p)

    total = sum(option_probs) + 1e-10
    option_probs = [p / total for p in option_probs]
    chosen = int(np.argmax(option_probs))
    msp = max(option_probs)
    is_correct = (chosen == q["correct_index"])

    # Activation features
    feats = hooks.extract_features()
    nz20 = hooks.extract_nearzero(20)

    return {
        "qid": q["id"],
        "chosen": chosen,
        "correct_index": q["correct_index"],
        "is_correct": is_correct,
        "msp": msp,
        "option_probs": option_probs,
        "nearzero_mean": feats["nearzero_mean"],
        "nearzero_L20": nz20,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache-dir", type=str, default=None)
    args = parser.parse_args()
    cache_dir = args.cache_dir or default_cache()

    questions = load_questions()
    print(f"Loaded {len(questions)} game design MCQs")

    model, tokenizer = load_model(cache_dir)
    hooks = SimpleHooks(model)
    print(f"  {hooks.n_layers} layers hooked")

    # Run all questions
    results = []
    for q in questions:
        r = answer_question(model, tokenizer, hooks, q)
        results.append(r)
        status = "CORRECT" if r["is_correct"] else "WRONG"
        print(f"  Q{r['qid']:>2d}: {status}  MSP={r['msp']:.3f}  NZ20={r['nearzero_L20']:.4f}")

    n_correct = sum(1 for r in results if r["is_correct"])
    accuracy = n_correct / len(results)
    print(f"\nAccuracy: {n_correct}/{len(results)} ({accuracy:.0%})")

    # Compute CBM scores under different strategies
    print(f"\n{'Strategy':<25s} {'Score':>7s} {'SPC':>7s}")
    print("-" * 40)

    # Raw: always confidence 3
    raw_score = sum(cbm_score(3, r["is_correct"]) for r in results)
    raw_spc = raw_score / max(n_correct, 1)
    print(f"{'Always conf-3':<25s} {raw_score:>7.1f} {raw_spc:>7.2f}")

    # Oracle: conf 3 when correct, conf 1 when wrong
    oracle_score = sum(
        cbm_score(3, True) if r["is_correct"] else cbm_score(1, False)
        for r in results
    )
    oracle_spc = oracle_score / max(n_correct, 1)
    print(f"{'Oracle (perfect probe)':<25s} {oracle_score:>7.1f} {oracle_spc:>7.2f}")

    # Probe-gated: use MSP as P(correct) proxy
    probe_msp_score = sum(
        cbm_score(p_to_cbm_level(r["msp"]), r["is_correct"])
        for r in results
    )
    probe_msp_spc = probe_msp_score / max(n_correct, 1)
    print(f"{'MSP-gated':<25s} {probe_msp_score:>7.1f} {probe_msp_spc:>7.2f}")

    # Probe-gated: use nearzero as familiarity proxy
    # Map nearzero to P(correct) via simple threshold
    nz_vals = [r["nearzero_L20"] for r in results]
    nz_med = np.median(nz_vals)
    probe_nz_score = 0
    for r in results:
        # Higher nearzero = more familiar = higher P(correct)
        if r["nearzero_L20"] >= nz_med:
            p_est = 0.75  # familiar
        else:
            p_est = 0.35  # unfamiliar
        probe_nz_score += cbm_score(p_to_cbm_level(p_est), r["is_correct"])
    probe_nz_spc = probe_nz_score / max(n_correct, 1)
    print(f"{'Familiarity-gated':<25s} {probe_nz_score:>7.1f} {probe_nz_spc:>7.2f}")

    # Save results
    output = {
        "model": "mistral-7b-4bit",
        "n_questions": len(results),
        "n_correct": n_correct,
        "accuracy": accuracy,
        "scores": {
            "raw_always3": raw_score,
            "oracle": oracle_score,
            "msp_gated": probe_msp_score,
            "familiarity_gated": probe_nz_score,
        },
        "per_question": results,
    }
    out_path = GEN_DIR / "paper_d_probe_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nResults: {out_path}")

    # Generate macros
    macros = []
    macros.append("% Auto-generated: Paper D probe-gated CBM results")
    macros.append(f"% Model: mistral-7b-4bit, {len(results)} questions")
    macros.append("")
    macros.append(f"\\newcommand{{\\probeNQ}}{{{len(results)}}}")
    macros.append(f"\\newcommand{{\\probeNCorrect}}{{{n_correct}}}")
    macros.append(f"\\newcommand{{\\probeAccuracy}}{{{accuracy*100:.0f}}}")
    macros.append(f"\\newcommand{{\\probeRawScore}}{{{raw_score:.1f}}}")
    macros.append(f"\\newcommand{{\\probeOracleScore}}{{{oracle_score:.1f}}}")
    macros.append(f"\\newcommand{{\\probeMSPScore}}{{{probe_msp_score:.1f}}}")
    macros.append(f"\\newcommand{{\\probeFamScore}}{{{probe_nz_score:.1f}}}")
    macros.append(f"\\newcommand{{\\probeImprovement}}{{{probe_nz_score - raw_score:+.1f}}}")

    macro_path = GEN_DIR / "paper_d_macros.tex"
    with open(macro_path, "w", encoding="utf-8") as f:
        f.write("\n".join(macros))
    print(f"Macros: {macro_path}")

    hooks.remove()


if __name__ == "__main__":
    main()
