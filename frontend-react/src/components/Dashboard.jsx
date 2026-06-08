import { useState } from 'react';
import { auth } from '../firebase';
import ChatInterface from './ChatInterface';
import EmotionFusion from './EmotionFusion';
import Subscription from './Subscription';
import AdminDashboard from './AdminDashboard';
import { LogOut, MessageSquare, BrainCircuit, CreditCard, BarChart2 } from 'lucide-react';

export default function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [isPro, setIsPro] = useState(false); // In production, fetch from Firestore

  return (
    <div className="flex h-screen bg-void text-text-primary">
      <aside className="w-64 bg-slate border-r border-glass-border flex flex-col p-6">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-10 h-10 bg-neon-purple text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-[0_2px_6px_rgba(140,90,77,0.3)]">D</div>
          <div className="flex flex-col">
            <span className="font-serif font-bold text-lg leading-tight">Divu AI</span>
            <span className="text-[10px] text-text-muted font-mono">v2.0.0 SaaS</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'chat' ? 'bg-white text-neon-cyan border border-glass-border shadow-sm' : 'text-text-dim hover:bg-black/5 hover:text-text-primary'}`}>
            <MessageSquare size={18} /> Chat
          </button>
          <button onClick={() => setActiveTab('emotion')} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'emotion' ? 'bg-white text-neon-cyan border border-glass-border shadow-sm' : 'text-text-dim hover:bg-black/5 hover:text-text-primary'}`}>
            <BrainCircuit size={18} /> Emotion Core {isPro ? '✅' : '🔒'}
          </button>
          <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'billing' ? 'bg-white text-neon-cyan border border-glass-border shadow-sm' : 'text-text-dim hover:bg-black/5 hover:text-text-primary'}`}>
            <CreditCard size={18} /> Subscription
          </button>
          <button onClick={() => setActiveTab('admin')} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'admin' ? 'bg-white text-neon-cyan border border-glass-border shadow-sm' : 'text-text-dim hover:bg-black/5 hover:text-text-primary'}`}>
            <BarChart2 size={18} /> Analytics
          </button>
        </nav>

        <div className="mt-auto border-t border-glass-border pt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-neon-cyan text-white flex items-center justify-center text-xs font-bold">
              {(user.email || user.phoneNumber || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-text-dim truncate">{user.email || user.phoneNumber || 'User'}</span>
          </div>
          <button onClick={() => auth.signOut()} className="flex items-center gap-3 w-full p-2 text-sm text-text-muted hover:text-neon-purple transition-colors">
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {activeTab === 'chat' && <ChatInterface user={user} isPro={isPro} />}
        {activeTab === 'emotion' && (isPro ? <EmotionFusion user={user} /> : <Subscription user={user} setIsPro={setIsPro} />)}
        {activeTab === 'billing' && <Subscription user={user} setIsPro={setIsPro} isPro={isPro} />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}
