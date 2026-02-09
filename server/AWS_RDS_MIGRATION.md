# Migration from Supabase to AWS RDS

This guide will help you migrate your backend from Supabase to AWS RDS.

## Changes Made

1. **Updated Database Configuration** (`src/db.js`):
   - Changed from Supabase environment variables to AWS RDS variables
   - Added connection pooling configuration
   - Improved SSL handling for production environments

2. **Created Configuration File** (`src/config/database.js`):
   - Centralized database configuration
   - Better organization and maintainability

3. **Updated Server Logging** (`index.js`):
   - Changed connection messages from Supabase to AWS RDS

## Environment Variables

Update your `.env` file with the following AWS RDS variables:

```bash
# AWS RDS Database Configuration
AWS_RDS_HOST=your-aws-rds-endpoint.region.rds.amazonaws.com
AWS_RDS_PORT=5432
AWS_RDS_USER=your_database_username
AWS_RDS_PASSWORD=your_database_password
AWS_RDS_DATABASE=your_database_name
AWS_RDS_CA_CERT=your_ssl_certificate_content
```

## Migration Steps

1. **Get AWS RDS Connection Details**:
   - Host: Your RDS endpoint (found in AWS Console)
   - Port: Usually 5432 for PostgreSQL
   - Username: Database master username
   - Password: Database master password
   - Database: Your database name

2. **SSL Certificate (Production Only)**:
   - Download the RDS CA certificate from AWS
   - Set the `AWS_RDS_CA_CERT` environment variable with the certificate content
   - For development, SSL is disabled

3. **Update Environment Variables**:
   - Copy the variables from `env.example` to your `.env` file
   - Replace placeholder values with your actual AWS RDS credentials

4. **Test Connection**:
   ```bash
   npm start
   ```
   - Check console output for successful connection message
   - Verify the endpoint shows your AWS RDS host

5. **Database Schema**:
   - If you have existing tables, you'll need to recreate them in AWS RDS
   - Consider using a migration tool or manually creating tables
   - Export data from Supabase and import to AWS RDS if needed

## Important Notes

- **Security Groups**: Ensure your AWS RDS security group allows connections from your application's IP
- **VPC**: Make sure your RDS instance is in the correct VPC/subnet
- **SSL**: In production, always use SSL connections
- **Backup**: Consider setting up automated backups in AWS RDS
- **Monitoring**: Use AWS CloudWatch for database monitoring

## Troubleshooting

1. **Connection Timeout**: Check security groups and network ACLs
2. **SSL Errors**: Verify certificate configuration in production
3. **Authentication Errors**: Double-check username and password
4. **Database Not Found**: Ensure the database name exists in your RDS instance

## Rollback Plan

If you need to rollback to Supabase:
1. Revert the changes in `src/db.js` and `index.js`
2. Restore original Supabase environment variables
3. Update connection logging back to Supabase references 