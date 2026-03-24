import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPaperPlane, FaMicrophone, FaTimes, FaRobot,
  FaHome, FaMapMarkerAlt, FaBed, FaPhone, FaEnvelope,
  FaArrowRight, FaSpinner, FaComments,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
// Direct fetch used — no axios api import needed
import "./AIAssistant.css";

// ── Helpers ───────────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2);

const SUGGESTIONS = [
  "Find me a cheap 2-bedroom in East Legon",
  "Student hostels near UPSA",
  "Self-contained under 1500 GHS in Madina",
  "Luxury apartment in Cantonments",
];

// ── Property result card ──────────────────────────────────────────
const PropertyCard = ({ property, onView }) => (
  <motion.div
    className="ai-prop-card"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
  >
    {property.thumbnail && (
      <div className="ai-prop-img-wrap">
        <img src={property.thumbnail} alt={property.property_name} className="ai-prop-img" />
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
          <span><FaBed /> {property.bedrooms} bed{property.bedrooms !== 1 ? "s" : ""}</span>
        )}
        {property.school && (
          <span><FaHome /> Near {property.school}</span>
        )}
      </div>

      <div className="ai-prop-footer">
        <span className="ai-prop-price">
          GHS {Number(property.price).toLocaleString()}
          <small>/mo</small>
        </span>
        <button className="ai-prop-btn" onClick={() => onView(property.id)}>
          View <FaArrowRight />
        </button>
      </div>

      {/* Landlord info */}
      {(property.owner_name || property.owner_phone) && (
        <div className="ai-prop-landlord">
          <span className="ai-prop-landlord-label">Landlord</span>
          <div className="ai-prop-landlord-info">
            {property.owner_name && <span><FaHome /> {property.owner_name}</span>}
            {property.owner_phone && (
              <a href={`tel:${property.owner_phone}`}>
                <FaPhone /> {property.owner_phone}
              </a>
            )}
            {property.owner_email && (
              <a href={`mailto:${property.owner_email}`}>
                <FaEnvelope /> {property.owner_email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  </motion.div>
);

// ── Chat message bubble ───────────────────────────────────────────
const MessageBubble = ({ msg, onView }) => {
  const isUser = msg.role === "user";

  return (
    <motion.div
      className={`ai-msg-row ${isUser ? "ai-msg-row--user" : "ai-msg-row--ai"}`}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {!isUser && (
        <div className="ai-avatar">
          <FaRobot />
        </div>
      )}

      <div className={`ai-bubble ${isUser ? "ai-bubble--user" : "ai-bubble--ai"}`}>
        {msg.text && <p className="ai-bubble-text">{msg.text}</p>}

        {/* Property cards */}
        {msg.properties?.length > 0 && (
          <div className="ai-prop-grid">
            {msg.properties.map((p) => (
              <PropertyCard key={p.id} property={p} onView={onView} />
            ))}
          </div>
        )}

        {/* No results */}
        {msg.noResults && (
          <p className="ai-no-results">
            No exact matches found. Try adjusting your filters or ask me to search nearby areas.
          </p>
        )}

        <span className="ai-bubble-time">
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
};

// ── Typing indicator ──────────────────────────────────────────────
const TypingDots = () => (
  <div className="ai-msg-row ai-msg-row--ai">
    <div className="ai-avatar"><FaRobot /></div>
    <div className="ai-bubble ai-bubble--ai ai-bubble--typing">
      <span /><span /><span />
    </div>
  </div>
);

// ── Main chat component ───────────────────────────────────────────
const AIAssistant = ({ isOpen, onClose }) => {
  const navigate  = useNavigate();
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [sessionId, setSessionId]     = useState(null);
  const [typing, setTyping]           = useState(false);
  const [listening, setListening]     = useState(false);
  const recognitionRef                = useRef(null);

  // ── Scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ── Focus input when opened ────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      if (messages.length === 0) {
        setMessages([{
          id:   genId(),
          role: "assistant",
          text: "Hi! I'm your UrbanHavens AI assistant. Tell me what kind of property you're looking for and I'll find the best options for you.",
          ts:   Date.now(),
        }]);
      }
    }
  }, [isOpen]);

  // ── Send message ───────────────────────────────────────────────
 const sendMessage = useCallback(async (text) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const userMsg = { id: genId(), role: "user", text: trimmed, ts: Date.now() };
  setMessages(prev => [...prev, userMsg]);
  setInput("");
  setTyping(true);

  try {
    const token = localStorage.getItem("access");

    const res = await fetch("http://127.0.0.1:8000/api/assistant/chat/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message: trimmed, session_id: sessionId }),
    });

    const resData = await res.json();

    if (!res.ok) {
      throw new Error(resData?.error || resData?.detail || `HTTP ${res.status}`);
    }

    const { reply, properties, session_id: sid, action } = resData;

    if (sid) setSessionId(sid);

    const aiMsg = {
      id: genId(),
      role: "assistant",
      text: reply || "",
      properties: properties || [],
      noResults:
        Array.isArray(properties) &&
        properties.length === 0 &&
        action?.action === "search_property",
      ts: Date.now(),
    };

    setMessages(prev => [...prev, aiMsg]);
  } catch (err) {
    setMessages(prev => [
      ...prev,
      {
        id: genId(),
        role: "assistant",
        text: err.message || "Sorry, something went wrong. Please try again.",
        ts: Date.now(),
      },
    ]);
  } finally {
    setTyping(false);
  }
}, [sessionId]);
  // ── Handle Enter key ───────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Voice input ────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input not supported in your browser."); return; }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-GH";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };

    recognition.onerror  = () => setListening(false);
    recognition.onend    = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // ── View property ──────────────────────────────────────────────
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
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ──────────────────────────────────────── */}
          <div className="ai-header">
            <div className="ai-header-left">
              <div className="ai-header-avatar"><FaRobot /></div>
              <div>
                <p className="ai-header-name">UrbanHavens AI</p>
                <p className="ai-header-status">
                  <span className="ai-status-dot" />
                  Online · Real estate assistant
                </p>
              </div>
            </div>
            <button className="ai-close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          {/* ── Messages ────────────────────────────────────── */}
          <div className="ai-messages">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} onView={handleViewProperty} />
            ))}
            {typing && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* ── Suggestions ─────────────────────────────────── */}
          {messages.length <= 1 && !typing && (
            <div className="ai-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="ai-suggestion-chip" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* ── Input row ───────────────────────────────────── */}
          <div className="ai-input-row">
            <button
              className={`ai-voice-btn ${listening ? "ai-voice-btn--active" : ""}`}
              onClick={toggleVoice}
              title={listening ? "Stop listening" : "Voice input"}
            >
              <FaMicrophone />
            </button>

            <input
              ref={inputRef}
              className="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about properties..."
              disabled={typing}
            />

            <button
              className="ai-send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
            >
              {typing ? <FaSpinner className="ai-spin" /> : <FaPaperPlane />}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Floating trigger button ───────────────────────────────────────
export const AIAssistantButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        className="ai-fab"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="Open AI Assistant"
      >
        <FaComments />
        <span className="ai-fab-label">AI Assistant</span>
      </motion.button>

      <AIAssistant isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default AIAssistant;