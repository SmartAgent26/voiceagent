import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase Client en el frontend
const supabaseUrl = 'https://gvjetdlbxkmkypacmjzu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2amV0ZGxieGtta3lwYWNtanp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODE5NjYsImV4cCI6MjA5NTY1Nzk2Nn0.JWpbhXfSfI7tfZt5E2-_fOpi1AWYjj7y3hnnxS3zxgc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
