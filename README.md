# ESPRO Collective App

## Quick Deploy to Render

This app is ready to deploy to Render using Blueprint. See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions.

**Quick Start:**
1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and deploy all services

## Local Development

ESPRO Collective App — MVP for loyalty, rewards, membership, and customer base building.

## Project Structure

```
espro-collective-app/
├── apps/
│   ├── customer-portal/    # React PWA - Customer-facing app
│   └── admin-portal/       # React Web - Admin dashboard
├── backend/                # Express.js API server
└── docker-compose.yml      # Docker orchestration
```

## Features

### Customer Portal (PWA)
- ESPRO Coins balance display
- QR Code for loyalty ID
- Rewards claiming system
- Card design collectibles (gamification)
- Promotions carousel
- Claim history with vouchers
- Profile management

### Admin Portal
- Customer management
- Points upload via CSV
- Rewards creation & management
- Promotions management
- Card designs management
- Loyalty IDs upload
- Dashboard with statistics

## Tech Stack

- **Frontend**: React.js, React Router, TailwindCSS, Zustand, React Query
- **Backend**: Node.js, Express, MongoDB, Mongoose, JWT
- **Deployment**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- MongoDB (or use Docker)

## Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd espro-collective-app
   ```

2. **Create environment file**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

4. **Access the applications**
   - Customer Portal: http://localhost:8080
   - Admin Portal: http://localhost:8081
   - Backend API: http://localhost:8000
   - MongoDB: localhost:27019

## Local Development

1. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   cd ../apps/customer-portal && npm install
   cd ../admin-portal && npm install
   ```

2. **Set up MongoDB**
   - Use Docker: `docker run -d -p 27017:27017 mongo:7`
   - Or use a local MongoDB instance

3. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env
   ```

4. **Start backend**
   ```bash
   cd backend
   npm run dev
   ```

5. **Start customer portal**
   ```bash
   cd apps/customer-portal
   npm run dev
   ```

6. **Start admin portal**
   ```bash
   cd apps/admin-portal
   npm run dev
   ```

## Initial Setup

### Create Default Admin User

1. Connect to MongoDB
2. Create admin user:
   ```javascript
   db.users.insertOne({
     name: "Admin",
     email: "admin@gmail.com",
     password: "$2a$10$...", // bcrypt hash of your password
     isAdmin: true,
     esproCoins: 0,
     lifetimeEsproCoins: 0
   })
   ```

Or use the API to create admin (if endpoint exists).

### Create Default Card Design

The system will need at least one default card design. You can create it via the admin portal after logging in.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new customer
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Customer
- `GET /api/customer/profile` - Get customer profile
- `PUT /api/customer/profile` - Update profile
- `GET /api/customer/rewards` - Get available rewards
- `GET /api/customer/collectibles` - Get card designs
- `PUT /api/customer/collectibles/:id/activate` - Activate card design
- `GET /api/customer/promotions` - Get promotions
- `GET /api/customer/claims` - Get claim history

### Rewards
- `POST /api/rewards/claim/:id` - Claim a reward
- `GET /api/rewards` - Get all rewards (admin)
- `POST /api/rewards` - Create reward (admin)
- `PUT /api/rewards/:id` - Update reward (admin)
- `DELETE /api/rewards/:id` - Delete reward (admin)

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/customers` - List customers
- `PUT /api/admin/customers/:id/points` - Update customer points
- `POST /api/admin/points-upload` - Upload CSV for points
- `POST /api/admin/loyalty-ids-upload` - Upload loyalty IDs CSV
- `GET /api/admin/loyalty-ids` - List loyalty IDs

## CSV Formats

### Points Upload CSV
```csv
loyalty_id,points_to_add,date
LYL-1234-5678,100,2024-01-15
LYL-8765-4321,50,2024-01-15
```

### Loyalty IDs Upload CSV
```csv
loyalty_id
LYL-0001-0001
LYL-0001-0002
LYL-0001-0003
```

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/espro-collective
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
```

## Brand Colors

- Primary Orange: `#f66633`
- Brown: `#4b2e2b`
- Cream: `#f5e9da`
- Dark: `#333333`
- Teal: `#3a878c`

## Development Notes

- Customer portal is a PWA (Progressive Web App)
- Admin portal is a standard React web app
- Both portals use the same backend API
- File uploads are stored in `backend/uploads/`
- MongoDB is used for data persistence

## License

ISC
