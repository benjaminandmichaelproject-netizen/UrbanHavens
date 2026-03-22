import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "./api/api";
import "./SchoolAutocomplete.css";

/**
 * SchoolAutocomplete
 *
 * Props:
 *   value      — current school name string
 *   onChange   — (name: string) => void
 *   placeholder — optional placeholder text
 *   error      — optional error string to show below
 */
const SchoolAutocomplete = ({ value = "", onChange, placeholder, error }) => {
  const [query, setQuery]           = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const debounceRef                 = useRef(null);
  const wrapperRef                  = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/schools/?q=${encodeURIComponent(q)}`);
      setSuggestions(res.data || []);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // keep parent in sync as user types

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (school) => {
    setQuery(school.name);
    onChange(school.name);
    setSuggestions([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="sa-wrapper" ref={wrapperRef}>
      <div className={`sa-input-wrap ${error ? "sa-error-border" : ""}`}>
        <input
          type="text"
          className="sa-input"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder || "Type school name..."}
          autoComplete="off"
        />
        {loading && <span className="sa-spinner" />}
        {query && !loading && (
          <button className="sa-clear" onClick={handleClear} type="button">✕</button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="sa-dropdown">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="sa-option"
              onMouseDown={() => handleSelect(s)}
            >
              <span className="sa-school-name">{s.name}</span>
              <span className="sa-school-meta">{s.city} · {s.region}</span>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && suggestions.length === 0 && query.length >= 2 && (
        <div className="sa-no-results">No schools found for "{query}"</div>
      )}

      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

export default SchoolAutocomplete;
