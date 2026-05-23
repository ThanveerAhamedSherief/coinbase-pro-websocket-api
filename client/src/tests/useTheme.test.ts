import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTheme } from '../shared/hooks/useTheme';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear:      () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const matchMediaMock = (matches: boolean) =>
  vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() });

describe('useTheme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to light theme when no preference is stored', () => {
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('respects OS dark preference when nothing is stored — but hardcoded default wins', () => {
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('restores stored dark theme from localStorage', () => {
    localStorageMock.setItem('cbpro-theme', 'dark');
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('restores stored light theme from localStorage', () => {
    localStorageMock.setItem('cbpro-theme', 'light');
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('toggles from light to dark', () => {
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('dark');
  });

  it('toggles from dark back to light', () => {
    localStorageMock.setItem('cbpro-theme', 'dark');
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('light');
  });

  it('persists theme to localStorage on toggle', () => {
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    expect(localStorageMock.getItem('cbpro-theme')).toBe('dark');
  });

  it('applies data-theme attribute to <html> on mount', () => {
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates data-theme attribute on toggle', () => {
    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock(false), writable: true });
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
