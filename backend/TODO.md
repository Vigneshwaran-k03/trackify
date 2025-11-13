# TODO: Create .env file for backend configuration

- [ ] Install @nestjs/config package for environment variable management
- [ ] Create .env file with PORT, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, JWT_SECRET
- [ ] Update app.module.ts to import ConfigModule and use environment variables for database configuration
- [ ] Update auth.module.ts to use JWT_SECRET from environment variables
- [ ] Verify that main.ts already uses PORT from environment variables
