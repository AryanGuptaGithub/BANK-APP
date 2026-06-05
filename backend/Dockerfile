# Use Official LTS slim image - smaller attack surface than full image
FROM node:20-alpine

# set working directory
WORKDIR /app

# Copy package files first (layer caching - only reinstalls if deps changes)
COPY package*.json ./

# Install Dependencies 
RUN npm ci --only=production

# Copy source code
COPY . . 

# Don't run as root - security best practice
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose port 
EXPOSE 5000

# Start the app
CMD ["node", "src/app.js"]


