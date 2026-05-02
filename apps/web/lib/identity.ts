'use client';

const COLORS = ['#3F3FE0', '#E0653F', '#39B27A', '#C2399F', '#D4A23B', '#3F9FE0', '#7E3FE0'];
const NAMES = ['Aalto', 'Kahn', 'Hadid', 'Niemeyer', 'Ando', 'Gehry', 'Lin', 'Foster'];

type LocalUser = { id: string; name: string; color: string };

let cached: LocalUser | null = null;

export function getLocalUser(): LocalUser {
  if (cached) return cached;
  if (typeof window === 'undefined') {
    return { id: 'ssr', name: 'Architect', color: '#3F3FE0' };
  }
  // Use sessionStorage so each tab gets its own identity (same color/name
  // across reloads, but distinct between tabs of the same browser).
  const stored = window.sessionStorage.getItem('provenance:user');
  if (stored) {
    try {
      cached = JSON.parse(stored);
      return cached!;
    } catch {}
  }
  const id = crypto.randomUUID();
  const name = NAMES[Math.floor(Math.random() * NAMES.length)] ?? 'Architect';
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#3F3FE0';
  cached = { id, name, color };
  window.sessionStorage.setItem('provenance:user', JSON.stringify(cached));
  return cached;
}

export function newId() {
  return crypto.randomUUID();
}
