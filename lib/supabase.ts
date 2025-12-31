import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llcbdvarqrwdcvdfeqny.supabase.co';
const supabaseAnonKey = 'sb_publishable_kpFYTqIqnz1uwvPC8capeg_Mg6YcAqw';

// 创建一个可以在整个项目中使用的数据库连接客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);