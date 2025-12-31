'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return alert('请完整输入账号密码');
    setLoading(true);

    try {
      const virtualEmail = `${username}@points.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password: password,
      });

      if (error) throw error;

      // 获取用户角色并跳转
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard'; 
      }
    } catch (err: unknown) {
      // 修复核心：判断类型并使用变量，满足 ESLint 要求
      const errorMessage = err instanceof Error ? err.message : '账号或密码错误';
      console.error('Login error detail:', errorMessage);
      alert('登录失败: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ width: '400px', backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(20px)', borderRadius: '38px', padding: '48px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <h1 style={{ color: '#1D1D1F', fontSize: '28px', fontWeight: 600 }}>智慧系统登录</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '40px' }}>
          <input type="text" placeholder="登录账号" value={username} onChange={(e) => setUsername(e.target.value)} style={{ height: '52px', padding: '0 20px', borderRadius: '14px', border: '1px solid #D2D2D7', fontSize: '16px', outline: 'none' }} />
          <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} style={{ height: '52px', padding: '0 20px', borderRadius: '14px', border: '1px solid #D2D2D7', fontSize: '16px', outline: 'none' }} />
        </div>
        <button onClick={handleLogin} disabled={loading} style={{ width: '100%', height: '54px', backgroundColor: '#0071E3', color: 'white', borderRadius: '27px', border: 'none', fontSize: '16px', fontWeight: 600, marginTop: '32px', cursor: 'pointer' }}>
          {loading ? '验证中...' : '立即登录'}
        </button>
        <div style={{ marginTop: '32px' }}>
          <Link href="/register" style={{ color: '#0066CC', textDecoration: 'none', fontSize: '14px' }}>新老师？立即注册</Link>
        </div>
      </div>
    </main>
  );
}