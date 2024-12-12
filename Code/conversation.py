class Conversation:
    def __init__(self):
        # The conversation history is stored as a list of messages.
        # Each message is a dict with a "role" and "content".
        # Roles can be "system", "user", or "assistant".
        self.messages = []

    def add_system_message(self, content: str):
        """Add a system message to the conversation."""
        self.messages.append({"role": "system", "content": content})

    def add_user_message(self, content: str):
        """Add a user message to the conversation."""
        self.messages.append({"role": "user", "content": content})

    def add_assistant_message(self, content: str):
        """Add an assistant (model) message to the conversation."""
        self.messages.append({"role": "assistant", "content": content})

    def get_conversation(self):
        """Retrieve the entire conversation history as a list of messages."""
        return self.messages

    def clear(self):
        """Clear all messages from the conversation."""
        self.messages = []
