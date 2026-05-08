const API_BASE = "https://hermes-web.mdi.io/lethe-dashboard";
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const promptEl = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const accessRow = document.getElementById("access-row");
const accessCode = document.getElementById("access-code");
const saveCode = document.getElementById("save-code");
const clearChat = document.getElementById("clear-chat");

const state = {
    messages: [],
    accessCode: sessionStorage.getItem("letheDashboardAccess") || ""
};

if (state.accessCode) {
    accessRow.style.display = "none";
}

function addMessage(role, text, isError = false) {
    state.messages.push({ role, content: text });
    const article = document.createElement("article");
    article.className = `message ${role}${isError ? " error" : ""}`;
    text.split("\n\n").forEach((part) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = part;
        article.appendChild(paragraph);
    });
    messagesEl.appendChild(article);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBusy(isBusy) {
    sendButton.disabled = isBusy;
    promptEl.disabled = isBusy;
    sendButton.textContent = isBusy ? "Thinking" : "Send";
}

saveCode.addEventListener("click", () => {
    state.accessCode = accessCode.value.trim();
    if (!state.accessCode) return;
    sessionStorage.setItem("letheDashboardAccess", state.accessCode);
    accessRow.style.display = "none";
    promptEl.focus();
});

clearChat.addEventListener("click", () => {
    state.messages = [];
    messagesEl.innerHTML = "";
    addMessage("assistant", "Fresh page. What change should we shape next?");
});

composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = promptEl.value.trim();
    if (!prompt) return;

    if (!state.accessCode) {
        addMessage("assistant", "Enter the access code first, then send the note again.", true);
        accessCode.focus();
        return;
    }

    promptEl.value = "";
    addMessage("user", prompt);
    setBusy(true);

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({ messages: state.messages.slice(-12) })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "The dashboard service did not answer.");
        }

        addMessage("assistant", data.reply);
    } catch (error) {
        addMessage("assistant", error.message, true);
    } finally {
        setBusy(false);
        promptEl.focus();
    }
});
