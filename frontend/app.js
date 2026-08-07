const API_BASE_URL = "https://1y36equfk9.execute-api.us-east-1.amazonaws.com";

/* =========================================================
   DOM ELEMENTS
========================================================= */

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
const heroEventSearch = document.getElementById("heroEventSearch");
const heroLocationSearch = document.getElementById("heroLocationSearch");
const heroSearchButton = document.getElementById("heroSearchButton");
const vendorInterestButton = document.getElementById("vendorInterestButton");
const categoryButtons = document.querySelectorAll(".category-card");

/* =========================================================
   APPLICATION STATE
========================================================= */

let availableEvents = [];
let filteredEvents = [];

/* =========================================================
   HELPERS
========================================================= */

function showMessage(element, message, type = "info") {
    if (!element) return;

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
    if (!element) return;

    element.classList.add("hidden");
    element.textContent = "";

    element.classList.remove(
        "success-message",
        "error-message",
        "info-message"
    );
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "Date TBA";
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

function getEventDate(event) {
    if (event.startDateTime) {
        return formatDate(event.startDateTime);
    }

    if (event.dateLabel) {
        return event.dateLabel;
    }

    return "Date TBA";
}

function normaliseStatus(status) {
    return status
        ? String(status).toUpperCase()
        : "AVAILABLE";
}

function isExternalEvent(event) {
    return (
        event.externalEvent === true ||
        normaliseStatus(event.status) === "EXTERNAL"
    );
}

function detectCategory(event) {
    if (
        event.category &&
        String(event.category).trim()
    ) {
        return String(event.category).trim();
    }

    const content = [
        event.name,
        event.description,
        event.eventType
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (
        content.includes("tech") ||
        content.includes("cloud") ||
        content.includes("software") ||
        content.includes("developer") ||
        content.includes("innovation")
    ) {
        return "Technology";
    }

    if (
        content.includes("music") ||
        content.includes("concert") ||
        content.includes("festival")
    ) {
        return "Music";
    }

    if (
        content.includes("business") ||
        content.includes("conference") ||
        content.includes("networking") ||
        content.includes("summit")
    ) {
        return "Business";
    }

    if (
        content.includes("art") ||
        content.includes("creative") ||
        content.includes("design") ||
        content.includes("cinema") ||
        content.includes("theatre") ||
        content.includes("movie")
    ) {
        return "Arts";
    }

    if (
        content.includes("sport") ||
        content.includes("football") ||
        content.includes("boxing") ||
        content.includes("fitness")
    ) {
        return "Sports";
    }

    if (
        content.includes("food") ||
        content.includes("lifestyle") ||
        content.includes("party") ||
        content.includes("social")
    ) {
        return "Lifestyle";
    }

    return "General";
}

async function readApiResponse(response) {
    const contentType =
        response.headers.get("content-type") || "";

    if (
        contentType.includes("application/json")
    ) {
        return response.json();
    }

    const text = await response.text();

    return {
        message:
            text ||
            "The server returned an unexpected response."
    };
}

/* =========================================================
   LOAD EVENTS FROM AWS
========================================================= */

async function loadEvents() {
    if (eventsLoading) {
        eventsLoading.classList.remove("hidden");
    }

    if (eventsList) {
        eventsList.innerHTML = "";
    }

    hideMessage(eventsError);

    if (refreshEventsButton) {
        refreshEventsButton.disabled = true;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/events`
        );

        const data =
            await readApiResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to retrieve events."
            );
        }

        availableEvents =
            Array.isArray(data.events)
                ? data.events
                : [];

        filteredEvents = [
            ...availableEvents
        ];

        renderEvents(filteredEvents);
        populateEventSelect();

    } catch (error) {
        console.error(
            "Unable to load events:",
            error
        );

        showMessage(
            eventsError,
            error.message ||
            "Unable to connect to the AnDTix API.",
            "error"
        );

    } finally {
        if (eventsLoading) {
            eventsLoading.classList.add("hidden");
        }

        if (refreshEventsButton) {
            refreshEventsButton.disabled = false;
        }
    }
}

/* =========================================================
   EVENT DISPLAY
========================================================= */

function renderEvents(events) {
    if (!eventsList) {
        return;
    }

    eventsList.innerHTML = "";

    if (events.length === 0) {
        eventsList.innerHTML = `
      <div class="status-card">
        No events matched your search.
      </div>
    `;

        return;
    }

    events.forEach((event) => {
        const external =
            isExternalEvent(event);

        const status =
            normaliseStatus(event.status);

        const category =
            detectCategory(event);

        const displayDate =
            getEventDate(event);

        const card =
            document.createElement("article");

        card.className = "event-card";

        const statusBadge =
            external
                ? `
          <span
            class="event-status"
            style="
              background:#fff4d2;
              color:#9a6500;
            "
          >
            EXTERNAL EVENT
          </span>
        `
                : `
          <span
            class="${status === "LIMITED"
                    ? "event-status limited"
                    : "event-status"
                }"
          >
            ${escapeHtml(status)}
          </span>
        `;

        const actionButton =
            external
                ? `
          <button
            type="button"
            class="event-select-button external-event-button"
            data-source-url="${escapeHtml(
                    event.sourceUrl || ""
                )}"
          >
            View Event →
          </button>
        `
                : `
          <button
            type="button"
            class="event-select-button native-event-button"
            data-event-id="${escapeHtml(
                    event.eventId || ""
                )}"
          >
            Get Ticket →
          </button>
        `;

        const sourceLabel =
            external &&
                event.sourceName
                ? `
          <div
            style="
              padding:10px 22px 0;
              color:#8491a4;
              font-size:0.68rem;
            "
          >
            Listed from
            ${escapeHtml(
                    event.sourceName
                )}
          </div>
        `
                : "";

        card.innerHTML = `
      <div class="event-card-top">

        <div>

          <div
            style="
              color:#ea7a19;
              font-size:0.67rem;
              font-weight:900;
              letter-spacing:0.08em;
              margin-bottom:7px;
            "
          >
            ${escapeHtml(
            category.toUpperCase()
        )}
          </div>

          <h3>
            ${escapeHtml(
            event.name ||
            "Untitled Event"
        )}
          </h3>

        </div>

        ${statusBadge}

      </div>

      <div class="event-meta">

        <span>
          📍
          ${escapeHtml(
            event.location ||
            "Location TBA"
        )}
        </span>

        <span>
          📅
          ${escapeHtml(
            displayDate
        )}
        </span>

        ${!external &&
                event.capacity !== undefined
                ? `
              <span>
                👥 Capacity:
                ${escapeHtml(
                    String(
                        event.capacity
                    )
                )}
              </span>
            `
                : ""
            }

      </div>

      ${event.description
                ? `
            <p class="event-description">
              ${escapeHtml(
                    event.description
                )}
            </p>
          `
                : ""
            }

      ${sourceLabel}

      ${actionButton}
    `;

        eventsList.appendChild(card);
    });

    attachNativeEventButtons();
    attachExternalEventButtons();
}

/* =========================================================
   NATIVE ANDTIX EVENT BUTTONS
========================================================= */

function attachNativeEventButtons() {
    document
        .querySelectorAll(
            ".native-event-button"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const eventId =
                        button.dataset.eventId;

                    if (eventSelect) {
                        eventSelect.value =
                            eventId;
                    }

                    const bookingSection =
                        document.querySelector(
                            ".booking-section"
                        );

                    if (bookingSection) {
                        bookingSection
                            .scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });
                    }

                    setTimeout(
                        () => {
                            if (
                                attendeeNameInput
                            ) {
                                attendeeNameInput
                                    .focus();
                            }
                        },
                        500
                    );
                }
            );
        });
}

/* =========================================================
   EXTERNAL EVENT BUTTONS
========================================================= */

function attachExternalEventButtons() {
    document
        .querySelectorAll(
            ".external-event-button"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const sourceUrl =
                        button.dataset
                            .sourceUrl;

                    if (!sourceUrl) {
                        window.alert(
                            "The organizer's booking page is not available yet."
                        );

                        return;
                    }

                    window.open(
                        sourceUrl,
                        "_blank",
                        "noopener,noreferrer"
                    );
                }
            );
        });
}

/* =========================================================
   REGISTRATION DROPDOWN
========================================================= */

function populateEventSelect() {
    if (!eventSelect) {
        return;
    }

    eventSelect.innerHTML = `
    <option value="">
      Select an event
    </option>
  `;

    const nativeEvents =
        availableEvents.filter(
            (event) =>
                !isExternalEvent(event)
        );

    nativeEvents.forEach((event) => {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            event.eventId;

        option.textContent =
            event.name ||
            event.eventId ||
            "Unnamed event";

        eventSelect.appendChild(
            option
        );
    });
}

/* =========================================================
   EVENT SEARCH
========================================================= */

function searchEvents() {
    const searchTerm =
        (
            heroEventSearch?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const locationTerm =
        (
            heroLocationSearch?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    filteredEvents =
        availableEvents.filter(
            (event) => {

                const searchableContent =
                    [
                        event.name,
                        event.description,
                        event.category,
                        event.eventType,
                        event.sourceName
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                const location =
                    String(
                        event.location ||
                        ""
                    ).toLowerCase();

                const matchesSearch =
                    !searchTerm ||
                    searchableContent
                        .includes(
                            searchTerm
                        );

                const matchesLocation =
                    !locationTerm ||
                    location.includes(
                        locationTerm
                    );

                return (
                    matchesSearch &&
                    matchesLocation
                );
            }
        );

    renderEvents(
        filteredEvents
    );

    const eventsSection =
        document.getElementById(
            "events"
        );

    if (eventsSection) {
        eventsSection
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }
}

if (heroSearchButton) {
    heroSearchButton
        .addEventListener(
            "click",
            searchEvents
        );
}

if (heroEventSearch) {
    heroEventSearch
        .addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter"
                ) {
                    event.preventDefault();
                    searchEvents();
                }
            }
        );
}

if (heroLocationSearch) {
    heroLocationSearch
        .addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter"
                ) {
                    event.preventDefault();
                    searchEvents();
                }
            }
        );
}

/* =========================================================
   CATEGORY FILTERS
========================================================= */

categoryButtons.forEach(
    (button) => {

        button.addEventListener(
            "click",
            () => {

                const label =
                    button.querySelector(
                        "strong"
                    );

                const category =
                    label
                        ? label.textContent
                            .trim()
                            .toLowerCase()
                        : "";

                filteredEvents =
                    availableEvents.filter(
                        (event) =>
                            detectCategory(event)
                                .toLowerCase() ===
                            category
                    );

                renderEvents(
                    filteredEvents
                );

                const eventsSection =
                    document.getElementById(
                        "events"
                    );

                if (eventsSection) {
                    eventsSection
                        .scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }
            }
        );
    }
);

/* =========================================================
   REFRESH EVENTS
========================================================= */

if (refreshEventsButton) {
    refreshEventsButton
        .addEventListener(
            "click",
            async () => {

                if (heroEventSearch) {
                    heroEventSearch.value =
                        "";
                }

                if (
                    heroLocationSearch
                ) {
                    heroLocationSearch.value =
                        "";
                }

                await loadEvents();
            }
        );
}

/* =========================================================
   REGISTRATION
========================================================= */

if (registrationForm) {
    registrationForm
        .addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                hideMessage(
                    registrationMessage
                );

                const eventId =
                    (
                        eventSelect?.value ||
                        ""
                    ).trim();

                const attendeeName =
                    (
                        attendeeNameInput
                            ?.value ||
                        ""
                    ).trim();

                const email =
                    (
                        emailInput?.value ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                if (
                    !eventId ||
                    !attendeeName ||
                    !email
                ) {
                    showMessage(
                        registrationMessage,
                        "Please complete all registration fields.",
                        "error"
                    );

                    return;
                }

                const selectedEvent =
                    availableEvents.find(
                        (item) =>
                            item.eventId ===
                            eventId
                    );

                if (
                    selectedEvent &&
                    isExternalEvent(
                        selectedEvent
                    )
                ) {
                    showMessage(
                        registrationMessage,
                        "External events must be booked through the event organizer.",
                        "error"
                    );

                    return;
                }

                if (registerButton) {
                    registerButton.disabled =
                        true;

                    registerButton
                        .innerHTML =
                        "Processing Registration...";
                }

                try {
                    const response =
                        await fetch(
                            `${API_BASE_URL}/register`,
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        eventId,
                                        attendeeName,
                                        email
                                    })
                            }
                        );

                    const data =
                        await readApiResponse(
                            response
                        );

                    if (!response.ok) {
                        throw new Error(
                            data.message ||
                            "Registration could not be completed."
                        );
                    }

                    const registrationId =
                        data.registration
                            ?.registrationId;

                    let successMessage =
                        "Your registration was successful.";

                    if (registrationId) {
                        successMessage +=
                            ` Ticket reference: ${registrationId}`;
                    }

                    showMessage(
                        registrationMessage,
                        successMessage,
                        "success"
                    );

                    if (
                        lookupEmailInput
                    ) {
                        lookupEmailInput.value =
                            email;
                    }

                    registrationForm
                        .reset();

                    await loadRegistrations(
                        email
                    );

                    const ticketsSection =
                        document.getElementById(
                            "tickets"
                        );

                    if (ticketsSection) {
                        ticketsSection
                            .scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });
                    }

                } catch (error) {
                    console.error(
                        "Registration failed:",
                        error
                    );

                    showMessage(
                        registrationMessage,
                        error.message ||
                        "Registration could not be completed.",
                        "error"
                    );

                } finally {
                    if (registerButton) {
                        registerButton.disabled =
                            false;

                        registerButton
                            .innerHTML = `
                Complete Registration
                <span>→</span>
              `;
                    }
                }
            }
        );
}

/* =========================================================
   REGISTRATION LOOKUP
========================================================= */

if (lookupForm) {
    lookupForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                (
                    lookupEmailInput
                        ?.value ||
                    ""
                )
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

            await loadRegistrations(
                email
            );
        }
    );
}

async function loadRegistrations(
    email
) {
    hideMessage(
        lookupMessage
    );

    if (registrationsList) {
        registrationsList.innerHTML = `
      <div class="status-card">
        Loading your tickets...
      </div>
    `;
    }

    try {
        const encodedEmail =
            encodeURIComponent(
                email
            );

        const response =
            await fetch(
                `${API_BASE_URL}/registrations/${encodedEmail}`
            );

        const data =
            await readApiResponse(
                response
            );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to retrieve registrations."
            );
        }

        const registrations =
            Array.isArray(
                data.registrations
            )
                ? data.registrations
                : [];

        renderRegistrations(
            registrations,
            email
        );

    } catch (error) {
        console.error(
            "Unable to retrieve registrations:",
            error
        );

        if (
            registrationsList
        ) {
            registrationsList.innerHTML =
                "";
        }

        showMessage(
            lookupMessage,
            error.message ||
            "Unable to retrieve registrations.",
            "error"
        );
    }
}

/* =========================================================
   DISPLAY TICKETS
========================================================= */

function renderRegistrations(
    registrations,
    email
) {
    if (!registrationsList) {
        return;
    }

    registrationsList.innerHTML =
        "";

    if (
        registrations.length === 0
    ) {
        showMessage(
            lookupMessage,
            "No active tickets were found for this email address.",
            "info"
        );

        return;
    }

    hideMessage(
        lookupMessage
    );

    registrations.forEach(
        (registration) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "registration-item";

            item.innerHTML = `
        <div>

          <h3>
            🎟️
            ${escapeHtml(
                registration.eventName ||
                registration.eventId ||
                "AnDTix Event"
            )}
          </h3>

          <div
            class="registration-details"
          >

            <div>
              Status:
              <strong>
                ${escapeHtml(
                registration.status ||
                "CONFIRMED"
            )}
              </strong>
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
              Ticket Reference:
              ${escapeHtml(
                registration.registrationId ||
                ""
            )}
            </div>

          </div>

        </div>

        <button
          type="button"
          class="cancel-button"
          data-registration-id="${escapeHtml(
                registration.registrationId ||
                ""
            )}"
        >
          Cancel Ticket
        </button>
      `;

            registrationsList
                .appendChild(item);
        }
    );

    document
        .querySelectorAll(
            ".cancel-button"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        const registrationId =
                            button.dataset
                                .registrationId;

                        await cancelRegistration(
                            registrationId,
                            email,
                            button
                        );
                    }
                );
            }
        );
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

    const confirmed =
        window.confirm(
            "Are you sure you want to cancel this ticket?"
        );

    if (!confirmed) {
        return;
    }

    button.disabled = true;

    button.textContent =
        "Cancelling...";

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/registration/${encodeURIComponent(
                    registrationId
                )}`,
                {
                    method: "DELETE"
                }
            );

        const data =
            await readApiResponse(
                response
            );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to cancel registration."
            );
        }

        hideMessage(
            registrationMessage
        );

        await loadRegistrations(
            email
        );

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

        button.textContent =
            "Cancel Ticket";
    }
}

/* =========================================================
   VENDOR / ORGANIZER
========================================================= */

if (vendorInterestButton) {
    vendorInterestButton.addEventListener(
        "click",
        () => {
            window.location.href =
                "organizer.html";
        }
    );
}

/* =========================================================
   INITIAL PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    loadEvents
);