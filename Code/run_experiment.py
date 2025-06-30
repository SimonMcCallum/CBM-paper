# run_experiment.py
import json
import os
from datetime import datetime

from config import (
    QUESTION_FILE,
    TEMPERATURES,
    NUM_REPETITIONS,
    INTERACTION_LOG,
    ANSWERS_FILE
)
from api_calls import get_openai_response, get_claude_response, get_gemini_response

def load_questions(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["questions"]

def run_experiment():
    # Load questions
    questions = load_questions(QUESTION_FILE)
    
    # Prepare data structure for all answers
    all_answers = []
    
    # For each question
    for question in questions:
        question_id = question["id"]
        question_text = question["question"]
        
        # For each temperature
        for temp in TEMPERATURES:
            # Repeat multiple times
            for rep in range(NUM_REPETITIONS):
                # For each model, get response
                # (You could also load model configs from models.json if you prefer)
                
                openai_ans = get_openai_response(question_text, temp)
                claude_ans = get_claude_response(question_text, temp)
                gemini_ans = get_gemini_response(question_text, temp)
                
                # Create log entry
                log_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "question_id": question_id,
                    "temperature": temp,
                    "repetition": rep,
                    "model_responses": {
                        "openai": openai_ans,
                        "claude": claude_ans,
                        "gemini": gemini_ans
                    }
                }
                
                # Append to all_answers
                all_answers.append(log_entry)
                
                # Optional: write to interaction log to keep track in real time
                log_interaction(log_entry)
    
    # After we finish, save all answers to file
    save_answers(all_answers)

def log_interaction(entry):
    """
    Append each interaction to a JSON log file for debugging/record-keeping.
    """
    if not os.path.exists(INTERACTION_LOG):
        with open(INTERACTION_LOG, "w", encoding="utf-8") as f:
            json.dump([], f)
    with open(INTERACTION_LOG, "r+", encoding="utf-8") as f:
        data = json.load(f)
        data.append(entry)
        f.seek(0)
        json.dump(data, f, indent=2)

def save_answers(answers):
    """
    Save the final collection of answers to ANSWERS_FILE.
    """
    with open(ANSWERS_FILE, "w", encoding="utf-8") as f:
        json.dump(answers, f, indent=2)

if __name__ == "__main__":
    run_experiment()
    print("Experiment completed. Answers saved.")
