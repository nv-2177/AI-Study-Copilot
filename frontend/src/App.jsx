import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!message.trim() || loading) {
      return;
    }

    const currentMessage = message;

    const userMessage = {
      role: "user",
      content: currentMessage,
    };

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/chat/stream",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: currentMessage,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: "",
        },
      ]);

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, {
          stream: true,
        });

        assistantText += chunk;

        setMessages((previousMessages) => {
          const updatedMessages = [...previousMessages];

          updatedMessages[updatedMessages.length - 1] = {
            role: "assistant",
            content: assistantText,
          };

          return updatedMessages;
        });
      }

    } catch (error) {
        console.error("Error:", error);

        setMessages((previousMessages) => [
          ...previousMessages,
          {
            role: "assistant",
            content:
              "I couldn't connect to the AI service. Please check that the backend is running and try again.",
          },
        ]);
      }

    setLoading(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  async function clearConversation() {
  const confirmed = window.confirm(
    "Are you sure you want to clear this conversation?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await fetch("http://127.0.0.1:8000/chat", {
      method: "DELETE",
    });

    setMessages([]);
  } catch (error) {
    console.error("Error clearing conversation:", error);
  }
}

  return (
    <div className="app">

      <div className="chat-container">

        <header className="header">
          <div>
            <h1>AI Study Copilot</h1>
            <p>Your AI learning assistant</p>
          </div>

          <button
            className="clear-button"
            onClick={clearConversation}
            disabled={messages.length === 0}
          >
            Clear Chat
          </button>
        </header>

        <main className="messages">

          {messages.length === 0 && (
            <div className="welcome">
              <h2>What do you want to learn?</h2>
              <p>
                Ask me anything about programming, AI,
                mathematics, science, or other subjects.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role}`}
            >
              <div className="message-role">
                {msg.role === "user" ? "You" : "AI"}
              </div>

              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <div className="input-area">

          <textarea
            placeholder="Ask something..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            rows="1"
            disabled={loading}
          />

          <button
            onClick={sendMessage}
            disabled={loading || !message.trim()}
          >
            {loading ? "Thinking..." : "Send"}
          </button>

        </div>

      </div>

    </div>
  );
}

export default App;