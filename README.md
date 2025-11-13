# Trackify - System Tracking Application

Trackify is a comprehensive system tracking application designed to monitor and manage various system metrics and performance indicators. This full-stack application features a modern React frontend and a robust NestJS backend.

## 🚀 Features

### Frontend
- **Responsive Dashboard** with real-time data visualization
- **Interactive Charts** using Chart.js for data representation
- **Modern UI** built with TailwindCSS and Framer Motion
- **PDF/Image Export** capabilities for reports
- **JWT Authentication** for secure access
- **Role-based Access Control** (Manager/Employee views)

### Backend
- **RESTful API** built with NestJS
- **JWT Authentication** with Passport.js
- **Scheduled Tasks** for automated processes
- **Data Validation** with class-validator
- **Environment Configuration** management
- **Database Integration** (MongoDB/PostgreSQL)
- **API Documentation** with Swagger

## 🛠️ Tech Stack

### Frontend
- **React 19** - Frontend library
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Chart.js** - Data visualization
- **date-fns** - Date manipulation

### Backend
- **NestJS** - Node.js framework
- **TypeScript** - Type-safe JavaScript
- **JWT** - Authentication
- **Passport** - Authentication middleware
- **TypeORM/Prisma** - Database ORM
- **Class Validator** - Request validation
- **Nodemailer** - Email functionality

## 📋 Prerequisites

### System Requirements
- Node.js (v18 or higher)
- npm (v9 or higher) or yarn
- MongoDB/PostgreSQL database
- Git

### Environment Variables
Create a `.env` file in both frontend and backend directories with the following variables:

**Backend (.env)**
```env
PORT=3000
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=1d
NODE_ENV=development
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:3000
```

## 🚀 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone [your-repository-url]
   cd system-tracker
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - API Documentation: http://localhost:3000/api (when running in development)

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test           # Unit tests
npm run test:e2e   # End-to-end tests
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🏗️ Project Structure

```
system-tracker/
├── backend/               # NestJS backend
│   ├── src/               # Source files
│   │   ├── auth/          # Authentication module
│   │   ├── dept/          # Department module
│   │   ├── kpi/           # KPI module
│   │   ├── app.module.ts  # Root module
│   │   └── main.ts        # Application entry point
│   └── test/              # Test files
└── frontend/              # React frontend
    ├── public/            # Static files
    └── src/               # Source files
        ├── components/    # Reusable components
        ├── pages/         # Page components
        ├── assets/        # Static assets
        └── App.jsx        # Root component
```

## 📝 API Documentation

API documentation is automatically generated using Swagger and is available at:
```
http://localhost:3000/api
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/)

---

<div align="center">
  Made with ❤️ by Your Team Name
</div>
