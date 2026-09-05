import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, Star, ShoppingCart, Shuffle, Sparkles, RefreshCw, CheckCircle2, ArrowRight, Tag, Layers, ChevronRight } from 'lucide-react';
import { agentAPI, cartAPI } from '../services/api';
import ProductImage from '../components/ProductImage';

export default function AgentPage({ initialPrompt, setInitialPrompt, updateCart }) {
  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: "Hello! I'm ShopGenie, your agentic shopping assistant. Tell me what you're looking for, or choose one of the suggestions below. I can search, filter, compare specifications, score options, and even perform cart actions!",
      isGreeting: true
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Track agent execution state
  const [currentSteps, setCurrentSteps] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [lastRecommendedId, setLastRecommendedId] = useState(null);

  const [latestRecommendation, setLatestRecommendation] = useState(null);
  const [latestAlternatives, setLatestAlternatives] = useState([]);
  const [latestComparison, setLatestComparison] = useState(null);

  const messagesEndRef = useRef(null);

  const sampleQueries = [
    "I need wireless headphones under ₹3,000 for studying with good battery.",
    "Find me a laptop under ₹60,000 for coding with at least 16GB RAM.",
    "Compare boAt Rockerz 450 and Sennheiser HD 250BT headphones.",
    "Add the recommended headphones to my cart.",
    "Find a wireless mouse under ₹1,500 and add the best one to my cart."
  ];

  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
      setInitialPrompt(''); // Clear global prompt after consuming
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, currentSteps]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    // Add user message to transcript
    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setInput('');
    setLoading(true);

    // Set up skeleton steps during processing
    const processingSteps = [
      { title: "Understanding requirements", status: "processing", details: "Parsing constraints..." },
      { title: "Searching product database", status: "pending", details: "Awaiting constraints..." },
      { title: "Applying budget & rating filters", status: "pending", details: "Awaiting matching list..." },
      { title: "Comparing specifications & ranking", status: "pending", details: "Awaiting filtered candidates..." },
      { title: "Formulating recommendation & action", status: "pending", details: "Compiling explanation..." }
    ];

    setCurrentSteps(processingSteps);
    setActiveStepIndex(0);

    // Simulate step progress in UI for natural flow
    const stepInterval = setInterval(() => {
      setActiveStepIndex((prevIdx) => {
        if (prevIdx < 4) {
          const updated = [...processingSteps];
          for (let i = 0; i <= prevIdx; i++) {
            updated[i].status = "completed";
          }
          updated[prevIdx + 1].status = "processing";
          setCurrentSteps(updated);
          return prevIdx + 1;
        }
        clearInterval(stepInterval);
        return prevIdx;
      });
    }, 1200);

    try {
      const res = await agentAPI.chat(query, lastRecommendedId);

      clearInterval(stepInterval);

      // Update actual steps from backend
      setCurrentSteps(res.steps.map(s => ({ ...s, status: "completed" })));
      setActiveStepIndex(res.steps.length);

      // Set recommendation states
      if (res.recommended_product) {
        setLastRecommendedId(res.recommended_product.id);
        setLatestRecommendation(res.recommended_product);
      }
      if (res.alternatives) {
        setLatestAlternatives(res.alternatives);
      }
      if (res.comparison) {
        setLatestComparison(res.comparison);
      } else if (!res.recommended_product) {
        setLatestComparison(null);
      }

      // Sync the global cart
      if (res.cart) {
        updateCart(res.cart);
      }

      // Add agent reply to transcript
      setMessages((prev) => [...prev, {
        sender: 'agent',
        text: res.reply,
        recommended: res.recommended_product,
        alternatives: res.alternatives,
        comparison: res.comparison,
        action: res.action_performed,
        demoMode: res.demo_mode
      }]);

    } catch (error) {
      console.error("Agent error:", error);
      clearInterval(stepInterval);
      setMessages((prev) => [...prev, {
        sender: 'agent',
        text: "I'm sorry, I encountered a communication error with my core service. Please make sure the backend is active.",
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (prodId, prodName, e) => {
    e.stopPropagation();
    try {
      const updated = await cartAPI.add(prodId, 1);
      updateCart(updated);

      // Add a helpful note in chat
      setMessages((prev) => [...prev, {
        sender: 'agent',
        text: `🛒 Cart update: Added ${prodName} to your cart! You can view your cart totals on the Cart tab.`
      }]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-5rem)] flex flex-col md:flex-row gap-6">
      {/* LEFT: Chat interface */}
      <div className="flex-1 card flex flex-col overflow-hidden h-full">
        {/* Header */}
        <div className="p-4 border-b border-sand bg-paperDim/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-forest-500 rounded-xl">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-ink text-sm">ShopGenie Assistant</h3>
              <p className="text-[10px] text-inkMuted flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-500 inline-block" />
                <span>Active &amp; ready to help</span>
              </p>
            </div>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => {
            const isAgent = msg.sender === 'agent';
            return (
              <div
                key={index}
                className={`flex items-start gap-3 max-w-[85%] ${
                  isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'
                } animate-fade-in`}
              >
                <div className={`p-2 rounded-xl flex-shrink-0 ${
                  isAgent ? 'bg-forest-50 text-forest-600' : 'bg-forest-500 text-white'
                }`}>
                  {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                    isAgent
                      ? 'bg-paperDim/60 border-sand text-ink'
                      : 'bg-forest-500 border-forest-500 text-white'
                  }`}>
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {msg.demoMode && (
                      <div className="mt-3 text-[10px] text-ember-600 bg-ember-50 px-2.5 py-1.5 rounded-lg font-medium">
                        Running in offline demo mode (no GEMINI_API_KEY found in .env), using the local rule engine.
                      </div>
                    )}
                  </div>

                  {/* Render Product Recommendations directly within the conversation card */}
                  {isAgent && msg.recommended && (
                    <div className="card p-5 border-forest-200 max-w-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full bg-forest-50 text-[10px] font-semibold text-forest-600 uppercase tracking-wide flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          <span>AI Pick ({msg.recommended.ai_score}%)</span>
                        </span>
                        <span className="text-ink font-semibold font-display">₹{msg.recommended.price.toLocaleString()}</span>
                      </div>

                      <div className="flex gap-4">
                        <ProductImage
                          src={msg.recommended.image_url}
                          alt={msg.recommended.name}
                          className="w-20 h-20 rounded-xl object-cover bg-paperDim"
                        />
                        <div className="space-y-1">
                          <h4 className="font-display font-semibold text-ink text-sm leading-snug">{msg.recommended.name}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-inkMuted">
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3.5 w-3.5 fill-ember-400 text-ember-400" />
                              <span className="font-medium text-ink">{msg.recommended.rating}</span>
                            </span>
                            <span>({msg.recommended.reviews_count} reviews)</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(msg.recommended.specifications || {}).slice(0, 3).map(([k, v]) => (
                              <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-paperDim text-inkMuted">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleAddToCart(msg.recommended.id, msg.recommended.name, e)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-forest-500 hover:bg-forest-600 text-white text-xs font-medium rounded-xl transition-colors"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span>Add Recommended to Cart</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Skeleton step progression loader */}
          {loading && (
            <div className="flex items-start gap-3 mr-auto max-w-[85%]">
              <div className="p-2 rounded-xl bg-paperDim text-inkMuted">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <div className="card p-4 space-y-3 w-80">
                <p className="text-xs text-inkMuted">ShopGenie is working on it...</p>
                <div className="space-y-1.5 pt-2">
                  {currentSteps.map((step, idx) => {
                    const isProcessing = step.status === "processing";
                    const isCompleted = step.status === "completed";
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {isCompleted ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-forest-500" />
                        ) : isProcessing ? (
                          <RefreshCw className="h-3.5 w-3.5 text-ember-500 animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-sand" />
                        )}
                        <span className={isCompleted ? 'text-ink font-medium' : isProcessing ? 'text-ember-600 font-medium' : 'text-inkMuted/60'}>
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Starter query chips */}
        {messages.length === 1 && (
          <div className="px-6 py-4 border-t border-sand space-y-2.5">
            <p className="text-[10px] text-inkMuted font-semibold uppercase tracking-wide">Example queries</p>
            <div className="flex flex-wrap gap-2">
              {sampleQueries.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-paperDim/60 border border-sand hover:border-sandDark text-inkMuted hover:text-ink transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="p-4 border-t border-sand bg-paperDim/40 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Type a request (e.g. 'headphones under ₹3,000 for studying')..."
            className="flex-1 px-4 py-3 bg-white border border-sand focus:border-forest-500 rounded-xl text-sm text-ink placeholder-inkMuted/50 focus:outline-none focus:ring-1 focus:ring-forest-500/30 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-forest-500 hover:bg-forest-600 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl transition-colors"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>
      </div>

      {/* RIGHT: Agent Activity & Context panel */}
      <div className="w-full md:w-80 flex flex-col gap-5 h-full overflow-y-auto pr-1">
        {/* Agent Activity Progress Card */}
        <div className="card p-5 space-y-4">
          <h4 className="font-display font-semibold text-ink text-sm flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 text-forest-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Agent activity</span>
          </h4>
          <div className="space-y-4 pt-1">
            {currentSteps.length === 0 ? (
              <p className="text-xs text-inkMuted italic">No activity yet. Submit a message to see the agent work through it.</p>
            ) : (
              currentSteps.map((step, idx) => {
                const isCompleted = step.status === "completed";
                const isProcessing = step.status === "processing";
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-forest-500 flex-shrink-0" />
                      ) : isProcessing ? (
                        <div className="w-4 h-4 rounded-full border-2 border-ember-500 border-t-transparent animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-sand flex-shrink-0" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className={`text-xs font-medium ${isCompleted ? 'text-ink' : isProcessing ? 'text-ember-600' : 'text-inkMuted/60'}`}>
                        {step.title}
                      </p>
                      <p className="text-[10px] text-inkMuted leading-normal">{step.details}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side recommendations & comparisons panel */}
        {latestRecommendation && (
          <div className="card p-5 space-y-4">
            <h4 className="font-display font-semibold text-ink text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ember-500" />
              <span>Current matches</span>
            </h4>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-forest-50 text-xs">
                <span className="text-[9px] font-semibold text-forest-600 uppercase tracking-wide block mb-1">AI Recommendation</span>
                <p className="text-ink font-medium truncate">{latestRecommendation.name}</p>
                <p className="text-inkMuted mt-1">₹{latestRecommendation.price.toLocaleString()} · {latestRecommendation.rating} ★</p>
              </div>

              {latestAlternatives.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-semibold text-inkMuted uppercase tracking-wide block">Strong Alternatives</span>
                  {latestAlternatives.map((alt) => (
                    <div key={alt.id} className="p-2.5 rounded-lg bg-paperDim/60 text-xs flex justify-between items-center">
                      <span className="text-ink truncate max-w-[70%]">{alt.name}</span>
                      <span className="text-ink font-medium">₹{alt.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparison matrices summary */}
        {latestComparison && (
          <div className="card p-5 space-y-3">
            <h4 className="font-display font-semibold text-ink text-sm flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-ember-500" />
              <span>Comparison view</span>
            </h4>
            <p className="text-[10px] text-inkMuted leading-snug">
              Attributes of the top matching candidates, side by side.
            </p>
            <div className="max-h-56 overflow-auto border border-sand rounded-xl text-[10px] bg-paperDim/30">
              <table className="min-w-full divide-y divide-sand">
                <thead className="bg-paperDim">
                  <tr>
                    {latestComparison.headers.map((h, i) => (
                      <th key={i} className="px-2.5 py-1.5 text-left font-semibold text-inkMuted truncate max-w-[75px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {latestComparison.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-paperDim/50">
                      {row.map((val, j) => (
                        <td key={j} className={`px-2.5 py-1.5 truncate max-w-[75px] ${
                          j === 0 ? 'text-inkMuted font-medium' : j === 1 ? 'text-forest-600 font-medium' : 'text-ink'
                        }`}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
