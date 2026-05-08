const API_BASE = "https://hermes-web.mdi.io/lethe-dashboard";
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const promptEl = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const accessRow = document.getElementById("access-row");
const accessCode = document.getElementById("access-code");
const saveCode = document.getElementById("save-code");
const clearChat = document.getElementById("clear-chat");
const generatePreview = document.getElementById("generate-preview");
const pushProposal = document.getElementById("push-proposal");
const pushStatus = document.getElementById("push-status");
const proposalSummary = document.getElementById("proposal-summary");
const proposalPreview = document.getElementById("proposal-preview");
const refreshVisits = document.getElementById("refresh-visits");
const visitsTotal = document.getElementById("visits-total");
const visitsCountries = document.getElementById("visits-countries");
const countryList = document.getElementById("country-list");

const state = {
    messages: [],
    accessCode: sessionStorage.getItem("letheDashboardAccess") || "",
    latestRequest: "",
    proposalId: ""
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
    state.latestRequest = prompt;
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

generatePreview.addEventListener("click", async () => {
    if (!state.accessCode) {
        setPushStatus("Enter the access code first.", "error");
        accessCode.focus();
        return;
    }

    const request = state.latestRequest || promptEl.value.trim();
    if (!request) {
        setPushStatus("Send or type a change request first.", "error");
        return;
    }

    generatePreview.disabled = true;
    pushProposal.disabled = true;
    generatePreview.textContent = "Generating";
    state.proposalId = "";
    setPushStatus("Generating a preview from the latest request...");

    try {
        const response = await fetch(`${API_BASE}/api/propose`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({ request })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Could not generate preview.");
        }

        state.proposalId = data.id;
        proposalSummary.innerHTML = "";
        const heading = document.createElement("strong");
        heading.textContent = data.summary;
        const list = document.createElement("ul");
        data.operations.forEach((operation) => {
            const item = document.createElement("li");
            item.textContent = operation;
            list.appendChild(item);
        });
        proposalSummary.append(heading, list);
        proposalPreview.srcdoc = data.previewHtml;
        pushProposal.disabled = false;
        setPushStatus("Preview ready. Review it, then push that exact draft live.", "success");
    } catch (error) {
        setPushStatus(error.message, "error");
    } finally {
        generatePreview.disabled = false;
        generatePreview.textContent = "Generate Preview";
    }
});

pushProposal.addEventListener("click", async () => {
    if (!state.proposalId) {
        setPushStatus("Generate a preview first.", "error");
        return;
    }

    pushProposal.disabled = true;
    setPushStatus("Committing the preview to GitHub...");

    try {
        const response = await fetch(`${API_BASE}/api/push-proposal`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Lethe-Access": state.accessCode
            },
            body: JSON.stringify({ proposalId: state.proposalId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Push failed.");
        setPushStatus(`Pushed preview live. Commit ${data.commit}. Hostinger will deploy it shortly.`, "success");
        addMessage("assistant", `I pushed the reviewed preview live. Commit: ${data.commit}.`);
        state.proposalId = "";
    } catch (error) {
        setPushStatus(error.message, "error");
        pushProposal.disabled = false;
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
