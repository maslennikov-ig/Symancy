import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekdimahwukvgwmbhxolw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZGltYWh3dWt2Z3dtYmh4b2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzM4NTcsImV4cCI6MjA2OTU0OTg1N30.UFJuTNoB58YyPvpKY5NyG3i9Ln4ItxVXDOb2NWkJq5o';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);