import importlib
import json

import boto3
import pytest
from moto import mock_aws

TABLE_NAME = "andtix-test-registrations"


@pytest.fixture
def cancel_registration_app(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("REGISTRATIONS_TABLE", TABLE_NAME)

    with mock_aws():
        table = boto3.resource(
            "dynamodb",
            region_name="us-east-1",
        ).create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {
                    "AttributeName": "registrationId",
                    "KeyType": "HASH",
                }
            ],
            AttributeDefinitions=[
                {
                    "AttributeName": "registrationId",
                    "AttributeType": "S",
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        from src.cancel_registration import app

        importlib.reload(app)
        yield app, table


def test_cancels_existing_registration(cancel_registration_app):
    app, table = cancel_registration_app

    table.put_item(
        Item={
            "registrationId": "registration/123",
            "eventId": "event-1",
            "email": "dennis@example.com",
            "status": "CONFIRMED",
        }
    )

    response = app.lambda_handler(
        {
            "pathParameters": {
                "registrationId": "registration%2F123",
            }
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert body == {
        "message": "Registration cancelled successfully.",
        "registrationId": "registration/123",
    }

    result = table.get_item(
        Key={"registrationId": "registration/123"},
    )
    assert "Item" not in result


def test_returns_not_found_for_unknown_registration(
    cancel_registration_app,
):
    app, _ = cancel_registration_app

    response = app.lambda_handler(
        {
            "pathParameters": {
                "registrationId": "unknown-registration",
            }
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 404
    assert body == {"message": "Registration not found."}


@pytest.mark.parametrize(
    "event",
    [
        {},
        {"pathParameters": {"registrationId": "   "}},
    ],
)
def test_rejects_missing_registration_id(
    cancel_registration_app,
    event,
):
    app, _ = cancel_registration_app

    response = app.lambda_handler(event, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 400
    assert body == {"message": "A registration ID is required."}


def test_returns_server_error_when_configuration_is_missing(
    cancel_registration_app,
    monkeypatch,
):
    app, _ = cancel_registration_app
    monkeypatch.delenv("REGISTRATIONS_TABLE")

    response = app.lambda_handler(
        {
            "pathParameters": {
                "registrationId": "registration-123",
            }
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 500
    assert body == {"message": ("An unexpected error occurred while cancelling registration.")}
