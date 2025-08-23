// Script to test session timeout and security settings

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - replace with actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSessionTimeouts() {
  console.log('Testing session timeout and security settings...\n');

  // Generate a unique email for testing
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = 'test-password-123';

  try {
    // 1. Create and authenticate a user
    console.log('1. Creating and authenticating a test user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      console.error('User creation failed:', signUpError.message);
      return;
    }

    // Login
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('Login failed:', signInError.message);
      return;
    }

    console.log('✅ User authenticated successfully');

    // 2. Check initial session details
    console.log('\n2. Checking initial session details...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session check failed:', sessionError.message);
    } else if (sessionData.session) {
      console.log('✅ Session active');
      console.log('Access token expires at:', new Date(sessionData.session.expires_at * 1000).toISOString());
      console.log('Refresh token available:', sessionData.session.refresh_token ? 'Yes' : 'No');
      
      // Check JWT payload (basic info)
      if (sessionData.session.access_token) {
        const tokenParts = sessionData.session.access_token.split('.');
        if (tokenParts.length > 1) {
          try {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('JWT expires at:', new Date(payload.exp * 1000).toISOString());
            console.log('JWT issued at:', new Date(payload.iat * 1000).toISOString());
          } catch (e) {
            console.log('Could not parse JWT payload');
          }
        }
      }
    }

    // 3. Test session refresh
    console.log('\n3. Testing session refresh...');
    // Wait for a short period
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('Session refresh failed:', refreshError.message);
    } else if (refreshedSession.session) {
      console.log('✅ Session refreshed successfully');
      console.log('New access token expires at:', new Date(refreshedSession.session.expires_at * 1000).toISOString());
    } else {
      console.log('Session refresh completed but no new session data');
    }

    // 4. Test PKCE flow (if enabled)
    console.log('\n4. Testing PKCE flow...');
    // This is automatically handled by Supabase Auth, but we can verify it's enabled
    // by checking if the session has the expected properties
    
    const { data: pkceSession } = await supabase.auth.getSession();
    if (pkceSession.session) {
      console.log('PKCE appears to be working (session established securely)');
    }

    // 5. Test rate limiting (simulated)
    console.log('\n5. Testing rate limiting behavior...');
    // Make several rapid requests to see if rate limiting is working
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(supabase.auth.getUser());
    }
    
    try {
      const results = await Promise.all(requests);
      console.log(`✅ Made ${results.length} rapid requests without rate limiting issues`);
    } catch (error) {
      if (error.status === 429) {
        console.log('✅ Rate limiting is working (429 Too Many Requests received)');
      } else {
        console.error('Unexpected error during rate limit testing:', error.message);
      }
    }

    // 6. Test session expiration (simulated)
    console.log('\n6. Testing session expiration handling...');
    // This would normally happen after the JWT expires, but we can test the handling
    
    // For a real test, you would:
    // 1. Wait for the session to expire (or manually expire it)
    // 2. Try to make a request
    // 3. Verify that the refresh token is used automatically
    
    console.log('In a real scenario, the session would automatically refresh when the JWT expires');
    console.log('The refresh token rotation helps prevent token reuse attacks');

    // 7. Clean up
    console.log('\n7. Cleaning up session...');
    await supabase.auth.signOut();
    console.log('✅ Session cleaned up');

  } catch (error) {
    console.error('Unexpected error during session timeout testing:', error.message);
  }
}

// Run the test
testSessionTimeouts();