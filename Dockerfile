# ---------- Base Image ----------
FROM node:20-alpine

# ---------- Set Working Directory ----------
WORKDIR /app

# ---------- Copy Dependency Files ----------
COPY package.json package-lock.json ./

# ---------- Install Dependencies ----------
# Use npm ci for deterministic installs
RUN npm ci --only=production

# ---------- Copy Application Code ----------
COPY . .

# ---------- Set Environment ----------
ENV NODE_ENV=production

# ---------- Expose Port (if Express is running) ----------
EXPOSE 3241

# ---------- Start Application ----------
CMD ["node", "serviceM8-hubspot-integration.js"]