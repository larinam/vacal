# Use Python 3.13 as a parent image
FROM python:3.13-slim

# Set the working directory in the container
WORKDIR /usr

# Install any needed packages specified in requirements.txt
COPY requirements.txt backend/requirements.txt
RUN pip install --upgrade pip
RUN pip install --no-cache-dir --upgrade -r backend/requirements.txt

# Install pytest separately
RUN pip install pytest httpx

# Copy the current directory contents into the container at /usr/backend
COPY . ./backend
COPY .env.docker-compose.template ./backend/.env

# Define environment variable
# ENV NAME World

# Run app.py when the container launches
CMD ["pytest", "--tb=short", "-v", "backend"]
