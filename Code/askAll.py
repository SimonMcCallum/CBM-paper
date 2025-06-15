import json
import os
import uuid
from datetime import datetime
import requests
from config import (
    QUESTION_FILE,
    MODEL_FILE,
    INTERACTION_LOG,
    ANSWERS_FILE,
    TEMPERATURES,
    NUM_REPETITIONS,
    OPENAI_API_KEY,
    CLAUDE_API_KEY,
    GEMINI_API_KEY,
    OPENAI_ENDPOINT,
    CLAUDE_ENDPOINT,
    GEMINI_ENDPOINT
)
from anthropic import Anthropic

class conversation:
    def __init__(self, api_key):
        self.anthropic = Anthropic(api_key  = api_key)  
        

class MultichoiceQuestion:
    def __init__(self):
        self.anthropic = Anthropic(api_key=CLAUDE_API_KEY)


    def load_questions(self):
        with open(QUESTION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data["eval_data"]

    def load_models(self):
        with open(MODEL_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def log_interaction(self,log_entry):
        # Append a new interaction to the log file
        if not os.path.exists(os.path.dirname(INTERACTION_LOG)):
            os.makedirs(os.path.dirname(INTERACTION_LOG), exist_ok=True)
        if not os.path.exists(INTERACTION_LOG):
            with open(INTERACTION_LOG, "w", encoding="utf-8") as f:
                json.dump([], f)
        with open(INTERACTION_LOG, "r+", encoding="utf-8") as f:
            data = json.load(f)
            data.append(log_entry)
            f.seek(0)
            json.dump(data, f, indent=2)

    def save_answers(self,answers):
        # Save the final answers dictionary to a file
        if not os.path.exists(os.path.dirname(ANSWERS_FILE)):
            os.makedirs(os.path.dirname(ANSWERS_FILE), exist_ok=True)
        with open(ANSWERS_FILE, "w", encoding="utf-8") as f:
            json.dump(answers, f, indent=2)

    def send_to_openai(self, question_text, model, temperature):
        """Send a prompt to the OpenAI API."""
        if not OPENAI_API_KEY:
            return None
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": question_text}],
            "temperature": temperature,
        }
        try:
            resp = requests.post(OPENAI_ENDPOINT, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            return None

    def send_to_claude(self, question_text, model, temperature):
        """Send a prompt to Anthropic Claude."""
        if not CLAUDE_API_KEY:
            return None
        try:
            message = self.anthropic.messages.create(
                model=model,
                max_tokens=100,
                temperature=temperature,
                messages=[{"role": "user", "content": question_text}],
            )
            return message.content
        except Exception as e:
            print(f"Error calling Claude API: {e}")
            return None

    def send_to_gemini(self, question_text, model, temperature):
        """Send a prompt to the Gemini API."""
        if not GEMINI_API_KEY:
            return None
        headers = {
            "Authorization": f"Bearer {GEMINI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": question_text}],
            "temperature": temperature,
        }
        try:
            resp = requests.post(GEMINI_ENDPOINT, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return None

    def send_confidence_request(self,answer_text, model, vendor, temperature):
        # You mentioned "then sending confidence to assess confidence in the answer."
        # If you have a separate call to assess confidence, implement it here.
        # Otherwise, if the API supports it in one go, adapt accordingly.
        # This could be a separate function that queries the model about its confidence.
        return "Confidence assessment placeholder"

def main():
    # create instance of MultichoiceQuestion
    mcq = MultichoiceQuestion()
    
    questions = mcq.load_questions()
    models = mcq.load_models()

    api_keys = {
        "OpenAI": OPENAI_API_KEY,
        "Claude": CLAUDE_API_KEY,
        "Gemini": GEMINI_API_KEY,
    }

    # Filter vendors by available API keys
    available_models = {
        vendor: data
        for vendor, data in models.items()
        if api_keys.get(vendor)
    }

    # Structure to hold answers:
    # {
    #   question_id: {
    #       vendor: {
    #           model_name: {
    #               str(temperature): [ { "answer": "...", "confidence": "...", "timestamp": "..." }, ... repeated NUM_REPETITIONS times ]
    #           }
    #       }
    #   }
    # }
    collected_answers = {}

    for question in questions:
        qid = question["question_id"]
        qtext = question["prompt"]
        collected_answers[qid] = {}

        # Work through each vendor that has an API key
        for vendor, vendor_data in available_models.items():
            collected_answers[qid][vendor] = {}
            for model_name in vendor_data["models"]:
                collected_answers[qid][vendor][model_name] = {}
                for temp in TEMPERATURES:
                    collected_answers[qid][vendor][model_name][str(temp)] = []

                    for i in range(NUM_REPETITIONS):
                        # Send the question
                        if vendor == "OpenAI":
                            answer = mcq.send_to_openai(qtext, model_name, temp)
                        elif vendor == "Claude":
                            answer = mcq.send_to_claude(qtext, model_name, temp)
                        elif vendor == "Gemini":
                            answer = mcq.send_to_gemini(qtext, model_name, temp)
                        else:
                            raise ValueError("Unknown vendor")

                        # Send to get confidence (if required)
                        confidence = mcq.send_confidence_request(answer, model_name, vendor, temp)

                        # Log the interaction
                        log_entry = {
                            "timestamp": datetime.now().isoformat(),
                            "question_id": qid,
                            "vendor": vendor,
                            "model": model_name,
                            "temperature": temp,
                            "iteration": i+1,
                            "question_text": qtext,
                            "answer": answer,
                            "confidence": confidence
                        }
                        mcq.log_interaction(log_entry)

                        # Save answer in structure
                        collected_answers[qid][vendor][model_name][str(temp)].append({
                            "answer": answer,
                            "confidence": confidence,
                            "timestamp": log_entry["timestamp"]
                        })

    # After all questions are processed, save all answers
    mcq.save_answers(collected_answers)

if __name__ == "__main__":
    # Run the main function
    main()
    
