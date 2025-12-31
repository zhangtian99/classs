'use client';

import React, { useState, useEffect, Suspense } from "react";
import { Search, ArrowLeft, Save, Loader2, Plus } from "lucide-react"; 
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase"; 

interface Student { id: string; name: string; points: number; group_id?: string | null; }
interface Group { id: string; name: string; leader_id: string | null; members: Student[]; }

function GroupManagerContent() {
  const searchParams = useSearchParams();
  // ✅ 核心点 1：获取地址栏中的班级 ID
  const classId = searchParams.get('class_id');

  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function initData() {
      if (!classId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: stData } = await supabase.from('students').select('*').eq('user_id', user.id).eq('class_id', classId).order('points', { ascending: false });
      const { data: gpData } = await supabase.from('groups').select('*').eq('user_id', user.id).eq('class_id', classId);
      
      const allStudents = (stData || []) as Student[];
      const allGroupsData = (gpData || []) as { id: string; name: string, leader_id: string | null }[];
      
      setGroups(allGroupsData.map(g => ({ ...g, members: allStudents.filter(s => s.group_id === g.id) })));
      setUnassignedStudents(allStudents.filter(s => !s.group_id));
      setLoading(false);
    }
    initData();
  }, [classId]);

  const saveChanges = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !classId) return;
    setSaving(true);
    try {
      const { error: gError } = await supabase.from('groups').upsert(
        groups.map(g => ({ id: g.id, name: g.name, leader_id: g.leader_id, user_id: user.id, class_id: classId }))
      );
      if (gError) throw gError;

      for (const g of groups) {
        if (g.members.length > 0) {
          await supabase.from('students').update({ group_id: g.id }).in('id', g.members.map(m => m.id));
        }
      }
      if (unassignedStudents.length > 0) {
        await supabase.from('students').update({ group_id: null }).in('id', unassignedStudents.map(s => s.id));
      }
      alert("✅ 小组分配已保存");
    } catch (err: any) {
      alert(`❌ 保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const onDrop = (e: React.DragEvent, groupId: string) => {
    const sid = e.dataTransfer.getData("sid");
    const student = unassignedStudents.find(s => s.id === sid);
    if (student) {
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, members: [...g.members, student] } : g));
      setUnassignedStudents(prev => prev.filter(s => s.id !== sid));
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      <header className="max-w-[1440px] mx-auto flex justify-between items-center mb-10">
        {/* ✅ 核心点 2：返回仪表盘时带回班级 ID */}
        <Link href={`/dashboard?class_id=${classId}`} className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800">
          <ArrowLeft size={20} /> 返回仪表盘
        </Link>
        <h1 className="text-3xl font-black">小组分配管理</h1>
        <button onClick={saveChanges} disabled={saving} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {saving ? "正在同步..." : "确认保存更改"}
        </button>
      </header>

      <div className="max-w-[1440px] mx-auto grid grid-cols-[380px_1fr] gap-10">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-[calc(100vh-250px)] overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-lg font-black mb-4">待分配 ({unassignedStudents.length})</h3>
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜索姓名..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {unassignedStudents.filter(s => s.name.includes(searchTerm)).map(s => (
              <div key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData("sid", s.id)} className="bg-slate-50 p-5 rounded-2xl cursor-grab hover:shadow-md transition-all">
                <div className="font-bold text-slate-700">{s.name}</div>
                <div className="text-blue-600 font-black text-xs mt-1">{s.points} PTS</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 auto-rows-min overflow-y-auto pr-4 h-[calc(100vh-250px)]">
          {groups.map(g => (
            <div key={g.id} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, g.id)} className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-8 min-h-[300px] hover:border-blue-300 transition-colors">
              <input value={g.name} onChange={e => setGroups(prev => prev.map(item => item.id === g.id ? { ...item, name: e.target.value } : item))} className="text-xl font-black bg-transparent border-none outline-none mb-6 w-full text-slate-800" />
              <div className="flex flex-col gap-3">
                {g.members.map(m => (
                  <div key={m.id} className="bg-slate-50 p-4 rounded-xl flex justify-between items-center group/member">
                    <span className="font-bold text-slate-700">{m.name}</span>
                    <button onClick={() => setGroups(prev => prev.map(item => item.id === g.id ? { ...item, leader_id: item.leader_id === m.id ? null : m.id } : item))} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${g.leader_id === m.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>队长</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setGroups([...groups, { id: crypto.randomUUID(), name: `新小组`, leader_id: null, members: [] }])} className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 h-24 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:border-blue-500 transition-all"><Plus size={32} /></button>
        </div>
      </div>
    </div>
  );
}

export default function GroupManagementPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>}>
      <GroupManagerContent />
    </Suspense>
  );
}