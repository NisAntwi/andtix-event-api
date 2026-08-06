import json
import logging
import os
import re
from typing import Any
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Key
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


def extract_email(event: dict[str, Any]) -> str:
    path_parameters = event.get("pathParameters") or {}
    email_value = path_parameters.get("email")

    if not isinstance(email_value, str) or not email_value.strip():
        raise ValueError("An attendee email address is required.")

    email = unquote(email_value).strip().lower()

    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("A valid email address is required.")

    return email


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del context

    try:
        email = extract_email(event)
        table = dynamodb.Table(os.environ["REGISTRATIONS_TABLE"])

        registrations: list[dict[str, Any]] = []
        query_arguments: dict[str, Any] = {
            "IndexName": os.environ["EMAIL_INDEX"],
            "KeyConditionExpression": Key("email").eq(email),
        }

        while True:
            result = table.query(**query_arguments)
            registrations.extend(result.get("Items", []))

            last_key = result.get("LastEvaluatedKey")
            if not last_key:
                break

            query_arguments["ExclusiveStartKey"] = last_key

        registrations.sort(
            key=lambda item: item.get("registeredAt", ""),
            reverse=True,
        )

        logger.info("Retrieved %s registrations", len(registrations))

        return create_response(
            200,
            {
                "message": "Registrations retrieved successfully.",
                "count": len(registrations),
                "registrations": registrations,
            },
        )

    except ValueError as error:
        return create_response(400, {"message": str(error)})

    except (ClientError, KeyError):
        logger.exception("Unable to retrieve registrations")
        return create_response(
            500,
            {"message": "An unexpected error occurred while retrieving registrations."},
        )
