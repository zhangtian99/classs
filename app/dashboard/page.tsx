'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
// ✅ 引入路由钩子
import { useRouter, useSearchParams } from 'next/navigation'; 
import { supabase } from "../../lib/supabase"; 
import { Expand, Shrink, User, Trophy, Settings, Loader2, LogOut, Clock, Info, ShieldAlert, Plus, Edit3, Trash2, ChevronDown } from "lucide-react";
import Link from "next/link";

// ✅ 强类型定义 100% 保持您的定义
interface ClassInfo { id: string; name: string; }
interface Student { id: string; name: string; points: number; group_id?: string | null; user_id: string; class_id: string; }
interface GroupDisplay { id: string; name: string; points: number; memberCount: number; }
interface UserProfile { id: string; full_name: string; username: string; created_at: string; activation_code?: string; expire_date?: string; is_expired: boolean; }

// --- 将核心内容提取到内部组件以支持 Suspense ---
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ✅ 核心点 1：从 URL 中读取 class_id 参数
  const urlClassId = searchParams.get('class_id');

  const [activeTab, setActiveTab] = useState('班级管理');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 数据状态
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [currentClass, setCurrentClass] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<GroupDisplay[]>([]);

  // 交互状态
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isClassMenuOpen, setIsClassMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newClassName, setNewClassName] = useState('');

  // 1. 初始化基础数据（教师信息 & 班级列表）
  const initBaseData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: codeData } = await supabase.from('activation_codes').select('code').eq('used_by', user.id).single();
      
      const expireDate = profile?.expire_at ? new Date(profile.expire_at) : null;
      const isExpired = expireDate ? expireDate < new Date() : true;

      setUserData({
        id: user.id,
        full_name: profile?.full_name || '未设置姓名',
        username: profile?.username || user.email || '未知账号',
        created_at: new Date(user.created_at).toLocaleDateString(),
        activation_code: codeData?.code || '暂无激活',
        expire_date: expireDate ? expireDate.toLocaleDateString() : '尚未激活',
        is_expired: isExpired
      });

      // 获取班级列表
      const { data: classData } = await supabase.from('classes').select('*').eq('user_id', user.id).order('created_at');
      const loadedClasses = (classData || []) as ClassInfo[];
      setClasses(loadedClasses);
      
      // ✅ 核心点 2：确定当前班级逻辑（优先匹配 URL ID）
      const targetClass = loadedClasses.find(c => c.id === urlClassId) || loadedClasses[0] || null;
      
      if (targetClass) {
        setCurrentClass(targetClass);
        // 如果 URL 没 ID 或 ID 不符，同步补上，防止刷新重置
        if (urlClassId !== targetClass.id) {
          router.replace(`/dashboard?class_id=${targetClass.id}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [urlClassId, router, currentClass]);

  // 2. 核心联动：获取当前班级的学生和对应的小组榜单
  const fetchClassContent = useCallback(async () => {
    if (!currentClass) {
      setStudents([]);
      setGroups([]);
      return;
    }

    // ✅ 切换时立即清空界面，不留上一个班级的残影
    setStudents([]); 
    setGroups([]);

    const { data: stData } = await supabase.from('students')
      .select('*')
      .eq('class_id', currentClass.id)
      .order('points', { ascending: false });
    
    const { data: gpData } = await supabase.from('groups')
      .select('*')
      .eq('class_id', currentClass.id);

    const classStudents = (stData || []) as Student[];
    setStudents(classStudents);

    const calculatedGroups: GroupDisplay[] = (gpData || []).map(g => {
      const members = classStudents.filter(s => s.group_id === g.id);
      return {
        id: g.id,
        name: g.name,
        points: members.reduce((sum, s) => sum + (s.points || 0), 0),
        memberCount: members.length
      };
    }).sort((a, b) => b.points - a.points);
    
    setGroups(calculatedGroups);
  }, [currentClass]);

  useEffect(() => { initBaseData(); }, [initBaseData]);
  useEffect(() => { fetchClassContent(); }, [fetchClassContent]);

  // --- 所有增删改功能函数 100% 保持您的定义 ---
  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('classes').insert([{ name: newClassName.trim(), user_id: user?.id }]).select().single();
    if (!error) {
      setClasses([...classes, data]);
      setNewClassName('');
      if (!currentClass) setCurrentClass(data);
    }
  };

  const handleUpdateClassName = async (id: string, oldName: string) => {
    const name = prompt("请输入新的班级名称：", oldName);
    if (!name || name === oldName) return;
    const { error } = await supabase.from('classes').update({ name }).eq('id', id);
    if (!error) {
      setClasses(classes.map(c => c.id === id ? { ...c, name } : c));
      if (currentClass?.id === id) setCurrentClass({ ...currentClass, name });
    }
  };

  const handleDeleteClass = async (id: string) => {
    const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', id);
    if (count && count > 0) {
      alert(`无法删除：该班级内还有 ${count} 名学生，请先清空学生。`);
      return;
    }
    if (confirm("确定删除该班级吗？")) {
      await supabase.from('classes').delete().eq('id', id);
      const updated = classes.filter(c => c.id !== id);
      setClasses(updated);
      if (currentClass?.id === id) setCurrentClass(updated[0] || null);
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudentName.trim() || !currentClass) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('students').insert([{ 
      name: newStudentName.trim(), 
      points: 0, 
      user_id: user?.id, 
      class_id: currentClass.id 
    }]);
    if (!error) { setIsAddModalOpen(false); setNewStudentName(''); fetchClassContent(); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };
  const toggleFS = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;

  if (userData?.is_expired) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F5F5F7] p-6 text-center">
        <div className="max-w-md rounded-[45px] bg-white p-12 shadow-2xl border border-red-50">
          <div className="mb-6 flex justify-center"><div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-500"><ShieldAlert size={48} /></div></div>
          <h1 className="mb-4 text-3xl font-black text-slate-800">账号已停用</h1>
          <p className="mb-8 font-bold text-slate-400 leading-relaxed">您的授权已到期（截止：{userData.expire_date}）。</p>
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-black"><LogOut size={18} /> 退出系统</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-8 font-sans">
      <nav className="sticky top-4 z-50 mx-auto flex h-20 max-w-7xl items-center justify-between rounded-3xl border border-white/20 bg-white/80 px-8 shadow-xl backdrop-blur-2xl">
        <div className="text-2xl font-black text-slate-800">智慧班级管理</div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-2xl bg-slate-200/50 p-1">
            {['班级管理', '排行榜', '大冒险', '系统设置'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-5 py-2 text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>{tab}</button>
            ))}
            <div className="relative">
              <button onClick={() => setIsClassMenuOpen(!isClassMenuOpen)} className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow-lg flex items-center gap-1 transition-all active:scale-95">
                {currentClass ? currentClass.name : '选择班级'} <ChevronDown size={14} />
              </button>
              {isClassMenuOpen && (
                <div className="absolute top-[50px] left-0 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in duration-200">
                  {classes.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => { 
                        // ✅ 核心点 3：切换时改变 URL
                        router.push(`/dashboard?class_id=${c.id}`);
                        setIsClassMenuOpen(false); 
                      }} 
                      className={`w-full text-left p-3 rounded-xl text-sm font-bold transition-all ${currentClass?.id === c.id ? 'bg-orange-50 text-orange-600' : 'hover:bg-slate-50'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                  {classes.length === 0 && <div className="p-3 text-xs text-slate-400">暂无班级</div>}
                </div>
              )}
            </div>
          </div>
          <button onClick={toggleFS} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50">{isFullscreen ? <Shrink size={20} /> : <Expand size={20} />}</button>
          
          <div className="relative">
            <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all"><User size={24} className="text-slate-600" /></div>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                <div className="absolute top-[60px] right-0 w-52 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl z-50">
                  <button onClick={() => { setIsProfileOpen(true); setIsDropdownOpen(false); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-bold hover:bg-slate-50 transition-colors"><Info size={16} className="text-blue-500" /> 个人信息</button>
                  <div className="my-1 h-px bg-slate-100" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"><LogOut size={16} /> 退出系统</button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto mt-10 max-w-7xl">
        {activeTab === '系统设置' ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_1fr]">
             <div className="space-y-2">
               <button className="w-full text-left p-4 bg-white shadow-sm border border-slate-100 rounded-2xl font-black text-blue-600">班级设置</button>
               <button className="w-full text-left p-4 text-slate-400 font-bold opacity-50 cursor-not-allowed">其他设置 (待开发)</button>
             </div>
             <div className="rounded-[40px] bg-white p-10 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800">班级管理</h2>
                  <div className="flex gap-2">
                    <input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="输入新班级名" className="px-4 py-2 bg-slate-50 rounded-xl border-none outline-none font-bold text-sm shadow-inner w-40"/>
                    <button onClick={handleAddClass} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all"><Plus size={16} className="inline mr-1"/>添加</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100/50">
                      <span className="font-bold text-slate-700">{c.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateClassName(c.id, c.name)} className="p-2 text-blue-500 hover:bg-blue-100/50 rounded-xl"><Edit3 size={18}/></button>
                        <button onClick={() => handleDeleteClass(c.id)} className="p-2 text-red-500 hover:bg-red-100/50 rounded-xl"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        ) : activeTab === '排行榜' || activeTab === '大冒险' ? (
          <div className="flex h-96 w-full flex-col items-center justify-center rounded-[40px] bg-white text-slate-400 shadow-sm border border-slate-100">
             <Trophy size={48} className="mb-4 animate-bounce" />
             <p className="text-xl font-bold">【{activeTab}】模块正在开发中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.8fr_1fr]">
            <section className="rounded-[40px] bg-white p-10 shadow-sm border border-slate-100">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800">
                   当前班级：<span className="text-blue-600">{currentClass?.name || '未创建班级'}</span>
                </h2>
                <button onClick={() => setIsAddModalOpen(true)} className="rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50" disabled={!currentClass}>+ 录入学生</button>
              </div>
              <div className="space-y-2">
                {students.map(s => (
                  <div key={s.id} className="grid grid-cols-[2fr_1.5fr_1fr] rounded-2xl p-5 hover:bg-slate-50 transition-colors cursor-pointer group">
                    <span className="font-bold text-slate-700 group-hover:text-blue-600">{s.name}</span>
                    <span className="font-mono text-sm text-slate-400 uppercase">S{s.id.slice(0,6)}</span>
                    <span className="text-right text-xl font-black text-blue-600">{s.points} PTS</span>
                  </div>
                ))}
                {students.length === 0 && <div className="py-20 text-center text-slate-300 font-bold">该班级暂无学生数据</div>}
              </div>
            </section>

            <aside className="rounded-[40px] bg-white p-10 shadow-sm border border-slate-100">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-800"><Trophy className="text-orange-500" /> 小组榜单</h2>
                <Link href={`/dashboard/groups?class_id=${currentClass?.id}`} className="text-sm font-bold text-blue-600 hover:underline">管理小组</Link>
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
                {groups.length === 0 && <div className="py-10 text-center text-slate-300 text-sm font-bold">请在“管理小组”中为本班创建小组</div>}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* 🚀 教师档案弹窗 - 100% 还原显示行 */}
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

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/10 backdrop-blur-md">
          <div className="w-96 rounded-[40px] bg-white p-10 shadow-2xl border border-slate-100">
            <h3 className="mb-6 text-center text-xl font-black text-slate-800">录入新同学到 {currentClass?.name}</h3>
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

// ✅ 最终导出：使用 Suspense 包裹以解决 Prerender Error
export default function TeacherDashboard() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}