'use client';
import { createContext, useContext } from 'react';

interface AdminContextType {
  authenticated: boolean;
  logout: () => void;
}

export const AdminContext = createContext<AdminContextType>({ authenticated: false, logout: () => {} });
export const useAdmin = () => useContext(AdminContext);
