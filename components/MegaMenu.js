'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Scale, ChevronDown, ExternalLink, X, Menu } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// ─── Resolve URL ─────────────────────────────────────────────────
function resolveUrl(item) {
  if (item.type === 'section') return item.url; // #beranda
  return item.url || '#';
}

// ─── Desktop Mega Menu Dropdown ──────────────────────────────────
function MegaDropdown({ item, children, scrolled, activeNav }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { lang } = useLanguage();
  const label = lang === 'en' && item.labelEn ? item.labelEn : item.label;
  const isActive = activeNav === item.id;

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Tentukan kolom berdasarkan jumlah children
  const cols = children.length <= 3 ? 1 : children.length <= 6 ? 2 : 3;

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-all min-h-[44px] ${
          isActive
            ? 'text-pa-gold bg-pa-gold/10'
            : scrolled ? 'text-pa-green hover:text-pa-gold' : 'text-white/90 hover:text-white'
        }`}
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Mega Dropdown */}
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50"
          style={{ minWidth: cols === 1 ? 220 : cols === 2 ? 440 : 640 }}
        >
          {/* Arrow */}
          <div className="w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45 absolute -top-1.5 left-1/2 -translate-x-1/2 shadow-sm" />
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden pt-2">
            {/* Header mega menu */}
            <div className="px-4 py-3 bg-pa-green mx-3 mt-1 rounded-xl mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">{label}</p>
                  {(lang === 'id' ? item.description : item.descriptionEn) && (
                    <p className="text-white/70 text-xs">{lang === 'id' ? item.description : item.descriptionEn}</p>
                  )}
                </div>
              </div>
            </div>
            {/* Grid of children */}
            <div
              className="px-3 pb-4"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px' }}
            >
              {children.map(child => {
                const childLabel = lang === 'en' && child.labelEn ? child.labelEn : child.label;
                const childDesc = lang === 'id' ? child.description : child.descriptionEn;
                const href = resolveUrl(child);
                const isExt = child.type === 'external';
                return (
                  <a
                    key={child.id}
                    href={href}
                    target={child.target === '_blank' ? '_blank' : undefined}
                    rel={isExt ? 'noopener noreferrer' : undefined}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-pa-green/5 transition-colors group"
                  >
                    <span className="text-xl mt-0.5 flex-shrink-0">{child.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-pa-green group-hover:text-pa-gold transition-colors flex items-center gap-1">
                        {childLabel}
                        {isExt && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
                      </p>
                      {childDesc && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{childDesc}</p>}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single Menu Item (no children) ─────────────────────────────
function NavItem({ item, scrolled, activeNav, onScrollTo }) {
  const { lang } = useLanguage();
  const label = lang === 'en' && item.labelEn ? item.labelEn : item.label;
  const isActive = activeNav === item.id || (item.type === 'section' && activeNav === item.url?.replace('#', ''));

  function handleClick(e) {
    if (item.type === 'section') {
      e.preventDefault();
      const sectionId = item.url?.replace('#', '') || '';
      onScrollTo(sectionId);
    }
  }

  const href = resolveUrl(item);
  const isExt = item.type === 'external';

  return (
    <a
      href={href}
      onClick={handleClick}
      target={isExt && item.target === '_blank' ? '_blank' : undefined}
      rel={isExt ? 'noopener noreferrer' : undefined}
      aria-current={isActive ? 'location' : undefined}
      className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-all min-h-[44px] cursor-pointer ${
        isActive
          ? 'text-pa-gold bg-pa-gold/10'
          : scrolled ? 'text-pa-green hover:text-pa-gold' : 'text-white/90 hover:text-white'
      }`}
    >
      {label}
    </a>
  );
}

