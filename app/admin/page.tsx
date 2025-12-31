'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ShieldCheck, 
  User, 
  Key, 
  Search, 
  Plus, 
  Trash2, 
  Copy, 
  Settings, 
  LogOut 
} from 'lucide-react';

// --- 接口定义（仅用于底层报错，不改变界面） ---
interface Profile { id: string; username: string; created_at: string; expire_at: string | null; }
interface ActivationCode { 
  id: string; 
  code: string; 
  is_used: boolean; 
  valid_days: number; 
  created_at: string; 
  teacher_info: { username: string } | null; 
}

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [adminConfig, setAdminConfig] = useState({ user: 'admin', pass: 'admin' });
  
  const [activeMenu, setActiveMenu] = useState('激活码生成');
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genDays, setGenDays] = useState(7);

  // --- 获取数据（锁定逻辑） ---
  const fetchData = useCallback(async () => {
    if (!isLoggedIn) return;
    const { data: cData } = await supabase.from('activation_codes').select(`*, teacher_info:profiles(username)`).order('created_at', { ascending: false });
    if (cData) setCodes(cData as unknown as ActivationCode[]);

    let tQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (searchTerm) tQuery = tQuery.ilike('username', `%${searchTerm}%`);
    const { data: tData } = await tQuery;
    if (tData) setTeachers(tData as Profile[]);
  }, [isLoggedIn, searchTerm]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from('admin_settings').select('*').single();
      if (data) setAdminConfig({ user: data.username, pass: data.password });
      if (localStorage.getItem('admin_session') === 'active') setIsLoggedIn(true);
    };
    init();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.user === adminConfig.user && loginForm.pass === adminConfig.pass) {
      setIsLoggedIn(true);
      localStorage.setItem('admin_session', 'active');
    } else { alert('账号或密码错误'); }
  };

  const generateCode = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const newCode = 'APPLE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await supabase.from('activation_codes').insert([{ code: newCode, is_used: false, valid_days: genDays }]);
    await fetchData();
    setIsGenerating(false);
  };

  const handleRenew = async (teacherId: string, username: string) => {
    const days = prompt(`续费 [${username}] 天数:`, "30");
    if (!days || isNaN(Number(days))) return;
    const { data: current } = await supabase.from('profiles').select('expire_at').eq('id', teacherId).single();
    let baseDate = new Date();
    if (current?.expire_at && new Date(current.expire_at) > new Date()) baseDate = new Date(current.expire_at);
    baseDate.setDate(baseDate.getDate() + Number(days));
    await supabase.from('profiles').update({ expire_at: baseDate.toISOString() }).eq('id', teacherId);
    await fetchData();
  };

  const cardStyle: React.CSSProperties = { backgroundColor: 'white', padding: '32px', borderRadius: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)' };

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
        <form onSubmit={handleLogin} className="w-96 rounded-[45px] bg-white p-12 shadow-2xl border border-slate-100 space-y-4">
          <div className="text-center mb-6">
            <ShieldCheck size={48} className="text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-slate-800">系统后台管理</h1>
            <p className="text-sm font-bold text-slate-400 mt-2">请验证管理员身份</p>
          </div>
          <input type="text" placeholder="账号" className="w-full rounded-2xl bg-slate-50 border-none py-4 px-6 outline-none focus:ring-2 ring-blue-500/20 font-bold" onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
          <input type="password" placeholder="密码" className="w-full rounded-2xl bg-slate-50 border-none py-4 px-6 outline-none focus:ring-2 ring-blue-500/20 font-bold" onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
          <button type="submit" className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-xl hover:bg-black transition-all">登录系统</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F5F7] font-sans">
      <aside className="w-[280px] bg-white border-r border-[#E5E5E7] p-10 flex flex-col justify-between">
        <div>
          <h2 className="text-[20px] font-black mb-10 text-[#1D1D1F] flex items-center gap-2"><ShieldCheck className="text-blue-600" /> 系统管理</h2>
          <nav className="space-y-2">
            {['激活码生成', '教师管理', '系统设置'].map(item => (
              <div key={item} onClick={() => setActiveMenu(item)} className={`px-5 py-4 rounded-2xl cursor-pointer text-[15px] font-bold transition-all ${activeMenu === item ? 'bg-[#0071E3] text-white shadow-lg shadow-blue-100' : 'text-[#86868B] hover:bg-[#F5F5F7]'}`}>{item}</div>
            ))}
          </nav>
        </div>
        <button onClick={() => { localStorage.removeItem('admin_session'); setIsLoggedIn(false); }} className="flex items-center gap-2 px-5 py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl"><LogOut size={18} /> 退出系统</button>
      </aside>

      <main className="flex-1 p-[60px] overflow-y-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-[32px] font-black text-[#1D1D1F]">{activeMenu}</h1>
          {activeMenu === '激活码生成' && (
            <div className="flex gap-4 items-center bg-white p-2 rounded-full shadow-sm border border-slate-100">
              <span className="pl-4 text-sm font-bold text-slate-500">有效期:</span>
              <select value={genDays} onChange={(e) => setGenDays(Number(e.target.value))} className="bg-transparent border-none outline-none font-black text-blue-600">
                <option value={7}>7天</option><option value={30}>30天</option><option value={365}>一年</option>
              </select>
              <button onClick={generateCode} disabled={isGenerating} className="bg-[#0071E3] text-white px-8 py-2.5 rounded-full font-bold shadow-lg shadow-blue-100">
                {isGenerating ? '正在生成...' : '+ 生成新激活码'}
              </button>
            </div>
          )}
          {activeMenu === '教师管理' && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜索老师账号..." className="w-80 pl-12 pr-6 py-3.5 rounded-2xl bg-white border-none shadow-sm outline-none focus:ring-2 ring-blue-500/20 font-bold text-sm" />
            </div>
          )}
        </div>

        {/* --- 激活码管理：回归原始精美样式 --- */}
        {activeMenu === '激活码生成' && (
          <div style={cardStyle}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-[#F5F5F7] text-[#86868B] text-[13px]">
                  <th className="p-5 font-bold">激活码内容</th>
                  <th className="p-5 font-bold">授权天数</th>
                  <th className="p-5 font-bold">绑定用户</th>
                  <th className="p-5 font-bold">当前状态</th>
                  <th className="p-5 font-bold text-right">操作管理</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-b border-[#F5F5F7] text-[14px]">
                    <td className="p-5">
                      <code className="bg-[#F2F2F7] px-3 py-1.5 rounded-lg font-black text-[#1D1D1F]">{c.code}</code>
                    </td>
                    <td className="p-5 font-bold text-slate-600">{c.valid_days} 天</td>
                    <td className="p-5">
                      {c.teacher_info?.username ? <span className="font-bold text-[#0071E3]">{c.teacher_info.username}</span> : <span className="text-[#C7C7CC]">--</span>}
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1.5 rounded-xl text-[12px] font-black ${c.is_used ? 'text-[#FF3B30] bg-[#FFF2F2]' : 'text-[#34C759] bg-[#F2FAF3]'}`}>
                        {c.is_used ? '已失效' : '未使用'}
                      </span>
                    </td>
                    <td className="p-5 text-right space-x-4">
                      <button onClick={() => { navigator.clipboard.writeText(c.code); alert('已复制'); }} className="text-[#0071E3] font-bold hover:underline">复制</button>
                      <button onClick={async () => { if(confirm('彻底删除？')) { await supabase.from('activation_codes').delete().eq('id', c.id); fetchData(); } }} className="text-[#FF3B30] font-bold hover:underline">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeMenu === '教师管理' && (
          <div style={cardStyle}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-[#F5F5F7] text-[#86868B] text-[13px]">
                  <th className="p-5 font-bold">教师账号</th><th className="p-5 font-bold">到期时间</th><th className="p-5 font-bold">账号状态</th><th className="p-5 font-bold text-right">管理</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => {
                  const isExpired = t.expire_at ? new Date(t.expire_at) < new Date() : true;
                  return (
                    <tr key={t.id} className="border-b border-[#F5F5F7] text-[14px]">
                      <td className="p-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0071E3] text-white flex items-center justify-center font-bold text-[12px]">{t.username.charAt(0).toUpperCase()}</div>
                        <span className="font-bold">{t.username}</span>
                      </td>
                      <td className="p-5 text-[#86868B]">{t.expire_at ? new Date(t.expire_at).toLocaleDateString() : '未激活'}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black ${isExpired ? 'text-[#FF3B30] bg-[#FFF2F2]' : 'text-[#34C759] bg-[#F2FAF3]'}`}>
                          {isExpired ? '已停用' : '正常'}
                        </span>
                      </td>
                      <td className="p-5 text-right space-x-3">
                        <button onClick={() => handleRenew(t.id, t.username)} className="px-4 py-2 bg-[#F2F2F7] rounded-xl text-[13px] font-bold hover:bg-[#E5E5E7]">续费</button>
                        <button onClick={async () => { if(confirm('注销？')) { await supabase.from('profiles').delete().eq('id', t.id); fetchData(); } }} className="px-4 py-2 bg-[#FFF2F2] text-[#FF3B30] rounded-xl text-[13px] font-bold">删除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeMenu === '系统设置' && (
          <div style={cardStyle} className="max-w-xl">
            <h3 className="text-xl font-black mb-8 text-[#1D1D1F]">安全设置</h3>
            <div className="space-y-6">
              <input id="newU" defaultValue={adminConfig.user} className="w-full p-4 bg-[#F5F5F7] rounded-2xl border-none outline-none font-bold" />
              <input id="newP" type="password" placeholder="新的管理密码" className="w-full p-4 bg-[#F5F5F7] rounded-2xl border-none outline-none font-bold" />
              <button onClick={async () => {
                const u = (document.getElementById('newU') as HTMLInputElement).value;
                const p = (document.getElementById('newP') as HTMLInputElement).value;
                await supabase.from('admin_settings').upsert({ id: 1, username: u, password: p });
                alert('已保存');
              }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black">确认修改</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}