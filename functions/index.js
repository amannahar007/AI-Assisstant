const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// Rate limiting map (in-memory, only applies to the specific Cloud Function instance)
const lastRequestTime = new Map();
const THROTTLE_DELAY = 1000;
const HISTORY_LIMIT = 5;

// Helper: Call Ollama (assuming it's hosted publicly or via a tunnel, or we simulate it if localhost)
// For Cloud Functions, accessing localhost:11434 will NOT work unless Ollama is public.
// We will use a mock response if we can't reach it, or assume the user has a public endpoint.
async function callLLM(messages, retries = 2) {
    const url = process.env.OLLAMA_URL || 'http://host.docker.internal:11434/api/chat'; // Placeholder, usually requires public IP/Ngrok
    const model = process.env.OLLAMA_MODEL || 'gemma:2b';
    
    // For local emulation testing, we can try to reach local ollama.
    // In production Firebase Functions, this needs a real public endpoint.
    // For now, to keep it working without crashing, we mock if we fail.
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios.post(url, {
                model: model,
                messages: messages,
                stream: false
            }, { timeout: 30000 });
            return response.data.message.content.trim();
        } catch (error) {
            console.error(`LLM Error (Attempt ${attempt+1}):`, error.message);
            if (attempt === retries - 1) {
                return `Error: Failed to connect to LLM. Using offline fallback response.`;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// 1. Chat Function (Callable)
exports.chatWithDivu = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { message, sessionId, emotion } = data;
    const uid = context.auth.uid;

    if (!message || message.trim() === "") {
        throw new functions.https.HttpsError('invalid-argument', 'Message cannot be empty.');
    }

    // Rate Limiting per UID
    const currentTime = Date.now();
    if (lastRequestTime.has(uid) && (currentTime - lastRequestTime.get(uid) < THROTTLE_DELAY)) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too fast! Please wait.');
    }
    lastRequestTime.set(uid, currentTime);

    const actualSessionId = sessionId || `session_${uid}`;
    const chatRef = db.collection('chats').doc(uid).collection('sessions').doc(actualSessionId);
    
    let sessionDoc = await chatRef.get();
    let messages = [];
    if (sessionDoc.exists) {
        messages = sessionDoc.data().messages || [];
    }

    // Prepare system prompt
    let systemContent = "You are Divu, a friendly AI Assistant. Keep answers brief and professional.";
    if (emotion === 'sad') systemContent += " The user seems sad, be empathetic.";
    if (emotion === 'angry') systemContent += " The user seems angry, be calm and helpful.";

    const systemPrompt = { role: "system", content: systemContent };
    
    const llmMessages = [
        systemPrompt,
        ...messages,
        { role: "user", content: message.trim() }
    ];

    let responseContent = await callLLM(llmMessages);
    
    // Fallback if LLM isn't accessible
    if (responseContent.startsWith("Error:")) {
        responseContent = "I'm currently unable to reach my neural core (LLM offline). How can I assist you otherwise?";
    }

    // Update History
    messages.push({ role: "user", content: message.trim(), timestamp: Date.now() });
    messages.push({ role: "assistant", content: responseContent, timestamp: Date.now() });
    
    // Keep within limits
    if (messages.length > HISTORY_LIMIT * 2) {
        messages = messages.slice(-(HISTORY_LIMIT * 2));
    }

    // Save back to Firestore
    await chatRef.set({ messages: messages, updatedAt: Date.now() }, { merge: true });

    // Store message in a global collection for analytics/history
    await db.collection('messages').add({
        uid,
        sessionId: actualSessionId,
        userMessage: message.trim(),
        botResponse: responseContent,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        response: responseContent,
        sessionId: actualSessionId
    };
});

// 2. Setup User Profile on Create
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    await db.collection('users').doc(user.uid).set({
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        displayName: user.displayName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionStatus: 'free'
    });

    await db.collection('analytics_events').add({
        event: 'user_signup',
        userId: user.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
});
