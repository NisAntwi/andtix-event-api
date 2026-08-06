import json
import logging
import os
from typing import Any
from urllib.parse import unquote

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

dynamodb = boto3.resource("dynamodb")


def create_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def extract_registration_id(event: dict[str, Any]) -> str:
    path_parameters = event.get("pathParameters") or {}
    registration_id_value = path_parameters.get("registrationId")

    if not isinstance(registration_id_value, str) or not registration_id_value.strip():
        raise ValueError("A registration ID is required.")

    return unquote(registration_id_value).strip()


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del context

    try:
        registration_id = extract_registration_id(event)
        table = dynamodb.Table(os.environ["REGISTRATIONS_TABLE"])

        result = table.delete_item(
            Key={"registrationId": registration_id},
            ReturnValues="ALL_OLD",
        )

        deleted_registration = result.get("Attributes")

        if not deleted_registration:
            return create_response(
                404,
                {"message": "Registration not found."},
            )

        logger.info("Cancelled registration %s", registration_id)

        return create_response(
            200,
            {
                "message": "Registration cancelled successfully.",
                "registrationId": registration_id,
            },
        )

    except ValueError as error:
        return create_response(400, {"message": str(error)})

    except (ClientError, KeyError):
        logger.exception("Unable to cancel registration")
        return create_response(
            500,
            {"message": "An unexpected error occurred while cancelling registration."},
        )
