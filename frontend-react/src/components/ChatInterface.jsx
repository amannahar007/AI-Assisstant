import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { db, functions } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Send, Paperclip, Mic, Camera, Plus, MessageSquare, Square, Copy, Check, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const MarkdownMessage = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0"
      components={{
        code({node, inline, className, children, ...props}) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <div className="rounded-md overflow-hidden my-2 border border-glass-border shadow-sm">
              <div className="bg-[#1e1e1e] px-4 py-1 text-xs text-slate-400 font-mono border-b border-gray-700/50 flex justify-between">
                <span>{match[1]}</span>
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, padding: '1rem', background: '#1e1e1e' }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="bg-black/5 px-1.5 py-0.5 rounded-md font-mono text-[13px] text-neon-cyan border border-glass-border" {...props}>
              {children}
            </code>
          )
        },
        table({children}) {
          return <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-glass-border border border-glass-border rounded-lg">{children}</table></div>
        },
        th({children}) {
          return <th className="px-4 py-2 bg-black/5 text-left text-xs font-semibold uppercase tracking-wider">{children}</th>
        },
        td({children}) {
          return <td className="px-4 py-2 whitespace-nowrap text-sm border-t border-glass-border">{children}</td>
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const MessageBubble = memo(({ msg, isLast, onCopy, onRegenerate, isCopied, isRegeneratingDisabled }) => {
  return (
    <div className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : ''} animate-[slideIn_0.3s_ease-out]`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-glass-border font-serif ${msg.role === 'user' ? 'bg-neon-cyan text-white border-none' : 'bg-slate text-text-dim'}`}>
        {msg.role === 'user' ? 'U' : 'D'}
      </div>
      <div className="flex flex-col gap-1 w-full">
        <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-slate border border-glass-border rounded-tr-sm whitespace-pre-wrap' : 'bg-white border border-glass-border rounded-tl-sm w-full overflow-hidden'}`}>
          {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
        </div>
        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 mt-1 ml-2">
            <button onClick={() => onCopy(msg.content, msg.id)} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-slate">
              {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
            {isLast && (
              <button onClick={onRegenerate} disabled={isRegeneratingDisabled} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-slate disabled:opacity-50">
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default function ChatInterface({ user, isPro }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [hasLoadedInitialSessions, setHasLoadedInitialSessions] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Chat Session Management
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => uuidv4());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const scrollRef = useRef(null);
  const abortControllerRef = useRef(null);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Load chat sessions
  useEffect(() => {
    if (!user || !user.uid) return;
    const q = query(collection(db, `users/${user.uid}/chats`), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const s = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(s);
      if (!hasLoadedInitialSessions) {
        setHasLoadedInitialSessions(true);
        if (s.length > 0) {
          setCurrentSessionId(s[0].id);
        }
      }
    }, (error) => {
      console.error("Firestore sessions error:", error);
    });
    return unsub;
  }, [user, hasLoadedInitialSessions]);

  // Load messages for current session
  useEffect(() => {
    if (!user || !user.uid || !currentSessionId) return;
    const q = query(collection(db, `users/${user.uid}/chats/${currentSessionId}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.error("Firestore messages error:", error);
    });
    return unsub;
  }, [user, currentSessionId]);

  const handleNewChat = () => {
    const newId = uuidv4();
    setCurrentSessionId(newId);
    setMessages([]);
  };

  const handleRegenerate = async () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || loading) return;
    await sendMessage(lastUserMsg.content);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  const sendMessage = async (userText) => {
    setLoading(true);
    setStreamingContent('');

    // 1. Optimistic Update (Show user message instantly)
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const newUserMessage = {
      id: tempUserMsgId,
      role: 'user',
      content: userText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    let firestoreEnabled = true;

    try {
      // 2. Try Firestore: Ensure session exists
      await setDoc(doc(db, `users/${user.uid}/chats`, currentSessionId), {
        updatedAt: serverTimestamp(),
        preview: userText.substring(0, 30) + '...'
      }, { merge: true });

      // 3. Try Firestore: Save user message
      await addDoc(collection(db, `users/${user.uid}/chats/${currentSessionId}/messages`), {
        role: 'user',
        content: userText,
        timestamp: serverTimestamp()
      });
    } catch (dbErr) {
      console.error("Firestore error (falling back to local memory):", dbErr);
      firestoreEnabled = false;
    }

    let fullResponse = "";
    try {
      // Get auth token
      const token = await user.getIdToken();
      
      // Get history (last 10 messages)
      const history = messages
        .filter(m => !m.id.startsWith('temp-'))
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      // 4. Fetch Response from local/remote LLM backend
      abortControllerRef.current = new AbortController();
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: userText, 
          session_id: currentSessionId, 
          stream: true,
          history: history
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last element (which might be incomplete) in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(`"${data}"`);
              fullResponse += parsed;
              setStreamingContent(prev => prev + parsed);
            } catch {
              fullResponse += data;
              setStreamingContent(prev => prev + data);
            }
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }

      // 5. Try to save complete AI response to Firestore
      if (firestoreEnabled) {
        try {
          await addDoc(collection(db, `users/${user.uid}/chats/${currentSessionId}/messages`), {
            role: 'assistant',
            content: fullResponse || "Error processing request.",
            timestamp: serverTimestamp()
          });
        } catch (dbErr) {
          console.error("Failed to save AI response to Firestore:", dbErr);
          firestoreEnabled = false;
        }
      }

      // If Firestore is disabled or write failed, update the local messages state directly
      if (!firestoreEnabled) {
        const newAiMessage = {
          id: `temp-ai-${Date.now()}`,
          role: 'assistant',
          content: fullResponse || "Error: No response generated by the assistant.",
          timestamp: new Date()
        };
        // Remove duplicate temp user message if it's there, then append
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempUserMsgId);
          return [...filtered, { ...newUserMessage, id: `local-user-${Date.now()}` }, newAiMessage];
        });
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
        if (firestoreEnabled && fullResponse) {
           await addDoc(collection(db, `users/${user.uid}/chats/${currentSessionId}/messages`), {
             role: 'assistant',
             content: fullResponse + "\n\n*[Generation stopped by user]*",
             timestamp: serverTimestamp()
           });
        }
        return;
      }
      console.error("Chat error:", err);
      const errorContent = `Error: Could not connect to the assistant backend. Details: ${err.message}`;
      
      const errorAiMsg = {
        id: `temp-error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsgId);
        return [...filtered, { ...newUserMessage, id: `local-user-${Date.now()}` }, errorAiMsg];
      });
    } finally {
      setLoading(false);
      setStreamingContent('');
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = { handleCopy, handleRegenerate };
  });
  const stableOnCopy = useCallback((text, id) => actionsRef.current.handleCopy(text, id), []);
  const stableOnRegenerate = useCallback(() => actionsRef.current.handleRegenerate(), []);

  return (
    <div className="flex h-full relative overflow-hidden w-full">
      {/* Sidebar for History */}
      <div className={`w-64 bg-slate border-r border-glass-border flex flex-col transition-all ${sidebarOpen ? 'ml-0' : '-ml-64'}`}>
        <div className="p-4 border-b border-glass-border">
          <button id="new-chat-button" onClick={handleNewChat} className="w-full py-2 px-4 bg-neon-cyan text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#2f4a48] transition-colors">
            <Plus size={16} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setCurrentSessionId(s.id)}
              className={`w-full text-left p-3 rounded-lg text-sm truncate transition-colors mb-1 ${currentSessionId === s.id ? 'bg-white border border-glass-border text-text-primary shadow-sm' : 'text-text-muted hover:bg-black/5'}`}
            >
              <MessageSquare size={14} className="inline mr-2 opacity-50" />
              {s.preview || 'New Conversation'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative">
        <header className="h-20 px-10 border-b border-glass-border flex items-center bg-white shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 text-text-muted hover:text-text-primary p-2">
            <MessageSquare size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-serif text-text-primary tracking-tight">Chat</h1>
            <p className="text-[13px] text-text-muted">End-to-end encrypted session</p>
          </div>
          {isPro && <span className="ml-auto bg-neon-amber/10 text-neon-amber px-3 py-1 rounded-full text-xs font-bold border border-neon-amber/20">PRO ACTIVE</span>}
        </header>

        <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-6">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-text-muted opacity-70 mt-20">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isLast = msg.id === messages[messages.length - 1]?.id;
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isLast={isLast}
                onCopy={stableOnCopy}
                onRegenerate={stableOnRegenerate}
                isCopied={copiedId === msg.id}
                isRegeneratingDisabled={isLast ? loading : false}
              />
            );
          })}
          {loading && (
            <div className="flex gap-4 max-w-[80%] animate-[slideIn_0.3s_ease-out]">
              <div className="w-9 h-9 rounded-full bg-slate border border-glass-border flex items-center justify-center font-bold text-sm text-text-dim font-serif shrink-0">D</div>
              <div className="p-4 bg-white border border-glass-border rounded-2xl rounded-tl-sm text-text-primary text-[15px] leading-relaxed shadow-sm flex flex-col gap-2 min-w-[60px] w-full overflow-hidden">
                {streamingContent ? <MarkdownMessage content={streamingContent} /> : (
                  <div className="flex items-center gap-2 h-6">
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={scrollRef}></div>
        </div>

        <div className="p-8 pb-10 bg-void shrink-0">
          <form onSubmit={handleSend} className="glass-card p-2 shadow-sm flex items-center gap-3">
            <button type="button" className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-neon-cyan transition-colors rounded-xl hover:bg-slate"><Paperclip size={18} /></button>
            <button type="button" className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-neon-cyan transition-colors rounded-xl hover:bg-slate"><Camera size={18} /></button>

            <input
              id="chat-message-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-text-primary text-base font-main px-2 disabled:opacity-50"
            />

            <button type="button" className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-neon-cyan transition-colors rounded-xl hover:bg-slate"><Mic size={18} /></button>
            {loading ? (
              <button id="chat-stop-button" type="button" onClick={handleStopGeneration} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all shadow-sm">
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button id="chat-send-button" type="submit" disabled={!input.trim()} className="w-10 h-10 flex items-center justify-center bg-neon-cyan text-white rounded-xl hover:bg-[#2f4a48] transition-all disabled:opacity-50 hover:-translate-y-px shadow-sm">
                <Send size={18} />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
