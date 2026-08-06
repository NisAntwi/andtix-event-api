import importlib
import json

import boto3
import pytest
from moto import mock_aws

EVENTS_TABLE = "andtix-test-events"
REGISTRATIONS_TABLE = "andtix-test-registrations"


@pytest.fixture
def register_app(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-west-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("EVENTS_TABLE", EVENTS_TABLE)
    monkeypatch.setenv("REGISTRATIONS_TABLE", REGISTRATIONS_TABLE)

    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="eu-west-1")

        events_table = dynamodb.create_table(
            TableName=EVENTS_TABLE,
            KeySchema=[{"AttributeName": "eventId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "eventId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )

        registrations_table = dynamodb.create_table(
            TableName=REGISTRATIONS_TABLE,
            KeySchema=[{"AttributeName": "registrationId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "registrationId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )

        from src.register_attendee import app

        importlib.reload(app)
        yield app, events_table, registrations_table


def test_registers_attendee_successfully(register_app):
    app, events_table, registrations_table = register_app

    events_table.put_item(
        Item={
            "eventId": "event-1",
            "name": "Accra Cloud Conference",
        }
    )

    response = app.lambda_handler(
        {
            "body": json.dumps(
                {
                    "eventId": "event-1",
                    "attendeeName": "Dennis Antwi",
                    "email": "Dennis@example.com",
                }
            )
        },
        None,
    )
    body = json.loads(response["body"])
    registration = body["registration"]

    assert response["statusCode"] == 201
    assert registration["eventId"] == "event-1"
    assert registration["eventName"] == "Accra Cloud Conference"
    assert registration["attendeeName"] == "Dennis Antwi"
    assert registration["email"] == "dennis@example.com"
    assert registration["status"] == "CONFIRMED"

    saved_item = registrations_table.get_item(
        Key={"registrationId": registration["registrationId"]}
    )["Item"]

    assert saved_item == registration


def test_rejects_duplicate_registration(register_app):
    app, events_table, _ = register_app

    events_table.put_item(
        Item={
            "eventId": "event-1",
            "name": "Accra Cloud Conference",
        }
    )

    event = {
        "body": json.dumps(
            {
                "eventId": "event-1",
                "attendeeName": "Dennis Antwi",
                "email": "dennis@example.com",
            }
        )
    }

    first_response = app.lambda_handler(event, None)
    second_response = app.lambda_handler(event, None)
    body = json.loads(second_response["body"])

    assert first_response["statusCode"] == 201
    assert second_response["statusCode"] == 409
    assert body["message"] == ("This attendee is already registered for the event.")


def test_returns_not_found_for_unknown_event(register_app):
    app, _, _ = register_app

    response = app.lambda_handler(
        {
            "body": json.dumps(
                {
                    "eventId": "missing-event",
                    "attendeeName": "Dennis Antwi",
                    "email": "dennis@example.com",
                }
            )
        },
        None,
    )
    body = json.loads(response["body"])

    assert response["statusCode"] == 404
    assert body["message"] == "The requested event was not found."


@pytest.mark.parametrize(
    ("request_body", "expected_message"),
    [
        ("not-json", "Request body must contain valid JSON."),
        (
            json.dumps({"eventId": "event-1"}),
            "Missing or invalid required fields: attendeeName, email.",
        ),
        (
            json.dumps(
                {
                    "eventId": "event-1",
                    "attendeeName": "Dennis Antwi",
                    "email": "invalid-email",
                }
            ),
            "A valid email address is required.",
        ),
    ],
)
def test_rejects_invalid_requests(
    register_app,
    request_body,
    expected_message,
):
    app, _, _ = register_app

    response = app.lambda_handler({"body": request_body}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 400
    assert body["message"] == expected_message
