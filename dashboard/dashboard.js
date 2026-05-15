const API_BASE = "https://hermes-web.mdi.io/lethe-dashboard";
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const promptEl = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const accessRow = document.getElementById("access-row");
const accessCode = document.getElementById("access-code");
const saveCode = document.getElementById("save-code");
const rememberRow = document.getElementById("remember-row");
const rememberAccess = document.getElementById("remember-access");
const clearChat = document.getElementById("clear-chat");
const generatePreview = document.getElementById("generate-preview");
const pushProposal = document.getElementById("push-proposal");
const proposalPanel = document.getElementById("proposal-panel");
const pushStatus = document.getElementById("push-status");
const proposalSummary = document.getElementById("proposal-summary");
const proposalPreview = document.getElementById("proposal-preview");
const imageUpload = document.getElementById("image-upload");
const uploadPreview = document.getElementById("upload-preview");
const refreshVisits = document.getElementById("refresh-visits");
const visitsTotal = document.getElementById("visits-total");
const visitsCountries = document.getElementById("visits-countries");
const countryList = document.getElementById("country-list");
const visitorMapDots = document.getElementById("visitor-map-dots");
const visitorMapEmpty = document.getElementById("visitor-map-empty");

const rememberedAccess = localStorage.getItem("letheDashboardAccess") || sessionStorage.getItem("letheDashboardAccess") || "";

const countryCoordinates = {
    "United States": [-98, 39], US: [-98, 39],
    Canada: [-106, 56], CA: [-106, 56],
    Mexico: [-102, 23], MX: [-102, 23],
    Brazil: [-52, -10], BR: [-52, -10],
    Argentina: [-64, -34], AR: [-64, -34],
    "United Kingdom": [-2, 54], GB: [-2, 54], UK: [-2, 54],
    Ireland: [-8, 53], IE: [-8, 53],
    France: [2, 46], FR: [2, 46],
    Germany: [10, 51], DE: [10, 51],
    Netherlands: [5, 52], NL: [5, 52],
    Spain: [-4, 40], ES: [-4, 40],
    Italy: [12, 43], IT: [12, 43],
    Poland: [19, 52], PL: [19, 52],
    Ukraine: [31, 49], UA: [31, 49],
    Russia: [90, 61], RU: [90, 61],
    Turkey: [35, 39], TR: [35, 39],
    Israel: [35, 31], IL: [35, 31],
    India: [78, 22], IN: [78, 22],
    China: [104, 35], CN: [104, 35],
    Japan: [138, 37], JP: [138, 37],
    "South Korea": [128, 36], KR: [128, 36],
    Australia: [134, -25], AU: [134, -25],
    "New Zealand": [172, -42], NZ: [172, -42],
    "South Africa": [24, -29], ZA: [24, -29],
    Nigeria: [8, 9], NG: [8, 9],
    Egypt: [30, 27], EG: [30, 27]
};

const state = {
    messages: [],
    accessCode: rememberedAccess,
    latestRequest: "",
    proposalId: "",
    uploadedImage: null
};

function setDashboardUnlocked(isUnlocked) {
    accessRow.hidden = isUnlocked;
    rememberRow.hidden = isUnlocked;
    composer.hidden = !isUnlocked;
    proposalPanel.hidden = !isUnlocked;
    uploadPreview.hidden = !isUnlocked || !state.uploadedImage;
}

setDashboardUnlocked(false);

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

function renderUploadedImage() {
    uploadPreview.innerHTML = "";
    if (!state.uploadedImage) {
        uploadPreview.hidden = true;
        return;
    }

    const image = document.createElement("img");
    image.src = state.uploadedImage.dataUrl;
    image.alt = "";
    const label = document.createElement("span");
    label.textContent = `Attached: ${state.uploadedImage.name}`;
    uploadPreview.append(image, label);
    uploadPreview.hidden = false;
}

