const API_BASE = "https://hermes-web.mdi.io/lethe-dashboard";
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const promptEl = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const accessRow = document.getElementById("access-row");
const accessCode = document.getElementById("access-code");
const saveCode = document.getElementById("save-code");
const clearChat = document.getElementById("clear-chat");
const pushForm = document.getElementById("push-form");
const pushFile = document.getElementById("push-file");
const pushFind = document.getElementById("push-find");
const pushReplace = document.getElementById("push-replace");
const pushMessage = document.getElementById("push-message");
const pushConfirm = document.getElementById("push-confirm");
const pushLive = document.getElementById("push-live");
const pushStatus = document.getElementById("push-status");
const refreshVisits = document.getElementById("refresh-visits");
const visitsTotal = document.getElementById("visits-total");
const visitsCountries = document.getElementById("visits-countries");
const countryList = document.getElementById("country-list");

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

function setPushStatus(text, type = "") {
    pushStatus.textContent = text;
    pushStatus.className = `push-status ${type}`.trim();
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

pushForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.accessCode) {
        setPushStatus("Enter the access code first.", "error");
        accessCode.focus();
        return;
    }

    if (!pushConfirm.checked) {
        setPushStatus("Confirm that you reviewed the replacement before pushing.", "error");
        return;
    }

    pushLive.disabled = true;
    setPushStatus("Pushing to GitHub. Hostinger will deploy after the commit...");

    try {
        const response = await fetch(`${API_BASE}/api/push-live`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({
                file: pushFile.value,
                find: pushFind.value,
                replace: pushReplace.value,
                message: pushMessage.value
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Push failed.");
        }

        setPushStatus(`Live push started. Commit ${data.commit} replaces ${data.replacements} match in ${data.file}.`, "success");
        addMessage("assistant", `I pushed that exact replacement live. Commit: ${data.commit}. Hostinger should deploy it in a moment.`);
        pushConfirm.checked = false;
    } catch (error) {
        setPushStatus(error.message, "error");
    } finally {
        pushLive.disabled = false;
    }
});

async function loadVisits() {
    if (!state.accessCode) return;

    try {
        const response = await fetch(`${API_BASE}/api/visits`, {
            headers: { "X-Lethe-Access": state.accessCode }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load visits.");

        visitsTotal.textContent = data.totalVisits;
        visitsCountries.textContent = data.countries.length;
        countryList.innerHTML = "";

        if (!data.countries.length) {
            const empty = document.createElement("div");
            empty.className = "country-row";
            empty.textContent = "No visits recorded yet.";
            countryList.appendChild(empty);
            return;
        }

        data.countries.slice(0, 8).forEach((country) => {
            const row = document.createElement("div");
            row.className = "country-row";
            const name = document.createElement("span");
            name.textContent = country.country;
            const count = document.createElement("span");
            count.textContent = country.count;
            row.append(name, count);
            countryList.appendChild(row);
        });
    } catch (error) {
        countryList.innerHTML = "";
        const row = document.createElement("div");
        row.className = "country-row";
        row.textContent = error.message;
        countryList.appendChild(row);
    }
}

refreshVisits.addEventListener("click", loadVisits);

if (state.accessCode) {
    loadVisits();
}
