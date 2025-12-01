import json
import time


def handler(event, context):
    now = time.time()
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(
            {
                "received_at": now,
                "method": event.get("requestContext", {})
                .get("http", {})
                .get("method"),
                "path": event.get("rawPath"),
                "query": event.get("rawQueryString"),
                "headers": event.get("headers", {}),
                "body": event.get("body"),
                "isBase64Encoded": event.get("isBase64Encoded"),
            }
        ),
    }
