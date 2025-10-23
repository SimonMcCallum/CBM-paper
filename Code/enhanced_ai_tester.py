import json
import os
import uuid
import asyncio
import aiohttp
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import statistics
from dataclasses import dataclass, asdict
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
    DEEPSEEK_API_KEY,
    OPENAI_ENDPOINT,
    CLAUDE_ENDPOINT,
    GEMINI_ENDPOINT,
    DEEPSEEK_ENDPOINT
)
from anthropic import Anthropic

@dataclass
class ConfidenceResponse:
    answer: str
    confidence_level: float  # 0.0 to 1.0
    confidence_reasoning: str
    selected_option: str
    cbm_score: float  # Calculated CBM score based on confidence and correctness

@dataclass
class TestResult:
    question_id: str
    vendor: str
    model: str
    temperature: float
    iteration: int
    response: ConfidenceResponse
    correct_answer: str
    is_correct: bool
    timestamp: str
    processing_time: float

class EnhancedAITester:
    def __init__(self):
        self.anthropic = Anthropic(api_key=CLAUDE_API_KEY) if CLAUDE_API_KEY else None
        self.session = None
        self.results: List[TestResult] = []
        
        # CBM scoring matrix: [confidence_level][correctness] = score
        self.cbm_matrix = {
            1.0: {"correct": 2.0, "incorrect": -2.0},  # Very confident
            0.8: {"correct": 1.5, "incorrect": -1.5},  # Confident
            0.6: {"correct": 1.0, "incorrect": -1.0},  # Somewhat confident
            0.4: {"correct": 0.5, "incorrect": -0.5},  # Uncertain
            0.2: {"correct": 0.0, "incorrect": 0.0},   # Very uncertain
        }

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def apply_config(self, config: Dict):
        """Apply configuration settings to override defaults"""
        self.config = config
        print(f"Applied configuration: {config['selected_vendors']} vendors, {config['temperatures']} temperatures, {config['num_repetitions']} repetitions")

    def load_questions(self) -> List[Dict]:
        """Load questions from the JSON file"""
        try:
            with open(QUESTION_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Handle both old and new format
            if "eval_data" in data:
                return data["eval_data"]
            elif "questions" in data:
                return data["questions"]
            else:
                return data
        except Exception as e:
            print(f"Error loading questions: {e}")
            return []

    def load_models(self) -> Dict:
        """Load model configurations"""
        try:
            with open(MODEL_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading models: {e}")
            return {}

    def calculate_cbm_score(self, confidence: float, is_correct: bool) -> float:
        """Calculate CBM score based on confidence and correctness"""
        # Find closest confidence level in matrix
        closest_level = min(self.cbm_matrix.keys(), key=lambda x: abs(x - confidence))
        correctness_key = "correct" if is_correct else "incorrect"
        return self.cbm_matrix[closest_level][correctness_key]

    def create_confidence_prompt(self, question: Dict) -> str:
        """Create a prompt that asks for both answer and confidence"""
        options_text = "\n".join([f"{opt['key']}) {opt['text']}" for opt in question.get('options', [])])
        
        prompt = f"""
Please answer the following multiple choice question and provide your confidence level.

Question: {question['question']}

Options:
{options_text}

Please respond in the following JSON format:
{{
    "selected_option": "a",
    "answer_text": "Your explanation of why you chose this option",
    "confidence_level": 0.85,
    "confidence_reasoning": "Explain why you have this level of confidence"
}}

Where:
- selected_option: The letter of your chosen answer (a, b, c, d, or e)
- answer_text: Brief explanation of your reasoning
- confidence_level: A number between 0.0 (no confidence) and 1.0 (completely confident)
- confidence_reasoning: Explanation of your confidence level
"""
        return prompt

    async def send_to_openai(self, prompt: str, model: str, temperature: float) -> Optional[ConfidenceResponse]:
        """Send request to OpenAI API"""
        if not OPENAI_API_KEY or not self.session:
            return None
            
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        
        try:
            async with self.session.post(OPENAI_ENDPOINT, headers=headers, json=payload) as resp:
                resp.raise_for_status()
                data = await resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                return self.parse_confidence_response(content)
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            return None

    async def send_to_claude(self, prompt: str, model: str, temperature: float) -> Optional[ConfidenceResponse]:
        """Send request to Claude API"""
        if not self.anthropic:
            return None
            
        try:
            message = self.anthropic.messages.create(
                model=model,
                max_tokens=500,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            content = message.content[0].text if message.content else ""
            return self.parse_confidence_response(content)
        except Exception as e:
            print(f"Error calling Claude API: {e}")
            return None

    async def send_to_gemini(self, prompt: str, model: str, temperature: float) -> Optional[ConfidenceResponse]:
        """Send request to Gemini API"""
        if not GEMINI_API_KEY or not self.session:
            return None
            
        headers = {
            "Authorization": f"Bearer {GEMINI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        
        try:
            async with self.session.post(GEMINI_ENDPOINT, headers=headers, json=payload) as resp:
                resp.raise_for_status()
                data = await resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                return self.parse_confidence_response(content)
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return None

    async def send_to_deepseek(self, prompt: str, model: str, temperature: float) -> Optional[ConfidenceResponse]:
        """Send request to DeepSeek API"""
        if not DEEPSEEK_API_KEY or not self.session:
            return None
            
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        
        try:
            async with self.session.post(DEEPSEEK_ENDPOINT, headers=headers, json=payload) as resp:
                resp.raise_for_status()
                data = await resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                return self.parse_confidence_response(content)
        except Exception as e:
            print(f"Error calling DeepSeek API: {e}")
            return None

    def parse_confidence_response(self, content: str) -> ConfidenceResponse:
        """Parse the AI response to extract confidence information"""
        try:
            # Try to parse as JSON first
            if content.strip().startswith('{'):
                data = json.loads(content)
                return ConfidenceResponse(
                    answer=data.get('answer_text', ''),
                    confidence_level=float(data.get('confidence_level', 0.5)),
                    confidence_reasoning=data.get('confidence_reasoning', ''),
                    selected_option=data.get('selected_option', ''),
                    cbm_score=0.0  # Will be calculated later
                )
        except:
            pass
        
        # Fallback: try to extract information from text
        lines = content.split('\n')
        selected_option = ''
        confidence_level = 0.5
        
        # Look for option selection patterns
        for line in lines:
            line = line.strip().lower()
            if any(f"answer: {opt}" in line or f"option {opt}" in line or f"choose {opt}" in line 
                   for opt in ['a', 'b', 'c', 'd', 'e']):
                for opt in ['a', 'b', 'c', 'd', 'e']:
                    if opt in line:
                        selected_option = opt
                        break
            
            # Look for confidence indicators
            if 'confidence' in line:
                import re
                numbers = re.findall(r'0?\.\d+|\d+', line)
                if numbers:
                    conf = float(numbers[0])
                    confidence_level = conf if conf <= 1.0 else conf / 100.0
        
        return ConfidenceResponse(
            answer=content,
            confidence_level=confidence_level,
            confidence_reasoning="Extracted from text response",
            selected_option=selected_option,
            cbm_score=0.0
        )

    async def test_model(self, question: Dict, vendor: str, model: str, temperature: float, iteration: int) -> Optional[TestResult]:
        """Test a single model with a question"""
        start_time = datetime.now()
        prompt = self.create_confidence_prompt(question)
        
        # Route to appropriate API
        if vendor == "OpenAI":
            response = await self.send_to_openai(prompt, model, temperature)
        elif vendor == "Claude":
            response = await self.send_to_claude(prompt, model, temperature)
        elif vendor == "Gemini":
            response = await self.send_to_gemini(prompt, model, temperature)
        elif vendor == "DeepSeek":
            response = await self.send_to_deepseek(prompt, model, temperature)
        else:
            return None
        
        if not response:
            return None
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Determine correctness
        correct_answer = question.get('correctAnswer', question.get('correct_answer', ''))
        is_correct = response.selected_option.lower() == correct_answer.lower()
        
        # Calculate CBM score
        response.cbm_score = self.calculate_cbm_score(response.confidence_level, is_correct)
        
        return TestResult(
            question_id=str(question.get('id', question.get('question_id', ''))),
            vendor=vendor,
            model=model,
            temperature=temperature,
            iteration=iteration,
            response=response,
            correct_answer=correct_answer,
            is_correct=is_correct,
            timestamp=start_time.isoformat(),
            processing_time=processing_time
        )

    async def run_comprehensive_test(self) -> Dict:
        """Run comprehensive testing across all models and questions"""
        questions = self.load_questions()
        models = self.load_models()
        
        if not questions:
            print("No questions loaded!")
            return {}
        
        # Use configuration if available, otherwise use defaults
        if hasattr(self, 'config'):
            selected_vendors = self.config['selected_vendors']
            temperatures = self.config['temperatures']
            num_repetitions = self.config['num_repetitions']
        else:
            # Filter available models by API keys
            api_keys = {
                "OpenAI": OPENAI_API_KEY,
                "Claude": CLAUDE_API_KEY,
                "Gemini": GEMINI_API_KEY,
                "DeepSeek": DEEPSEEK_API_KEY,
            }
            selected_vendors = [vendor for vendor in models.keys() if api_keys.get(vendor)]
            temperatures = TEMPERATURES
            num_repetitions = NUM_REPETITIONS
        
        # Filter models to only selected vendors
        available_models = {
            vendor: data for vendor, data in models.items()
            if vendor in selected_vendors
        }
        
        print(f"Testing {len(questions)} questions across {len(available_models)} vendors")
        print(f"Vendors: {list(available_models.keys())}")
        print(f"Temperatures: {temperatures}")
        print(f"Repetitions: {num_repetitions}")
        
        tasks = []
        for question in questions:
            for vendor, vendor_data in available_models.items():
                for model_name in vendor_data["models"]:
                    for temp in temperatures:
                        for i in range(num_repetitions):
                            task = self.test_model(question, vendor, model_name, temp, i + 1)
                            tasks.append(task)
        
        print(f"Total tasks to execute: {len(tasks)}")
        
        # Run all tests concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out None results and exceptions
        self.results = [r for r in results if isinstance(r, TestResult)]
        
        print(f"Completed {len(self.results)} tests")
        
        # Save results
        self.save_results()
        
        # Generate summary
        return self.generate_summary()

    def save_results(self):
        """Save detailed results to files"""
        # Save raw results
        results_data = [asdict(result) for result in self.results]
        
        os.makedirs(os.path.dirname(ANSWERS_FILE), exist_ok=True)
        with open(ANSWERS_FILE, "w", encoding="utf-8") as f:
            json.dump(results_data, f, indent=2)
        
        # Save interaction log
        os.makedirs(os.path.dirname(INTERACTION_LOG), exist_ok=True)
        with open(INTERACTION_LOG, "w", encoding="utf-8") as f:
            json.dump(results_data, f, indent=2)
        
        print(f"Results saved to {ANSWERS_FILE}")

    def generate_summary(self) -> Dict:
        """Generate comprehensive summary statistics"""
        if not self.results:
            return {}
        
        summary = {
            "total_tests": len(self.results),
            "timestamp": datetime.now().isoformat(),
            "by_vendor": {},
            "by_model": {},
            "by_temperature": {},
            "by_question": {},
            "overall_stats": {}
        }
        
        # Group results
        vendor_results = {}
        model_results = {}
        temp_results = {}
        question_results = {}
        
        for result in self.results:
            # By vendor
            if result.vendor not in vendor_results:
                vendor_results[result.vendor] = []
            vendor_results[result.vendor].append(result)
            
            # By model
            model_key = f"{result.vendor}_{result.model}"
            if model_key not in model_results:
                model_results[model_key] = []
            model_results[model_key].append(result)
            
            # By temperature
            if result.temperature not in temp_results:
                temp_results[result.temperature] = []
            temp_results[result.temperature].append(result)
            
            # By question
            if result.question_id not in question_results:
                question_results[result.question_id] = []
            question_results[result.question_id].append(result)
        
        # Calculate statistics for each group
        def calc_stats(results_list):
            if not results_list:
                return {}
            
            accuracy = sum(1 for r in results_list if r.is_correct) / len(results_list)
            avg_confidence = statistics.mean(r.response.confidence_level for r in results_list)
            avg_cbm_score = statistics.mean(r.response.cbm_score for r in results_list)
            avg_processing_time = statistics.mean(r.processing_time for r in results_list)
            
            return {
                "total_tests": len(results_list),
                "accuracy": accuracy,
                "avg_confidence": avg_confidence,
                "avg_cbm_score": avg_cbm_score,
                "avg_processing_time": avg_processing_time,
                "correct_answers": sum(1 for r in results_list if r.is_correct),
                "incorrect_answers": sum(1 for r in results_list if not r.is_correct)
            }
        
        # Populate summary
        for vendor, results_list in vendor_results.items():
            summary["by_vendor"][vendor] = calc_stats(results_list)
        
        for model_key, results_list in model_results.items():
            summary["by_model"][model_key] = calc_stats(results_list)
        
        for temp, results_list in temp_results.items():
            summary["by_temperature"][str(temp)] = calc_stats(results_list)
        
        for question_id, results_list in question_results.items():
            summary["by_question"][question_id] = calc_stats(results_list)
        
        summary["overall_stats"] = calc_stats(self.results)
        
        # Save summary
        summary_file = "results/test_summary.json"
        os.makedirs(os.path.dirname(summary_file), exist_ok=True)
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        
        return summary

async def main():
    """Main function to run the enhanced AI testing"""
    import sys
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Enhanced AI Testing with CBM')
    parser.add_argument('--config', help='Path to configuration file')
    args = parser.parse_args()
    
    # Load configuration if provided
    test_config = None
    if args.config:
        try:
            with open(args.config, 'r') as f:
                test_config = json.load(f)
            print(f"Loaded configuration from {args.config}")
        except Exception as e:
            print(f"Error loading configuration: {e}")
            return
    
    async with EnhancedAITester() as tester:
        # Apply configuration if available
        if test_config:
            tester.apply_config(test_config)
        
        summary = await tester.run_comprehensive_test()
        
        print("\n=== Test Summary ===")
        print(f"Total tests: {summary.get('total_tests', 0)}")
        print(f"Overall accuracy: {summary.get('overall_stats', {}).get('accuracy', 0):.2%}")
        print(f"Average confidence: {summary.get('overall_stats', {}).get('avg_confidence', 0):.2f}")
        print(f"Average CBM score: {summary.get('overall_stats', {}).get('avg_cbm_score', 0):.2f}")
        
        print("\n=== By Vendor ===")
        for vendor, stats in summary.get('by_vendor', {}).items():
            print(f"{vendor}: {stats['accuracy']:.2%} accuracy, {stats['avg_cbm_score']:.2f} CBM score")

if __name__ == "__main__":
    asyncio.run(main())
