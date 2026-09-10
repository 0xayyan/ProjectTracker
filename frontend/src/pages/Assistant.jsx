import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../services/api'

const FALLBACK_SUGGESTIONS = [
  'Give me a portfolio summary',
  'Which projects are high risk?',
  'Which projects are over budget?',
  'Which projects are behind schedule?',
]

function Assistant() {
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi, I'm the ProjectWatch Intelligence Assistant. Ask me about portfolio status, a department, or a specific project, and I'll answer using the live risk engine and predictive models.",
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    apiRequest('/assistant/suggestions')
      .then((data) => {
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions)
        }
      })
      .catch(() => {
        // Suggestions are a nice-to-have; keep the local fallback list on failure.
      })
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendQuery(query) {
    const trimmed = query.trim()
    if (!trimmed || sending) return

    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    setInput('')
    setSending(true)
    setError('')

    try {
      const data = await apiRequest(`/assistant/query?q=${encodeURIComponent(trimmed)}`)
      setMessages((current) => [...current, { role: 'assistant', text: data.answer }])
    } catch (err) {
      console.error(err)
      setError(err.message)
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: "I couldn't reach the analytics engine just now. Please try again." },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    sendQuery(input)
  }

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <h1>Intelligence Assistant</h1>
          <p className="page-subtitle">
            Ask plain-English questions; answers are generated from the same risk engine and predictive models used across the app.
          </p>
        </div>
      </div>

      <div className="assistant-panel">
        <div className="assistant-messages" ref={scrollRef}>
          {messages.map((message, index) => (
            <div key={index} className={`assistant-message assistant-message-${message.role}`}>
              <div className="assistant-message-bubble">
                {message.text.split('\n').map((line, lineIndex) => (
                  <p key={lineIndex}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          {sending && (
            <div className="assistant-message assistant-message-assistant">
              <div className="assistant-message-bubble assistant-typing">Analyzing portfolio data...</div>
            </div>
          )}
        </div>

        <div className="assistant-suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="assistant-chip"
              onClick={() => sendQuery(suggestion)}
              disabled={sending}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {error && <p className="error-message">{error}</p>}

        <form className="assistant-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ask about a project, department, budget or schedule risk..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Assistant
