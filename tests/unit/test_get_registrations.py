import importlib
import json

import boto3
import pytest
from moto import mock_aws

TABLE_NAME = "andtix-test-registrations"
INDEX_NAME = "EmailIndex"


@pytest.fixture
def registrations_app(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-west-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("REGISTRATIONS_TABLE", TABLE_NAME)
    monkeypatch.setenv("EMAIL_INDEX", INDEX_NAME)

    with mock_aws():
        table = boto3.resource(
            "dynamodb",
            region_name="eu-west-1",
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
                },
                {
                    "AttributeName": "email",
                    "AttributeType": "S",
                },
                {
                    "AttributeName": "eventId",
                    "AttributeType": "S",
                },
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": INDEX_NAME,
                    "KeySchema": [
                        {
                            "AttributeName": "email",
                            "KeyType": "HASH",
                        },
                        {
                            "AttributeName": "eventId",
                            "KeyType": "RANGE",
                        },
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        from src.get_registrations import app

        importlib.reload(app)
        yield app, table


def test_returns_registrations_sorted_by_newest_first(
    registrations_app,
):
    app, table = registrations_app

    table.put_item(
        Item={
            "registrationId": "registration-1",
            "eventId": "event-1",
            "eventName": "Accra Cloud Conference",
            "email": "dennis@example.com",
            "registeredAt": "2026-08-01T09:00:00Z",
            "status": "CONFIRMED",
        }
    )
    table.put_item(
        Item={
            "registrationId": "registration-2",
            "eventId": "event-2",
            "eventName": "Lagos Technology Summit",
            "email": "dennis@example.com",
            "registeredAt": "2026-08-03T10:00:00Z",
            "status": "CONFIRMED",
        }
    )

    response = app.lambda_handler(
        {
            "pathParameters": {
                "email": "Dennis%40Example.com",
            }
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert body["count"] == 2
    assert body["registrations"][0]["registrationId"] == "registration-2"
    assert body["registrations"][1]["registrationId"] == "registration-1"


def test_returns_empty_list_when_no_registrations_exist(
    registrations_app,
):
    app, _ = registrations_app

    response = app.lambda_handler(
        {
            "pathParameters": {
                "email": "unknown@example.com",
            }
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert body["count"] == 0
    assert body["registrations"] == []


@pytest.mark.parametrize(
    ("event", "expected_message"),
    [
        (
            {},
            "An attendee email address is required.",
        ),
        (
            {"pathParameters": {"email": "invalid-email"}},
            "A valid email address is required.",
        ),
    ],
)
def test_rejects_invalid_email(
    registrations_app,
    event,
    expected_message,
):
    app, _ = registrations_app

    response = app.lambda_handler(event, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 400
    assert body["message"] == expected_message


def test_returns_server_error_when_configuration_is_missing(
    registrations_app,
    monkeypatch,
):
    app, _ = registrations_app
    monkeypatch.delenv("REGISTRATIONS_TABLE")

    response = app.lambda_handler(
        {
            "pathParameters": {
                "email": "dennis@example.com",
            }
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 500
    assert body == {"message": ("An unexpected error occurred while retrieving registrations.")}
