import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import {
  LayoutDashboard,
  Flag,
  BadgeCheck,
  Users,
  FolderKanban,
  Globe2,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../auth/Auth'
import { api, sessionStore } from '../api/client'
import { initials, label } from '../lib/format'
export function Logo() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path
            d="M9 28V14l11 8 11-8v14M9 14l11-7 11 7"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        matchlab<span className="brand-caption">Панель администратора</span>
      </span>
    </div>
  )
}
const links = [
  { to: '/', title: 'Обзор', icon: LayoutDashboard, group: 'Рабочее пространство' },
  { to: '/tickets', title: 'Жалобы', icon: Flag },
  { to: '/achievements', title: 'Достижения', icon: BadgeCheck },
  { to: '/users', title: 'Пользователи', icon: Users, group: 'Управление' },
  { to: '/projects', title: 'Проекты', icon: FolderKanban },
  { to: '/domains', title: 'Почтовые домены', icon: Globe2 },
  { to: '/staff', title: 'Сотрудники', icon: ShieldCheck, admin: true },
  { to: '/audit', title: 'Журнал действий', icon: History },
]
export function Layout() {
  const { staff } = useAuth()
  const [mobile, setMobile] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setMobile(false)
  }, [location.pathname])
  const logout = useMutation({
    mutationFn: () => api('/sessions/current', { method: 'DELETE' }),
    onSettled: () => sessionStore.set(null),
  })
  const navigation = (
    <>
      <Logo />
      <nav aria-label="Основная навигация">
        {links
          .filter((l) => !l.admin || staff?.role === 'administrator')
          .map((l) => (
            <div key={l.to}>
              {l.group && <p className="nav-group">{l.group}</p>}
              <NavLink to={l.to} end={l.to === '/'}>
                <l.icon size={19} />
                {l.title}
              </NavLink>
            </div>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="workspace-note">
          <ShieldCheck size={19} />
          <div>
            Только для сотрудников<span>Служебный доступ MatchLab</span>
          </div>
        </div>
        <NavLink to="/settings" className="settings-link">
          <Settings size={18} />
          Настройки аккаунта
        </NavLink>
        <button className="logout" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={18} />
          Выйти
        </button>
      </div>
    </>
  )
  const title =
    location.pathname === '/settings'
      ? 'Аккаунт'
      : links.find((l) => l.to !== '/' && location.pathname.startsWith(l.to))?.title || 'Обзор'
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <aside className="sidebar">{navigation}</aside>
      <Dialog.Root open={mobile} onOpenChange={setMobile}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="mobile-sidebar">
            <Dialog.Title className="sr-only">Навигация</Dialog.Title>
            <Dialog.Description className="sr-only">
              Разделы административной панели
            </Dialog.Description>
            <Dialog.Close className="mobile-close icon-button" aria-label="Закрыть меню">
              <X size={20} />
            </Dialog.Close>
            {navigation}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Открыть меню"
            >
              <Menu size={21} />
            </button>
            <span>Управление</span>
            <span className="slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <a className="docs-link" href="/docs/" target="_blank" rel="noreferrer">
              API-документация
              <ArrowUpRight size={14} />
            </a>
            <span className="topbar-divider" />
            <NavLink to="/settings" className="account-chip">
              <span className="avatar">{initials(staff?.display_name || '')}</span>
              <span>
                <strong>{staff?.display_name}</strong>
                <small>{label(staff?.role || '')}</small>
              </span>
            </NavLink>
          </div>
        </header>
        <main id="main" className="main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>MatchLab · Администрирование</span>
          <span>Рабочее пространство команды</span>
        </footer>
      </div>
    </div>
  )
}
