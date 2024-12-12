# import anthropic
import os
import pandas as pd
from anthropic import Anthropic
from datetime import datetime


client = Anthropic(
    api_key= os.environ.get("ANTHROPIC_API_KEY_CBM"),
)



class MultichoiceQuestion:
    def __init__(self, api_key):
        self.anthropic = Anthropic(api_key=api_key)
        self.system_instruction = ""
        
        self.context_history = []
        self.output_dir = "answers"
        
        # Create output directory if it doesn't exist
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def create_prompt(self, data, topic):
        """Create prompt combining system instruction, context, and data"""
        context = "\n\n".join(self.context_history)
        
        prompt = f"""Previous context (if any): {context}
        Data for analysis: {data.to_string()}"""

        return prompt

    def generate_document(self, prompt):
        """Generate document using Claude API"""
        try:
            message = self.anthropic.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=4000,
                temperature=0.7,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return message.content
            
        except Exception as e:
            print(f"Error calling Claude API: {e}")
            return None

    def save_document(self, content, topic):
        """Save generated content as MD file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.output_dir}/{topic.replace(' ', '_')}_{timestamp}.md"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Document saved: {filename}")
            
            # Add to context history
            self.context_history.append(f"Previous document: {content}")
            
            return filename
        except Exception as e:
            print(f"Error saving document: {e}")
            return None

    def generate_policy_document(self, excel_path, topic, sheet_name=0):
        """Main method to generate policy document"""
        # Load data
        data = self.load_data_from_excel(excel_path, sheet_name)
        if data is None:
            return None

        # Create prompt
        prompt = self.create_prompt(data, topic)

        # Generate content
        content = self.generate_document(prompt)
        if content is None:
            return None

        # Save document
        return self.save_document(content, topic)

def main():
    # Load data from Excel file
    excel_path = "data/policy_data.xlsx"
    topic = "Data Privacy Policy"
    sheet_name = 0

    # Initialize MultichoiceQuestion object
    mcq = MultichoiceQuestion(api_key=os.environ.get("ANTHROPIC_API_KEY_CBM"))

    # Generate policy document
    mcq.generate_policy_document(excel_path, topic, sheet_name)


if __name__ == "__main__":
    main()
