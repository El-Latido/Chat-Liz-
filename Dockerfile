FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose the standard port (Render will override the PORT env var dynamically)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
