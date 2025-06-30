import json

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

def build_linear_prompt(question_data: dict, prompt_configurations: dict, persona_id: str = None) -> str:
    """
    Build the *first* linear prompt (asking for the MCQ letter only).
    We do NOT reveal the correct answer.
    
    Example output:

      acting as a first year computer science student answer this question

      Give a single character answer to the mcq.  Respond with ONLY a single letter for example: a

      What do we mean by meaningful play?
      a) That the rules...
      b) That there is...
      c) ...
      d) ...
      e) ...
    """

    # Optional persona
    persona_prompt = ""
    if persona_id and persona_id in prompt_configurations["personaPrompts"]:
        persona_prompt = prompt_configurations["personaPrompts"][persona_id]["promptText"]

    # The linear prompt text for the single-letter answer
    linear_prompt_text = prompt_configurations["confidencePrompts"]["linear"]["promptText"]
    # e.g., "Give a single character answer to the mcq. Respond with ONLY a single letter..."

    # Build MCQ question text
    question_stem = question_data["question"]
    options_text = ""
    for option in question_data["options"]:
        letter = option["key"]
        text = option["text"]
        options_text += f"{letter}) {text}\n"

    # Combine into one prompt
    final_prompt = ""
    if persona_prompt:
        final_prompt += persona_prompt + "\n\n"

    final_prompt += linear_prompt_text + "\n\n"
    final_prompt += question_stem + "\n"
    final_prompt += options_text

    return final_prompt.strip()

def build_linear_followup_prompt(question_data: dict, prompt_configurations: dict, previous_answer: str = None) -> str:
    """
    Build the *second* prompt (the follow-up) that asks for the confidence level (1–3).
    Optionally include the user's previous answer in some way if needed for context.
    
    Example output:

      You answered 'a'. 
      Give a number between 1-3 for your confidence...
      For example: 2
    """

    followup_text = prompt_configurations["confidencePrompts"]["linear"]["folloupText"]
    # e.g., "Give a number between 1-3 for your confidence in the previous answer..."

    # You can optionally mention the previous answer or just rely on conversation context
    final_prompt = ""
    if previous_answer:
        final_prompt += f"You answered '{previous_answer}'.\n\n"
    
    final_prompt += followup_text

    return final_prompt.strip()

def run_linear_prompt_flow(
    model_call_function,
    question_data: dict,
    prompt_configurations: dict,
    persona_id: str = None,
    conversation_context: list = None
):
    """
    1. Build the 'linear' prompt to request the letter (a, b, c, etc.).
    2. Send it to your LLM (e.g. Claude) in a conversation.
    3. Capture the response (e.g. "b").
    4. Build the follow-up prompt to request confidence (1–3).
    5. Send it again to the LLM with updated conversation context.
    6. Return (letter, confidence) or the full conversation messages.

    `model_call_function` is a placeholder for your code that calls Claude, OpenAI, etc.
     For example:  model_call_function(messages) -> returns an LLM response.
     
    `conversation_context` is a list of messages if you’re using an API that allows multi-turn conversation.
    """

    if conversation_context is None:
        # You might store messages as: [{"role": "system", "content": "You are a helpful assistant"}, ...]
        conversation_context = []

    # --- Step 1: Build the first (linear) prompt for the letter only
    first_prompt = build_linear_prompt(question_data, prompt_configurations, persona_id=persona_id)
    
    # Add it to context
    conversation_context.append({"role": "user", "content": first_prompt})

    # --- Step 2: Model call to get the letter
    letter_response = model_call_function(conversation_context)  
    # letter_response might be something like "a"
    
    # For demonstration, let's pretend we parse out the letter from the response:
    extracted_letter = letter_response.strip().lower()  # naive parse

    # --- Step 3: Build the follow-up prompt for confidence
    followup_prompt = build_linear_followup_prompt(question_data, prompt_configurations, previous_answer=extracted_letter)

    # Add it to context
    conversation_context.append({"role": "user", "content": followup_prompt})
    
    # --- Step 4: Model call to get the confidence
    confidence_response = model_call_function(conversation_context)
    # confidence_response might be something like "2"
    
    extracted_confidence = confidence_response.strip()

    # Return final results (letter + confidence) and possibly the entire conversation context
    return extracted_letter, extracted_confidence, conversation_context

def demo():
    # 1. Load the prompt configs and questions
    prompt_configs = load_prompt_configurations(PROMPTS_FILE)
    questions = load_questions(QUESTION_FILE)
    
    # 2. Take the first question for demonstration
    q = questions[0]
    
    # 3. Define a dummy model_call_function for demonstration.
    #    In your real code, you'd call claude / openAI with conversation context, e.g.:
    #        response = get_claude_response(conversation_context)
    def mock_model_call_function(messages):
        # Very simplistic mock that just returns "d" for the letter, "2" for confidence
        # In real usage, you'd parse messages[-1] to see the last user prompt
        if "Give a single character answer" in messages[-1]["content"]:
            return "d"  # Suppose the LLM said "d"
        else:
            return "2"  # Suppose the LLM said "2" for confidence

    # 4. Run the linear prompt flow
    letter, confidence, conversation = run_linear_prompt_flow(
        model_call_function=mock_model_call_function,
        question_data=q,
        prompt_configurations=prompt_configs,
        persona_id="1st-year"   # optionally pick "professor" or None
    )

    # 5. Show results
    print("=== Linear Prompt Flow Results ===")
    print(f"Model chose letter: {letter}")
    print(f"Model chose confidence: {confidence}")
    print("Full conversation context:")
    for turn in conversation:
        print(f"{turn['role'].upper()}: {turn['content']}\n")
    

if __name__ == "__main__":
    demo()
