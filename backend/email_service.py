import os

import boto3
from botocore.exceptions import NoCredentialsError


def send_email_ses(subject, body, to_addresses):
    source_email = os.environ.get("SES_SOURCE_EMAIL")
    if not source_email:
        raise ValueError("No source email address configured.")
    client = boto3.client('ses')
    response = client.send_email(
        Source=source_email,
        Destination={'ToAddresses': to_addresses},
        Message={
            'Subject': {'Data': subject},
            'Body': {'Text': {'Data': body}}
        }
    )
    return response


def send_email(subject, body, to_addresses):
    # Check for token-based authentication (EKS IRSA)
    if os.environ.get("AWS_WEB_IDENTITY_TOKEN_FILE"):
        return send_email_ses(subject, body, to_addresses)
    # Check for KEY_ID and KEY credentials in environment
    elif os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        return send_email_ses(subject, body, to_addresses)
    else:
        raise NoCredentialsError()


if __name__ == "__main__":
    import dotenv
    dotenv.load_dotenv()
    send_email("Test Subject", "This is a test email.", ["recipient@example.com"])
