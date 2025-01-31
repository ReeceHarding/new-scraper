require('dotenv').config();

// Set default timeout for all tests
jest.setTimeout(30000);

// Mock Supabase client if needed
// jest.mock('@supabase/supabase-js', () => ({
//   createClient: jest.fn(() => ({
//     // Add mock implementations as needed
//   })),
// }));

// Global test setup
beforeAll(() => {
  // Add any global setup here
});

// Global test teardown
afterAll(() => {
  // Add any global cleanup here
}); 