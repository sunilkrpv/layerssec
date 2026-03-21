# AI Assistant

Drafter's AI Assistant (powered by Claude) can generate diagrams from plain English, evaluate your architecture, answer questions, and maintain a searchable conversation history for each project.

Press **`Cmd+I`** or click the **AI** button in the toolbar to open the assistant panel.

---

## Generate a Diagram

Use natural language to create nodes and connections from scratch — or to add to an existing diagram.

### How to generate

1. Open the AI Assistant (`Cmd+I`).
2. Type a description of what you want, for example:

   > *"Draw a 3-tier web app with a React frontend, a Node.js API, and a PostgreSQL database. Add a Redis cache between the API and database."*

3. Press **Enter** or click **Send**.
4. The assistant generates nodes and edges and places them on the canvas.

### Tips for better results

- Mention **specific technologies** — `"AWS Lambda"`, `"Redis"`, `"Nginx"` — so nodes get the right icon
- Describe **relationships explicitly** — `"connects to"`, `"calls"`, `"reads from"`
- Ask for **layers** — `"put the auth service in a separate sub-layer of the API node"`
- Be specific about **trust zones** — `"the database lives in the internal network, the frontend is in the internet zone"`

### Generate a new layer

Right-click a node → **Drill Down** to create a child layer, then open the AI Assistant and describe what should go inside that component. The assistant targets the current layer.

---

## Evaluate Your Architecture

The AI can review your diagram and provide architectural feedback.

1. Open the AI Assistant.
2. Click **Evaluate** (or type a question like *"What are the weak points in this design?"*).
3. The assistant streams a structured analysis covering scalability, security concerns, single points of failure, and improvement suggestions.

### Ask follow-up questions

After an evaluation, you can ask specific questions in the same session:

> *"How would I add rate limiting to the API Gateway?"*
> *"What would a disaster recovery setup look like for this?"*

---

## AI History & Contextual Chat

Every AI conversation is saved to the project's **AI History** page. This gives you a searchable log of every diagram the AI generated and every evaluation it gave.

### Open AI History

Toolbar → **AI** dropdown → **History**, or navigate to `/projects/<id>/ai-history`.

### Key features

| Feature | How to use |
|---------|------------|
| **Diagram bubbles** | Each AI response that produced a diagram shows a mini preview. Click **Preview** to see it inline. |
| **Apply a past diagram** | Click **Apply →** on any diagram bubble to load it onto the current canvas (or a new layer). |
| **Maximize preview** | Click the expand icon on a diagram bubble to see it full-size. |
| **Contextual Q&A (RAG)** | The chat on the History page is context-aware: it automatically reads your diagram nodes, version history, and past conversations before responding. Ask it questions about your architecture and it answers with full context. |
| **Attach layer context** | In the layers sidebar, click the **paperclip icon** next to a layer to include it as context for the next question. |

---

## How the AI Understands Your Diagram

When you send a message, the assistant receives:

- **Current layer** — all nodes and edges in the active layer, serialized into a structured format
- **Project context** — recent chat history, published versions, and semantic memories from past conversations (via ChromaDB)
- **Attached layers** — any layers you explicitly attached via the paperclip icon

This means the AI can give accurate, architecture-grounded answers rather than generic advice.

---

## Streaming Responses

AI responses stream token-by-token. You'll see text appear progressively:

- A **thinking animation** shows while the model is processing
- Diagram JSON is stripped from the visible text and applied to the canvas automatically
- You can navigate away from the panel; the stream continues in the background (the browser tab will block unload while streaming)

---

## Extended Thinking

Some features (Security Posture Score, Attack Mind Simulator) offer an **"Extended thinking"** option. This uses Claude's extended thinking mode, which performs more deliberate reasoning before answering — useful for complex security analysis.

Extended thinking takes longer but produces more thorough results. Enable it via the checkbox in the relevant panel's footer.
