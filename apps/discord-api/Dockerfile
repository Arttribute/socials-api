# Use official Node.js image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Compile TypeScript
RUN npm run build

# Expose correct port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
