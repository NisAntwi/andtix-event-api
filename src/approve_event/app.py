import json
import logging
import os
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

EVENT_SUBMISSIONS_TABLE = os.environ.get(
    "EVENT_SUBMISSIONS_TABLE",
    "",
)

EVENTS_TABLE = os.environ.get(
    "EVENTS_TABLE",
    "",
)


def create_response(
    status_code: int,
    body: dict[str, Any],
) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(
            body,
            default=str,
        ),
    }


def lambda_handler(
    event: dict[str, Any],
    context: Any,
) -> dict[str, Any]:
    del context

    if not EVENT_SUBMISSIONS_TABLE or not EVENTS_TABLE:
        logger.error("Required table environment variables are missing.")

        return create_response(
            500,
            {"message": ("Approval service is not configured correctly.")},
        )

    try:
        submission_id = str(
            event.get(
                "submissionId",
                "",
            )
        ).strip()

        if not submission_id:
            return create_response(
                400,
                {"message": ("submissionId is required.")},
            )

        submissions_table = dynamodb.Table(EVENT_SUBMISSIONS_TABLE)

        events_table = dynamodb.Table(EVENTS_TABLE)

        result = submissions_table.get_item(
            Key={
                "submissionId": submission_id,
            },
            ConsistentRead=True,
        )

        submission = result.get("Item")

        if not submission:
            return create_response(
                404,
                {"message": ("Event submission was not found.")},
            )

        current_status = str(
            submission.get(
                "status",
                "",
            )
        ).upper()

        if current_status != "PENDING_APPROVAL":
            return create_response(
                409,
                {
                    "message": ("This submission has already been reviewed."),
                    "status": current_status,
                },
            )

        event_date = str(
            submission.get(
                "eventDate",
                "",
            )
        ).strip()

        event_time = str(
            submission.get(
                "eventTime",
                "",
            )
        ).strip()

        if not event_date or not event_time:
            return create_response(
                400,
                {"message": ("Submission is missing event date or time.")},
            )

        event_name = str(
            submission.get(
                "eventName",
                "",
            )
        ).strip()

        if not event_name:
            return create_response(
                400,
                {"message": ("Submission is missing an event name.")},
            )

        try:
            capacity = int(
                submission.get(
                    "capacity",
                    1,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            return create_response(
                400,
                {"message": ("Submission contains an invalid event capacity.")},
            )

        if capacity < 1:
            return create_response(
                400,
                {"message": ("Event capacity must be at least 1.")},
            )

        pricing_type = str(
            submission.get(
                "pricingType",
                "FREE",
            )
        ).upper()

        ticket_price = submission.get(
            "ticketPrice",
            Decimal("0"),
        )

        listing_type = str(
            submission.get(
                "listingType",
                "STANDARD",
            )
        ).upper()

        event_id = f"org-{submission_id}"

        start_date_time = f"{event_date}T{event_time}:00Z"

        approved_at = datetime.now(UTC).isoformat()

        public_event = {
            "eventId": event_id,
            "name": event_name,
            "description": str(
                submission.get(
                    "description",
                    "",
                )
            ).strip(),
            "location": str(
                submission.get(
                    "location",
                    "",
                )
            ).strip(),
            "category": str(
                submission.get(
                    "category",
                    "General",
                )
            ).strip(),
            "startDateTime": start_date_time,
            "dateLabel": (f"{event_date} {event_time}"),
            "capacity": capacity,
            "status": "OPEN",
            "pricingType": pricing_type,
            "ticketPrice": ticket_price,
            "listingType": listing_type,
            "externalEvent": False,
            "source": "ORGANIZER_PORTAL",
            "organizerName": str(
                submission.get(
                    "organizerName",
                    "",
                )
            ).strip(),
            "organizerEmail": str(
                submission.get(
                    "organizerEmail",
                    "",
                )
            ).strip(),
            "submissionId": submission_id,
            "approvedAt": approved_at,
        }

        events_table.put_item(
            Item=public_event,
            ConditionExpression=("attribute_not_exists(eventId)"),
        )

        try:
            submissions_table.update_item(
                Key={
                    "submissionId": submission_id,
                },
                UpdateExpression=(
                    "SET #status = :approved, "
                    "approvedAt = :approved_at, "
                    "publishedEventId = :event_id"
                ),
                ConditionExpression=("#status = :pending"),
                ExpressionAttributeNames={
                    "#status": "status",
                },
                ExpressionAttributeValues={
                    ":approved": "APPROVED",
                    ":pending": "PENDING_APPROVAL",
                    ":approved_at": approved_at,
                    ":event_id": event_id,
                },
            )

        except ClientError:
            logger.exception("Submission update failed. Removing the newly created public event.")

            events_table.delete_item(
                Key={
                    "eventId": event_id,
                }
            )

            raise

        logger.info(
            "Approved organizer event %s as %s",
            submission_id,
            event_id,
        )

        return create_response(
            200,
            {
                "message": ("Event approved and published successfully."),
                "event": {
                    "eventId": event_id,
                    "eventName": event_name,
                    "status": "OPEN",
                    "listingType": listing_type,
                    "approvedAt": approved_at,
                },
            },
        )

    except ClientError as error:
        error_code = error.response.get(
            "Error",
            {},
        ).get(
            "Code",
            "DynamoDBError",
        )

        logger.exception("DynamoDB error during event approval.")

        if error_code == "ConditionalCheckFailedException":
            return create_response(
                409,
                {"message": ("This event has already been approved or its status has changed.")},
            )

        return create_response(
            500,
            {
                "message": ("Unable to approve the event."),
                "error": error_code,
            },
        )

    except Exception:
        logger.exception("Unexpected event approval error.")

        return create_response(
            500,
            {"message": ("An unexpected error occurred while approving the event.")},
        )
