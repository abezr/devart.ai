# Supabase Authentication Configuration Instructions

This document provides step-by-step instructions for configuring Supabase Authentication settings, including GitHub OAuth provider setup and email templates.

## Prerequisites

1. A Supabase project
2. Access to the Supabase Dashboard
3. A GitHub account (for GitHub OAuth setup)

## Configuring Authentication Settings

### 1. Accessing Authentication Settings

1. Log in to your Supabase Dashboard
2. Select your project
3. In the left sidebar, click on "Authentication"

### 2. Configuring Site URL

1. In the Authentication menu, click on "URL Configuration"
2. Set the "Site URL" to your application's URL:
   - For development: `http://localhost:3000`
   - For production: `https://your-domain.com`
3. Add additional redirect URLs as needed:
   - `http://localhost:3000/**`
   - `https://your-domain.com/**`

### 3. Enabling Email Authentication

1. In the Authentication menu, click on "Providers"
2. Find "Email" in the list of providers
3. Toggle the switch to enable Email authentication
4. Configure email templates (see section below)

### 4. Setting up GitHub OAuth Provider

1. In the Authentication menu, click on "Providers"
2. Find "GitHub" in the list of providers
3. Toggle the switch to enable GitHub authentication
4. Register a new OAuth application in GitHub:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Click "New OAuth App"
   - Fill in the form:
     - Application name: `devart.ai`
     - Homepage URL: `https://your-domain.com` (or `http://localhost:3000` for development)
     - Authorization callback URL: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Click "Register application"
5. Copy the Client ID and Client Secret from GitHub
6. Back in Supabase:
   - Paste the Client ID into the "Client ID" field
   - Paste the Client Secret into the "Client Secret" field
   - Click "Save"

### 5. Configuring Email Templates

1. In the Authentication menu, click on "Templates"
2. Customize the email templates as needed:

#### Confirmation Email Template
```
Subject: Confirm Your devart.ai Account

Hello,

Please confirm your devart.ai account by clicking on the following link:

[[ConfirmationURL]]

If you didn't sign up for a devart.ai account, you can safely ignore this email.

Best regards,
The devart.ai Team
```

#### Magic Link Email Template
```
Subject: Your devart.ai Login Link

Hello,

Click the link below to log in to your devart.ai account:

[[LinkURL]]

This link will expire in 24 hours.

If you didn't request this link, you can safely ignore this email.

Best regards,
The devart.ai Team
```

#### Email Change Confirmation Template
```
Subject: Confirm Your New Email Address for devart.ai

Hello,

You have requested to change your email address for your devart.ai account.

Please confirm this change by clicking on the following link:

[[ConfirmationURL]]

If you didn't request this change, you can safely ignore this email.

Best regards,
The devart.ai Team
```

#### Recovery Email Template
```
Subject: Reset Your devart.ai Password

Hello,

We received a request to reset your devart.ai password.

Click the link below to reset your password:

[[LinkURL]]

This link will expire in 24 hours.

If you didn't request a password reset, you can safely ignore this email.

Best regards,
The devart.ai Team
```

### 6. Configuring Session Timeouts and Security Settings

1. In the Authentication menu, click on "Settings"
2. Configure the following settings:

#### Session Settings
- Session timeout: `3600` seconds (1 hour) for development, `1800` seconds (30 minutes) for production
- Refresh token rotation: Enabled
- Refresh token reuse interval: `10` seconds

#### Security Settings
- Enable JWT: Yes
- JWT expiry: `3600` seconds (1 hour)
- Enable PKCE: Yes (recommended for security)

#### Rate Limits
- Auth requests per hour: `30` (adjust based on your needs)
- Auth requests per minute: `5` (adjust based on your needs)

### 7. Testing the Configuration

After configuring the settings, test the authentication flow:

1. Try signing up with email
2. Check that confirmation emails are received
3. Try logging in with email and password
4. Try logging in with GitHub OAuth
5. Verify that session management works correctly

## Troubleshooting

### Common Issues

1. **GitHub OAuth Not Working**:
   - Verify the callback URL is exactly `https://your-project-ref.supabase.co/auth/v1/callback`
   - Check that Client ID and Client Secret are correct
   - Ensure the GitHub app is not in draft mode

2. **Emails Not Being Sent**:
   - Check spam/junk folders
   - Verify the Site URL configuration
   - Check Supabase email sending limits

3. **Session Timeout Issues**:
   - Verify JWT expiry settings
   - Check if refresh tokens are working correctly
   - Review rate limit settings

4. **Redirect Issues**:
   - Ensure all redirect URLs are properly configured
   - Check that the Site URL matches your application's URL
   - Verify that the redirectTo parameter in your Auth component is correct

### Logs and Monitoring

1. In the Supabase Dashboard, navigate to "Authentication" > "Logs"
2. Review authentication logs for any errors or issues
3. Monitor login attempts and identify any suspicious activity

## Best Practices

1. **Security**:
   - Use PKCE for enhanced security
   - Regularly rotate Client Secrets
   - Implement proper session management
   - Use strong password requirements

2. **User Experience**:
   - Customize email templates to match your brand
   - Provide clear error messages
   - Implement proper loading states during authentication
   - Handle edge cases like network failures gracefully

3. **Maintenance**:
   - Regularly review authentication logs
   - Monitor rate limits and adjust as needed
   - Keep OAuth provider configurations up to date
   - Test authentication flows regularly

## Environment Variables

Ensure the following environment variables are set in your application:

```bash
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# For server-side operations (keep secret)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

These values can be found in your Supabase project dashboard under "Settings" > "API".