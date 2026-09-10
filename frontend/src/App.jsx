import { useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim()) {
      return;
    }

    const userMessage = {
      role: "user",
      content: message,
    };

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await response.json();

      const aiMessage = {
        role: "assistant",
        content: data,
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        aiMessage,
      ]);
    } catch (error) {
      console.error("Error:", error);

      const errorMessage = {
        role: "assistant",
        content: "Something went wrong. Please try again.",
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        errorMessage,
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
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <>
                    <h3>{msg.content.topic}</h3>

                    <p>
                      <strong>Difficulty:</strong>{" "}
                      {msg.content.difficulty}
                    </p>

                    <p>{msg.content.explanation}</p>

                    <strong>Key Points:</strong>

                    <ul>
                      {msg.content.key_points.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-role">AI</div>
              <div className="message-content typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

        </main>

        <div className="input-area">

          <textarea
            placeholder="Ask something..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            rows="1"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
          >
            Send
          </button>

        </div>

      </div>

    </div>
  );
}

export default App;