import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import QRCode from 'react-qr-code';

export default function Subscription({ user, setIsPro, isPro }) {
  const [step, setStep] = useState(1);
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [subStatus, setSubStatus] = useState('none');

  const upiId = "amannahar0807@oksbi";
  const amount = 9;
  const upiString = `upi://pay?pa=${upiId}&pn=Divu%20AI&am=${amount}&cu=INR`;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "subscriptions", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSubStatus(data.status);
        if (data.status === 'active') setIsPro(true);
        else setIsPro(false);
      }
    });
    return () => unsub();
  }, [user, setIsPro]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!transactionId.trim()) return;
    
    setLoading(true);
    try {
      await setDoc(doc(db, "payment_requests", user.uid), {
        user_id: user.uid,
        email: user.email || user.phoneNumber || 'unknown',
        transaction_id: transactionId,
        status: "pending",
        timestamp: serverTimestamp()
      });
      
      await setDoc(doc(db, "subscriptions", user.uid), {
        user_id: user.uid,
        status: "pending",
        updatedAt: serverTimestamp()
      }, { merge: true });
      
    } catch (err) {
      console.error(err);
      alert("Failed to submit transaction.");
    } finally {
      setLoading(false);
      setStep(1);
    }
  };

  if (subStatus === 'active') {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <div className="text-4xl mb-4">💎</div>
          <h2 className="text-2xl font-serif font-bold text-text-primary mb-2">Pro Member Active</h2>
          <p className="text-text-muted mb-6 text-sm">You have full access to Multimodal Emotion AI.</p>
          <div className="p-4 bg-neon-green/10 text-neon-green border border-neon-green/20 rounded-lg text-sm font-bold">
            Subscription Valid
          </div>
        </div>
      </div>
    );
  }

  if (subStatus === 'pending') {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md border border-neon-amber/50">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <h2 className="text-2xl font-serif font-bold text-text-primary mb-2">Verification in progress</h2>
          <p className="text-text-muted mb-6 text-sm">Your payment of ₹9 is currently being verified by an administrator.</p>
          <div className="p-4 bg-neon-amber/10 text-neon-amber border border-neon-amber/20 rounded-lg text-sm font-bold">
            Manual verification within 1–6 hours
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-10 flex flex-col items-center justify-center">
      <div className="glass-card p-10 text-center max-w-md border-2 border-neon-cyan/50 shadow-[0_0_30px_rgba(59,91,89,0.1)] w-full">
        <h2 className="text-2xl font-serif font-bold text-text-primary mb-2">Upgrade to Emotion AI Pro</h2>
        
        {step === 1 && (
          <>
            <p className="text-text-muted mb-6 text-sm">Unlock full multimodal emotion detection using Face + Voice fusion algorithms.</p>
            <div className="text-4xl font-bold text-neon-cyan mb-8">₹9 <span className="text-lg text-text-muted font-normal">/ month</span></div>
            <button onClick={() => setStep(2)} className="w-full py-4 rounded-xl primary-glow font-bold text-lg">
              Proceed to Pay
            </button>
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center">
            <p className="text-text-muted mb-4 text-sm">Scan using GPay, PhonePe, or Paytm</p>
            <div className="bg-white p-4 rounded-xl shadow-inner border border-glass-border mb-4">
              <QRCode value={upiString} size={180} />
            </div>
            <p className="font-mono text-sm font-bold text-text-primary mb-2">{upiId}</p>
            <p className="text-xs text-text-muted mb-6">Amount: ₹9.00</p>
            
            <button onClick={() => setStep(3)} className="w-full py-4 rounded-xl primary-glow font-bold text-lg">
              I have paid
            </button>
            <button onClick={() => setStep(1)} className="mt-4 text-xs text-text-muted hover:text-text-primary">Cancel</button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="flex flex-col items-center w-full animate-[slideIn_0.3s_ease-out]">
            <p className="text-text-muted mb-6 text-sm">Please submit your 12-digit UPI Transaction ID for verification.</p>
            <input
              type="text"
              placeholder="e.g. 312345678901"
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full p-4 mb-6 rounded-xl border border-glass-border outline-none focus:border-neon-cyan font-mono text-center"
            />
            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl primary-glow font-bold text-lg disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit for Verification'}
            </button>
            <p className="mt-6 text-xs text-neon-amber font-bold flex items-center justify-center gap-1">
              <span>🔒</span> Manual verification within 1–6 hours
            </p>
            <button type="button" onClick={() => setStep(2)} className="mt-4 text-xs text-text-muted hover:text-text-primary">Back to QR Code</button>
          </form>
        )}
      </div>
    </div>
  );
}
