# backend/Dockerfile
FROM python:3.12-slim

# Install ODBC Driver 18 for SQL Server
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl gnupg apt-transport-https unixodbc-dev && \
    curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] \
        https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3001
# python -m uvicorn is used instead of the bare uvicorn command.
# The bare 'uvicorn' entry-point relies on $PATH which fails on
# python:3.12-slim in some Docker runtime configurations.
# python -m uvicorn calls uvicorn through the interpreter directly,
# bypassing PATH resolution entirely. Always use this form in Docker.
CMD ["python", "-m", "uvicorn", "server:app","--host", "0.0.0.0", "--port", "3001"]
