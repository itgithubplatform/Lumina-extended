"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, Trash2, Edit2, Check, X, AlertCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  accessibility: string[];
}

const ACCESSIBILITY_OPTIONS = [
  { id: "dyslexia", label: "Dyslexia" },
  { id: "visualImpairment", label: "Visual Impairment" },
  { id: "hearingImpairment", label: "Hearing Impairment" },
  { id: "cognitiveDisability", label: "Cognitive Disability" },
];

export default function StudentManager({ classId, onClose }: { classId: string, onClose?: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: "error" | "success" | null; msg: string }>({ type: null, msg: "" });
  
  // Separate loading states
  const [isLoading, setIsLoading] = useState(false);       // For adding a student
  const [isFetching, setIsFetching] = useState(true);     // For loading the roster
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAccess, setEditAccess] = useState<string[]>([]);

  const fetchStudents = async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/classroom/${classId}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classId]);

  const toggleAccess = (id: string, current: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, msg: "" });
    setIsLoading(true);

    try {
      const res = await fetch(`/api/classroom/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, accessibility: selectedAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStatus({ type: "success", msg: data.message });
      setEmail("");
      setName("");
      setSelectedAccess([]);
      fetchStudents();
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStudent = async (studentId: string) => {
    try {
      const res = await fetch(`/api/classroom/${classId}/students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name: editName, accessibility: editAccess }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchStudents();
      }
    } catch (error) {
      console.error("Failed to update student");
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm("Remove this student from the class?")) return;
    try {
      const res = await fetch(`/api/classroom/${classId}/students?studentId=${studentId}`, { method: "DELETE" });
      if (res.ok) fetchStudents();
    } catch (error) {
      console.error("Failed to remove student");
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      
      {/* Modal Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <UserPlus size={20} className="text-blue-500" /> Manage Students
        </h3>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        
        {/* Add Student Form */}
        <form onSubmit={handleAddStudent} className="mb-8 p-5 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Student Email *</label>
              <input
                type="email"
                placeholder="Required for OAuth Login"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Student Name</label>
              <input
                type="text"
                placeholder="Optional"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
          </div>
          
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Pre-configure Accessibility Profile:</p>
            <div className="flex flex-wrap gap-3">
              {ACCESSIBILITY_OPTIONS.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm bg-white px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedAccess.includes(opt.id)}
                    onChange={() => toggleAccess(opt.id, selectedAccess, setSelectedAccess)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button disabled={isLoading} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:bg-blue-300 flex justify-center">
            {isLoading ? "Provisioning Profile..." : "Add & Configure Student"}
          </button>
        </form>

        {status.msg && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <AlertCircle size={18} /> {status.msg}
          </div>
        )}

        {/* Student List Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4 border-b pb-2">
            Enrolled Students {!isFetching && `(${students.length})`}
          </h4>
          
          <div className="space-y-3">
            {isFetching ? (
              /* Beautiful Framer Motion Loader Container */
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full shadow-sm"
                />
                <p className="text-sm text-gray-500 font-medium tracking-wide animate-pulse">
                  Retrieving class roster...
                </p>
              </div>
            ) : students.length === 0 ? (
              <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl border border-dashed">
                No students provisioned yet.
              </p>
            ) : (
              students.map((student) => (
                <motion.div 
                  key={student.id} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm gap-4 hover:border-blue-200 transition-colors"
                >
                  <div className="flex-1">
                    {editingId === student.id ? (
                      <div className="space-y-3">
                        <input className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                        <div className="flex flex-wrap gap-2">
                          {ACCESSIBILITY_OPTIONS.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-1 text-xs bg-gray-50 px-2 py-1 border rounded cursor-pointer">
                              <input type="checkbox" checked={editAccess.includes(opt.id)} onChange={() => toggleAccess(opt.id, editAccess, setEditAccess)} />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-gray-800">{student.name || "Pending Name"} <span className="text-sm font-normal text-gray-500">({student.email})</span></p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {student.accessibility.length === 0 && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">Standard Profile</span>}
                          {student.accessibility.map(acc => (
                            <span key={acc} className="text-xs bg-purple-100 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-md font-medium">
                              {ACCESSIBILITY_OPTIONS.find(o => o.id === acc)?.label || acc}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 self-end sm:self-center">
                    {editingId === student.id ? (
                      <>
                        <button onClick={() => handleUpdateStudent(student.id)} className="p-2 text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 rounded-lg transition-all"><Check size={18}/></button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-gray-500 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-lg transition-all"><X size={18}/></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(student.id); setEditName(student.name || ""); setEditAccess(student.accessibility); }} className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100 rounded-lg transition-all">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleRemoveStudent(student.id)} className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 rounded-lg transition-all">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}