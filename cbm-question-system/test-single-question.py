#!/usr/bin/env python3
"""
Test script for asking a single question to XAI (Grok-4)
This is the Python equivalent of the original askXAI.py but designed for single question testing
"""

import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def ask_single_question(question_text, options=None, correct_answer=None):
    """
    Ask XAI a single question and return the response with analysis
    """
    # Initialize XAI client
    client = OpenAI(
        api_key=os.getenv("XAI_API_KEY_CBM"),
        base_url="https://api.x.ai/v1",
    )
    
    # Build the question prompt
    if options:
        question_prompt = f"{question_text}\n"
        for option in options:
            question_prompt += f"{option['key'].upper()}. {option['text']}\n"
    else:
        question_prompt = question_text
    
    # Create the full prompt
    prompt = f"""This MCQ system needs an answer from a-e and a confidence which changes the marking system options are 1. <correct +1.0, incorrect -0.0> ; 2. <+1.5, -0.5> and 3. <+2.0,-2.0>.

Question: {question_prompt}

Provide the answer and a number for your confidence level. ie something like a,3"""

    try:
        # Make the API call
        completion = client.chat.completions.create(
            model="grok-4",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        # Extract the response
        response = completion.choices[0].message.content
        
        # Parse the response
        parsed = parse_response(response)
        
        # Calculate results if correct answer is provided
        results = {
            "question": question_text,
            "options": options,
            "raw_response": response,
            "parsed_answer": parsed["answer"],
            "confidence_level": parsed["confidence"],
            "confidence_description": get_confidence_description(parsed["confidence"])
        }
        
        if correct_answer:
            is_correct = parsed["answer"] and parsed["answer"].lower() == correct_answer.lower()
            cbm_score = calculate_cbm_score(parsed["answer"], correct_answer, parsed["confidence"])
            
            results.update({
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "cbm_score": cbm_score
            })
        
        return results
        
    except Exception as e:
        return {
            "error": str(e),
            "question": question_text
        }

def parse_response(response):
    """Parse the AI response to extract answer and confidence level"""
    result = {"answer": None, "confidence": None}
    
    # Clean and normalize the response
    clean_response = response.lower().strip()
    
    # Try to extract answer (single letter a-e)
    import re
    answer_match = re.search(r'\b([a-e])\b', clean_response)
    if answer_match:
        result["answer"] = answer_match.group(1)
    
    # Try to extract confidence level (1-3)
    confidence_match = re.search(r'\b([1-3])\b', clean_response)
    if confidence_match:
        result["confidence"] = int(confidence_match.group(1))
    
    return result

def get_confidence_description(confidence):
    """Get human-readable confidence description"""
    descriptions = {
        1: "Low (correct +1.0, incorrect -0.0)",
        2: "Medium (correct +1.5, incorrect -0.5)",
        3: "High (correct +2.0, incorrect -2.0)"
    }
    return descriptions.get(confidence, "Unknown")

def calculate_cbm_score(answer, correct_answer, confidence):
    """Calculate Confidence-Based Marking score"""
    if not answer or not confidence:
        return 0.0
    
    is_correct = answer.lower() == correct_answer.lower()
    
    if confidence == 1:
        return 1.0 if is_correct else 0.0
    elif confidence == 2:
        return 1.5 if is_correct else -0.5
    elif confidence == 3:
        return 2.0 if is_correct else -2.0
    else:
        return 0.0

def main():
    """Main test function"""
    print("Testing XAI Single Question Integration\n")
    
    # Test with a question from the MCQ set
    test_question = "What do we mean by meaningful play?"
    test_options = [
        {"key": "a", "text": "That the rules of the game provide a fair contest"},
        {"key": "b", "text": "That there is an enjoyable outcome from the game"},
        {"key": "c", "text": "That the game has strong narrative content"},
        {"key": "d", "text": "That it is easy to link your actions to consequences"},
        {"key": "e", "text": "That the play results in meaning"}
    ]
    correct_answer = "d"
    
    # Display the question
    print(f"Question: {test_question}\n")
    for option in test_options:
        print(f"{option['key'].upper()}. {option['text']}")
    print(f"\nCorrect Answer: {correct_answer}\n")
    
    # Check API key
    if not os.getenv("XAI_API_KEY_CBM"):
        print("❌ XAI_API_KEY_CBM environment variable not set!")
        print("Please set your XAI API key: export XAI_API_KEY_CBM=your_key_here")
        return
    
    print("Asking XAI (Grok-4)...")
    
    # Ask the question
    result = ask_single_question(test_question, test_options, correct_answer)
    
    # Display results
    if "error" in result:
        print(f"❌ Error: {result['error']}")
    else:
        print("\n=== XAI Response ===")
        print(f"Raw Response: {result['raw_response']}")
        print(f"Parsed Answer: {result['parsed_answer']}")
        print(f"Confidence Level: {result['confidence_level']}")
        print(f"Confidence Description: {result['confidence_description']}")
        
        if 'is_correct' in result:
            print("\n=== Results ===")
            print(f"Is Correct: {'✓' if result['is_correct'] else '✗'}")
            print(f"CBM Score: {result['cbm_score']}")
        
        print("\n✅ Test completed successfully!")

if __name__ == "__main__":
    main()
