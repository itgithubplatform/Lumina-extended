"use client";
import React, { useState } from 'react';
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, X, FileText, Upload, Users, Share, Check, UserPlus } from 'lucide-react';
import FileUpload from './fileUpload';
import { Status } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { useSession } from 'next-auth/react';
import Loader from '../ui/loader';
import StudentManager from './studentManager';


export interface classroom {
  name: string;
  id: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
  teacherId: string;
  files: {
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    link: string;
    status: Status;
    classId: string;
  }[];
  _count: {
    students: number;
  };
}

export default function ShowClassRoom({ classroomData }: { classroomData: classroom }) {
  const [classroom, setClassroom] = React.useState<classroom>(classroomData);
  const [isCopied, setIsCopied] = useState(false);
  const { data: session, status } = useSession();
  const [showStudentManager, setShowStudentManager] = useState(false); // Modal state

  React.useEffect(() => {
    const interval = setInterval(async () => {

      const processingFiles = classroom.files.filter(f => f.status === "processing");
      if (processingFiles.length === 0) return;

      for (const file of processingFiles) {
        try {
          const res = await fetch(`/api/files/upload?fileId=${file.id}`);
          if (!res.ok) continue;

          const data = await res.json();
          if (data.status !== file.status) {
            setClassroom(prev => ({
              ...prev,
              files: prev.files.map(f =>
                f.id === file.id ? { ...f, status: data.status } : f
              )
            }));
          }
        } catch (err) {
          console.error("Error polling file status:", err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [classroom.files]);
  const router = useRouter();
  const handleCopyClick = async () => {
    try {

      await navigator.clipboard.writeText(`${process.env.NEXTAUTH_URL || 'https://lumina-950190429451.asia-south1.run.app'}/api/classroom/join?id=${classroom.id}`);

      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, 5000);

    } catch (err) {
      console.error('Failed to copy text: ', err);
      // You could also set an error state here to show a different icon
    }
  };

  if (status === 'loading') {
    return <Loader />
  }
  return (
    <div className="p-4 md:p-8 mt-14 max-w-6xl mx-auto min-h-screen">
      {/* Header Section */}
      <>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 mt-8">
        <div className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-3xl border border-gray-200/80 p-8 md:p-12 shadow-sm overflow-hidden">
          
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-200/20 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
              
              {/* Left Content */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-6">
                  <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg">
                    <BookOpen className="text-white" size={32} />
                  </motion.div>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2"> 
                        {classroom.name}
                      </h1>
                      <button 
                        title='Copy Link'
                        onClick={handleCopyClick}
                        disabled={isCopied}
                        className="text-gray-500 flex items-center p-2 rounded-md transition-colors duration-200 hover:bg-gray-100"
                      >
                        {isCopied ? <Check size={20} className="text-green-500" /> : <Share size={20} className="text-blue-500" />}
                      </button>
                    </div>                 
                    <p className="text-lg text-gray-600 flex items-center gap-2">
                      <FileText size={20} className="text-blue-500" />
                      {classroom.subject}
                    </p>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-5 py-4 rounded-xl border border-gray-200/80 shadow-sm">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <Users className="text-green-600" size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{classroom._count.students}</p>
                      <p className="text-sm text-gray-500">Students Enrolled</p>
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-5 py-4 rounded-xl border border-gray-200/80 shadow-sm">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <FileText className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{classroom.files.length}</p>
                      <p className="text-sm text-gray-500">Total Files</p>
                    </div>
                  </motion.div>
                </div>

                {/* Quick Actions - Changed to a Button */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap items-center gap-3">
                  {session?.user.role === "teacher" && (
                    <button 
                      onClick={() => setShowStudentManager(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
                    >
                      <UserPlus size={20} />
                      Manage Students
                    </button>
                  )}
                </motion.div>
              </div>

              {/* Right Visual Element */}
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="lg:w-48 flex-shrink-0">
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 rounded-2xl p-6 border border-blue-200/50">
                  <div className="text-center">
                    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                      <BookOpen className="text-blue-600 mx-auto" size={32} />
                    </div>
                    <p className="text-sm text-gray-600 font-medium">Active Classroom</p>
                    <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mt-2"></div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* The Modal Overlay */}
      <AnimatePresence>
        {showStudentManager && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setShowStudentManager(false)} // 1. Closes when clicking the blur
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()} // 2. Stops clicks inside the modal from closing it
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <StudentManager classId={classroom.id} onClose={() => setShowStudentManager(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
      {/* File Upload Section - Placed after student count */}
      {
        session?.user.role === "teacher" &&
        <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-12" >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <motion.div whileHover={{ scale: 1.1 }} className="bg-gradient-to-br from-orange-500 to-red-500 p-2 rounded-xl" >
                <Upload className="text-white" size={24} />
              </motion.div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Upload New File</h2>
                <p className="text-gray-500 text-sm mt-1">Share learning materials with your students</p>
              </div>
            </div>
            <FileUpload setClassroom={setClassroom} classroomId={classroom.id} />
          </div>
        </motion.section>
      }

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl"
          >
            <FileText className="text-white" size={24} />
          </motion.div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Class Files</h2>
            <p className="text-gray-500 text-sm mt-1">All uploaded learning materials</p>
          </div>
        </div>

        {classroom.files.length > 0 ? (
          <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 cursor-default" layout>
            {classroom.files.map((file, index) => (
              file.status === "completed" ? (
                <div key={file.id} onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/file/${file.id}`);
                }}>
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-blue-100 p-3 rounded-xl">
                        <FileText className="text-blue-600" size={24} />
                      </div>
                      {session?.user.role === "teacher" && (
                        <motion.p
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          whileHover={{ scale: 1.1 }}
                          className="text-red-600 hover:text-red-700 p-2 rounded-full hover:bg-blue-50 transition-colors"
                          title="Delete File"
                        >
                          <X size={18} />
                        </motion.p>)}
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {file.name}
                        </h3>
                        <p className="text-xs text-gray-500">Click the link icon to view</p>
                      </div>

                    </div>
                  </motion.div>
                </div>) :
                (<motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-blue-100 p-3 rounded-xl">
                      <FileText className="text-blue-600" size={24} />
                    </div>
                    {session?.user.role === "teacher" && (<motion.p
                      whileHover={{ scale: 1.1 }}
                      className="text-red-600 hover:text-red-700 p-2 rounded-full hover:bg-blue-50 transition-colors"
                      title="View File"
                    >
                      <X size={18} />
                    </motion.p>)}
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-500">Click the link icon to view</p>
                    </div>
                    {file.status === "processing" && (
                      <span className="ml-2 text-xs bg-amber-100 px-2 py-1 rounded-full border border-amber-200 text-yellow-600 font-medium">
                        Processing
                      </span>
                    )}
                    {file.status === "failed" && (
                      <span className="ml-2 text-xs bg-red-100 px-2 py-1 rounded-full border border-red-200 text-red-600 font-medium">
                        Failed
                      </span>
                    )}
                  </div>
                </motion.div>)
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white/50 rounded-2xl border-2 border-dashed border-gray-300"
          >
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 text-lg font-medium">No files uploaded yet</p>
            <p className="text-gray-400 text-sm mt-2">
              Upload your first file using the section above
            </p>
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}
