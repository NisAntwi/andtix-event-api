import importlib
import json
from decimal import Decimal

import boto3
import pytest
from moto import mock_aws

TABLE_NAME = "andtix-test-events"


@pytest.fixture
def events_app(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-west-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("EVENTS_TABLE", TABLE_NAME)

    with mock_aws():
        table = boto3.resource("dynamodb", region_name="eu-west-1").create_table(
            TableName=TABLE_NAME,
            KeySchema=[{"AttributeName": "eventId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "eventId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )

        from src.get_events import app

        importlib.reload(app)
        yield app, table


def test_returns_events_sorted_by_start_time(events_app):
    app, table = events_app

    table.put_item(
        Item={
            "eventId": "event-2",
            "name": "Lagos Technology Summit",
            "startDateTime": "2026-09-20T09:00:00Z",
            "price": Decimal("150.50"),
        }
    )
    table.put_item(
        Item={
            "eventId": "event-1",
            "name": "Accra Cloud Conference",
            "startDateTime": "2026-09-10T08:00:00Z",
            "price": Decimal("0"),
        }
    )

    response = app.lambda_handler({}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert body["count"] == 2
    assert body["events"][0]["eventId"] == "event-1"
    assert body["events"][1]["eventId"] == "event-2"
    assert body["events"][0]["price"] == 0
    assert body["events"][1]["price"] == 150.5


def test_returns_server_error_when_table_name_is_missing(events_app, monkeypatch):
    app, _ = events_app
    monkeypatch.delenv("EVENTS_TABLE")

    response = app.lambda_handler({}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 500
    assert body == {"message": "An unexpected error occurred while retrieving events."}
