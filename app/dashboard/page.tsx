'use client';

import React, { useState, useEffect, useCallback } from 'react';
// ✅ 物理路径修正：从 dashboard 退到 app 再退到根目录进入 lib
import { supabase } from "../../lib/supabase"; 
import { Expand, Shrink, User, Trophy, Settings, Loader2, LogOut, Clock, Info, ShieldAlert } from "lucide-react";
import Link from "next/link";

// ✅ 强类型定义
interface Student { id: string; name: string; points: number; group_id?: string | null; user_id: string; }
interface GroupDisplay { id: string; name: string; points: number; memberCount: number; }
interface UserProfile { id: string; full_name: string; username: string; created_at: string; activation_code?: string; expire_date?: string; is_expired: boolean; }

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('班级管理');
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<GroupDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 菜单与弹窗状态
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newStudentName, setNewStudentName] = useState('');

  // 1. 数据获取（带 user_id 隔离）
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: stData } = await supabase.from('students').select('*').eq('user_id', user.id).order('points', { ascending: false });
      const { data: gpData } = await supabase.from('groups').select('*').eq('user_id', user.id);

      const allStudents = (stData || []) as Student[];
      setStudents(allStudents);

      const calculatedGroups: GroupDisplay[] = (gpData || []).map(g => {
        const members = allStudents.filter(s => s.group_id === g.id);
        return {
          id: g.id,
          name: g.name,
          points: members.reduce((sum, s) => sum + (s.points || 0), 0),
          memberCount: members.length
        };
      }).sort((a, b) => b.points - a.points);
      setGroups(calculatedGroups);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. 获取教师个人信息并进行【过期校验】
  const fetchUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: codeData } = await supabase.from('activation_codes').select('code').eq('used_by', user.id).single();
      
      // 校验逻辑
      const expireDate = profile?.expire_at ? new Date(profile.expire_at) : null;
      const now = new Date();
      const isExpired = expireDate ? expireDate < now : true; // 如果没设置日期也视为过期

      setUserData({
        id: user.id,
        full_name: profile?.full_name || '未设置姓名',
        username: profile?.username || user.email || '未知账号',
        created_at: new Date(user.created_at).toLocaleDateString(),
        activation_code: codeData?.code || '暂无激活',
        expire_date: expireDate ? expireDate.toLocaleDateString() : '尚未激活',
        is_expired: isExpired
      });
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchUserData();
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, [fetchData, fetchUserData]);

  const toggleFS = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleCreateStudent = async () => {
    if (!newStudentName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('students').insert([{ name: newStudentName.trim(), points: 0, user_id: user.id }]);
    if (!error) { setIsAddModalOpen(false); setNewStudentName(''); fetchData(); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;

  // 🚀 过期锁定界面
  if (userData?.is_expired) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F5F5F7] p-6 text-center">
        <div className="max-w-md rounded-[45px] bg-white p-12 shadow-2xl border border-red-50">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-500">
              <ShieldAlert size={48} />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-black text-slate-800">账号已停用</h1>
          <p className="mb-8 font-bold text-slate-400 leading-relaxed">
            您的使用授权已到期（截止：{userData.expire_date}）。请联系管理员提供新的激活码以继续使用系统。
          </p>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-black"
          >
            <LogOut size={18} /> 退出系统
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-8 font-sans">
      
      {/* 顶部导航 */}
      <nav className="sticky top-4 z-50 mx-auto flex h-20 max-w-7xl items-center justify-between rounded-3xl border border-white/20 bg-white/80 px-8 shadow-xl backdrop-blur-2xl">
        <div className="text-2xl font-black text-slate-800">智慧班级管理</div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-2xl bg-slate-200/50 p-1">
            {['班级管理', '排行榜', '大冒险', '系统设置'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-5 py-2 text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>{tab}</button>
            ))}
            <button className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow-lg transition-all hover:bg-orange-600">切换班级 ▾</button>
          </div>

          <button onClick={toggleFS} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
            {isFullscreen ? <Shrink size={20} /> : <Expand size={20} />}
          </button>
          
          {/* 头像及下拉菜单 */}
          <div className="relative">
            <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all">
              <User size={24} className="text-slate-600" />
            </div>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                <div className="absolute top-[60px] right-0 w-52 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl z-50">
                  <button onClick={() => { setIsProfileOpen(true); setIsDropdownOpen(false); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-bold hover:bg-slate-50 transition-colors">
                    <Info size={16} className="text-blue-500" /> 个人信息
                  </button>
                  <div className="flex items-center gap-3 p-3 text-xs font-bold text-slate-500">
                    <Clock size={16} className="text-orange-500" /> 有效期至：{userData?.expire_date}
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={16} /> 退出系统
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 主界面 */}
      <main className="mx-auto mt-10 max-w-7xl">
        {activeTab === '系统设置' ? (
          <div className="flex h-96 w-full flex-col items-center justify-center rounded-[40px] bg-white text-slate-400 shadow-sm border border-slate-100">
             <Settings size={48} className="mb-4 animate-pulse" />
             <p className="text-xl font-bold">模块正在开发中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.8fr_1fr]">
            {/* 学生管理区 */}
            <section className="rounded-[40px] bg-white p-10 shadow-sm border border-slate-100">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800">学生积分管理</h2>
                <button onClick={() => setIsAddModalOpen(true)} className="rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-blue-700">+ 录入学生</button>
              </div>
              <div className="space-y-2">
                {students.map(s => (
                  <div key={s.id} className="grid grid-cols-[2fr_1.5fr_1fr] rounded-2xl p-5 hover:bg-slate-50 transition-colors cursor-pointer group">
                    <span className="font-bold text-slate-700 group-hover:text-blue-600">{s.name}</span>
                    <span className="font-mono text-sm text-slate-400">S{s.id.slice(0,6).toUpperCase()}</span>
                    <span className="text-right text-xl font-black text-blue-600">{s.points} PTS</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 小组排行榜 */}
            <aside className="rounded-[40px] bg-white p-10 shadow-sm border border-slate-100">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-800"><Trophy className="text-orange-500" /> 小组榜单</h2>
                <Link href="/dashboard/groups" className="text-sm font-bold text-blue-600 hover:underline">管理小组</Link>
              </div>
              <div className="flex flex-col gap-4">
                {groups.map((g, idx) => (
                  <div key={g.id} className="flex items-center justify-between rounded-3xl bg-slate-50 p-6 border border-slate-100/50">
                    <div className="flex items-center gap-4">
                      <span className={`text-xl font-black ${idx < 3 ? 'text-orange-500' : 'text-slate-400'}`}>{idx + 1}</span>
                      <span className="font-bold text-slate-700">{g.name}</span>
                    </div>
                    <span className="text-2xl font-black text-orange-500">{g.points}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* 🚀 个人中心弹窗 - 垂直紧凑布局 */}
      {isProfileOpen && userData && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl">
          <div className="w-[400px] rounded-[45px] bg-white p-12 shadow-2xl">
            <h2 className="mb-10 text-center text-2xl font-black text-slate-800">教师档案</h2>
            <div className="space-y-5">
              <div className="flex items-center text-sm font-bold border-b border-slate-50 pb-2"><span className="w-24 text-slate-400 font-bold">教师姓名:</span><span className="text-slate-800 font-black">{userData.full_name}</span></div>
              <div className="flex items-center text-sm font-bold border-b border-slate-50 pb-2"><span className="w-24 text-slate-400 font-bold">登录账号:</span><span className="text-slate-800 font-black">{userData.username}</span></div>
              <div className="flex items-center text-sm font-bold border-b border-slate-50 pb-2"><span className="w-24 text-slate-400 font-bold">授权到期:</span><span className="text-orange-600 font-black">{userData.expire_date}</span></div>
              <div className="flex items-center text-sm font-bold border-b border-slate-50 pb-2"><span className="w-24 text-slate-400 font-bold">激活码:</span><code className="rounded-md bg-blue-50 px-2 py-1 text-blue-600 font-black">{userData.activation_code}</code></div>
              <div className="flex items-center text-sm font-bold"><span className="w-24 text-slate-400 font-bold">注册时间:</span><span className="text-slate-800 font-black">{userData.created_at}</span></div>
            </div>
            <button onClick={() => setIsProfileOpen(false)} className="mt-12 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-black">确认并返回仪表盘</button>
          </div>
        </div>
      )}

      {/* 录入学生弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/10 backdrop-blur-md">
          <div className="w-96 rounded-[40px] bg-white p-10 shadow-2xl border border-slate-100">
            <h3 className="mb-6 text-center text-xl font-black text-slate-800">录入新同学</h3>
            <input autoFocus value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="mb-8 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="请输入学生姓名" />
            <div className="flex gap-4">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 rounded-2xl bg-slate-100 py-4 font-bold text-slate-500">取消</button>
              <button onClick={handleCreateStudent} className="flex-1 rounded-2xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-700 shadow-blue-100">确认录入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}