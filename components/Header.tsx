"use client";

import { Bell, User } from "lucide-react";
import { MobileMenuButton } from "./Sidebar";

interface HeaderProps {
  title: string;
  onMobileMenu: () => void;
}

export default function Header({ title, onMobileMenu }: HeaderProps) {
  return (
    <header className="bg-[#242424] border-b border-[#3A3A3A] px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onMobileMenu} />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#CC2229] rounded-full" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-[#3A3A3A]">
          <div className="w-8 h-8 bg-[#CC2229] rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-white font-medium leading-none">Admin</p>
            <p className="text-xs text-gray-500 mt-0.5">Duro Concretos</p>
          </div>
        </div>
      </div>
    </header>
  );
}
