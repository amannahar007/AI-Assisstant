# Divu AI Assistant v2.0.0 (Quantum Edition)

A sophisticated, multimodal, and autonomous personal AI assistant built with Node.js, MongoDB, and local LLMs. Divu v2.0 brings futuristic UI, emotional intelligence, and agentic workflows to your desktop.

## 🚀 New Features (v2.0.0)

### 🧠 Smart Synaptic Memory
Divu now features both short-term and long-term memory. It remembers facts about you (name, preferences, instructions) and persists them in a MongoDB-backed synaptic cache.

### 🎭 Biometric Emotion Detection
Real-time sentiment analysis detects your mood (Happy, Sad, Angry, Ecstatic) from your text input. Divu adapts its personality and response tone to match your emotional state.

### 🤖 Agent Matrix (Autonomous Workflows)
Enable the **Autonomous Agent** mode to allow Divu to break down complex tasks into sequential steps. It plans, executes, and summarizes results automatically.

### 🔌 Hybrid Neural Link (Offline/Online)
Switch between **Offline Mode** (powered by local Ollama/Gemma) for maximum privacy and **Online Mode** (Cloud-powered) for high-performance reasoning.

### 👁️ Vision Scan & Voice Core
Full support for gesture recognition via live webcam and speech-to-speech interaction.

## 🛠 Architecture

- **Backend**: Node.js, Express, Mongoose
- **Database**: MongoDB (Sessions, Cache, Long-term Memory)
- **Intelligence**: 
  - Local: Ollama (gemma:2b / llava)
  - NLP: Natural, Sentiment Analysis
- **Frontend**: Vanilla JS, Glassmorphism CSS, Responsive Dashboard

## 🚦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/try/download/community)
- [Ollama](https://ollama.com/) (Run `ollama pull gemma:2b` and `ollama pull llava`)

### Installation
1. Clone the repository.
2. Navigate to `backend-node` and run:
   ```bash
   npm install
   ```
3. Configure your `.env` file in the `backend-node` directory.

### Launch
Run the unified launcher:
```bash
./Launch Divu AI.bat
```

## 📸 UI Preview
*(New futuristic dashboard with real-time emotion monitoring and agent logs)*

---
**Made with ❤️ for the AI Portfolio of the Future.**
