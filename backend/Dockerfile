# Use Python 3.12 as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /usr

# Install any needed packages specified in requirements.txt
COPY requirements.txt backend/requirements.txt
RUN pip install --upgrade pip
RUN pip install --no-cache-dir --upgrade -r backend/requirements.txt

# Copy the current directory contents into the container at /usr/backend
COPY . ./backend
COPY .env.docker-compose.template ./backend/.env

# Make port 80 available to the world outside this container
EXPOSE 80

# Define environment variable
# ENV NAME World

# Run app.py when the container launches
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "80", "--log-config", "backend/log_conf.yml"]
