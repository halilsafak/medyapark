/* Supabase bağlantısı — bu anahtar herkese açıktır (publishable), güvenle burada durur. */
const SUPABASE_URL = 'https://wubljodinspijiqzywav.supabase.co';
const SUPABASE_KEY = 'sb_publishable_36AtxToYL_3yZGyhE69zXw_T-xYOQNu';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
