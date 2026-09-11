import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
 const [conversationId, setConversationId] = useState(() => {
  const savedId = localStorage.getItem("conversationId");

  return savedId ? Number(savedId) : null;
});
const [conversations, setConversations] = useState([]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!message.trim() || loading || !conversationId) {
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
            conversation_id: conversationId,
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
      await loadConversations();

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
  async function createConversation() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/conversations",
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create conversation");
    }

    const data = await response.json();

    setConversationId(data.id);
    localStorage.setItem("conversationId", data.id);
  } catch (error) {
    console.error("Error creating conversation:", error);
  }
}
useEffect(() => {
  async function initializeConversation() {
    await loadConversations();
    const savedId = localStorage.getItem("conversationId");

    if (savedId) {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/conversations/${savedId}`
        );

        if (response.ok) {
          const data = await response.json();

          setConversationId(data.id);
          setMessages(data.messages);

          return;
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
      }
    }

    await createConversation();
    await loadConversations();
  }

  initializeConversation();
}, []);
async function deleteConversation(id) {
  const confirmed = window.confirm(
    "Delete this conversation?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/conversations/${id}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }

    setConversations((previousConversations) =>
      previousConversations.filter(
        (conversation) => conversation.id !== id
      )
    );

    if (id === conversationId) {
      localStorage.removeItem("conversationId");

      setConversationId(null);
      setMessages([]);

      await createConversation();
      await loadConversations();
    }

  } catch (error) {
    console.error("Error deleting conversation:", error);
  }
}
async function createNewChat() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/conversations",
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create conversation");
    }

    const data = await response.json();

    setConversationId(data.id);
    setMessages([]);

    localStorage.setItem("conversationId", data.id);

    await loadConversations();
  } catch (error) {
    console.error("Error creating new chat:", error);
  }
}
  async function switchConversation(id) {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/conversations/${id}`
    );

    if (!response.ok) {
      throw new Error("Failed to load conversation");
    }

    const data = await response.json();

    setConversationId(data.id);
    setMessages(data.messages);

    localStorage.setItem("conversationId", data.id);
  } catch (error) {
    console.error("Error switching conversation:", error);
  }
}
  async function loadConversations() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/conversations"
    );

    if (!response.ok) {
      throw new Error("Failed to load conversations");
    }

    const data = await response.json();

    setConversations(data);
  } catch (error) {
    console.error("Error loading conversations:", error);
  }
}
  async function clearConversation() {
  const confirmed = window.confirm(
    "Are you sure you want to clear this conversation?"
  );

  if (!confirmed || !conversationId) {
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/conversations/${conversationId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }

    localStorage.removeItem("conversationId");

    setConversationId(null);
    setMessages([]);

    await createConversation();

  } catch (error) {
    console.error("Error clearing conversation:", error);
  }
}

  return (
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Conversations</h2>

            <button onClick={createNewChat}>
              + New Chat
            </button>
          </div>

          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={
                  conversation.id === conversationId
                    ? "conversation-item active"
                    : "conversation-item"
                }
              >
                <button
                  className="conversation-title"
                  onClick={() => switchConversation(conversation.id)}
                >
                  {conversation.title}
                </button>

                <button
                  className="delete-conversation"
                  onClick={() => deleteConversation(conversation.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className="chat-container">

          {/* YOUR EXISTING HEADER */}
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

          {/* YOUR EXISTING MESSAGES */}
          <div className="messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${msg.role}`}
              >
                <div className="message-content">
                  {msg.content}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* YOUR EXISTING INPUT */}
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

        </main>

      </div>
    );
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
}

export default App;