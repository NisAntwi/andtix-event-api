/* =========================================================
   ANDTIX ORGANIZER PORTAL
========================================================= */

const API_BASE_URL =
    "https://1y36equfk9.execute-api.us-east-1.amazonaws.com";


/* =========================================================
   DOM ELEMENTS
========================================================= */

const eventSubmissionForm =
    document.getElementById("eventSubmissionForm");

const submitEventButton =
    document.getElementById("submitEventButton");

const submissionMessage =
    document.getElementById("organizerSubmissionMessage");

const ticketPriceInput =
    document.getElementById("ticketPrice");

const eventDateInput =
    document.getElementById("eventDate");

const pricingOptions =
    document.querySelectorAll(
        'input[name="pricingType"]'
    );


/* =========================================================
   MESSAGE HELPERS
========================================================= */

function showOrganizerMessage(
    message,
    type = "info"
) {
    submissionMessage.textContent = message;

    submissionMessage.classList.remove(
        "hidden",
        "success-message",
        "error-message",
        "info-message"
    );

    if (type === "success") {
        submissionMessage.classList.add(
            "success-message"
        );
    } else if (type === "error") {
        submissionMessage.classList.add(
            "error-message"
        );
    } else {
        submissionMessage.classList.add(
            "info-message"
        );
    }
}


function hideOrganizerMessage() {
    submissionMessage.textContent = "";

    submissionMessage.classList.add(
        "hidden"
    );

    submissionMessage.classList.remove(
        "success-message",
        "error-message",
        "info-message"
    );
}


/* =========================================================
   API RESPONSE HELPER
========================================================= */

async function readApiResponse(response) {
    const contentType =
        response.headers.get("content-type") || "";

    if (
        contentType.includes(
            "application/json"
        )
    ) {
        return response.json();
    }

    const text =
        await response.text();

    return {
        message:
            text ||
            "The server returned an unexpected response."
    };
}


/* =========================================================
   EVENT DATE
========================================================= */

function configureMinimumEventDate() {
    const today = new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
        ).padStart(2, "0");

    eventDateInput.min =
        `${year}-${month}-${day}`;
}


/* =========================================================
   FREE / PAID EVENT
========================================================= */

function updateTicketPriceState() {
    const selectedPricing =
        document.querySelector(
            'input[name="pricingType"]:checked'
        )?.value;

    if (selectedPricing === "FREE") {
        ticketPriceInput.value = "0";

        ticketPriceInput.disabled = true;

        ticketPriceInput.placeholder =
            "Free event";
    } else {
        ticketPriceInput.disabled = false;

        if (
            Number(ticketPriceInput.value) <= 0
        ) {
            ticketPriceInput.value = "";
        }

        ticketPriceInput.placeholder =
            "e.g. 50.00";
    }
}


pricingOptions.forEach(
    (option) => {
        option.addEventListener(
            "change",
            updateTicketPriceState
        );
    }
);


/* =========================================================
   BUILD EVENT SUBMISSION
========================================================= */

function buildEventSubmission() {
    const pricingType =
        document.querySelector(
            'input[name="pricingType"]:checked'
        ).value;

    const listingType =
        document.querySelector(
            'input[name="listingType"]:checked'
        ).value;

    const venue =
        document
            .getElementById("eventVenue")
            .value
            .trim();

    const city =
        document
            .getElementById("eventCity")
            .value
            .trim();

    const country =
        document
            .getElementById("eventCountry")
            .value
            .trim();

    return {
        organizerName:
            document
                .getElementById(
                    "organizerName"
                )
                .value
                .trim(),

        contactPerson:
            document
                .getElementById(
                    "contactPerson"
                )
                .value
                .trim(),

        organizerEmail:
            document
                .getElementById(
                    "organizerEmail"
                )
                .value
                .trim()
                .toLowerCase(),

        organizerPhone:
            document
                .getElementById(
                    "organizerPhone"
                )
                .value
                .trim(),

        eventName:
            document
                .getElementById(
                    "eventName"
                )
                .value
                .trim(),

        description:
            document
                .getElementById(
                    "eventDescription"
                )
                .value
                .trim(),

        category:
            document
                .getElementById(
                    "eventCategory"
                )
                .value,

        venue,

        city,

        country,

        eventDate:
            document
                .getElementById(
                    "eventDate"
                )
                .value,

        eventTime:
            document
                .getElementById(
                    "eventTime"
                )
                .value,

        location:
            `${venue}, ${city}, ${country}`,

        pricingType,

        ticketPrice:
            pricingType === "FREE"
                ? 0
                : Number(
                    ticketPriceInput.value
                ),

        capacity:
            Number(
                document
                    .getElementById(
                        "eventCapacity"
                    )
                    .value
            ),

        listingType,

        source:
            "ORGANIZER_PORTAL",

        status:
            "PENDING_APPROVAL"
    };
}


/* =========================================================
   VALIDATION
========================================================= */

function validateSubmission(data) {
    if (
        data.pricingType === "PAID" &&
        (
            !data.ticketPrice ||
            data.ticketPrice <= 0
        )
    ) {
        throw new Error(
            "Please enter a valid ticket price for the paid event."
        );
    }

    if (
        !data.capacity ||
        data.capacity < 1
    ) {
        throw new Error(
            "Event capacity must be at least 1."
        );
    }

    const selectedDateTime =
        new Date(
            `${data.eventDate}T${data.eventTime}`
        );

    if (
        Number.isNaN(
            selectedDateTime.getTime()
        )
    ) {
        throw new Error(
            "Please enter a valid event date and time."
        );
    }

    if (
        selectedDateTime <= new Date()
    ) {
        throw new Error(
            "The event date and time must be in the future."
        );
    }

    return true;
}


/* =========================================================
   SUBMIT EVENT TO AWS
========================================================= */

eventSubmissionForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        hideOrganizerMessage();

        try {
            const submission =
                buildEventSubmission();

            validateSubmission(
                submission
            );

            submitEventButton.disabled =
                true;

            submitEventButton.innerHTML =
                "Submitting Event...";


            const response =
                await fetch(
                    `${API_BASE_URL}/organizer/events`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                submission
                            )
                    }
                );


            const data =
                await readApiResponse(
                    response
                );


            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to submit the event."
                );
            }


            const submissionId =
                data.submission
                    ?.submissionId;


            const eventName =
                data.submission
                    ?.eventName ||
                submission.eventName;


            let successMessage =
                `${eventName} has been submitted successfully and is awaiting AnDTix approval.`;

            if (submissionId) {
                successMessage +=
                    ` Submission reference: ${submissionId}`;
            }


            showOrganizerMessage(
                successMessage,
                "success"
            );


            /*
             * Clear the form after successful
             * submission.
             */

            eventSubmissionForm.reset();

            document
                .getElementById(
                    "eventCountry"
                )
                .value =
                "Ghana";

            updateTicketPriceState();

            configureMinimumEventDate();


            /*
             * Bring the success message
             * into view.
             */

            submissionMessage
                .scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });


        } catch (error) {
            console.error(
                "Organizer submission error:",
                error
            );

            showOrganizerMessage(
                error.message ||
                "Unable to submit the event. Please try again.",
                "error"
            );

        } finally {
            submitEventButton.disabled =
                false;

            submitEventButton.innerHTML = `
                Submit Event for Review
                <span>→</span>
            `;
        }
    }
);


/* =========================================================
   INITIALIZE ORGANIZER PORTAL
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        configureMinimumEventDate();

        updateTicketPriceState();
    }
);