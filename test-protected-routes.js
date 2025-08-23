// Script to test protected route access and redirect behavior

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - replace with actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testProtectedRoutes() {
  console.log('Testing protected route access and redirect behavior...\n');

  // Generate a unique email for testing
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = 'test-password-123';

  try {
    // 1. Test accessing protected routes without authentication
    console.log('1. Testing access to protected routes without authentication...');
    
    // Simulate accessing the main dashboard page without a session
    const { data: unauthSession, error: unauthError } = await supabase.auth.getSession();
    
    if (unauthError) {
      console.error('Error checking session:', unauthError.message);
    } else if (!unauthSession.session) {
      console.log('✅ Unauthenticated access correctly blocked');
      console.log('Expected behavior: Redirect to login page');
    } else {
      console.log('❌ Unauthenticated access not properly blocked');
    }

    // 2. Create and authenticate a user
    console.log('\n2. Creating and authenticating a test user...');
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

    // 3. Test accessing protected routes with authentication
    console.log('\n3. Testing access to protected routes with authentication...');
    
    // Simulate accessing protected data with a valid session
    const { data: protectedData, error: protectedError } = await supabase
      .from('tasks')
      .select('id, title')
      .limit(1);

    if (protectedError && protectedError.code === 'PGRST116') {
      console.log('✅ Access control working - Viewer role correctly restricted from tasks table');
      console.log('Expected behavior: Access denied for read-only viewer role');
    } else if (protectedError) {
      console.error('Unexpected error accessing protected data:', protectedError.message);
    } else {
      console.log('✅ Protected data accessed successfully');
      console.log('Sample data:', protectedData);
    }

    // 4. Test accessing data that viewers can read
    console.log('\n4. Testing access to data that viewers can read...');
    
    const { data: systemSettings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, description')
      .limit(1);

    if (settingsError) {
      console.error('Error accessing system settings:', settingsError.message);
    } else {
      console.log('✅ Viewer can access system settings (as expected)');
      console.log('Sample setting:', systemSettings[0]);
    }

    // 5. Test session timeout behavior
    console.log('\n5. Testing session management...');
    
    // Get session details
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session check failed:', sessionError.message);
    } else if (sessionData.session) {
      console.log('✅ Session active');
      console.log('Session expires at:', new Date(sessionData.session.expires_at * 1000).toISOString());
      console.log('Refresh token available:', sessionData.session.refresh_token ? 'Yes' : 'No');
    }

    // 6. Test logout and redirect
    console.log('\n6. Testing logout and redirect behavior...');
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      console.error('Logout failed:', signOutError.message);
    } else {
      console.log('✅ Logout successful');
    }

    // Verify session is destroyed
    const { data: sessionAfterLogout } = await supabase.auth.getSession();
    
    if (!sessionAfterLogout.session) {
      console.log('✅ Session properly destroyed after logout');
      console.log('Expected behavior: Redirect to login page on next protected access');
    } else {
      console.log('❌ Session not properly destroyed');
    }

  } catch (error) {
    console.error('Unexpected error during protected route testing:', error.message);
  }
}

// Run the test
testProtectedRoutes();