async function unlockDashboard(code, { silent = false } = {}) {
    const response = await fetch(`${API_BASE}/api/visits`, {
        headers: { "X-Lethe-Access": code }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Access code did not work.");

    state.accessCode = code;
    if (rememberAccess.checked) {
        localStorage.setItem("letheDashboardAccess", state.accessCode);
        sessionStorage.removeItem("letheDashboardAccess");
    } else {
        sessionStorage.setItem("letheDashboardAccess", state.accessCode);
        localStorage.removeItem("letheDashboardAccess");
    }
    setDashboardUnlocked(true);
    renderVisits(data);
    if (!silent) promptEl.focus();
}

saveCode.addEventListener("click", async () => {
    const code = accessCode.value.trim();
    if (!code) return;

    saveCode.disabled = true;
    saveCode.textContent = "Checking";

    try {
        await unlockDashboard(code);
    } catch (error) {
        sessionStorage.removeItem("letheDashboardAccess");
        localStorage.removeItem("letheDashboardAccess");
        state.accessCode = "";
        setDashboardUnlocked(false);
        addMessage("assistant", error.message, true);
        accessCode.focus();
    } finally {
        saveCode.disabled = false;
        saveCode.textContent = "Unlock";
    }
});

clearChat.addEventListener("click", () => {
    state.messages = [];
    messagesEl.innerHTML = "";
    addMessage("assistant", "Fresh page. What change should we shape next?");
});

imageUpload.addEventListener("change", () => {
    const file = imageUpload.files[0];
    state.uploadedImage = null;

    if (!file) {
        renderUploadedImage();
        return;
    }

    if (!file.type.startsWith("image/")) {
        setPushStatus("Attach an image file: JPG, PNG, WEBP, or GIF.", "error");
        imageUpload.value = "";
        renderUploadedImage();
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setPushStatus("Use an image under 5 MB for now.", "error");
        imageUpload.value = "";
        renderUploadedImage();
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
        state.uploadedImage = {
            name: file.name,
            type: file.type,
            dataUrl: reader.result
        };
        renderUploadedImage();
        setPushStatus("Image attached. Describe where it should go, then Generate Preview.", "success");
    });
    reader.readAsDataURL(file);
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
            body: JSON.stringify({
                request,
                uploadedImage: state.uploadedImage
            })
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

        renderVisits(data);
    } catch (error) {
        countryList.innerHTML = "";
        const row = document.createElement("div");
        row.className = "country-row";
        row.textContent = error.message;
        countryList.appendChild(row);
    }
}

function renderVisits(data) {
    visitsTotal.textContent = data.totalVisits;
    visitsCountries.textContent = data.countries.length;
    countryList.innerHTML = "";
    renderVisitorMap(data.countries);

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
}

function coordinateToPoint(lon, lat) {
    return {
        x: ((lon + 180) / 360) * 960,
        y: ((90 - lat) / 180) * 500
    };
}

function getCountryCoordinate(country) {
    const name = country.country || "";
    return countryCoordinates[name] || countryCoordinates[name.toUpperCase()] || null;
}

function renderVisitorMap(countries) {
    visitorMapDots.innerHTML = "";
    const mapped = countries
        .map((country) => ({ ...country, coordinate: getCountryCoordinate(country) }))
        .filter((country) => country.coordinate);

    visitorMapEmpty.hidden = mapped.length > 0;

    if (!mapped.length) return;

    const maxCount = Math.max(...mapped.map((country) => country.count));
    mapped.slice(0, 24).forEach((country) => {
        const [lon, lat] = country.coordinate;
        const point = coordinateToPoint(lon, lat);
        const radius = 5 + Math.sqrt(country.count / maxCount) * 14;

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${country.country}: ${country.count} visits`;

        const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        halo.setAttribute("class", "visitor-halo");
        halo.setAttribute("cx", point.x);
        halo.setAttribute("cy", point.y);
        halo.setAttribute("r", radius * 1.9);

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("class", "visitor-dot");
        dot.setAttribute("cx", point.x);
        dot.setAttribute("cy", point.y);
        dot.setAttribute("r", radius);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "visitor-label");
        label.setAttribute("x", point.x + radius + 5);
        label.setAttribute("y", point.y + 4);
        label.textContent = country.country.length > 14 ? country.country.slice(0, 12) : country.country;

        group.append(title, halo, dot, label);
        visitorMapDots.appendChild(group);
    });
}

refreshVisits.addEventListener("click", loadVisits);

if (state.accessCode) {
    accessCode.value = state.accessCode;
    unlockDashboard(state.accessCode, { silent: true }).catch(() => {
        sessionStorage.removeItem("letheDashboardAccess");
        localStorage.removeItem("letheDashboardAccess");
        state.accessCode = "";
        accessCode.value = "";
        setDashboardUnlocked(false);
    });
}
