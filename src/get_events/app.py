import json
import logging
import os
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

dynamodb = boto3.resource("dynamodb")


def serialize_decimal(value: object) -> int | float:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)

    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def create_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=serialize_decimal),
    }


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del event, context

    try:
        table = dynamodb.Table(os.environ["EVENTS_TABLE"])
        events: list[dict[str, Any]] = []
        scan_arguments: dict[str, Any] = {}

        while True:
            result = table.scan(**scan_arguments)
            events.extend(result.get("Items", []))

            last_key = result.get("LastEvaluatedKey")
            if not last_key:
                break

            scan_arguments["ExclusiveStartKey"] = last_key

        events.sort(key=lambda item: item.get("startDateTime", ""))

        logger.info("Retrieved %s events", len(events))

        return create_response(
            200,
            {
                "message": "Events retrieved successfully.",
                "count": len(events),
                "events": events,
            },
        )

    except (ClientError, KeyError):
        logger.exception("Unable to retrieve events")

        return create_response(
            500,
            {"message": "An unexpected error occurred while retrieving events."},
        )
