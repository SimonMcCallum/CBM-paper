import json

# Let's pretend these are file paths:
PROMPTS_FILE = "code/prompts.json"  # your promptConfigurations
QUESTION_FILE = "code/mcq.json"     # your MCQ questions

def load_prompt_configurations(path: str) -> dict:
    """Load the entire 'promptConfigurations' JSON from file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["promptConfigurations"]

def load_questions(path: str) -> list:
    """Load the list of questions from MCQ JSON."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["questions"]

def build_combined_prompt(
    question_data: dict,
    prompt_configurations: dict,
    persona_id: str = None
) -> str:
    """
    Build a single textual prompt that includes:
      1) Optional persona prompt (e.g., 'acting as a first year...').
      2) The combined confidence prompt (which instructs the user to provide 
         a single letter & a single number).
      3) The question stem + MCQ options.

    We do NOT show the correct answer in the final prompt.
    """

    # 1) If a persona_id is provided, retrieve its prompt text
    persona_prompt = ""
    if persona_id and persona_id in prompt_configurations["personaPrompts"]:
        persona_prompt = prompt_configurations["personaPrompts"][persona_id]["promptText"]
    # e.g. "acting as a first year computer science student answer this question"

    # 2) Retrieve the "combined" confidence prompt text
    combined_confidence_prompt = prompt_configurations["confidencePrompts"]["combined"]["promptText"]
    # e.g. "Give a single character answer to the mcq and Give a number ... a 2\n"

    # 3) Build the MCQ question
    #    For example:
    #    "What do we mean by meaningful play?\na) That the rules...\nb) That there is...\nc) That the game..."
    mcq_text = question_data["question"]
    options_text = ""
    for option in question_data["options"]:
        letter = option["key"]
        text = option["text"]
        options_text += f"{letter}) {text}\n"

    # 4) Combine them into one final prompt, ensuring we do NOT reveal the correct answer
    final_prompt = ""
    if persona_prompt:
        final_prompt += persona_prompt + "\n\n"
    final_prompt += combined_confidence_prompt + "\n\n"
    final_prompt += mcq_text + "\n"
    final_prompt += options_text

    return final_prompt.strip()

def main():
    # 1. Load prompt configurations and questions
    prompt_configs = load_prompt_configurations(PROMPTS_FILE)
    questions = load_questions(QUESTION_FILE)
    
    # 2. Pick one question (for demonstration, question #1)
    q = questions[0]  # e.g., the first question from the list

    # 3. Build the combined prompt (optionally choose a persona, e.g. "first-year")
    persona = "1st-year"  # or None, or "professor", etc.
    prompt = build_combined_prompt(q, prompt_configs, persona_id=persona)

    # 4. Print out the final prompt we’d send to the LLM
    print("FINAL PROMPT TO LLM:\n")
    print(prompt)
    print("\n--- END OF PROMPT ---\n")

if __name__ == "__main__":
    main()
