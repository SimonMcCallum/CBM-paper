import json
import os
import uuid
from datetime import datetime
from config import (
    QUESTION_FILE,
    MODEL_FILE,
    INTERACTION_LOG,
    ANSWERS_FILE,
    TEMPERATURES,
    NUM_REPETITIONS,
    PROMPTS_FILE,
    EVAL_FILE,
    OPENAI_API_KEY,
    CLAUDE_API_KEY,
    GEMINI_API_KEY
)
from anthropic import Anthropic

# Initialize Anthropic client globally
anthropic_client = Anthropic(api_key=CLAUDE_API_KEY)

# Define TextBlock class
class TextBlock:
    def __init__(self, content):
        self.content = content

    def to_dict(self):
        return self.content

class MultichoiceQuestion:
    def __init__(self, anthropic_client):
        self.anthropic = anthropic_client
        self.evaluations = []  # List to store evaluations

    def load_questions(self):
        with open(QUESTION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data["questions"]

    def load_models(self):
        with open(MODEL_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def load_prompts(self):
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def log_interaction(self, log_entry):
        # Append a new interaction to the log file
        if not os.path.exists(os.path.dirname(INTERACTION_LOG)):
            os.makedirs(os.path.dirname(INTERACTION_LOG), exist_ok=True)
        if not os.path.exists(INTERACTION_LOG):
            with open(INTERACTION_LOG, "w", encoding="utf-8") as f:
                json.dump([], f)  # Initialize with an empty list

        with open(INTERACTION_LOG, "r+", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print("Log file was empty or invalid, initializing with an empty list.")
                data = []

            data.append(log_entry)
            f.seek(0)  # Reset file pointer to the beginning
            json.dump(data, f, indent=2)
            f.truncate()  # Remove any remaining old content

    def save_answers(self, answers):
        # Save the final answers dictionary to a file
        if not os.path.exists(os.path.dirname(ANSWERS_FILE)):
            os.makedirs(os.path.dirname(ANSWERS_FILE), exist_ok=True)
        with open(ANSWERS_FILE, "w", encoding="utf-8") as f:
            json.dump(answers, f, indent=2)

    def save_evaluations(self):
        # Save evaluations to a file
        evaluations_file = EVAL_FILE # You can put this in config.py
        if not os.path.exists(os.path.dirname(evaluations_file)):
            os.makedirs(os.path.dirname(evaluations_file), exist_ok=True)
        with open(evaluations_file, "w", encoding="utf-8") as f:
            json.dump(self.evaluations, f, indent=2)

    def send_to_openai(self, question_text, model, temperature, persona_prompt):
        # Implement OpenAI API call here
        print(f"Sending to OpenAI: {question_text}, Model: {model}, Temp: {temperature}, Persona: {persona_prompt}")
        # ... your OpenAI API call code ...
        # Ensure to include the persona prompt in your API call to OpenAI
        prompt_with_persona = f"{persona_prompt} {question_text}"
        # Simulate receiving a response
        response = f"OpenAI response placeholder for: {question_text} with persona {persona_prompt}"
        print(f"  OpenAI Response: {response}")
        return response

    def send_to_claude(self, question_text, model, temperature, persona_prompt):
        """Generate document using Claude API"""
        print(f"Sending to Claude: {question_text}, Model: {model}, Temp: {temperature}, Persona: {persona_prompt}")
        try:
            prompt_with_persona = f"{persona_prompt} {question_text}"
            message = self.anthropic.messages.create(
                model=model,
                max_tokens=1000,
                temperature=temperature,
                messages=[
                    {"role": "user", "content": prompt_with_persona}
                ]
            )
            response_content = message.content[0].to_dict()
            print(f"  Claude Response: {response_content}")
            return TextBlock(response_content)
        except Exception as e:
            print(f"  Error calling Claude API: {e}")
            return None

    def send_to_gemini(self, question_text, model, temperature, persona_prompt):
        # Implement Gemini API call here
        print(f"Sending to Gemini: {question_text}, Model: {model}, Temp: {temperature}, Persona: {persona_prompt}")
        # ... your Gemini API call code ...
        # Ensure to include the persona prompt in your API call to Gemini
        prompt_with_persona = f"{persona_prompt} {question_text}"
        # Simulate receiving a response
        response = f"Gemini response placeholder for: {question_text} with persona {persona_prompt}"
        print(f"  Gemini Response: {response}")
        return response

    def assess_answer(self, question, answer, model_name, vendor):
        """Assess the correctness of an answer."""
        correct_answer_key = question.get("correctAnswer")
        if correct_answer_key is None:
            print(f"  Warning: No correct answer provided for question {question['id']}")
            return "Unknown"

        # Retrieve the correct answer text based on the key
        correct_answer_text = None
        for option in question.get("options", []):
            if option.get("key") == correct_answer_key:
                correct_answer_text = option.get("text")
                break

        if correct_answer_text is None:
            print(f"  Warning: Could not find correct answer text for key '{correct_answer_key}' in question {question['id']}")
            return "Unknown"

        # Handle TextBlock objects
        if isinstance(answer, TextBlock):
            answer_text = answer.content.get('text', '')  # Get 'text' from content if it exists
        else:
            answer_text = str(answer)  # Convert to string if not a TextBlock

        # Check if the answer_text contains the correct answer
        is_correct = correct_answer_text.lower() in answer_text.lower()

        # Create an evaluation entry
        evaluation = {
            "question_id": question["id"],
            "vendor": vendor,
            "model": model_name,
            "answer_provided": answer_text,
            "correct_answer": correct_answer_text,
            "is_correct": is_correct
        }
        self.evaluations.append(evaluation)
        self.save_evaluations()  # Save evaluations after each assessment

        return is_correct

    def send_confidence_request(self, answer_text, model, vendor, temperature, confidence_prompt):
        # Implement confidence assessment logic here
        print(f"Assessing confidence for: {answer_text}, Model: {model}, Vendor: {vendor}, Temp: {temperature}, Confidence Prompt: {confidence_prompt}")
        # ... your confidence assessment code ...
        # Append the confidence prompt to the answer text to create a query for the confidence assessment
        confidence_query = f"{answer_text} {confidence_prompt}"

        # Depending on the vendor, send the confidence_query to the appropriate API
        if vendor == "OpenAI":
            # ... call OpenAI API with confidence_query ...
            pass
        elif vendor == "Claude":
            # ... call Claude API with confidence_query ...
            pass
        elif vendor == "Gemini":
            # ... call Gemini API with confidence_query ...
            pass

        # For now, let's simulate a confidence score
        confidence = "High"  # Replace with actual confidence assessment
        print(f"  Confidence: {confidence}")
        return confidence

def main():
    mcq = MultichoiceQuestion(anthropic_client)
    questions = mcq.load_questions()
    models = mcq.load_models()
    prompts = mcq.load_prompts()  # Load the prompts
    collected_answers = {}

    for question in questions:
        qid = question["id"]
        qtext = question["question"]
        print(f"\nProcessing Question: {qid} - {qtext}")

        if qid not in collected_answers:
            collected_answers[qid] = {}

        for vendor, vendor_data in models.items():
            if vendor not in collected_answers[qid]:
                collected_answers[qid][vendor] = {}

            for model_name in vendor_data["models"]:
                if model_name not in collected_answers[qid][vendor]:
                    collected_answers[qid][vendor][model_name] = {}

                for temp in TEMPERATURES:
                    if str(temp) not in collected_answers[qid][vendor][model_name]:
                        collected_answers[qid][vendor][model_name][str(temp)] = []

                    # Iterate over each persona prompt
                    for persona_key, persona_data in prompts["promptConfigurations"]["personaPrompts"].items():
                        persona_prompt = persona_data["promptText"]

                        # Iterate over each confidence prompt
                        for confidence_key, confidence_data in prompts["promptConfigurations"]["confidencePrompts"].items():
                            confidence_prompt = confidence_data["promptText"]

                            for i in range(NUM_REPETITIONS):
                                print(f"\nIteration {i+1} - Vendor: {vendor}, Model: {model_name}, Temperature: {temp}, Persona: {persona_key}, Confidence: {confidence_key}")

                                # Send the question with persona prompt
                                if vendor == "OpenAI":
                                    answer = mcq.send_to_openai(qtext, model_name, temp, persona_prompt)
                                elif vendor == "Claude":
                                    answer = mcq.send_to_claude(qtext, model_name, temp, persona_prompt)
                                elif vendor == "Gemini":
                                    answer = mcq.send_to_gemini(qtext, model_name, temp, persona_prompt)
                                else:
                                    raise ValueError("Unknown vendor")

                                # Assess the answer immediately after receiving it
                                is_correct = mcq.assess_answer(question, answer, model_name, vendor)
                                print(f"  Assessment: {'Correct' if is_correct else 'Incorrect'}")

                                # Send to get confidence with confidence prompt
                                confidence = mcq.send_confidence_request(answer, model_name, vendor, temp, confidence_prompt)

                                # Convert answer to a dictionary before logging
                                if isinstance(answer, TextBlock):
                                    answer_to_log = answer.to_dict()
                                else:
                                    answer_to_log = answer

                                # Log the interaction
                                timestamp = datetime.now().isoformat()
                                log_entry = {
                                    "timestamp": timestamp,
                                    "question_id": qid,
                                    "vendor": vendor,
                                    "model": model_name,
                                    "temperature": temp,
                                    "iteration": i + 1,
                                    "question_text": qtext,
                                    "answer": answer_to_log,
                                    "confidence": confidence,
                                    "persona": persona_key,  # Add persona to log entry
                                    "confidence_prompt": confidence_key  # Add confidence prompt to log entry
                                }
                                mcq.log_interaction(log_entry)

                                # Save answer in structure
                                collected_answers[qid][vendor][model_name][str(temp)].append({
                                    "answer": answer_to_log,
                                    "confidence": confidence,
                                    "timestamp": timestamp,
                                    "persona": persona_key,  # Add persona to saved answers
                                    "confidence_prompt": confidence_key  # Add confidence prompt to saved answers
                                })

                                # Save results after each interaction
                                mcq.save_answers(collected_answers)

if __name__ == "__main__":
    main()