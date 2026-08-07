/* =========================================================
   ANDTIX ORGANIZER PORTAL
========================================================= */


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

const listingOptions =
    document.querySelectorAll(
        'input[name="listingType"]'
    );


/* =========================================================
   MESSAGE HELPERS
========================================================= */

function showOrganizerMessage(
    message,
    type = "info"
) {
    submissionMessage.textContent =
        message;

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
   PREVENT PAST EVENT DATES
========================================================= */

function configureMinimumEventDate() {
    const today =
        new Date();

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
   CREATE SUBMISSION OBJECT
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


    const eventDate =
        document
            .getElementById("eventDate")
            .value;


    const eventTime =
        document
            .getElementById("eventTime")
            .value;


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

        venue:
            document
                .getElementById(
                    "eventVenue"
                )
                .value
                .trim(),

        city:
            document
                .getElementById(
                    "eventCity"
                )
                .value
                .trim(),

        country:
            document
                .getElementById(
                    "eventCountry"
                )
                .value
                .trim(),

        eventDate,

        eventTime,

        location:
            `${document
                .getElementById(
                    "eventVenue"
                )
                .value
                .trim()
            }, ${document
                .getElementById(
                    "eventCity"
                )
                .value
                .trim()
            }`,

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
        selectedDateTime <
        new Date()
    ) {
        throw new Error(
            "The event date and time cannot be in the past."
        );
    }


    return true;
}


/* =========================================================
   FORM SUBMISSION
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


            /*
             * For now we verify that the frontend
             * correctly prepares the event.
             *
             * In the next step this object will be
             * POSTed to our AWS Lambda API.
             */

            console.log(
                "AnDTix Organizer Submission:",
                submission
            );


            submitEventButton.disabled =
                true;

            submitEventButton.innerHTML =
                "Preparing Submission...";


            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        700
                    )
            );


            showOrganizerMessage(
                "Event information validated successfully. The AWS submission service is ready to be connected.",
                "success"
            );


        } catch (error) {

            console.error(
                "Organizer submission error:",
                error
            );


            showOrganizerMessage(
                error.message ||
                "Unable to process the event submission.",
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
   INITIALIZE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        configureMinimumEventDate();

        updateTicketPriceState();

    }
);