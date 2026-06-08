// ─── Core Configurations ──────────────────────────────────────────────────
const API_BASE = "http://localhost:3000/api";
let sessionId   = null;
let currentMode = 'offline';
let isAgentEnabled = false;

// ─── DOM References ────────────────────────────────────────────────────────
const chatHistory     = document.getElementById("chat-history");
const chatInput       = document.getElementById("chat-input");
const btnSend         = document.getElementById("btn-send");
const btnUpload       = document.getElementById("btn-upload");
const fileInput       = document.getElementById("file-input");
const btnMic          = document.getElementById("btn-mic");
const typingIndicator = document.getElementById("typing-indicator");
const statusPill      = document.getElementById("status-pill");
const statusText      = document.getElementById("status-text");

// Emotion/Mode Elements
const emotionDot      = document.getElementById("emotion-dot");
const emotionLabel    = document.getElementById("emotion-label");
const emotionEmoji    = document.getElementById("emotion-emoji");
const modeOffline     = document.getElementById("mode-offline");
const modeOnline      = document.getElementById("mode-online");
const agentToggle     = document.getElementById("agent-toggle");

// ─── DOM References ────────────────────────────────────────────────────────

// Webcam Elements
const btnCamera       = document.getElementById("btn-camera");
const camModal        = document.getElementById("camera-modal");
const webcamFeed      = document.getElementById("webcam-feed");
const snapCanvas      = document.getElementById("snap-canvas");
const btnSnap         = document.getElementById("btn-snap");
const btnCloseCam     = document.getElementById("btn-close-cam");

let webcamStream      = null;

// Tab navigation removed for single-view app.

// ─── Mode & Agent Logic ─────────────────────────────────────────────────────
modeOffline.addEventListener("click", () => { currentMode = 'offline'; modeOffline.classList.add("active"); modeOnline.classList.remove("active"); });
modeOnline.addEventListener("click", () => { currentMode = 'online'; modeOnline.classList.add("active"); modeOffline.classList.remove("active"); });
agentToggle.addEventListener("change", (e) => { isAgentEnabled = e.target.checked; });

// ─── Utility: Current Time ──────────────────────────────────────────────────
function getTimestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Status & Emotion Display ───────────────────────────────────────────────
function updateStatus(online) {
    if (online) {
        statusPill.classList.add("online");
        statusText.textContent = "Synchronized";
    } else {
        statusPill.classList.remove("online");
        statusText.textContent = "Reconnecting...";
    }
}

function updateEmotionUI(data) {
    if (!data) return;
    emotionDot.style.background = data.color;
    emotionDot.style.color = data.color; // for box-shadow
    emotionLabel.textContent = data.emotion;
    emotionEmoji.textContent = data.emoji;
}

// ─── Chat Logic ─────────────────────────────────────────────────────────────
function addMessage(text, sender = 'user', meta = '') {
    const isUser = sender === 'user';
    const div = document.createElement("div");
    div.className = `message ${isUser ? 'user' : 'ai'}`;
    
    div.innerHTML = `
        <div class="node-avatar">${isUser ? 'U' : 'D'}</div>
        <div class="node-content">
            <div class="bubble-wrap">
                <div class="bubble">${text}</div>
            </div>
            <span class="node-meta">${getTimestamp()} ${meta ? '· ' + meta : ''}</span>
        </div>
    `;
    
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    chatInput.value = "";
    typingIndicator.classList.remove("hidden");

    // Disable inputs
    chatInput.disabled = true;
    btnSend.disabled = true;
    btnMic.disabled = true;
    btnUpload.disabled = true;
    btnCamera.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                session_id: sessionId,
                mode: currentMode,
                isAgent: isAgentEnabled
            })
        });

        const data = await response.json();
        typingIndicator.classList.add("hidden");

        if (response.status === 200) {
            sessionId = data.session_id;
            addMessage(data.response, 'ai', currentMode.toUpperCase());
            updateEmotionUI(data.emotion);
            
            if (data.agentLogs) {
                renderAgentLogs(data.agentLogs);
            }
        } else {
            addMessage(`Protocol Error: ${data.detail || 'Unknown failure'}`, 'ai');
        }
    } catch (err) {
        typingIndicator.classList.add("hidden");
        addMessage("Link Interrupted: Backend unreachable.", 'ai');
        updateStatus(false);
    } finally {
        // Re-enable inputs
        chatInput.disabled = false;
        btnSend.disabled = false;
        btnMic.disabled = false;
        btnUpload.disabled = false;
        btnCamera.disabled = false;
        chatInput.focus();
    }
}

