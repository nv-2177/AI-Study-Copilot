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

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [uploading, setUploading] = useState(false);

  // --------------------------------------------------
  // AUTO SCROLL
  // --------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // --------------------------------------------------
  // LOAD CONVERSATIONS
  // --------------------------------------------------

  async function loadConversations() {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/conversations"
      );

      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }

      const data = await response.json();

      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  }

  // --------------------------------------------------
  // LOAD DOCUMENTS
  // --------------------------------------------------

  async function loadDocuments() {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/documents"
      );

      if (!response.ok) {
        throw new Error("Failed to load documents");
      }

      const data = await response.json();

      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  }

  // --------------------------------------------------
  // CREATE CONVERSATION
  // --------------------------------------------------

async function createConversation() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/conversations",
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to create conversation: ${response.status}`
      );
    }

    const data = await response.json();

    console.log("Created conversation:", data);

    setConversationId(data.id);

    localStorage.setItem(
      "conversationId",
      String(data.id)
    );

    return data.id;
  } catch (error) {
    console.error(
      "Error creating conversation:",
      error
    );

    return null;
  }
}

  // --------------------------------------------------
  // INITIALIZE APP
  // --------------------------------------------------

useEffect(() => {
  async function initializeApp() {
    try {
      await Promise.all([
        loadConversations(),
        loadDocuments(),
      ]);

      const savedId =
        localStorage.getItem("conversationId");

      if (savedId) {
        const id = Number(savedId);

        const response = await fetch(
          `http://127.0.0.1:8000/conversations/${id}`
        );

        if (response.ok) {
          const data = await response.json();

          setConversationId(data.id);
          setMessages(data.messages || []);

          console.log(
            "Loaded conversation:",
            data.id
          );

          return;
        }

        localStorage.removeItem(
          "conversationId"
        );
      }

      const newId =
        await createConversation();

      if (newId) {
        setConversationId(newId);
        setMessages([]);

        await loadConversations();
      }
    } catch (error) {
      console.error(
        "Application initialization failed:",
        error
      );
    }
  }

  initializeApp();
}, []);
  // --------------------------------------------------
  // CREATE NEW CHAT
  // --------------------------------------------------

  async function createNewChat() {
    const newConversationId =
      await createConversation();

    if (newConversationId) {
      setMessages([]);
      setSelectedDocumentId(null);

      await loadConversations();
    }
  }

  // --------------------------------------------------
  // SWITCH CONVERSATION
  // --------------------------------------------------

  async function switchConversation(id) {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/conversations/${id}`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load conversation"
        );
      }

      const data = await response.json();

      setConversationId(data.id);
      setMessages(data.messages || []);

      localStorage.setItem(
        "conversationId",
        data.id
      );
    } catch (error) {
      console.error(
        "Error switching conversation:",
        error
      );
    }
  }

  // --------------------------------------------------
  // DELETE CONVERSATION
  // --------------------------------------------------

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
        throw new Error(
          "Failed to delete conversation"
        );
      }

      setConversations(
        (previousConversations) =>
          previousConversations.filter(
            (conversation) =>
              conversation.id !== id
          )
      );

      if (id === conversationId) {
        localStorage.removeItem(
          "conversationId"
        );

        setConversationId(null);
        setMessages([]);

        const newConversationId =
          await createConversation();

        if (newConversationId) {
          await loadConversations();
        }
      }
    } catch (error) {
      console.error(
        "Error deleting conversation:",
        error
      );
    }
  }

  // --------------------------------------------------
  // CLEAR CURRENT CHAT
  // --------------------------------------------------

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
        throw new Error(
          "Failed to delete conversation"
        );
      }

      localStorage.removeItem(
        "conversationId"
      );

      setConversationId(null);
      setMessages([]);

      const newConversationId =
        await createConversation();

      if (newConversationId) {
        await loadConversations();
      }
    } catch (error) {
      console.error(
        "Error clearing conversation:",
        error
      );
    }
  }

  // --------------------------------------------------
  // UPLOAD DOCUMENT
  // --------------------------------------------------

  async function uploadDocument(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      alert("Only PDF files are supported.");

      event.target.value = "";

      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    setUploading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/documents/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to upload document"
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      await loadDocuments();

      setSelectedDocumentId(data.id);
    } catch (error) {
      console.error(
        "Error uploading document:",
        error
      );

      alert(
        "Failed to upload document. Check the backend."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  //-------------------------------------------------
  // DELETE DOCUMENT
  //-------------------------------------------------
  async function deleteDocument(id) {
    const confirmed = window.confirm(
      "Delete this document?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/documents/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setDocuments((previousDocuments) =>
        previousDocuments.filter(
          (document) => document.id !== id
        )
      );

      if (selectedDocumentId === id) {
        setSelectedDocumentId(null);
      }

    } catch (error) {
      console.error("Error deleting document:", error);

      alert("Failed to delete document.");
    }
  }

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------

  async function sendMessage() {
    if (!message.trim() || loading) {
      return;
    }

    if (!conversationId) {
      console.error(
        "No conversation selected."
      );

      return;
    }

    const currentMessage = message;

    const userMessage = {
      role: "user",
      content: currentMessage,
    };

    setMessages(
      (previousMessages) => [
        ...previousMessages,
        userMessage,
      ]
    );

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
            document_id: selectedDocumentId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error(
          "No response body received"
        );
      }

      const reader =
        response.body.getReader();

      const decoder = new TextDecoder();

      let assistantText = "";

      setMessages(
        (previousMessages) => [
          ...previousMessages,
          {
            role: "assistant",
            content: "",
          },
        ]
      );

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(
          value,
          {
            stream: true,
          }
        );

        assistantText += chunk;

        setMessages(
          (previousMessages) => {
            const updatedMessages = [
              ...previousMessages,
            ];

            updatedMessages[
              updatedMessages.length - 1
            ] = {
              role: "assistant",
              content: assistantText,
            };

            return updatedMessages;
          }
        );
      }

      await loadConversations();
    } catch (error) {
      console.error(
        "Error sending message:",
        error
      );

      setMessages(
        (previousMessages) => [
          ...previousMessages,
          {
            role: "assistant",
            content:
              "I couldn't connect to the AI service. Please check that the backend is running and try again.",
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // KEYBOARD HANDLER
  // --------------------------------------------------

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="sidebar-header">

          <h2>Conversations</h2>

          <button
            onClick={createNewChat}
          >
            + New Chat
          </button>

        </div>

        <div className="conversation-list">

          {conversations.map(
            (conversation) => (
              <div
                key={conversation.id}
                className={
                  conversation.id ===
                  conversationId
                    ? "conversation-item active"
                    : "conversation-item"
                }
              >

                <button
                  className="conversation-title"
                  onClick={() =>
                    switchConversation(
                      conversation.id
                    )
                  }
                >
                  {conversation.title}
                </button>

                <button
                  className="delete-conversation"
                  onClick={() =>
                    deleteConversation(
                      conversation.id
                    )
                  }
                >
                  ×
                </button>

              </div>
            )
          )}

        </div>

      </aside>

      {/* MAIN CHAT */}

      <main className="chat-container">

        {/* HEADER */}

        <header className="header">

          <div>
            <h1>
              AI Study Copilot
            </h1>

            <p>
              Your AI learning assistant
            </p>
          </div>

          <button
            className="clear-button"
            onClick={
              clearConversation
            }
            disabled={
              messages.length === 0
            }
          >
            Clear Chat
          </button>

        </header>

        {/* DOCUMENT BAR */}

        <div className="document-bar">

          <label className="upload-button">

            {uploading
              ? "Uploading..."
              : "Upload PDF"}

            <input
              type="file"
              accept=".pdf"
              onChange={
                uploadDocument
              }
              disabled={uploading}
              hidden
            />

          </label>

          <select
            value={
              selectedDocumentId ?? ""
            }
            onChange={(event) => {

              const value =
                event.target.value;

              setSelectedDocumentId(
                value
                  ? Number(value)
                  : null
              );

            }}
          >

            <option value="">
              No document selected
            </option>

            {documents.map(
              (document) => (
                <option
                  key={document.id}
                  value={document.id}
                >
                  {document.filename}
                </option>
              )
            )}

          </select>

        </div>

        {/* MESSAGES */}

        <div className="messages">

          {messages.length === 0 && (
            <div className="welcome">

              <h2>
                What do you want to learn?
              </h2>

              <p>
                Ask me anything about
                programming, AI,
                mathematics, science,
                or other subjects.
              </p>

            </div>
          )}

          {messages.map(
            (msg, index) => (
              <div
                key={index}
                className={`message ${msg.role}`}
              >

                <div className="message-role">
                  {msg.role === "user"
                    ? "You"
                    : "AI"}
                </div>

                <div className="message-content">
                  {msg.content}
                </div>

              </div>
            )
          )}

          <div
            ref={messagesEndRef}
          />

        </div>

        {/* INPUT */}

        <div className="input-area">

          <textarea
            placeholder="Ask something..."
            value={message}
            onChange={(event) =>
              setMessage(
                event.target.value
              )
            }
            onKeyDown={
              handleKeyDown
            }
            rows="1"
            disabled={loading}
          />

          <button
            onClick={sendMessage}
            disabled={
              loading ||
              !message.trim() ||
              !conversationId
            }
          >
            {loading
              ? "Thinking..."
              : "Send"}
          </button>

        </div>

      </main>

    </div>
  );
}

export default App;

