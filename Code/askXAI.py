from openai import OpenAI
from os import getenv

client = OpenAI(
    # get the xai key from the envrionment
    api_key=getenv("XAI_API_KEY_CBM"),
  base_url="https://api.x.ai/v1",
)

completion = client.chat.completions.create(
  model="grok-4",
  messages=[
    {"role": "user", "content": "This MCQ system needs and answer from a-e and a confidence which changes the marking system options are 1. <correct +1.0, incorrect -0.0> ; 2. <+1.5, -0.5> and 3. <+2.0,-2.0.> Question: If there was another option inserted into the confidence level for this multi-choice section (current options are +1.0, -0.0 ; +1.5, -0.5 and +2.0,-2.0), which values would result in all four options remaining the best choice for at least some levels of confidence? (i.e which option would not just replace one of the current options) \nA. 1.0, -0.5 \nB. 1.3, -0.75 \nC. 1.8, -1.0 \nD. 2.0, -1.0 \nE. 3.0, -1.6 \n Provide the answer and a number of your confidence level. ie something like a,3 ?"}
  ]
)