const API_BASE_URL =
    "https://1y36equfk9.execute-api.us-east-1.amazonaws.com";

const eventsList = document.getElementById("eventsList");
const eventsLoading = document.getElementById("eventsLoading");
const eventsError = document.getElementById("eventsError");
const refreshEventsButton = document.getElementById("refreshEventsButton");

const eventSelect = document.getElementById("eventSelect");
const registrationForm = document.getElementById("registrationForm");
const attendeeNameInput = document.getElementById("attendeeName");
const emailInput = document.getElementById("email");
const registerButton = document.getElementById("registerButton");
const registrationMessage = document.getElementById("registrationMessage");

const lookupForm = document.getElementById("lookupForm");
const lookupEmailInput = document.getElementById("lookupEmail");
const lookupMessage = document.getElementById("lookupMessage");
const registrationsList = document.getElementById("registrationsList");

let availableEvents = [];


/* =========================================================
   HELPERS
========================================================= */

function showMessage(element, message, type = "info") {
    element.textContent = message;

    element.classList.remove(
        "hidden",
        "success-message",
        "error-message",
        "info-message"
    );

    if (type === "success") {
        element.classList.add("success-message");
    } else if (type === "error") {
        element.classList.add("error-message");
    } else {
        element.classList.add("info-message");
    }
}


function hideMessage(element) {
    element.classList.add("hidden");
    element.textContent = "";
}


