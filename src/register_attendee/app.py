import json
import logging
import os
import re
from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, uuid5

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

dynamodb = boto3.resource("dynamodb")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def parse_request(event: dict[str, Any]) -> dict[str, str]:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError as error:
        raise ValueError("Request body must contain valid JSON.") from error

    if not isinstance(body, dict):
        raise ValueError("Request body must be a JSON object.")

    required_fields = ("eventId", "attendeeName", "email")
    missing_fields = [
        field
        for field in required_fields
        if not isinstance(body.get(field), str) or not body[field].strip()
    ]

    if missing_fields:
        raise ValueError(f"Missing or invalid required fields: {', '.join(missing_fields)}.")

    email = body["email"].strip().lower()

    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("A valid email address is required.")

    return {
        "eventId": body["eventId"].strip(),
        "attendeeName": body["attendeeName"].strip(),
        "email": email,
    }


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del context

    try:
        request = parse_request(event)

        events_table = dynamodb.Table(os.environ["EVENTS_TABLE"])
        registrations_table = dynamodb.Table(os.environ["REGISTRATIONS_TABLE"])

        event_result = events_table.get_item(Key={"eventId": request["eventId"]})
        selected_event = event_result.get("Item")

        if not selected_event:
            return create_response(
                404,
                {"message": "The requested event was not found."},
            )

        registration_id = str(
            uuid5(
                NAMESPACE_URL,
                f"andtix:{request['eventId']}:{request['email']}",
            )
        )

        registration = {
            "registrationId": registration_id,
            "eventId": request["eventId"],
            "eventName": selected_event.get("name", "AnDTix Event"),
            "attendeeName": request["attendeeName"],
            "email": request["email"],
            "status": "CONFIRMED",
            "registeredAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        }

        registrations_table.put_item(
            Item=registration,
            ConditionExpression="attribute_not_exists(registrationId)",
        )

        logger.info(
            "Created registration %s for event %s",
            registration_id,
            request["eventId"],
        )

        return create_response(
            201,
            {
                "message": "Registration completed successfully.",
                "registration": registration,
            },
        )

    except ValueError as error:
        return create_response(400, {"message": str(error)})

    except ClientError as error:
        error_code = error.response.get("Error", {}).get("Code")

        if error_code == "ConditionalCheckFailedException":
            return create_response(
                409,
                {"message": "This attendee is already registered for the event."},
            )

        logger.exception("Unable to register attendee")
        return create_response(
            500,
            {"message": "An unexpected error occurred during registration."},
        )

    except KeyError:
        logger.exception("Required environment variable is missing")
        return create_response(
            500,
            {"message": "An unexpected error occurred during registration."},
        )