// Agent logs rendering removed for single-view approach.

// ─── Camera & Vision ────────────────────────────────────────────────────────
btnCamera.addEventListener("click", async () => {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamFeed.srcObject = webcamStream;
        camModal.classList.remove("hidden");
    } catch (e) { alert("Visual access denied."); }
});

btnCloseCam.addEventListener("click", () => {
    camModal.classList.add("hidden");
    if (webcamStream) webcamStream.getTracks().forEach(t => t.stop());
});

btnSnap.addEventListener("click", () => {
    snapCanvas.width = webcamFeed.videoWidth;
    snapCanvas.height = webcamFeed.videoHeight;
    snapCanvas.getContext('2d').drawImage(webcamFeed, 0, 0);
    
    snapCanvas.toBlob(async blob => {
        camModal.classList.add("hidden");
        if (webcamStream) webcamStream.getTracks().forEach(t => t.stop());
        
        addMessage("[Initiating Vision Scan...]", 'user');
        typingIndicator.classList.remove("hidden");

        // Disable inputs
        chatInput.disabled = true;
        btnSend.disabled = true;
        btnMic.disabled = true;
        btnUpload.disabled = true;
        btnCamera.disabled = true;

        const fd = new FormData();
        fd.append("image", blob);
        if (sessionId) fd.append("session_id", sessionId);

        try {
            const res = await fetch(`${API_BASE}/gesture-chat`, { method: 'POST', body: fd });
            const data = await res.json();
            typingIndicator.classList.add("hidden");
            addMessage(data.response, 'ai', "VISION SCAN");
        } catch (e) { 
            typingIndicator.classList.add("hidden"); 
        } finally {
            // Re-enable inputs
            chatInput.disabled = false;
            btnSend.disabled = false;
            btnMic.disabled = false;
            btnUpload.disabled = false;
            btnCamera.disabled = false;
        }
    }, 'image/jpeg');
});

// ─── Initialization ────────────────────────────────────────────────────────
btnSend.addEventListener("click", sendChat);
chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChat(); });

// ─── Login Logic ────────────────────────────────────────────────────────────
const loginOverlay = document.getElementById("login-overlay");
const btnGoogle = document.getElementById("btn-google");
const btnGithub = document.getElementById("btn-github");
const btnLoginLocal = document.getElementById("btn-login-local");
const loginUsername = document.getElementById("login-username");

function handleLogin(username) {
    if (!username) return;
    localStorage.setItem("authToken", username);
    loginOverlay.classList.add("hidden");
    
    // Welcome message
    setTimeout(() => {
        addMessage(`Welcome back, ${username}! System Online. How can I assist you today?`, 'ai', 'System Protocol');
    }, 500);
}

// Check on load
if (!localStorage.getItem("authToken")) {
    loginOverlay.classList.remove("hidden");
    // Clear initial chat history greeting
    chatHistory.innerHTML = "";
}

btnGoogle.addEventListener("click", () => handleLogin("Google User"));
btnGithub.addEventListener("click", () => handleLogin("GitHub User"));
btnLoginLocal.addEventListener("click", () => handleLogin(loginUsername.value.trim()));
loginUsername.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLogin(loginUsername.value.trim()); });

// Check Health on start
setInterval(async () => {
    try {
        const res = await fetch(`${API_BASE}/health`);
        updateStatus(res.ok);
    } catch (e) { updateStatus(false); }
}, 5000);
