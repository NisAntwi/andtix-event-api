import json
import logging
import os
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

EVENT_SUBMISSIONS_TABLE = os.environ.get("EVENT_SUBMISSIONS_TABLE", "")


def create_response(
    status_code: int,
    body: dict[str, Any],
) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def lambda_handler(
    event: dict[str, Any],
    context: Any,
) -> dict[str, Any]:
    del context

    if not EVENT_SUBMISSIONS_TABLE:
        logger.error("EVENT_SUBMISSIONS_TABLE environment variable is missing.")

        return create_response(
            500,
            {"message": "Event submission service is not configured."},
        )

    try:
        request_context = event.get("requestContext", {})
        http_context = request_context.get("http", {})

        method = http_context.get(
            "method",
            event.get("httpMethod", ""),
        )

        if method == "OPTIONS":
            return create_response(
                200,
                {"message": "CORS preflight successful."},
            )

        body = event.get("body")

        if not body:
            return create_response(
                400,
                {"message": "Request body is required."},
            )

        if isinstance(body, str):
            body = json.loads(body)

        required_fields = [
            "organizerName",
            "contactPerson",
            "organizerEmail",
            "organizerPhone",
            "eventName",
            "description",
            "category",
            "venue",
            "city",
            "country",
            "eventDate",
            "eventTime",
            "pricingType",
            "capacity",
            "listingType",
        ]

        missing_fields = [field for field in required_fields if body.get(field) in (None, "")]

        if missing_fields:
            return create_response(
                400,
                {"message": ("Missing required fields: " + ", ".join(missing_fields))},
            )

        organizer_email = str(body["organizerEmail"]).strip().lower()

        pricing_type = str(body["pricingType"]).strip().upper()

        listing_type = str(body["listingType"]).strip().upper()

        if pricing_type not in {
            "FREE",
            "PAID",
        }:
            return create_response(
                400,
                {"message": ("pricingType must be FREE or PAID.")},
            )

        if listing_type not in {
            "STANDARD",
            "FEATURED",
        }:
            return create_response(
                400,
                {"message": ("listingType must be STANDARD or FEATURED.")},
            )

        try:
            capacity = int(body["capacity"])
        except (TypeError, ValueError):
            return create_response(
                400,
                {"message": ("Event capacity must be a valid number.")},
            )

        if capacity < 1:
            return create_response(
                400,
                {"message": ("Event capacity must be at least 1.")},
            )

        ticket_price = Decimal("0")

        if pricing_type == "PAID":
            try:
                ticket_price = Decimal(str(body.get("ticketPrice", "0")))
            except Exception:
                return create_response(
                    400,
                    {"message": ("Ticket price must be a valid number.")},
                )

            if ticket_price <= 0:
                return create_response(
                    400,
                    {"message": ("Paid events must have a ticket price greater than 0.")},
                )

        try:
            event_datetime = datetime.fromisoformat(f"{body['eventDate']}T{body['eventTime']}")

            if event_datetime <= datetime.now():
                return create_response(
                    400,
                    {"message": ("Event date and time must be in the future.")},
                )

        except ValueError:
            return create_response(
                400,
                {"message": ("Invalid event date or time.")},
            )

        submission_id = str(uuid.uuid4())

        submitted_at = datetime.now(UTC).isoformat()

        event_location = (
            f"{str(body['venue']).strip()}, "
            f"{str(body['city']).strip()}, "
            f"{str(body['country']).strip()}"
        )

        item = {
            "submissionId": submission_id,
            "organizerName": str(body["organizerName"]).strip(),
            "contactPerson": str(body["contactPerson"]).strip(),
            "organizerEmail": organizer_email,
            "organizerPhone": str(body["organizerPhone"]).strip(),
            "eventName": str(body["eventName"]).strip(),
            "description": str(body["description"]).strip(),
            "category": str(body["category"]).strip(),
            "venue": str(body["venue"]).strip(),
            "city": str(body["city"]).strip(),
            "country": str(body["country"]).strip(),
            "location": event_location,
            "eventDate": str(body["eventDate"]),
            "eventTime": str(body["eventTime"]),
            "pricingType": pricing_type,
            "ticketPrice": ticket_price,
            "capacity": capacity,
            "listingType": listing_type,
            "status": "PENDING_APPROVAL",
            "source": "ORGANIZER_PORTAL",
            "submittedAt": submitted_at,
        }

        table = dynamodb.Table(EVENT_SUBMISSIONS_TABLE)

        table.put_item(
            Item=item,
            ConditionExpression=("attribute_not_exists(submissionId)"),
        )

        logger.info(
            "Organizer event submitted: %s",
            submission_id,
        )

        return create_response(
            201,
            {
                "message": ("Event submitted successfully and is awaiting approval."),
                "submission": {
                    "submissionId": submission_id,
                    "eventName": item["eventName"],
                    "status": "PENDING_APPROVAL",
                    "listingType": listing_type,
                    "submittedAt": submitted_at,
                },
            },
        )

    except json.JSONDecodeError:
        return create_response(
            400,
            {"message": "Invalid JSON request body."},
        )

    except ClientError as error:
        logger.exception("DynamoDB error while submitting event.")

        return create_response(
            500,
            {
                "message": ("Unable to save the event submission."),
                "error": error.response["Error"].get(
                    "Code",
                    "DynamoDBError",
                ),
            },
        )

    except Exception:
        logger.exception("Unexpected organizer submission error.")

        return create_response(
            500,
            {"message": ("An unexpected error occurred while submitting the event.")},
        )
