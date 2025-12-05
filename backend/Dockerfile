FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production

# Copy application code
COPY . .

# Create upload directories
RUN mkdir -p uploads/rewards uploads/promotions uploads/collectibles uploads/temp

EXPOSE 5000

CMD ["npm", "start"]
