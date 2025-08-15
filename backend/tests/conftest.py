import os

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "testtoken")
os.environ.setdefault("TELEGRAM_BOT_USERNAME", "testbot")
