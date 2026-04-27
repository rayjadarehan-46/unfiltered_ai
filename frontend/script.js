const API_BASE = "http://localhost:8000";

let sessionId = null;

// ── AUTO-RESIZE TEXTAREA ──
const textarea = document.getElementById("userInput");
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
});

// ── ENTER TO SEND ──
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── CREATE SESSION ON LOAD ──
window.addEventListener("DOMContentLoaded", () => {
  createSession();
});

document.getElementById("newChatBtn").addEventListener("click", () => {
  createSession();
  clearMessages();
});

async function createSession() {
  setStatus("loading", "Starting session...");
  try {
    const res = await fetch(`${API_BASE}/session`, { method: "POST" });
    const data = await res.json();
    sessionId = data.session_id;
    document.getElementById("sessionIdDisplay").textContent =
      sessionId.slice(0, 8) + "...";
    setStatus("online", "Mirror is active");
  } catch (err) {
    setStatus("", "Backend not reachable — is FastAPI running?");
    console.error(err);
  }
}

// ── SEND MESSAGE ──
async function sendMessage() {
  const input = textarea.value.trim();
  if (!input || !sessionId) return;

  hideWelcome();
  addMessage("user", input);
  textarea.value = "";
  textarea.style.height = "auto";

  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;
  setStatus("loading", "Processing...");

  const typingEl = showTyping();

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: input }),
    });

    const data = await res.json();
    removeTyping(typingEl);

    if (res.ok) {
      addMessage("assistant", data.reply);
      setStatus("online", "Mirror is active");
    } else {
      addMessage("assistant", `⚠ Error: ${data.detail || "Something went wrong."}`);
      setStatus("online", "Mirror is active");
    }
  } catch (err) {
    removeTyping(typingEl);
    addMessage("assistant", "⚠ Could not reach the backend. Make sure FastAPI is running on port 8000.");
    setStatus("", "Connection error");
  }

  sendBtn.disabled = false;
  textarea.focus();
}

// ── ADD MESSAGE TO UI ──
function addMessage(role, content) {
  const messages = document.getElementById("messages");

  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "U" : "◈";

  const body = document.createElement("div");
  body.className = "msg-body";

  const roleLabel = document.createElement("div");
  roleLabel.className = "msg-role";
  roleLabel.textContent = role === "user" ? "YOU" : "UNFILTERED AI";

  const contentEl = document.createElement("div");
  contentEl.className = "msg-content";
  contentEl.textContent = content;

  body.appendChild(roleLabel);
  body.appendChild(contentEl);
  msg.appendChild(avatar);
  msg.appendChild(body);
  messages.appendChild(msg);

  messages.scrollTop = messages.scrollHeight;
}

// ── TYPING INDICATOR ──
function showTyping() {
  const messages = document.getElementById("messages");

  const wrapper = document.createElement("div");
  wrapper.className = "msg assistant";
  wrapper.id = "typingWrapper";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "◈";

  const body = document.createElement("div");
  body.className = "msg-body";

  const roleLabel = document.createElement("div");
  roleLabel.className = "msg-role";
  roleLabel.textContent = "UNFILTERED AI";

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    indicator.appendChild(dot);
  }

  body.appendChild(roleLabel);
  body.appendChild(indicator);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ── STATUS ──
function setStatus(type, text) {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusText");
  dot.className = "status-dot " + type;
  label.textContent = text;
}

// ── EXAMPLE PROMPTS ──
function fillPrompt(el) {
  textarea.value = el.textContent;
  textarea.focus();
  textarea.dispatchEvent(new Event("input"));
}

// ── HELPERS ──
function hideWelcome() {
  const w = document.getElementById("welcomeScreen");
  if (w) w.remove();
}

function clearMessages() {
  const messages = document.getElementById("messages");
  messages.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="welcome-icon">◈</div>
      <h1 class="welcome-title">THE MIRROR IS READY</h1>
      <p class="welcome-desc">
        Ask anything. Get the unfiltered truth.<br/>
        Career. Relationships. Finance. Health. Life decisions.
      </p>
      <div class="example-prompts">
        <div class="example" onclick="fillPrompt(this)">Is my startup idea actually good?</div>
        <div class="example" onclick="fillPrompt(this)">Why am I not getting better at coding?</div>
        <div class="example" onclick="fillPrompt(this)">I keep failing at my goals. What's wrong?</div>
      </div>
    </div>`;
}