// ─── Mobile Accordion ────────────────────────────────────────────
function MobileMenuItem({ item, children, onClose, onScrollTo }) {
  const [open, setOpen] = useState(false);
  const { lang } = useLanguage();
  const label = lang === 'en' && item.labelEn ? item.labelEn : item.label;
  const hasChildren = children.length > 0;

  function handleItemClick() {
    if (!hasChildren) {
      if (item.type === 'section') {
        onScrollTo(item.url?.replace('#', '') || '');
      } else {
        window.location.href = resolveUrl(item);
      }
      onClose();
    } else {
      setOpen(o => !o);
    }
  }

  return (
    <div>
      <button
        onClick={handleItemClick}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-pa-green hover:bg-gray-50 rounded-xl min-h-[44px]"
      >
        <span className="flex items-center gap-2">
          <span>{item.icon}</span> {label}
        </span>
        {hasChildren && <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {hasChildren && open && (
        <div className="ml-6 mb-1 space-y-0.5 border-l-2 border-pa-gold/30 pl-3">
          {children.map(child => {
            const childLabel = lang === 'en' && child.labelEn ? child.labelEn : child.label;
            const href = resolveUrl(child);
            const isExt = child.type === 'external';
            return (
              <a
                key={child.id}
                href={href}
                target={isExt && child.target === '_blank' ? '_blank' : undefined}
                rel={isExt ? 'noopener noreferrer' : undefined}
                onClick={() => { if (child.type === 'section') { onScrollTo(child.url?.replace('#', '') || ''); onClose(); } else onClose(); }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 hover:text-pa-green hover:bg-gray-50 rounded-lg min-h-[44px]"
              >
                <span>{child.icon}</span>
                <div>
                  <p className="font-medium leading-tight">{childLabel}</p>
                  {(lang === 'id' ? child.description : child.descriptionEn) && (
                    <p className="text-xs text-gray-500">{lang === 'id' ? child.description : child.descriptionEn}</p>
                  )}
                </div>
                {isExt && <ExternalLink className="w-3 h-3 ml-auto text-gray-500" />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN MEGA MENU NAVBAR ────────────────────────────────────────
export default function MegaMenuNavbar({ scrolled, activeNav, onScrollTo, mobileMenuOpen, setMobileMenuOpen }) {
  const { lang } = useLanguage();
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const drawerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    fetch('/api/menus')
      .then(r => r.json())
      .then(data => { setMenuItems(data.items || []); setMenuLoaded(true); })
      .catch(() => setMenuLoaded(true));
  }, []);

  // Body scroll lock when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Save/restore focus when drawer opens/closes
  useEffect(() => {
    if (mobileMenuOpen) {
      previousActiveElement.current = document.activeElement;
      // Focus the drawer container on open
      requestAnimationFrame(() => {
        if (drawerRef.current) {
          const firstFocusable = drawerRef.current.querySelector(
            'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (firstFocusable) firstFocusable.focus();
        }
      });
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [mobileMenuOpen]);

  // ESC key handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && mobileMenuOpen) {
      e.preventDefault();
      setMobileMenuOpen(false);
    }
  }, [mobileMenuOpen, setMobileMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [mobileMenuOpen, handleKeyDown]);

  // Focus trap
  const handleDrawerKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;

    const focusableElements = drawerRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }, []);

  return (
    <>
      {/* Desktop Nav */}
      <div className="hidden lg:flex items-center gap-0.5">
        {menuLoaded && menuItems.map(item => {
          const children = item.children || [];
          if (children.length > 0) {
            return (
              <MegaDropdown
                key={item.id}
                item={item}
                children={children}
                scrolled={scrolled}
                activeNav={activeNav}
              />
            );
          }
          return (
            <NavItem
              key={item.id}
              item={item}
              scrolled={scrolled}
              activeNav={activeNav}
              onScrollTo={onScrollTo}
            />
          );
        })}
        <div className="ml-2"><LanguageSwitcher scrolled={scrolled} /></div>
        <button
          className={`ml-2 px-4 py-2 text-sm font-semibold rounded-lg min-h-[44px] bg-pa-orange hover:bg-pa-orange-dark text-white transition-colors`}
          onClick={() => window.location.href = '/admin/login'}
        >
          Admin
        </button>
      </div>

      {/* Mobile toggle */}
      <button
        className={`lg:hidden p-2 min-h-[44px] min-w-[44px] rounded-lg ${ scrolled ? 'text-pa-green' : 'text-white'}`}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-expanded={mobileMenuOpen}
        aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
      >
        {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
          onKeyDown={handleDrawerKeyDown}
          className="lg:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-100 shadow-xl"
        >
          <div className="container mx-auto px-4 py-3 space-y-0.5 max-h-[80vh] overflow-y-auto">
            {menuItems.map(item => (
              <MobileMenuItem
                key={item.id}
                item={item}
                children={item.children || []}
                onClose={() => setMobileMenuOpen(false)}
                onScrollTo={onScrollTo}
              />
            ))}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between px-4">
              <LanguageSwitcher scrolled={true} />
              <button
                className="px-4 py-2 bg-pa-gold text-white rounded-lg text-sm font-semibold min-h-[44px]"
                onClick={() => window.location.href = '/admin/login'}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
