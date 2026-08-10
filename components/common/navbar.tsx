"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User, Settings, LogOut, Trash2 } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<null|HTMLDivElement>(null);
  const navref = useRef<null|HTMLElement>(null);  
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const user = session?.user;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event:MouseEvent) {
      if (dropdownRef.current && event.target instanceof Node && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (navref.current && event.target instanceof Node && !navref.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      console.log("Delete account triggered");
    }
  };

  // Check if route is active
  const isActiveRoute = (route: string) => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(route);
  };

  // Navigation items - only dashboard and home
  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/adhd', label: 'Adhd' },
  ];

  return (
    <motion.nav
      ref={navref}
      initial={{ y: 0 }}
      animate={{ 
        y: isScrolled ? 8 : 0,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`fixed top-0 left-1/2 transform -translate-x-1/2 z-30 transition-all duration-300 ${
        isScrolled 
          ? "w-[95%] max-w-6xl rounded-3xl shadow-xl bg-white/95 backdrop-blur-md border border-gray-200/60 mt-4" 
          : "w-full bg-white/80 backdrop-blur-sm border-b border-gray-200/80"
      }`}
    >
      <div className={`mx-auto ${isScrolled ? "px-6" : "px-4 sm:px-6 lg:px-8"}`}>
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3 cursor-pointer"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-base md:text-lg font-bold">L+</span>
                </div>
                <motion.span 
                  initial={{ opacity: 1 }}
                  animate={{ opacity: isScrolled ? 0 : 1 }}
                  className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                >
                  Lumina+
                </motion.span>
              </motion.div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link 
                key={item.href}
                href={item.href}
                className="relative text-gray-700 hover:text-blue-600 font-medium transition-colors py-2"
              >
                {item.label}
                {isActiveRoute(item.href) && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-2">
            {/* Profile Dropdown */}
            {status === "unauthenticated" && (
              <button 
                onClick={() => router.push("/auth/signin")} 
                className="bg-blue-500 rounded-xl hover:bg-blue-600 text-white py-2 px-4 text-sm font-semibold transition-colors"
              >
                Login
              </button>
            )}
            
            {user && (
              <div className="relative" ref={dropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center space-x-3 rounded-xl px-3 py-2 transition-all ${
                    isScrolled 
                      ? "bg-gray-100/80 hover:bg-gray-200/80" 
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    {user.image ? (
                      <img src={user.image.toString()} alt={user.name || 'User'} className="w-8 h-8 rounded-full" />
                    ) : (
                      <User className="text-white" size={16} />
                    )}
                  </div>
                  <motion.span 
                    initial={{ opacity: 1 }}
                    className="text-gray-700 text-sm font-medium"
                  >
                    {user.name?.split(' ')[0] || 'User'}
                  </motion.span>
                </motion.button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute -right-14 md:-right-9 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200/80 overflow-hidden"
                    >
                      {/* Profile Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            {user.image ? (
                              <img src={user.image} alt={user.name || 'User'} className="w-16 h-16 rounded-full" />
                            ) : (
                              <User className="text-white" size={24} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-800 text-lg">
                              {user.name || 'User'}
                            </h3>
                            <p className="text-gray-600 text-sm">
                              {user.email || 'No email provided'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* User Details */}
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">User Type</p>
                            <p className="font-medium text-gray-800 capitalize">
                              {user.role || 'Not specified'}
                            </p>
                          </div>
                          {session.user.accessibility?.[0] && (
                            <div>
                              <p className="text-gray-500">Accessibility</p>
                              <p className="font-medium text-gray-800 capitalize">
                                {session.user.accessibility?.[0]==="dyslexia"?"Normal":session.user.accessibility?.[0]}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 pt-4 border-t border-gray-200">
                          <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                          >
                            <LogOut size={18} />
                            <span>Sign Out</span>
                          </button>
                          
                          {/* Delete Account Button */}
                          <button 
                            onClick={handleDeleteAccount}
                            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-2"
                          >
                            <Trash2 size={18} />
                            <span>Delete Account</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200"
            >
              <div className="py-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-3 rounded-xl font-medium transition-colors relative ${
                      isActiveRoute(item.href)
                        ? "text-blue-600 bg-transparent"
                        : "text-gray-700 "
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                    {isActiveRoute(item.href) && (
                      <motion.div
                        layoutId="mobileActiveIndicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600 rounded-r-full"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}