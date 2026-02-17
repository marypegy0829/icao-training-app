
import { createClient } from '@supabase/supabase-js';

// 核心容错读取器：逐级探测云端沙盒中可能隐藏环境变量的位置
const getEnvVar = (key: string) => {
  // 尝试 1: 标准 Vite 模式 (import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) { /* ignore access errors */ }

  // 尝试 2: Node.js / 云容器底层模式 (process.env)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) { /* ignore access errors */ }

  // 尝试 3: 通过 vite.config.ts define 强制注入到 window 对象的极端模式
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window[key]) {
      // @ts-ignore
      return window[key];
    }
  } catch (e) { /* ignore access errors */ }

  return undefined;
}

// 提取燃油 (环境变量)
// 优先尝试读取环境变量，如果失败，则使用硬编码的备用值 (Fallback)
// 💡 如果您更改了 .env 不生效，请直接修改这里的字符串。
const RAW_URL = getEnvVar('VITE_SUPABASE_URL');
const RAW_KEY = getEnvVar('VITE_SUPABASE_KEY');

// 硬编码兜底 (Hardcoded Fallback) - 确保 100% 可运行
const FALLBACK_URL = "https://gffpwwrkojfbzmdeslck.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZnB3d3Jrb2pmYnptZGVzbGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDY2NzksImV4cCI6MjA4NDgyMjY3OX0.rldNOeAsx6d2q-xEAo_uN5ElY94ZBC0dM7uqj5JiEnI";

const supabaseUrl = RAW_URL || FALLBACK_URL;
const supabaseAnonKey = RAW_KEY || FALLBACK_KEY;

// 安全阀门检测
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('🚨 环境读取彻底失败！当前状态:', { url: !!supabaseUrl, key: !!supabaseAnonKey });
  throw new Error('Critical Error: Supabase credentials failed to inject. Please manually edit services/supabaseClient.ts with your keys.');
}

console.log("✅ Supabase Client Initialized. Using URL:", supabaseUrl);

// 点火：初始化客户端
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey, 
  {
    db: {
      // 🔴 STRICT SCHEMA ISOLATION (MANDATORY per AI_RULES)
      // Forces all queries to use the 'icao5_trainer' schema by default.
      schema: 'icao5_trainer' 
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
