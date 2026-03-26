import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

load_dotenv()

# Build a SQLAlchemy connection URL for the mssql+pyodbc dialect.
# pyodbc is the underlying ODBC bridge; SQLAlchemy wraps it.
connection_url = URL.create(
    "mssql+pyodbc",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_SERVER"),
    port=int(os.getenv("DB_PORT", 1433)),
    database=os.getenv("DB_NAME"),
    query={
        "driver":                 "ODBC Driver 18 for SQL Server",
        "Encrypt":                "yes",
        "TrustServerCertificate": "no",
        "Connection Timeout":     "30",
    },
)

# Module-level singleton — import this in server.py.
# pool_pre_ping=True  : test each connection before handing it out
# pool_recycle=1800   : force-recycle connections every 30 min
engine = create_engine(
    connection_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
)
