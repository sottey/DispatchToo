"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import {
  IconGrid,
  IconCalendar,
  IconCheckCircle,
  IconDocument,
  IconSearch,
  IconChevronLeft,
  IconChevronDown,
  IconSignOut,
  IconSun,
  IconMoon,
  IconBolt,
} from "@/components/icons";

interface SidebarProps {
  onSearchOpen: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: IconGrid },
  { href: "/dispatch", label: "Dispatch", icon: IconCalendar },
  { href: "/tasks", label: "Tasks", icon: IconCheckCircle },
  { href: "/notes", label: "Notes", icon: IconDocument },
];

export function Sidebar({ onSearchOpen }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    main: true,
    account: true,
  });

  // Read collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  function toggleSection(key: string) {
    if (collapsed) return;
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={`flex flex-col bg-gray-950 text-gray-400 transition-all duration-300 ease-in-out h-screen flex-shrink-0 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0 border-b border-gray-800/50">
        <IconBolt className="w-6 h-6 text-blue-400 flex-shrink-0" />
        <span
          className={`text-lg font-bold text-white whitespace-nowrap transition-all duration-300 ${
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          }`}
        >
          Dispatch
        </span>
      </div>

      {/* Search trigger */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={onSearchOpen}
          className={`flex items-center gap-2 w-full rounded-lg border border-gray-800 bg-gray-900 text-gray-500 transition-colors hover:border-gray-700 hover:text-gray-400 ${
            collapsed ? "px-2.5 py-2 justify-center" : "px-3 py-2"
          }`}
        >
          <IconSearch className="w-4 h-4 flex-shrink-0" />
          <span
            className={`text-sm whitespace-nowrap transition-all duration-300 ${
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}
          >
            Search...
          </span>
          {!collapsed && (
            <kbd className="ml-auto text-xs text-gray-600 bg-gray-800 rounded px-1.5 py-0.5">
              Ctrl+K
            </kbd>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {/* Main Menu section */}
        <div>
          <button
            onClick={() => toggleSection("main")}
            className={`flex items-center w-full mb-1 ${
              collapsed ? "justify-center px-2" : "justify-between px-2"
            }`}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap transition-all duration-300 ${
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              }`}
            >
              Main Menu
            </span>
            {!collapsed && (
              <IconChevronDown
                className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${
                  sectionsOpen.main ? "" : "-rotate-90"
                }`}
              />
            )}
          </button>

          {(sectionsOpen.main || collapsed) && (
            <ul className="space-y-0.5">
              {MAIN_NAV.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-gray-800/60 text-white"
                          : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
                      } ${collapsed ? "justify-center px-2" : ""}`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span
                        className={`whitespace-nowrap transition-all duration-300 ${
                          collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Account section */}
        <div>
          <button
            onClick={() => toggleSection("account")}
            className={`flex items-center w-full mb-1 ${
              collapsed ? "justify-center px-2" : "justify-between px-2"
            }`}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap transition-all duration-300 ${
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              }`}
            >
              Account
            </span>
            {!collapsed && (
              <IconChevronDown
                className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${
                  sectionsOpen.account ? "" : "-rotate-90"
                }`}
              />
            )}
          </button>

          {(sectionsOpen.account || collapsed) && session?.user && (
            <ul className="space-y-0.5">
              {/* User info */}
              <li
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  collapsed ? "justify-center px-2" : ""
                }`}
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-5 h-5 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0" />
                )}
                <span
                  className={`text-sm text-gray-300 truncate whitespace-nowrap transition-all duration-300 ${
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  }`}
                >
                  {session.user.name || session.user.email}
                </span>
              </li>

              {/* Theme toggle */}
              <li>
                <button
                  onClick={toggleTheme}
                  title={collapsed ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : undefined}
                  className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 transition-colors ${
                    collapsed ? "justify-center px-2" : ""
                  }`}
                >
                  {theme === "dark" ? (
                    <IconSun className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <IconMoon className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span
                    className={`whitespace-nowrap transition-all duration-300 ${
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    }`}
                  >
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </span>
                </button>
              </li>

              {/* Sign out */}
              <li>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title={collapsed ? "Sign out" : undefined}
                  className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 transition-colors ${
                    collapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <IconSignOut className="w-5 h-5 flex-shrink-0" />
                  <span
                    className={`whitespace-nowrap transition-all duration-300 ${
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    }`}
                  >
                    Sign out
                  </span>
                </button>
              </li>
            </ul>
          )}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-800/50 p-3 flex-shrink-0">
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-full rounded-lg py-2 text-gray-500 hover:bg-gray-800/40 hover:text-gray-300 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconChevronLeft
            className={`w-5 h-5 transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}