function formatDate(dateValue) {
    if (!dateValue) {
        return "Date not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}


function normaliseStatus(status) {
    if (!status) {
        return "AVAILABLE";
    }

    return String(status).toUpperCase();
}


async function readApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();

    return {
        message: text || "The server returned an unexpected response."
    };
}


/* =========================================================
   EVENTS
========================================================= */

async function loadEvents() {
    eventsLoading.classList.remove("hidden");
    eventsList.innerHTML = "";
    hideMessage(eventsError);

    refreshEventsButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/events`);

        const data = await readApiResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to retrieve events."
            );
        }

        availableEvents = Array.isArray(data.events)
            ? data.events
            : [];

        renderEvents();
        populateEventSelect();

    } catch (error) {
        console.error("Unable to load events:", error);

        showMessage(
            eventsError,
            error.message ||
            "Unable to connect to the AnDTix API.",
            "error"
        );

    } finally {
        eventsLoading.classList.add("hidden");
        refreshEventsButton.disabled = false;
    }
}


function renderEvents() {
    eventsList.innerHTML = "";

    if (availableEvents.length === 0) {
        eventsList.innerHTML = `
            <div class="status-card">
                No events are currently available.
            </div>
        `;
        return;
    }

    availableEvents.forEach((event) => {
        const status = normaliseStatus(event.status);

        const statusClass =
            status === "LIMITED"
                ? "event-status limited"
                : "event-status";

        const card = document.createElement("article");
        card.className = "event-card";

        card.innerHTML = `
            <div class="event-card-top">
                <div>
                    <h3>${escapeHtml(event.name || "Untitled Event")}</h3>
                </div>

                <span class="${statusClass}">
                    ${escapeHtml(status)}
                </span>
            </div>

            <div class="event-meta">
                <span>
                    📍 ${escapeHtml(event.location || "Location TBA")}
                </span>

                <span>
                    📅 ${escapeHtml(formatDate(event.startDateTime))}
                </span>

                ${event.capacity !== undefined
                ? `<span>👥 Capacity: ${escapeHtml(
                    String(event.capacity)
                )}</span>`
                : ""
            }
            </div>

            ${event.description
                ? `
                        <p class="event-description">
                            ${escapeHtml(event.description)}
                        </p>
                    `
                : ""
            }

            <button
                type="button"
                class="event-select-button"
                data-event-id="${escapeHtml(event.eventId || "")}"
            >
                Register for this event
            </button>
        `;

        eventsList.appendChild(card);
    });

    document
        .querySelectorAll(".event-select-button")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const eventId = button.dataset.eventId;

                eventSelect.value = eventId;

                document
                    .querySelector(".registration-panel")
                    .scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                attendeeNameInput.focus();
            });
        });
}


function populateEventSelect() {
    eventSelect.innerHTML = `
        <option value="">
            Select an event
        </option>
    `;

    availableEvents.forEach((event) => {
        const option = document.createElement("option");

        option.value = event.eventId;
        option.textContent =
            event.name || event.eventId || "Unnamed event";

        eventSelect.appendChild(option);
    });
}


/* =========================================================
   REGISTRATION
========================================================= */

registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    hideMessage(registrationMessage);

    const eventId = eventSelect.value.trim();
    const attendeeName = attendeeNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();

    if (!eventId || !attendeeName || !email) {
        showMessage(
            registrationMessage,
            "Please complete all registration fields.",
            "error"
        );

        return;
    }

    registerButton.disabled = true;
    registerButton.textContent = "Registering...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    eventId,
                    attendeeName,
                    email
                })
            }
        );

        const data = await readApiResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Registration could not be completed."
            );
        }

        const registrationId =
            data.registration?.registrationId;

        let successMessage =
            data.message ||
            "Registration completed successfully.";

        if (registrationId) {
            successMessage +=
                ` Registration ID: ${registrationId}`;
        }

        showMessage(
            registrationMessage,
            successMessage,
            "success"
        );

        lookupEmailInput.value = email;

        registrationForm.reset();

    } catch (error) {
        console.error("Registration failed:", error);

        showMessage(
            registrationMessage,
            error.message ||
            "Registration could not be completed.",
            "error"
        );

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = "Register Now";
    }
});


/* =========================================================
   REGISTRATION LOOKUP
========================================================= */

lookupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = lookupEmailInput.value
        .trim()
        .toLowerCase();

    if (!email) {
        showMessage(
            lookupMessage,
            "Please enter an email address.",
            "error"
        );

        return;
    }

    await loadRegistrations(email);
});


async function loadRegistrations(email) {
    hideMessage(lookupMessage);

    registrationsList.innerHTML = `
        <div class="status-card">
            Loading registrations...
        </div>
    `;

    try {
        const encodedEmail = encodeURIComponent(email);

        const response = await fetch(
            `${API_BASE_URL}/registrations/${encodedEmail}`
        );

        const data = await readApiResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to retrieve registrations."
            );
        }

        const registrations =
            Array.isArray(data.registrations)
                ? data.registrations
                : [];

        renderRegistrations(registrations, email);

    } catch (error) {
        console.error(
            "Unable to retrieve registrations:",
            error
        );

        registrationsList.innerHTML = "";

        showMessage(
            lookupMessage,
            error.message ||
            "Unable to retrieve registrations.",
            "error"
        );
    }
}


function renderRegistrations(registrations, email) {
    registrationsList.innerHTML = "";

    if (registrations.length === 0) {
        showMessage(
            lookupMessage,
            "No active registrations were found for this email address.",
            "info"
        );

        return;
    }

    hideMessage(lookupMessage);

    registrations.forEach((registration) => {
        const item = document.createElement("div");

        item.className = "registration-item";

        item.innerHTML = `
            <div>
                <h3>
                    ${escapeHtml(
            registration.eventName ||
            registration.eventId ||
            "Event Registration"
        )}
                </h3>

                <div class="registration-details">
                    <div>
                        Status:
                        ${escapeHtml(
            registration.status || "CONFIRMED"
        )}
                    </div>

                    <div>
                        Registered:
                        ${escapeHtml(
            formatDate(
                registration.registeredAt
            )
        )}
                    </div>

                    <div>
                        Registration ID:
                        ${escapeHtml(
            registration.registrationId || ""
        )}
                    </div>
                </div>
            </div>

            <button
                type="button"
                class="cancel-button"
                data-registration-id="${escapeHtml(
            registration.registrationId || ""
        )}"
            >
                Cancel Registration
            </button>
        `;

        registrationsList.appendChild(item);
    });

    document
        .querySelectorAll(".cancel-button")
        .forEach((button) => {
            button.addEventListener("click", async () => {
                const registrationId =
                    button.dataset.registrationId;

                await cancelRegistration(
                    registrationId,
                    email,
                    button
                );
            });
        });
}


/* =========================================================
   CANCEL REGISTRATION
========================================================= */

async function cancelRegistration(
    registrationId,
    email,
    button
) {
    if (!registrationId) {
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to cancel this registration?"
    );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent = "Cancelling...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/registration/${encodeURIComponent(
                registrationId
            )}`,
            {
                method: "DELETE"
            }
        );

        const data = await readApiResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to cancel registration."
            );
        }

        showMessage(
            lookupMessage,
            data.message ||
            "Registration cancelled successfully.",
            "success"
        );

        await loadRegistrations(email);

    } catch (error) {
        console.error(
            "Unable to cancel registration:",
            error
        );

        showMessage(
            lookupMessage,
            error.message ||
            "Unable to cancel registration.",
            "error"
        );

        button.disabled = false;
        button.textContent = "Cancel Registration";
    }
}


/* =========================================================
   BASIC HTML ESCAPING
========================================================= */

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   EVENTS
========================================================= */

refreshEventsButton.addEventListener(
    "click",
    loadEvents
);


/* =========================================================
   INITIAL PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    loadEvents
);