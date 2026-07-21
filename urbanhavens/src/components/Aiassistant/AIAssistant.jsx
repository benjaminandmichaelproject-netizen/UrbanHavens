import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPaperPlane,
  FaMicrophone,
  FaTimes,
  FaRobot,
  FaHome,
  FaMapMarkerAlt,
  FaBed,
  FaPhone,
  FaEnvelope,
  FaArrowRight,
  FaSpinner,
  FaComments,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { api } from "../../Dashboard/Owner/UploadDetails/api/api";
import "./AIAssistant.css";

// Creates a lightweight unique ID for chat messages.
const genId = () => Math.random().toString(36).slice(2);

const SUGGESTIONS = [
  "Find me a cheap 2-bedroom in East Legon",
  "Student hostels near UPSA",
  "Self-contained under 1500 GHS in Madina",
  "Luxury apartment in Cantonments",
];

// Displays one property returned by the assistant.
const PropertyCard = ({ property, onView }) => (
  <motion.div
    className="ai-prop-card"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
  >
    {property.thumbnail && (
      <div className="ai-prop-img-wrap">
        <img
          src={property.thumbnail}
          alt={property.property_name}
          className="ai-prop-img"
        />

        <span className="ai-prop-badge">
          {property.category === "hostel" ? "Hostel" : "House for Rent"}
        </span>
      </div>
    )}

    <div className="ai-prop-body">
      <p className="ai-prop-name">{property.property_name}</p>

      <p className="ai-prop-loc">
        <FaMapMarkerAlt />
        {[property.city, property.region].filter(Boolean).join(", ")}
      </p>

      <div className="ai-prop-specs">
        {property.bedrooms != null && (
          <span>
            <FaBed />
            {property.bedrooms} bed
            {property.bedrooms !== 1 ? "s" : ""}
          </span>
        )}

        {property.school && (
          <span>
            <FaHome />
            Near {property.school}
          </span>
        )}
      </div>

      <div className="ai-prop-footer">
        <span className="ai-prop-price">
          GHS {Number(property.price).toLocaleString()}
          <small>/mo</small>
        </span>

        <button
          type="button"
          className="ai-prop-btn"
          onClick={() => onView(property.id)}
        >
          View <FaArrowRight />
        </button>
      </div>

      {(property.owner_name ||
        property.owner_phone ||
        property.owner_email) && (
        <div className="ai-prop-landlord">
          <span className="ai-prop-landlord-label">Landlord</span>

          <div className="ai-prop-landlord-info">
            {property.owner_name && (
              <span>
                <FaHome />
                {property.owner_name}
              </span>
            )}

            {property.owner_phone && (
              <a href={`tel:${property.owner_phone}`}>
                <FaPhone />
                {property.owner_phone}
              </a>
            )}

            {property.owner_email && (
              <a href={`mailto:${property.owner_email}`}>
                <FaEnvelope />
                {property.owner_email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  </motion.div>
);

// Displays one user or assistant chat message.
const MessageBubble = ({ msg, onView }) => {
  const isUser = msg.role === "user";

  return (
    <motion.div
      className={`ai-msg-row ${
        isUser ? "ai-msg-row--user" : "ai-msg-row--ai"
      }`}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {!isUser && (
        <div className="ai-avatar">
          <FaRobot />
        </div>
      )}

      <div
        className={`ai-bubble ${
          isUser ? "ai-bubble--user" : "ai-bubble--ai"
        }`}
      >
        {msg.text && <p className="ai-bubble-text">{msg.text}</p>}

        {msg.properties?.length > 0 && (
          <div className="ai-prop-grid">
            {msg.properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onView={onView}
              />
            ))}
          </div>
        )}

        {msg.noResults && (
          <p className="ai-no-results">
            No exact matches found. Try adjusting your filters or ask me
            to search nearby areas.
          </p>
        )}

        <span className="ai-bubble-time">
          {new Date(msg.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </motion.div>
  );
};

// Shows animated typing dots while waiting for the backend.
const TypingDots = () => (
  <div className="ai-msg-row ai-msg-row--ai">
    <div className="ai-avatar">
      <FaRobot />
    </div>

    <div className="ai-bubble ai-bubble--ai ai-bubble--typing">
      <span />
      <span />
      <span />
    </div>
  </div>
);

// Main UrbanHavens AI assistant panel.
const AIAssistant = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);

  // Keeps the latest message visible.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Focuses the input and adds the welcome message when opened.
  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    if (messages.length === 0) {
      setMessages([
        {
          id: genId(),
          role: "assistant",
          text:
            "Hi! I'm your UrbanHavens AI assistant. Tell me what kind of property you're looking for and I'll find the best options for you.",
          ts: Date.now(),
        },
      ]);
    }

    return () => clearTimeout(focusTimer);
  }, [isOpen, messages.length]);

  // Sends a message through the shared production-ready API client.
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();

      if (!trimmed || typing) return;

      const userMessage = {
        id: genId(),
        role: "user",
        text: trimmed,
        ts: Date.now(),
      };

      setMessages((previous) => [...previous, userMessage]);
      setInput("");
      setTyping(true);

      try {
        const response = await api.post("/assistant/chat/", {
          message: trimmed,
          session_id: sessionId,
        });

        const responseData = response.data || {};
        const {
          reply,
          properties = [],
          session_id: returnedSessionId,
          action,
        } = responseData;

        if (returnedSessionId) {
          setSessionId(returnedSessionId);
        }

        const assistantMessage = {
          id: genId(),
          role: "assistant",
          text:
            reply ||
            "I could not generate a response right now. Please try again.",
          properties: Array.isArray(properties) ? properties : [],
          noResults:
            Array.isArray(properties) &&
            properties.length === 0 &&
            action?.action === "search_property",
          ts: Date.now(),
        };

        setMessages((previous) => [...previous, assistantMessage]);
      } catch (error) {
        console.error("AI assistant request failed:", error);

        let safeMessage =
          "Sorry, I could not process your request right now. Please try again shortly.";

        if (!error.response) {
          safeMessage =
            "The assistant is temporarily unavailable. Please check your internet connection and try again.";
        } else if (error.response.status === 401) {
          safeMessage =
            "Your session has expired. Please log in again to continue using the assistant.";
        } else if (error.response.status === 403) {
          safeMessage =
            "You do not have permission to use the assistant right now.";
        } else if (error.response.status === 429) {
          safeMessage =
            "The assistant is receiving too many requests right now. Please wait a moment and try again.";
        } else if (error.response.status >= 500) {
          safeMessage =
            "The assistant is temporarily unavailable. Please try again in a few moments.";
        }

        setMessages((previous) => [
          ...previous,
          {
            id: genId(),
            role: "assistant",
            text: safeMessage,
            ts: Date.now(),
          },
        ]);
      } finally {
        setTyping(false);
      }
    },
    [sessionId, typing]
  );

  // Sends the message when Enter is pressed.
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  // Starts or stops browser voice recognition.
  const toggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in your browser.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-GH";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // Opens the selected property details page.
  const handleViewProperty = (id) => {
    navigate(`/detail/${id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="ai-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="ai-panel"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.96 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="ai-header">
            <div className="ai-header-left">
              <div className="ai-header-avatar">
                <FaRobot />
              </div>

              <div>
                <p className="ai-header-name">UrbanHavens AI</p>

                <p className="ai-header-status">
                  <span className="ai-status-dot" />
                  Online · Real estate assistant
                </p>
              </div>
            </div>

            <button
              type="button"
              className="ai-close-btn"
              onClick={onClose}
              aria-label="Close AI assistant"
            >
              <FaTimes />
            </button>
          </div>

          <div className="ai-messages">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                msg={message}
                onView={handleViewProperty}
              />
            ))}

            {typing && <TypingDots />}

            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && !typing && (
            <div className="ai-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  className="ai-suggestion-chip"
                  onClick={() => sendMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="ai-input-row">
            <button
              type="button"
              className={`ai-voice-btn ${
                listening ? "ai-voice-btn--active" : ""
              }`}
              onClick={toggleVoice}
              title={listening ? "Stop listening" : "Voice input"}
              aria-label={listening ? "Stop listening" : "Start voice input"}
            >
              <FaMicrophone />
            </button>

            <input
              ref={inputRef}
              className="ai-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about properties..."
              disabled={typing}
            />

            <button
              type="button"
              className="ai-send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              aria-label="Send message"
            >
              {typing ? (
                <FaSpinner className="ai-spin" />
              ) : (
                <FaPaperPlane />
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Floating button used to open the AI assistant.
export const AIAssistantButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        className="ai-fab"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <FaComments />
        <span className="ai-fab-label">AI Assistant</span>
      </motion.button>

      <AIAssistant
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default AIAssistant;