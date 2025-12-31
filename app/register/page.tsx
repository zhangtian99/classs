'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase'; 

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  
  // 状态定义
  const [fullName, setFullName] = useState(''); // 名字栏
  const [username, setUsername] = useState(''); // 账号栏
  const [password, setPassword] = useState(''); // 密码栏
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code) return alert('请输入激活码');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activation_codes')
        .select('*')
        .eq('code', code.trim())
        .eq('is_used', false)
        .single();

      if (error || !data) {
        alert('激活码无效或已被使用');
      } else {
        setStep(2);
      }
    } catch (err) {
      console.error('验证异常:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // 校验必填项
    if (!fullName || !username || !password) return alert('请完整填写名字、账号和密码');
    if (password.length < 6) return alert('密码至少需要6位');
    setLoading(true);

    try {
      const virtualEmail = `${username}@points.local`;
      
      // 1. 创建 Auth 账号 (使用“账号”字段)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: virtualEmail,
        password: password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. 创建 Profile 档案
        // username 存“账号”，full_name 存“名字”
        const { error: profileError } = await supabase.from('profiles').insert([
          { 
            id: authData.user.id, 
            username: username, // 保持不变，存登录账号
            full_name: fullName, // 新增，存真实名字
            role: 'teacher' 
          }
        ]);
        
        if (profileError) throw profileError;

        // 3. 绑定激活码
        const { error: updateError } = await supabase
          .from('activation_codes')
          .update({ 
            is_used: true, 
            used_by: authData.user.id 
          })
          .eq('code', code.trim());

        if (updateError) throw updateError;

        alert('注册成功！');
        window.location.href = '/';
      }
    } catch (err: any) {
      alert('注册错误：' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'white', borderRadius: '38px', padding: '48px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '32px', fontWeight: 600 }}>{step === 1 ? '激活系统' : '创建教师账号'}</h2>

        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input type="text" placeholder="输入专属激活码" value={code} onChange={(e) => setCode(e.target.value)} style={{ height: '52px', padding: '0 20px', borderRadius: '14px', border: '1px solid #D2D2D7', fontSize: '16px', outline: 'none' }} />
            <button onClick={handleVerify} disabled={loading} style={{ height: '54px', backgroundColor: '#FF9500', color: 'white', borderRadius: '27px', border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>下一步</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 第一栏：名字 */}
            <input 
              type="text" 
              placeholder="您的名字 (用于展示)" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              style={{ height: '52px', padding: '0 20px', borderRadius: '14px', border: '1px solid #D2D2D7', outline: 'none' }} 
            />
            {/* 第二栏：账号 */}
            <input 
              type="text" 
              placeholder="登录账号 (用于登录)" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              style={{ height: '52px', padding: '0 20px', borderRadius: '14px', border: '1px solid #D2D2D7', outline: 'none' }} 
            />
            {/* 第三栏：密码 */}
            <input 
              type="password" 
              placeholder="登录密码 (至少6位)" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ height: '52px', padding: '0 20px', borderRadius: '14px', border: '1px solid #D2D2D7', outline: 'none' }} 
            />
            <button 
              onClick={handleRegister} 
              disabled={loading} 
              style={{ height: '54px', backgroundColor: '#0071E3', color: 'white', borderRadius: '27px', border: 'none', fontSize: '16px', fontWeight: 600, marginTop: '16px', cursor: 'pointer' }}
            >
              {loading ? '提交中...' : '立即注册'}
            </button>
          </div>
        )}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <Link href="/" style={{ color: '#86868B', textDecoration: 'none', fontSize: '14px' }}>返回登录</Link>
        </div>
      </div>
    </main>
  );
}