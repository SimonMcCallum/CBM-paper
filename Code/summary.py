# summary.py
import json
from config import ANSWERS_FILE, EVAL_FILE, QUESTION_FILE

def summarize_experiment():
    # Load the original questions (for correct answers, if needed)
    with open(QUESTION_FILE, "r", encoding="utf-8") as f:
        question_data = json.load(f)
    question_map = {q["id"]: q for q in question_data["questions"]}
    
    # Load the answers collected
    with open(ANSWERS_FILE, "r", encoding="utf-8") as f:
        answers = json.load(f)
    
    # Example: Evaluate correctness if we can parse out the model’s chosen option (you’d refine in real usage)
    # This step depends on how your model output is structured (which option was chosen?)
    
    evaluations = []
    
    for ans in answers:
        qid = ans["question_id"]
        question_info = question_map[qid]
        
        # For demonstration, assume the raw model response is something like "I think option B"
        # You’d parse that to map it to the correct answer’s key (b).
        # This is a trivial example, real parsing is more complicated.
        
        openai_raw = ans["model_responses"]["openai"]
        claude_raw = ans["model_responses"]["claude"]
        gemini_raw = ans["model_responses"]["gemini"]
        
        # A naive “did it mention the correct letter” check
        correct_letter = question_info["correctAnswer"]
        
        openai_correct = (correct_letter.lower() in openai_raw.lower())
        claude_correct = (correct_letter.lower() in claude_raw.lower())
        gemini_correct = (correct_letter.lower() in gemini_raw.lower())
        
        eval_entry = {
            "question_id": qid,
            "temperature": ans["temperature"],
            "repetition": ans["repetition"],
            "openai_correct": openai_correct,
            "claude_correct": claude_correct,
            "gemini_correct": gemini_correct
        }
        evaluations.append(eval_entry)
    
    # Save evaluations
    with open(EVAL_FILE, "w", encoding="utf-8") as f:
        json.dump(evaluations, f, indent=2)

    # Optionally, compute summary stats or produce final textual summary
    # e.g. overall accuracy per model
    overall_openai = sum(e["openai_correct"] for e in evaluations) / len(evaluations)
    overall_claude = sum(e["claude_correct"] for e in evaluations) / len(evaluations)
    overall_gemini = sum(e["gemini_correct"] for e in evaluations) / len(evaluations)
    
    print("Summary of Model Performance:")
    print(f"  OpenAI accuracy: {overall_openai:.2f}")
    print(f"  Claude accuracy: {overall_claude:.2f}")
    print(f"  Gemini accuracy: {overall_gemini:.2f}")

if __name__ == "__main__":
    summarize_experiment()
