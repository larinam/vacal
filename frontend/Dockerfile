# Use an official Node runtime as a parent image
FROM node:24

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) into the container
COPY ./package*.json ./

# Install any needed packages
RUN npm install --verbose

# Copy the rest of your app's source code from your host to your image filesystem.
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define the command to run your app
CMD ["npm", "start"]
